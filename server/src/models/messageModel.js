const db = require('../config/db');
const { generateId } = require('../utils/id');

// 发送消息
async function send({ groupId, fromUid, toUid, type, content, mentionUids = [] }) {
  const id = generateId();
  const result = await db.query(
    `INSERT INTO messages (id, group_id, from_uid, to_uid, type, content, mention_uids)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [id, groupId || null, fromUid, toUid || null, type, content, JSON.stringify(mentionUids || [])]
  );
  return result.rows[0];
}

// 获取群消息历史
async function getGroupMessages(groupId, beforeId = null, limit = 50) {
  let query = `
    SELECT m.*,
      u.nickname as from_nickname, u.avatar as from_avatar, u.short_no as from_short_no,
      r.name as robot_name, r.avatar as robot_avatar,
      CASE WHEN m.from_uid LIKE 'robot:%' THEN TRUE ELSE FALSE END as is_robot
    FROM messages m
    LEFT JOIN users u ON m.from_uid = u.uid
    LEFT JOIN robots r ON m.from_uid = 'robot:' || r.id::text
    WHERE m.group_id = $1
  `;
  const params = [groupId];

  if (beforeId) {
    query += ` AND m.id < $2`;
    params.push(bigintSafe(beforeId));
  }

  query += ` ORDER BY m.id DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await db.query(query, params);
  // 处理机器人消息的昵称和头像
  const rows = result.rows.map(row => {
    if (row.is_robot) {
      return { ...row, from_nickname: row.robot_name, from_avatar: row.robot_avatar };
    }
    return row;
  });
  return rows.reverse(); // 按时间正序返回
}

// 获取单聊消息历史
async function getSingleMessages(uid1, uid2, beforeId = null, limit = 50) {
  let query = `
    SELECT m.*, u.nickname as from_nickname, u.avatar as from_avatar, u.short_no as from_short_no
    FROM messages m
    JOIN users u ON m.from_uid = u.uid
    WHERE ((m.from_uid = $1 AND m.to_uid = $2) OR (m.from_uid = $2 AND m.to_uid = $1))
      AND m.group_id IS NULL
  `;
  const params = [uid1, uid2];

  if (beforeId) {
    query += ` AND m.id < $3`;
    params.push(bigintSafe(beforeId));
  }

  query += ` ORDER BY m.id DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await db.query(query, params);
  return result.rows.reverse();
}

// 获取消息详情
async function getById(id) {
  const result = await db.query('SELECT * FROM messages WHERE id = $1', [bigintSafe(id)]);
  return result.rows[0];
}

// 撤回消息（只允许撤回自己发的、2分钟内的）
async function withdraw(id, fromUid) {
  // 先查消息
  const msg = await getById(id);
  if (!msg) return { success: false, message: '消息不存在' };
  if (msg.from_uid !== fromUid) return { success: false, message: '只能撤回自己的消息' };
  if (msg.withdrawn) return { success: false, message: '消息已撤回' };

  // 用数据库时间判断：2分钟内可撤回（避免 JS 时区问题）
  const checkResult = await db.query(
    `SELECT (EXTRACT(EPOCH FROM (NOW() - created_at)) * 1000) as diff_ms
     FROM messages WHERE id = $1`,
    [bigintSafe(id)]
  );
  const diffMs = parseFloat(checkResult.rows[0]?.diff_ms || 0);
  console.log(`[withdraw] id=${id}, diff from DB = ${diffMs}ms`);

  if (diffMs > 2 * 60 * 1000) {
    return { success: false, message: '超过撤回时限' };
  }

  const result = await db.query(
    'UPDATE messages SET withdrawn = TRUE WHERE id = $1 RETURNING *',
    [bigintSafe(id)]
  );
  return { success: true, message: result.rows[0] };
}

// 管理后台搜索消息
async function search({ keyword, uid, groupId, page = 1, pageSize = 20 }) {
  const offset = (page - 1) * pageSize;
  let where = [];
  let params = [];
  let index = 1;

  if (keyword) {
    where.push(`m.content LIKE $${index}`);
    params.push(`%${keyword}%`);
    index++;
  }
  if (uid) {
    where.push(`m.from_uid = $${index}`);
    params.push(uid);
    index++;
  }
  if (groupId) {
    where.push(`m.group_id = $${index}`);
    params.push(groupId);
    index++;
  }

  const whereStr = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const result = await db.query(
    `SELECT m.*, u.nickname as from_nickname, g.name as group_name
     FROM messages m
     LEFT JOIN users u ON m.from_uid = u.uid
     LEFT JOIN groups g ON m.group_id = g.id
     ${whereStr}
     ORDER BY m.id DESC
     LIMIT $${index} OFFSET $${index + 1}`,
    [...params, pageSize, offset]
  );

  const countResult = await db.query(
    `SELECT COUNT(*) FROM messages m ${whereStr}`,
    params
  );

  return {
    list: result.rows,
    total: parseInt(countResult.rows[0].count),
    page,
    pageSize,
  };
}

// bigint 安全处理（pg 驱动的 bigint 是字符串）
function bigintSafe(val) {
  return typeof val === 'bigint' ? val.toString() : val;
}

module.exports = {
  send,
  getGroupMessages,
  getSingleMessages,
  getById,
  withdraw,
  search,
};
