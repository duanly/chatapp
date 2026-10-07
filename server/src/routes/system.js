const express = require('express');
const router = express.Router();
const systemController = require('../controllers/systemController');

// 获取系统设置（公开）
router.get('/settings', systemController.getSettings);

module.exports = router;
