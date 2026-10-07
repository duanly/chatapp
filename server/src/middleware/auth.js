const { verifyToken } = require('../utils/jwt');
const redis = require('../config/redis');

async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ code: 401, message: '未登录' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ code: 401, message: '登录已过期' });
  }

  // 检查用户是否被封禁
  const db = require('../config/db');
  const userResult = await db.query('SELECT id, uid, status, is_public FROM users WHERE uid = $1', [payload.uid]);

  if (userResult.rows.length === 0) {
    return res.status(401).json({ code: 401, message: '用户不存在' });
  }

  if (userResult.rows[0].status === 1) {
    return res.status(403).json({ code: 403, message: '账号已被封禁' });
  }

  req.user = { ...payload, is_public: userResult.rows[0].is_public };
  next();
}

// Socket.IO 鉴权中间件
async function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth.token || socket.handshake.query.token;
  const deviceId = socket.handshake.auth.device_id || socket.handshake.query.device_id;

  if (!token) {
    return next(new Error('未登录'));
  }

  const payload = verifyToken(token);
  if (!payload) {
    return next(new Error('登录已过期'));
  }

  // 检查用户是否被封禁
  const db = require('../config/db');
  const userResult = await db.query('SELECT id, uid, nickname, avatar, status FROM users WHERE uid = $1', [payload.uid]);

  if (userResult.rows.length === 0) {
    return next(new Error('用户不存在'));
  }

  if (userResult.rows[0].status === 1) {
    return next(new Error('账号已被封禁'));
  }

  socket.user = userResult.rows[0];
  socket.deviceId = deviceId;
  next();
}

// 管理员鉴权
async function adminAuthMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ code: 401, message: '未登录' });
  }

  const payload = verifyToken(token);
  if (!payload || !payload.isAdmin) {
    return res.status(401).json({ code: 401, message: '无权限' });
  }

  req.admin = payload;
  next();
}

module.exports = {
  authMiddleware,
  socketAuthMiddleware,
  adminAuthMiddleware,
};
