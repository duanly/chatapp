-- 消息增加 @ 人的 UID 列表（JSON 数组）
ALTER TABLE messages ADD COLUMN IF NOT EXISTS mention_uids JSONB DEFAULT '[]'::jsonb;

-- 会话设置加 @ 未读数
ALTER TABLE conversation_settings ADD COLUMN IF NOT EXISTS mention_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_messages_mention ON messages USING GIN(mention_uids);
