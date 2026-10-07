# 轻聊 Caddy 部署说明（systemd）

## 前置条件

- 服务器已安装 Caddy（systemd 管理）
- 已安装 Docker + docker-compose
- 域名已解析到服务器

## 一、Docker 启动后端服务

```bash
cd /opt/chatapp

# 启动（只暴露本地端口，不对外）
docker-compose up -d --build

# 确认都起来了
docker-compose ps
```

三个服务只监听本地：
- web → `127.0.0.1:8088`
- admin → `127.0.0.1:8089`（自带 `/admin/` 前缀）
- server → `127.0.0.1:3001`

## 二、配置 Caddy

### 1. 复制配置文件

```bash
cp deploy/Caddyfile /etc/caddy/conf.d/chatapp.conf
```

### 2. 修改域名

把 `chatapp.yourdomain.com` 改成你实际的域名。

### 3. 重载 Caddy

```bash
systemctl reload caddy
```

## 三、访问地址

假设域名为 `chatapp.yourdomain.com`：

- **H5 客户端**：https://chatapp.yourdomain.com/
- **管理后台**：https://chatapp.yourdomain.com/admin/
- **API**：https://chatapp.yourdomain.com/api/v1/...
- **健康检查**：https://chatapp.yourdomain.com/api/health

Caddy 自动申请和续期 HTTPS 证书。

## 四、初始账号

- **管理后台**：用户名 `admin`，密码 `admin123`
  - 登录后请立即修改密码！

- **H5 客户端**：注册账号即可使用

## 五、常用命令

```bash
# 重载 Caddy 配置
systemctl reload caddy

# 查看 Caddy 状态
systemctl status caddy

# 查看 Caddy 日志
journalctl -u caddy -f --since today

# 查看 Docker 服务日志
docker-compose logs -f server
docker-compose logs -f web
docker-compose logs -f admin
```

## 六、说明

- **WebSocket**：Caddy 自动识别并处理，无需额外配置
- **上传大小**：admin 和 web 的 Nginx 已设 20M，Caddy 默认不限制
- **HTTPS**：Caddy 自动申请 Let's Encrypt 证书，自动续期

## 七、机器人客户端

机器人客户端是桌面应用，不在服务器上跑。

1. 修改 `robot-client/config.js`
   - `serverUrl`：`https://chatapp.yourdomain.com`（Caddy 统一入口）
   - `apiKey`：管理后台 → 机器人管理中获取
2. 本地运行：`npm run app`
