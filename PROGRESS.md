# BarHop 项目进度文档

> 最后更新时间：2026-07-30
> 项目状态：🚧 开发中（核心功能已完成，体验优化进行中）

---

## 一、项目概述

**BarHop** 是一款微信小程序，帮助用户发现附近的酒吧（精酿吧、鸡尾酒吧、清吧），支持搜索、收藏、评价和导航功能。

### 技术栈
| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | 微信小程序原生框架 | WXML/WXSS/JS |
| 后端 | Node.js + Express | RESTful API |
| 数据库 | MySQL 8.0 (Docker) | 端口 3307 |
| 缓存 | Redis | 端口 6379 |
| LBS | 腾讯地图 API | 搜索酒吧、获取位置 |
| 备用LBS | 高德地图 API | 补充图片和评分 |
| 认证 | JWT + 微信 OpenID | 用户登录 |

---

## 二、项目结构

```
BarHop/
├── miniprogram/                  # 微信小程序前端
│   ├── images/                   # 图标资源
│   │   ├── home.png             # 首页图标
│   │   ├── home_active.png      # 首页选中图标
│   │   ├── favorite.png         # 收藏图标
│   │   ├── favorite_active.png  # 收藏选中图标
│   │   └── pin.png              # 地图定位图标
│   ├── pages/
│   │   ├── index/               # 首页（发现附近酒吧）
│   │   ├── detail/              # 酒吧详情页
│   │   ├── favorites/           # 收藏列表页
│   │   ├── review/              # 评价页
│   │   └── profile/             # 个人资料编辑页
│   ├── utils/
│   │   ├── request.js           # 网络请求封装（统一配置）
│   │   ├── config.js            # 全局配置 ⭐新增
│   │   ├── image.js             # 图片兜底工具
│   │   ├── searchHistory.js     # 搜索历史管理 ⭐新增
│   │   └── format.wxs           # 格式化工具
│   ├── app.js                   # 应用入口（含登录流程）
│   ├── app.json                 # 应用配置
│   └── app.wxss                 # 全局样式（含组件库）
├── server/                       # Node.js 后端
│   ├── config/index.js          # 配置文件
│   ├── controllers/             # 控制器（业务逻辑）
│   │   ├── bars.js              # 酒吧 CRUD + 搜索
│   │   ├── favorites.js         # 收藏管理
│   │   ├── reviews.js           # 评价管理
│   │   └── users.js             # 用户登录/注册/更新
│   ├── routes/                  # 路由定义
│   │   ├── bars.js
│   │   ├── favorites.js
│   │   ├── reviews.js
│   │   ├── users.js
│   │   ├── proxy.js             # LBS代理
│   │   └── upload.js            # 文件上传
│   ├── middlewares/             # 中间件
│   │   ├── logger.js            # 请求日志
│   │   ├── cors.js              # 跨域处理
│   │   ├── auth.js              # JWT 认证
│   │   ├── responseLogger.js    # 响应日志
│   │   └── errorHandler.js      # 错误处理中间件 ⭐新增
│   ├── services/                # 服务层（外部API调用）
│   │   ├── lbs.js               # 腾讯LBS服务
│   │   ├── amap.js              # 高德地图服务
│   │   ├── cache.js             # 缓存服务
│   │   └── mock.js              # Mock数据
│   ├── utils/                   # 工具层
│   │   ├── db.js                # 数据库连接池（CRUD封装）
│   │   └── response.js          # 统一响应工具 ⭐新增
│   ├── logs/                    # 日志目录
│   ├── .env                     # 环境变量
│   └── server.js                # 服务器入口
├── database/schema.sql          # 数据库表结构
└── docker-compose.yml           # Docker配置
```

---

## 二点五、后端架构说明

### 架构分层
```
┌─────────────────────────────────────────────────┐
│                   Routes (路由层)                  │
│  bars.js │ favorites.js │ reviews.js │ users.js  │
├─────────────────────────────────────────────────┤
│                Controllers (控制器层)              │
│  处理HTTP请求/响应，业务逻辑入口                    │
├─────────────────────────────────────────────────┤
│                Services (服务层)                  │
│  lbs.js(腾讯LBS) │ amap.js(高德) │ cache.js      │
├─────────────────────────────────────────────────┤
│                 Utils (工具层)                    │
│  db.js(数据库连接池) │ logger.js(日志)            │
├─────────────────────────────────────────────────┤
│              Middlewares (中间件层)                │
│  logger → responseLogger → cors → auth            │
└─────────────────────────────────────────────────┘
```

