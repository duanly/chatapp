const groupModel = require('../models/groupModel');
const messageModel = require('../models/messageModel');
const userModel = require('../models/userModel');
const { notifyRobotsMemberJoined, notifyRobotsAddPlayer } = require('../socket');

// 创建群
async function createGroup(req, res) {
  const { name, avatar } = req.body;
  if (!name) {
    return res.json({ code: 400, message: '群名称不能为空' });
  }

  const group = await groupModel.create({
    name,
    avatar,
    ownerUid: req.user.uid,
  });

  // 加入群（Socket.IO room）
  if (req.socketId) {
    const io = require('../app').io;
    const socket = io.sockets.sockets.get(req.socketId);
    if (socket) {
      socket.join(`group:${group.id}`);
    }
  }

  res.json({ code: 0, message: '创建成功', data: group });
}

// 获取我的群列表
async function getMyGroups(req, res) {
  const groups = await groupModel.getByUser(req.user.uid);
  res.json({ code: 0, data: groups });
}

// 获取群信息
async function getGroupInfo(req, res) {
  const { id } = req.params;

  const group = await groupModel.getById(id);
  if (!group) {
    return res.json({ code: 404, message: '群不存在' });
  }

  // 检查是否是群成员
  const isMember = await groupModel.isMember(id, req.user.uid);
  if (!isMember) {
    return res.json({ code: 403, message: '不是群成员' });
  }

  res.json({ code: 0, data: group });
}

// 更新群信息
async function updateGroup(req, res) {
  const { id } = req.params;
  const { name, avatar } = req.body;

  const group = await groupModel.getById(id);
  if (!group) {
    return res.json({ code: 404, message: '群不存在' });
  }

  if (group.owner_uid !== req.user.uid) {
    return res.json({ code: 403, message: '只有群主可以修改' });
  }

  const data = {};
  if (name !== undefined) data.name = name;
  if (avatar !== undefined) data.avatar = avatar;

  const updated = await groupModel.update(id, data);
  res.json({ code: 0, message: '更新成功', data: updated });
}

// 群开门/关门
async function setGroupStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body; // 0=开门 1=关门

  const group = await groupModel.getById(id);
  if (!group) {
    return res.json({ code: 404, message: '群不存在' });
  }

  if (group.owner_uid !== req.user.uid) {
    return res.json({ code: 403, message: '只有群主可以操作' });
  }

  const updated = await groupModel.setStatus(id, status);
  res.json({ code: 0, message: status === 1 ? '已关门' : '已开门', data: updated });
}

// 添加成员
async function addMember(req, res) {
  const { id } = req.params;
  let { uid } = req.body;

  const group = await groupModel.getById(id);
  if (!group) {
    return res.json({ code: 404, message: '群不存在' });
  }

  // 关门后只有群主可以加人
  if (group.status === 1 && group.owner_uid !== req.user.uid) {
    return res.json({ code: 403, message: '群已关门，只有群主可以添加成员' });
  }

  // 支持通过短号添加：如果输入不像 uid 格式，先按短号查
  if (uid && !uid.startsWith('u_') && !uid.startsWith('user_')) {
    const userByShortNo = await userModel.findByShortNo(uid);
    if (userByShortNo) {
      uid = userByShortNo.uid;
    }
  }

  try {
    const member = await groupModel.addMember(id, uid);

    // 通知群里有新成员
    const io = require('../app').io;
    io.to(`group:${id}`).emit('group_member_added', {
      groupId: id,
      uid,
    });

    // 让新成员加入 room
    const { getSocketIdByUid } = require('../config/redis');
    const socketId = await getSocketIdByUid(uid);
    if (socketId) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.join(`group:${id}`);
      }
    }

    // 通知绑定的机器人（带上用户信息）
    const newMember = await userModel.findByUid(uid);
    if (newMember) {
      notifyRobotsMemberJoined(id, [{
        uid: newMember.uid,
        nickname: newMember.nickname,
        avatar: newMember.avatar,
        short_no: newMember.short_no,
        is_public: newMember.is_public,
      }]);
    }

    res.json({ code: 0, message: '添加成功', data: member });
  } catch (err) {
    res.json({ code: 400, message: err.message });
  }
}

