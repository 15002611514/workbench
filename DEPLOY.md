# 部署到 Render + Neon（免费 · 免绑卡 · 数据持久）

> 注：原先推荐的 Koyeb 自 2026 年 2 月被 Mistral 收购后，**新用户已无法使用免费 Starter 档**（需订阅 $29/月起的 Pro）。本项目已改为更稳妥的 **Render（免费托管应用） + Neon（免费 PostgreSQL 数据库）** 组合，两样都不用绑卡。

目标：把同步服务器部署到云端 7×24 在线，手机和电脑**随时随地都能同步**，笔记本关机也不影响。

## 前置（全部免费、不用绑卡）
- **GitHub 账号**：https://github.com（已注册，代码仓库 `你的用户名/workbench` 已就绪）
- **Render 账号**：https://render.com（注册免费，可用 GitHub 直接登录）
- **Neon 账号**：https://neon.tech（注册免费，可用 GitHub 直接登录）

---

## 第 1 步：注册 Neon 并创建免费 Postgres 数据库
1. 打开 https://neon.tech → 用 GitHub 登录。
2. 控制台 → **New Project** → 项目名如 `workbench-db` → 区域选 **Singapore**（离中国最近）。你实际创建在 **US East (Ohio)** 也没问题，只要第 2 步 Render 选**同一个区域**即可（同区域延迟最低）。
3. 创建后进入项目 → 左侧 **Connection Details** → 把 **Connection string** 复制下来（形如 `postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/dbname?sslmode=require`）。
4. 这个连接串就是 `DATABASE_URL`，先保存到记事本，等下贴到 Render。

> Neon 免费档：0.5 GB 存储、无需信用卡、数据持久（计算节点会休眠，但存储层永久保存，有请求时自动唤醒）。

---

## 第 2 步：在 Render 部署 Web 服务
1. 打开 https://render.com → 用 GitHub 登录。
2. 控制台 → 右上角 **+ New** → **Web Service**。
3. 来源选 **Build and deploy from a Git repository** → **Connect account**（授权 GitHub）→ 选中你的 `workbench` 仓库。
4. 填写表单：
   - **Name**：`shuang-shenfen-workbench`（会决定访问域名）
   - **Region**：**US East (Ohio)**（与你的 Neon 数据库同区域；若 Neon 在 Singapore 则选 Singapore）
   - **Branch**：`master`
   - **Runtime**：**Node**
   - **Build Command**：`npm install`
   - **Start Command**：`npm start`
   - **Instance Type**：**Free**（免费档，右下角勾选）
5. 点 **Advanced** → **Add Environment Variable**：
   - Key：`DATABASE_URL`
   - Value：刚才从 Neon 复制的连接串
6. 点页面底部 **Create Web Service**。

> 项目根目录已有 `render.yaml`，如果你使用 Render 的 **Blueprint / Preview Environments**，它会自动按此配置；手动创建时按上面表单填即可。

---

## 第 3 步：访问地址
部署完成后，Render 会给你一个类似：
```
https://shuang-shenfen-workbench.onrender.com
```
- 手机和电脑都访问这个地址即可。
- 想要自己的域名：Render 控制台 → 该服务 → **Settings → Custom Domains**。

---

## 验证是否成功
浏览器打开：
```
https://shuang-shenfen-workbench.onrender.com/api/status
```
应返回 JSON：
```json
{
  "ok": true,
  "storage": "postgres",
  "count": 0
}
```
如果看到 `"storage":"postgres"`，说明已成功连上 Neon 数据库，数据会持久保存。

在手机和电脑各录一条数据，互相刷新即可看到同步。

---

## 注意事项
- **免费 Web 服务 15 分钟无访问会“睡眠”**，下次访问需冷启动约 30-60 秒，稍等即可。
- **冷启动后数据不会丢**：因为用了 Neon Postgres，数据存在 Neon；启动后服务器会自动连库。
- 若 `DATABASE_URL` 填错导致数据库连不上，服务器会**自动回退到本地 JSON 文件**继续运行，不会崩；但云端不会持久，重新部署后可能清空，所以务必确认 `/api/status` 返回 `postgres`。
- 仍建议定期用网页底部「导出备份」下载 JSON 留底（双保险）。
