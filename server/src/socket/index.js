const redis = require('../config/redis');
const messageModel = require('../models/messageModel');
const groupModel = require('../models/groupModel');
const userModel = require('../models/userModel');
const robotModel = require('../models/robotModel');
const robotMessageLogModel = require('../models/robotMessageLogModel');
const { generateId } = require('../utils/id');

let io = null;

function init(socketIo) {
  io = socketIo;

  // 普通用户命名空间
  const userNsp = io.of('/');
  userNsp.on('connection', handleUserConnection);

  // 机器人命名空间
  const robotNsp = io.of('/robot');
  robotNsp.on('connection', handleRobotConnection);

  console.log('Socket.IO initialized');
}

// ========== 用户连接 ==========

async function handleUserConnection(socket) {
  const user = socket.user;
  if (!user) return;

  const uid = user.uid;
  const socketId = socket.id;
  const newDeviceId = socket.deviceId;

  console.log(`User connected: ${uid}, socket: ${socketId}, device: ${newDeviceId || 'unknown'}`);

  // 设备锁：踢掉旧连接
  const oldSocketId = await redis.getSocketIdByUid(uid);
  if (oldSocketId && oldSocketId !== socketId) {
    const oldSocket = io.sockets.sockets.get(oldSocketId);
    if (oldSocket) {
      const oldDeviceId = oldSocket.deviceId;

      // 不同设备登录：发 kick 通知，踢掉旧的
      if (!oldDeviceId || !newDeviceId || oldDeviceId !== newDeviceId) {
        oldSocket.emit('kick', { reason: 'other_device_login', message: '您的账号在其他设备登录' });
        oldSocket.disconnect(true);
      }
      // 同一设备（多标签页等）：不踢，允许共存，不更新在线 socket
      else {
        console.log(`Same device multi-connection: ${uid}, keeping both`);
      }
    }
  }

  // 只在没有旧连接，或者旧连接是不同设备被踢掉的情况下，更新在线状态
  const currentSocketId = await redis.getSocketIdByUid(uid);
  if (!currentSocketId || currentSocketId === oldSocketId) {
    await redis.setOnline(uid, socketId);
  }

  // 加入用户专属 room（用于同用户多连接消息同步）
  socket.join(`user:${uid}`);

  // 加入用户所在的所有群
  const groups = await groupModel.getByUser(uid);
  for (const group of groups) {
    socket.join(`group:${group.id}`);
  }

  // 广播在线状态
  socket.broadcast.emit('user_online', { uid });

  // 发送消息
  socket.on('send_message', handleSendMessage(socket));

  // 撤回消息
  socket.on('withdraw_message', handleWithdrawMessage(socket));

  // 消息已读（单聊）
  socket.on('read_message', handleReadMessage(socket));

  // 断开连接
  socket.on('disconnect', () => handleUserDisconnect(socket));

  // 心跳
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });
}

async function handleUserDisconnect(socket) {
  const user = socket.user;
  if (!user) return;

  const uid = user.uid;
  const socketId = socket.id;

  console.log(`User disconnected: ${uid}, socket: ${socketId}`);

  const currentSocketId = await redis.getSocketIdByUid(uid);
  if (currentSocketId === socketId) {
    await redis.setOffline(uid, socketId);
    socket.broadcast.emit('user_offline', { uid });
  }
}

function handleSendMessage(socket) {
  return async (data, callback) => {
    try {
      const user = socket.user;
      const { groupId, toUid, type = 1, content, mentionUids = [] } = data;

      // 校验：必须有群ID或对方UID
      if (!groupId && !toUid) {
        return callback?.({ code: 400, message: '参数错误' });
      }

      // 群聊：校验是否是群成员
      if (groupId) {
        const isMember = await groupModel.isMember(groupId, user.uid);
        if (!isMember) {
          return callback?.({ code: 403, message: '不是群成员' });
        }
      }

      // 保存消息
      const message = await messageModel.send({
        groupId: groupId || null,
        fromUid: user.uid,
        toUid: toUid || null,
        type,
        content,
        mentionUids: mentionUids || [],
      });

      // 读取最新的用户信息（确保头像等是最新的）
      const latestUser = await userModel.findByUid(user.uid);

      // 构造返回数据
      const messageData = {
        ...message,
        from_nickname: latestUser?.nickname || user.nickname,
        from_avatar: latestUser?.avatar || user.avatar,
        from_short_no: latestUser?.short_no || user.short_no,
        mention_uids: mentionUids || [],
      };

      // 群聊：广播到群
      if (groupId) {
        socket.to(`group:${groupId}`).emit('new_message', messageData);
        // 也发给自己（其他设备）
        socket.emit('new_message', messageData);
      }

      // 单聊：发给对方（所有设备/标签页）
      if (toUid) {
        io.to(`user:${toUid}`).emit('new_message', messageData);
        // 也发给自己的其他连接
        socket.to(`user:${user.uid}`).emit('new_message', messageData);
        // 发给自己当前连接
        socket.emit('new_message', messageData);
      }

      // 先 callback 确认发送成功，避免机器人转发慢导致发送方卡"发送中"
      callback?.({ code: 0, message: '发送成功', data: messageData });

      // 转发给绑定的机器人（异步，不阻塞 callback）
      if (groupId) {
        forwardToRobots(groupId, messageData).catch(err => {
          console.error('[Robot] forward failed:', err.message);
        });
      }
    } catch (err) {
      console.error('send_message error:', err);
      callback?.({ code: 500, message: err.message || '发送失败' });
    }
  };
}

