# Chatapp - 轻量级 H5 聊天系统

200 人规模的轻量 H5 聊天应用，支持单聊、群聊、机器人、设备锁等功能。

## 技术栈

- **后端**: Node.js + Express + Socket.IO
- **前端 H5**: Vue 3 + Vant UI + Pinia
- **管理后台**: Vue 3 + Element Plus
- **数据库**: PostgreSQL
- **缓存**: Redis
- **文件存储**: 阿里云 OSS
- **反向代理**: Nginx

## 功能特性

- ✅ 单聊 / 群聊
- ✅ 文字 / 图片 / 表情消息
- ✅ 设备锁（单设备在线）
- ✅ 群管理（开门/关门、成员管理）
- ✅ 用户封禁 / 解封
- ✅ 机器人（WebSocket 双向收发，可绑定多群）
- ✅ 管理后台（查看聊天记录、用户管理）
- ✅ 兼容导入 tsdd 用户数据
- ✅ 阿里云 OSS 图片直传

## 项目结构

```
chatapp/
├── server/          # 后端服务
├── web/             # H5 前端
├── admin/           # 管理后台
├── docker-compose.yml
└── README.md
```

## 快速开始

### 1. 启动数据库

```bash
docker-compose up -d postgres redis
```

### 2. 后端

```bash
cd server
cp .env.example .env
npm install
npm run migrate
npm run dev
```

### 3. 前端 H5

```bash
cd web
npm install
npm run dev
```

### 4. 管理后台

```bash
cd admin
npm install
npm run dev
```

## 部署

使用 Nginx 反代，配置示例见 `server/nginx.conf.example`。
