const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { authMiddleware } = require('../middleware/auth');

// 创建群
router.post('/', authMiddleware, groupController.createGroup);

// 我的群列表
router.get('/my', authMiddleware, groupController.getMyGroups);

// 群信息
router.get('/:id', authMiddleware, groupController.getGroupInfo);

// 更新群信息
router.put('/:id', authMiddleware, groupController.updateGroup);

// 群开门/关门
router.post('/:id/status', authMiddleware, groupController.setGroupStatus);

// 群成员列表
router.get('/:id/members', authMiddleware, groupController.getMembers);

// 添加成员
router.post('/:id/members', authMiddleware, groupController.addMember);

// 移除成员
router.delete('/:id/members/:uid', authMiddleware, groupController.removeMember);

// 群消息历史
router.get('/:id/messages', authMiddleware, groupController.getMessages);

// 退出群
router.post('/:id/leave', authMiddleware, groupController.leaveGroup);

// 邀请码：获取群信息
router.get('/invite/:code', authMiddleware, groupController.getGroupByInviteCode);

// 邀请码：加入群
router.post('/invite/:code/join', authMiddleware, groupController.joinGroupByInviteCode);

// 直接加入群（公共群可用）
router.post('/:id/join', authMiddleware, groupController.joinGroup);

// 添加玩家（通知机器人调用 addpaochatuser）
router.post('/:id/add-player', authMiddleware, groupController.addPlayerToRobot);

module.exports = router;
