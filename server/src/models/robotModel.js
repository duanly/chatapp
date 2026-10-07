const db = require('../config/db');
const { generateApiKey } = require('../utils/id');

// 获取机器人列表
async function list() {
  const result = await db.query('SELECT * FROM robots ORDER BY id DESC');
  return result.rows;
}

// 获取启用的机器人
async function getActiveRobots() {
  const result = await db.query('SELECT * FROM robots WHERE status = 1');
  return result.rows;
}

async function getById(id) {
  const result = await db.query('SELECT * FROM robots WHERE id = $1', [id]);
  return result.rows[0];
}

async function getByApiKey(apiKey) {
  const result = await db.query('SELECT * FROM robots WHERE api_key = $1', [apiKey]);
  return result.rows[0];
}

async function create({ name, avatar }) {
  const apiKey = generateApiKey();
  const result = await db.query(
    `INSERT INTO robots (name, avatar, api_key, status)
     VALUES ($1, $2, $3, 1)
     RETURNING *`,
    [name, avatar || '', apiKey]
  );
  return result.rows[0];
}

async function update(id, data) {
  const fields = [];
  const values = [];
  let index = 1;

  for (const [key, value] of Object.entries(data)) {
    const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    fields.push(`${dbKey} = $${index}`);
    values.push(value);
    index++;
  }

  values.push(id);
  values.push(new Date());

  const result = await db.query(
    `UPDATE robots SET ${fields.join(', ')}, updated_at = $${index + 1}
     WHERE id = $${index} RETURNING *`,
    values
  );
  return result.rows[0];
}

async function setStatus(id, status) {
  const result = await db.query(
    'UPDATE robots SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [status, id]
  );
  return result.rows[0];
}

// 机器人绑定群
async function bindGroup(robotId, groupId) {
  const existing = await db.query(
    'SELECT * FROM robot_groups WHERE robot_id = $1 AND group_id = $2',
    [robotId, groupId]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  const result = await db.query(
    `INSERT INTO robot_groups (robot_id, group_id)
     VALUES ($1, $2)
     RETURNING *`,
    [robotId, groupId]
  );
  return result.rows[0];
}

// 机器人解绑群
async function unbindGroup(robotId, groupId) {
  const result = await db.query(
    'DELETE FROM robot_groups WHERE robot_id = $1 AND group_id = $2 RETURNING *',
    [robotId, groupId]
  );
  return result.rows[0];
}

// 获取机器人绑定的群
async function getRobotGroups(robotId) {
  const result = await db.query(
    `SELECT g.id, g.name, g.avatar, g.status, g.member_count, g.created_at, g.updated_at,
            rg.id as bind_id, rg.robot_id, rg.group_id, rg.created_at as bind_created_at,
            g.name as group_name, g.avatar as group_avatar
     FROM robot_groups rg
     JOIN groups g ON rg.group_id = g.id
     WHERE rg.robot_id = $1`,
    [robotId]
  );
  return result.rows;
}

// 获取群绑定的机器人
async function getGroupRobots(groupId) {
  const result = await db.query(
    `SELECT r.id, r.name, r.avatar, r.api_key, r.status, r.created_at, r.updated_at,
            rg.id as bind_id, rg.robot_id, rg.group_id, rg.created_at as bind_created_at
     FROM robot_groups rg
     JOIN robots r ON rg.robot_id = r.id
     WHERE rg.group_id = $1 AND r.status = 1`,
    [groupId]
  );
  return result.rows;
}

module.exports = {
  list,
  getActiveRobots,
  getById,
  getByApiKey,
  create,
  update,
  setStatus,
  bindGroup,
  unbindGroup,
  getRobotGroups,
  getGroupRobots,
};