### 请求流程
```
客户端请求 → logger(请求日志) → responseLogger(响应日志) 
    → cors → body解析 → 路由匹配 → 控制器 
    → 服务层 → 数据库
```

### 中间件执行顺序
1. **logger** — 记录请求时间、路径、状态码、耗时
2. **responseLogger** — 记录请求体/响应体，写入日志文件
3. **cors** — 处理跨域
4. **express.json/urlencoded** — 解析请求体
5. **路由** — 匹配到具体控制器
6. **auth** — 可选，验证 JWT Token

### API 路由表
| 方法 | 路径 | 控制器 | 说明 |
|------|------|--------|------|
| POST | `/api/users/login` | users.login | 微信授权登录 |
| GET | `/api/users/openid/:openid` | users.getUser | 获取用户信息 |
| PUT | `/api/users/:id` | users.updateUser | 更新用户资料 |
| POST | `/api/bars/nearby` | bars.search | 搜索附近酒吧 |
| GET | `/api/bars/:id` | bars.getById | 获取酒吧详情 |
| GET | `/api/favorites` | favorites.list | 获取收藏列表 |
| POST | `/api/favorites` | favorites.add | 添加收藏 |
| DELETE | `/api/favorites/:id` | favorites.remove | 取消收藏 |
| GET | `/api/reviews/bar/:barId` | reviews.list | 获取酒吧评价 |
| POST | `/api/reviews` | reviews.create | 提交评价 |
| GET | `/health` | - | 健康检查 |

### 日志说明
- 控制台日志：所有请求实时显示
- 文件日志：`server/logs/api-YYYY-MM-DD.log`（自动轮转，10MB限制）
- 调试日志：`debugLogger(label, data)` 
- 错误日志：`errorLogger(label, error)`

### Node.js 断点调试方法
1. **方式一：内置调试器**
   ```bash
   # 启动调试模式
   node --inspect server.js
   # 打开 Chrome 访问 chrome://inspect
   ```

2. **方式二：VS Code 调试**
   - 点击左侧「运行和调试」→「创建 launch.json」
   - 选择 Node.js 环境
   - 在代码中点击行号左侧设置断点
   - 按 F5 启动调试

3. **方式三：使用 debug 包**
   ```bash
   npm install debug
   # 设置环境变量后启动
   DEBUG=barhop:* npm start
   ```

---

## 二点六、前端架构说明

### 架构分层
```
┌─────────────────────────────────────────────────┐
│                   Pages (页面层)                  │
│  index(首页) │ detail(详情) │ favorites(收藏)     │
│  review(评价) │ profile(个人资料)                 │
├─────────────────────────────────────────────────┤
│                   Utils (工具层)                  │
│  request.js(网络请求) │ image.js(图片兜底)        │
│  searchHistory.js(搜索历史) │ config.js(配置)     │
│  format.wxs(格式化)                              │
├─────────────────────────────────────────────────┤
│                   App (应用入口)                  │
│  登录管理 │ 全局状态 │ 生命周期                    │
└─────────────────────────────────────────────────┘
```

### 页面导航
```
首页(index)
 ├── [用户栏点击] → 个人资料(profile)
 ├── [酒吧卡片点击] → 详情页(detail)
 │   ├── [收藏/取消收藏] (弹窗确认)
 │   ├── [写评价] → 评价页(review)
 │   └── [导航] → 微信内置地图
 └── [TabBar] → 收藏页(favorites)
```

### 数据流
```
app.js 启动
  ├── 读取本地缓存(token + userInfo)
  ├── wx.login() → code → POST /api/users/login
  ├── 登录成功 → 存储 token + userInfo
  └── notifyLoginListeners() → 各页面更新UI

各页面
  ├── onLoad/onShow → 检查登录状态
  ├── app.onLoginComplete() → 注册登录回调
  ├── request.js → 自动携带 Authorization header
  └── app.updateUserInfo() → 更新全局用户信息
```

