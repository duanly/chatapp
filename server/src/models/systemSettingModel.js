const db = require('../config/db');

// 获取所有系统设置
async function getAll() {
  const result = await db.query('SELECT key, value FROM system_settings');
  const map = {};
  for (const row of result.rows) {
    try {
      map[row.key] = JSON.parse(row.value);
    } catch {
      map[row.key] = row.value;
    }
  }
  return map;
}

// 获取单个设置
async function get(key, defaultValue = null) {
  const result = await db.query('SELECT value FROM system_settings WHERE key = $1', [key]);
  if (result.rows.length === 0) return defaultValue;
  try {
    return JSON.parse(result.rows[0].value);
  } catch {
    return result.rows[0].value;
  }
}

// 设置单个值
async function set(key, value) {
  const val = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const result = await db.query(
    `INSERT INTO system_settings (key, value)
     VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
     RETURNING *`,
    [key, val]
  );
  return result.rows[0];
}

module.exports = {
  getAll,
  get,
  set,
};
