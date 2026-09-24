const express = require('express');
const router = express.Router();
const checkinsController = require('../controllers/checkins');

// 注意：静态路径 status/stats 需在通配 :userId 之前注册
router.post('/', checkinsController.createCheckin.bind(checkinsController));
router.get('/status', checkinsController.getCheckinStatus.bind(checkinsController));
router.get('/user/:userId', checkinsController.getUserCheckins.bind(checkinsController));
router.get('/stats/:userId', checkinsController.getStats.bind(checkinsController));

module.exports = router;
