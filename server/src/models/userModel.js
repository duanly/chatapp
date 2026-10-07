const db = require('../config/db');
const { generateUid, generateShortNo } = require('../utils/id');

async function findByUid(uid) {
  const result = await db.query('SELECT * FROM users WHERE uid = $1', [uid]);
  return result.rows[0];
}

async function findByPhone(phone) {
  const result = await db.query('SELECT * FROM users WHERE phone = $1', [phone]);
  return result.rows[0];
}

async function findByShortNo(shortNo) {
  const result = await db.query('SELECT * FROM users WHERE short_no = $1', [shortNo]);
  return result.rows[0];
}

async function create({ uid: customUid, shortNo, phone, nickname, avatar, password = '' }) {
  const uid = customUid || generateUid();
  // 自动生成短号，如果没传的话
  let finalShortNo = shortNo;
  if (!finalShortNo) {
    // 最多尝试 10 次生成唯一短号
    for (let i = 0; i < 10; i++) {
      const candidate = generateShortNo();
      const existing = await db.query('SELECT id FROM users WHERE short_no = $1', [candidate]);
      if (existing.rows.length === 0) {
        finalShortNo = candidate;
        break;
      }
    }
  }
  const result = await db.query(
    `INSERT INTO users (uid, short_no, phone, nickname, avatar, password)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [uid, finalShortNo || null, phone, nickname || '', avatar || '', password]
  );
  return result.rows[0];
}

async function update(uid, data) {
  const fields = [];
  const values = [];
  let index = 1;

  for (const [key, value] of Object.entries(data)) {
    const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
    fields.push(`${dbKey} = $${index}`);
    values.push(value);
    index++;
  }

  values.push(uid);
  values.push(new Date());

  const result = await db.query(
    `UPDATE users SET ${fields.join(', ')}, updated_at = $${index + 1}
     WHERE uid = $${index} RETURNING *`,
    values
  );
  return result.rows[0];
}

async function updateStatus(uid, status) {
  const result = await db.query(
    'UPDATE users SET status = $1, updated_at = NOW() WHERE uid = $2 RETURNING *',
    [status, uid]
  );
  return result.rows[0];
}

async function updateLastLogin(uid, loginIp) {
  if (loginIp) {
    await db.query('UPDATE users SET last_login_at = NOW(), last_login_ip = $1 WHERE uid = $2', [loginIp, uid]);
  } else {
    await db.query('UPDATE users SET last_login_at = NOW() WHERE uid = $1', [uid]);
  }
}

// 批量获取用户信息
async function getByUids(uids) {
  if (!uids || uids.length === 0) return [];
  const result = await db.query(
    'SELECT uid, short_no, phone, nickname, avatar, status FROM users WHERE uid = ANY($1)',
    [uids]
  );
  return result.rows;
}

// 搜索公开用户（给普通用户端用）
async function searchPublic(keyword, page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;
  const result = await db.query(
    `SELECT uid, short_no, nickname, avatar, is_public
     FROM users
     WHERE is_public = TRUE
       AND (nickname LIKE $1 OR uid LIKE $1 OR short_no LIKE $1)
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [`%${keyword}%`, pageSize, offset]
  );
  return result.rows;
}

// 分页获取用户列表（管理后台用，返回全部字段）
async function list(page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;
  const result = await db.query(
    `SELECT uid, short_no, phone, nickname, avatar, status, remark, is_public, device_lock, device_id, created_at, last_login_at, last_login_ip
     FROM users
     ORDER BY created_at DESC
     LIMIT $1 OFFSET $2`,
    [pageSize, offset]
  );
  const countResult = await db.query('SELECT COUNT(*) FROM users');
  return {
    list: result.rows,
    total: parseInt(countResult.rows[0].count),
    page,
    pageSize,
  };
}

// 获取所有公共用户
async function getPublicUsers() {
  const result = await db.query(
    'SELECT uid, short_no, nickname, avatar, is_public FROM users WHERE is_public = TRUE ORDER BY created_at DESC'
  );
  return result.rows;
}

// 设置用户公开/私有
async function setPublic(uid, isPublic) {
  const result = await db.query(
    'UPDATE users SET is_public = $1, updated_at = NOW() WHERE uid = $2 RETURNING *',
    [isPublic, uid]
  );
  return result.rows[0];
}

// 导入 tsdd 用户（如果已存在则跳过）
// TSDD 字段: uid, name(昵称), short_no(7位字母数字唯一标识), username(同phone), phone, password
async function importTsddUsers(users) {
  let successCount = 0;
  let skipCount = 0;
  const bcrypt = require('bcryptjs');

  for (const user of users) {
    // 优先用 uid，否则用 short_no
    const uid = user.uid || user.short_no || user.id;
    if (!uid) {
      skipCount++;
      continue;
    }

    const existing = await findByUid(uid);
    if (existing) {
      skipCount++;
      continue;
    }

    const phone = user.phone || user.username || '';
    const nickname = user.nickname || user.name || '';
    const password = user.password || '';
    const hashedPassword = password ? await bcrypt.hash(password, 10) : '';

    await create({
      uid,
      shortNo: user.short_no || null,
      phone,
      nickname,
      avatar: user.avatar || '',
      password: hashedPassword,
    });
    successCount++;
  }

  return { successCount, skipCount };
}

module.exports = {
  findByUid,
  findByPhone,
  findByShortNo,
  create,
  update,
  updateStatus,
  updateLastLogin,
  getByUids,
  search,
  searchPublic,
  list,
  getPublicUsers,
  setPublic,
  importTsddUsers,
};
