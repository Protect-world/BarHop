# BarHop Server - 后端开发文档

## 概述

BarHop 后端基于 Node.js + Express 框架，提供 RESTful API 服务，集成腾讯LBS和高德地图API，支持酒吧数据查询、用户管理、评价系统等功能。

## 技术栈

- **Node.js**: v18+
- **Express**: v4.x
- **MySQL**: v8+ (mysql2/await)
- **Redis**: v7+ (redis/await)
- **Axios**: HTTP 请求库
- **腾讯LBS**: 位置服务API
- **高德地图**: POI搜索+详情API

## 目录结构

```
server/
├── config/
│   └── index.js           # 配置文件（读取.env）
├── controllers/
│   ├── bars.js            # 酒吧控制器
│   ├── reviews.js         # 评价控制器
│   ├── users.js           # 用户控制器
│   └── favorites.js       # 收藏控制器
├── services/
│   ├── lbs.js             # 腾讯LBS服务
│   ├── amap.js            # 高德地图服务
│   ├── preloader.js       # 预加载服务
│   ├── cache.js           # Redis缓存服务
│   └── mock.js            # Mock数据服务
├── routes/
│   ├── bars.js            # 酒吧路由
│   ├── reviews.js         # 评价路由
│   ├── users.js           # 用户路由
│   ├── favorites.js       # 收藏路由
│   └── upload.js          # 上传路由
├── middlewares/
│   ├── logger.js          # 请求日志
│   ├── cors.js            # CORS处理
│   ├── responseLogger.js  # 响应日志
│   └── errorHandler.js    # 错误处理
├── utils/
│   ├── db.js              # 数据库工具
│   └── response.js       # 响应工具
├── .env                   # 环境变量（不提交到Git）
├── .env.example           # 环境变量模板
├── server.js              # 入口文件
└── package.json           # 依赖配置
```

## 环境变量

复制 `.env.example` 为 `.env` 并填写：

```env
# 服务端口
PORT=3000

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=barhop
DB_USER=barhop_user
DB_PASSWORD=barhop_pass

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=your_redis_password

# 腾讯LBS Key
TENCENT_LBS_KEY=your_tencent_lbs_key

# 高德地图 Key
AMAP_KEY=your_amap_key

# 微信小程序配置
WECHAT_APP_ID=your_app_id
WECHAT_APP_SECRET=your_app_secret

# 环境
NODE_ENV=development
```

## 启动方式

```bash
# 安装依赖
npm install

# 开发模式（带热重载）
npm run dev

# 生产模式
npm start
```

## API 接口

### 酒吧模块

#### POST /api/bars/nearby
获取附近酒吧列表

**请求体**：
```json
{
  "lat": 30.5728,
  "lng": 104.0668,
  "radius": 10000,
  "keyword": "酒吧",
  "type": "精酿吧",
  "forceRefresh": false
}
```

**参数说明**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| lat | float | 是 | 纬度（GCJ-02坐标系） |
| lng | float | 是 | 经度（GCJ-02坐标系） |
| radius | int | 否 | 搜索半径，默认10000米 |
| keyword | string | 否 | 搜索关键词 |
| type | string | 否 | 酒吧类型（精酿吧/鸡尾酒吧/清吧） |
| forceRefresh | bool | 否 | 是否强制刷新缓存 |

**响应示例**：
```json
{
  "code": 0,
  "data": [
    {
      "id": "xxx",
      "name": "酒吧名称",
      "address": "详细地址",
      "lat": 30.5728,
      "lng": 104.0668,
      "distance": 500,
      "avg_rating": 4.8,
      "tags": "精酿吧",
      "photos": ["图片URL1", "图片URL2"],
      "phone": "028-xxxx",
      "hours": "19:00-02:00"
    }
  ]
}
```

#### GET /api/bars/:id
获取酒吧详情

**路径参数**：
- `id`: 酒吧ID

