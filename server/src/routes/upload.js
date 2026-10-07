const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { authMiddleware } = require('../middleware/auth');

// 获取 OSS 上传凭证（兼容旧版）
router.get('/oss/token', authMiddleware, uploadController.getOssToken || (() => {}));

// 本地上传（type: avatar / chat）
router.post('/:type', authMiddleware, uploadController.uploadFile);

module.exports = router;
