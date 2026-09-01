const axios = require('axios');
const config = require('../config');
const monitor = require('./monitor'); // 额度监控（仅计数，不影响业务）

const AMAP_BASE_URL = 'https://restapi.amap.com/v3';

class AmapService {
  constructor() {
    this.key = config.amap.key;
    this.requestQueue = [];
    this.lastRequestTime = 0;
    this.minRequestInterval = 250; // 250ms between requests = 4 QPS (更保守)
    this.isProcessingQueue = false;
  }

  // 入队请求
  async enqueueRequest(fn) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }

  // 处理请求队列
  async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const { fn, resolve, reject } = this.requestQueue.shift();
      
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
      
      // 等待请求间隔
      const now = Date.now();
      const elapsed = now - this.lastRequestTime;
      const waitTime = Math.max(0, this.minRequestInterval - elapsed);
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      this.lastRequestTime = Date.now();
    }

    this.isProcessingQueue = false;
  }

  async searchPoi(keyword, city = '', offset = 5, retryCount = 0) {
    if (!this.key) {
      console.warn('[Amap] 未配置高德地图 Key');
      return [];
    }

    const MAX_RETRIES = 2;

    return this.enqueueRequest(async () => {
      try {
        const params = {
          key: this.key,
          keywords: keyword,
          city,
          offset,
          output: 'JSON',
          extensions: 'base'
        };

        const response = await axios.get(`${AMAP_BASE_URL}/place/text`, { params, timeout: 5000 });
        monitor.track('amap', response.data.status !== '1');

        if (response.data.status !== '1') {
          // 处理QPS超限错误
          if (response.data.info === 'CUQPS_HAS_EXCEEDED_THE_LIMIT') {
            const waitTime = 2000 * (retryCount + 1);
            console.warn(`[Amap] POI搜索QPS超限（第${retryCount + 1}次），等待${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            if (retryCount < MAX_RETRIES) {
              return this.searchPoi(keyword, city, offset, retryCount + 1);
            }
          } else {
            console.error('[Amap] POI搜索失败:', response.data.info);
          }
          return [];
        }

        return response.data.pois || [];
      } catch (error) {
        if (error.code === 'ECONNABORTED' && retryCount < MAX_RETRIES) {
          console.warn(`[Amap] POI搜索超时（第${retryCount + 1}次）`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return this.searchPoi(keyword, city, offset, retryCount + 1);
        }
        console.error('[Amap] POI搜索异常:', error.message);
        return [];
      }
    });
  }

  async getPoiDetail(poiId, retryCount = 0) {
    if (!this.key) return null;

    const MAX_RETRIES = 2; // 最多重试2次

    return this.enqueueRequest(async () => {
      try {
        const params = {
          key: this.key,
          id: poiId,
          output: 'JSON',
          extensions: 'all'
        };

        const response = await axios.get(`${AMAP_BASE_URL}/place/detail`, { params, timeout: 5000 });
        monitor.track('amap', response.data.status !== '1');

        if (response.data.status !== '1') {
          if (response.data.info === 'CUQPS_HAS_EXCEEDED_THE_LIMIT') {
            // QPS超限，等待更长时间后重试
            const waitTime = 2000 * (retryCount + 1);
            console.warn(`[Amap] QPS超限（第${retryCount + 1}次），等待${waitTime}ms后重试`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            if (retryCount < MAX_RETRIES) {
              return this.getPoiDetail(poiId, retryCount + 1);
            }
            console.warn(`[Amap] 达到最大重试次数，放弃: ${poiId}`);
            return null;
          }
          return null;
        }

        const pois = response.data.pois || [];
        return pois.length > 0 ? pois[0] : null;
      } catch (error) {
        // 网络错误也进行重试
        if (error.code === 'ECONNABORTED' && retryCount < MAX_RETRIES) {
          console.warn(`[Amap] 请求超时（第${retryCount + 1}次）: ${poiId}`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return this.getPoiDetail(poiId, retryCount + 1);
        }
        console.error('[Amap] POI详情获取异常:', error.message);
        return null;
      }
    });
  }

  async enrichBar(barName, city = '') {
    try {
      const pois = await this.searchPoi(barName, city, 1);
      if (!pois || pois.length === 0) {
        return { photos: [], rating: 0 };
      }

      const poi = pois[0];
      const detail = await this.getPoiDetail(poi.id);
      
      const result = { photos: [], rating: 0 };
      
      if (detail && detail.photos && detail.photos.length > 0) {
        result.photos = detail.photos.map(p => p.url);
      }
      
      if (detail && detail.biz_ext && detail.biz_ext.rating) {
        result.rating = parseFloat(detail.biz_ext.rating) || 0;
      }
      
      return result;
    } catch (error) {
      console.error('[Amap] 酒吧补充数据异常:', error.message);
      return { photos: [], rating: 0 };
    }
  }

  generatePlaceholderImages(barName) {
    // 不输出任何外部占位图：前端 utils/image.js ensureBarPhotos 会 fallback 到小程序本地 /images/默认图.png
    // 之前用的 Trae 内部图床 URL (trae-api-cn.mchost.guru) 用户手机无法访问，已禁用
    return [];
  }

  /**
   * 高德 周边搜索（/place/around） —— 用于腾讯 LBS 超限时的 fallback 主搜索
   * 注意：高德坐标系是 GCJ-02（与腾讯一致，不需要转换），radius 单位米，最大 50000
   * 文档：https://lbs.amap.com/api/webservice/guide/api/search#around
   */
  async searchAround(lat, lng, radius = 10000, keyword = '', type = '', retryCount = 0) {
    if (!this.key) {
      console.warn('[Amap] 未配置高德地图 Key，周边搜索跳过');
      return [];
    }

    const MAX_RETRIES = 2;

    return this.enqueueRequest(async () => {
      try {
        // 根据 Experience 100003863：周边搜索至少提供一个锚点（keywords 或 type），禁止空条件
        // 同时参考 Experience 100035144：需要把"当前地图中心点+半径"作为闭合检索范围
        const finalKeywords = keyword || this._getTypeKeywords(type).join('|') || '酒吧|精酿|酒馆|pub|清吧';
        const sortrule = 'distance'; // 按距离排序

        const params = {
          key: this.key,
          location: `${lng},${lat}`, // 高德要求 经度,纬度
          radius,
          keywords: finalKeywords,
          offset: 25,
          page: 1,
          output: 'JSON',
          extensions: 'base',
          sortrule
        };

        // 指定类型时加上 typecode 范围锚定，避免召回噪声
        const typeCode = this._getTypeCode(type);
        if (typeCode) params.types = typeCode;

        const response = await axios.get(`${AMAP_BASE_URL}/place/around`, { params, timeout: 6000 });
        monitor.track('amap', response.data.status !== '1');

        if (response.data.status !== '1') {
          if (response.data.info === 'CUQPS_HAS_EXCEEDED_THE_LIMIT') {
            const waitTime = 2000 * (retryCount + 1);
            console.warn(`[Amap] 周边搜索QPS超限（第${retryCount + 1}次），等待${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            if (retryCount < MAX_RETRIES) {
              return this.searchAround(lat, lng, radius, keyword, type, retryCount + 1);
            }
          } else if (response.data.info === 'USER_DAILY_QUERY_OVER_LIMIT') {
            console.warn('[Amap] 周边搜索日额度超限');
          } else {
            console.error('[Amap] 周边搜索失败:', response.data.info, response.data.infocode);
          }
          return [];
        }

        const pois = response.data.pois || [];
        console.log(`[Amap] 周边搜索命中 ${pois.length} 条（keywords=${finalKeywords}, radius=${radius}m）`);
        return pois;
      } catch (error) {
        if (error.code === 'ECONNABORTED' && retryCount < MAX_RETRIES) {
          console.warn(`[Amap] 周边搜索超时（第${retryCount + 1}次）`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return this.searchAround(lat, lng, radius, keyword, type, retryCount + 1);
        }
        console.error('[Amap] 周边搜索异常:', error.message);
        return [];
      }
    });
  }

  /**
   * 把高德 POI 原始数据转换成与腾讯 LBS transformResults 相同的结构（bar 标准格式）
   * 这样 bar.js 后续 filter / enrich / 入库都不用改
   */
  transformPoisToBars(pois, centerLat, centerLng) {
    if (!pois || pois.length === 0) return [];

    return pois
      .filter(poi => poi && poi.id && poi.location) // 过滤残缺数据
      .map(poi => {
        const [lngStr, latStr] = String(poi.location).split(',');
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);
        const name = poi.name || '';
        const tags = this._classifyBarFromAmap(name, poi.type, poi.biz_ext?.type_code);
        const avgRating = parseFloat(poi.biz_ext?.rating) || 0;
        const photos = (poi.photos || []).map(p => p.url);
        const distance = poi.distance
          ? parseInt(poi.distance)
          : haversine(centerLat, centerLng, lat, lng);

        const category = poi.type || '';
        const address = poi.pname + poi.cityname + poi.adname + (poi.address || '');

        return {
          id: poi.id,
          name,
          address,
          lat,
          lng,
          phone: poi.tel || '',
          hours: poi.biz_ext?.open_hours || '',
          avg_rating: avgRating,
          tags,
          photos,
          distance,
          source: 'amap',
          category,
          comment_count: parseInt(poi.biz_ext?.review_count) || 0
        };
      })
      .filter(bar => this._isValidBar(bar)); // 最后一层过滤：排除餐厅、酒店等噪声
  }

  // ========== 辅助方法 ==========

  _getTypeKeywords(type) {
    switch (type) {
      case '精酿吧': return ['精酿', 'craft', 'brew', '鲜啤', '啤酒'];
      case '鸡尾酒吧': return ['鸡尾酒', 'cocktail', '调酒', '威士忌', 'whiskey'];
      case '清吧': return ['清吧', 'pub', '酒馆', '酒廊', 'lounge', '餐吧'];
      default: return [];
    }
  }

  _getTypeCode(type) {
    // 高德 POI typecode 范围
    // 娱乐休闲：080000；酒吧 080700；娱乐休闲场所综合 080001
    // 餐饮：050000；休闲餐饮 050500（酒馆/啤酒屋常挂在这）
    switch (type) {
      case '精酿吧': return '050500|080700';
      case '鸡尾酒吧': return '080700';
      case '清吧': return '050500|080700';
      default: return '050500|080700'; // 默认酒吧/休闲餐饮
    }
  }

  _classifyBarFromAmap(name, typeStr = '', typecode = '') {
    const lower = name.toLowerCase() + (typeStr || '').toLowerCase();
    const craft = ['精酿', 'craft', 'brew', '啤酒', '鲜啤', 'ipa', 'stout', 'lager'];
    const cocktail = ['鸡尾', 'cocktail', '调酒', '威士忌', 'whiskey', 'martini', 'gin'];
    const pub = ['清吧', 'pub', '酒馆', '酒廊', '酒吧', '餐吧', 'lounge', '小酒馆', '居酒屋', 'bistro'];
    if (craft.some(k => lower.includes(k))) return '精酿吧';
    if (cocktail.some(k => lower.includes(k))) return '鸡尾酒吧';
    if (pub.some(k => lower.includes(k))) return '清吧';
    // 看 typecode
    if (String(typecode).startsWith('0807')) return '清吧';
    return '清吧'; // 默认兜底
  }

  _isValidBar(bar) {
    if (!bar.name) return false;
    const nameLower = String(bar.name).toLowerCase();
    const catLower = String(bar.category).toLowerCase();
    // 严格排除词（和 lbs.js 保持一致）
    const exclude = ['猫咖', '咖啡', '西餐厅', '日料', '火锅', '烧烤', '烤肉', '酒店', '宾馆', '民宿',
      '美容院', '美发', '商场', '超市', '便利', '药店', '医院', '学校', '银行', '健身',
      '影院', 'ktv', '网吧', '网咖', '花店', '书店'];
    if (exclude.some(k => nameLower.includes(k) && !nameLower.includes('酒') && !nameLower.includes('bar') && !nameLower.includes('pub'))) {
      return false;
    }
    // 正向特征：名称/类型至少有一个像酒吧
    const positive = ['酒吧', '清吧', '精酿', '鸡尾', '酒馆', '小酒馆', '酒廊', '餐吧', '居酒屋',
      'pub', 'bar', 'beer', 'brew', 'craft', 'cocktail', 'lounge', 'bistro', 'tavern', '0807', '0505'];
    return positive.some(k => nameLower.includes(k) || catLower.includes(k));
  }
}

// Haversine 距离（高德 POI 里不总是自带 distance 字段，这里兜底算一次）
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

module.exports = new AmapService();