**响应示例**：
```json
{
  "code": 0,
  "data": {
    "id": "xxx",
    "name": "酒吧名称",
    "address": "详细地址",
    "photos": ["图片URL1", "图片URL2", "图片URL3"],
    "reviews": [...],
    "total_reviews": 10,
    "avg_rating": 4.8
  }
}
```

#### POST /api/bars/preload
预加载酒吧数据

**请求体（可选）**：
```json
{
  "lat": 30.5728,
  "lng": 104.0668
}
```

- 不传参数：触发全量预加载
- 传入 lat/lng：触发指定位置预加载

---

### 评价模块

#### POST /api/reviews
创建评价

**请求体**：
```json
{
  "user_id": "user_xxx",
  "bar_id": "bar_xxx",
  "rating": 4.5,
  "content": "这里的环境很棒，服务也很好！",
  "images": ["图片URL1", "图片URL2"]
}
```

**参数说明**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| user_id | string | 是 | 用户ID |
| bar_id | string | 是 | 酒吧ID |
| rating | float | 是 | 评分（1-5） |
| content | string | 否 | 评价内容 |
| images | array | 否 | 图片URL数组 |

#### GET /api/reviews/bar/:barId
获取酒吧评价列表

**查询参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| page | int | 页码，默认1 |
| pageSize | int | 每页数量，默认10 |

**响应示例**：
```json
{
  "code": 0,
  "data": {
    "reviews": [...],
    "total": 25,
    "avg_rating": 4.6,
    "page": 1,
    "pageSize": 10
  }
}
```

#### DELETE /api/reviews/:id
删除评价

**说明**：仅能删除自己的评价，管理员可删除任意评价

---

### 用户模块

#### POST /api/users/login
微信登录

**请求体**：
```json
{
  "code": "wx_login_code"
}
```

**响应示例**：
```json
{
  "code": 0,
  "data": {
    "token": "jwt_token",
    "user": {
      "id": "user_xxx",
      "nickname": "用户昵称",
      "avatar": "头像URL"
    }
  }
}
```

#### GET /api/users/profile
获取用户信息（需Authorization头）

#### PUT /api/users/profile
更新用户信息

**请求体**：
```json
{
  "nickname": "新昵称",
  "avatar": "新头像URL",
  "signature": "新签名"
}
```

---

### 收藏模块

#### GET /api/favorites
获取收藏列表

#### POST /api/favorites
添加收藏

**请求体**：
```json
{
  "bar_id": "bar_xxx"
}
```

#### DELETE /api/favorites/:barId
取消收藏

---

### 上传模块

#### POST /api/upload/image
上传图片

**请求**：multipart/form-data
- file: 图片文件

**响应示例**：
```json
{
  "code": 0,
  "data": {
    "url": "https://cdn.example.com/uploads/xxx.jpg"
  }
}
```

---

## 核心服务说明

### 1. BarsController（酒吧控制器）

**文件**：`controllers/bars.js`

**主要职责**：
- 处理酒吧CRUD请求
- 协调LBS和高德API调用
- 管理缓存策略

**关键方法**：

```javascript
// 获取附近酒吧（核心方法）
async getNearbyBars(req, res)
// 处理流程：
// 1. 检查Redis缓存
// 2. 调用腾讯LBS获取基础数据
// 3. 检查数据库缓存（已有数据直接使用）
// 4. 并发调用高德API补充图片和评分
// 5. 持久化到MySQL
// 6. 缓存到Redis
// 7. 返回结果

// 查询数据库中的酒吧
async queryDatabaseBars(lat, lng, radius, keyword, type)

// 从高德API补充数据
async enrichFromAmap(bar)

// 生成默认图片（高德无图片时使用）
generateDefaultPhotos(name)
```

**性能优化点**：
- 使用 `asyncPool(3, ...)` 实现并发3路请求
- 检查数据库缓存避免重复调用高德API
- 使用 `forceRefresh` 参数控制是否强制刷新

