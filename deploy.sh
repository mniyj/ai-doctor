#!/bin/bash

# AI Doctor 部署脚本
# 使用方法: ./deploy.sh [SERVER_IP] [SERVER_USER] [SSH_KEY_PATH]

SERVER_IP=${1:-${APP_SERVER_IP:-""}}
SERVER_USER=${2:-"root"}
SSH_KEY_PATH=${3:-${DEPLOY_SSH_KEY_PATH:-""}}

REMOTE_DIR="/var/www/ai-doctor"
APP_NAME="ai-doctor"

# 构建 SSH 选项
SSH_OPTS="-o StrictHostKeyChecking=no"
if [ -n "$SSH_KEY_PATH" ]; then
  if [ ! -f "$SSH_KEY_PATH" ]; then
     echo "❌ 找不到密钥文件: $SSH_KEY_PATH"
     exit 1
  fi
  SSH_OPTS="$SSH_OPTS -i $SSH_KEY_PATH"
fi

echo "🚀 部署 $APP_NAME 到 $SERVER_USER@$SERVER_IP ..."

# 1. 本地构建
echo "📦 构建项目..."
npm install --silent && npm run build

if [ $? -ne 0 ]; then
    echo "❌ 构建失败"
    exit 1
fi

# 2. 打包
echo "🗜️  打包部署文件..."
export COPYFILE_DISABLE=1
tar --no-xattrs --exclude='._*' -czf deploy.tar.gz dist server.js package.json package-lock.json ecosystem.config.cjs

# 3. 上传
echo "📤 上传到服务器..."
ssh $SSH_OPTS "$SERVER_USER@$SERVER_IP" "mkdir -p $REMOTE_DIR"
scp $SSH_OPTS deploy.tar.gz "$SERVER_USER@$SERVER_IP:$REMOTE_DIR/"

if [ $? -ne 0 ]; then
    echo "❌ 上传失败"
    rm deploy.tar.gz
    exit 1
fi

# 4. 远程部署
echo "⚙️  远程部署..."
ssh $SSH_OPTS "$SERVER_USER@$SERVER_IP" << EOF
  set -e
  cd $REMOTE_DIR

  tar -xzf deploy.tar.gz
  rm deploy.tar.gz

  # 安装生产依赖
  npm install --production --registry=https://registry.npmmirror.com 2>/dev/null

  # 检查 PM2
  if ! command -v pm2 &> /dev/null; then
      npm install -g pm2
  fi

  # 防火墙开放 8009
  if command -v firewall-cmd &> /dev/null && systemctl is-active firewalld &> /dev/null; then
      if ! firewall-cmd --list-ports | grep -q "8009/tcp"; then
          firewall-cmd --zone=public --add-port=8009/tcp --permanent
          firewall-cmd --reload
      fi
  fi

  # 重启服务
  pm2 delete $APP_NAME 2>/dev/null || true
  pm2 start ecosystem.config.cjs
  sleep 3

  if pm2 list | grep "$APP_NAME" | grep -q "online"; then
     echo "✅ 启动成功"
  else
     echo "❌ 启动失败"
     pm2 logs $APP_NAME --lines 20 --nostream
     exit 1
  fi

  pm2 save
EOF

rm deploy.tar.gz
echo "🎉 部署成功! 访问: http://$SERVER_IP:8009"
