#!/bin/bash

# Load variables from .env if not already set in environment
if [ -f "/var/www/ai-doctor/.env" ]; then
  _load_env() {
    local key="$1"
    grep -E "^${key}=" /var/www/ai-doctor/.env | sed "s/^${key}=\"\(.*\)\"$/\1/"
  }
  [ -z "$APP_SERVER_URL" ] && APP_SERVER_URL=$(_load_env APP_SERVER_URL)
  [ -z "$FEISHU_WEBHOOK" ] && FEISHU_WEBHOOK=$(_load_env FEISHU_WEBHOOK)
fi
URL="${APP_SERVER_URL:-http://localhost:8009}"
APP_NAME="ai-doctor"
FLAG_FILE="/tmp/.ai-doctor_monitor_down"

send_feishu() {
  local msg="$1"
  curl -s -X POST "$FEISHU_WEBHOOK" \
    -H "Content-Type: application/json" \
    -d "{\"msg_type\":\"text\",\"content\":{\"text\":\"$msg\"}}" \
    > /dev/null
}

# 检查页面是否可访问
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$URL")

if [ "$HTTP_CODE" != "200" ]; then
  # 页面不可访问，且之前没发过告警才发（避免重复告警）
  if [ ! -f "$FLAG_FILE" ]; then
    touch "$FLAG_FILE"
    TIME=$(date "+%Y-%m-%d %H:%M:%S")
    send_feishu "🚨 [ai-doctor Service 告警]\n时间: $TIME\n状态: 页面无法访问 (HTTP $HTTP_CODE)\n地址: $URL\n\n正在尝试自动重启..."
    # 尝试自动重启
    pm2 restart "$APP_NAME" 2>/dev/null
    sleep 5
    # 重启后再检查一次
    HTTP_CODE2=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$URL")
    if [ "$HTTP_CODE2" = "200" ]; then
      rm -f "$FLAG_FILE"
      send_feishu "✅ [ai-doctor Service 恢复]\n时间: $(date '+%Y-%m-%d %H:%M:%S')\n自动重启后服务已恢复正常"
    else
      send_feishu "❌ [ai-doctor Service 重启失败]\n自动重启后仍无法访问，请手动检查服务器"
    fi
  fi
else
  # 页面正常，如果之前有告警标记则发恢复通知
  if [ -f "$FLAG_FILE" ]; then
    rm -f "$FLAG_FILE"
    TIME=$(date "+%Y-%m-%d %H:%M:%S")
    send_feishu "✅ [ai-doctor Service 恢复]\n时间: $TIME\n服务已恢复正常\n地址: $URL"
  fi
fi
