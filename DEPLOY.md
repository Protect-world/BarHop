# BarHop 部署文档（Linux 服务器完整版）

> 本文档详细说明如何将 BarHop 项目从零部署到上线，涵盖服务器选购、ICP 备案、Docker 部署、Nginx 反向代理、HTTPS 证书、微信小程序配置、审核发布等全流程。
>
> 项目已托管到 GitHub，部署步骤从「服务器选购」开始。

---

## 目录

- [一、部署架构总览](#一部署架构总览)
- [二、第一阶段：基础准备](#二第一阶段基础准备预计-1-天)
- [三、第二阶段：部署后端服务](#三第二阶段部署后端服务)
- [四、第三阶段：微信小程序配置](#四第三阶段微信小程序配置)
- [五、第四阶段：小程序发布](#五第四阶段小程序发布)
- [六、运营和维护](#六运营和维护)
- [七、执行路线图](#七执行路线图)
- [八、费用总结](#八费用总结)
- [九、宝塔面板部署方案（腾讯云镜像）](#九宝塔面板部署方案腾讯云镜像)
- [十、API Key 申请指引](#十api-key-申请指引)
- [十一、故障排查 FAQ](#十一故障排查-faq)

---

## 一、部署架构总览

```
                    ┌──────────────────────────────────────┐
                    │           用户（微信小程序）            │
                    └───────────────┬──────────────────────┘
                                    │ HTTPS
                                    ▼
              ┌─────────────────────────────────────────────┐
              │         云服务器（Ubuntu 22.04）            │
              │                                             │
              │  ┌───────────────────────────────────────┐  │
              │  │  Nginx (宿主机, 80/443)              │  │
              │  │  反向代理 + SSL + 静态资源            │  │
              │  └────────────────┬──────────────────────┘  │
              │                   │ proxy_pass :3000       │
              │                   ▼                         │
              │  ┌───────────────────────────────────────┐  │
              │  │       Docker (barhop-network)         │  │
              │  │  ┌──────────────────────────────────┐ │  │
              │  │  │  app 容器 (Node.js 18, :3000)    │ │  │
              │  │  └────┬──────────────────┬─────────┘ │  │
              │  │       │                  │            │  │
              │  │  ┌────▼────────┐  ┌─────▼─────────┐  │  │
              │  │  │ mysql 容器   │  │ redis 容器    │  │  │
              │  │  │ (MySQL 8.0)  │  │ (Redis 7)     │  │  │
              │  │  │ :3306        │  │ :6379         │  │  │
              │  │  └──────────────┘  └───────────────┘  │  │
              │  └───────────────────────────────────────┘  │
              └─────────────────────────────────────────────┘
```

**技术栈一览**：

| 组件 | 版本 | 端口 | 运行方式 | 说明 |
|------|------|------|---------|------|
| Ubuntu Server | 22.04 LTS | - | 宿主机 | 操作系统 |
| Docker | 24+ | - | 宿主机 | 容器运行时 |
| Docker Compose | v2+ | - | 宿主机 | 容器编排 |
| Nginx | latest | 80, 443 | **宿主机** | 反向代理、SSL、静态资源 |
| Node.js | 18 (Alpine) | 3000 | **Docker 容器** | 后端 API 服务 |
| MySQL | 8.0 | 3306→3307 | **Docker 容器** | 数据库（3307 映射到宿主机）|
| Redis | 7 | 6379 | **Docker 容器** | 缓存 |

### ⚠️ 微信小程序硬性要求

| 要求 | 说明 |
|------|------|
| ✅ **必须 HTTPS** | HTTP 只在开发者工具调试时可用 |
| ✅ **必须是域名** | **不支持 IP 地址**（如 `https://1.2.3.4` ❌） |
| ✅ **必须备案** | 域名需 ICP 备案（国内服务器） |
| ✅ **必须预配置** | 域名要在公众平台提前登记 |
| ✅ **端口只能 443** | 不能用其他端口 |

---

## 二、第一阶段：基础准备（预计 1 天）

### Step 1: 购买云服务器和域名

#### 1.1 购买云服务器（推荐腾讯云）

**访问**：[腾讯云官网](https://cloud.tencent.com)

**推荐配置**：

| 配置项 | 选择 | 说明 |
|--------|------|------|
| 产品 | **轻量应用服务器** | 比 ECS 便宜，够用 |
| 规格 | **2核4G** | 起步配置 |
| 系统 | **Ubuntu 22.04 LTS** | 稳定、文档多 |
| 地域 | **广州/深圳** | 微信服务器在广州，延迟低 |
| 系统盘 | **50GB SSD** | 够用 |
| 带宽 | **5Mbps 按量付费** | 流量不大 |

**操作步骤**：
1. 注册腾讯云账号 → 实名认证（需身份证）
2. 进入轻量应用服务器 → 选购
3. 设置 root 密码（请记好！）
4. 购买完成，记录 **公网 IP 地址**

**费用**：约 ¥60-80/月（新用户更便宜）

#### 1.2 购买域名

**访问**：[腾讯云域名注册](https://cloud.tencent.com/product/domain)

**操作步骤**：
1. 搜索你想要的域名（如 `barhop.com`、`barhop.cn`）
2. 选择可用域名（`.com` 约 ¥60/年，`.cn` 约 ¥30/年）
3. 购买并完成实名认证

**⚠️ 重要**：域名实名认证信息要和服务器实名认证信息一致，否则备案会失败！

---

### Step 2: 完成 ICP 备案（预计 7-20 天，可并行）

**备案期间可以先开发测试，用 IP 地址调试**

#### 2.1 开始备案流程

**访问**：[腾讯云备案系统](https://console.cloud.tencent.com/beian)

**操作步骤**：

1. 进入备案系统 → 点击「开始备案」
2. 选择备案类型：
   - **个人**：个人开发者选这个
   - **企业**：用营业执照备案
3. 填写主体信息：
   ```
   姓名/企业名：xxx
   证件号：身份证号/统一社会信用代码
   手机号：xxx（会收验证码）
   邮箱：xxx
   ```
4. 填写网站信息：
   ```
   网站名称：BarHop 酒吧探索
   网站域名：你买的域名
   服务内容：酒吧信息展示、用户评价
   网站类型：企业/综合
   ```
5. 上传资料：
   - 身份证正反面照片（个人）或营业执照（企业）
   - 人脸核验（App 扫码）
   - 网站真实性核验单（下载签字后上传）
   - 幕布照片（去线下核验点拍照或付费上门）

#### 2.2 等待审核

| 阶段 | 耗时 | 操作 |
|------|------|------|
| 腾讯云初审 | 1-2 个工作日 | 腾讯云人工审核资料 |
| 提交到管局 | 1 个工作日 | 腾讯云提交给工信部 |
| 管局审核 | 5-15 个工作日 | 工信部审核 |

**加快方法**：
- 腾讯云老用户、历史备案无违规 → 最快 3-5 天
- 小程序备案通道（如果你是小程序专用域名）→ 更快

---

### Step 3: 服务器初始化（备案期间可做）

**SSH 登录服务器**：
```bash
ssh root@你的服务器IP
# 输入购买时设置的密码
```

#### 3.1 创建管理用户（安全最佳实践）
 可以参考我的deepseek的聊天记录 ！！！！！
```bash
# 创建新用户
adduser barhop
# 设置密码（输入两次）

# 将新用户加入 sudo 组
usermod -aG sudo barhop

# 测试登录
exit  # 退出 root
ssh barhop@你的服务器IP
sudo whoami  # 应该显示 root
```

#### 3.2 配置 SSH 安全

```bash
# 使用 root 登录
sudo vim /etc/ssh/sshd_config

# 修改以下配置：
Port 2222                    # 改成非标准端口（防扫描）
PermitRootLogin no           # 禁止 root 登录
PasswordAuthentication no    # 关闭密码登录（改用密钥）
PubkeyAuthentication yes      # 开启密钥认证

# 生成密钥（在本地 Windows PowerShell 执行）
ssh-keygen -t ed25519 -C "barhop"
# 会生成 C:\Users\你的用户名\.ssh\id_ed25519

# 复制公钥到服务器
cat ~/.ssh/id_ed25519.pub | ssh barhop@服务器IP -p 2222 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"

# 重启 SSH 服务
sudo systemctl restart sshd
```

#### 3.3 配置防火墙（UFW）

```bash
# 安装 UFW
sudo apt update
sudo apt install ufw -y

# 设置默认策略
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 开放必要端口
sudo ufw allow 2222/tcp     # SSH（你改成的端口）
sudo ufw allow 80/tcp        # HTTP
sudo ufw allow 443/tcp       # HTTPS

# 启用防火墙
sudo ufw enable
sudo ufw status  # 检查状态
```

#### 3.4 配置 Swap 分区（小内存服务器必做）

```bash
# 创建 2GB swap 文件
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 设置开机自动挂载
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 配置 swappiness（减少使用 swap）
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 验证
free -h  # 应该看到 swap 列
```

#### 3.5 更新系统

```bash
sudo apt update && sudo apt upgrade -y
```

---

### Step 4: 安装 Docker 和 Docker Compose

```bash
# 安装 Docker（官方脚本）
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 启动 Docker 并设置开机自启
sudo systemctl enable docker
sudo systemctl start docker

# 验证
docker --version
# Docker version 27.x.x

# 将用户加入 docker 组（免 sudo）
sudo usermod -aG docker barhop
# 重新登录或执行：newgrp docker

# 安装 Docker Compose V2
sudo apt install docker-compose-plugin -y

# 验证
docker compose version
# Docker Compose version v2.x.x

# 配置 Docker 国内镜像加速
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com",
    "https://docker.m.daocloud.io",
    "https://hub-mirror.c.163.com"
  ],
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF

# 重启 Docker
sudo systemctl restart docker
```

---

## 三、第二阶段：部署后端服务

### Step 5: 配置项目环境变量

#### 5.1 克隆项目代码

```bash
# 登录服务器
ssh barhop@服务器IP -p 2222

# 克隆项目
cd /opt
git clone https://github.com/你的GitHub用户名/BarHop.git
cd BarHop
```

#### 5.2 创建环境变量文件

```bash
cd /opt/BarHop
cp .env.example .env
vim .env
```

**填写以下内容**：

```env
# 服务器配置
NODE_ENV=production
PORT=3000
SERVER_BASE_URL=https://你的域名.com

# MySQL 配置（与 docker-compose 对应）
DB_HOST=mysql
DB_PORT=3306
DB_NAME=barhop
DB_USER=barhop_user
DB_PASSWORD=设置一个强密码

# Redis 配置
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=设置一个密码

# JWT 密钥（随机生成）
JWT_SECRET=用 node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" 生成

# 微信小程序配置
WECHAT_APPID=wxb83650bafb225674
WECHAT_SECRET=你的微信小程序AppSecret（在mp.weixin.qq.com获取）

# 腾讯地图 LBS Key（酒吧搜索主数据源，必填）
# 申请地址：https://lbs.qq.com/dev/console/key/manage
TENCENT_LBS_KEY=你的腾讯地图Key

# 高德地图 Key（酒吧图片和评分补充，推荐配置）
# 申请地址：https://console.amap.com/dev/key/app
# 免费版 QPS=4，代码已实现 250ms 限流
AMAP_KEY=你的高德地图Key
```

**API Key 说明**：

| API Key | 用途 | 是否必填 | 申请地址 |
|---------|------|---------|---------|
| `TENCENT_LBS_KEY` | 酒吧搜索主数据源（腾讯地图地点搜索） | ✅ 必填 | [lbs.qq.com](https://lbs.qq.com/dev/console/key/manage) |
| `AMAP_KEY` | 酒吧照片和评分补充（高德 POI 详情） | ⚠️ 推荐 | [console.amap.com](https://console.amap.com/dev/key/app) |
| `WECHAT_APPID` | 微信登录 | ✅ 必填 | [mp.weixin.qq.com](https://mp.weixin.qq.com) → 开发设置 |
| `WECHAT_SECRET` | 微信登录 | ✅ 必填 | 同上（点击"重置"生成） |

> ⚠️ **安全提示**：所有 API Key 只放在后端 `.env` 文件中，前端不暴露任何 Key。前端通过后端代理访问地图 API。

#### 5.3 生成 JWT 密钥

```bash
# 在服务器上执行
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# 复制输出结果，粘贴到 .env 的 JWT_SECRET
```

---

### Step 6: 使用 Docker 部署后端服务

#### 6.1 修改 docker-compose.yml

```bash
vim /opt/BarHop/docker-compose.yml
```

**确认以下配置**：
```yaml
# docker-compose.yml 中三个服务：
# 1. app    - Node.js 后端（基于 server/Dockerfile 构建）
# 2. mysql  - MySQL 8.0（自动执行 database/schema.sql）
# 3. redis  - Redis 7

# 检查项：
# - server/.env 已正确填写（app 容器通过 env_file 加载）
# - app 容器的 DB_HOST 和 REDIS_HOST 已在 environment 中覆盖为容器服务名
# - database/schema.sql 路径正确（./database/schema.sql）
```

> 📌 `docker-compose.yml` 已配置好三个服务：Node.js 后端 + MySQL 8.0 + Redis 7。schema.sql 会通过 volume 挂载自动执行。**无需在宿主机安装 Node.js 或 PM2**，所有运行时都在容器中。

> ⚠️ **修改 MySQL 密码时务必同步两处**：
> 1. `docker-compose.yml` 中 mysql 服务的 `MYSQL_ROOT_PASSWORD` 和 `MYSQL_PASSWORD`
> 2. `server/.env` 中的 `DB_PASSWORD`
>
> 两处必须一致，否则 app 容器连不上 MySQL。最简单做法：保持默认密码 `barhop_pass` 不改，或在根目录创建 `.env` 文件统一管理（docker-compose 会自动读取根目录 `.env`）。

#### 6.2 开始部署

```bash
cd /opt/BarHop

# 构建并启动所有服务（首次会构建 Node.js 镜像，可能需要 2-5 分钟）
docker compose up -d --build

# 查看服务状态（应显示 3 个容器均为 running/healthy）
docker compose ps

# 查看 app 日志（重点看是否有 "Server running on port 3000"）
docker compose logs -f app

# 查看所有服务日志
docker compose logs -f
```

**预期输出**：
```
NAME             STATUS                   PORTS
barhop-app       Up (healthy)             0.0.0.0:3000->3000/tcp
barhop-mysql     Up (healthy)             0.0.0.0:3307->3306/tcp
barhop-redis     Up (healthy)             0.0.0.0:6379->6379/tcp
```

#### 6.3 初始化数据库

`database/schema.sql` 会通过 docker-compose 的 volume 挂载自动执行（`/docker-entrypoint-initdb.d/01-schema.sql`），**无需手动导入**。

> ⚠️ schema.sql 只在 MySQL 容器**首次启动**（数据卷为空时）执行。如果之前启动过又改了 schema.sql，需要先删除数据卷：
> ```bash
> docker compose down -v  # -v 会删除数据卷（谨慎！会清空数据）
> docker compose up -d --build
> ```

**如需手动操作**：
```bash
# 进入 MySQL 容器
docker exec -it barhop-mysql mysql -uroot -p

# 输入 root 密码（在 docker-compose.yml 中配置的 barhop_root）

# 数据库和用户已由 docker-compose 自动创建，如需手动：
CREATE DATABASE IF NOT EXISTS barhop CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'barhop_user'@'%' IDENTIFIED BY '你的密码';
GRANT ALL PRIVILEGES ON barhop.* TO 'barhop_user'@'%';
FLUSH PRIVILEGES;

# schema.sql 已自动执行，如需重新导入：
# exit
# docker exec -i barhop-mysql mysql -u barhop_user -p barhop < /opt/BarHop/database/schema.sql
```

#### 6.4 验证服务

```bash
# 健康检查（检查数据库连接）
curl http://localhost:3000/health
# 应该返回：{"code":0,"data":{"database":"connected","dbTest":1},"message":"BarHop Server is running"}

# 测试酒吧搜索 API（需配置 TENCENT_LBS_KEY）
curl http://localhost:3000/api/bars/nearby -X POST -H "Content-Type: application/json" -d '{"lat":30.5728,"lng":104.0668,"radius":5000}'

# 应该返回：{"code":0,"data":[...]}
```

> 📌 **端口说明**：
> - `3000` - Node.js 服务（仅本机，Nginx 会代理）
> - `3307` - MySQL（宿主机映射到 3307，避免与本地 MySQL 冲突）
> - `6379` - Redis
>
> 生产环境中 Nginx 部署在宿主机（不在 Docker 中），方便管理 SSL 证书和多站点。

---

### Step 7: 配置 Nginx 反向代理

#### 7.1 配置域名解析

**在腾讯云域名管理页面操作**：

| 记录类型 | 主机记录 | 记录值 | TTL |
|---------|---------|--------|-----|
| A | @ | 你的服务器IP | 600 |
| A | www | 你的服务器IP | 600 |

#### 7.2 配置 Nginx

```bash
# 复制配置文件
sudo cp /opt/BarHop/nginx/conf.d/barhop.conf /etc/nginx/sites-available/barhop

# 修改域名
sudo vim /etc/nginx/sites-available/barhop
```

**修改以下内容**：
```nginx
server_name 你的域名.com www.你的域名.com;

# 修改上传目录路径
location /uploads/ {
    alias /opt/BarHop/server/uploads/;
}
```

#### 7.3 启用 Nginx 配置

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/barhop /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx

# 验证
curl http://你的域名.com/api/bars/nearby -X POST -H "Content-Type: application/json" -d '{"lat":30.5728,"lng":104.0668,"radius":5000}'
```

---

### Step 8: 申请和配置 HTTPS 证书

#### 8.1 使用 Certbot 申请 Let's Encrypt 免费证书

```bash
# 安装 Certbot
sudo apt install certbot python3-certbot-nginx -y

# 申请证书（自动配置 Nginx）
sudo certbot --nginx -d 你的域名.com -d www.你的域名.com

# 按提示操作：
# 1. 输入邮箱（用于接收到期提醒）
# 2. 同意服务条款
# 3. 选择是否强制 HTTPS（选 2: 强制）
```

#### 8.2 自动续期

```bash
# 测试续期
sudo certbot renew --dry-run

# 添加定时任务
sudo crontab -e
```

**添加一行**：
```
0 0 1 * * certbot renew --quiet  # 每月1号凌晨检查续期
```

#### 8.3 验证 HTTPS

```bash
curl https://你的域名.com/api/bars/nearby -X POST -H "Content-Type: application/json" -d '{"lat":30.5728,"lng":104.0668,"radius":5000}'

# 应该返回 HTTPS 正常响应
```

---

## 四、第三阶段：微信小程序配置

### Step 9: 微信公众平台配置

#### 9.1 获取小程序凭证

**访问**：[mp.weixin.qq.com](https://mp.weixin.qq.com) → 开发管理 → 开发设置

**记录以下信息**：
```
AppID：wxXXXXXXXXXXXXXXXX
AppSecret：点击"重置"按钮生成（请妥善保管！）
```

#### 9.2 配置服务器域名

**在"开发设置"页面，找到"服务器域名"区域**：

```
request 合法域名：https://你的域名.com
uploadFile 合法域名：https://你的域名.com
downloadFile 合法域名：https://你的域名.com
```

**⚠️ 注意**：
- 必须填写 HTTPS 开头
- 不能带端口号
- 必须是备案通过的域名

#### 9.3 配置服务器端的微信凭证

```bash
# 在服务器上修改 .env
vim /opt/BarHop/.env

# 填入 AppID 和 AppSecret
WECHAT_APPID=wxXXXXXXXXXXXXXXXX
WECHAT_SECRET=你的AppSecret
```

---

### Step 10: 修改小程序前端生产配置

#### 10.1 修改 API 地址

**修改**：`miniprogram/utils/config.js`

```javascript
const config = {
  API_BASE_URL: 'https://你的域名.com',  // 改为你的域名
  TIMEOUT: 60000,
  // ...其他配置保持不变
};
```

> ⚠️ `API_BASE_URL` 不能带端口号（Nginx 已做反向代理到 3000），不能带末尾斜杠。

#### 10.2 关闭调试模式

**修改**：`miniprogram/project.config.json`

```json
{
  "setting": {
    "urlCheck": true  // 生产环境改为 true（校验合法域名）
  }
}
```

> 📌 `miniprogram/app.js` 中没有 mock 模式开关，无需修改。登录失败时会自动 fallback 到 mock 用户，发布前请确保 `WECHAT_APPID` 和 `WECHAT_SECRET` 已正确配置在服务器 `.env` 中。

#### 10.3 在开发者工具测试

1. 打开微信开发者工具 → 导入项目
2. 确认 AppID 正确
3. 点击 **详情** → 本地设置
4. **取消勾选** "不校验合法域名..."（因为现在用真域名）
5. 编译运行，测试所有功能

---

### Step 11: 完整联调测试

#### 11.1 功能测试清单

| 功能 | 测试点 | 结果 |
|------|--------|------|
| 首页加载 | 能获取酒吧列表 | ⬜ |
| 分类筛选 | 切换分类正常 | ⬜ |
| 搜索功能 | 关键词搜索正常 | ⬜ |
| 详情页 | 酒吧信息完整 | ⬜ |
| 图片加载 | 所有图片显示正常 | ⬜ |
| 登录 | 微信登录正常 | ⬜ |
| 评价提交 | 带图评价提交成功 | ⬜ |
| 评价列表 | 能看到所有评价 | ⬜ |
| 删除评价 | 自己的评价可删除 | ⬜ |
| 收藏功能 | 收藏/取消正常 | ⬜ |
| 收藏列表 | 收藏页显示正常 | ⬜ |
| 个人信息 | 头像昵称显示 | ⬜ |
| 评分显示 | 评分数字正确 | ⬜ |

#### 11.2 测试命令

```bash
# 在服务器上检查 API
curl -X POST https://你的域名.com/api/bars/nearby \
  -H "Content-Type: application/json" \
  -d '{"lat":30.5728,"lng":104.0668,"radius":5000}'

# 检查服务器日志
docker compose logs --tail 100

# 检查 Nginx 日志
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 五、第四阶段：小程序发布

### Step 12: 小程序提交审核和发布

#### 12.1 上传代码

1. 微信开发者工具 → 右上角点击版本号
2. **填写版本号**：如 `1.0.0`
3. **填写备注**：如 "首次发布"
4. 点击 **上传** 按钮

#### 12.2 设置体验版（可选，推荐）

1. 登录 [mp.weixin.qq.com](https://mp.weixin.qq.com)
2. 版本管理 → 开发版本 → 点击"选为体验版"
3. 设置体验成员（自己和朋友）
4. 在微信搜索小程序体验

#### 12.3 提交审核

1. 版本管理 → 待审核版本 → 点击"提交审核"
2. **填写审核信息**：
   ```
   服务类目：生活服务 → 餐饮
   版本描述：BarHop 是一款酒吧探索与评价小程序
   测试账号：如果需要登录，提供测试账号
   ```
3. **上传功能截图**：
   - 首页截图
   - 详情页截图
   - 评价功能截图
4. **填写隐私协议**：
   - 说明收集哪些信息（头像、昵称、位置、openid）
   - 说明信息用途
5. 提交审核

#### 12.4 等待审核

| 情况 | 时间 | 说明 |
|------|------|------|
| 个人开发者 | 1-7 天 | 可能被打回要求补充资料 |
| 企业开发者 | 1-3 天 | 审核较快 |

**审核被打回的常见原因**：
- ❌ 类目选错 → 选"生活服务"或"休闲娱乐"
- ❌ 功能不完整 → 确保首页、详情、评价等核心功能都可用
- ❌ 描述不清 → 详细说明小程序的功能和价值
- ❌ 没有隐私协议 → 必须声明收集的用户信息

#### 12.5 发布上线

审核通过后：
1. 版本管理 → 审核版本 → 点击"发布"
2. 选择发布方式：
   - **全量发布**：所有用户立即更新
   - **灰度发布**：逐步推送给用户（推荐）
3. 发布完成！

---

## 六、运营和维护

### 日常运维命令

```bash
# 查看服务状态
docker compose -f /opt/BarHop/docker-compose.yml ps

# 查看日志
docker compose -f /opt/BarHop/docker-compose.yml logs -f --tail 200

# 重启服务
docker compose -f /opt/BarHop/docker-compose.yml restart

# 更新代码
cd /opt/BarHop
git pull
docker compose up -d --build

# 数据库备份
docker exec barhop-mysql mysqldump -u barhop_user -p密码 barhop > /opt/barhop-backup-$(date +%Y%m%d).sql

# 恢复数据
docker exec -i barhop-mysql mysql -u barhop_user -p密码 barhop < /opt/barhop-backup-20260803.sql
```

### 紧急情况处理

```bash
# 服务挂了？
docker compose -f /opt/BarHop/docker-compose.yml up -d

# MySQL 挂了？
docker compose -f /opt/BarHop/docker-compose.yml restart mysql

# 磁盘满了？
df -h  # 查看磁盘使用
docker system prune -a  # 清理无用镜像

# HTTPS 证书过期？
sudo certbot renew
sudo systemctl restart nginx
```

### 日志位置

| 服务 | 日志路径 |
|------|---------|
| Node.js | `docker compose logs app` |
| Nginx 访问日志 | `/var/log/nginx/access.log` |
| Nginx 错误日志 | `/var/log/nginx/error.log` |
| MySQL | `docker compose logs mysql` |
| Redis | `docker compose logs redis` |

### 健康检查

```bash
# 检查服务是否正常
curl -s -o /dev/null -w "%{http_code}" https://你的域名.com/api/bars/nearby -X POST -H "Content-Type: application/json" -d '{"lat":30.5728,"lng":104.0668,"radius":5000}'
# 返回 200 表示正常

# 检查磁盘空间
df -h

# 检查内存使用
free -h

# 检查 Docker 容器状态
docker ps
```

### 自动备份方案

```bash
# 创建备份脚本
sudo vim /opt/backup.sh
```

**内容**：
```bash
#!/bin/bash
BACKUP_DIR=/opt/backups
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# 备份 MySQL
docker exec barhop-mysql mysqldump -u barhop_user -p密码 barhop > $BACKUP_DIR/mysql_$DATE.sql

# 备份上传的文件
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /opt/BarHop/server/uploads/

# 备份配置文件
tar -czf $BACKUP_DIR/config_$DATE.tar.gz /opt/BarHop/.env /opt/BarHop/docker-compose.yml

# 删除7天前的备份
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "备份完成: $DATE"
```

```bash
# 赋予执行权限
sudo chmod +x /opt/backup.sh

# 添加定时任务（每天凌晨3点备份）
sudo crontab -e
# 添加：
0 3 * * * /opt/backup.sh >> /var/log/backup.log 2>&1
```

---

## 七、执行路线图

```
┌─────────────────────────────────────────────────────────────────────────┐
│  第1天：购买服务器 + 域名 + 提交备案                                      │
│  ↓                                                                      │
│  第1-20天：备案等待期间，完成 Step 3-8（服务器初始化 + 后端部署）            │
│  ↓                                                                      │
│  备案通过：完成 Step 9-10（微信配置 + 前端修改）                            │
│  ↓                                                                      │
│  第N天：完成 Step 11（联调测试）                                          │
│  ↓                                                                      │
│  第N+1天：完成 Step 12（提交审核）                                        │
│  ↓                                                                      │
│  审核通过：发布上线！🎉                                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 备案期间测试方法

备案期间可以用 IP 地址在开发者工具调试：

1. 微信开发者工具 → 右上角 **详情** → **本地设置**
2. 勾选 ✅ **不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书**
3. 前端代码里 API 地址用 `http://你的IP:3000`
4. 可以正常开发调试

**但是发布上线前必须改成 HTTPS + 域名**，否则审核会被拒。

---

## 八、费用总结

| 项目 | 费用 | 周期 |
|------|------|------|
| 腾讯云轻量服务器 | ¥60-80 | 月 |
| 域名 | ¥30-60 | 年 |
| 微信小程序认证 | ¥0（个人）/ ¥300（企业）| 年 |
| HTTPS 证书 | 免费 | - |
| 腾讯地图 LBS API | 免费（个人开发者配额）| - |
| 高德地图 API | 免费（4 QPS 限制）| - |
| **月均总成本** | **¥65-85** | - |

### API Key 计费说明

**腾讯地图 LBS**：
- 免费配额：个人开发者 10,000 次/日
- 超出后：¥0.005/次
- 本项目用量：约 100-500 次/日（远低于免费额度）

**高德地图 API**：
- 免费版：4 QPS（每秒 4 次请求）
- 月配额：300,000 次
- 本项目用量：约 50-200 次/日（远低于免费额度）
- 代码已实现 250ms 限流 + QPS 超限重试机制（2s→4s→6s 递增等待）

---

## 九、宝塔面板部署方案（腾讯云镜像）

> 如果你使用腾讯云服务器的"宝塔面板"镜像（而非纯 Ubuntu），可以用宝塔面板的可视化界面替代命令行部署。此方案与上面 Docker 方案二选一。

### 9.1 宝塔面板初始化

腾讯云镜像已预装宝塔面板，首次使用需获取登录信息：

```bash
# SSH 登录服务器后执行
sudo /etc/init.d/bt default
# 输出：
# 面板地址: http://你的IP:8888/xxxx
# 用户名: xxxxxx
# 密码: xxxxxx
```

在浏览器打开面板地址登录，绑定宝塔官网账号。

### 9.2 安装运行环境

在宝塔面板 → **软件商店** → 搜索安装：

| 软件 | 版本 | 用途 |
|------|------|------|
| **Nginx** | 1.24+ | 反向代理 + 静态资源 |
| **MySQL** | 8.0 | 数据库 |
| **Redis** | 7.x | 缓存 |
| **PM2管理器** | 最新 | Node.js 进程管理 |
| **Node.js** | 18.x | 后端运行时 |

> ⚠️ **注意端口冲突**：宝塔 MySQL 默认 3306，Redis 默认 6379。**不要**再用 docker-compose 启动 MySQL/Redis，避免冲突。

### 9.3 创建数据库

宝塔面板 → **数据库** → **添加数据库**：

| 字段 | 值 |
|------|------|
| 数据库名 | `barhop` |
| 用户名 | `barhop_user` |
| 密码 | 自定义强密码 |
| 访问权限 | **所有人**（或指定 IP） |
| 字符集 | `utf8mb4` |

创建后，点击"导入" → 上传 `database/schema.sql` 并执行。

### 9.4 部署后端代码

```bash
# SSH 登录，克隆代码
cd /www/wwwroot
git clone https://github.com/你的GitHub用户名/BarHop.git
cd BarHop/server

# 安装依赖
npm install

# 创建 .env（参考 Step 5.2）
cp .env.example .env
vim .env
```

**宝塔环境下的 .env 特殊配置**：
```env
# MySQL（宝塔本地安装，非 Docker）
DB_HOST=localhost
DB_PORT=3306
DB_NAME=barhop
DB_USER=barhop_user
DB_PASSWORD=宝塔创建数据库时设置的密码

# Redis（宝塔本地安装）
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# 其他配置同 Step 5.2
NODE_ENV=production
PORT=3000
SERVER_BASE_URL=https://你的域名.com
# ... TENCENT_LBS_KEY / AMAP_KEY / WECHAT_APPID 等
```

### 9.5 用 PM2 启动 Node.js 服务

宝塔面板 → **软件商店** → **PM2管理器** → **设置** → **添加项目**：

| 字段 | 值 |
|------|------|
| 项目名称 | `barhop` |
| 启动文件/运行目录 | `/www/wwwroot/BarHop/server` |
| 启动选项 | `server.js` |
| Node 版本 | `18.x` |

或命令行操作：
```bash
cd /www/wwwroot/BarHop/server
pm2 start server.js --name barhop
pm2 save
pm2 startup  # 开机自启
```

验证：`curl http://localhost:3000/health`

### 9.6 配置 Nginx 反向代理（宝塔可视化）

宝塔面板 → **网站** → **添加站点**：

| 字段 | 值 |
|------|------|
| 域名 | `你的域名.com` |
| 根目录 | `/www/wwwroot/BarHop/server`（用于静态文件） |
| PHP版本 | 纯静态 |

创建后点击站点 → **设置** → **配置文件**，在 `server` 块内添加：

```nginx
# API 反向代理
location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 10m;
}

# 健康检查
location /health {
    proxy_pass http://127.0.0.1:3000;
}

# 上传文件静态访问
location /uploads/ {
    alias /www/wwwroot/BarHop/server/uploads/;
    expires 30d;
}
```

### 9.7 申请 SSL 证书（宝塔可视化）

宝塔面板 → 站点 → **设置** → **SSL** → **Let's Encrypt**：

1. 勾选你的域名
2. 点击"申请"
3. 申请成功后开启"强制 HTTPS"

> 📌 使用宝塔申请证书前，需先在腾讯云完成域名解析（A 记录指向服务器 IP），且 80 端口已开放。

### 9.8 宝塔防火墙配置

宝塔面板 → **安全** → 放行端口：

| 端口 | 用途 |
|------|------|
| 80 | HTTP |
| 443 | HTTPS |
| 8888 | 宝塔面板（建议改默认端口） |

> ⚠️ **不要**放行 3000、3306、6379 到公网，它们只在本机使用。

---

## 十、API Key 申请指引

### 10.1 腾讯地图 LBS Key（必填）

1. 访问 [腾讯位置服务](https://lbs.qq.com/)
2. 注册/登录账号（建议用微信扫码）
3. 控制台 → **应用管理** → **创建应用**
4. 应用创建后点击"添加 Key"
5. **Key 名称**：`BarHop`
6. **启用产品**：勾选 `WebService API`（地点搜索）
7. **域名白名单**：留空（后端调用无需）
8. 创建后复制 Key，填入服务器 `.env` 的 `TENCENT_LBS_KEY`

> 配额：个人开发者免费 10,000 次/日

### 10.2 高德地图 Key（推荐）

1. 访问 [高德开放平台](https://console.amap.com/)
2. 注册/登录账号
3. 控制台 → **应用管理** → **创建新应用**
4. 应用创建后点击"添加 Key"
5. **Key 名称**：`BarHop`
6. **服务平台**：选择 `Web服务`
7. 创建后复制 Key，填入服务器 `.env` 的 `AMAP_KEY`

> 配额：免费版 4 QPS，月 300,000 次。代码已实现 250ms 限流。

### 10.3 微信小程序凭证

1. 访问 [微信公众平台](https://mp.weixin.qq.com/)
2. 登录小程序账号
3. **开发管理** → **开发设置**
4. 复制 **AppID** → 填入 `.env` 的 `WECHAT_APPID`
5. 点击 **AppSecret** 的"重置"按钮 → 生成后立即复制 → 填入 `.env` 的 `WECHAT_SECRET`

> ⚠️ AppSecret 只在重置时显示一次，请立即保存。

---

## 十一、故障排查 FAQ

### Q1: 端口被占用？

```bash
# 查看占用进程
sudo lsof -i:3000
sudo lsof -i:80

# 杀死进程
sudo kill -9 PID
```

### Q2: Docker 容器启动失败？

```bash
# 查看详细日志
docker compose -f docker-compose.yml logs app
docker compose -f docker-compose.yml logs mysql

# 检查配置
docker compose -f docker-compose.yml config

# 重新构建
docker compose -f docker-compose.yml down
docker compose -f docker-compose.yml up -d --build
```

### Q3: MySQL 连接失败？

```bash
# 检查 MySQL 状态
docker exec -it barhop-mysql mysqladmin -u root -p status

# 检查用户权限
docker exec -it barhop-mysql mysql -uroot -p -e "SELECT user, host FROM mysql.user;"

# 检查防火墙
sudo ufw status
```

### Q4: 微信小程序连接不上服务器？

1. 检查服务器域名是否配置正确
2. 确认 HTTPS 证书有效
3. 确认域名已备案
4. 检查 Nginx 配置是否正确
5. 确认 443 端口已开放

### Q5: 图片显示不出来？

```bash
# 检查上传目录权限
sudo chown -R www-data:www-data /opt/BarHop/server/uploads
sudo chmod -R 755 /opt/BarHop/server/uploads

# 检查 Nginx 静态文件配置
sudo nginx -t
```

### Q6: 磁盘空间不足？

```bash
# 查看磁盘使用
df -h

# 清理 Docker 无用资源
docker system prune -a

# 清理旧日志
sudo truncate -s 0 /var/log/nginx/access.log
sudo truncate -s 0 /var/log/nginx/error.log

# 清理旧备份
find /opt/backups -mtime +30 -delete
```

### Q7: 查看实时日志

```bash
# 实时查看所有服务日志
docker compose -f docker-compose.yml logs -f

# 只看 app 日志
docker compose -f docker-compose.yml logs -f app

# 只看最近 100 行
docker compose -f docker-compose.yml logs --tail 100 app
```

### Q8: 完全重置环境

```bash
# 停止所有服务
docker compose -f docker-compose.yml down -v

# 删除所有镜像
docker rmi $(docker images -q) -f

# 重新部署
docker compose -f docker-compose.yml up -d --build
```

---

## 十二、性能优化建议

### Docker 资源限制

```yaml
# docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          memory: 256M
```

### MySQL 调优

```ini
# my.cnf
[mysqld]
innodb_buffer_pool_size = 256M
max_connections = 100
innodb_log_file_size = 64M
```

### Nginx Gzip 压缩

```nginx
# /etc/nginx/nginx.conf
gzip on;
gzip_types text/plain text/css application/json application/javascript;
gzip_min_length 1000;
```

### Node.js 内存优化

```javascript
// 设置环境变量
NODE_OPTIONS=--max-old-space-size=512
```

---

## 十三、常用命令速查表

```bash
# === Docker ===
docker compose up -d --build                                # 启动所有服务
docker compose ps                                            # 查看服务状态
docker compose logs -f                                       # 查看日志
docker compose restart                                       # 重启服务
docker compose down                                          # 停止服务
docker compose -f docker-compose.yml down -v         # 停止并删除数据卷

# === 代码更新 ===
cd /opt/BarHop && git pull                                 # 拉取最新代码
docker compose -f docker-compose.yml up -d --build   # 重新构建并启动

# === 数据库 ===
docker exec -it barhop-mysql mysql -u root -p              # 进入 MySQL
docker exec barhop-mysql mysqldump -u root -p密码 barhop > backup.sql  # 备份
docker exec -i barhop-mysql mysql -u root -p密码 barhop < backup.sql   # 恢复

# === Redis ===
docker exec -it barhop-redis redis-cli                    # 进入 Redis
docker exec barhop-redis redis-cli FLUSHALL               # 清空缓存

# === Nginx ===
sudo nginx -t                                              # 测试配置
sudo systemctl restart nginx                              # 重启 Nginx
sudo tail -f /var/log/nginx/access.log                    # 查看访问日志

# === HTTPS ===
sudo certbot renew                                        # 续期证书
sudo certbot certificates                                 # 查看证书

# === 系统 ===
sudo ufw status                                           # 防火墙状态
df -h                                                     # 磁盘使用
free -h                                                    # 内存使用
htop                                                       # 进程监控
```

---

## 十四、生产环境实际部署走查（宿主机 Nginx + PM2 方案）

> 本章节记录 **barhop.asia** 真实上线过程中采用的方案。
> 服务器：腾讯云轻量 2核4G Ubuntu 22.04 / IPv4 42.194.201.142 / 域名 barhop.asia（ICP+公安已备案）
>
> 与第三章"全 Docker 方案"的差异：
> - Node.js 后端**不在 Docker 里构建**（Alpine 编译工具构建需 20+ 分钟），改为宿主机 PM2 直接跑
> - Nginx **装在宿主机**（非 Docker 容器），方便 Certbot 自动续期证书 & 管理多站点
> - MySQL / Redis 仍走 Docker（避免在宿主机手动配密码、字符集、自启）
>
> 选择此方案的原因：**Node.js 在 Alpine 镜像中 RUN apk add python3 make g++ 步骤极慢（18min+），改为宿主机 node+npm 几分钟即可完成。**

### 14.1 架构概览

```
                ┌───────────────────────────────────────────┐
                │        用户（微信小程序 / HTTPS 443）       │
                └────────────────────┬──────────────────────┘
                                     ▼
           ┌─────────────────────────────────────────────────┐
           │              Ubuntu 宿主机 (barhop.asia)         │
           │                                                   │
           │  Nginx (宿主机 apt install 安装, :80/:443)       │
           │    - SSL 终止 (Let's Encrypt, /etc/letsencrypt)  │
           │    - proxy_pass http://127.0.0.1:3000            │
           │    - 静态资源 /opt/BarHop/server/uploads         │
           └────────────────────┬──────────────────────────────┘
                                │
   ┌────────────────────────────┼──────────────────────────────┐
   ▼                            ▼                              ▼
 PM2 (宿主机)                Docker                        Docker
 node:18 (nvm)            mysql:8.0                     redis:7-alpine
 port :3000               port 3307->3306                port 6379
 /opt/BarHop/server       数据卷 mysql_data               数据卷 redis_data
 appid / secret           字符集 utf8mb4                 --requirepass barhop_redis
   读取 .env 软链接         schema.sql 自动初始化
```

### 14.2 服务器规格与前置状态

| 项目 | 实际值 |
|------|--------|
| 服务器 | 腾讯云轻量应用服务器 Ubuntu 22.04 |
| 规格 | 2 核 4G 内存 / 50G SSD |
| 内存 | 3.6 GiB / Swap 1.9 GiB（**轻量自带 Swap，无需重建**）|
| Docker Engine | Docker v29.6.1（**镜像预装，无需 apt 安装**）|
| Docker Compose | docker compose v2（plugin） |
| 公网 IP | 42.194.201.142 |
| 域名 | barhop.asia（ICP + 公安联网备案通过）|
| DNS 解析 | A 记录 `@` / `www` → 42.194.201.142 |

### 14.3 步骤一：基础安全 + 防火墙

SSH 加固**暂未执行**（生产跑起来再做），当前仍使用 `ssh root@42.194.201.142`。

```bash
# UFW 放行必要端口（22 保留、2222 预留给加固、80/443 必须）
apt update && apt install ufw -y
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 2222/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

> ⚠️ **两边都要开端口**：UFW + 腾讯云控制台「实例 → 防火墙」中都要加 80/443。

### 14.4 步骤二：安装 Node.js 18 + PM2 + Nginx

```bash
# 1. nvm 装 Node.js 18
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
node -v     # v18.x

# 2. 全局 PM2 + 淘宝源加速
npm config set registry https://registry.npmmirror.com
npm install -g pm2

# 3. 宿主机 Nginx（反向代理 + SSL）
apt install nginx -y
systemctl enable nginx
systemctl start nginx
```

### 14.5 步骤三：克隆代码 + 配置 .env

```bash
cd /opt
git clone https://github.com/<你的账号>/BarHop.git
cd BarHop

# 生成 JWT 密钥（用 openssl，不依赖 node）
JWT_SECRET_VAL=$(openssl rand -hex 64)

cat > /opt/BarHop/.env << EOF
NODE_ENV=production
PORT=3000
SERVER_BASE_URL=https://barhop.asia

# 注意：宿主机 server 访问 Docker mysql/redis 要用 127.0.0.1 + 映射端口
DB_HOST=127.0.0.1
DB_PORT=3307
DB_NAME=barhop
DB_USER=barhop_user
DB_PASSWORD=barhop_pass

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=barhop_redis

JWT_SECRET=${JWT_SECRET_VAL}

# 微信公众平台 → 开发管理 → 开发设置
WECHAT_APPID=wxb83650bafb225674
WECHAT_SECRET=<重置后的AppSecret>

# 腾讯地图 LBS：控制台 → 创建 WebService API Key
TENCENT_LBS_KEY=<腾讯LBS Key>

# 高德开放平台：新建应用 → 添加 Key → 服务平台必须是"Web服务"
AMAP_KEY=<高德Web服务Key>
EOF

# 关键：server 目录也要能读到 .env（dotenv 从 cwd 往上找）
ln -sf /opt/BarHop/.env /opt/BarHop/server/.env
ls -la /opt/BarHop/server/.env   # 应该显示软链接指向 /opt/BarHop/.env
```

> 🚩 **血泪教训**：PM2 的 cwd 是 `/opt/BarHop/server`，如果这里没有 `.env`（或软链接），`require('dotenv').config()` 找不到文件，`WECHAT_APPID` 会是空字符串，后端返回 `"微信登录未配置"`。

### 14.6 步骤四：启动 MySQL + Redis（Docker）

```bash
cd /opt/BarHop
docker compose -f docker-compose.prod.yml up -d mysql redis
sleep 10
docker compose -f docker-compose.prod.yml ps
# barhop-mysql   Up (healthy)  0.0.0.0:3307->3306/tcp
# barhop-redis   Up (healthy)  0.0.0.0:6379->6379/tcp
```

schema.sql 通过 volume 挂载到 `/docker-entrypoint-initdb.d/01-schema.sql`，**容器首次启动自动执行**。

### 14.7 步骤五：启动后端（PM2）

```bash
cd /opt/BarHop/server
npm config set registry https://registry.npmmirror.com
npm install
mkdir -p uploads logs

pm2 start server.js --name barhop-server
pm2 save
pm2 startup              # 按提示复制执行返回的命令（enable 开机自启）

# 检查启动是否正常
pm2 status
#  barhop-server  online
pm2 logs barhop-server --lines 30
#  应出现：Server running on port 3000

# 健康检查
curl http://localhost:3000/health
#  {"code":0,"message":"BarHop Server is running","data":{"database":"connected","dbTest":1}}
```

### 14.8 步骤六：Nginx 反向代理 + HTTPS

#### 6.1 写 HTTP 站点配置

```bash
cat > /etc/nginx/sites-available/barhop << 'NGINXEOF'
server {
    listen 80;
    server_name barhop.asia www.barhop.asia;

    location ~ /\. {
        deny all;
    }

    location /uploads/ {
        alias /opt/BarHop/server/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin *;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50m;
    }

    location /health {
        proxy_pass http://127.0.0.1:3000;
        access_log off;
    }

    location / {
        return 404 '{"code":-1,"message":"BarHop API Server"}';
        add_header Content-Type application/json;
    }
}
NGINXEOF

# 启用 + 禁用默认
ln -sf /etc/nginx/sites-available/barhop /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

# 验证 HTTP
curl http://barhop.asia/health
```

#### 6.2 申请 Let's Encrypt 免费证书（HTTPS）

```bash
apt install certbot python3-certbot-nginx -y

# --nginx 模式：certbot 自动改 nginx 配置加 443 server 块
certbot --nginx -d barhop.asia -d www.barhop.asia
# 流程：输入邮箱 → A 同意 → N 不分享邮箱 → 2 强制 HTTPS

# 验证 HTTPS
curl https://barhop.asia/health
curl -X POST https://barhop.asia/api/bars/nearby \
  -H "Content-Type: application/json" \
  -d '{"lat":30.5728,"lng":104.0668,"radius":5000}'

# 自动续期 crontab（每月 1 号 3:00 检查）
crontab -l 2>/dev/null | { cat; echo "0 3 1 * * certbot renew --quiet >> /var/log/letsencrypt/renew.log 2>&1"; } | crontab -
crontab -l
```

### 14.9 步骤七：修复 schema 字段缺失

真实运行中发现 **bars 表缺少后端 SQL 引用的字段**：
- [favorites.js 查询](file:///e:/coding/selfCoding/BarHop/server/controllers/favorites.js#L80) 引用了 `b.user_rating, b.user_review_count`
- 但 [schema.sql](file:///e:/coding/selfCoding/BarHop/database/schema.sql) 的 bars 建表语句没有这两列
- 报错：`Unknown column 'b.user_rating' in 'field list'`

```bash
# 给 bars 表补齐字段
docker exec -i barhop-mysql mysql -u barhop_user -pbarhop_pass barhop << 'SQL'
ALTER TABLE bars ADD COLUMN user_rating DECIMAL(2,1) DEFAULT 0.0 COMMENT '用户评分';
ALTER TABLE bars ADD COLUMN user_review_count INT DEFAULT 0 COMMENT '用户评价数';
SQL

# 验证
docker exec barhop-mysql mysql -u barhop_user -pbarhop_pass barhop -e "SHOW COLUMNS FROM bars LIKE 'user_%';"
```

> ⚠️ 建议把这两条 ALTER 写进 schema.sql 末尾（下次新部署自动补齐）。

### 14.10 步骤八：微信小程序前端配置

1. **公众平台服务器域名**：[mp.weixin.qq.com](https://mp.weixin.qq.com) → 开发管理 → 开发设置 → 服务器域名
   - request / uploadFile / downloadFile 全部填：`https://barhop.asia`
   - 必须是 HTTPS、不能带端口、必须备案
2. **本地代码修改**：
   - `miniprogram/utils/config.js`：`API_BASE_URL = 'https://barhop.asia'`
   - `miniprogram/project.config.json`：`"urlCheck": true`
3. **开发者工具 → 详情 → 本地设置**：取消勾选"不校验合法域名"
4. 重新编译，跑通 13 项功能测试

### 14.11 日常运维速查（实际架构）

```bash
# 后端
pm2 status                                     # 状态
pm2 restart barhop-server                      # 重启
pm2 logs barhop-server --lines 50              # 日志
pm2 logs barhop-server --err                   # 错误日志

# MySQL + Redis
cd /opt/BarHop
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml restart mysql redis
docker compose -f docker-compose.prod.yml logs -f mysql
docker exec -it barhop-mysql mysql -u barhop_user -pbarhop_pass barhop
docker exec -it barhop-redis redis-cli -a barhop_redis

# Nginx
nginx -t                                       # 改配置后先测语法
systemctl restart nginx
tail -n 100 /var/log/nginx/error.log

# HTTPS 证书
certbot certificates                           # 查有效期
certbot renew                                  # 立即续期

# 后端全栈重启（比如改了 .env）
pm2 restart barhop-server
# HTTPS 健康检查
curl https://barhop.asia/health

# 更新代码
cd /opt/BarHop
git pull
cd server && npm install
pm2 restart barhop-server
```

### 14.12 常见报错速查（已踩过的坑）

| 报错 / 现象 | 根因 | 修复 |
|------------|------|------|
| `{"message":"微信登录未配置"}` | `/opt/BarHop/server/` 没有 `.env`，dotenv 读不到 `WECHAT_APPID` | `ln -sf /opt/BarHop/.env /opt/BarHop/server/.env` 再 `pm2 restart` |
| 收藏接口报 `Unknown column 'b.user_rating'` | schema.sql 缺少 `user_rating`、`user_review_count` 字段 | `ALTER TABLE bars ADD COLUMN ...` |
| 高德日志刷 `USERKEY_PLAT_NOMATCH` | 高德 Key 创建时服务平台选错了 | 删除重建，**服务平台必须选"Web服务"**；新 Key 等 5-10 分钟生效 |
| `docker build` 在 `apk add python3 make g++` 卡 18 分钟 | Alpine apk 国内源慢 | 放弃 Docker 内建 Node，改用宿主机 PM2（本章方案）|
| curl 命令 URL 加了反引号导致参数乱码 | shell 会把 `` `url` `` 当作命令替换执行 | URL 直接写或用单引号包起来，不要用反引号 |
| 小程序开发者工具提示"不校验合法域名"才能跑 | 微信公众平台"服务器域名"没配或没生效 | 配 `https://barhop.asia`，等 2-5 分钟 |
| wx.request 报 "invalid url not in domain list" | 同上 + urlCheck: true 强制校验 | 配服务器域名 / 临时勾选"不校验"测试 |

---

## 十五、新会话继承说明

> 本项目第 1 次部署会话（共 ~50 轮）已完成以下里程碑。如开新会话，请告知助手从下列"当前状态"继续。

### 当前状态（2026-08-27）

- ✅ 服务器初始化：Docker 29.6.1 预装、UFW 放行 22/2222/80/443、Swap 1.9G
- ✅ DNS：barhop.asia A 记录 @/www → 42.194.201.142
- ✅ 后端服务（宿主机 PM2）：`barhop-server` online，HTTP/HTTPS health 正常
- ✅ MySQL/Redis：Docker 容器 running（3307→3306 / 6379）
- ✅ Nginx + HTTPS：宿主机 nginx + certbot 证书，自动续期 crontab 已配
- ✅ 数据库 schema 修复：bars 表补齐 user_rating、user_review_count
- ✅ 前端代码：config.js API_BASE_URL 改为 `https://barhop.asia`，project.config.json urlCheck=true
- ⚠️ 高德 Key：已换新 Key（701064e2a...），如仍刷 USERKEY_PLAT_NOMATCH 则确认控制台服务平台是否"Web服务"并等待生效
- ⚠️ 上传目录 owner：`/opt/BarHop/server/uploads` 当前 root:root，如出现图片上传报错执行 `chown -R www-data:www-data /opt/BarHop/server/uploads`
- ⚠️ SSH 安全加固：暂未执行（当前仍 root 登录 22 端口）；建议稳定后做
- ⚠️ 酒吧 seed 数据 photos：数据库中默认图片指向 Trae IDE 内部图床（用户手机无法访问）；建议换成本地默认图或真实 Amap/腾讯图

### 建议继续推进的优先级

1. 开发者工具跑通 13 项功能测试 → 修复图片破图（seed photos 换真实资源）
2. 开发者工具上传体验版 → 真机验证（重点 wx.request 合法域名）
3. 微信公众平台提交审核（类目：生活服务→餐饮）→ 发布
4. 服务器加固：SSH 非默认端口 + 禁用 root 登录 + 密钥登录
5. 数据库定时备份：crontab 每日 mysqldump

### 项目绝对路径（给助手看）

- 项目根：`e:\coding\selfCoding\BarHop`
- 前端：`e:\coding\selfCoding\BarHop\miniprogram\`
- 后端：`e:\coding\selfCoding\BarHop\server\`
- Docker compose：`e:\coding\selfCoding\BarHop\docker-compose.prod.yml`
- 部署文档：`e:\coding\selfCoding\BarHop\DEPLOY.md`
- 命令速查：`e:\coding\selfCoding\BarHop\docs\COMMANDS.md`
- 服务器后端实际目录：`/opt/BarHop/server`
- 服务器 .env：`/opt/BarHop/.env`（/opt/BarHop/server/.env 是软链接）
- Nginx 配置：`/etc/nginx/sites-available/barhop`
- HTTPS 证书：`/etc/letsencrypt/live/barhop.asia/`
