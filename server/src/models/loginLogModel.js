const db = require('../config/db');
const { getIpLocation } = require('../utils/ipLocation');

// 记录登录日志（异步查询 IP 归属地，不阻塞登录流程）
async function addLog({ uid, ip, deviceId, deviceInfo = '' }) {
  try {
    // 先插入，IP 归属地后面异步更新
    const result = await db.query(
      `INSERT INTO user_login_logs (uid, ip, device_id, device_info)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [uid, ip || '', deviceId || '', deviceInfo]
    );

    // 异步查询 IP 归属地并更新
    const logId = result.rows[0].id;
    setImmediate(async () => {
      try {
        const location = await getIpLocation(ip);
        await db.query('UPDATE user_login_logs SET ip_location = $1 WHERE id = $2', [location, logId]);
      } catch (e) {
        console.error('update ip location failed:', e.message);
      }
    });

    return result.rows[0];
  } catch (e) {
    console.error('add login log failed:', e.message);
    return null;
  }
}

// 获取用户最近 N 次登录记录
async function getRecentLogs(uid, limit = 5) {
  const result = await db.query(
    `SELECT ip, ip_location, device_id, created_at
     FROM user_login_logs
     WHERE uid = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [uid, limit]
  );
  return result.rows;
}

module.exports = {
  addLog,
  getRecentLogs,
};
