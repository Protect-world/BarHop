const cacheService = require('./cache');
const lbsService = require('./lbs');
const amapService = require('./amap');

class PreloaderService {
  constructor() {
    this.isRunning = false;
    this.interval = 10 * 60 * 1000; // 10分钟
    this.preloadLocations = [
      { lat: 30.6571, lng: 104.0627, name: '成都天府广场' },
      { lat: 30.5728, lng: 104.0668, name: '成都春熙路' },
      { lat: 31.2304, lng: 121.4737, name: '上海外滩' },
      { lat: 39.9042, lng: 116.4074, name: '北京王府井' },
      { lat: 22.3193, lng: 114.1694, name: '香港中环' }
    ];
  }

  async start() {
    if (this.isRunning) {
      console.log('[Preloader] 已在运行中');
      return;
    }

    this.isRunning = true;
    console.log('[Preloader] 启动预加载服务');

    // 立即执行一次
    await this.preloadAllLocations();

    // 设置定时任务
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
      // 延迟 500ms 避免过于频繁
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`[Preloader] ========== 预加载完成 (耗时: ${(Date.now() - startTime) / 1000}s) ==========`);
  }

  async preloadLocation(location) {
    const { lat, lng, name } = location;
    console.log(`[Preloader] 预加载 ${name} (${lat}, ${lng})`);

    const cacheKey = cacheService.generateKey(lat, lng, 10000, '', '');
    
    // 检查是否已有缓存且未过期
    const existingCache = await cacheService.get(cacheKey);
    if (existingCache && existingCache.length > 0) {
      console.log(`[Preloader] ${name} 已有缓存，跳过`);
      return;
    }

    // 调用 LBS 获取酒吧列表
    const bars = await lbsService.searchNearby(lat, lng, 10000, '', '');
    
    if (bars.length === 0) {
      console.log(`[Preloader] ${name} 无酒吧数据`);
      return;
    }

    console.log(`[Preloader] ${name} 获取到 ${bars.length} 条数据`);

    // 串行获取 Amap 补充数据
    for (const bar of bars) {
      try {
        const enriched = await amapService.enrichBar(bar.name);
        
        if (enriched.photos && enriched.photos.length > 0) {
          bar.photos = enriched.photos;
        }
        if (enriched.rating && enriched.rating > 0) {
          bar.avg_rating = parseFloat(enriched.rating.toFixed(1));
        }
      } catch (error) {
        // 忽略单个酒吧的失败
      }
      
      // 避免请求过快
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // 缓存数据
    await cacheService.set(cacheKey, bars, 60 * 60); // 缓存1小时
    console.log(`[Preloader] ${name} 缓存完成`);
  }

  async preloadCustomLocation(lat, lng, radius = 10000) {
    try {
      const cacheKey = cacheService.generateKey(lat, lng, radius, '', '');
      
      const existingCache = await cacheService.get(cacheKey);
      if (existingCache && existingCache.length > 0) {
        return existingCache;
      }

      const bars = await lbsService.searchNearby(lat, lng, radius, '', '');
      
      for (const bar of bars) {
        try {
          const enriched = await amapService.enrichBar(bar.name);
          if (enriched.photos && enriched.photos.length > 0) {
            bar.photos = enriched.photos;
          }
          if (enriched.rating && enriched.rating > 0) {
            bar.avg_rating = parseFloat(enriched.rating.toFixed(1));
          }
        } catch (error) {
          // 忽略
        }
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