### 关键代码位置
| 功能 | 文件路径 | 方法/组件 |
|------|---------|----------|
| 登录流程 | `app.js` | `login()`, `sendCodeToBackend()` |
| 登录回调 | `app.js` | `onLoginComplete()`, `notifyLoginListeners()` |
| 网络请求 | `utils/request.js` | `request()`, 自动携带Token |
| 图片兜底 | `utils/image.js` | `ensureBarPhotos()`, `getSafePhoto()` |
| 搜索历史 | `utils/searchHistory.js` | `getHistory()`, `addHistory()`, `clearHistory()` |
| 年龄确认 | `pages/index/index.wxml` | `.age-modal` |
| 快捷授权 | `pages/index/index.wxml` | `open-type="chooseAvatar"`, `type="nickname"` |
| 下拉刷新 | `pages/index/index.json` | `enablePullDownRefresh: true` |
| 个人资料 | `pages/profile/profile.*` | 头像选择 + 昵称 + 签名 |
| 收藏操作 | `pages/favorites/favorites.js` | `toggleFavorite()` 含确认弹窗 |

### 前端生命周期
```
App.onLaunch → App.login() → [异步] 登录完成
  ↓
Page.onLoad → 初始化UI + 注册登录回调
  ↓
Page.onShow → 刷新用户信息 + 检查登录状态
  ↓
用户交互 → API请求 → 数据更新 → UI更新
```

---

## 三、数据库信息

### 连接信息
```
主机: localhost
端口: 3307
数据库: barhop
用户名: barhop_user
密码: barhop_pass
```

### 数据表
| 表名 | 说明 | 状态 |
|------|------|------|
| `bars` | 酒吧信息表 | ✅ 已创建，含10条初始数据 |
| `users` | 用户表 | ✅ 已创建 |
| `favorites` | 收藏表 | ✅ 已创建 |
| `reviews` | 评价表 | ✅ 已创建 |
| `bar_search_cache` | 搜索缓存表 | ✅ 已创建 |

### 初始酒吧数据（10条）
- real_001 ~ real_010，覆盖成都主要区域
- 分类：清吧、精酿吧、鸡尾酒吧
- 评分：4.3 ~ 4.9
- 图片：使用AI生成的占位图

---

## 四、已实现功能

### ✅ 前端页面
| 页面 | 路径 | 功能 |
|------|------|------|
| 首页 | `pages/index/index` | 定位、搜索、搜索历史、分类筛选、地图展示、酒吧列表、下拉刷新 |
| 详情页 | `pages/detail/detail` | 酒吧信息、图片预览、评分显示、导航、收藏、评价 |
| 收藏页 | `pages/favorites/favorites` | 收藏列表、取消收藏、跳转详情、下拉刷新 |
| 评价页 | `pages/review/review` | 评分、文字评价、图片上传 |
| 个人资料 | `pages/profile/profile` | 修改头像、昵称、个性签名 |

