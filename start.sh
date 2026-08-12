#!/bin/bash
# 启动脚本：自动探测公网 IP 并设为 PUBLIC_URL（云端用），本地运行时留空则走局域网探测
cd "$(dirname "$0")"

export PORT="${PORT:-3000}"

if [ -z "$PUBLIC_URL" ]; then
  # 依次尝试多个公网 IP 探测服务（国内可用）
  PIP=$(curl -s --max-time 5 ip.sb 2>/dev/null \
     || curl -s --max-time 5 ifconfig.me 2>/dev/null \
     || curl -s --max-time 5 myip.ipip.net 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  if [ -n "$PIP" ]; then
    export PUBLIC_URL="http://$PIP:$PORT"
  fi
fi

echo "PORT=$PORT"
echo "PUBLIC_URL=${PUBLIC_URL:-（未设置，使用局域网探测）}"
exec node server/server.js
