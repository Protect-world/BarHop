const db = require('../utils/db');
const config = require('../config');

class FavoritesController {
  async addFavorite(req, res) {
    try {
      const { user_id, bar_id } = req.body;
      
      if (!user_id || !bar_id) {
        return res.json({ code: -1, message: '参数不完整' });
      }
      
      const existing = await db.query(
        'SELECT id FROM favorites WHERE user_id = ? AND bar_id = ?',
        [user_id, bar_id]
      );
      
      if (existing.length > 0) {
        return res.json({ code: 0, message: '已收藏', data: existing[0] });
      }
      
      const result = await db.insert('favorites', { user_id, bar_id });
      
      res.json({ code: 0, data: { id: result.insertId, user_id, bar_id } });
    } catch (error) {
      console.error('[Favorites] 添加收藏失败:', error);
      res.json({ code: -1, message: '添加收藏失败' });
    }
  }

  async removeFavorite(req, res) {
    try {
      const { user_id, bar_id } = req.query;
      
      if (!user_id || !bar_id) {
        return res.json({ code: -1, message: '参数不完整' });
      }
      
      await db.query(
        'DELETE FROM favorites WHERE user_id = ? AND bar_id = ?',
        [user_id, bar_id]
      );
      
      res.json({ code: 0, message: '取消收藏成功' });
    } catch (error) {
      console.error('[Favorites] 取消收藏失败:', error);
      res.json({ code: -1, message: '取消收藏失败' });
    }
  }

  async getFavorites(req, res) {
    try {
      const { user_id, bar_id } = req.query;
      const page = parseInt(req.query.page) || 1;
      const pageSize = parseInt(req.query.pageSize) || 20;
      const offset = (page - 1) * pageSize;
      
      if (!user_id) {
        return res.json({ code: -1, message: '缺少user_id参数' });
      }
      
      if (bar_id) {
        const existing = await db.query(
          'SELECT id FROM favorites WHERE user_id = ? AND bar_id = ?',
          [user_id, bar_id]
        );
        
        return res.json({ 
          code: 0, 
          data: { 
            list: existing,
            total: existing.length,
            is_favorite: existing.length > 0 
          } 
        });
      }
      
      const favorites = await db.query(
        `SELECT f.id, f.bar_id, b.name, b.photos, b.tags, b.lat, b.lng, b.avg_rating, b.user_rating, b.user_review_count, b.address, b.hours, b.phone, f.created_at 
         FROM favorites f LEFT JOIN bars b ON f.bar_id = b.id 
         WHERE f.user_id = ? 
         ORDER BY f.created_at DESC 
         LIMIT ${pageSize} OFFSET ${offset}`,
        [user_id]
      );
      
      const countResult = await db.query(
        'SELECT COUNT(*) as total FROM favorites WHERE user_id = ?',
        [user_id]
      );
      
      const total = countResult[0].total;
      
      const bars = favorites.map(f => {
        let photos = [];
        if (f.photos) {
          try {
            photos = JSON.parse(f.photos);
            // 如果解析后是空数组或无效值，使用空数组
            if (!Array.isArray(photos) || photos.length === 0) {
              photos = [];
            }
          } catch (e) {
            photos = [];
          }
        }
        
        // 处理图片URL
        photos = photos.map(img => {
          if (img && img.startsWith('/uploads/')) {
            return config.server.baseUrl + img;
          }
          return img;
        });
        
        // 评分逻辑：优先显示用户评分，如果没有则显示高德评分
        const userRating = f.user_rating ? parseFloat(f.user_rating) : 0;
        const userReviewCount = f.user_review_count ? parseInt(f.user_review_count) : 0;
        const amapRating = f.avg_rating ? parseFloat(f.avg_rating) : 0;
        
        // 显示用评分：用户有评价用用户评分，否则用高德评分
        let displayRating;
        let ratingSource;
        if (userReviewCount > 0 && userRating > 0) {
          displayRating = userRating.toFixed(1);
          ratingSource = 'user';
        } else if (amapRating > 0) {
          displayRating = amapRating.toFixed(1);
          ratingSource = 'amap';
        } else {
          displayRating = null; // 暂无评分
          ratingSource = 'none';
        }
        
        return {
          id: f.bar_id,
          name: f.name || '未知酒吧',
          photos,
          tags: f.tags || '清吧',
          lat: f.lat ? parseFloat(f.lat) : null,
          lng: f.lng ? parseFloat(f.lng) : null,
          avg_rating: displayRating,
          rating_source: ratingSource,
          user_rating: userRating.toFixed(1),
          user_review_count: userReviewCount,
          address: f.address || '暂无地址',
          hours: f.hours || '暂无信息',
          phone: f.phone || '暂无电话',
          favorite_id: f.id,
          favorite_at: f.created_at
        };
      });
      
      return res.json({ 
        code: 0, 
        data: { 
          list: bars, 
          total, 
          page,
          pageSize
        } 
      });
    } catch (error) {
      console.error('[Favorites] 获取收藏失败:', error.message, error.stack);
      res.json({ code: -1, message: '获取收藏失败' });
    }
  }
}

module.exports = new FavoritesController();
