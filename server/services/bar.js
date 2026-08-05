const db = require('../utils/db');
const cacheService = require('./cache');
const urlService = require('../utils/url');
const config = require('../config');

// Haversine距离计算
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

const barService = {
  // 从数据库查询酒吧
  async queryDatabaseBars(lat, lng, radius = 10000, keyword = '', type = '') {
    let sql = `SELECT * FROM bars WHERE 
      (6371 * acos(LEAST(1, GREATEST(-1, 
        cos(radians(?)) * cos(radians(lat)) * cos(radians(lng) - radians(?)) + 
        sin(radians(?)) * sin(radians(lat))
      )))) * 1000 <= ?`;
    let params = [lat, lng, lat, radius];

    // 添加关键词搜索
    if (keyword) {
      sql += ` AND (name LIKE ? OR tags LIKE ? OR address LIKE ?)`;
      const searchTerm = `%${keyword}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // 添加类型筛选（同时匹配 tags 和 category 字段）
    // tags 存储的是细分类型（精酿吧/鸡尾酒吧/清吧），category 是高德大类（娱乐休闲:酒吧）
    if (type) {
      sql += ` AND (tags = ? OR tags LIKE ? OR category LIKE ?)`;
      params.push(type, `%${type}%`, `%${type}%`);
    }

    sql += ' ORDER BY created_at DESC';

    const bars = await db.query(sql, params);
    return bars.map(bar => ({
      ...bar,
      photos: urlService.parsePhotos(bar.photos),
      distance: haversineDistance(lat, lng, parseFloat(bar.lat), parseFloat(bar.lng))
    }));
  },

  // 从高德API获取酒吧详情
  async enrichFromAmap(bar) {
    const amapService = require('./amap');
    try {
      const result = await amapService.getPoiDetail(bar.id);
      if (!result) {
        return { photos: [], rating: 0, deepType: '' };
      }
      return {
        photos: (result.photos || []).map(p => p.url),
        rating: parseFloat(result.biz_ext?.rating) || 0,
        deepType: result.type || ''
      };
    } catch (error) {
      console.error('[BarService] 高德API获取失败:', bar.id, error.message);
      return { photos: [], rating: 0, deepType: '' };
    }
  },

  // 后台异步补充酒吧数据
  async enrichBarsInBackground(bars, cacheKey, lat, lng, radius = 10000, keyword = '', type = '') {
    setImmediate(async () => {
      try {
        // 只处理缺少图片或评分的酒吧
        const needEnrich = bars.filter(bar => {
          const hasPhotos = bar.photos && bar.photos.length > 0;
          const hasRating = bar.avg_rating && parseFloat(bar.avg_rating) > 0;
          return !hasPhotos || !hasRating;
        });

        if (needEnrich.length === 0) {
          console.log('[BarService] 所有酒吧数据完整，无需补充');
          return;
        }

        console.log(`[BarService] 开始补充 ${needEnrich.length} 条酒吧数据（QPS限制，分批处理）`);

        // 分批处理，每批5个，批间隔1秒，避免QPS超限
        const BATCH_SIZE = 5;
        const BATCH_DELAY = 1000; // 批间隔毫秒数

        for (let i = 0; i < needEnrich.length; i += BATCH_SIZE) {
          const batch = needEnrich.slice(i, i + BATCH_SIZE);

          for (const bar of batch) {
            try {
              const enriched = await this.enrichFromAmap(bar);
              let updated = false;

              if (enriched.photos && enriched.photos.length > 0) {
                bar.photos = enriched.photos;
                updated = true;
              }
              if (enriched.rating && enriched.rating > 0) {
                bar.avg_rating = parseFloat(enriched.rating.toFixed(1));
                updated = true;
              }

              if (updated) {
                await db.query(
                  'UPDATE bars SET photos = ?, avg_rating = ? WHERE id = ?',
                  [JSON.stringify(bar.photos || []), bar.avg_rating || 0, bar.id]
                );
                console.log(`[BarService] 数据补充完成: ${bar.name}`);
              }
            } catch (err) {
              console.error(`[BarService] 补充失败: ${bar.name} - ${err.message}`);
            }
          }

          // 批间隔（最后一批不需要）
          if (i + BATCH_SIZE < needEnrich.length) {
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
          }
        }

        // 更新缓存
        const allData = await this.queryDatabaseBars(lat, lng, radius, keyword, type);
        if (allData.length > 0) {
          allData.sort((a, b) => a.distance - b.distance);
          await cacheService.set(cacheKey, allData, config.cache.ttl);
          console.log(`[BarService] 缓存已更新，共 ${allData.length} 条数据`);
        }
      } catch (error) {
        console.error('[BarService] 后台任务异常:', error.message);
      }
    });
  },

  // 获取单个酒吧详情
  async getBarById(id) {
    const bar = await db.findById('bars', id);
    if (!bar) return null;
    return {
      ...bar,
      photos: urlService.parsePhotos(bar.photos)
    };
  },

  // 获取酒吧评分汇总
  async getRatingSummary(barId) {
    // reviews 表没有 status 字段，所有评价都视为有效
    const summary = await db.query(
      `SELECT 
        COUNT(*) as count,
        AVG(rating) as avg_rating,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as r5,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as r4,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as r3,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as r2,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as r1
      FROM reviews 
      WHERE bar_id = ?`,
      [barId]
    );

    const s = summary[0];
    const count = parseInt(s.count) || 0;
    const avgRating = count > 0 ? parseFloat(parseFloat(s.avg_rating).toFixed(1)) : 0;

    return {
      count,
      avg_rating: avgRating,
      distribution: {
        '5': parseInt(s.r5) || 0,
        '4': parseInt(s.r4) || 0,
        '3': parseInt(s.r3) || 0,
        '2': parseInt(s.r2) || 0,
        '1': parseInt(s.r1) || 0
      }
    };
  },

  // 更新酒吧用户评分
  async updateBarUserRating(barId) {
    const summary = await this.getRatingSummary(barId);
    await db.query(
      'UPDATE bars SET user_rating = ?, user_review_count = ? WHERE id = ?',
      [summary.avg_rating, summary.count, barId]
    );
    return summary;
  },

  // 搜索酒吧（带缓存）
  async searchBars(params) {
    const { lat, lng, radius = 10000, keyword = '', type = '', forceRefresh = false } = params;
    const cacheKey = cacheService.generateKey(lat, lng, radius, keyword, type);

    // 检查缓存
    if (!forceRefresh) {
      const cachedData = await cacheService.get(cacheKey);
      if (cachedData && cachedData.length > 0) {
        console.log('[BarService] 命中Redis缓存');
        return { bars: cachedData, fromCache: true };
      }
    }

    // 查询数据库
    let bars = [];
    try {
      bars = await this.queryDatabaseBars(lat, lng, radius, keyword, type);
    } catch (error) {
      console.error('[BarService] 数据库查询失败:', error);
      bars = [];
    }

    // 处理数据补充
    const needEnrich = bars.filter(bar => !bar.photos || bar.photos.length === 0 || bar.avg_rating === 0);
    const cachedBars = bars.filter(bar => !needEnrich.includes(bar));

    // 先返回已有数据
    const result = [...cachedBars, ...needEnrich];
    result.sort((a, b) => a.distance - b.distance);

    // 后台补充
    if (needEnrich.length > 0) {
      this.enrichBarsInBackground(needEnrich, cacheKey, lat, lng, radius, keyword, type);
    }

    // 如果有完整数据则缓存
    if (cachedBars.length > 0 && needEnrich.length === 0) {
      await cacheService.set(cacheKey, result, config.cache.ttl);
    }

    return { bars: result, fromCache: false };
  }
};

module.exports = { barService, haversineDistance };
