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
- admin → `127.0.0.1:8089`
- server → `127.0.0.1:3001`

## 二、配置 Caddy

### 1. 复制配置文件

```bash
cp deploy/Caddyfile /etc/caddy/conf.d/chatapp.conf
```

### 2. 修改域名

把 `chatapp.yourdomain.com`、`admin.yourdomain.com`、`api.yourdomain.com` 改成你实际的域名。

### 3. 重载 Caddy

```bash
systemctl reload caddy
# 或
caddy reload --config /etc/caddy/Caddyfile
```

## 三、Caddy 配置说明

### 方案 A：三个子域名（推荐）

`deploy/Caddyfile` 默认是这个方案：

- `chatapp.example.com` → H5 客户端（web:8088）
- `admin.example.com` → 管理后台（admin:8089）
- `api.example.com` → API + WebSocket（server:3001）

### 方案 B：一个域名 + 路径

如果只有一个域名，用路径区分：

```caddyfile
chatapp.yourdomain.com {
	# 管理后台
	handle /admin/* {
		reverse_proxy localhost:8089
	}

	# API
	handle /api/* {
		reverse_proxy localhost:3001
	}

	# WebSocket
	handle /socket.io/* {
		reverse_proxy localhost:3001
	}

	# 上传文件
	handle /uploads/* {
		reverse_proxy localhost:3001
	}

	# H5 客户端（放最后）
	handle {
		reverse_proxy localhost:8088
	}
}
```

## 四、常用命令

```bash
# 重载配置
systemctl reload caddy

# 查看状态
systemctl status caddy

# 查看日志
journalctl -u caddy -f

# 查看证书
caddy list-modules | grep tls
```

## 五、WebSocket 说明

Caddy 自动识别 WebSocket 连接，不需要额外配置 `Upgrade` / `Connection` header，比 Nginx 方便。

## 六、上传大小

Caddy 默认不限制请求体大小，如果需要限制，在 reverse_proxy 前加：

```caddyfile
request_body {
	max_size 20MB
}
```
