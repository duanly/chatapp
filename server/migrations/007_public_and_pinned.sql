-- 群加公共标志
ALTER TABLE groups ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

-- 用户加公共标志（公共账号/公众号）
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

-- 会话置顶/标星表（用户维度的会话设置）
CREATE TABLE IF NOT EXISTS conversation_settings (
  id BIGSERIAL PRIMARY KEY,
  uid VARCHAR(64) NOT NULL,
  conv_type SMALLINT NOT NULL, -- 1=单聊 2=群聊
  conv_id VARCHAR(64) NOT NULL, -- 对方UID 或 群ID
  is_pinned BOOLEAN DEFAULT FALSE, -- 是否置顶
  is_stared BOOLEAN DEFAULT FALSE, -- 是否标星
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(uid, conv_type, conv_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_settings_uid ON conversation_settings(uid);
