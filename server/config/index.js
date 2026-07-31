require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT) || 3000,
  env: process.env.NODE_ENV || 'development',
  server: {
    baseUrl: process.env.SERVER_BASE_URL || `http://localhost:${process.env.PORT || 3000}`
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3307,
    database: process.env.DB_NAME || 'barhop',
    user: process.env.DB_USER || 'barhop_user',
    password: process.env.DB_PASSWORD || 'barhop_pass',
    charset: 'utf8mb4'
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  },
  tencent: {
    lbsKey: process.env.TENCENT_LBS_KEY || ''
  },
  amap: {
    key: process.env.AMAP_KEY || ''
  },
  wechat: {
    appId: process.env.WECHAT_APPID || '',
    secret: process.env.WECHAT_SECRET || ''
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'barhop_jwt_secret',
    expiresIn: '30d'
  },
  cache: {
    ttl: 600
  },
  upload: {
    path: 'uploads/',
    maxSize: 10 * 1024 * 1024,
    allowedTypes: ['image/jpeg', 'image/png', 'image/jpg', 'image/webp']
  }
};

module.exports = config;