// 撤回消息
function handleWithdrawMessage(socket) {
  return async (data, callback) => {
    try {
      const user = socket.user;
      const { msgId } = data;

      if (!msgId) {
        return callback?.({ code: 400, message: '参数错误' });
      }

      // 先查消息
      const msg = await messageModel.getById(msgId);
      if (!msg) {
        return callback?.({ code: 404, message: '消息不存在' });
      }

      // 群聊：校验是不是群成员
      if (msg.group_id) {
        const isMember = await groupModel.isMember(msg.group_id, user.uid);
        if (!isMember) {
          return callback?.({ code: 403, message: '不是群成员' });
        }
      }
      // 单聊：校验是不是当事人
      else {
        if (msg.from_uid !== user.uid && msg.to_uid !== user.uid) {
          return callback?.({ code: 403, message: '无权操作' });
        }
      }

      // 执行撤回
      const result = await messageModel.withdraw(msgId, user.uid);
      if (!result.success) {
        return callback?.({ code: 400, message: result.message });
      }

      const withdrawData = {
        id: msgId,
        group_id: msg.group_id,
        from_uid: msg.from_uid,
        to_uid: msg.to_uid,
        withdrawn: true,
        withdrawn_at: new Date().toISOString(),
      };

      // 广播撤回事件
      if (msg.group_id) {
        // 群聊：广播到整个群（包括自己的其他设备）
        io.to(`group:${msg.group_id}`).emit('message_withdrawn', withdrawData);

        // 通知绑定的机器人
        forwardWithdrawToRobots(msg.group_id, withdrawData);
      } else {
        // 单聊：发给双方所有设备
        io.to(`user:${msg.from_uid}`).emit('message_withdrawn', withdrawData);
        io.to(`user:${msg.to_uid}`).emit('message_withdrawn', withdrawData);
      }

      callback?.({ code: 0, message: '撤回成功', data: withdrawData });
    } catch (err) {
      console.error('withdraw_message error:', err);
      callback?.({ code: 500, message: err.message || '撤回失败' });
    }
  };
}

// 单聊消息已读
function handleReadMessage(socket) {
  return async (data) => {
    try {
      const user = socket.user;
      const { fromUid, lastMsgId } = data; // 对方UID，最后一条已读消息ID

      if (!fromUid) return;

      // 通知对方（所有连接）：你的消息被已读了
      io.to(`user:${fromUid}`).emit('message_read', {
        fromUid: user.uid, // 谁读了
        lastMsgId,         // 读到哪条
      });
    } catch (err) {
      console.error('read_message error:', err);
    }
  };
}

// 转发群消息给机器人
async function forwardToRobots(groupId, messageData) {
  try {
    const robots = await robotModel.getGroupRobots(groupId);
    console.log(`[forwardToRobots] group=${groupId}, robotCount=${robots.length}`);
    for (const robot of robots) {
      console.log(`  -> robot ${robot.id} (${robot.name}), status=${robot.status}`);
      const robotSocketId = await redis.getRobotSocket(robot.id);
      if (robotSocketId) {
        const robotNsp = io.of('/robot');
        const robotSocket = robotNsp.sockets.get(robotSocketId);
        if (robotSocket) {
          robotSocket.emit('group_message', {
            message: messageData,
            groupId,
          });
        }
      }
      // 记录日志：机器人收到消息（direction=in）
      robotMessageLogModel.addLog({
        robotId: robot.id,
        groupId,
        direction: 'in',
        msgType: messageData.type,
        content: messageData.content,
        fromUid: messageData.from_uid,
        fromNickname: messageData.from_nickname,
        msgId: messageData.id,
      }).catch(err => console.error('log robot in msg error:', err));
    }
  } catch (err) {
    console.error('forwardToRobots error:', err);
  }
}

