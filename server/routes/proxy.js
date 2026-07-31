const express = require('express');
const router = express.Router();
const axios = require('axios');
const config = require('../config');

router.post('/', async (req, res) => {
  try {
    const { uri, params } = req.body;

    if (!uri) {
      return res.json({ code: -1, message: '缺少uri参数' });
    }

    const response = await axios.get(`https://apis.map.qq.com${uri}`, {
      params: {
        key: config.tencent.lbsKey,
        ...params
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('[Proxy] LBS代理失败:', error.message);
    res.json({ code: -1, message: '代理请求失败' });
  }
});

module.exports = router;