### ✅ 后端API
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/users/login` | 微信授权登录（code换openid） |
| GET | `/api/users/openid/:openid` | 根据openid获取用户信息 |
| PUT | `/api/users/:id` | 更新用户资料（昵称/头像/签名） |
| POST | `/api/bars/nearby` | 搜索附近酒吧 |
| GET | `/api/bars/:id` | 获取酒吧详情 |
| GET | `/api/favorites` | 获取用户收藏列表 |
| POST | `/api/favorites` | 添加收藏 |
| DELETE | `/api/favorites` | 取消收藏 |
| GET | `/api/reviews/bar/:barId` | 获取酒吧评价 |
| POST | `/api/reviews` | 提交评价 |
| GET | `/health` | 健康检查（含数据库状态） |

### ✅ 核心功能
1. ✅ 微信授权登录（wx.login → code → openid → JWT token）
2. ✅ 多定位策略（高精度定位/采样/手动选择/默认位置）
3. ✅ 关键词搜索酒吧（支持多关键词组合搜索）
4. ✅ 分类筛选（全部/精酿吧/鸡尾酒吧/清吧）
5. ✅ 地图标记显示酒吧位置（点击显示名称，再点击进入详情）
6. ✅ 酒吧详情展示
7. ✅ 收藏/取消收藏（带确认弹窗）
8. ✅ 评价系统（评分+文字+图片）
9. ✅ 数据源策略（LBS实时搜索 → 数据库缓存，已移除Mock数据）
10. ✅ 图片加载兜底（自动补充占位图 + 懒加载）
11. ✅ 评分显示（腾讯LBS评分 + 高德补充评分）
12. ✅ JWT Token 认证（请求头自动携带）
13. ✅ 下拉刷新（首页 + 收藏页）
14. ✅ 个人资料编辑（头像/昵称/签名）
15. ✅ API 响应日志（控制台 + 文件）
16. ✅ 搜索历史记录（本地缓存 + 下拉显示 + 删除/清空）
17. ✅ 多关键词LBS搜索策略（['酒吧', '精酿', '酒馆', 'pub', '清吧']）
18. ✅ 智能过滤逻辑（严格排除非酒吧类型，保留特色酒吧）
19. ✅ 特色酒吧支持（如"玄水屋"、"撞墙"等无明显酒吧关键词的酒吧）

---

## 四点一、搜索历史技术方案

### 功能概述
搜索历史功能允许用户在首页搜索酒吧时，自动保存搜索关键词到本地缓存，方便用户快速重复搜索。

### 技术实现

#### 核心文件
- `miniprogram/utils/searchHistory.js` — 搜索历史管理工具
- `miniprogram/pages/index/index.js` — 首页搜索逻辑
- `miniprogram/pages/index/index.wxml` — 搜索历史 UI
- `miniprogram/pages/index/index.wxss` — 搜索历史样式

#### 数据结构
```javascript
// 存储在 wx.StorageSync 中
{
  keyword: '精酿吧',      // 搜索关键词
  timestamp: 1756435200000 // 搜索时间戳
}
```

#### 功能特性
1. **自动保存**：用户每次搜索时自动保存关键词
2. **去重存储**：相同关键词自动去重，最新的排在最前
3. **最大数量**：最多保存 10 条历史记录
4. **历史显示**：点击搜索框时显示历史记录下拉面板
5. **快速搜索**：点击历史项直接搜索
6. **单条删除**：支持删除单条历史记录
7. **一键清空**：支持清空所有历史记录
8. **时间格式化**：显示"刚刚"、"X分钟前"、"X天前"等友好时间
9. **过期清理**：支持清理 7 天前的历史记录

#### API 接口（本地）
| 方法 | 说明 |
|------|------|
| `getHistory()` | 获取所有历史记录 |
| `addHistory(keyword)` | 添加搜索历史 |
| `removeHistory(keyword)` | 删除单条历史 |
| `clearHistory()` | 清空所有历史 |
| `getSuggestions(keyword)` | 获取搜索建议 |
| `formatDate(timestamp)` | 格式化时间显示 |

#### UI 交互
```
搜索栏
├── 搜索输入框
│   ├── 聚焦时显示历史面板
│   └── 失焦时隐藏历史面板
└── 历史面板（下拉）
    ├── 标题栏："搜索历史" + "清空"按钮
    └── 历史列表：
        ├── 关键词 + 时间
        └── 删除按钮（✕）
