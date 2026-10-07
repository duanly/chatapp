const Database = require('better-sqlite3');
const path = require('path');
const config = require('../config');

let db;

function getDb() {
  if (!db) {
    const dbPath = config.db.path || path.join(__dirname, '../../data.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    console.log('SQLite database connected:', dbPath);
  }
  return db;
}

// 兼容 pg 的 query 接口
function query(text, params = []) {
  const stmt = getDb().prepare(text);
  if (text.trim().toUpperCase().startsWith('SELECT') || text.trim().toUpperCase().startsWith('WITH')) {
    const rows = stmt.all(...params);
    return { rows, rowCount: rows.length };
  } else {
    const result = stmt.run(...params);
    return {
      rows: result.changes > 0 ? [{ id: result.lastInsertRowid }] : [],
      rowCount: result.changes,
    };
  }
}

function getClient() {
  // SQLite 是单线程的，不需要 client
  return {
    query: (text, params) => query(text, params),
    release: () => {},
  };
}

// 建表
function initTables() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT UNIQUE NOT NULL,
      short_no TEXT UNIQUE,
      phone TEXT UNIQUE,
      nickname TEXT NOT NULL DEFAULT '',
      avatar TEXT DEFAULT '',
      password TEXT DEFAULT '',
      status INTEGER NOT NULL DEFAULT 0,
      is_public INTEGER NOT NULL DEFAULT 0,
      device_lock INTEGER NOT NULL DEFAULT 0,
      device_id TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      last_login_at DATETIME,
      last_login_ip TEXT DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      avatar TEXT DEFAULT '',
      owner_uid TEXT NOT NULL,
      status INTEGER NOT NULL DEFAULT 0,
      member_count INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      uid TEXT NOT NULL,
      role INTEGER NOT NULL DEFAULT 0,
      joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(group_id, uid)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      group_id INTEGER,
      from_uid TEXT NOT NULL,
      to_uid TEXT,
      type INTEGER NOT NULL DEFAULT 1,
      content TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT NOT NULL,
      type INTEGER NOT NULL,
      target_id TEXT NOT NULL,
      last_msg TEXT DEFAULT '',
      last_msg_at DATETIME,
      unread_count INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(uid, type, target_id)
    );

    CREATE TABLE IF NOT EXISTS robots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      avatar TEXT DEFAULT '',
      api_key TEXT UNIQUE NOT NULL,
      status INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS robot_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      robot_id INTEGER NOT NULL,
      group_id INTEGER NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(robot_id, group_id)
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nickname TEXT DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_login_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT NOT NULL,
      ip TEXT DEFAULT '',
      ip_location TEXT DEFAULT '',
      device_id TEXT DEFAULT '',
      device_info TEXT DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS conversation_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT NOT NULL,
      conv_type INTEGER NOT NULL,
      conv_id TEXT NOT NULL,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      is_stared INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(uid, conv_type, conv_id)
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- 初始默认设置
    INSERT OR IGNORE INTO system_settings (key, value) VALUES
      ('app_name', '轻聊'),
      ('app_logo', ''),
      ('app_description', '轻聊 - 简洁的聊天应用');

    CREATE INDEX IF NOT EXISTS idx_user_login_logs_uid ON user_login_logs(uid, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_conv_settings_uid ON conversation_settings(uid);

    CREATE INDEX IF NOT EXISTS idx_users_uid ON users(uid);
    CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
    CREATE INDEX IF NOT EXISTS idx_groups_owner_uid ON groups(owner_uid);
    CREATE INDEX IF NOT EXISTS idx_group_members_uid ON group_members(uid);
    CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_id, id DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_single ON messages(from_uid, to_uid, id DESC);
    CREATE INDEX IF NOT EXISTS idx_conversations_uid ON conversations(uid);
  `);

  console.log('Database tables initialized');
}

module.exports = {
  query,
  getClient,
  initTables,
  getDb,
  pool: { query }, // 兼容 pg 写法
};
