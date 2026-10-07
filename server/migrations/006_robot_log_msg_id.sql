-- 机器人消息日志加消息ID和撤回标记
ALTER TABLE robot_message_logs ADD COLUMN IF NOT EXISTS msg_id BIGINT;
ALTER TABLE robot_message_logs ADD COLUMN IF NOT EXISTS withdrawn BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_robot_msg_logs_msg_id ON robot_message_logs(msg_id);
