const db = require('../utils/db');
const response = require('../utils/response');
const { asyncHandler, NotFoundError, BadRequestError, ForbiddenError } = require('../utils/errors');
const { validators, validate } = require('../utils/validator');
const urlService = require('../utils/url');
const { barService } = require('../services/bar');

// 时间格式化工具函数
function formatDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

// 处理图片URL
function processReviewImages(images) {
  if (!images || !Array.isArray(images)) return [];
  return images.map(img => urlService.toFullUrl(img));
}

// 解析评价图片
function parseImages(images) {
  if (!images) return [];
  try {
    return typeof images === 'string' ? JSON.parse(images) : images;
  } catch (e) {
    return [];
  }
}

class ReviewsController {
  // 创建或更新评价
  createReview = asyncHandler(async (req, res) => {
    const { valid, errors, value } = validate(validators.createReview, req.body);
    if (!valid) {
      throw new BadRequestError('评价参数错误', errors);
    }

    const { user_id, bar_id, rating, content, images } = value;

    const existingReview = await db.query(
      'SELECT id FROM reviews WHERE user_id = ? AND bar_id = ?',
      [user_id, bar_id]
    );

    const user = await db.query('SELECT id, nickname, avatar FROM users WHERE id = ?', [user_id]);
    const userData = user[0] || { nickname: '匿名用户', avatar: '' };

    let reviewId;
    let isNew = true;

    if (existingReview.length > 0) {
      reviewId = existingReview[0].id;
      await db.query(
        'UPDATE reviews SET rating = ?, content = ?, images = ? WHERE id = ?',
        [rating, content || '', JSON.stringify(images || []), reviewId]
      );
      isNew = false;
    } else {
      await db.query(
        'INSERT INTO reviews (user_id, bar_id, rating, content, images) VALUES (?, ?, ?, ?, ?)',
        [user_id, bar_id, rating, content || '', JSON.stringify(images || [])]
      );
      const result = await db.query('SELECT LAST_INSERT_ID() as id');
      reviewId = result[0].id;
    }

    await barService.updateBarUserRating(bar_id);

    return response.success(res, {
      id: reviewId,
      user_id,
      bar_id,
      rating: parseFloat(rating),
      content,
      images: images || [],
      is_new: isNew,
      user: {
        nickname: userData.nickname || '匿名用户',
        avatar: userData.avatar || ''
      }
    });
  });

  // 获取酒吧评价列表
  getBarReviews = asyncHandler(async (req, res) => {
    const { bar_id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    const ratingSummary = await barService.getRatingSummary(bar_id);

    const reviews = await db.query(
      `SELECT r.id, r.user_id, r.rating, r.content, r.images, r.created_at, u.nickname, u.avatar 
       FROM reviews r 
       LEFT JOIN users u ON r.user_id = u.id 
       WHERE r.bar_id = ? 
       ORDER BY r.created_at DESC 
       LIMIT ? OFFSET ?`,
      [bar_id, pageSize, offset]
    );

    const formattedReviews = reviews.map(r => {
      const images = parseImages(r.images);
      return {
        id: r.id,
        user_id: r.user_id,
        rating: parseFloat(r.rating),
        content: r.content,
        images: processReviewImages(images),
        created_at: formatDateTime(r.created_at),
        user: {
          nickname: r.nickname || '匿名用户',
          avatar: r.avatar || ''
        }
      };
    });

    return response.success(res, {
      reviews: formattedReviews,
      summary: ratingSummary,
      page,
      pageSize
    });
  });

  // 获取酒吧评价数据（供其他控制器调用）
  async getBarReviewsData(barId) {
    const reviews = await db.query(
      `SELECT r.id, r.user_id, r.rating, r.content, r.images, r.created_at, u.nickname, u.avatar 
       FROM reviews r 
       LEFT JOIN users u ON r.user_id = u.id 
       WHERE r.bar_id = ? 
       ORDER BY r.created_at DESC 
       LIMIT 20`,
      [barId]
    );

    const formattedReviews = reviews.map(r => {
      const images = parseImages(r.images);
      return {
        id: r.id,
        user_id: r.user_id,
        rating: parseFloat(r.rating),
        content: r.content,
        images: processReviewImages(images),
        created_at: formatDateTime(r.created_at),
        user: {
          nickname: r.nickname || '匿名用户',
          avatar: r.avatar || ''
        }
      };
    });

    return {
      reviews: formattedReviews,
      total: formattedReviews.length
    };
  }

  // 获取用户对某个酒吧的评价
  getUserReview = asyncHandler(async (req, res) => {
    const { bar_id } = req.params;
    const { user_id } = req.query;

    if (!user_id) {
      throw new BadRequestError('缺少用户ID');
    }

    const review = await db.query(
      `SELECT r.id, r.rating, r.content, r.images, r.created_at, u.nickname, u.avatar 
       FROM reviews r 
       LEFT JOIN users u ON r.user_id = u.id 
       WHERE r.bar_id = ? AND r.user_id = ?`,
      [bar_id, user_id]
    );

    if (review.length === 0) {
      return response.success(res, null);
    }

    const r = review[0];
    const images = parseImages(r.images);

    return response.success(res, {
      id: r.id,
      rating: parseFloat(r.rating),
      content: r.content,
      images: processReviewImages(images),
      created_at: formatDateTime(r.created_at),
      user: {
        nickname: r.nickname || '匿名用户',
        avatar: r.avatar || ''
      }
    });
  });

  // 删除评价
  deleteReview = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { user_id, role } = req.query;

    const review = await db.query('SELECT bar_id, user_id FROM reviews WHERE id = ?', [id]);
    if (review.length === 0) {
      throw new NotFoundError('评价不存在');
    }

    const reviewUserId = review[0].user_id;
    if (user_id && user_id !== reviewUserId && role !== 'admin') {
      throw new ForbiddenError('无权限删除此评价');
    }

    const barId = review[0].bar_id;

    await db.query('DELETE FROM reviews WHERE id = ?', [id]);
    await barService.updateBarUserRating(barId);

    return response.success(res, null, '删除成功');
  });
}

module.exports = new ReviewsController();
