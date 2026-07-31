# BarHop API 文档

> 最后更新时间：2026-07-30

## 概述

本文档描述 BarHop 酒鬼地图的后端 API 接口规范。

## 基础信息

- **基础 URL**: `http://localhost:3000`
- **版本**: v1
- **数据格式**: JSON
- **认证**: JWT Token（部分接口需要）

## 响应格式

### 成功响应

```json
{
  "code": 0,
  "data": {}
}
```

### 失败响应

```json
{
  "code": -1,
  "message": "错误描述"
}
```

---

## 接口列表

### 1. 微信登录

| 属性 | 值 |
|------|-----|
| **路径** | `/api/users/login` |
| **方法** | POST |
| **描述** | 微信授权登录，获取JWT Token |

#### 请求参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| code | String | 是 | wx.login() 返回的 code |

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "user_001",
      "openid": "wx_openid_xxx",
      "nickname": "",
      "avatar": "",
      "signature": ""
    }
  }
}
```

---

### 2. 获取附近酒馆

| 属性 | 值 |
|------|-----|
| **路径** | `/api/bars/nearby` |
| **方法** | POST |
| **描述** | 获取指定位置附近的酒馆列表（支持多关键词搜索） |

#### 请求参数

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| lat | Number | 是 | - | 纬度 (GCJ-02) |
| lng | Number | 是 | - | 经度 (GCJ-02) |
| radius | Number | 否 | 10000 | 搜索半径（米） |
| keyword | String | 否 | - | 关键词搜索（用户指定） |
| type | String | 否 | '' | 分类筛选：精酿吧/鸡尾酒吧/清吧/''(全部) |
| forceRefresh | Boolean | 否 | false | 是否强制刷新（跳过缓存） |

#### 搜索策略说明

1. **有用户关键词时**：直接使用关键词搜索
2. **无关键词时**：使用多关键词组合搜索
   - 全部类型：`['酒吧', '精酿', '酒馆', 'pub', '清吧']`
   - 精酿吧：`['精酿', '精酿酒吧', 'brew', 'craft']`
   - 鸡尾酒吧：`['鸡尾酒吧', 'cocktail', '调酒', 'whiskey']`
   - 清吧：`['清吧', 'pub', '酒馆', 'lounge', '酒廊']`

#### 请求示例

```bash
# 搜索全部酒吧
POST /api/bars/nearby
Content-Type: application/json

{
  "lat": 30.5728,
  "lng": 104.0668,
  "radius": 10000,
  "type": ""
}

# 搜索精酿吧
POST /api/bars/nearby
Content-Type: application/json

{
  "lat": 30.5728,
  "lng": 104.0668,
  "radius": 10000,
  "type": "精酿吧"
}

# 强制刷新（跳过缓存）
POST /api/bars/nearby
Content-Type: application/json

