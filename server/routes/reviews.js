const express = require('express');
const router = express.Router();
const reviewsController = require('../controllers/reviews');

// 提交/更新评价
router.post('/', reviewsController.createReview.bind(reviewsController));

// 获取酒吧评价列表（含评分汇总）
router.get('/bar/:bar_id', reviewsController.getBarReviews.bind(reviewsController));

// 获取用户对某酒吧的评价
router.get('/bar/:bar_id/user', reviewsController.getUserReview.bind(reviewsController));

// 删除评价
router.delete('/:id', reviewsController.deleteReview.bind(reviewsController));

module.exports = router;