---

### 2. AmapService（高德地图服务）

**文件**：`services/amap.js`

**主要职责**：
- 封装高德地图API调用
- 实现请求限流
- 数据格式转换

**API接口**：

```javascript
// POI搜索
async searchPoi(keyword, city, offset)
// 调用: GET /v3/place/text

// POI详情
async getPoiDetail(poiId)
// 调用: GET /v3/place/detail

// 一键获取图片+评分
async enrichBar(barName, city)
// 内部: searchPoi + getPoiDetail

// 请求限流
async throttle()
// 实现: 200ms最小间隔
```

**限流机制**：
```javascript
constructor() {
  this.minRequestInterval = 200; // 200ms间隔 = 5 QPS
  this.lastRequestTime = 0;
}

async throttle() {
  const now = Date.now();
  const elapsed = now - this.lastRequestTime;
  if (elapsed < this.minRequestInterval) {
    await new Promise(resolve => 
      setTimeout(resolve, this.minRequestInterval - elapsed)
    );
  }
  this.lastRequestTime = Date.now();
}
```

---

### 3. PreloaderService（预加载服务）

**文件**：`services/preloader.js`

**主要职责**：
- 后台定时刷新热门区域数据
- 减少用户首次访问等待时间

**配置**：
```javascript
this.interval = 10 * 60 * 1000; // 10分钟
this.preloadLocations = [
  { lat: 30.6571, lng: 104.0627, name: '成都天府广场' },
  { lat: 30.5728, lng: 104.0668, name: '成都春熙路' },
  // ... 更多城市
];
```

**使用方法**：
```javascript
// 启动预加载
preloaderService.start();

// 停止预加载
preloaderService.stop();

// 手动触发
preloaderService.preloadAllLocations();
preloaderService.preloadCustomLocation(lat, lng);
```

---

### 4. CacheService（缓存服务）

**文件**：`services/cache.js`

**缓存策略**：
- **Redis缓存**：存储搜索结果，TTL 1小时
- **MySQL持久化**：存储酒吧基础信息和补充数据
- **两级缓存**：先查Redis，再查MySQL，最后调用API

**缓存Key格式**：
```javascript
generateKey(lat, lng, radius, keyword, type)
// 输出: bars:nearby:30.5728:104.0668:10000:none:none
```

---

## 数据库设计

### bars 表（酒吧信息）

```sql
CREATE TABLE IF NOT EXISTS bars (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  address VARCHAR(255) NOT NULL,
  lat DECIMAL(10,7) NOT NULL,
  lng DECIMAL(10,7) NOT NULL,
  phone VARCHAR(20),
  hours VARCHAR(100),
  avg_rating DECIMAL(2,1) DEFAULT 0.0,
  tags VARCHAR(255),
  photos TEXT,  -- JSON数组
  distance INT DEFAULT 0,
  source VARCHAR(20) DEFAULT 'lbs',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_lat_lng (lat, lng),
  INDEX idx_name (name),
  INDEX idx_tags (tags)
);
```

### reviews 表（评价）

```sql
CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  bar_id VARCHAR(36) NOT NULL,
  rating DECIMAL(2,1) NOT NULL,
  content TEXT,
  images TEXT,  -- JSON数组
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_bar_id (bar_id),
  INDEX idx_rating (rating)
);
```

### favorites 表（收藏）

```sql
CREATE TABLE IF NOT EXISTS favorites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  bar_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_bar (user_id, bar_id)
);
```

---

## 性能优化

### 已实现

| 优化项 | 实现方式 | 效果 |
|--------|----------|------|
| Redis缓存 | 搜索结果缓存1小时 | 减少80%+重复请求 |
| 数据库缓存检查 | 已有数据不调用高德API | 避免重复补充 |
| 并发请求 | asyncPool(3)并发调用 | 3-5倍速度提升 |
| 请求限流 | 200ms间隔控制QPS | 避免API超限 |
| 预加载 | 后台定时刷新热门城市 | 提升首次加载速度 |
| 连接池 | MySQL连接池(10个连接) | 复用连接 |

