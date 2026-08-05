const { barService, haversineDistance } = require('../services/bar');
const response = require('../utils/response');
const { asyncHandler, NotFoundError, BadRequestError } = require('../utils/errors');
const { validators, validate } = require('../utils/validator');
const urlService = require('../utils/url');
const db = require('../utils/db');

class BarsController {
  // 获取附近酒吧
  getNearbyBars = asyncHandler(async (req, res) => {
    const startTime = Date.now();

    // 参数验证
    const { valid, errors, value } = validate(validators.searchBars, req.body);
    if (!valid) {
      throw new BadRequestError('请求参数错误', errors);
    }

    console.log('[API] 搜索酒吧:', {
      lat: value.lat,
      lng: value.lng,
      radius: value.radius,
      keyword: value.keyword,
      type: value.type
    });

    const { bars, fromCache } = await barService.searchBars(value);

    console.log(`[API] 搜索完成: ${bars.length} 条数据, 耗时: ${Date.now() - startTime}ms, 缓存: ${fromCache}`);

    return response.success(res, bars, '获取成功');
  });

  // 获取酒吧详情
  getBarById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userId = req.query.user_id;

    if (!id) {
      throw new BadRequestError('缺少酒吧ID');
    }

    const bar = await barService.getBarById(id);
    if (!bar) {
      throw new NotFoundError('酒吧不存在');
    }

    // 获取评分汇总
    const ratingSummary = await barService.getRatingSummary(id);

    // 获取评价
    const reviewsController = require('./reviews');
    const reviewResult = await reviewsController.getBarReviewsData(id);

    // 获取当前用户的评价（如果传了 user_id）
    let myReview = null;
    if (userId) {
      const myReviews = await db.query(
        'SELECT id, rating, content, images, created_at FROM reviews WHERE user_id = ? AND bar_id = ?',
        [userId, id]
      );
      if (myReviews.length > 0) {
        const r = myReviews[0];
        let images = [];
        try {
          images = typeof r.images === 'string' ? JSON.parse(r.images) : (r.images || []);
        } catch (e) { images = []; }
        myReview = {
          id: r.id,
          rating: parseFloat(r.rating),
          content: r.content || '',
          images: images,
          created_at: r.created_at
        };
      }
    }

    // 判断评分来源
    const hasUserRating = ratingSummary.count > 0;
    const ratingSource = hasUserRating ? 'user' : 'amap';

    const result = {
      ...bar,
      // 用户评分聚合数据（对象格式，供前端使用）
      user_rating: {
        average: ratingSummary.avg_rating,
        count: ratingSummary.count,
        distribution: ratingSummary.distribution
      },
      // 兼容字段
      rating: {
        avg_rating: ratingSummary.avg_rating,
        count: ratingSummary.count,
        distribution: ratingSummary.distribution
      },
      my_review: myReview,
      rating_source: ratingSource,
      reviews: reviewResult.reviews || [],
      total_reviews: reviewResult.total || 0
    };

