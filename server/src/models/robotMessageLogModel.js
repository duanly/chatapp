const db = require('../config/db');

// 记录一条机器人消息日志
async function addLog({ robotId, groupId, direction, msgType = 1, content, fromUid = null, fromNickname = null, msgId = null }) {
  const result = await db.query(
    `INSERT INTO robot_message_logs (robot_id, group_id, direction, msg_type, content, from_uid, from_nickname, msg_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [robotId, groupId, direction, msgType, content || '', fromUid, fromNickname, msgId || null]
  );
  return result.rows[0];
}

// 获取机器人消息日志（分页）
async function getLogs({ robotId, groupId, direction, page = 1, pageSize = 50 }) {
  const offset = (page - 1) * pageSize;
  const where = [];
  const values = [];
  let idx = 1;

  if (robotId) {
    where.push(`rml.robot_id = $${idx}`);
    values.push(robotId);
    idx++;
  }
  if (groupId) {
    where.push(`rml.group_id = $${idx}`);
    values.push(groupId);
    idx++;
  }
  if (direction) {
    where.push(`rml.direction = $${idx}`);
    values.push(direction);
    idx++;
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const countResult = await db.query(
    `SELECT COUNT(*) FROM robot_message_logs rml ${whereSql}`,
    values
  );

  const listResult = await db.query(
    `SELECT rml.id, rml.robot_id, rml.group_id, rml.direction, rml.msg_type,
            rml.content, rml.from_uid, rml.from_nickname, rml.msg_id, rml.withdrawn,
            to_char(rml.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD HH24:MI:SS') as created_at,
            g.name as group_name, r.name as robot_name
     FROM robot_message_logs rml
     LEFT JOIN groups g ON rml.group_id = g.id
     LEFT JOIN robots r ON rml.robot_id = r.id
     ${whereSql}
     ORDER BY rml.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...values, pageSize, offset]
  );

  return {
    list: listResult.rows,
    total: parseInt(countResult.rows[0].count),
    page,
    pageSize,
  };
}

// 标记某条消息的日志为已撤回（按 msg_id 匹配）
async function markWithdrawn(groupId, msgId) {
  const result = await db.query(
    `UPDATE robot_message_logs SET withdrawn = TRUE
     WHERE group_id = $1 AND msg_id = $2
     RETURNING *`,
    [groupId, msgId]
  );
  return result.rows;
}

module.exports = {
  addLog,
  getLogs,
  markWithdrawn,
};
