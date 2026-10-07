const db = require('../config/db');

// 获取用户的所有会话设置
async function getByUser(uid) {
  const result = await db.query(
    'SELECT * FROM conversation_settings WHERE uid = $1',
    [uid]
  );
  return result.rows;
}

// 获取单个会话的设置
async function getOne(uid, convType, convId) {
  const result = await db.query(
    'SELECT * FROM conversation_settings WHERE uid = $1 AND conv_type = $2 AND conv_id = $3',
    [uid, convType, convId]
  );
  return result.rows[0];
}

// 置顶/取消置顶
async function setPinned(uid, convType, convId, isPinned) {
  const result = await db.query(
    `INSERT INTO conversation_settings (uid, conv_type, conv_id, is_pinned)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (uid, conv_type, conv_id)
     DO UPDATE SET is_pinned = $4, updated_at = NOW()
     RETURNING *`,
    [uid, convType, convId, isPinned]
  );
  return result.rows[0];
}

// 标星/取消标星
async function setStared(uid, convType, convId, isStared) {
  const result = await db.query(
    `INSERT INTO conversation_settings (uid, conv_type, conv_id, is_stared)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (uid, conv_type, conv_id)
     DO UPDATE SET is_stared = $4, updated_at = NOW()
     RETURNING *`,
    [uid, convType, convId, isStared]
  );
  return result.rows[0];
}

module.exports = {
  getByUser,
  getOne,
  setPinned,
  setStared,
};
