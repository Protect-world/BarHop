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

---

## 一、部署架构总览

```
                    ┌──────────────────────────────────────┐
                    │           用户（微信小程序）            │
                    └───────────────┬──────────────────────┘
                                    │ HTTPS
                                    ▼
              ┌─────────────────────────────────────────────┐
              │            云服务器（Linux）                │
              │  ┌────────────────────────────────────────┐ │
              │  │  Nginx (80/443) 反向代理 + 静态资源   │ │
              │  └────────────────┬───────────────────────┘ │
              │                   │ proxy_pass             │
              │  ┌────────────────▼───────────────────────┐ │
              │  │  Node.js Server (3000) Express API    │ │
              │  └────┬──────────────────────┬────────────┘ │
              │       │                      │              │
              │  ┌────▼─────────┐   ┌────────▼─────────┐    │
              │  │  MySQL 8.0   │   │   Redis 7        │    │
              │  │  (3306)      │   │   (6379)         │    │
              │  └──────────────┘   └──────────────────┘    │
              └─────────────────────────────────────────────┘
```

**技术栈一览**：

| 组件 | 版本 | 端口 | 说明 |
|------|------|------|------|
| Ubuntu Server | 22.04 LTS | - | 操作系统 |
| Docker | 24+ | - | 容器运行时 |
| Docker Compose | v2+ | - | 容器编排 |
| Nginx | latest | 80, 443 | 反向代理、静态资源、SSL |
| Node.js | 18 (Alpine) | 3000 | 后端 API 服务 |
| MySQL | 8.0 | 3306 | 数据库 |
| Redis | 7 | 6379 | 缓存 |

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

# 腾讯地图 API（如果需要）
TENCENT_MAP_KEY=你的腾讯地图Key
```

#### 5.3 生成 JWT 密钥

```bash
# 在服务器上执行
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# 复制输出结果，粘贴到 .env 的 JWT_SECRET
```

---

### Step 6: 使用 Docker 部署后端服务

#### 6.1 修改 docker-compose.prod.yml

```bash
vim /opt/BarHop/docker-compose.prod.yml
```

**确认以下配置**：
```yaml
# 检查 MySQL 密码是否和 .env 一致
# 检查 Redis 密码是否和 .env 一致
# 检查端口映射
```

#### 6.2 开始部署

```bash
cd /opt/BarHop

# 构建并启动所有服务
docker compose -f docker-compose.prod.yml up -d --build

# 查看服务状态
docker compose -f docker-compose.prod.yml ps

# 查看日志
docker compose -f docker-compose.prod.yml logs -f
```

#### 6.3 初始化数据库

```bash
# 进入 MySQL 容器
docker exec -it barhop-mysql mysql -uroot -p

# 输入 root 密码（在 docker-compose.prod.yml 中配置的）

# 创建数据库和用户
CREATE DATABASE IF NOT EXISTS barhop CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'barhop_user'@'%' IDENTIFIED BY '你的密码';
GRANT ALL PRIVILEGES ON barhop.* TO 'barhop_user'@'%';
FLUSH PRIVILEGES;

# 导入数据（如果你有 SQL 文件）
# exit
# docker exec -i barhop-mysql mysql -u barhop_user -p barhop < /opt/BarHop/server/init.sql
```

#### 6.4 验证服务

```bash
# 测试 API
curl http://localhost:3000/api/bars/nearby -X POST -H "Content-Type: application/json" -d '{"lat":30.5728,"lng":104.0668,"radius":5000}'

# 应该返回：{"code":0,"data":[...]}
```

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

**修改**：`miniprogram/config/index.js`

```javascript
const config = {
  // 生产环境配置
  API_BASE_URL: 'https://你的域名.com',
  UPLOAD_URL: 'https://你的域名.com/api/upload/image',
  // ...其他配置
};
```

#### 10.2 关闭调试模式

**修改**：`miniprogram/app.js`

```javascript
// 确保没有开启 mock 模式
globalData: {
  useMock: false,  // 必须是 false
  // ...
}
```

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
docker compose -f docker-compose.prod.yml logs --tail 100

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
docker compose -f /opt/BarHop/docker-compose.prod.yml ps

# 查看日志
docker compose -f /opt/BarHop/docker-compose.prod.yml logs -f --tail 200

# 重启服务
docker compose -f /opt/BarHop/docker-compose.prod.yml restart

# 更新代码
cd /opt/BarHop
git pull
docker compose -f docker-compose.prod.yml up -d --build

# 数据库备份
docker exec barhop-mysql mysqldump -u barhop_user -p密码 barhop > /opt/barhop-backup-$(date +%Y%m%d).sql

# 恢复数据
docker exec -i barhop-mysql mysql -u barhop_user -p密码 barhop < /opt/barhop-backup-20260803.sql
```

### 紧急情况处理

```bash
# 服务挂了？
docker compose -f /opt/BarHop/docker-compose.prod.yml up -d

# MySQL 挂了？
docker compose -f /opt/BarHop/docker-compose.prod.yml restart mysql

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
tar -czf $BACKUP_DIR/config_$DATE.tar.gz /opt/BarHop/.env /opt/BarHop/docker-compose.prod.yml

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
| **月均总成本** | **¥65-85** | - |

---

## 九、故障排查 FAQ

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
docker compose -f docker-compose.prod.yml logs app
docker compose -f docker-compose.prod.yml logs mysql

# 检查配置
docker compose -f docker-compose.prod.yml config

# 重新构建
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
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
docker compose -f docker-compose.prod.yml logs -f

# 只看 app 日志
docker compose -f docker-compose.prod.yml logs -f app

# 只看最近 100 行
docker compose -f docker-compose.prod.yml logs --tail 100 app
```

### Q8: 完全重置环境

```bash
# 停止所有服务
docker compose -f docker-compose.prod.yml down -v

# 删除所有镜像
docker rmi $(docker images -q) -f

# 重新部署
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 十、性能优化建议

### Docker 资源限制

```yaml
# docker-compose.prod.yml
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

## 十一、常用命令速查表

```bash
# === Docker ===
docker compose -f docker-compose.prod.yml up -d --build   # 启动所有服务
docker compose -f docker-compose.prod.yml ps               # 查看服务状态
docker compose -f docker-compose.prod.yml logs -f         # 查看日志
docker compose -f docker-compose.prod.yml restart         # 重启服务
docker compose -f docker-compose.prod.yml down             # 停止服务
docker compose -f docker-compose.prod.yml down -v         # 停止并删除数据卷

# === 代码更新 ===
cd /opt/BarHop && git pull                                 # 拉取最新代码
docker compose -f docker-compose.prod.yml up -d --build   # 重新构建并启动

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
