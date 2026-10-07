const crypto = require('crypto');

// 生成雪花算法 ID（简化版，单机够用）
let snowflakeSequence = 0;
let lastTimestamp = 0;

function generateId() {
  const epoch = 1704067200000; // 2024-01-01 00:00:00
  let timestamp = Date.now() - epoch;

  if (timestamp === lastTimestamp) {
    snowflakeSequence = (snowflakeSequence + 1) & 4095;
    if (snowflakeSequence === 0) {
      timestamp++;
    }
  } else {
    snowflakeSequence = 0;
  }

  lastTimestamp = timestamp;

  // 时间戳(42位) + 机器ID(5位) + 序列号(12位)
  const id = (BigInt(timestamp) << 17n) | (1n << 12n) | BigInt(snowflakeSequence);
  return id.toString();
}

function generateUid() {
  return crypto.randomBytes(16).toString('hex');
}

// 生成 7 位短号（字母数字组合，全小写）
function generateShortNo() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 7; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

// 生成 6 位数字验证码
function generateSmsCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

module.exports = {
  generateId,
  generateUid,
  generateShortNo,
  generateApiKey,
  generateSmsCode,
};
