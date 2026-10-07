-- 机器人消息日志表
CREATE TABLE IF NOT EXISTS robot_message_logs (
  id BIGSERIAL PRIMARY KEY,
  robot_id INTEGER NOT NULL,
  group_id INTEGER NOT NULL,
  direction VARCHAR(10) NOT NULL, -- in: 机器人收到的消息(群里用户发的) / out: 机器人发出的消息
  msg_type INTEGER DEFAULT 1, -- 1:文字 2:图片 3:文件
  content TEXT,
  from_uid VARCHAR(64), -- 收到的消息: 发送者UID; 发出的消息: 空
  from_nickname VARCHAR(100), -- 发送者昵称(冗余，方便展示)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_robot_msg_logs_robot_id ON robot_message_logs(robot_id);
CREATE INDEX IF NOT EXISTS idx_robot_msg_logs_group_id ON robot_message_logs(group_id);
CREATE INDEX IF NOT EXISTS idx_robot_msg_logs_created_at ON robot_message_logs(created_at DESC);