// 移除成员
async function removeMember(req, res) {
  const { id, uid } = req.params;

  const group = await groupModel.getById(id);
  if (!group) {
    return res.json({ code: 404, message: '群不存在' });
  }

  if (group.owner_uid !== req.user.uid) {
    return res.json({ code: 403, message: '只有群主可以移除成员' });
  }

  if (uid === group.owner_uid) {
    return res.json({ code: 400, message: '不能移除群主' });
  }

  const member = await groupModel.removeMember(id, uid);

  // 通知群成员
  const io = require('../app').io;
  io.to(`group:${id}`).emit('group_member_removed', {
    groupId: id,
    uid,
  });

  // 让被移除的人离开 room
  const { getSocketIdByUid } = require('../config/redis');
  const socketId = await getSocketIdByUid(uid);
  if (socketId) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.leave(`group:${id}`);
      socket.emit('kicked_from_group', { groupId: id });
    }
  }

  res.json({ code: 0, message: '移除成功', data: member });
}

// 获取群成员列表
async function getMembers(req, res) {
  const { id } = req.params;

  const isMember = await groupModel.isMember(id, req.user.uid);
  if (!isMember) {
    return res.json({ code: 403, message: '不是群成员' });
  }

  const members = await groupModel.getMembers(id);
  res.json({ code: 0, data: members });
}

// 获取群消息历史
async function getMessages(req, res) {
  const { id } = req.params;
  const { beforeId, limit = 50 } = req.query;

  const isMember = await groupModel.isMember(id, req.user.uid);
  if (!isMember) {
    return res.json({ code: 403, message: '不是群成员' });
  }

  const messages = await messageModel.getGroupMessages(id, beforeId, limit);
  res.json({ code: 0, data: messages });
}

// 退出群
async function leaveGroup(req, res) {
  const { id } = req.params;

  const group = await groupModel.getById(id);
  if (!group) {
    return res.json({ code: 404, message: '群不存在' });
  }

  if (group.owner_uid === req.user.uid) {
    return res.json({ code: 400, message: '群主不能退群，请先转让群主' });
  }

  await groupModel.removeMember(id, req.user.uid);

  // 离开 room
  const io = require('../app').io;
  const { getSocketIdByUid } = require('../config/redis');
  const socketId = await getSocketIdByUid(req.user.uid);
  if (socketId) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.leave(`group:${id}`);
    }
  }

  // 通知群成员
  io.to(`group:${id}`).emit('group_member_left', {
    groupId: id,
    uid: req.user.uid,
  });

  res.json({ code: 0, message: '已退出群' });
}

// 通过邀请码获取群信息（不用是成员也能看基本信息）
async function getGroupByInviteCode(req, res) {
  const { code } = req.params;

  const group = await groupModel.getByInviteCode(code);
  if (!group) {
    return res.json({ code: 404, message: '群不存在或邀请码无效' });
  }

  // 检查当前用户是不是群成员
  const isMember = await groupModel.isMember(group.id, req.user.uid);

  // 只返回基本信息
  res.json({
    code: 0,
    data: {
      id: group.id,
      name: group.name,
      avatar: group.avatar,
      member_count: group.member_count,
      status: group.status,
      invite_code: group.invite_code,
      is_member: isMember,
    },
  });
}

