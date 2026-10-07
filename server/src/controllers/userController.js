const bcrypt = require('bcryptjs');
const userModel = require('../models/userModel');
const messageModel = require('../models/messageModel');
const loginLogModel = require('../models/loginLogModel');
const { generateToken } = require('../utils/jwt');
const redis = require('../config/redis');

// 获取客户端真实 IP
function getClientIp(req) {
  const ip = req.ip ||
    req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    '';
  // 可能是 "::ffff:127.0.0.1" 格式
  return ip.replace(/^::ffff:/, '').split(',')[0].trim();
}

// 手机号 + 密码登录
async function loginByPassword(req, res) {
  const { phone, password, device_id: deviceId, device_info: deviceInfo } = req.body;

  if (!phone || !password) {
    return res.json({ code: 400, message: '手机号和密码不能为空' });
  }

  const user = await userModel.findByPhone(phone);
  if (!user) {
    return res.json({ code: 400, message: '用户不存在' });
  }

  // 检查密码
  const bcrypt = require('bcryptjs');
  const valid = await bcrypt.compare(password, user.password || '');
  if (!valid) {
    return res.json({ code: 400, message: '密码错误' });
  }

  // 检查是否被封禁
  if (user.status === 1) {
    return res.json({ code: 403, message: '账号已被封禁' });
  }

  const clientIp = getClientIp(req);

  // 设备锁校验：开启了设备锁且已有绑定设备时，校验 device_id
  if (user.device_lock && user.device_id && deviceId && user.device_id !== deviceId) {
    // 记录失败登录
    loginLogModel.addLog({
      uid: user.uid,
      ip: clientIp,
      deviceId: deviceId || '',
      deviceInfo: (deviceInfo || '') + ' [设备锁拒绝]',
    });
    return res.json({ code: 403, message: '设备锁已开启，请在已绑定的设备上登录' });
  }

  // 第一次登录或者开启了设备锁但还没绑定设备：绑定当前设备
  if (user.device_lock && !user.device_id && deviceId) {
    await userModel.update(user.uid, { deviceId });
  }

  // 更新登录时间和最后登录 IP
  await userModel.updateLastLogin(user.uid, clientIp);

  // 记录登录日志
  loginLogModel.addLog({
    uid: user.uid,
    ip: clientIp,
    deviceId: deviceId || '',
    deviceInfo: deviceInfo || '',
  });

  // 生成 token
  const token = generateToken({
    uid: user.uid,
    phone: user.phone,
  });

  res.json({
    code: 0,
    message: '登录成功',
    data: {
      token,
      user: {
        uid: user.uid,
        short_no: user.short_no,
        phone: user.phone,
        nickname: user.nickname,
        avatar: user.avatar,
        device_lock: !!user.device_lock,
      },
    },
  });
}

// 获取用户信息
async function getUserInfo(req, res) {
  const user = await userModel.findByUid(req.user.uid);
  if (!user) {
    return res.json({ code: 404, message: '用户不存在' });
  }

  res.json({
    code: 0,
    data: {
      uid: user.uid,
      short_no: user.short_no,
      phone: user.phone,
      nickname: user.nickname,
      avatar: user.avatar,
      status: user.status,
    },
  });
}

// 更新用户信息
async function updateUserInfo(req, res) {
  const { nickname, avatar } = req.body;
  const data = {};
  if (nickname !== undefined) data.nickname = nickname;
  if (avatar !== undefined) data.avatar = avatar;

  const user = await userModel.update(req.user.uid, data);
  res.json({
    code: 0,
    message: '更新成功',
    data: {
      uid: user.uid,
      nickname: user.nickname,
      avatar: user.avatar,
    },
  });
}

// 搜索用户
async function searchUsers(req, res) {
  const { keyword, page = 1, pageSize = 20 } = req.query;
  if (!keyword) {
    return res.json({ code: 0, data: [] });
  }
  const list = await userModel.searchPublic(keyword, page, pageSize);
  // 排除自己
  const myUid = req.user.uid;
  const filtered = list.filter(u => u.uid !== myUid);
  res.json({ code: 0, data: filtered });
}

// 获取用户列表（只返回公开用户）
async function listUsers(req, res) {
  const list = await userModel.getPublicUsers();
  // 排除自己
  const myUid = req.user.uid;
  const filtered = list.filter(u => u.uid !== myUid);
  res.json({ code: 0, data: filtered });
}

// 获取公共用户列表
async function getPublicUsers(req, res) {
  const list = await userModel.getPublicUsers();
  // 排除自己
  const myUid = req.user.uid;
  const filtered = list.filter(u => u.uid !== myUid);
  res.json({ code: 0, data: filtered });
}

// 单聊消息历史
async function getSingleMessages(req, res) {
  const { uid } = req.params;
  const { beforeId, limit = 50 } = req.query;
  const myUid = req.user.uid;

  const messages = await messageModel.getSingleMessages(myUid, uid, beforeId, limit);
  res.json({ code: 0, data: messages });
}

module.exports = {
  loginByPassword,
  getUserInfo,
  updateUserInfo,
  searchUsers,
  listUsers,
  getPublicUsers,
  getSingleMessages,
};