```

#### 样式特点
- 深色主题，与首页风格统一
- 毛玻璃效果背景
- 圆角卡片设计
- 平滑过渡动画
- 点击反馈效果

---

## 五、已修复Bug

| # | Bug | 原因 | 修复方案 |
|---|-----|------|---------|
| 1 | 搜索返回非酒吧结果 | LBS分类过滤参数限制过严 | 移除category过滤，改用关键词+本地智能过滤 |
| 2 | 分类筛选不生效 | 数据库查询用LIKE模糊匹配 | 改为精确匹配tags字段 |
| 3 | TabBar图标显示为黑块 | 图标文件格式问题 | 重新生成PNG图标 |
| 4 | 收藏加载失败 | ①favorites.js用pool未导出 ②MySQL表不存在 ③参数绑定问题 | 改用db模块、创建表、字符串拼接LIMIT/OFFSET |
| 5 | 地图标记不显示 | pin.png图标缺失 | 重新创建艺术风格图标 |
| 6 | 部分酒吧搜不到 | LBS分类过滤参数导致 | 移除过滤限制 |
| 7 | 微信登录报错 | users.js用pool.execute()但已改用db对象 | 统一改为db.query() ⭐新增 |
| 8 | Docker未启动导致AggregateError | MySQL容器未运行 | 添加启动时健康检查和友好提示 ⭐新增 |
| 9 | 昵称输入框无法编辑 | 样式overflow:hidden和text-align:right问题 | 修复样式，添加背景和内边距 |
| 10 | 保存按钮无反应 | 缺少错误处理和日志 | 添加日志和错误提示 |
| 11 | 重置按钮无效 | 使用userInfo而非originalData | 添加originalData保存初始值 |
| 12 | 搜索返回非酒吧结果（猫咖、餐厅等） | 过滤逻辑不够严格 | 增强过滤逻辑，添加严格排除词列表 |
| 13 | 特色酒吧搜索不到（玄水屋、撞墙等） | 搜索关键词单一，过滤条件过严 | 采用多关键词组合搜索，放宽过滤条件 |
| 14 | Mock数据混入真实数据 | 代码中仍有mockService调用 | 移除所有mockService调用，返回真实LBS数据 |
| 15 | 地图标记点击无反应 | marker事件处理问题 | 实现点击显示callout，再点击进入详情页 |
| 16 | 地图操作触发页面滚动 | 事件冒泡问题 | 重新设计布局，地图固定，列表独立滚动 |

---

## 六、配置信息

### 环境变量 (.env)
```env
PORT=3000
DB_HOST=localhost
DB_PORT=3307
DB_NAME=barhop
DB_USER=barhop_user
DB_PASSWORD=barhop_pass
TENCENT_LBS_KEY=O3BBZ-4UDEW-XW5RE-YWCJV-W5QUH-Y5FQQ
WECHAT_APPID=your_wechat_appid
WECHAT_SECRET=your_wechat_secret
JWT_SECRET=barhop_jwt_secret_key_2026
NODE_ENV=development
```

### 腾讯LBS Key
- 当前Key: `O3BBZ-4UDEW-XW5RE-YWCJV-W5QUH-Y5FQQ`
- 申请地址: https://lbs.qq.com/

### 微信小程序配置
- AppID和Secret需在 `.env` 中配置
- 申请地址: https://mp.weixin.qq.com/
- 开发模式下未配置时自动使用 mock 用户

### 高德地图Key
- 当前状态：✅ 已配置（`server/services/amap.js`）
- 用途：补充酒吧图片和评分
- 申请地址: https://console.amap.com/dev/key/app

---

## 七、待办任务清单

### 🔴 第一阶段：核心体验优化（当前优先级 - P0）

**目标**：完善核心体验，让应用可用且好用

| # | 任务 | 详细说明 | 涉及文件 | 状态 | 优先级 |
|---|------|---------|---------|------|--------|
| 1 | ~~微信授权登录~~ | wx.login → code → openid → JWT | `app.js`, `users.js` | ✅ | P0 |
| 2 | ~~高德地图Key~~ | 已配置Key | `amap.js` | ✅ | P0 |
| 3 | ~~图片加载兜底~~ | image.js + binderror事件处理 | `utils/image.js`, `*.wxml` | ✅ | P0 |
| 4 | ~~收藏删除优化~~ | 确认弹窗 + 样式 | `favorites.*` | ✅ | P0 |
| 5 | ~~下拉刷新~~ | 首页 + 收藏页 | `index.json`, `favorites.json` | ✅ | P0 |
| 6 | ~~个人资料页~~ | 头像 + 昵称 + 签名 | `profile.*` | ✅ | P0 |
| 7 | ~~API响应日志~~ | 控制台 + 文件 | `responseLogger.js` | ✅ | P0 |
| 8 | ~~搜索历史记录~~ | 本地缓存搜索关键词，支持清除 | `searchHistory.js`, `index.*` | ✅ | P0 |
| 9 | ~~Mock数据清除~~ | 移除mockService调用，使用真实LBS数据 | `bars.js`, `index.js` | ✅ | P0 |
| 10 | ~~搜索筛选优化~~ | 多关键词组合搜索，放宽过滤条件 | `lbs.js` | ✅ | P0 |
| 11 | ~~数据库重置~~ | 清空脏数据，重新拉取真实数据 | `bars.js`, `reset_data.js` | ✅ | P0 |
| 12 | ~~真实用户评分聚合~~ | 详情页显示：高德评分 + 用户评分，并标注来源 | `detail.js`, `detail.wxml`, `reviews.js` | ✅ | P0 |
| 13 | ~~骨架屏加载~~ | 列表项加载时显示骨架占位动画 | `index.wxml/wxss`, `detail.wxml/wxss`, `favorites.wxml/wxss` | ✅ | P0 |
| 14 | ~~全局错误处理~~ | 统一错误捕获 + 友好提示 + 重试 | `app.js`, `request.js`, `errorHandler.js`, `network-banner` 组件 | ✅ | P0 |

### 🟡 第二阶段：性能与稳定性（中优先级 - P1）

**目标**：提升应用性能和稳定性，保证流畅体验

| # | 任务 | 详细说明 | 涉及文件 | 状态 | 优先级 |
|---|------|---------|---------|------|--------|
| 15 | **图片懒加载优化** | 滚动加载 + 预加载下一张 | `index.js`, `detail.js` | ⏳ | P1 |
| 16 | **LBS调用优化** | 缓存策略优化，减少API调用 | `cache.js`, `lbs.js` | ⏳ | P1 |
| 17 | **网络状态检测** | 无网/弱网提示 + 自动重连 | `app.js`, `request.js` | ⏳ | P1 |
| 18 | **列表虚拟滚动** | 大量酒吧数据时优化滚动性能 | `index.js` | ⏳ | P1 |
| 19 | **数据库备份** | 定时备份脚本 | `scripts/backup.js` | ⏳ | P1 |

### 🟢 第三阶段：功能扩展（低优先级 - P2）

**目标**：增加特色功能，提升用户粘性

| # | 任务 | 详细说明 | 状态 | 优先级 |
|---|------|---------|------|--------|
| 20 | 酒吧数据管理后台 | 管理员添加/编辑酒吧，审核评价 | ⏳ | P2 |
| 21 | 收藏分组功能 | 按类型（精酿/鸡尾/清吧）分组收藏 | ⏳ | P2 |
| 22 | 附近推送通知 | 新店开张、限时优惠推送 | ⏳ | P2 |
| 23 | 社交分享功能 | 分享酒吧卡片到微信好友/朋友圈 | ⏳ | P2 |
| 24 | 多语言支持 | 英文/日文版本 | ⏳ | P2 |
| 25 | 夜间模式 | 自动切换主题 | ⏳ | P2 |

### 🔵 第四阶段：上线准备（发布前 - P3）

**目标**：完成上线前的准备工作

| # | 任务 | 详细说明 | 状态 | 优先级 |
|---|------|---------|------|--------|
| 26 | HTTPS配置 | 域名备案 + SSL证书 + 合法域名配置 | ⏳ | P3 |
| 27 | 小程序审核 | 提交微信公众平台审核 | ⏳ | P3 |
| 28 | 性能监控 | 接入微信小程序性能监控 | ⏳ | P3 |
| 29 | 错误监控 | 接入 Sentry 或微信小程序错误监控 | ⏳ | P3 |
| 30 | 压力测试 | 模拟高并发场景 | ⏳ | P3 |
| 31 | 用户协议/隐私政策 | 页面展示 + 弹窗确认 | ⏳ | P3 |

---

## 八、真实用户评分聚合技术方案

### 8.1 当前数据源确认

**是的，目前 API 首选高德（Amap）**，数据流如下：

```
腾讯LBS（搜索酒吧基本信息）
    ↓
