# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

BarHop（酒鬼地图）— 微信小程序 + Express.js 后端 (v2.0.0)，通过腾讯地图 LBS API 搜索附近酒吧，高德地图 API 补充图片和评分，Redis 缓存结果，MySQL 持久化数据。坐标体系使用 GCJ-02（中国国测局坐标系）。

## 常用命令

```bash
# 启动基础设施（MySQL 8.0 + Redis 7）
docker-compose up -d

# 停止基础设施
docker-compose down

# 安装依赖
cd server && npm install

# 开发模式（nodemon 热重载）
cd server && npm run dev

# 生产模式
cd server && npm start

# 运行测试（注：test.js 文件当前不存在，该脚本为占位）
cd server && npm test
```

注意：docker-compose 将 MySQL 映射到宿主机 **3307** 端口（非默认 3306），`.env.example` 中 `DB_PORT=3307` 与此一致。Redis 使用默认 6379 端口。

## 架构

```
BarHop/
├── server/                    # Node.js 后端 (Express, port 3000)
│   ├── server.js              # 入口：组装 Express app + 启动时数据清理
│   ├── config/index.js        # 集中配置（环境变量 → 默认值）
│   ├── routes/                # 路由层（thin-route 模式，转发到 controller）
│   │   ├── bars.js            # POST /api/bars/nearby, GET/POST/PUT/DELETE /api/bars/*
│   │   ├── users.js           # POST /api/users/login, GET/PUT /api/users/*
│   │   ├── favorites.js       # POST/GET/DELETE /api/favorites
│   │   ├── reviews.js         # POST/GET/DELETE /api/reviews
│   │   ├── upload.js          # POST /api/upload/image(s) — multer 文件上传
│   │   └── proxy.js           # POST /api/lbs/proxy — 服务端代理腾讯地图 API
│   ├── controllers/           # 控制器层（请求处理 + 业务编排）
│   │   ├── bars.js            # 酒吧搜索/CRUD/热门/推荐
│   │   ├── users.js           # 微信登录（jscode2session）+ JWT 签发
│   │   ├── favorites.js       # 收藏增删查（含酒吧详情联表查询）
│   │   └── reviews.js         # 评价创建(upsert)/列表/删除 + 评分汇总更新
│   ├── services/              # 业务逻辑 + 外部数据源
│   │   ├── bar.js             # 核心搜索编排：查缓存 → 查DB → 后台Amap补充 → 写缓存
│   │   ├── lbs.js             # 腾讯地图地点搜索（多关键词合并去重 + 本地过滤）
│   │   ├── amap.js            # 高德地图 POI 搜索/详情（QPS 限流队列，250ms 间隔）
│   │   ├── cache.js           # Redis 缓存（lazy 连接）
│   │   ├── preloader.js       # 定时预加载：每10分钟预热5个城市热门位置的缓存
│   │   └── mock.js            # 5 个成都硬编码酒吧，兜底用（当前未在搜索链路中使用）
│   ├── middlewares/           # CORS（全放通）+ 请求耗时日志 + 响应体日志（写入 logs/ 目录）
│   └── utils/                 # 工具层
│       ├── db.js              # MySQL 连接池（lazy），通用 CRUD 方法
│       ├── errors.js          # 自定义错误类 + asyncHandler 包装器 + 全局 errorHandler
│       ├── response.js        # 统一响应格式（success/error/paginated/notFound 等）
│       ├── validator.js       # Joi schema 定义 + validate() 包装器
│       └── url.js             # 相对路径→完整URL 转换、图片字段解析、XSS 过滤
├── miniprogram/               # 微信小程序前端（原生框架）
│   ├── app.js                 # 全局 App：登录流程（含 Mock 兜底）、网络状态监听
│   ├── pages/index/           # 首页：地图 + 酒吧列表 + 搜索筛选
│   ├── pages/detail/          # 详情页：酒吧信息 + 评价 + 收藏 + 一键导航
│   ├── pages/favorites/       # 收藏页
│   ├── pages/review/          # 评价页
│   ├── pages/profile/         # 个人中心
│   ├── components/            # 全局组件（如 network-banner 网络状态横幅）
│   └── utils/
│       ├── request.js         # wx.request 封装：并发队列(5)、自动重试(2次)、请求去重、Token 注入
│       ├── config.js          # 前端配置（API_BASE_URL、超时、分页大小等）
│       └── errorHandler.js    # 统一错误 toast 提示
├── database/schema.sql        # MySQL 建表 + 10 条成都种子数据
├── docs/API.md                # 完整 API 文档（权威参考）
└── docker-compose.yml
```

## 数据流

