# 轻聊 Docker 部署说明

## 服务说明

使用 Nginx 统一入口（端口 80），通过路径区分不同服务：

| 路径 | 服务 | 说明 |
|------|------|------|
| `/` | web | H5 客户端（用户端） |
| `/admin/` | admin | 管理后台 |
| `/api/` | server | 后端 API |
| `/socket.io/` | server | WebSocket 连接 |
| 内部 | postgres | PostgreSQL 数据库（不对外暴露） |
| 内部 | redis | Redis 缓存（不对外暴露） |

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
docker-compose logs -f nginx

# 5. 停止
docker-compose down
```

## 访问地址

假设服务器 IP 为 `1.2.3.4`：

- **H5 客户端**：http://1.2.3.4/
- **管理后台**：http://1.2.3.4/admin/
- **后端 API**：http://1.2.3.4/api/v1/...
- **健康检查**：http://1.2.3.4/api/health

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
   - `serverUrl` 指向服务器地址：`http://服务器IP`（不带端口，走 Nginx 统一入口）
   - `apiKey` 在管理后台 → 机器人管理中获取
2. 运行：`npm start`（终端版）或 `npm run app`（桌面版）
3. 打包发布：`npm run build:mac` / `npm run build:win`

## 常用命令

```bash
# 查看所有服务状态
docker-compose ps

# 查看服务日志
docker-compose logs -f server
docker-compose logs -f nginx
docker-compose logs -f postgres

# 重启某个服务
docker-compose restart server

# 更新代码后重新构建
docker-compose up -d --build server nginx

# 只重新构建前端（web + admin）
docker-compose up -d --build nginx

# 重新构建全部
docker-compose up -d --build
```

## WebSocket 说明

Nginx 已配置 WebSocket 代理，支持长连接。相关配置：
- `proxy_read_timeout 3600s` — 1 小时无数据才断开（配合服务端心跳）
- `proxy_buffering off` — 关闭缓冲，消息实时到达
- 心跳间隔：服务端 15s，超时 20s

## HTTPS 配置（可选）

1. 将证书文件放到 `deploy/certs/` 目录下
2. 修改 `deploy/nginx.conf`，加上 443 server 块和证书配置
3. `docker-compose.yml` 取消 443 端口注释
4. 重启 nginx：`docker-compose up -d --build nginx`
