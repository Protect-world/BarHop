const { barService, haversineDistance } = require('../services/bar');
const response = require('../utils/response');
const { asyncHandler, NotFoundError, BadRequestError } = require('../utils/errors');
const { validators, validate } = require('../utils/validator');
const urlService = require('../utils/url');

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

    const result = {
      ...bar,
      rating: {
        avg_rating: ratingSummary.avg_rating,
        count: ratingSummary.count,
        distribution: ratingSummary.distribution
      },
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
}

module.exports = new BarsController();
