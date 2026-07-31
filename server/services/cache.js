const redis = require('redis');
const config = require('../config');

let client = null;

async function getClient() {
  if (!client) {
    client = redis.createClient({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password
    });

    client.on('error', (err) => {
      console.error('[Redis] 连接错误:', err);
    });

    client.on('connect', () => {
      console.log('[Redis] 连接成功');
    });

    await client.connect();
  }
  return client;
}

const cacheService = {
  async get(key) {
    try {
      const client = await getClient();
      const value = await client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('[Cache] 获取失败:', error);
      return null;
    }
  },

  async set(key, value, ttl = config.cache.ttl) {
    try {
      const client = await getClient();
      await client.set(key, JSON.stringify(value), { EX: ttl });
      return true;
    } catch (error) {
      console.error('[Cache] 设置失败:', error);
      return false;
    }
  },

  async del(key) {
    try {
      const client = await getClient();
      await client.del(key);
      return true;
    } catch (error) {
      console.error('[Cache] 删除失败:', error);
      return false;
    }
  },

  async exists(key) {
    try {
      const client = await getClient();
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('[Cache] 检查失败:', error);
      return false;
    }
  },

  async clear() {
    try {
      const client = await getClient();
      const keys = await client.keys('bars:*');
      if (keys.length > 0) {
        await client.del(keys);
      }
      console.log('[Cache] 已清除所有缓存');
      return true;
    } catch (error) {
      console.error('[Cache] 清除失败:', error);
      return false;
    }
  },

  generateKey(lat, lng, radius, keyword, type) {
    return `bars:nearby:${lat.toFixed(4)}:${lng.toFixed(4)}:${radius}:${keyword || 'none'}:${type || 'none'}`;
  }
};

module.exports = cacheService;