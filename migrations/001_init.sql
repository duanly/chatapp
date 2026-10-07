-- 轻聊 PostgreSQL 初始化脚本

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  uid VARCHAR(64) UNIQUE NOT NULL,
  short_no VARCHAR(20) UNIQUE,
  phone VARCHAR(20) UNIQUE,
  nickname VARCHAR(50) NOT NULL DEFAULT '',
  avatar TEXT DEFAULT '',
  password VARCHAR(255) DEFAULT '',
  status INTEGER NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  device_lock BOOLEAN NOT NULL DEFAULT FALSE,
  device_id VARCHAR(64) DEFAULT '',
  remark VARCHAR(200) DEFAULT '',
  last_login_at TIMESTAMP,
  last_login_ip VARCHAR(45) DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  avatar TEXT DEFAULT '',
  owner_uid VARCHAR(64) NOT NULL,
  status INTEGER NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  member_count INTEGER NOT NULL DEFAULT 0,
  invite_code VARCHAR(20) UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL,
  uid VARCHAR(64) NOT NULL,
  role INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, uid)
);

CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(64) PRIMARY KEY,
  group_id INTEGER,
  from_uid VARCHAR(64) NOT NULL,
  to_uid VARCHAR(64),
  type INTEGER NOT NULL DEFAULT 1,
  content TEXT NOT NULL,
  mention_uids JSONB DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  uid VARCHAR(64) NOT NULL,
  type INTEGER NOT NULL,
  target_id VARCHAR(64) NOT NULL,
  last_msg TEXT DEFAULT '',
  last_msg_at TIMESTAMP,
  unread_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(uid, type, target_id)
);

CREATE TABLE IF NOT EXISTS robots (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  avatar TEXT DEFAULT '',
  api_key VARCHAR(128) UNIQUE NOT NULL,
  status INTEGER NOT NULL DEFAULT 0,
  biz_ws_url VARCHAR(255) DEFAULT '',
  enable_biz_ws BOOLEAN NOT NULL DEFAULT FALSE,
  watch_folder VARCHAR(500) DEFAULT '',
  enable_folder_watch BOOLEAN NOT NULL DEFAULT FALSE,
  image_extensions VARCHAR(200) DEFAULT '.png,.jpg,.jpeg,.gif,.webp,.bmp',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS robot_groups (
  id SERIAL PRIMARY KEY,
  robot_id INTEGER NOT NULL,
  group_id INTEGER NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(robot_id, group_id)
);

CREATE TABLE IF NOT EXISTS robot_message_logs (
  id BIGSERIAL PRIMARY KEY,
  robot_id INTEGER NOT NULL,
  group_id INTEGER,
  direction VARCHAR(10) NOT NULL,
  msg_type INTEGER NOT NULL DEFAULT 1,
  content TEXT,
  from_uid VARCHAR(64),
  from_nickname VARCHAR(50),
  msg_id VARCHAR(64),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  nickname VARCHAR(50) DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 用户登录日志
CREATE TABLE IF NOT EXISTS user_login_logs (
  id BIGSERIAL PRIMARY KEY,
  uid VARCHAR(64) NOT NULL,
  ip VARCHAR(45) DEFAULT '',
  ip_location VARCHAR(100) DEFAULT '',
  device_id VARCHAR(64) DEFAULT '',
  device_info TEXT DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_login_logs_uid ON user_login_logs(uid, created_at DESC);

-- 索引
CREATE INDEX IF NOT EXISTS idx_users_uid ON users(uid);
CREATE INDEX IF NOT EXISTS idx_users_short_no ON users(short_no);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_groups_owner_uid ON groups(owner_uid);
CREATE INDEX IF NOT EXISTS idx_groups_invite_code ON groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_group_members_uid ON group_members(uid);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_messages_single ON messages(from_uid, to_uid, id DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_uid ON conversations(uid);
CREATE INDEX IF NOT EXISTS idx_robot_message_logs_robot ON robot_message_logs(robot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_robot_groups_robot_id ON robot_groups(robot_id);
CREATE INDEX IF NOT EXISTS idx_robot_groups_group_id ON robot_groups(group_id);

-- 初始管理员：admin / admin123
INSERT INTO admins (username, password, nickname) VALUES
  ('admin', '$2a$10$EC3zlfL4dHLkbQkicL5f7u8wqcRCDwf1bDsvTOkoyWlnh0S7QP/w6', '超级管理员')
ON CONFLICT (username) DO NOTHING;