多关键词组合搜索 + 本地过滤
    ↓
高德API（补充图片和评分）← 首选数据源
    ↓
数据库缓存（持久化存储）
    ↓
Redis缓存（加速读取）
```

**高德 API 提供的信息**：
- 图片（photos）：来自高德地图的真实店面照片
- 评分（avg_rating）：高德地图的用户评分（0-5分）

### 8.2 评分聚合方案

#### 方案说明

详情页需要展示两个维度的评分：

1. **第三方评分**（当前为高德评分）
   - 来源：高德地图 API
   - 特点：外部数据，无用户评论
   - 展示位置：酒吧卡片副标题区域

2. **用户评分**（用户在本应用内的评价）
   - 来源：本应用内的用户评价数据
   - 特点：真实用户反馈，有评论内容
   - 展示位置：评分区域 + 评论列表

#### 数据结构设计

```json
// 酒吧详情 API 响应
{
  "id": "1007572709779853500",
  "name": "没有信号小酒馆",
  "avg_rating": 4.5,  // 第三方评分（高德）
  "rating_source": "amap",  // 评分来源
  "user_rating": {
    "average": 4.7,  // 用户平均评分
    "count": 128,  // 用户评价数量
    "distribution": {  // 评分分布
      "5": 64,
      "4": 40,
      "3": 16,
      "2": 6,
      "1": 2
    }
  },
  "my_review": {
    "rating": 5,
    "content": "环境不错，鸡尾酒很好喝",
    "created_at": "2026-07-30 20:00:00"
  }
}
```

#### 数据库表结构

```sql
-- 评价表（已存在，需扩展）
ALTER TABLE reviews 
ADD COLUMN rating INT NOT NULL COMMENT '评分 1-5',
ADD COLUMN content TEXT COMMENT '评价内容',
ADD COLUMN images JSON COMMENT '评价图片',
ADD COLUMN user_id VARCHAR(50) NOT NULL COMMENT '用户ID',
ADD COLUMN bar_id VARCHAR(50) NOT NULL COMMENT '酒吧ID',
ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
ADD INDEX idx_bar_rating (bar_id, rating);

