# BarHop Miniprogram - 前端开发文档

## 概述

BarHop 前端基于微信小程序原生开发框架，提供酒吧发现、详情查看、评价、收藏等功能，采用深色主题设计。

## 技术栈

- **微信小程序原生**: WXML / WXSS / JavaScript
- **基础库版本**: 3.17.0+
- **UI风格**: 深色主题 + 毛玻璃效果

## 目录结构

```
miniprogram/
├── pages/
│   ├── index/              # 首页（酒馆列表）
│   │   ├── index.js
│   │   ├── index.wxml
│   │   ├── index.wxss
│   │   └── index.json
│   ├── detail/             # 详情页
│   │   ├── detail.js
│   │   ├── detail.wxml
│   │   └── detail.wxss
│   ├── favorites/          # 收藏页
│   │   ├── favorites.js
│   │   ├── favorites.wxml
│   │   └── favorites.wxss
│   ├── review/             # 评价页
│   │   ├── review.js
│   │   ├── review.wxml
│   │   └── review.wxss
│   └── profile/            # 个人中心
│       ├── profile.js
│       ├── profile.wxml
│       └── profile.wxss
├── utils/
│   ├── request.js          # API请求封装
│   ├── config.js           # 配置常量
│   ├── image.js            # 图片处理
│   ├── searchHistory.js    # 搜索历史
│   └── format.wxs          # WXS格式化
├── images/                 # 静态资源
│   ├── home.png
│   ├── home_active.png
│   ├── favorite.png
│   └── favorite_active.png
├── app.js                  # 小程序入口
├── app.json                # 小程序配置
├── app.wxss                # 全局样式
├── sitemap.json            # 搜索配置
└── project.config.json     # 项目配置
```

## 快速开始

### 1. 环境要求

- 微信开发者工具（最新版本）
- 后端服务已启动（默认端口3000）

### 2. 导入项目

1. 打开微信开发者工具
2. 点击"导入项目"
3. 选择 `miniprogram` 目录
4. 填写 AppID（测试可使用测试号）
5. 点击"导入"

### 3. 配置服务器域名

在开发者工具中：
1. 点击"详情" → "本地设置"
2. 勾选"不校验合法域名"（开发环境）
3. 或在微信公众平台配置正式域名

### 4. 编译运行

点击"编译"按钮即可运行项目。

---

## 页面说明

### 1. 首页（index）

**路径**: `pages/index/index`

**功能**:
- 年龄验证弹窗
- 自动定位 / 手动选择位置
- 地图展示 + 标记点
- 附近酒吧列表
- 搜索功能 + 搜索历史
- 分类筛选（精酿吧/鸡尾酒吧/清吧）
- 排序（距离/评分）
- 分页加载（默认10条，下滑加载更多，最多20条）

**关键状态**:
```javascript
data: {
  showAgeModal: true,      // 年龄验证弹窗
  userLocation: null,       // 用户位置
  allBars: [],              // 所有酒吧数据
  displayBars: [],          // 当前展示的酒吧
  displayedCount: 0,        // 已加载数量
  isLoadingMore: false,     // 加载更多状态
  markers: [],              // 地图标记
  searchKeyword: '',        // 搜索关键词
  selectedCategory: '',     // 选中分类
  sortType: 'distance',     // 排序方式
  loading: false            // 加载状态
}
```

**分页逻辑**:
```javascript
// 默认展示10条
const displayCount = Math.min(10, sortedBars.length);

// 下滑加载更多（每次10条，最多20条）
loadMoreBars() {
  const newCount = Math.min(displayedCount + 10, Math.min(allBars.length, 20));
}

// 加载完成提示
wx:if="{{displayBars.length > 0 && displayedCount >= allBars.length && displayedCount >= 20}}"
```

**生命周期**:
```javascript
onLoad()    // 初始化用户信息、年龄验证
onShow()    // 页面显示时刷新数据
onHide()    // 页面隐藏时暂停状态
```

---

### 2. 详情页（detail）

**路径**: `pages/detail/detail`

**功能**:
- 酒吧头部大图
- 基本信息（地址、营业时间、电话）
- 店内照片轮播
- 用户评价列表
- 底部操作栏（收藏、评价、导航）

**关键状态**:
```javascript
data: {
  barId: '',
  bar: {},
  headerBg: '',           // 头部背景图
  barName: '',
  barRating: 0,
  barTags: '',
  barAddress: '',
  barHours: '',
  barPhone: '',
  barPhotos: [],
  reviews: [],
  totalReviews: 0,
  isFavorite: false,
  loading: false
}
```

