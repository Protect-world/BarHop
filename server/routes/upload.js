const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const config = require('../config');
const fs = require('fs');

const uploadPath = path.join(__dirname, '..', config.upload.path);
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`;
    cb(null, filename);
  }
});

const fileFilter = function (req, file, cb) {
  if (config.upload.allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: config.upload.maxSize }
});

router.post('/image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.json({ code: -1, message: '请选择图片' });
    }
    
    const filePath = `/uploads/${req.file.filename}`;
    
    res.json({
      code: 0,
      data: {
        url: filePath,
        filename: req.file.filename,
        size: req.file.size
      }
    });
  } catch (error) {
    console.error('[Upload] 上传失败:', error);
    res.json({ code: -1, message: '上传失败: ' + error.message });
  }
});

router.post('/images', upload.array('images', 9), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.json({ code: -1, message: '请选择图片' });
    }
    
    const images = req.files.map(file => ({
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      size: file.size
    }));
    
    res.json({
      code: 0,
      data: images
    });
  } catch (error) {
    console.error('[Upload] 批量上传失败:', error);
    res.json({ code: -1, message: '上传失败: ' + error.message });
  }
});

module.exports = router;