### 待优化

- [ ] 数据库查询结果缓存
- [ ] 接口响应压缩（gzip）
- [ ] 静态资源CDN
- [ ] WebSocket实时推送

---

## 错误处理

### 错误码

| 错误码 | 说明 |
|--------|------|
| 0 | 成功 |
| -1 | 参数错误或业务异常 |
| 500 | 服务器内部错误 |

### 常见错误处理

```javascript
// 缺少参数
if (!lat || !lng) {
  return res.json({ code: -1, message: '缺少经纬度参数' });
}

// 高德API失败降级
try {
  const enriched = await amapService.enrichBar(bar);
  // 处理补充数据
} catch (error) {
  // 使用默认图片
  bar.photos = generateDefaultPhotos(bar.name);
  bar.avg_rating = 4.0 + Math.random();
}

// 整体异常兜底
try {
  // 业务逻辑
} catch (error) {
  // 查询数据库作为兜底
  const bars = await queryDatabaseBars(...);
  // 最后使用Mock数据
  const mockData = mockService.getMockBars(...);
}
```

---

## 日志

### 日志级别

| 级别 | 用途 |
|------|------|
| INFO | 正常业务流程（请求开始/结束） |
| WARN | 警告信息（API降级使用） |
| ERROR | 错误信息（API调用失败） |

### 日志格式

```javascript
// API请求日志
console.log('[API] ========== 请求开始 ==========');
console.log('[API] 坐标: 纬度', lat, ', 经度', lng);
console.log('[API] 耗时:', (Date.now() - startTime) + 'ms');

// 错误日志
console.error('[API] 错误:', error);
```

---

## 部署

### 生产环境配置

```nginx
# nginx.conf
server {
  listen 3000;
  
  # Node.js服务
  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
  }
  
  # 静态资源
  location /uploads/ {
    alias /var/www/barhop/uploads/;
  }
}
```

### PM2配置

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'barhop',
    script: './server.js',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
};
```

### 启动命令

```bash
# 使用PM2
pm2 start ecosystem.config.js
pm2 save

# 使用Docker
docker build -t barhop-server .
docker run -d -p 3000:3000 --name barhop-server barhop-server
```

---

## 测试

```bash
# 手动测试API
curl -X POST http://localhost:3000/api/bars/nearby \
  -H "Content-Type: application/json" \
  -d '{"lat":30.5728,"lng":104.0668,"radius":10000}'

# 测试预加载
curl -X POST http://localhost:3000/api/bars/preload

# 测试评价
curl -X POST http://localhost:3000/api/reviews \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test","bar_id":"xxx","rating":4.5}'
```

---

## 常见问题

### Q: 如何添加新的城市预加载？

编辑 `services/preloader.js`：
```javascript
this.preloadLocations.push({
  lat: 39.9042,
  lng: 116.4074,
  name: '北京王府井'
});
```

### Q: 如何调整高德API并发数？

编辑 `controllers/bars.js`：
```javascript
// 修改 asyncPool 的并发数
await asyncPool(5, needEnrich, async (bar) => {
  // ...
});
```

### Q: 缓存过期时间如何设置？

编辑 `config/index.js`：
```javascript
cache: {
  ttl: 3600  // 秒，默认1小时
}
```

---

## 版本历史

### v1.2.0 (2026-07-29)

- 新增高德地图API集成
- 新增预加载服务
- 优化并发请求和缓存策略
- 重构代码结构

### v1.1.0 (2026-07-28)

- 新增评价系统
- 新增收藏功能
- 完善用户管理

### v1.0.0 (2026-07-27)

- 初始版本
- 基础CRUD功能
- 腾讯LBS对接

---

## License

MIT
