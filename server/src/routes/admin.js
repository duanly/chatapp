const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const uploadController = require('../controllers/uploadController');
const { adminAuthMiddleware } = require('../middleware/auth');

// 登录
router.post('/login', adminController.login);

// 用户管理
router.get('/users', adminAuthMiddleware, adminController.userList);
router.get('/users/:uid', adminAuthMiddleware, adminController.userDetail);
router.post('/users', adminAuthMiddleware, adminController.createUser);
router.post('/users/batch', adminAuthMiddleware, adminController.batchCreateUsers);
router.post('/users/:uid/status', adminAuthMiddleware, adminController.setUserStatus);
router.post('/users/:uid/public', adminAuthMiddleware, adminController.setUserPublic);
router.post('/users/:uid/device-lock', adminAuthMiddleware, adminController.setDeviceLock);
router.post('/users/:uid/clear-device', adminAuthMiddleware, adminController.clearDevice);
router.put('/users/:uid/remark', adminAuthMiddleware, adminController.updateUserRemark);

// 群管理
router.get('/groups', adminAuthMiddleware, adminController.groupList);
router.post('/groups', adminAuthMiddleware, adminController.createGroup);
router.put('/groups/:id', adminAuthMiddleware, adminController.updateGroup);
router.post('/groups/:id/status', adminAuthMiddleware, adminController.setGroupStatus);
router.post('/groups/:id/public', adminAuthMiddleware, adminController.setGroupPublic);
router.delete('/groups/:id', adminAuthMiddleware, adminController.disbandGroup);

// 消息管理
router.get('/messages', adminAuthMiddleware, adminController.messageList);

// 机器人管理
router.get('/robots', adminAuthMiddleware, adminController.robotList);
router.post('/robots', adminAuthMiddleware, adminController.createRobot);
router.put('/robots/:id', adminAuthMiddleware, adminController.updateRobot);
router.post('/robots/:id/bind', adminAuthMiddleware, adminController.robotBindGroup);
router.delete('/robots/:id/unbind/:groupId', adminAuthMiddleware, adminController.robotUnbindGroup);
router.get('/robots/messages/logs', adminAuthMiddleware, adminController.robotMessageLogs);

// 导入 tsdd 用户
router.post('/users/import/tsdd', adminAuthMiddleware, adminController.importTsddUsers);

// 管理员上传文件（头像等）
router.post('/upload/:type', adminAuthMiddleware, uploadController.uploadFile);

// 系统设置
router.get('/settings', adminAuthMiddleware, adminController.getSystemSettings);
router.put('/settings', adminAuthMiddleware, adminController.updateSystemSettings);

module.exports = router;