// 通知机器人消息被撤回
async function forwardWithdrawToRobots(groupId, withdrawData) {
  try {
    const robots = await robotModel.getGroupRobots(groupId);
    for (const robot of robots) {
      const robotSocketId = await redis.getRobotSocket(robot.id);
      if (robotSocketId) {
        const robotNsp = io.of('/robot');
        const robotSocket = robotNsp.sockets.get(robotSocketId);
        if (robotSocket) {
          robotSocket.emit('group_message_withdraw', {
            message: withdrawData,
            groupId,
          });
        }
      }
      // 更新日志标记为已撤回
      robotMessageLogModel.markWithdrawn(groupId, withdrawData.id)
        .catch(err => console.error('mark withdraw log error:', err));
    }
  } catch (err) {
    console.error('forwardWithdrawToRobots error:', err);
  }
}

// ========== 机器人连接 ==========

async function handleRobotConnection(socket) {
  const robot = socket.robot;
  if (!robot) return;

  const robotId = robot.id;
  const socketId = socket.id;

  console.log(`Robot connected: ${robot.name} (${robotId}), socket: ${socketId}`);

  // 踢掉旧的机器人连接
  const oldSocketId = await redis.getRobotSocket(robotId);
  if (oldSocketId && oldSocketId !== socketId) {
    const robotNsp = io.of('/robot');
    const oldSocket = robotNsp.sockets.get(oldSocketId);
    if (oldSocket) {
      oldSocket.disconnect(true);
    }
  }

  await redis.setRobotSocket(socketId, robotId);

  // 机器人发消息到群
  socket.on('send_group_msg', handleRobotSendMessage(socket));

  // 机器人获取群成员
  socket.on('get_group_members', handleRobotGetGroupMembers(socket));

  // 机器人获取所有群列表（用于绑定）
  socket.on('get_all_groups', handleRobotGetAllGroups(socket));

  // 机器人绑定群
  socket.on('bind_group', handleRobotBindGroup(socket));

  // 机器人解绑群
  socket.on('unbind_group', handleRobotUnbindGroup(socket));

  // 获取所有机器人列表（仅名称和ID，用于切换）
  socket.on('list_robots', handleListRobots(socket));

  // 断开
  socket.on('disconnect', () => handleRobotDisconnect(socket));

  // 心跳
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });

  // 推送机器人配置和绑定的群
  const groups = await robotModel.getRobotGroups(robotId);
  socket.emit('robot_config', {
    id: robot.id,
    name: robot.name,
    avatar: robot.avatar,
    status: robot.status,
    bizWsUrl: robot.biz_ws_url || '',
    enableBizWs: !!robot.enable_biz_ws,
    watchFolder: robot.watch_folder || '',
    enableFolderWatch: !!robot.enable_folder_watch,
    imageExtensions: (robot.image_extensions || '.png,.jpg,.jpeg,.gif,.webp,.bmp').split(','),
    groups: groups.map(g => ({
      groupId: g.group_id,
      groupName: g.group_name,
      groupAvatar: g.group_avatar,
    })),
  });
}

