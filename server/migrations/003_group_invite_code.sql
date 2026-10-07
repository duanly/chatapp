-- 群邀请码字段（用于扫码加群）
ALTER TABLE groups ADD COLUMN IF NOT EXISTS invite_code VARCHAR(32) UNIQUE;

-- 给已有群生成邀请码
UPDATE groups SET invite_code = substr(md5(random()::text), 1, 8) WHERE invite_code IS NULL;
