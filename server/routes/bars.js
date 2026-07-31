const express = require('express');
const router = express.Router();
const barsController = require('../controllers/bars');
const preloaderService = require('../services/preloader');
const cacheService = require('../services/cache');

// 清理缓存接口 - 必须放在 /:id 之前
router.post('/clear-cache', async (req, res) => {
  try {
    const success = await cacheService.clear();
    if (success) {
      res.json({ code: 0, message: '缓存清理成功' });
    } else {
      res.json({ code: -1, message: '缓存清理失败' });
    }
  } catch (error) {
    res.json({ code: -1, message: error.message });
  }
});

// 清理非酒吧数据接口 - 必须放在 /:id 之前
router.post('/clean-data', async (req, res) => {
  try {
    const db = require('../utils/db');
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
    // 清除所有缓存
    await cacheService.clear();
    res.json({ code: 0, message: `清理完成，已删除 ${deletedCount} 条记录并清除缓存`, deletedCount });
  } catch (error) {
    res.json({ code: -1, message: error.message });
  }
});

// 预加载接口 - 必须放在 /:id 之前
router.post('/preload', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    
    if (lat && lng) {
      // 预加载指定位置
      const bars = await preloaderService.preloadCustomLocation(lat, lng);
      res.json({ code: 0, data: bars, message: '预加载完成' });
    } else {
      // 预加载所有预设位置
      preloaderService.preloadAllLocations();
      res.json({ code: 0, message: '已触发全量预加载' });
    }
  } catch (error) {
    res.json({ code: -1, message: error.message });
  }
});

// 以下路由按正常顺序
router.post('/nearby', barsController.getNearbyBars.bind(barsController));
router.get('/', barsController.getAllBars.bind(barsController));
router.get('/:id', barsController.getBarById.bind(barsController));
router.post('/', barsController.createBar.bind(barsController));
router.put('/:id', barsController.updateBar.bind(barsController));
router.delete('/:id', barsController.deleteBar.bind(barsController));

module.exports = router;