// 上传机器人发送的 base64 图片，返回图片 URL
async function uploadRobotImage(dataUrl) {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  // 解析 base64
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return dataUrl;

  const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
  const base64 = match[2];
  const buffer = Buffer.from(base64, 'base64');

  // 生成文件名
  const filename = `robot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  // 尝试上传到 OSS
  try {
    const uploadCtrl = require('../controllers/uploadController');
    const config = require('../config/config');
    if (config.oss?.accessKeyId && config.oss?.bucket) {
      const OSS = require('ali-oss');
      const client = new OSS({
        region: config.oss.region || 'oss-cn-shenzhen',
        accessKeyId: config.oss.accessKeyId,
        accessKeySecret: config.oss.accessKeySecret,
        bucket: config.oss.bucket,
        secure: true,
      });
      const objectName = `chat/${filename}`;
      const result = await client.put(objectName, buffer);
      return config.oss.domain ? `${config.oss.domain}/${objectName}` : result.url;
    }
  } catch (err) {
    console.error('robot image upload to OSS failed:', err.message);
  }

  // OSS 未配置或上传失败：保存到本地 uploads 目录
  try {
    const uploadDir = path.join(__dirname, '../../uploads/chat');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const localPath = path.join(uploadDir, filename);
    fs.writeFileSync(localPath, buffer);
    return `/uploads/chat/${filename}`;
  } catch (err) {
    console.error('robot image save local failed:', err.message);
    return dataUrl; // 失败就返回原始 base64
  }
}

function handleRobotSendMessage(socket) {
  return async (data, callback) => {
    try {
      const robot = socket.robot;
      const { groupId, type = 1, content, mentionUids = [] } = data;

      if (!groupId) {
        return callback?.({ code: 400, message: '缺少 groupId' });
      }

      // 校验机器人是否绑定了这个群
      const groups = await robotModel.getRobotGroups(robot.id);
      const groupIds = groups.map(g => parseInt(g.group_id));
      if (!groupIds.includes(parseInt(groupId))) {
        return callback?.({ code: 403, message: '机器人未绑定该群' });
      }

      // 图片消息：如果 content 是 base64 dataURL，先上传到 OSS/本地
      let finalContent = content;
      if (type === 2 && content && typeof content === 'string' && content.startsWith('data:image/')) {
        finalContent = await uploadRobotImage(content);
      }

      // 保存消息（发消息的是机器人，用机器人的虚拟身份）
      const message = await messageModel.send({
        groupId,
        fromUid: `robot:${robot.id}`,
        toUid: null,
        type,
        content: finalContent,
        mentionUids: mentionUids || [],
      });

      const messageData = {
        ...message,
        from_nickname: robot.name,
        from_avatar: robot.avatar,
        is_robot: true,
        mention_uids: mentionUids || [],
      };

      // 广播到群
      io.to(`group:${groupId}`).emit('new_message', messageData);

      console.log(`[robotSend] robot=${robot.id} (${robot.name}), group=${groupId}, msgId=${message.id}`);

      // 记录日志：机器人发出消息（direction=out）
      robotMessageLogModel.addLog({
        robotId: robot.id,
        groupId,
        direction: 'out',
        msgType: type,
        content,
        msgId: message.id,
      }).catch(err => console.error('log robot out msg error:', err));

      callback?.({ code: 0, message: '发送成功', data: messageData });
    } catch (err) {
      console.error('robot send_message error:', err);
      callback?.({ code: 500, message: err.message || '发送失败' });
    }
  };
}

function handleRobotGetGroupMembers(socket) {
  return async (data, callback) => {
    try {
      const robot = socket.robot;
      const { groupId } = data;

      if (!groupId) {
        return callback?.({ code: 400, message: '缺少 groupId' });
      }

      // 校验机器人是否绑定了这个群
      const groups = await robotModel.getRobotGroups(robot.id);
      const groupIds = groups.map(g => parseInt(g.group_id));
      if (!groupIds.includes(parseInt(groupId))) {
        return callback?.({ code: 403, message: '机器人未绑定该群' });
      }

      const members = await groupModel.getMembers(groupId);
      callback?.({ code: 0, message: 'ok', data: members });
    } catch (err) {
      console.error('robot get_group_members error:', err);
      callback?.({ code: 500, message: err.message || '获取失败' });
    }
  };
}

function handleRobotGetAllGroups(socket) {
  return async (data, callback) => {
    try {
      const groups = await groupModel.list(1, 1000);
      callback?.({ code: 0, data: groups });
    } catch (err) {
      console.error('robot get_all_groups error:', err);
      callback?.({ code: 500, message: err.message });
    }
  };
}

function handleRobotBindGroup(socket) {
  return async (data, callback) => {
    try {
      const robot = socket.robot;
      const { groupId } = data;
      if (!groupId) {
        return callback?.({ code: 400, message: '缺少 groupId' });
      }

      await robotModel.bindGroup(robot.id, parseInt(groupId));

      // 重新推送配置
      const groups = await robotModel.getRobotGroups(robot.id);
      socket.emit('robot_config', {
        id: robot.id,
        name: robot.name,
        avatar: robot.avatar,
        status: robot.status,
        bizWsUrl: robot.biz_ws_url || '',
        enableBizWs: !!robot.enable_biz_ws,
        watchFolder: robot.watch_folder || '',
        enableFolderWatch: !!robot.enable_folder_watch,
        imageExtensions: (robot.image_extensions || '.png,.jpg,.jpeg,.gif,.webp,.bmp').split(','),
        groups: groups.map(g => ({
          groupId: g.group_id,
          groupName: g.group_name,
          groupAvatar: g.group_avatar,
        })),
      });

      callback?.({ code: 0, message: '绑定成功' });
    } catch (err) {
      console.error('robot bind_group error:', err);
      callback?.({ code: 500, message: err.message || '绑定失败' });
    }
  };
}

function handleRobotUnbindGroup(socket) {
  return async (data, callback) => {
    try {
      const robot = socket.robot;
      const { groupId } = data;
      if (!groupId) {
        return callback?.({ code: 400, message: '缺少 groupId' });
      }

      await robotModel.unbindGroup(robot.id, parseInt(groupId));

      // 重新推送配置
      const groups = await robotModel.getRobotGroups(robot.id);
      socket.emit('robot_config', {
        id: robot.id,
        name: robot.name,
        avatar: robot.avatar,
        status: robot.status,
        bizWsUrl: robot.biz_ws_url || '',
        enableBizWs: !!robot.enable_biz_ws,
        watchFolder: robot.watch_folder || '',
        enableFolderWatch: !!robot.enable_folder_watch,
        imageExtensions: (robot.image_extensions || '.png,.jpg,.jpeg,.gif,.webp,.bmp').split(','),
        groups: groups.map(g => ({
          groupId: g.group_id,
          groupName: g.group_name,
          groupAvatar: g.group_avatar,
        })),
      });

      callback?.({ code: 0, message: '解绑成功' });
    } catch (err) {
      console.error('robot unbind_group error:', err);
      callback?.({ code: 500, message: err.message || '解绑失败' });
    }
  };
}

function handleListRobots(socket) {
  return async (data, callback) => {
    try {
      const robots = await robotModel.list();
      // 只返回 id 和 name，不返回 api_key
      const list = robots.map(r => ({
        id: r.id,
        name: r.name,
        status: r.status,
      }));
      callback?.({ code: 0, data: list });
    } catch (err) {
      console.error('robot list_robots error:', err);
      callback?.({ code: 500, message: err.message });
    }
  };
}

async function handleRobotDisconnect(socket) {
  const robot = socket.robot;
  if (!robot) return;

  console.log(`Robot disconnected: ${robot.name} (${robot.id})`);
  await redis.removeRobotSocket(robot.id, socket.id);
}

// 给指定用户发系统消息
async function sendSystemMessage(uid, content) {
  const socketId = await redis.getSocketIdByUid(uid);
  if (!socketId) return false;

  const socket = io.sockets.sockets.get(socketId);
  if (!socket) return false;

  socket.emit('system_message', { content, timestamp: Date.now() });
  return true;
}

// 踢用户下线
async function kickUser(uid, reason = 'banned') {
  const socketId = await redis.getSocketIdByUid(uid);
  if (!socketId) return false;

  const socket = io.sockets.sockets.get(socketId);
  if (socket) {
    socket.emit('kick', { reason, message: '您已被封禁' });
    socket.disconnect(true);
  }

  await redis.setOffline(uid, socketId);
  return true;
}

// 通知机器人有新成员加入群
async function notifyRobotsMemberJoined(groupId, members) {
  try {
    const robots = await robotModel.getGroupRobots(groupId);
    for (const robot of robots) {
      const robotSocketId = await redis.getRobotSocket(robot.id);
      if (robotSocketId) {
        const robotNsp = io.of('/robot');
        const robotSocket = robotNsp.sockets.get(robotSocketId);
        if (robotSocket) {
          robotSocket.emit('member_joined', {
            groupId,
            members,
          });
        }
      }
    }
  } catch (err) {
    console.error('notifyRobotsMemberJoined error:', err);
  }
}

// 通知机器人添加玩家
async function notifyRobotsAddPlayer(groupId, player) {
  try {
    const robots = await robotModel.getGroupRobots(groupId);
    for (const robot of robots) {
      const robotSocketId = await redis.getRobotSocket(robot.id);
      if (robotSocketId) {
        const robotNsp = io.of('/robot');
        const robotSocket = robotNsp.sockets.get(robotSocketId);
        if (robotSocket) {
          robotSocket.emit('add_player', {
            groupId,
            player,
          });
        }
      }
    }
    return robots.length > 0;
  } catch (err) {
    console.error('notifyRobotsAddPlayer error:', err);
    return false;
  }
}

module.exports = {
  init,
  sendSystemMessage,
  kickUser,
  notifyRobotsMemberJoined,
  notifyRobotsAddPlayer,
};