### 酒吧搜索链路（核心）

```
用户请求 → barService.searchBars()
  ├─ 1. Redis 缓存命中 → 直接返回
  ├─ 2. 缓存未命中 → MySQL Haversine 查询（含关键词 LIKE + 类型筛选）
  ├─ 3. 拆分：数据完整(有图有评分) vs 需补充(缺图或缺评分)
  ├─ 4. 两类合并后按距离排序立即返回
  └─ 5. 后台异步(setImmediate)：对需补充的酒吧逐批(每批5条/间隔1s)调用高德API
       → 更新 MySQL photos 和 avg_rating → 刷新 Redis 缓存
```

### 预加载链路（生产环境自动运行）

```
Preloader (每10分钟)
  └─ 遍历 5 个预设位置（成都天府广场/春熙路/上海外滩/北京王府井/香港中环）
       ├─ 检查 Redis 是否有缓存 → 有则跳过
       ├─ 无缓存 → 调用腾讯 LBS 多关键词搜索
       ├─ 逐条调用高德 API 补充图片和评分（300ms 间隔）
       └─ 写入 Redis 缓存（TTL 1小时）

可通过 POST /api/bars/preload 手动触发（传 lat/lng 预加载自定义位置，或不传则全量）
```

### 用户评价影响链

```
创建/删除评价 → barService.updateBarUserRating()
  → 重算 reviews 表的 AVG + COUNT → 写入 bars.user_rating / bars.user_review_count
```

## 关键设计细节

### 连接管理
- **Lazy 连接**：MySQL 连接池和 Redis 客户端在首次使用时才初始化，允许服务在数据库就绪前启动。
- **MySQL 连接池**：connectionLimit=10，connectTimeout=10000ms，使用 `mysql2/promise`。
- **Redis**：单客户端 lazy connect，`clear()` 只删除 `bars:*` 前缀的 key。

### 缓存策略
- **Key 格式**：经纬度截断到 4 位小数（约 11m 精度），`bars:nearby:{lat}:{lng}:{r}:{kw}:{type}`。
- **默认 TTL**：600 秒（10 分钟），预加载缓存使用 3600 秒（1 小时）。
- **forceRefresh** 参数可跳过缓存直接查库。

### LBS 多关键词搜索
- 无关键词时自动使用多关键词组合搜索：`['酒吧', '精酿', '酒馆', 'pub', '清吧']`。
- 指定类型时使用对应关键词集合（如精酿吧 → `['精酿', '精酿酒吧', 'brew', 'craft']`）。
- 按 `id` 或 `title+location` 去重。
- 本地 `filterBarResults()` 进行二次过滤：严格排除非酒吧关键词，通过酒吧特征词正向匹配。

### 酒吧类型分类（`classifyBar`）
- 优先级：精酿吧 > 鸡尾酒吧 > 清吧 > 清吧（兜底）。
- 先检查名称中的严格排除词（猫咖、餐厅、酒店等），命中则返回空。
- 按名称关键词匹配类型，名称无特征时检查 tag，仍无则默认"清吧"。

### 评分优先级
- **显示评分**：高德评分 (avg_rating) > 用户评分聚合 (user_rating) > null（"暂无评分"）。
- `user_rating` 和 `user_review_count` 由评价操作触发重算并写入 bars 表。
- 详情接口同时返回 `rating_source` 字段标明来源（`amap` / `user` / `none`）。

### 高德地图 API（Amap）
- **QPS 限流**：请求队列串行执行，最小间隔 250ms（≈4 QPS，适配免费版限制）。
- **重试**：QPS 超限时等待 2s×(retry+1) 后重试，最多 2 次；网络超时同理。
- **用途**：POI 搜索 + 详情获取，补充酒吧图片（photos）和评分（biz_ext.rating）。
- `enrichBar()` 串联 searchPoi → getPoiDetail 两次调用。

### 错误处理体系
- **自定义错误类**：AppError → NotFoundError / BadRequestError / UnauthorizedError / ForbiddenError / ConflictError / ServiceUnavailableError。
- **asyncHandler**：包装异步 controller 方法，自动 catch 异常并转发给 errorHandler。
- **全局 errorHandler**：区分 AppError（返回对应状态码）、数据库错误（ER_DUP_ENTRY 等）、JWT 错误、通用 500。
- **生产环境**：500 错误不暴露 stack trace。

### 响应约定
- **成功**：`{code: 0, data: ..., message: "..."}`。
- **失败**：`{code: -1 或 HTTP 状态码, message: "..."}`。
- `response.js` 提供 `success/error/created/updated/deleted/paginated/unauthorized/forbidden/notFound/badRequest` 便捷方法。

