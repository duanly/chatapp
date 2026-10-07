const db = require('../config/db');

// 生成8位随机邀请码
function generateInviteCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

// 获取群信息
async function getById(id) {
  const result = await db.query('SELECT * FROM groups WHERE id = $1', [id]);
  return result.rows[0];
}

// 通过邀请码获取群
async function getByInviteCode(code) {
  const result = await db.query('SELECT * FROM groups WHERE invite_code = $1', [code]);
  return result.rows[0];
}

// 创建群
async function create({ name, avatar, ownerUid }) {
  // 生成唯一邀请码
  let inviteCode;
  let tries = 0;
  while (tries < 10) {
    inviteCode = generateInviteCode();
    const existing = await db.query('SELECT id FROM groups WHERE invite_code = $1', [inviteCode]);
    if (existing.rows.length === 0) break;
    tries++;
  }

  const result = await db.query(
    `INSERT INTO groups (name, avatar, owner_uid, member_count, invite_code)
     VALUES ($1, $2, $3, 1, $4)
     RETURNING *`,
    [name, avatar || '', ownerUid, inviteCode]
  );

  const group = result.rows[0];

  // 群主加入群
  await db.query(
    `INSERT INTO group_members (group_id, uid, role)
     VALUES ($1, $2, 2)`,
    [group.id, ownerUid]
  );

  return group;
}

// 更新群信息
async function update(id, data) {
  const fields = [];
  const values = [];
  let index = 1;

  for (const [key, value] of Object.entries(data)) {
    fields.push(`${key} = $${index}`);
    values.push(value);
    index++;
  }

  values.push(id);
  values.push(new Date());

  const result = await db.query(
    `UPDATE groups SET ${fields.join(', ')}, updated_at = $${index + 1}
     WHERE id = $${index} RETURNING *`,
    values
  );
  return result.rows[0];
}

// 群开门/关门
async function setStatus(id, status) {
  const result = await db.query(
    'UPDATE groups SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [status, id]
  );
  return result.rows[0];
}

// 获取用户的群列表（包含公共群，公共群自动出现在列表里）
async function getByUser(uid) {
  const result = await db.query(
    `SELECT g.*, gm.role as member_role,
       CASE WHEN gm.uid IS NOT NULL THEN TRUE ELSE FALSE END as is_member
     FROM groups g
     LEFT JOIN group_members gm ON g.id = gm.group_id AND gm.uid = $1
     WHERE gm.uid IS NOT NULL OR g.is_public = TRUE
     ORDER BY g.updated_at DESC`,
    [uid]
  );
  return result.rows;
}

// 获取所有公共群
async function getPublicGroups() {
  const result = await db.query(
    'SELECT * FROM groups WHERE is_public = TRUE ORDER BY created_at DESC'
  );
  return result.rows;
}

// 设置群公开/私有
async function setPublic(id, isPublic) {
  const result = await db.query(
    'UPDATE groups SET is_public = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [isPublic, id]
  );
  return result.rows[0];
}

// 解散群（删除群及其成员关系）
async function disband(id) {
  // 删除群成员
  await db.query('DELETE FROM group_members WHERE group_id = $1', [id]);
  // 删除群
  const result = await db.query('DELETE FROM groups WHERE id = $1 RETURNING *', [id]);
  return result.rows[0];
}

// 添加成员
async function addMember(groupId, uid, role = 0) {
  // 检查群是否关门
  const group = await getById(groupId);
  if (!group) throw new Error('群不存在');
  if (group.status === 1) throw new Error('群已关门，无法添加成员');

  // 检查是否已在群里
  const existing = await db.query(
    'SELECT * FROM group_members WHERE group_id = $1 AND uid = $2',
    [groupId, uid]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const result = await db.query(
    `INSERT INTO group_members (group_id, uid, role)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [groupId, uid, role]
  );

  // 更新成员数
  await db.query(
    'UPDATE groups SET member_count = member_count + 1 WHERE id = $1',
    [groupId]
  );

  return result.rows[0];
}

// 移除成员
async function removeMember(groupId, uid) {
  const result = await db.query(
    'DELETE FROM group_members WHERE group_id = $1 AND uid = $2 RETURNING *',
    [groupId, uid]
  );

  if (result.rows.length > 0) {
    await db.query(
      'UPDATE groups SET member_count = member_count - 1 WHERE id = $1',
      [groupId]
    );
  }

  return result.rows[0];
}

// 检查是否是群成员
// - 私有群：必须在 group_members 里才算
// - 公共群且开门：所有人都算成员（可以看消息、发消息）
// - 公共群但关门：只有真正在 group_members 里的才算
// 检查是否是实际成员（只查 group_members 表，不考虑公共群逻辑）
async function isActualMember(groupId, uid) {
  const result = await db.query(
    'SELECT * FROM group_members WHERE group_id = $1 AND uid = $2',
    [groupId, uid]
  );
  return result.rows.length > 0;
}

// 检查是否是成员（公共群+开门则所有人都算成员，用于权限判断）
async function isMember(groupId, uid) {
  // 先查群信息
  const group = await getById(groupId);
  if (!group) return false;

  // 公共群且开门：所有人都算成员
  if (group.is_public && group.status === 0) return true;

  // 否则查 group_members
  return isActualMember(groupId, uid);
}

// 获取群成员列表
async function getMembers(groupId) {
  const result = await db.query(
    `SELECT gm.*, u.nickname, u.avatar, u.status, u.short_no, u.is_public
     FROM group_members gm
     JOIN users u ON gm.uid = u.uid
     WHERE gm.group_id = $1
     ORDER BY gm.role DESC, gm.joined_at ASC`,
    [groupId]
  );
  return result.rows;
}

// 获取群成员 UID 列表
async function getMemberUids(groupId) {
  const result = await db.query(
    'SELECT uid FROM group_members WHERE group_id = $1',
    [groupId]
  );
  return result.rows.map(r => r.uid);
}

// 获取所有群列表
async function list(page = 1, pageSize = 1000) {
  const offset = (page - 1) * pageSize;
  const result = await db.query(
    'SELECT id, name, avatar, is_public, status, created_at FROM groups ORDER BY id DESC LIMIT $1 OFFSET $2',
    [pageSize, offset]
  );
  return result.rows;
}

module.exports = {
  getById,
  getByInviteCode,
  create,
  update,
  setStatus,
  setPublic,
  getByUser,
  getPublicGroups,
  addMember,
  removeMember,
  isMember,
  isActualMember,
  getMembers,
  getMemberUids,
  disband,
  list,
};
