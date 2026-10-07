# 轻聊 Docker 部署说明

## 服务说明

| 服务 | 端口 | 说明 |
|------|------|------|
| postgres | 5432 | PostgreSQL 数据库 |
| redis | 6379 | Redis 缓存 |
| server | 3000 | 后端 API + WebSocket |
| web | 8080 | H5 客户端（用户端） |
| admin | 8081 | 管理后台 |

## 快速部署

```bash
# 1. 克隆项目
git clone <repo> && cd chatapp

# 2. 修改配置（重要！）
# 编辑 docker-compose.yml，修改以下环境变量：
#   JWT_SECRET - 改为随机字符串
#   数据库密码（可选修改）
#   OSS 配置（可选，不配置用本地存储）

# 3. 构建并启动
docker-compose up -d --build

# 4. 查看日志
docker-compose logs -f server

# 5. 停止
docker-compose down
```

## 初始账号

- **管理后台**: http://服务器IP:8081
  - 用户名：`admin`
  - 密码：`admin123`
  - 登录后请立即修改密码！

- **H5 客户端**: http://服务器IP:8080
  - 注册账号即可使用

## 数据持久化

- PostgreSQL 数据：`postgres_data` 卷
- Redis 数据：`redis_data` 卷
- 上传的图片：`uploads_data` 卷（仅未配置 OSS 时使用）

## 配置 OSS（推荐）

编辑 `docker-compose.yml` 的 server 服务环境变量，去掉注释并填入：

```yaml
OSS_REGION: oss-cn-guangzhou
OSS_BUCKET: your-bucket-name
OSS_ACCESS_KEY_ID: your-access-key-id
OSS_ACCESS_KEY_SECRET: your-access-key-secret
OSS_DOMAIN: https://cdn.yourdomain.com   # 自定义域名，可选
```

然后重启：`docker-compose up -d server`

## 机器人客户端

机器人客户端是桌面应用（Electron），不在 Docker 中运行。在需要运行机器人的机器上单独运行：

1. 修改 `robot-client/config.js`
   - `serverUrl` 指向服务器地址：`http://服务器IP:3000`
   - `apiKey` 在管理后台 → 机器人管理中获取
2. 运行：`npm start` 或 `npm run app`（桌面版）

## 常用命令

```bash
# 查看所有服务状态
docker-compose ps

# 查看服务日志
docker-compose logs -f server
docker-compose logs -f web

# 重启某个服务
docker-compose restart server

# 更新代码后重新构建
docker-compose up -d --build server web admin
```