// 通过邀请码加入群
async function joinGroupByInviteCode(req, res) {
  const { code } = req.params;

  const group = await groupModel.getByInviteCode(code);
  if (!group) {
    return res.json({ code: 404, message: '群不存在或邀请码无效' });
  }

  // 检查群是否关门
  if (group.status === 1) {
    return res.json({ code: 403, message: '群已关门，无法加入' });
  }

  const uid = req.user.uid;

  // 检查是否已经在群里（查实际成员表）
  const alreadyMember = await groupModel.isActualMember(group.id, uid);
  if (alreadyMember) {
    return res.json({ code: 0, message: '已经在群里了', data: { group_id: group.id } });
  }

  try {
    await groupModel.addMember(group.id, uid);

    // 通知群里有新成员
    const io = require('../app').io;
    io.to(`group:${group.id}`).emit('group_member_added', {
      groupId: group.id,
      uid,
    });

    // 让新成员加入 room
    const { getSocketIdByUid } = require('../config/redis');
    const socketId = await getSocketIdByUid(uid);
    if (socketId) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.join(`group:${group.id}`);
      }
    }

    // 通知绑定的机器人
    const newMember = await userModel.findByUid(uid);
    if (newMember) {
      notifyRobotsMemberJoined(group.id, [{
        uid: newMember.uid,
        nickname: newMember.nickname,
        avatar: newMember.avatar,
        short_no: newMember.short_no,
        is_public: newMember.is_public,
      }]);
    }

    res.json({ code: 0, message: '加入成功', data: { group_id: group.id } });
  } catch (err) {
    res.json({ code: 400, message: err.message });
  }
}

// 直接加入群（公共群开门时任何人可加，私有群需要邀请）
async function joinGroup(req, res) {
  const { id } = req.params;
  const groupId = parseInt(id);

  const group = await groupModel.getById(groupId);
  if (!group) {
    return res.json({ code: 404, message: '群不存在' });
  }

  const uid = req.user.uid;

  // 检查是否已经在群里（查实际成员表，不考虑公共群逻辑）
  const existing = await groupModel.isActualMember(groupId, uid);
  if (existing) {
    return res.json({ code: 0, message: '已经在群里了', data: { group_id: groupId } });
  }

  // 公共群且开门：允许加入
  if (group.is_public && group.status === 0) {
    try {
      await groupModel.addMember(groupId, uid);

      const io = require('../app').io;
      io.to(`group:${groupId}`).emit('group_member_added', {
        groupId,
        uid,
      });

      const { getSocketIdByUid } = require('../config/redis');
      const socketId = await getSocketIdByUid(uid);
      if (socketId) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.join(`group:${groupId}`);
        }
      }

      // 通知绑定的机器人
      const newMember = await userModel.findByUid(uid);
      if (newMember) {
        notifyRobotsMemberJoined(groupId, [{
          uid: newMember.uid,
          nickname: newMember.nickname,
          avatar: newMember.avatar,
          short_no: newMember.short_no,
          is_public: newMember.is_public,
        }]);
      }

      return res.json({ code: 0, message: '加入成功', data: { group_id: groupId } });
    } catch (err) {
      return res.json({ code: 400, message: err.message });
    }
  }

  // 私有群或已关门的公共群：不允许直接加入
  res.json({ code: 403, message: '无法加入该群，请通过邀请码加入' });
}

// 添加玩家（通知机器人调用 addpaochatuser 接口）
async function addPlayerToRobot(req, res) {
  const { groupId, uid } = req.body;
  if (!groupId || !uid) {
    return res.json({ code: 400, message: '参数错误' });
  }

  // 检查是否是群成员
  const isMember = await groupModel.isMember(groupId, req.user.uid);
  if (!isMember) {
    return res.json({ code: 403, message: '不是群成员' });
  }

  // 获取目标用户信息
  const user = await userModel.findByUid(uid);
  if (!user) {
    return res.json({ code: 404, message: '用户不存在' });
  }

  // 通知机器人
  const result = await notifyRobotsAddPlayer(groupId, {
    uid: user.uid,
    nickname: user.nickname,
    short_no: user.short_no,
    avatar: user.avatar,
  });

  if (result) {
    res.json({ code: 0, message: '已发送添加请求' });
  } else {
    res.json({ code: 404, message: '该群没有在线机器人' });
  }
}

module.exports = {
  createGroup,
  getMyGroups,
  getGroupInfo,
  updateGroup,
  setGroupStatus,
  addMember,
  removeMember,
  getMembers,
  getMessages,
  leaveGroup,
  getGroupByInviteCode,
  joinGroupByInviteCode,
  joinGroup,
  addPlayerToRobot,
};
