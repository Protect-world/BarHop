# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

BarHop（酒鬼地图）— 微信小程序 + Express.js 后端，通过腾讯地图 LBS API 搜索附近酒吧，Redis 缓存结果，MySQL 持久化数据。坐标体系使用 GCJ-02（中国国测局坐标系）。

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
```

注意：docker-compose 将 MySQL 映射到宿主机 **3307** 端口（非默认 3306），`.env.example` 中 `DB_PORT=3307` 与此一致。

## 架构

```
BarHop/
├── server/                 # Node.js 后端 (Express, port 3000)
│   ├── server.js           # 入口，组装 Express app
│   ├── config/index.js     # 集中配置（环境变量 → 默认值）
│   ├── routes/             # 路由层
│   │   ├── bars.js         # POST /api/bars/nearby, GET /api/bars/:id → 转发到 controller
│   │   └── proxy.js        # POST /api/lbs/proxy — 逻辑内联在路由（非 thin-route 模式）
│   ├── controllers/bars.js # 搜索流程编排：查缓存 → 调 LBS → 空则 Mock → 写库+缓存
│   ├── services/           # 外部数据源
│   │   ├── lbs.js          # 腾讯地图地点搜索 API 调用 + 结果转换
│   │   ├── cache.js        # Redis 缓存，lazy 连接
│   │   └── mock.js         # 5 个成都硬编码酒吧，兜底用
│   ├── middlewares/        # CORS（全放通）+ 请求耗时日志
│   └── utils/db.js         # MySQL 连接池（lazy），通用 CRUD 方法
├── miniprogram/            # 微信小程序前端（原生框架）
│   ├── pages/index/        # 首页：地图 + 酒吧列表 + 搜索筛选
│   ├── pages/detail/       # 详情页：酒吧信息 + 一键导航
│   └── utils/request.js    # 封装 wx.request，统一请求后端
├── database/schema.sql     # MySQL 建表脚本（docker-compose 启动时自动执行）
├── docs/API.md             # 完整 API 文档（权威参考）
└── docker-compose.yml
```

## 关键设计细节

- **Lazy 连接**：MySQL 连接池和 Redis 客户端在首次使用时才初始化，允许服务在数据库就绪前启动。
- **兜底策略**：LBS 无结果时返回 Mock 数据；LBS 调用异常时也直接返回 Mock 数据，保证 API 始终有可用响应。
- **缓存粒度**：经纬度截断到 4 位小数（约 11m 精度）生成 Redis key，格式 `bars:nearby:{lat}:{lng}:{r}:{kw}:{type}`，默认 TTL 600 秒。
- **LBS 类型映射**：`精酿吧`→`10018003`，`鸡尾酒吧`→`10018004`，`清吧`→`10018005`，未匹配时回退到 `10018`（餐饮大类）。
- **Proxy 端点**：`POST /api/lbs/proxy` 接收 `{uri, params}`，由服务端附加 `key` 后转发腾讯地图 API，前端不接触 key。
- **响应约定**：成功 `{code: 0, data: ...}`，失败 `{code: -1, message: "..."}`。
- **数据写入**：`insertMany` 对重复 id 执行 `ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`，只更新时间戳，不覆盖已有字段。这意味着 LBS 侧数据变更不会同步到 MySQL 已有记录。
- **MySQL 双表**：`bars` 表（酒吧数据）+ `bar_search_cache` 表（搜索缓存，已建表但代码中未使用 —— 缓存仅走 Redis）。

## 前端小程序

- 原生微信小程序框架，页面在 `miniprogram/pages/` 下。
- `utils/request.js` 封装了 `wx.request`，统一设置 base URL 和错误处理，所有 API 调用通过它发出。
- 首页使用微信 `map` 组件渲染地图，通过 `wx.getLocation({type: 'gcj02'})` 获取位置。
- 导航功能调用 `wx.openLocation` 打开微信内置地图。

## 注意事项

- **无测试**：项目当前没有测试套件，`package.json` 无 test script。
- **无 .gitignore**：`node_modules/` 和 `.env`（含真实 LBS Key）未被忽略，操作 git 时需留意。
- **DB 端口**：docker-compose 暴露 MySQL 在 3307，连接时注意不要用默认 3306。
- **API 文档**：完整请求/响应示例见 `docs/API.md`，实现接口时应同步更新该文档。