-- 用户评分聚合视图
CREATE VIEW bar_rating_summary AS
SELECT 
  bar_id,
  COUNT(*) as review_count,
  AVG(rating) as avg_rating,
  SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as rating_5,
  SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as rating_4,
  SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as rating_3,
  SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as rating_2,
  SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as rating_1
FROM reviews
GROUP BY bar_id;
```

#### API 接口设计

1. **提交评价**
```
POST /api/reviews
Body: { "bar_id": "xxx", "rating": 5, "content": "...", "images": [] }
Response: { "code": 0, "data": { "id": "xxx" } }
```

2. **获取酒吧评价列表**
```
GET /api/reviews/bar/:barId
Query: { page: 1, page_size: 20 }
Response: { 
  "code": 0, 
  "data": { 
    "summary": { "count": 128, "avg": 4.7, "distribution": {...} },
    "list": [...] 
  } 
}
```

3. **获取酒吧详情（含评分聚合）**
```
GET /api/bars/:id
Response: { 
  "code": 0, 
  "data": { 
    ...bar字段...,
    "user_rating": { "average": 4.7, "count": 128 },
    "my_review": null  // 或用户自己的评价
  } 
}
```

#### 前端展示方案

详情页布局示意：
```
┌─────────────────────────────┐
│  [酒吧封面图]                │
├─────────────────────────────┤
│  没有信号小酒馆              │
│  📍 四川省成都市武侯区...    │
├─────────────────────────────┤
│  ⭐ 4.5  ·  高德评分         │  ← 第三方评分
│  ★★★★★☆  4.7  ·  128条评价  │  ← 用户评分
│  [5星] 64%  [4星] 31%  ...   │  ← 评分分布
├─────────────────────────────┤
│  📝 用户评价                 │
│  ┌─────────────────────────┐│
│  │ 用户头像  昵称  5星      ││
│  │ "环境不错..."            ││
│  └─────────────────────────┘│
├─────────────────────────────┤
│  [写评价]  [收藏]  [导航]    │
└─────────────────────────────┘
```

#### 实现步骤

| 步骤 | 任务 | 说明 | 涉及文件 |
|------|------|------|---------|
| 1 | 扩展数据库表 | 添加reviews表和评分字段 | `database/schema.sql` |
| 2 | 实现评价CRUD | 添加评价、获取评价列表 | `controllers/reviews.js` |
| 3 | 实现评分聚合查询 | 计算平均分、分布 | `controllers/reviews.js` |
| 4 | 详情页接口聚合评分 | getBarById时聚合用户评分 | `controllers/bars.js` |
| 5 | 前端详情页展示 | 评分展示、评分分布、评价列表 | `pages/detail/detail.*` |
| 6 | 评价提交页面 | 选择星级、写评论、传图片 | `pages/review/review.*` |

#### 评分算法

```javascript
// 用户评分 = 加权平均
function calculateUserRating(reviews) {
  if (!reviews || reviews.length === 0) {
    return { average: 0, count: 0, distribution: {} };
  }
  
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let totalRating = 0;
  
  reviews.forEach(review => {
    distribution[review.rating] = (distribution[review.rating] || 0) + 1;
    totalRating += review.rating;
  });
  
  return {
    average: Math.round(totalRating / reviews.length * 10) / 10,
    count: reviews.length,
    distribution
  };
}
```

#### 注意事项

1. **评分来源标注**：清楚区分"高德评分"和"用户评分"
2. **数据一致性**：用户评分实时计算，确保与评价列表一致
3. **性能优化**：使用聚合视图或缓存，避免每次查询都计算
4. **图片审核**：用户上传的评价图片需考虑审核机制
5. **防刷机制**：限制同一用户对同一酒吧的评价次数

---

## 十、快速启动指南

### 1. 启动数据库 (Docker)
```bash
cd BarHop
docker-compose up -d
```

### 2. 导入数据库
```bash
mysql -h localhost -P 3307 -u barhop_user -pbarhop_pass barhop < database/schema.sql
```

### 3. 启动后端
```bash
cd server
npm install
npm start
# 访问 http://localhost:3000/health
```

### 4. 启动前端
使用微信开发者工具打开 `miniprogram` 目录

### 5. 测试API
```bash
# 搜索附近酒吧
POST http://localhost:3000/api/bars/nearby
Body: {"lat":30.5728,"lng":104.0668,"radius":5000}

