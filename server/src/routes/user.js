const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const conversationController = require('../controllers/conversationController');
const { authMiddleware } = require('../middleware/auth');

// 手机号+密码登录
router.post('/user/login', userController.loginByPassword);

// 获取用户信息
router.get('/user/info', authMiddleware, userController.getUserInfo);

// 更新用户信息
router.put('/user/info', authMiddleware, userController.updateUserInfo);

// 搜索用户
router.get('/users/search', authMiddleware, userController.searchUsers);

// 用户列表
router.get('/users/list', authMiddleware, userController.listUsers);

// 公共用户列表
router.get('/users/public', authMiddleware, userController.getPublicUsers);

// 单聊消息历史
router.get('/user/messages/:uid', authMiddleware, userController.getSingleMessages);

// 会话设置：获取我的所有设置
router.get('/conversation/settings', authMiddleware, conversationController.getMySettings);

// 会话设置：置顶/取消置顶
router.post('/conversation/pin', authMiddleware, conversationController.setPinned);

// 会话设置：标星/取消标星
router.post('/conversation/star', authMiddleware, conversationController.setStared);

module.exports = router;
