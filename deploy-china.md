# 部署到中国云服务器（腾讯云 / 阿里云 轻量应用服务器）

> 这是**最推荐**的部署方式：用支付宝/微信付款（无需境外信用卡）、国内访问延迟低、服务器有**固定公网 IP**（之前担心的「IP 随机变化」彻底解决）、财务数据留在国内。

---

## 一、为什么选国内云（对比海外平台）

| 方案 | 付款 | 国内延迟 | 稳定性 | 数据位置 |
|---|---|---|---|---|
| Koyeb | 需信用卡 $29/月起 | 高 | 已停免费 | 海外 |
| Render | 需信用卡 | 高 | 15分钟休眠 | 海外 |
| **国内轻量云** | **支付宝/微信 ¥68~99/年** | **低** | **常驻不休眠** | **国内** |

---

## 二、购买（二选一，都支持实名 + 支付宝/微信）

### 腾讯云轻量应用服务器
- 入口：https://cloud.tencent.com/product/lighthouse
- 个人新用户：**2核2G ≈ 68~99 元/年**（活动价更低，还有 1 个月免费试用）
- 地域选 **上海 / 广州 / 北京**（离甘肃近）
- 镜像选 **Ubuntu 22.04 LTS**（系统镜像）

### 阿里云轻量应用服务器
- 入口：https://www.aliyun.com/product/swas
- 个人新用户：**2核2G ≈ 38~68 元/年**，同样有 1 个月免费试用
- 镜像选 **Ubuntu 22.04**

> ⚠️ **实名认证是强制的**（中国法律规定），购买时按提示上传身份证即可，几分钟完成。
> ⚠️ **不需要 ICP 备案**：备案只在「用域名访问」时才需要。我们用 `http://公网IP:3000` 直接访问，**不用备案**。

---

## 三、部署步骤（在云服务器的终端里操作）

### 1）控制台开放端口 3000
- 腾讯云/阿里云控制台 → 该服务器的**防火墙 / 安全组** → 添加**入站规则**：
  - 协议：TCP，端口：`3000`，来源：`0.0.0.0/0`（允许所有人访问）
- 保存。

### 2）SSH 登录服务器
- 控制台点「登录」或用终端：`ssh root@你的公网IP`（密码在控制台设置）

### 3）安装 Node.js（用官方二进制，稳妥）
```bash
# 下载 Node 22（Linux x64）
cd /tmp
curl -fsSL https://nodejs.org/dist/v22.22.2/node-v22.22.2-linux-x64.tar.xz -o node.tar.xz
tar -xf node.tar.xz
cp -r node-v22.22.2-linux-x64/{bin,include,lib,share} /usr/local/
node -v   # 应显示 v22.22.2
```

### 4）拉取代码（代码已在 GitHub）
```bash
cd ~
git clone https://github.com/15002611514/workbench.git
cd workbench
npm install
```

### 5）安装 pm2（让服务常驻、崩溃自动重启、开机自启）
```bash
npm install -g pm2
```

### 6）启动
```bash
# 用自带的启动脚本（自动探测公网 IP 并设为 PUBLIC_URL）
bash start.sh
# 或用 pm2 常驻：
PORT=3000 PUBLIC_URL="http://你的公网IP:3000" pm2 start server/server.js --name workbench
pm2 save
pm2 startup   # 按提示执行它给出的命令，实现开机自启
```

> 公网 IP 在云控制台「实例详情」里能看到（形如 `1.2.3.4`）。
> 不设 `PUBLIC_URL` 也能跑，只是手机扫码会扫到服务器内网地址（手机连不上）；设了就正常。

### 7）验证
浏览器打开 `http://你的公网IP:3000/api/status`，应返回：
```json
{"ok":true,"count":0,"storage":"json"}
```
看到就成功了。手机、电脑都访问 `http://你的公网IP:3000` 即可，数据自动同步。

---

## 四、数据存储说明

- **默认用本地 JSON 文件**（`server/data/records.json`），数据存在云服务器磁盘上，**持久保存**（轻量云磁盘不会像海外免费平台那样重部署清空）。
- 这样**不需要 Neon 等海外数据库**，避免跨境延迟，财务数据也留在国内。
- 仍建议：**网页底部「导出备份」**定期下载 JSON 留底；若以后「重置系统」会清空磁盘，有备份就不怕。

---

## 五、日常维护

| 操作 | 命令 |
|---|---|
| 看运行状态 | `pm2 status` |
| 看日志 | `pm2 logs workbench` |
| 重启 | `pm2 restart workbench` |
| 停止 | `pm2 stop workbench` |
| 更新代码 | `cd ~/workbench && git pull && npm install && pm2 restart workbench` |

---

## 六、想用域名（可选）

若以后想用 `workbench.你的域名.com` 访问：
1. 域名需完成 **ICP 备案**（国内服务器硬性要求，约 7~20 天，阿里云/腾讯云控制台一键申请）。
2. 备案后在云厂商「DNS / 解析」把域名指向公网 IP。
3. 用 Nginx 反代 `localhost:3000`（可顺便加 HTTPS）。这一步可选，初学者先用 IP 访问即可。