### 请求验证
- 使用 Joi schema 定义验证规则（`validators.searchBars`、`validators.createReview` 等）。
- `validate(schema, data)` 返回 `{valid, errors, value}`，`stripUnknown: true` 自动剔除未知字段。

### 前端登录流程
```
App.onLaunch()
  ├─ wx.login() 获取 code
  ├─ POST /api/users/login {code}
  │    ├─ 后端未配置微信 → 返回 Mock 用户
  │    ├─ 调用 jscode2session 获取 openid
  │    ├─ 新用户自动注册，老用户直接登录
  │    └─ 返回 JWT token + user 对象
  ├─ 存 token/userInfo 到 Storage + globalData
  └─ notifyLoginListeners() 通知所有等待登录完成的页面
```

前端还提供 `onLoginComplete(callback)` 注册回调，若已登录则立即执行，否则排队等待登录完成后触发。

### 前端请求封装（request.js）
- **并发控制**：RequestQueue 限制最大 5 个并发请求。
- **重试**：网络失败自动重试 2 次，超时按 1.5x 递增。
- **去重**：`deduplicate: true` 时，相同 (method, url, data) 的请求共享一个 Promise。
- **Token 管理**：401 时自动清除 Storage 中的 token 和 userInfo。
- **批量请求**：`batchRequest(requests, concurrency)` 控制并发，单个失败不影响其他。

### 数据写入策略
- `insertMany` 对重复 id 执行 `ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`，只更新时间戳，不覆盖已有字段。这意味着 LBS 侧数据变更不会同步到 MySQL 已有记录。
- bars 表 `source` 字段区分来源：`lbs`（腾讯地图）、`manual`（手动创建/种子数据）、`mock`。

### 启动时数据清理
- `server.js` 启动时自动扫描 bars 表中名称包含非酒吧关键词（猫咖、餐厅、酒店等 100+ 关键词）的记录并删除。
- 清理后自动清除所有 Redis 缓存。

### 日志系统
- `middlewares/responseLogger.js`：拦截 `res.json()` 和 `res.send()`，记录完整的请求体和响应体到 `server/logs/api-{date}.log`。
- 日志文件超过 10MB 自动轮转（`.old` 备份）。
- 同时输出 `debugLogger()` 和 `errorLogger()` 工具函数。

## 数据库表结构

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| bars | 酒吧主数据 | id(VARCHAR), lat/lng(DECIMAL), tags, photos(JSON TEXT), avg_rating, user_rating, user_review_count, source |
| bar_search_cache | 搜索缓存（已建表但代码中未使用，缓存仅走 Redis） | query_key, data, ttl |
| users | 微信用户 | id(VARCHAR), openid(UNIQUE), nickname, avatar, signature |
| favorites | 收藏关系 | user_id + bar_id (UNIQUE 联合键) |
| reviews | 用户评价 | user_id + bar_id, rating(DECIMAL), content, images(JSON TEXT) |

## 前端小程序

- 原生微信小程序框架，页面在 `miniprogram/pages/` 下。
- 使用微信 `map` 组件渲染地图，通过 `wx.getLocation({type: 'gcj02'})` 获取位置。
- 导航功能调用 `wx.openLocation` 打开微信内置地图。
- App 全局管理网络状态（`wx.onNetworkStatusChange`），各页面可通过 `onNetworkChange/offNetworkChange` 订阅。
- 年龄确认通过 `wx.getStorageSync('hasConfirmedAge')` 持久化。

## 注意事项

- **无测试**：`package.json` 有 `test` script 指向 `test.js`，但该文件不存在。
- **无 .gitignore**：`node_modules/` 和 `.env`（含真实 LBS Key）未被忽略，操作 git 时需留意。
- **DB 端口**：docker-compose 暴露 MySQL 在 3307，连接时注意不要用默认 3306。
- **API 文档**：完整请求/响应示例见 `docs/API.md`，实现接口时应同步更新该文档。
- **环境变量**：需要配置 `TENCENT_LBS_KEY`（必填，酒吧搜索主数据源）、`AMAP_KEY`（选填但推荐，图片和评分补充）、`WECHAT_APPID` + `WECHAT_SECRET`（微信登录需要）、`JWT_SECRET`（生产环境必须更换默认值）。
- **高德 QPS 限制**：免费版 4 QPS，代码已实现 250ms 限流队列，批量操作时会较慢，注意不要在前端频繁触发需要高德补充的搜索。
- **坐标系统**：全链路使用 GCJ-02，腾讯 LBS 和高德地图均使用此坐标系，前端 `wx.getLocation` 需指定 `type: 'gcj02'`。
