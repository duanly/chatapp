# 轻聊 Docker 部署说明

## 服务说明

| 服务 | 端口 | 说明 |
|------|------|------|
| postgres | 内部（5432） | PostgreSQL 数据库（不对外暴露） |
| redis | 内部（6379） | Redis 缓存（不对外暴露） |
| server | 3001 | 后端 API + WebSocket |
| web | 8088 | H5 客户端（用户端） |
| admin | 8089 | 管理后台 |

web 和 admin 自带 Nginx 反向代理，API 请求会自动转发到 server。

## 快速部署

```bash
# 1. 克隆项目
git clone <repo> && cd chatapp

# 2. 修改配置（重要！）
# 编辑 docker-compose.yml，修改以下环境变量：
#   JWT_SECRET - 改为随机字符串（必须改！）
#   数据库密码（可选修改，postgres + server 两处要一致）
#   OSS 配置（可选，不配置用本地存储）

# 3. 构建并启动
docker-compose up -d --build

# 4. 查看日志
docker-compose logs -f server
docker-compose logs -f web
docker-compose logs -f admin

# 5. 停止
docker-compose down
```

## 访问地址

假设服务器 IP 为 `1.2.3.4`：

- **H5 客户端**：http://1.2.3.4:8088/
- **管理后台**：http://1.2.3.4:8089/
- **后端 API**：http://1.2.3.4:3001/api/v1/...
- **健康检查**：http://1.2.3.4:3001/health

## 初始账号

- **管理后台**：用户名 `admin`，密码 `admin123`
  - 登录后请立即修改密码！

- **H5 客户端**：注册账号即可使用

## 数据持久化

- PostgreSQL 数据：`postgres_data` Docker 卷
- Redis 数据：`redis_data` Docker 卷
- 上传的图片：`uploads_data` Docker 卷（仅未配置 OSS 时使用）

## 配置 OSS（推荐）

编辑 `docker-compose.yml` 的 server 服务环境变量，去掉注释并填入：

```yaml
OSS_REGION: oss-cn-guangzhou
OSS_BUCKET: your-bucket-name
OSS_ACCESS_KEY_ID: your-access-key-id
OSS_ACCESS_KEY_SECRET: your-access-key-secret
OSS_DOMAIN: https://cdn.yourdomain.com   # 自定义域名，可选
```

然后重启：`docker-compose up -d --build server`

## 机器人客户端

机器人客户端是桌面应用（Electron），不在 Docker 中运行。

1. 修改 `robot-client/config.js`
   - `serverUrl` 指向服务器地址：`http://服务器IP:3001`
   - `apiKey` 在管理后台 → 机器人管理中获取
2. 运行：`npm start`（终端版）或 `npm run app`（桌面版）
3. 打包发布：`npm run build:mac` / `npm run build:win`

## 常用命令

```bash
# 查看所有服务状态
docker-compose ps

# 查看服务日志
docker-compose logs -f server
docker-compose logs -f web
docker-compose logs -f admin
docker-compose logs -f postgres

# 重启某个服务
docker-compose restart server

# 更新代码后重新构建
docker-compose up -d --build server web admin

# 只重新构建前端
docker-compose up -d --build web admin

# 重新构建全部
docker-compose up -d --build
```

## WebSocket 说明

- 服务端心跳：15s 间隔，20s 超时
- 客户端自动重连：指数退避，无限重试
- web/admin 的 Nginx 已配置 WebSocket 代理（`proxy_read_timeout 3600s`）

## 常见问题

### 上传图片报 413
Nginx 默认上传限制已设为 20M。如果还不够，修改 `web/nginx.conf` 和 `admin/nginx.conf` 里的 `client_max_body_size`，然后 `docker-compose up -d --build web admin`。

### 上传图片报 403
检查是否登录态有效，token 是否正确。管理后台的上传走 `/api/admin/upload`，用管理员 token 鉴权。

### 数据库表不存在
首次部署会自动执行 `migrations/` 目录下的 SQL。如果是升级部署，需要手动执行迁移：
```bash
docker-compose exec postgres psql -U chatapp -d chatapp -f /docker-entrypoint-initdb.d/001_init.sql
```