    return response.success(res, result);
  });

  // 搜索酒吧（带关键词）
  searchBars = asyncHandler(async (req, res) => {
    const { lat, lng, keyword, radius = 10000 } = req.query;

    if (!lat || !lng) {
      throw new BadRequestError('缺少经纬度参数');
    }

    const { bars } = await barService.searchBars({
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      radius: parseInt(radius),
      keyword: keyword || '',
      type: '',
      forceRefresh: false
    });

    return response.success(res, bars);
  });

  // 获取热门酒吧
  getPopularBars = asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;
    const db = require('../utils/db');

    const bars = await db.query(
      `SELECT * FROM bars 
       WHERE avg_rating > 0 OR user_review_count > 0 
       ORDER BY (COALESCE(user_rating, 0) * user_review_count + COALESCE(avg_rating, 0) * comment_count) DESC 
       LIMIT ?`,
      [parseInt(limit)]
    );

    const processed = urlService.processBarList(bars);
    return response.success(res, processed);
  });

  // 获取推荐酒吧
  getRecommendedBars = asyncHandler(async (req, res) => {
    const { lat, lng, limit = 10 } = req.query;
    const db = require('../utils/db');

    if (!lat || !lng) {
      throw new BadRequestError('缺少经纬度参数');
    }

    const bars = await db.query(
      `SELECT * FROM bars 
       WHERE (6371 * acos(LEAST(1, GREATEST(-1, 
         cos(radians(?)) * cos(radians(lat)) * cos(radians(lng) - radians(?)) + 
         sin(radians(?)) * sin(radians(lat))
       )))) * 1000 <= 20000
       ORDER BY avg_rating DESC, created_at DESC
       LIMIT ?`,
      [parseFloat(lat), parseFloat(lng), parseFloat(lat), parseInt(limit)]
    );

    const result = bars.map(bar => ({
      ...bar,
      photos: urlService.parsePhotos(bar.photos),
      distance: haversineDistance(parseFloat(lat), parseFloat(lng), parseFloat(bar.lat), parseFloat(bar.lng))
    }));

    return response.success(res, result);
  });

  // 获取所有酒吧（分页）
  getAllBars = asyncHandler(async (req, res) => {
    const db = require('../utils/db');
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const offset = (page - 1) * pageSize;

    const bars = await db.query(
      'SELECT * FROM bars ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [pageSize, offset]
    );

    const totalResult = await db.query('SELECT COUNT(*) as total FROM bars');
    const total = totalResult[0].total;

    const processed = urlService.processBarList(bars);
    return response.success(res, { list: processed, total, page, pageSize });
  });

  // 创建酒吧
  createBar = asyncHandler(async (req, res) => {
    const db = require('../utils/db');
    const { name, address, lat, lng, phone, hours, tags, photos, category } = req.body;

    if (!name || !address || !lat || !lng) {
      throw new BadRequestError('缺少必填字段（名称、地址、经纬度）');
    }

    const id = require('uuid').v4();
    await db.query(
      `INSERT INTO bars (id, name, address, lat, lng, phone, hours, tags, photos, category, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')`,
      [
        id,
        name,
        address,
        parseFloat(lat),
        parseFloat(lng),
        phone || null,
        hours || null,
        tags || null,
        JSON.stringify(photos || []),
        category || null
      ]
    );

    const bar = await barService.getBarById(id);
    return response.success(res, bar, '创建成功');
  });

  // 更新酒吧
  updateBar = asyncHandler(async (req, res) => {
    const db = require('../utils/db');
    const { id } = req.params;
    const { name, address, lat, lng, phone, hours, tags, photos, category } = req.body;

    if (!id) {
      throw new BadRequestError('缺少酒吧ID');
    }

    const existing = await db.query('SELECT id FROM bars WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw new NotFoundError('酒吧不存在');
    }

    await db.query(
      `UPDATE bars SET 
        name = COALESCE(?, name),
        address = COALESCE(?, address),
        lat = COALESCE(?, lat),
        lng = COALESCE(?, lng),
        phone = COALESCE(?, phone),
        hours = COALESCE(?, hours),
        tags = COALESCE(?, tags),
        photos = COALESCE(?, photos),
        category = COALESCE(?, category),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        name || null,
        address || null,
        lat ? parseFloat(lat) : null,
        lng ? parseFloat(lng) : null,
        phone || null,
        hours || null,
        tags || null,
        photos ? JSON.stringify(photos) : null,
        category || null,
        id
      ]
    );

    const bar = await barService.getBarById(id);
    return response.success(res, bar, '更新成功');
  });

  // 删除酒吧
  deleteBar = asyncHandler(async (req, res) => {
    const db = require('../utils/db');
    const { id } = req.params;

    if (!id) {
      throw new BadRequestError('缺少酒吧ID');
    }

    const existing = await db.query('SELECT id FROM bars WHERE id = ?', [id]);
    if (existing.length === 0) {
      throw new NotFoundError('酒吧不存在');
    }

    // 删除关联的评价和收藏
    await db.query('DELETE FROM reviews WHERE bar_id = ?', [id]);
    await db.query('DELETE FROM favorites WHERE bar_id = ?', [id]);
    await db.query('DELETE FROM bars WHERE id = ?', [id]);

    return response.success(res, null, '删除成功');
  });
}

module.exports = new BarsController();
