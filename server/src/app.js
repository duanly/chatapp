const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const redis = require('./config/redis');
const db = require('./config/db');
const { socketAuthMiddleware } = require('./middleware/auth');
const robotAuthMiddleware = require('./middleware/robotAuth');
const socketHandler = require('./socket');

const app = express();
const server = http.createServer(app);

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: '*',
    credentials: true,
  },
  pingInterval: 25000,   // 25秒心跳一次，移动网络下更稳（NAT 超时一般 60s+）
  pingTimeout: 35000,    // 35秒没响应才认为断线，给网络抖动留余量
  maxHttpBufferSize: 10 * 1024 * 1024, // 10MB，支持大图传输
});

module.exports.io = io;

// 中间件
app.set('trust proxy', true); // 信任代理，获取真实 IP
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件：上传的文件
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ code: 0, message: 'OK', timestamp: Date.now() });
});

// HTTP 路由
app.use('/api/v1', require('./routes/user'));
app.use('/api/v1/groups', require('./routes/group'));
app.use('/api/v1/upload', require('./routes/upload'));
app.use('/api/v1/system', require('./routes/system'));
app.use('/api/admin', require('./routes/admin'));

// Socket.IO 中间件
io.use(socketAuthMiddleware);

// 机器人命名空间
const robotNsp = io.of('/robot');
robotNsp.use(robotAuthMiddleware);

// 初始化 Socket 事件
socketHandler.init(io);

// 错误处理
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ code: 500, message: '服务器内部错误' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ code: 404, message: 'Not Found' });
});

// 全局兜底：未捕获的异常和 Promise 拒绝不让进程退出，记日志就行
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

// 自动迁移：用 IF NOT EXISTS 安全地加字段和表
async function runMigrations() {
  try {
    console.log('Running migrations...');
    // 消息撤回字段
    await db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS withdrawn BOOLEAN NOT NULL DEFAULT FALSE`);
    console.log('  - messages.withdrawn: OK');

    // 会话设置表（置顶/标星）
    await db.query(`
      CREATE TABLE IF NOT EXISTS conversation_settings (
        id BIGSERIAL PRIMARY KEY,
        uid VARCHAR(64) NOT NULL,
        conv_type SMALLINT NOT NULL,
        conv_id VARCHAR(64) NOT NULL,
        is_pinned BOOLEAN DEFAULT FALSE,
        is_stared BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(uid, conv_type, conv_id)
      )
    `);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_conv_settings_uid ON conversation_settings(uid)`);
    console.log('  - conversation_settings: OK');

    console.log('Migrations done');
  } catch (err) {
    console.error('Migration failed:', err.message);
    // 迁移失败不退出，尽量让服务能起来
  }
}

// 启动
async function start() {
  try {
    // 连接 Redis（或内存 mock）
    await redis.connect();

    // 测试数据库
    if (config.db.type === 'postgres') {
      await db.query('SELECT 1');
      console.log('Database connected');
    }

    // 自动迁移（确保新增字段/表存在）
    await runMigrations();

    server.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      console.log(`Environment: ${config.env}`);
      console.log(`Database: ${config.db.type || 'sqlite'}`);
      console.log(`Health check: http://localhost:${config.port}/health`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
