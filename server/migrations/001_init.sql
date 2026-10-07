-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  uid VARCHAR(64) UNIQUE NOT NULL,
  short_no VARCHAR(20) UNIQUE, -- 短号，7位字母数字组合
  phone VARCHAR(20) UNIQUE,
  nickname VARCHAR(50) NOT NULL DEFAULT '',
  avatar VARCHAR(255) DEFAULT '',
  password VARCHAR(255) DEFAULT '',
  status SMALLINT NOT NULL DEFAULT 0, -- 0=正常 1=封禁
  remark VARCHAR(255) DEFAULT '', -- 管理员备注
  last_login_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_uid ON users(uid);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- 群聊表
CREATE TABLE IF NOT EXISTS groups (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  avatar VARCHAR(255) DEFAULT '',
  owner_uid VARCHAR(64) NOT NULL,
  status SMALLINT NOT NULL DEFAULT 0, -- 0=开门 1=关门
  member_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_groups_owner_uid ON groups(owner_uid);

-- 群成员表
CREATE TABLE IF NOT EXISTS group_members (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT NOT NULL,
  uid VARCHAR(64) NOT NULL,
  role SMALLINT NOT NULL DEFAULT 0, -- 0=成员 1=管理员 2=群主
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_members_uid_group ON group_members(group_id, uid);
CREATE INDEX IF NOT EXISTS idx_group_members_uid ON group_members(uid);

-- 消息表
CREATE TABLE IF NOT EXISTS messages (
  id BIGINT PRIMARY KEY,
  group_id BIGINT, -- 群聊消息
  from_uid VARCHAR(64) NOT NULL,
  to_uid VARCHAR(64), -- 单聊消息
  type SMALLINT NOT NULL DEFAULT 1, -- 1=文字 2=图片 3=语音 4=系统消息
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_messages_single ON messages(from_uid, to_uid, id DESC);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- 会话表
CREATE TABLE IF NOT EXISTS conversations (
  id BIGSERIAL PRIMARY KEY,
  uid VARCHAR(64) NOT NULL,
  type SMALLINT NOT NULL, -- 1=单聊 2=群聊
  target_id VARCHAR(64) NOT NULL, -- 对方uid或群ID
  last_msg VARCHAR(255) DEFAULT '',
  last_msg_at TIMESTAMP,
  unread_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_uid_target ON conversations(uid, type, target_id);
CREATE INDEX IF NOT EXISTS idx_conversations_uid ON conversations(uid);

-- 机器人表
CREATE TABLE IF NOT EXISTS robots (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  avatar VARCHAR(255) DEFAULT '',
  api_key VARCHAR(64) UNIQUE NOT NULL,
  status SMALLINT NOT NULL DEFAULT 0, -- 0=停用 1=启用
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 机器人-群绑定表
CREATE TABLE IF NOT EXISTS robot_groups (
  id BIGSERIAL PRIMARY KEY,
  robot_id BIGINT NOT NULL,
  group_id BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_robot_groups ON robot_groups(robot_id, group_id);

-- 管理员表
CREATE TABLE IF NOT EXISTS admins (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  nickname VARCHAR(50) DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
