const cacheService = require('./cache');
const amapService = require('./amap');
const { barService } = require('./bar');

// 失败酒吧冷却时间（6小时），避免对补图失败的酒吧无限重试耗光额度
const ENRICH_FAIL_COOLDOWN = 6 * 60 * 60; // 秒（Redis TTL）
const ENRICH_FAIL_KEY_PREFIX = 'enrich_fail:';

class PreloaderService {
  constructor() {
    this.isRunning = false;
    // 6 小时一次：免费额度每天 3000 次，5 城市 × 6 关键词 × 4 次/天 = 120 次/天 LBS，留足余量
    this.interval = 6 * 60 * 60 * 1000;
    this.preloadLocations = [
      { lat: 30.6571, lng: 104.0627, name: '成都天府广场' },
      { lat: 30.5728, lng: 104.0668, name: '成都春熙路' }
    ];
    this.timer = null;
  }

  async start() {
    if (this.isRunning) {
      console.log('[Preloader] 已在运行中');
      return;
    }

    this.isRunning = true;
    console.log('[Preloader] 启动预加载服务（6小时周期，仅成都地区）');

    // 启动后延迟 30 秒再执行第一次，避免与启动初始化争抢资源
    setTimeout(async () => {
      if (!this.isRunning) return;
      await this.preloadAllLocations();
    }, 30 * 1000);

    this.timer = setInterval(async () => {
      if (!this.isRunning) return;
      await this.preloadAllLocations();
    }, this.interval);
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('[Preloader] 停止预加载服务');
  }

  async preloadAllLocations() {
    console.log('[Preloader] ========== 开始预加载 ==========');
    const startTime = Date.now();

    for (const location of this.preloadLocations) {
      try {
        await this.preloadLocation(location);
      } catch (error) {
        console.error(`[Preloader] 预加载 ${location.name} 失败:`, error.message);
      }
      // 延迟 2s 避免过于频繁
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`[Preloader] ========== 预加载完成 (耗时: ${(Date.now() - startTime) / 1000}s) ==========`);
  }

  async preloadLocation(location) {
    const { lat, lng, name } = location;
    console.log(`[Preloader] 预加载 ${name} (${lat}, ${lng})`);

    const cacheKey = cacheService.generateKey(lat, lng, 10000, '', '');

    // 缓存未过期则跳过
    const existingCache = await cacheService.get(cacheKey);
    if (existingCache && existingCache.length > 0) {
      console.log(`[Preloader] ${name} 已有缓存(${existingCache.length}条)，跳过`);
      return;
    }

    // 调用 barService.searchBars（内含 数据库→腾讯LBS→高德 完整 fallback 链路）
    // forceRefresh=true 跳过缓存读取，直接走搜索
    const { bars } = await barService.searchBars({
      lat, lng, radius: 10000, keyword: '', type: '', forceRefresh: true
    });

    if (!bars || bars.length === 0) {
      console.log(`[Preloader] ${name} 无酒吧数据`);
      return;
    }

    console.log(`[Preloader] ${name} 获取到 ${bars.length} 条数据`);

    // 对缺少图片/评分的酒吧补详情（带失败冷却，避免无限重试耗光额度）
    const needEnrich = bars.filter(bar =>
      (!bar.photos || bar.photos.length === 0 || !bar.avg_rating || bar.avg_rating === 0)
    );
    let enrichedCount = 0;
    for (const bar of needEnrich) {
      // 检查失败冷却标记
      const failKey = ENRICH_FAIL_KEY_PREFIX + bar.id;
      const isCooling = await cacheService.get(failKey);
      if (isCooling) continue;

      try {
        const enriched = await amapService.enrichBar(bar.name);
        if (enriched.photos && enriched.photos.length > 0) {
          bar.photos = enriched.photos;
          enrichedCount++;
        }
        if (enriched.rating && enriched.rating > 0) {
          bar.avg_rating = parseFloat(enriched.rating.toFixed(1));
        }
        // 补不到图也不立即重试：写失败冷却，6 小时后再试
        if ((!enriched.photos || enriched.photos.length === 0) && (!enriched.rating || enriched.rating === 0)) {
          await cacheService.set(failKey, '1', ENRICH_FAIL_COOLDOWN);
        }
      } catch (_) { /* 单条失败不影响整体 */ }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    console.log(`[Preloader] ${name} 补图成功 ${enrichedCount}/${needEnrich.length} 条`);

    // 写入缓存（1 小时）
    await cacheService.set(cacheKey, bars, 60 * 60);
    console.log(`[Preloader] ${name} 缓存完成`);
  }

  async preloadCustomLocation(lat, lng, radius = 10000) {
    try {
      const cacheKey = cacheService.generateKey(lat, lng, radius, '', '');

      const existingCache = await cacheService.get(cacheKey);
      if (existingCache && existingCache.length > 0) return existingCache;

      const { bars } = await barService.searchBars({
        lat, lng, radius, keyword: '', type: '', forceRefresh: true
      });

      // 串行补图/评分（单条间隔 300ms，留足余量给 4QPS 限制）
      for (const bar of bars) {
        try {
          if (!bar.photos || bar.photos.length === 0 || !bar.avg_rating || bar.avg_rating === 0) {
            const failKey = ENRICH_FAIL_KEY_PREFIX + bar.id;
            const isCooling = await cacheService.get(failKey);
            if (isCooling) continue;

            const enriched = await amapService.enrichBar(bar.name);
            if (enriched.photos && enriched.photos.length > 0) bar.photos = enriched.photos;
            if (enriched.rating && enriched.rating > 0) bar.avg_rating = parseFloat(enriched.rating.toFixed(1));

            if ((!enriched.photos || enriched.photos.length === 0) && (!enriched.rating || enriched.rating === 0)) {
              await cacheService.set(failKey, '1', ENRICH_FAIL_COOLDOWN);
            }
          }
        } catch (_) {}
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      await cacheService.set(cacheKey, bars, 60 * 60);
      return bars;
    } catch (error) {
      console.error('[Preloader] 自定义位置预加载失败:', error.message);
      return [];
    }
  }
}

module.exports = new PreloaderService();
