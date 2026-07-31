const express = require('express');
const config = require('./config');
const logger = require('./middlewares/logger');
const cors = require('./middlewares/cors');
const { responseLogger } = require('./middlewares/responseLogger');
const { errorHandler } = require('./utils/errors');
const barsRouter = require('./routes/bars');
const proxyRouter = require('./routes/proxy');
const uploadRouter = require('./routes/upload');
const usersRouter = require('./routes/users');
const favoritesRouter = require('./routes/favorites');
const reviewsRouter = require('./routes/reviews');
const preloaderService = require('./services/preloader');
const path = require('path');
const response = require('./utils/response');

const app = express();

app.use(logger);
app.use(responseLogger);
app.use(cors);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/uploads', express.static(path.join(__dirname, config.upload.path)));

// API路由
app.use('/api/bars', barsRouter);
app.use('/api/lbs/proxy', proxyRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/users', usersRouter);
app.use('/api/favorites', favoritesRouter);
app.use('/api/reviews', reviewsRouter);

// 健康检查
app.get('/health', async (req, res) => {
  try {
    const db = require('./utils/db');
    const result = await db.query('SELECT 1 as test');
    return response.success(res, {
      database: 'connected',
      dbTest: result[0]?.test
    }, 'BarHop Server is running');
  } catch (error) {
    return response.success(res, {
      database: 'disconnected',
      error: error.message
    }, 'BarHop Server is running');
  }
});

// API文档
app.get('/api', (req, res) => {
  res.json({
    name: 'BarHop API',
    version: '2.0.0',
    endpoints: {
      bars: '/api/bars',
      users: '/api/users',
      favorites: '/api/favorites',
      reviews: '/api/reviews',
      upload: '/api/upload',
      lbs: '/api/lbs/proxy',
      health: '/health'
    }
  });
});

// 404处理
app.use((req, res) => {
  response.notFound(res, `未找到路由: ${req.method} ${req.originalUrl}`);
});

// 全局错误处理（必须放在所有路由之后）
app.use(errorHandler);

async function startServer() {
  try {
    const db = require('./utils/db');
    await db.query('SELECT 1');
    console.log('[Server] 数据库连接检查: ✅ 正常');
    
    // 清理数据库中的非酒吧数据
    try {
      const excludeKeywords = [
        '猫咖', '猫咪', '猫', '宠物', '狗狗', '狗', '动物', '宠物店', '撸狗', '撸猫', '吸猫', '羊驼',
        '咖啡', '咖啡馆', '咖啡厅', '茶馆', '茶室', '奶茶',
        '餐厅', '饭店', '酒楼', '食府', '小吃', '快餐', '西餐', '日料', '韩餐', '中餐', '火锅', '烧烤', '烤肉',
        '酒店', '宾馆', '旅店', '客栈', '度假村', '旅馆',
        '美容', '美发', '理发', '美甲', '美容院',
        '维修', '手机维修', '数码', '通讯', '手机店', '电脑维修', '维修店',
        '超市', '商场', '商店', '便利店', '百货', '购物',
        '洗衣', '干洗', '家政',
        '医院', '诊所', '医药', '药房', '药店', '卫生室', '医疗',
        '学校', '培训', '教育', '幼儿园',
        '银行', 'ATM', '储蓄',
        '健身', '运动', '体育馆', '健身房', '瑜伽',
        '娱乐', 'KTV', '电影院', '影院', '剧院', '游乐场', '电玩', '游戏厅', '派对',
        '律所', '律师', '会计', '咨询',
        '装修', '装饰', '家居', '建材', '家具',
        '房产', '中介', '物业',
        '网吧', '网咖', '电竞',
        '手机', '数码', '家电', '电器',
        '眼镜', '眼镜店',
        '鲜花', '花店', '花艺',
        '书店', '图书',
        '琴行', '乐器',
        '画廊', '画展',
        '婚纱', '摄影', '婚庆',
        '汽车', '汽修', '洗车'
      ];
      let deletedCount = 0;
      for (const kw of excludeKeywords) {
        const result = await db.query('DELETE FROM bars WHERE name LIKE ?', [`%${kw}%`]);
        if (result && result.affectedRows) {
          deletedCount += result.affectedRows;
        }
      }
      if (deletedCount > 0) {
        console.log(`[Server] 清理非酒吧数据: 已删除 ${deletedCount} 条记录`);
        // 清除所有缓存
        const cacheService = require('./services/cache');
        await cacheService.clear();
        console.log('[Server] 已清除所有缓存');
      } else {
        console.log('[Server] 数据库数据检查: ✅ 无脏数据');
      }
    } catch (cleanErr) {
      console.error('[Server] 数据清理失败:', cleanErr.message);
    }
  } catch (error) {
    console.error('[Server] 数据库连接检查: ❌ 失败');
    console.error('[Server] 请确保 Docker MySQL 已启动: docker-compose up -d');
    console.error('[Server] 错误信息:', error.message);
  }
  
  console.log(`[Server] 微信 AppID: ${config.wechat.appId || '未配置 (Mock模式)'}`);
  console.log(`[Server] 允许上传文件类型: ${config.upload.allowedTypes.join(', ')}`);
  
  app.listen(config.port, () => {
    console.log(`[Server] BarHop Server running on http://localhost:${config.port}`);
    console.log(`[Server] Environment: ${config.env}`);
    
    // 启动预加载服务
    if (config.env === 'production') {
      preloaderService.start();
    } else {
      console.log('[Server] 开发环境，跳过预加载（可手动触发）');
    }
  });
}

// 优雅关闭
process.on('SIGTERM', () => {
  preloaderService.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  preloaderService.stop();
  process.exit(0);
});

startServer();