-- 消息撤回字段
ALTER TABLE messages ADD COLUMN IF NOT EXISTS withdrawn BOOLEAN NOT NULL DEFAULT FALSE;

-- 会话设置表（置顶/标星）
CREATE TABLE IF NOT EXISTS conversation_settings (
  id BIGSERIAL PRIMARY KEY,
  uid VARCHAR(64) NOT NULL,
  conv_type SMALLINT NOT NULL, -- 1=单聊 2=群聊
  conv_id VARCHAR(64) NOT NULL, -- 对方UID 或 群ID
  is_pinned BOOLEAN DEFAULT FALSE,
  is_stared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(uid, conv_type, conv_id)
);
CREATE INDEX IF NOT EXISTS idx_conv_settings_uid ON conversation_settings(uid);
