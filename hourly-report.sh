#!/bin/bash

ACCESS_LOG="/var/www/ai-doctor/logs/access.log"
# Load FEISHU_WEBHOOK from .env if not already set in environment
if [ -z "$FEISHU_WEBHOOK" ] && [ -f "/var/www/ai-doctor/.env" ]; then
  FEISHU_WEBHOOK=$(grep -E '^FEISHU_WEBHOOK=' /var/www/ai-doctor/.env | sed 's/^FEISHU_WEBHOOK="\(.*\)"$/\1/')
fi
SINCE=$(date -u -d "1 hour ago" +"%Y-%m-%dT%H")

python3 - "$ACCESS_LOG" "$FEISHU_WEBHOOK" "$SINCE" << 'PYEOF'
import sys, json, re
from datetime import datetime, timezone, timedelta
from urllib.request import urlopen, Request

access_log, webhook, since = sys.argv[1], sys.argv[2], sys.argv[3]

def detect_device(ua):
    ua_lower = ua.lower()
    if 'iphone' in ua_lower: return '📱 iPhone'
    if 'ipad' in ua_lower: return '📱 iPad'
    if 'android' in ua_lower: return '📱 Android'
    if 'windows' in ua_lower: return '💻 Windows'
    if 'macintosh' in ua_lower or 'mac os x' in ua_lower: return '💻 Mac'
    if 'linux' in ua_lower: return '🖥 Linux'
    return '❓ 未知'

def clean_ip(ip):
    return re.sub(r'^::ffff:', '', ip)

try:
    with open(access_log) as f:
        lines = [json.loads(l) for l in f if since in l]
except Exception:
    sys.exit(0)

if not lines:
    sys.exit(0)

total = len(lines)
unique_ips = len({clean_ip(l['ip']) for l in lines})

CST = timezone(timedelta(hours=8))
hour_label = (datetime.strptime(since, '%Y-%m-%dT%H')
              .replace(tzinfo=timezone.utc)
              .astimezone(CST)
              .strftime('%Y-%m-%d %H:00'))

detail_lines = []
for l in lines:
    ip = clean_ip(l['ip'])
    t = (datetime.strptime(l['time'][:19], '%Y-%m-%dT%H:%M:%S')
         .replace(tzinfo=timezone.utc)
         .astimezone(CST).strftime('%H:%M'))
    page = l.get('path', '/')
    device = detect_device(l.get('ua', ''))
    detail_lines.append(f"  {t} | {ip} | {page} | {device}")

msg = (f"📊 [AI Doctor 访问报告]\n"
       f"时段: {hour_label} ~ +1小时\n"
       f"总访问: {total} 次 | 独立IP: {unique_ips} 个\n\n"
       f"时间  | IP地址 | 页面 | 设备\n"
       f"{'─' * 44}\n"
       + '\n'.join(detail_lines))

payload = json.dumps({'msg_type': 'text', 'content': {'text': msg}}).encode()
req = Request(webhook, data=payload, headers={'Content-Type': 'application/json'})
with urlopen(req, timeout=10) as resp:
    result = json.loads(resp.read())
    if result.get('code') != 0:
        print(f"飞书返回错误: {result}", file=sys.stderr)
PYEOF
