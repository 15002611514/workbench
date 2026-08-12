#!/bin/bash
# 双身份工作台 · 阿里云轻量应用服务器 一键部署脚本
# 用法：把本脚本内容粘贴到阿里云控制台的「远程连接 / Workbench」终端里执行即可
set -e

PUBLIC_IP="39.106.141.75"   # 你的轻量服务器公网 IP
PORT="3000"

echo "== 1/7 更新系统 =="
apt-get update

echo "== 2/7 安装 git / node / npm =="
DEBIAN_FRONTEND=noninteractive apt-get install -y git nodejs npm curl

echo "== 3/7 切换 npm 国内镜像（registry.npmmirror.com，加速）=="
npm config set registry https://registry.npmmirror.com

echo "== 4/7 拉取代码（走 GitHub 代理 ghproxy，国内可通）=="
cd /root
rm -rf workbench
git clone --depth 1 https://ghproxy.com/https://github.com/15002611514/workbench.git
cd workbench

echo "== 5/7 安装依赖 =="
npm install

echo "== 6/7 安装 pm2 守护进程（断线/重启自动拉起）=="
npm install -g pm2

echo "== 7/7 启动工作台 =="
export PUBLIC_URL="http://${PUBLIC_IP}:${PORT}"
pm2 start server/server.js --name workbench
pm2 save
pm2 startup

echo "=============================================="
echo " 部署命令已执行完毕"
echo " 请务必到阿里云控制台 → 防火墙 放行 TCP ${PORT} 端口"
echo " 然后用浏览器打开： http://${PUBLIC_IP}:${PORT}"
echo " 验证接口：       http://${PUBLIC_IP}:${PORT}/api/status"
echo "=============================================="