**布局结构**:
```
detail-container
├── detail-header（头部背景+返回按钮）
├── detail-content
│   ├── info-section（地址/时间/电话）
│   └── photos-section（照片网格）
├── reviews-section（评价列表）
└── detail-footer（底部操作栏，fixed定位）
```

**底部穿透问题修复**:
```css
/* detail.wxss */
.detail-container {
  padding-bottom: 200rpx;  /* 留出底部空间 */
}

.detail-footer {
  position: fixed;
  bottom: 0;
  z-index: 100;
  background: rgba(22, 33, 62, 0.98);  /* 接近不透明 */
  backdrop-filter: blur(30px);
}
```

---

### 3. 评价页（review）

**路径**: `pages/review/review`

**功能**:
- 酒吧信息展示
- 星级评分（1-5星）
- 文字评价（最多500字）
- 图片上传（最多9张）
- 提交评价

**关键状态**:
```javascript
data: {
  barId: '',
  bar: {},
  barImage: '',           // 酒吧图片（计算属性）
  selectedRating: 0,
  content: '',
  images: [],
  uploading: false,
  user_id: ''
}
```

**WXML表达式问题修复**:
```html
<!-- 错误写法（复杂三元表达式） -->
<image src="{{bar.photos && bar.photos[0] ? bar.photos[0] : defaultImage}}"/>

<!-- 正确写法（使用计算属性） -->
<image src="{{barImage}}"/>
```

```javascript
// review.js 中计算
loadBarInfo() {
  const bar = res.data;
  const barImage = (bar.photos && bar.photos.length > 0) 
    ? bar.photos[0] 
    : DEFAULT_BAR_IMAGE;
  this.setData({ bar, barImage });
}
```

---

### 4. 收藏页（favorites）

**路径**: `pages/favorites/favorites`

**功能**:
- 收藏酒吧列表
- 取消收藏
- 跳转详情

---

### 5. 个人中心（profile）

**路径**: `pages/profile/profile`

**功能**:
- 修改头像
- 修改昵称
- 修改个性签名
- 保存/重置

---

## 工具模块

### request.js

API请求封装，支持：
- 自动添加 Authorization 头
- 请求/响应拦截
- 错误统一处理

```javascript
// 使用示例
const api = require('../../utils/request');

// GET请求
api.getBarById(id).then(res => { ... });

// POST请求
api.postNearbyBars({ lat, lng }).then(res => { ... });

// 评价请求
api.createReview({ user_id, bar_id, rating }).then(res => { ... });
```

### config.js

配置常量：
```javascript
const config = {
  API_BASE_URL: 'http://localhost:3000',
  CACHE_KEYS: {
    TOKEN: 'barhop_token',
    USER_INFO: 'barhop_user_info'
  },
  DEFAULT_IMAGES: {
    BAR: 'https://trae-api-cn.mchost.guru/...'
  }
};
```

### image.js

图片处理工具：
```javascript
// 确保酒吧列表有图片
ensureBarListPhotos(bars);

// 单张图片处理
ensureBarPhotos(bar);
```

### searchHistory.js

搜索历史管理：
```javascript
searchHistory.getHistory();     // 获取历史
searchHistory.addHistory(kw);   // 添加历史
searchHistory.removeHistory(kw); // 删除单条
searchHistory.clearHistory();   // 清空全部
searchHistory.formatDate(ts);   // 格式化时间
```

---

## 样式规范

### 主题色

```css
/* app.wxss */
page {
  --primary-dark: #16213E;       /* 主背景 */
  --secondary-dark: #1A1A2E;    /* 次背景 */
  --accent-pink: #E94560;       /* 主题色（粉红） */
  --accent-gold: #FFD700;       /* 评分金色 */
  --text-white: #FFFFFF;
  --text-light: rgba(255, 255, 255, 0.7);
  --text-dim: rgba(255, 255, 255, 0.4);
}
```

### 通用样式

```css
/* 卡片样式 */
.bar-card {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03));
  border-radius: 24rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.08);
}

/* 按钮样式 */
.btn-primary {
  background: linear-gradient(135deg, #E94560, #FF6B6B);
  box-shadow: 0 4rpx 16rpx rgba(233, 69, 96, 0.4);
}

/* 分类标签 */
.filter-item.active {
  background: linear-gradient(135deg, #E94560, #FF6B6B);
  transform: scale(1.05);
}
```

