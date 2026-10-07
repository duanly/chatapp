const robotModel = require('../models/robotModel');
const redis = require('../config/redis');

// 机器人 Socket 鉴权中间件
async function robotAuthMiddleware(socket, next) {
  const apiKey = socket.handshake.auth.api_key || socket.handshake.query.api_key;

  if (!apiKey) {
    return next(new Error('缺少 api_key'));
  }

  const robot = await robotModel.getByApiKey(apiKey);
  if (!robot) {
    return next(new Error('api_key 无效'));
  }

  if (robot.status !== 1) {
    return next(new Error('机器人已停用'));
  }

  socket.robot = robot;
  next();
}

module.exports = robotAuthMiddleware;
