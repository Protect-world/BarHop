const config = require('./config');

// 请求队列管理（并发控制）
class RequestQueue {
  constructor(maxConcurrency = 5) {
    this.maxConcurrency = maxConcurrency;
    this.active = 0;
    this.queue = [];
  }

  async add(fn) {
    if (this.active >= this.maxConcurrency) {
      return new Promise((resolve, reject) => {
        this.queue.push({ fn, resolve, reject });
      });
    }
    return this.execute(fn);
  }

  async execute(fn) {
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        this.execute(next.fn).then(next.resolve).catch(next.reject);
      }
    }
  }
}

// 防抖请求（防止重复请求）
const pendingRequests = new Map();

const requestQueue = new RequestQueue(5);

function getToken() {
  return wx.getStorageSync(config.CACHE_KEYS.TOKEN) || '';
}

// 带重试的请求
function request(options) {
  const {
    url,
    method = 'GET',
    data = {},
    header = {},
    needAuth = true,
    retry = 2,
    timeout = config.TIMEOUT || 10000,
    deduplicate = false
  } = options;

  const fullUrl = `${config.API_BASE_URL}${url}`;

  // 请求去重
  if (deduplicate) {
    const key = `${method}:${url}:${JSON.stringify(data)}`;
    if (pendingRequests.has(key)) {
      return pendingRequests.get(key);
    }
  }

  const requestPromise = requestQueue.add(() => {
    return new Promise((resolve, reject) => {
      let retryCount = 0;
      let currentTimeout = timeout;

      const doRequest = () => {
        const startTime = Date.now();
        const requestHeader = {
          'Content-Type': 'application/json',
          ...header
        };

        if (needAuth) {
          const token = getToken();
          if (token) {
            requestHeader['Authorization'] = 'Bearer ' + token;
          }
        }

        wx.request({
          url: fullUrl,
          method,
          data,
          header: requestHeader,
          timeout: currentTimeout,
          success: (res) => {
            const duration = Date.now() - startTime;
            
            if (res.statusCode === 401) {
              wx.removeStorageSync(config.CACHE_KEYS.TOKEN);
              wx.removeStorageSync(config.CACHE_KEYS.USER_INFO);
              console.warn('[Request] Token已过期');
              reject({ code: 401, message: '登录已过期，请重新登录' });
              return;
            }

            if (res.data.code === 0) {
              resolve(res.data);
            } else {
              reject(res.data);
            }
          },
          fail: (err) => {
            const duration = Date.now() - startTime;
            
            // 重试逻辑
            if (retryCount < retry) {
              retryCount++;
              currentTimeout = timeout * Math.pow(1.5, retryCount);
              console.log(`[Request] 重试 ${retryCount}/${retry}: ${fullUrl}`);
              setTimeout(doRequest, 1000 * retryCount);
            } else {
              reject({ code: -1, message: '网络请求失败，请检查网络连接' });
            }
          }
        });
      };

      doRequest();
    });
  });

  if (deduplicate) {
    const key = `${method}:${url}:${JSON.stringify(data)}`;
    pendingRequests.set(key, requestPromise);
    requestPromise.finally(() => {
      pendingRequests.delete(key);
    });
  }

  return requestPromise;
}

// 批量请求（并发控制）
async function batchRequest(requests, concurrency = 3) {
  const results = [];
  const executing = [];

  for (const req of requests) {
    const promise = request(req).then(result => ({
      success: true,
      data: result,
      error: null
    })).catch(error => ({
      success: false,
      data: null,
      error
    }));

    results.push(promise);
    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      const index = results.indexOf(executing[0]);
      if (index > -1) {
        results[index] = await results[index];
      }
      executing.shift();
    }
  }

  return Promise.all(results);
}

// 取消所有待处理请求
function cancelAll() {
  pendingRequests.clear();
  console.log('[Request] 已取消所有待处理请求');
}

// API接口封装
const api = {
  // 认证相关
  async login(code) {
    return request({
      url: '/api/users/login',
      method: 'POST',
      data: { code },
      needAuth: false,
      deduplicate: true
    });
  },

  // 酒吧相关
  async getNearbyBars(data) {
    return request({
      url: '/api/bars/nearby',
      method: 'POST',
      data,
      retry: 2
    });
  },

  async getBarById(id) {
    return request({
      url: `/api/bars/${id}`,
      method: 'GET'
    });
  },

  // 收藏相关
  async getFavorites(params) {
    const queryString = Object.entries(params || {})
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    return request({
      url: `/api/favorites${queryString ? '?' + queryString : ''}`,
      method: 'GET'
    });
  },

  async addFavorite(barId) {
    return request({
      url: '/api/favorites',
      method: 'POST',
      data: { bar_id: barId }
    });
  },

  async removeFavorite(barId) {
    return request({
      url: `/api/favorites`,
      method: 'DELETE',
      data: { bar_id: barId }
    });
  },

  async checkFavorite(barId) {
    return request({
      url: `/api/favorites/check?bar_id=${barId}`,
      method: 'GET'
    });
  },

  // 评价相关
  async getBarReviews(barId) {
    return request({
      url: `/api/reviews/bar/${barId}`,
      method: 'GET'
    });
  },

  async createReview(data) {
    return request({
      url: '/api/reviews',
      method: 'POST',
      data
    });
  },

  async deleteReview(id) {
    return request({
      url: `/api/reviews/${id}`,
      method: 'DELETE'
    });
  },

  // 图片上传
  async uploadImage(filePath) {
    return new Promise((resolve, reject) => {
      const token = getToken();
      wx.uploadFile({
        url: `${config.API_BASE_URL}/api/upload/image`,
        filePath,
        name: 'file',
        header: token ? { 'Authorization': 'Bearer ' + token } : {},
        success: (res) => {
          try {
            const data = JSON.parse(res.data);
            if (data.code === 0) {
              resolve(data.data);
            } else {
              reject(data);
            }
          } catch (e) {
            reject({ code: -1, message: '解析上传结果失败' });
          }
        },
        fail: reject
      });
    });
  },

  // 通用请求方法
  async get(url, data) {
    return request({ url, method: 'GET', data });
  },

  async post(url, data) {
    return request({ url, method: 'POST', data });
  },

  async put(url, data) {
    return request({ url, method: 'PUT', data });
  },

  async delete(url, data) {
    return request({ url, method: 'DELETE', data });
  },

  // 批量请求
  async batch(requests, concurrency) {
    return batchRequest(requests, concurrency);
  }
};

module.exports = {
  api,
  request,
  batchRequest,
  cancelAll
};
