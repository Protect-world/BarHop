# BarHop - 酒鬼地图

> 方圆10km酒鬼地图，一键导航去喝酒 🍻

## 项目简介

BarHop 是一款微信小程序，帮助用户发现周边酒馆，提供地图展示、搜索筛选、详情查看和一键导航功能。

## 技术栈

- **前端**: 微信小程序原生开发
- **后端**: Node.js (v18) + Express
- **数据库**: MySQL (v8) + Redis (v7)
- **地图服务**: 
  - 腾讯位置服务 LBS WebService API（基础搜索）
  - 高德地图 WebService API（图片、评分补充）
- **部署**: Docker Compose (本地)

## 目录结构

```
/barhop
├── /miniprogram          # 微信小程序前端
│   ├── /pages            # 页面
│   │   ├── /index        # 首页（酒馆列表）
│   │   ├── /detail       # 详情页
│   │   ├── /favorites    # 收藏页
│   │   ├── /review       # 评价页
│   │   └── /profile      # 个人中心
│   ├── /utils            # 工具函数
│   ├── /images           # 静态资源
│   └── app.js/json/wxss  # 小程序入口配置
├── /server               # Node.js 后端
│   ├── /routes           # 路由层
│   ├── /controllers      # 控制器
│   ├── /services         # 业务层
│   │   ├── lbs.js        # 腾讯LBS服务
│   │   ├── amap.js       # 高德地图服务
│   │   ├── preloader.js  # 预加载服务
│   │   └── cache.js      # 缓存服务
│   ├── /middlewares      # 中间件
│   ├── /utils            # 工具函数
│   └── /config           # 配置
├── /database             # 数据库脚本
├── server/.env           # 环境变量配置
└── docker-compose.yml    # Docker配置
```

## 快速开始

### 1. 环境要求

- Node.js >= 18.0.0
- Docker & Docker Compose
- 微信开发者工具

### 2. 启动数据库

```bash
docker-compose up -d
```

这会启动：
- MySQL 8.0 (端口 3306)
- Redis 7 (端口 6379)

### 3. 配置环境变量

```bash
cd server
cp .env.example .env
```

编辑 `.env` 文件：

```env
PORT=3000

DB_HOST=localhost
DB_PORT=3306
DB_NAME=barhop
DB_USER=barhop_user
DB_PASSWORD=barhop_pass

REDIS_HOST=localhost
REDIS_PORT=6379

# 腾讯LBS Key（基础搜索）
TENCENT_LBS_KEY=your_tencent_lbs_key_here

# 高德地图 Key（图片+评分补充）
AMAP_KEY=your_amap_key_here
```

### 4. 安装依赖并启动后端

```bash
cd server
npm install
npm run dev
```

后端服务将运行在 `http://localhost:3000`

### 5. 启动小程序

1. 打开微信开发者工具
2. 导入项目，选择 `miniprogram` 目录
3. 点击"编译"按钮

---

## API 接口

### 酒吧相关

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/bars/nearby` | POST | 获取附近酒馆 |
| `/api/bars/:id` | GET | 获取酒馆详情 |
| `/api/bars/preload` | POST | 预加载酒吧数据 |

### 评价相关

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/reviews` | POST | 创建评价 |
| `/api/reviews/bar/:barId` | GET | 获取酒吧评价列表 |
| `/api/reviews/:id` | DELETE | 删除评价 |

### 用户相关

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/users/login` | POST | 用户登录 |
| `/api/users/profile` | GET | 获取用户信息 |
| `/api/users/profile` | PUT | 更新用户信息 |

### 收藏相关

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/favorites` | GET | 获取收藏列表 |
| `/api/favorites` | POST | 添加收藏 |
| `/api/favorites/:barId` | DELETE | 取消收藏 |

---

## 核心功能

### 已实现 ✅

- [x] 年龄验证弹窗（年满18岁）
- [x] 自动定位 + 地图渲染
- [x] 附近酒馆列表（分页加载：默认10条，下滑加载更多，最多20条）
- [x] 酒馆详情页（照片、营业时间、电话）
- [x] 一键导航（调用微信内置地图）
- [x] 关键词搜索 + 搜索历史
- [x] 分类筛选（精酿吧/鸡尾酒吧/清吧）
- [x] 地图标记点点击跳转详情
- [x] 用户信息管理（昵称、头像、签名）
- [x] 收藏功能
- [x] 评价功能（评分、文字、图片）
- [x] 高德地图API集成（获取真实图片和评分）
- [x] 后台预加载服务（定时刷新热门区域数据）
- [x] 详情页穿透问题修复
- [x] 默认图片美化（卡通酒杯风格）

### 进行中 🚧

- [ ] 评价系统完善（点赞、举报、多维度评分）
- [ ] 消息通知系统
- [ ] 社区动态

### 规划中 📋

- [ ] 酒吧排行榜
- [ ] 附近酒吧推送
- [ ] 酒吧活动/优惠信息
- [ ] 社交功能（好友、群组）

---

## 架构设计

### 数据流程图

```
用户请求 → 前端页面
    ↓
API 请求 → 后端 Express 服务
    ↓
检查 Redis 缓存 → 命中则直接返回
    ↓
未命中 → 调用腾讯LBS获取基础数据
    ↓
检查数据库缓存 → 已有数据直接使用
    ↓
需要补充 → 并发调用高德API（图片+评分）
    ↓
持久化到 MySQL + 缓存到 Redis
    ↓
返回给前端
```

### 性能优化措施

