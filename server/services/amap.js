const axios = require('axios');
const config = require('../config');

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
    const nameDesc = barName ? ` at ${encodeURIComponent(barName)}` : '';
    return [
      `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cute%20cartoon%20beer%20mug%20with%20foam%20kawaii%20style%20colorful${nameDesc}&image_size=square`,
      `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=adorable%20wine%20glass%20illustration%20cartoon%20style%20glowing%20neon${nameDesc}&image_size=square`,
      `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=funny%20cocktail%20drink%20cartoon%20umbrella%20decoration%20vibrant%20colors${nameDesc}&image_size=square`
    ];
  }
}

module.exports = new AmapService();