### 响应式单位

使用 `rpx` 作为基本单位：
- 750rpx = 屏幕宽度
- 常用尺寸：24rpx, 32rpx, 48rpx, 64rpx

---

## WXML 注意事项

### 1. 避免复杂表达式

```html
<!-- ❌ 错误：复杂三元表达式 -->
src="{{bar.photos && bar.photos[0] ? bar.photos[0] : defaultImg}}"

<!-- ✅ 正确：使用数据绑定 -->
src="{{barImage}}"
```

### 2. 嵌套循环变量

```html
<!-- ❌ 错误：内层循环覆盖 item -->
<view wx:for="{{reviews}}" wx:key="id">
  <image wx:for="{{item.images}}" wx:key="*this"/>
</view>

<!-- ✅ 正确：使用 wx:for-item -->
<view wx:for="{{reviews}}" wx:key="id" wx:for-item="review">
  <image wx:for="{{review.images}}" wx:key="*this" wx:for-item="img"/>
</view>
```

### 3. 避免Vue式修饰符

```html
<!-- ❌ 错误：不支持 .stop -->
<div bindtap.stop="handleClick"/>

<!-- ✅ 正确：使用 catchtap -->
<div catchtap="handleClick"/>
```

### 4. 条件渲染

```html
<!-- 使用 wx:if / wx:else -->
<view wx:if="{{loading}}">加载中...</view>
<view wx:elif="{{bars.length === 0}}">暂无数据</view>
<view wx:else>数据列表</view>
```

---

## 组件通信

### 页面间数据传递

```javascript
// 传参跳转
wx.navigateTo({
  url: `/pages/detail/detail?id=${barId}`
});

// 接收参数
onLoad(options) {
  const barId = options.id;
}
```

### 全局状态

```javascript
// app.js
App({
  globalData: {
    userInfo: null,
    hasConfirmedAge: false
  },
  
  getUserInfo() { return this.globalData.userInfo; },
  setUserInfo(info) { this.globalData.userInfo = info; },
  setAgeConfirmed() { this.globalData.hasConfirmedAge = true; }
});

// 页面使用
const app = getApp();
const userInfo = app.getUserInfo();
```

---

## 性能优化

### 已实现

| 优化项 | 说明 |
|--------|------|
| 分页加载 | 默认10条，减少首屏数据量 |
| 图片懒加载 | 使用 scroll-view 滚动加载 |
| 缓存策略 | 利用后端Redis缓存 |
| 骨架屏 | 加载中显示loading状态 |

### 待优化

- [ ] 图片预加载
- [ ] 下拉刷新
- [ ] 虚拟列表（大量数据）
- [ ] 分包加载

---

## 调试技巧

### 查看请求

在开发者工具：
1. 打开"调试器" → "Network"
2. 过滤 `XHR` 请求
3. 查看请求/响应详情

### 查看数据

```javascript
// 在Console中查看页面数据
Page({
  onLoad() {
    console.log('页面数据:', this.data);
  }
});
```

### 真机调试

1. 点击"预览"按钮生成二维码
2. 微信扫码在手机上调试
3. 或使用"真机调试"功能

---

## 常见问题

### Q: 页面显示空白怎么办？

1. 检查后端服务是否启动
2. 打开调试器查看Console错误
3. 检查是否有WXML语法错误

### Q: 地图不显示？

1. 检查 `app.json` 中是否配置了 `scope.userLocation`
2. 检查是否已授权位置权限
3. 清理微信缓存后重试

### Q: 图片加载失败？

1. 检查图片URL是否正确
2. 检查域名是否在白名单中
3. 查看Console中的错误日志

### Q: 如何添加新页面？

1. 在 `pages/` 下创建新页面目录
2. 在 `app.json` 的 `pages` 数组中注册
3. 如需要TabBar，同时更新 `tabBar` 配置

---

## 版本历史

### v1.2.0 (2026-07-29)

- 新增分页加载（默认10条，下滑加载更多，最多20条）
- 修复WXML编译错误（复杂表达式、嵌套循环变量）
- 修复详情页底部穿透问题
- 优化默认图片展示

### v1.1.0 (2026-07-28)

- 新增评价功能
- 新增收藏功能
- 新增搜索历史
- 完善个人中心

### v1.0.0 (2026-07-27)

- 初始版本
- 基础地图和列表功能
- 详情页和导航功能

---

## License

MIT