| 优化项 | 说明 |
|--------|------|
| **Redis缓存** | 缓存搜索结果，TTL 1小时 |
| **数据库缓存检查** | 已有图片+评分的酒吧不重复调用高德API |
| **并发请求** | 使用 asyncPool 并发3路调用高德API |
| **请求限流** | 高德API 200ms间隔，避免QPS超限 |
| **预加载** | 后台定时刷新热门区域数据 |
| **前端分页** | 默认10条，下滑加载更多，减少首屏数据量 |

---

## 高德地图API集成

### 为什么需要高德？

腾讯LBS提供基础的POI搜索，但不包含：
- 真实的店内照片
- 用户评分
- 详细的营业信息

高德地图API补充这些数据，提供更丰富的用户体验。

### API调用流程

1. 先通过腾讯LBS获取酒吧列表（名称+位置）
2. 遍历列表，通过高德API补充图片和评分
3. 对每个酒吧：
   - 调用 `place/text` 搜索（按名称匹配）
   - 调用 `place/detail` 获取详情（图片、评分）
4. 将补充数据持久化到数据库

### 限流策略

```javascript
// 高德免费版QPS限制：5次/秒
// 实现200ms最小间隔
this.minRequestInterval = 200;

// 并发控制：最多3个请求同时进行
// 避免触发QPS限制
```

---

## 预加载服务

### 功能说明

预加载服务在后台定时刷新热门城市的酒吧数据，提升用户首次访问时的加载速度。

### 预设热点区域

```javascript
this.preloadLocations = [
  { lat: 30.6571, lng: 104.0627, name: '成都天府广场' },
  { lat: 30.5728, lng: 104.0668, name: '成都春熙路' },
  { lat: 31.2304, lng: 121.4737, name: '上海外滩' },
  { lat: 39.9042, lng: 116.4074, name: '北京王府井' },
  { lat: 22.3193, lng: 114.1694, name: '香港中环' }
];
```

### 触发方式

```bash
# 手动触发全量预加载
POST /api/bars/preload

# 手动触发指定位置预加载
POST /api/bars/preload
{
  "lat": 30.5728,
  "lng": 104.0668
}
```

---

## 微信小程序后台配置

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入开发管理 → 开发设置
3. 配置服务器域名：
   - request合法域名: `http://localhost:3000`
   - uploadFile合法域名: `http://localhost:3000`
4. 配置位置权限：
   - 在 `app.json` 中已配置 `scope.userLocation`

---

## 重要规则

1. **API Key 安全**: 地图Key只存放在后端`.env`，前端通过代理访问
2. **坐标系**: 统一使用 GCJ-02 坐标系
3. **年龄合规**: 未满18岁禁止使用
4. **防空白屏**: LBS无数据时自动返回Mock数据
5. **高德QPS**: 严格控制200ms间隔，避免触发频率限制
6. **数据持久化**: 所有补充数据存入MySQL，避免重复请求

---

## 数据库表结构

详见 [database/schema.sql](database/schema.sql)

主要表：
- `bars` - 酒吧信息
- `users` - 用户信息
- `favorites` - 收藏记录
- `reviews` - 评价记录
- `bar_search_cache` - 搜索缓存

---

## 接下来的任务

### 🔥 高优先级

1. **评价系统完善**
   - 实现点赞/点踩功能
   - 添加评价举报功能
   - 多维度评分（氛围、服务、性价比）
   - 评价分页加载优化

2. **WXML编译错误验证**
   - 确认修复后的代码在真机上正常运行
   - 测试各种边界场景

### ⚡ 中优先级

3. **性能监控**
   - 添加接口响应时间统计
   - 优化首屏加载速度
   - 图片懒加载实现

4. **用户体验优化**
   - 添加下拉刷新
   - 优化空状态展示
   - 添加加载骨架屏

### 📚 低优先级

5. **数据分析**
   - 用户行为埋点
   - 热门酒吧统计
   - 用户偏好分析

6. **运营功能**
   - 官方推荐酒吧
   - 限时优惠推送
   - 酒吧排行榜

---

## 常见问题

### Q: 高德API调用失败怎么办？

A: 
1. 检查 `.env` 中的 `AMAP_KEY` 是否正确
2. 确认 Key 已开通 WebService API 权限
3. 查看后端日志中的错误信息
4. 系统会自动降级使用默认图片，不会影响基本功能

### Q: 如何重置缓存？

A: 
```bash
# 调用清除缓存接口（需添加）
DELETE /api/cache/clear

# 或直接清除Redis
redis-cli FLUSHDB
```

### Q: 支持哪些城市？

A: 目前预设了5个热点城市，可在 `server/services/preloader.js` 中添加更多。

---

## 更新日志

### v1.2.0 (2026-07-29)

- ✅ 集成高德地图API，获取真实图片和评分
- ✅ 实现后台预加载服务
- ✅ 优化高德API调用（并发3路+数据库缓存检查）
- ✅ 修复详情页底部按钮穿透问题
- ✅ 实现首页分页加载（默认10条，下滑加载更多，最多20条）
- ✅ 美化默认图片（卡通酒杯风格）
- ✅ 完成评价系统技术方案设计

### v1.1.0 (2026-07-28)

- ✅ 添加收藏功能
- ✅ 添加评价功能基础实现
- ✅ 完善用户信息管理
- ✅ 添加搜索历史功能

### v1.0.0 (2026-07-27)

- ✅ 项目初始化
- ✅ 实现核心功能：地图、搜索、详情、导航
- ✅ 对接腾讯LBS API
- ✅ 年龄验证合规

---

## License

MIT
