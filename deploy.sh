#!/bin/bash
# ==========================================
# 轻聊 部署脚本
# 用法: ./deploy.sh [server|web|admin|robot|all]
# 默认只重启 server（因为 server 改动最频繁）
# 传 all 重启所有服务
# ==========================================

# ====== 配置 ======
SERVER="root@106.54.241.126"
REMOTE_DIR="/opt/chatapp"
# ==================

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 检查服务器配置
if [ "$SERVER" = "root@你的服务器IP" ]; then
  echo -e "${RED}错误: 请先编辑脚本，把 SERVER 改成你的服务器地址${NC}"
  exit 1
fi

TARGET=${1:-server}

echo -e "${YELLOW}==> 同步代码到 $SERVER ...${NC}"
rsync -avz \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.git' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  --exclude='stress-test-results' \
  ./ \
  $SERVER:$REMOTE_DIR/

if [ $? -ne 0 ]; then
  echo -e "${RED}同步失败${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}==> 构建并重启服务: $TARGET${NC}"

case $TARGET in
  all)
    ssh $SERVER "cd $REMOTE_DIR && docker compose up -d --build"
    ;;
  server|web|admin|robot)
    ssh $SERVER "cd $REMOTE_DIR && docker compose up -d --build $TARGET"
    ;;
  *)
    echo -e "${RED}未知服务: $TARGET${NC}"
    echo "可用: server, web, admin, robot, all"
    exit 1
    ;;
esac

if [ $? -eq 0 ]; then
  echo ""
  echo -e "${GREEN}==> 部署完成 ✓${NC}"
  echo -e "查看日志: ssh $SERVER 'cd $REMOTE_DIR && docker compose logs -f $TARGET'"
else
  echo -e "${RED}部署失败${NC}"
  exit 1
fi
