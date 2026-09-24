const db = require('../utils/db');
const config = require('../config');

// 到店打卡围栏半径（米）
const CHECKIN_RADIUS = 150;

/**
 * Haversine 公式计算两点间距离（米）
 * 输入均为 GCJ-02 坐标（小程序 wx.getLocation type:'gcj02'）
 */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000; // 地球半径（米）
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

class CheckinsController {
  /**
   * 创建/更新打卡
   * POST /api/checkins  { user_id, bar_id, lat, lng, content?, images? }
   */
  async createCheckin(req, res) {
    try {
      const { user_id, bar_id, lat, lng } = req.body;
      let { content = '', images = [] } = req.body;

      if (!user_id || !bar_id) {
        return res.json({ code: -1, message: '参数不完整' });
      }
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);
      if (isNaN(userLat) || isNaN(userLng)) {
        return res.json({ code: -1, message: '缺少有效的定位坐标' });
      }

      // 取酒吧坐标
      const bars = await db.query('SELECT id, name, lat, lng FROM bars WHERE id = ?', [bar_id]);
      if (bars.length === 0) {
        return res.json({ code: -1, message: '酒吧不存在，无法打卡' });
      }
      const bar = bars[0];
      if (!bar.lat || !bar.lng) {
        return res.json({ code: -1, message: '该酒吧缺少坐标信息' });
      }

      // 围栏校验
      const distance = Math.round(haversine(userLat, userLng, parseFloat(bar.lat), parseFloat(bar.lng)));
      if (distance > CHECKIN_RADIUS) {
        return res.json({
          code: -1,
          message: `距离酒吧还有 ${distance} 米，到店后再打卡吧`,
          data: { distance, allowed: false }
        });
      }

      // 图片规范化（最多3张）
      if (Array.isArray(images)) {
        images = images.slice(0, 3);
      } else {
        images = [];
      }
      // 随感长度限制
      if (content && content.length > 255) content = content.slice(0, 255);

      // 是否已存在该酒吧的打卡（一人一店一条，重复打卡=更新）
      const existing = await db.query(
        'SELECT id FROM checkins WHERE user_id = ? AND bar_id = ?',
        [user_id, bar_id]
      );
      const isFirst = existing.length === 0;

      if (isFirst) {
        await db.query(
          `INSERT INTO checkins (user_id, bar_id, bar_name, content, images, lat, lng, distance_meter, is_first)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [user_id, bar_id, bar.name || '', content, JSON.stringify(images), userLat, userLng, distance]
        );
        // 冗余打卡数 +1
        await db.query('UPDATE users SET checkin_count = checkin_count + 1 WHERE id = ?', [user_id]);
      } else {
        await db.query(
          `UPDATE checkins
             SET bar_name = ?, content = ?, images = ?, lat = ?, lng = ?, distance_meter = ?, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = ? AND bar_id = ?`,
          [bar.name || '', content, JSON.stringify(images), userLat, userLng, distance, user_id, bar_id]
        );
      }

      const saved = await db.query(
        'SELECT * FROM checkins WHERE user_id = ? AND bar_id = ?',
        [user_id, bar_id]
      );

      res.json({
        code: 0,
        message: isFirst ? '打卡成功' : '已记录，欢迎再来一杯',
        data: { ...saved[0], is_first: isFirst, distance }
      });
    } catch (error) {
      console.error('[Checkins] 打卡失败:', error.message, error.stack);
      res.json({ code: -1, message: '打卡失败' });
    }
  }

  /**
   * 我的打卡列表（时间倒序，分页）
   * GET /api/checkins/user/:userId?page=&pageSize=
   */
  async getUserCheckins(req, res) {
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 20;
      const offset = (page - 1) * pageSize;

      if (!userId) {
        return res.json({ code: -1, message: '缺少userId参数' });
      }

      const rows = await db.query(
        `SELECT c.*, b.photos AS bar_photos, b.tags AS bar_tags, b.address AS bar_address
           FROM checkins c
           LEFT JOIN bars b ON c.bar_id = b.id
          WHERE c.user_id = ?
          ORDER BY c.updated_at DESC
          LIMIT ${pageSize} OFFSET ${offset}`,
        [userId]
      );

      const countResult = await db.query(
        'SELECT COUNT(*) AS total FROM checkins WHERE user_id = ?',
        [userId]
      );

      const list = rows.map((r) => {
        let images = [];
        try {
          images = r.images ? JSON.parse(r.images) : [];
          if (!Array.isArray(images)) images = [];
        } catch (e) {
          images = [];
        }
        images = images.map((img) =>
          img && img.startsWith('/uploads/') ? config.server.baseUrl + img : img
        );

        return {
          id: r.id,
          bar_id: r.bar_id,
          bar_name: r.bar_name || '未知酒吧',
          content: r.content,
          images,
          bar_tags: r.bar_tags || '',
          bar_address: r.bar_address || '',
          distance_meter: r.distance_meter,
          is_first: !!r.is_first,
          first_checkin_at: r.created_at,
          last_checkin_at: r.updated_at
        };
      });

      res.json({
        code: 0,
        data: { list, total: countResult[0].total, page, pageSize }
      });
    } catch (error) {
      console.error('[Checkins] 获取打卡列表失败:', error.message, error.stack);
      res.json({ code: -1, message: '获取打卡列表失败' });
    }
  }

  /**
   * 单店打卡状态（详情页用）
   * GET /api/checkins/status?user_id=&bar_id=
   */
  async getCheckinStatus(req, res) {
    try {
      const { user_id, bar_id } = req.query;
      if (!user_id || !bar_id) {
        return res.json({ code: -1, message: '参数不完整' });
      }

      const rows = await db.query(
        'SELECT * FROM checkins WHERE user_id = ? AND bar_id = ?',
        [user_id, bar_id]
      );

      if (rows.length === 0) {
        return res.json({ code: 0, data: { checked_in: false } });
      }

      const r = rows[0];
      let images = [];
      try {
        images = r.images ? JSON.parse(r.images) : [];
      } catch (e) {
        images = [];
      }
      res.json({
        code: 0,
        data: {
          checked_in: true,
          content: r.content,
          images,
          first_checkin_at: r.created_at,
          last_checkin_at: r.updated_at
        }
      });
    } catch (error) {
      console.error('[Checkins] 获取打卡状态失败:', error.message);
      res.json({ code: -1, message: '获取打卡状态失败' });
    }
  }

  /**
   * 打卡统计（为 v1.2 成就预留）
   * GET /api/checkins/stats/:userId
   */
  async getStats(req, res) {
    try {
      const { userId } = req.params;
      if (!userId) {
        return res.json({ code: -1, message: '缺少userId参数' });
      }

      const totalResult = await db.query(
        'SELECT COUNT(*) AS total FROM checkins WHERE user_id = ?',
        [userId]
      );
      // 去重品类数（按酒吧 tags）
      const catResult = await db.query(
        `SELECT COUNT(DISTINCT b.tags) AS cats
           FROM checkins c LEFT JOIN bars b ON c.bar_id = b.id
          WHERE c.user_id = ? AND b.tags IS NOT NULL AND b.tags <> ''`,
        [userId]
      );

      res.json({
        code: 0,
        data: {
          checkin_count: totalResult[0].total,
          category_count: catResult[0].cats
        }
      });
    } catch (error) {
      console.error('[Checkins] 获取统计失败:', error.message);
      res.json({ code: -1, message: '获取统计失败' });
    }
  }
}

module.exports = new CheckinsController();
