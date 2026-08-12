# 部署到 Koyeb（免费 · 免绑卡 · 送 PostgreSQL）

目标：把同步服务器部署到云端 7×24 在线，手机和电脑**随时随地都能同步**，笔记本关机也不影响。

## 前置（全部免费、不用绑卡）
- **GitHub 账号**：https://github.com （注册免费）
- **Koyeb 账号**：https://koyeb.com （注册免费，无需信用卡）

本机 `workbench/` 目录里的代码已经 `git` 提交好了，你只需要把它推到你的 GitHub，再在 Koyeb 点几下。

---

## 第 1 步：推送到你的 GitHub
1. 在 GitHub 网页 **New repository** 新建仓库（名字如 `workbench`，私有/公开均可，建议私有）。
2. 在本机 `workbench/` 目录的终端执行（把 URL 换成你的仓库地址）：
   ```bash
   git remote add origin https://github.com/你的用户名/workbench.git
   git branch -M main
   git push -u origin main
   ```
   - 提示输入密码时，用 GitHub **个人访问令牌(PAT)** 当密码（GitHub 已不支持账号密码推送）。
   - 令牌生成：GitHub → 头像 → Settings → Developer settings → Personal access tokens → 勾选 `repo` 权限生成。
3. 不会用命令行？可装 **GitHub Desktop** 登录后拖入 `workbench` 目录推送；或在 GitHub 网页逐个上传文件（保持 `server/`、`public/` 目录结构）。

## 第 2 步：Koyeb 创建服务
1. 登录 Koyeb → 控制台 → **Create App**（或 **Services → Create Service**）。
2. 来源选 **GitHub**，授权并选中你的 `workbench` 仓库。
3. 分支 `main`；**Build 方式选 "Buildpacks (Node.js)"**（Koyeb 会自动 `npm install` 并识别 `package.json` 的 start 脚本）。
4. **Run command**：`node server/server.js`（Buildpacks 已自动识别可留空）。
5. **Port**：`3000`。
6. 实例类型选免费 **Nano**（免卡）。

## 第 3 步：附加免费 PostgreSQL（数据永久不丢）
1. Koyeb 控制台 → **Databases → Create Database** → 选 **PostgreSQL**，类型选免费档。
2. 创建完成后，在数据库详情里复制 **Connection string**（形如 `postgresql://user:pass@host:5432/db?sslmode=disable`）。
3. 回到你的 Service → **Settings → Environment variables** → 新增：
   - Key：`DATABASE_URL`
   - Value：刚才复制的连接串
4. 保存并 **Redeploy**。服务器检测到 `DATABASE_URL` 会自动建表并改用数据库存储；本地没设该变量时仍用本地 JSON 文件（两种模式自动切换）。

## 第 4 步：访问
部署完成后 Koyeb 给一个 `https://你的服务名.koyeb.app` 地址。手机、电脑都访问这个地址即可，数据自动同步。
- 想要自己的域名：Koyeb 里绑 **Custom Domain**。
- 手机端：浏览器打开该地址 → 「添加到主屏幕」，变成 App。

---

## 验证是否成功
- 浏览器打开 `https://你的服务名.koyeb.app/api/status`，应返回含 `"storage":"postgres"` 的 JSON（说明已用数据库）。
- 在手机和电脑各录一条数据，互相刷新即可看到同步。

## 注意事项
- 免费实例空闲约 1 小时后会缩容到零，再次访问有 1–2 秒冷启动，稍等即可。
- 数据库在免费额度内**持久保存**，重部署不丢。
- 仍建议定期用网页底部「导出备份」下载 JSON 留底（双保险）。
- 若 `DATABASE_URL` 填错导致数据库连不上，服务器会**自动回退到本地文件**并继续运行，不会崩。