{
  "lat": 30.5728,
  "lng": 104.0668,
  "radius": 10000,
  "forceRefresh": true
}
```

#### 成功响应

```json
{
  "code": 0,
  "data": [
    {
      "id": "lbs_123456789",
      "name": "没有信号小酒馆",
      "address": "四川省成都市武侯区...",
      "lat": 30.573483,
      "lng": 104.06931,
      "distance": 252,
      "avg_rating": 4.5,
      "tags": "清吧",
      "phone": "",
      "hours": "",
      "photos": [
        "http://store.is.autonavi.com/showpic/..."
      ],
      "source": "lbs",
      "category": "娱乐休闲:酒吧",
      "comment_count": 0
    }
  ]
}
```

#### 字段说明

| 字段 | 类型 | 描述 |
|------|------|------|
| id | String | 酒吧唯一标识（LBS ID或数据库ID） |
| name | String | 酒吧名称 |
| address | String | 地址 |
| lat | Number | 纬度 |
| lng | Number | 经度 |
| distance | Number | 距离（米） |
| avg_rating | Number | 平均评分（0-5） |
| tags | String | 分类标签（精酿吧/鸡尾酒吧/清吧） |
| phone | String | 联系电话 |
| hours | String | 营业时间 |
| photos | Array | 照片URL列表 |
| source | String | 数据来源 (lbs/mansql) |
| category | String | 腾讯LBS分类 |
| comment_count | Number | 评论数量 |

---

### 3. 获取酒吧详情

| 属性 | 值 |
|------|-----|
| **路径** | `/api/bars/:id` |
| **方法** | GET |
| **描述** | 获取单个酒吧的详细信息 |

#### 请求参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| id | String | 是 | 酒吧ID（路径参数） |

#### 请求示例

```bash
GET /api/bars/1007572709779853500
```

#### 成功响应

```json
{
  "code": 0,
  "data": {
    "id": "1007572709779853500",
    "name": "没有信号小酒馆",
    "address": "四川省成都市武侯区...",
    "lat": 30.573483,
    "lng": 104.06931,
    "phone": "",
    "hours": "",
    "avg_rating": 4.5,
    "tags": "清吧",
    "photos": [...],
    "distance": 252,
    "source": "lbs",
    "created_at": "2026-07-30T09:00:00.000Z",
    "updated_at": "2026-07-30T09:00:00.000Z"
  }
}
```

---

### 4. 收藏相关接口

#### 添加收藏
| 属性 | 值 |
|------|-----|
| **路径** | `/api/favorites` |
| **方法** | POST |
| **描述** | 添加酒吧到收藏 |

请求参数：
```json
{
  "user_id": "user_001",
  "bar_id": "1007572709779853500"
}
```

#### 获取收藏列表
| 属性 | 值 |
|------|-----|
| **路径** | `/api/favorites` |
| **方法** | GET |
| **描述** | 获取用户收藏的酒吧列表 |

#### 取消收藏
| 属性 | 值 |
|------|-----|
| **路径** | `/api/favorites/:id` |
| **方法** | DELETE |
| **描述** | 取消收藏 |

---

### 5. 评价相关接口

#### 提交评价
| 属性 | 值 |
|------|-----|
| **路径** | `/api/reviews` |
| **方法** | POST |
| **描述** | 提交酒吧评价 |

请求参数：
```json
{
  "user_id": "user_001",
  "bar_id": "1007572709779853500",
  "rating": 4.5,
  "content": "环境不错，鸡尾酒很好喝",
  "images": []
}
```

#### 获取酒吧评价
| 属性 | 值 |
|------|-----|
| **路径** | `/api/reviews/bar/:barId` |
| **方法** | GET |
| **描述** | 获取指定酒吧的评价列表 |

---

### 6. 用户相关接口

#### 获取用户信息
| 属性 | 值 |
|------|-----|
| **路径** | `/api/users/openid/:openid` |
| **方法** | GET |
| **描述** | 根据openid获取用户信息 |

#### 更新用户资料
| 属性 | 值 |
|------|-----|
| **路径** | `/api/users/:id` |
| **方法** | PUT |
| **描述** | 更新用户资料（昵称/头像/签名） |

请求参数：
```json
{
  "nickname": "新昵称",
  "avatar": "https://...",
  "signature": "个性签名"
}
```

---

### 7. 健康检查

| 属性 | 值 |
|------|-----|
| **路径** | `/health` |
| **方法** | GET |
| **描述** | 服务健康检查（含数据库状态） |

#### 成功响应

```json
{
  "code": 0,
  "message": "BarHop Server is running",
  "database": "connected",
  "dbTest": 1
}
```

---

## 错误码

| 错误码 | 描述 |
|--------|------|
| 0 | 成功 |
| -1 | 通用错误 |

---

## 数据流说明

### 获取附近酒馆流程

1. **Redis缓存检查**：先查询 Redis 缓存（TTL 30分钟）
2. **缓存命中**：直接返回缓存数据
3. **数据库检查**：查询数据库中是否有已补充完整的数据
4. **数据库命中**：如果有≥5条完整数据，直接使用
5. **LBS搜索**：调用腾讯LBS多关键词搜索
6. **数据过滤**：本地过滤非酒吧类型，保留特色酒吧
7. **数据补充**：调用高德API补充图片和评分
8. **数据持久化**：存入MySQL和Redis缓存

### 过滤逻辑说明

过滤策略采用"严格排除"模式：
- **排除条件**：名称包含猫咖、餐厅、酒店等明显非酒吧关键词
- **保留条件**：通过多关键词搜索获取的结果，只要没有严格排除词就保留
- **类型过滤**：指定类型时，按精酿吧/鸡尾酒吧/清吧关键词进一步筛选

---

## 坐标系说明

- **前端**: 使用 `wx.getLocation` 的 `type: 'gcj02'`
- **后端**: 统一使用 GCJ-02 坐标系
- **腾讯 LBS**: `location` 参数传 GCJ-02 格式