# 获取收藏
GET http://localhost:3000/api/favorites?user_id=test_user

# 添加收藏
POST http://localhost:3000/api/favorites
Body: {"user_id":"test_user","bar_id":"real_007"}
```

---

## 十一、关键代码位置

### 服务层
- [lbs.js](server/services/lbs.js) - 腾讯LBS搜索服务，多关键词搜索、分类过滤和酒吧分类逻辑
- [amap.js](server/services/amap.js) - 高德地图服务，补充图片和评分
- [cache.js](server/services/cache.js) - 缓存服务

### 控制器
- [bars.js](server/controllers/bars.js) - 酒吧CRUD、搜索、数据源管理（LBS→数据库缓存）
- [favorites.js](server/controllers/favorites.js) - 收藏管理
- [reviews.js](server/controllers/reviews.js) - 评价管理
- [users.js](server/controllers/users.js) - 用户管理

### 前端页面
- [index.js](miniprogram/pages/index/index.js) - 首页逻辑（定位、搜索、地图、marker交互）
- [detail.js](miniprogram/pages/detail/detail.js) - 详情页逻辑
- [favorites.js](miniprogram/pages/favorites/favorites.js) - 收藏页逻辑
- [review.js](miniprogram/pages/review/review.js) - 评价页逻辑

### 工具
- [request.js](miniprogram/utils/request.js) - 网络请求封装
- [db.js](server/utils/db.js) - 数据库操作封装

---

## 十二、注意事项

1. **数据库端口**: 使用3307端口（Docker MySQL），而非默认3306
2. **数据同步**: 本地MySQL（3306）和Docker MySQL（3307）是独立实例，需注意数据同步
3. **LBS限流**: 腾讯LBS免费版每日调用有限制，注意缓存
4. **图片服务**: 当前使用高德API获取真实图片，无照片时使用本地默认图兜底
5. **微信授权**: ✅ 已完成微信登录接入（wx.login + JWT token），配置真实AppID即可使用
6. **HTTPS**: 正式发布需配置HTTPS域名

---

## 十三、下一步计划建议

### 第一阶段（本周）
1. ✅ 接入微信授权登录
2. ✅ 配置高德地图Key
3. ✅ 完善图片兜底机制
4. ✅ 优化收藏删除交互

### 第二阶段（下周）
5. ✅ 完善评价系统
6. ✅ 实现真实评分聚合
7. ✅ 添加下拉刷新

### 第三阶段（后续）
8. ✅ 酒吧数据管理后台
9. ✅ 社交功能
10. ✅ 推送通知

---

*文档生成时间：2026-07-28*
*项目维护者：BarHop Team*
