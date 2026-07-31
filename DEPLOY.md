# BarHop 部署文档（Linux 服务器版）

> 本文档详细说明如何将 BarHop 项目部署到 Linux 服务器，涵盖服务器选购、环境初始化、Docker 部署、Nginx 反向代理、HTTPS 证书、微信小程序配置、监控运维等全流程。
>
> 项目已托管到 GitHub，部署步骤从「服务器选购」开始。

---

## 目录

- [一、部署架构总览](#一部署架构总览)
- [二、选购云服务器](#二选购云服务器)
- [三、服务器初始化](#三服务器初始化)
- [四、安装 Docker 环境](#四安装-docker-环境)
- [五、部署 BarHop 项目](#五部署-barhop-项目)
- [六、配置 Nginx 反向代理](#六配置-nginx-反向代理)
- [七、申请 HTTPS 证书](#七申请-https-证书)
- [八、配置防火墙与安全组](#八配置防火墙与安全组)
- [九、配置微信小程序](#九配置微信小程序)
- [十、验证部署是否成功](#十验证部署是否成功)
- [十一、日常运维命令](#十一日常运维命令)
- [十二、日志与监控](#十二日志与监控)
- [十三、自动备份方案](#十三自动备份方案)
- [十四、持续集成/持续部署（CI/CD）](#十四持续集成持续部署cicd)
- [十五、性能优化建议](#十五性能优化建议)
- [十六、故障排查 FAQ](#十六故障排查-faq)

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

---

## 二、选购云服务器

### 2.1 推荐云服务商

| 服务商 | 官网 | 优势 | 适用场景 |
|--------|------|------|---------|
| 阿里云 ECS | [aliyun.com](https://www.aliyun.com) | 国内节点丰富、备案方便 | 国内用户为主 |
| 腾讯云 CVM | [cloud.tencent.com](https://cloud.tencent.com) | 性价比高、微信生态整合好 | 微信小程序后端首选 |
| 华为云 ECS | [huaweicloud.com](https://www.huaweicloud.com) | 企业级稳定性 | 企业级项目 |
| Vultr | [vultr.com](https://www.vultr.com) | 海外节点多、按小时计费 | 海外用户 |
| DigitalOcean | [digitalocean.com](https://www.digitalocean.com) | 简单易用、社区好 | 个人项目 |

> **微信小程序后端建议**：优先选择腾讯云，与微信生态集成最好，备案流程更顺畅。

### 2.2 推荐配置

#### 入门级（开发/演示，月费 ¥50-100）
- CPU：1 核
- 内存：2GB
- 硬盘：40GB SSD
- 带宽：1-3 Mbps
- 系统：Ubuntu 22.04 LTS

#### 标准级（小规模生产，月费 ¥150-300）⭐ 推荐
- CPU：2 核
- 内存：4GB
- 硬盘：60GB SSD
- 带宽：5 Mbps
- 系统：Ubuntu 22.04 LTS

#### 生产级（中等规模，月费 ¥500+）
- CPU：4 核
- 内存：8GB
- 硬盘：100GB SSD
- 带宽：10 Mbps
- 系统：Ubuntu 22.04 LTS

### 2.3 操作系统选择

**强烈推荐 Ubuntu 22.04 LTS**：
- 长期支持版本，支持到 2027 年
- 社区文档丰富，问题容易解决
- Docker 兼容性最好
- 软件包管理方便（apt）

> 也可以选择 CentOS 7+ / Debian 11+，命令略有不同（yum 替代 apt）。

### 2.4 购买后必做的事

1. **记录服务器信息**：公网 IP、初始密码、SSH 端口（默认 22）
2. **配置安全组**：开放必要端口（见第八节）
3. **测试 SSH 连接**：确认能从本地连上服务器

---

## 三、服务器初始化

### 3.1 连接服务器

```bash
# 在本地终端（Windows 用 PowerShell，Mac/Linux 用 Terminal）
ssh root@你的服务器IP

# 例如：
ssh root@123.45.67.89

# 首次连接会提示是否信任主机，输入 yes 并回车
# 然后输入密码（输入时不会显示字符，这是正常的）
```

**推荐使用 SSH 密钥登录（更安全）**：

```bash
# 在本地生成密钥对（如果没有）
ssh-keygen -t rsa -b 4096 -C "barhop-server"

# 将公钥上传到服务器
ssh-copy-id root@你的服务器IP

# 之后登录无需密码
ssh root@你的服务器IP
```

### 3.2 创建非 root 用户（安全最佳实践）

```bash
# 创建新用户（替换 barhop 为你喜欢的用户名）
adduser barhop

# 按提示设置密码和用户信息

# 赋予 sudo 权限
usermod -aG sudo barhop

# 切换到新用户
su - barhop
```

### 3.3 禁用 root SSH 登录（可选但推荐）

```bash
# 编辑 SSH 配置
sudo nano /etc/ssh/sshd_config

# 找到以下行并修改
PermitRootLogin no
PasswordAuthentication no  # 如果已配置密钥登录

# 重启 SSH 服务
sudo systemctl restart sshd
```

> ⚠️ 修改前请确保新用户的 SSH 密钥已配置好，否则可能无法登录！

### 3.4 系统更新与基础工具

```bash
# 更新软件包列表
sudo apt update

# 升级已安装的软件包
sudo apt upgrade -y

# 安装基础工具
sudo apt install -y \
    curl \
    wget \
    git \
    vim \
    nano \
    htop \
    unzip \
    build-essential \
    ca-certificates \
    gnupg \
    lsb-release \
    software-properties-common

# 设置时区为上海
sudo timedatectl set-timezone Asia/Shanghai

# 验证时间
date
```

### 3.5 配置 Swap 分区（小内存服务器必做）

> 2GB 内存的服务器强烈建议配置 Swap，否则 MySQL 容易 OOM。

```bash
# 创建 2GB 的 Swap 文件
sudo fallocate -l 2G /swapfile

# 设置权限
sudo chmod 600 /swapfile

# 格式化为 Swap
sudo mkswap /swapfile

# 启用 Swap
sudo swapon /swapfile

# 永久生效（写入 fstab）
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 优化 Swap 配置
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 验证
free -h
```

### 3.6 配置防火墙（UFW）

```bash
# 安装 UFW（通常已预装）
sudo apt install -y ufw

# 默认策略：拒绝入站，允许出站
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 允许 SSH（重要！否则会把自己锁在外面）
sudo ufw allow ssh
# 或者如果改了 SSH 端口：sudo ufw allow 2222/tcp

# 允许 HTTP 和 HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 启用防火墙
sudo ufw enable

# 查看状态
sudo ufw status verbose
```

---

## 四、安装 Docker 环境

### 4.1 安装 Docker Engine

```bash
# 卸载旧版本（如果有）
sudo apt remove -y docker docker-engine docker.io containerd runc

# 添加 Docker 官方 GPG 密钥
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 添加 Docker 仓库
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 更新包列表
sudo apt update

# 安装 Docker
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 启动并设置开机自启
sudo systemctl enable docker
sudo systemctl start docker

# 验证安装
docker --version
# Docker version 24.x.x

# 运行测试容器
sudo docker run hello-world
```

> **国内服务器加速**：如果拉取镜像慢，配置国内镜像源：
> ```bash
> sudo mkdir -p /etc/docker
> sudo tee /etc/docker/daemon.json <<EOF
> {
>   "registry-mirrors": [
>     "https://docker.mirrors.ustc.edu.cn",
>     "https://hub-mirror.c.163.com",
>     "https://mirror.baidubce.com"
>   ],
>   "log-driver": "json-file",
>   "log-opts": {
>     "max-size": "10m",
>     "max-file": "3"
>   }
> }
> EOF
> sudo systemctl daemon-reload
> sudo systemctl restart docker
> ```

### 4.2 配置 Docker 用户组

```bash
# 将当前用户加入 docker 组（免 sudo 运行 docker 命令）
sudo usermod -aG docker $USER

# 重新登录使组生效
exit
# 重新 SSH 登录

# 验证（不需要 sudo）
docker ps
```

### 4.3 验证 Docker Compose

```bash
# Docker Compose V2 作为插件集成（推荐方式）
docker compose version
# Docker Compose version v2.x.x
```

> **注意**：本项目使用 `docker compose`（带空格，V2 语法），而非 `docker-compose`（带连字符，V1 语法）。

---

## 五、部署 BarHop 项目

### 5.1 克隆项目

```bash
# 进入部署目录
cd /opt

# 克隆项目（替换为你的 GitHub 仓库地址）
sudo git clone https://github.com/你的用户名/BarHop.git

# 修改所有者
sudo chown -R $USER:$USER /opt/BarHop

# 进入项目目录
cd /opt/BarHop

# 查看项目结构
ls -la
```

### 5.2 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 生成强密码（建议使用随机字符串）
openssl rand -base64 32  # 用于 JWT_SECRET
openssl rand -base64 16  # 用于 MySQL 密码
openssl rand -base64 16  # 用于 Redis 密码

# 编辑配置文件
nano .env
```

**`.env` 文件配置示例**：

```env
# ============================================
# BarHop 生产环境配置
# ============================================

# 服务配置
SERVER_PORT=3000
SERVER_BASE_URL=https://你的域名.com
NODE_ENV=production

# MySQL 数据库配置（使用上方生成的随机密码）
MYSQL_ROOT_PASSWORD=替换为生成的强密码
MYSQL_DATABASE=barhop
MYSQL_USER=barhop_user
MYSQL_PASSWORD=替换为生成的强密码

# Redis 配置
REDIS_PASSWORD=替换为生成的强密码

# JWT 配置（至少 32 位字符）
JWT_SECRET=替换为生成的32位以上随机字符串

# 微信小程序配置（从微信公众平台获取）
WECHAT_APPID=你的小程序AppID
WECHAT_SECRET=你的小程序Secret

# 高德地图配置（从高德开放平台获取）
AMAP_KEY=你的高德地图Key
```

> ⚠️ **安全提示**：
> - `.env` 文件包含敏感信息，**千万不要提交到 Git**
> - 确认 `.gitignore` 中已包含 `.env`
> - 文件权限设置为 `chmod 600 .env`

```bash
# 设置文件权限（仅所有者可读写）
chmod 600 .env
```

### 5.3 创建必要目录

```bash
# 创建上传目录
mkdir -p server/uploads
touch server/uploads/.gitkeep

# 创建日志目录
mkdir -p server/logs

# 创建 Nginx 配置目录（通常已存在）
mkdir -p nginx/conf.d
```

### 5.4 检查数据库初始化脚本

```bash
# 确认 schema.sql 存在
ls -la database/schema.sql

# 查看内容（前 20 行）
head -20 database/schema.sql
```

> `schema.sql` 会在 MySQL 容器首次启动时自动执行（通过 docker-entrypoint-initdb.d 挂载）。

### 5.5 启动服务

#### 5.5.1 首次启动（构建镜像 + 拉取依赖镜像）

```bash
# 后台启动并构建镜像（首次约需 3-5 分钟）
docker compose -f docker-compose.prod.yml up -d --build
```

#### 5.5.2 查看启动状态

```bash
# 查看所有容器状态
docker compose -f docker-compose.prod.yml ps

# 预期输出：
# NAME              STATUS     PORTS
# barhop-mysql      Up         0.0.0.0:3307->3306/tcp
# barhop-redis       Up         0.0.0.0:6379->6379/tcp
# barhop-server      Up         0.0.0.0:3000->3000/tcp
# barhop-nginx       Up         0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
```

#### 5.5.3 查看启动日志

```bash
# 查看所有服务日志
docker compose -f docker-compose.prod.yml logs -f

# 单独查看某个服务
docker compose -f docker-compose.prod.yml logs -f mysql
docker compose -f docker-compose.prod.yml logs -f redis
docker compose -f docker-compose.prod.yml logs -f server
docker compose -f docker-compose.prod.yml logs -f nginx
```

#### 5.5.4 验证服务健康

```bash
# 测试 API 健康检查
curl http://localhost:3000/health

# 预期返回：
# {"code":0,"message":"BarHop Server is running","data":{"database":"connected","dbTest":1}}

# 测试 API 文档端点
curl http://localhost:3000/api

# 预期返回 API 端点列表
```

### 5.6 数据库初始化说明

MySQL 容器**首次启动**时会自动执行 `database/schema.sql` 创建表结构。如果需要重新初始化：

```bash
# ⚠️ 危险操作：会删除所有数据！
docker compose -f docker-compose.prod.yml down -v  # 删除数据卷
docker compose -f docker-compose.prod.yml up -d --build  # 重新启动
```

### 5.7 导入测试数据（可选）

```bash
# 如果有测试数据 SQL 文件
docker exec -i barhop-mysql mysql -u barhop_user -p你的密码 barhop < test_data.sql
```

---

## 六、配置 Nginx 反向代理

### 6.1 Nginx 配置说明

Nginx 配置文件位于 [nginx/conf.d/barhop.conf](file:///e:/coding/selfCoding/BarHop/nginx/conf.d/barhop.conf)，已包含以下功能：

- 静态文件服务（`/uploads/` 路径）
- API 反向代理（`/api/` 路径）
- 健康检查代理（`/health`）
- 文件上传大小限制（50MB）
- 安全防护（禁止访问隐藏文件）

### 6.2 配置域名（如果有）

编辑 `nginx/conf.d/barhop.conf`：

```bash
nano nginx/conf.d/barhop.conf
```

修改 `server_name` 为你的域名：

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;  # 改为你的域名
    
    # ... 其他配置保持不变
}
```

### 6.3 重启 Nginx 使配置生效

```bash
docker compose -f docker-compose.prod.yml restart nginx
```

### 6.4 验证 Nginx 配置

```bash
# 测试配置语法
docker exec barhop-nginx nginx -t

# 重新加载配置（不中断服务）
docker exec barhop-nginx nginx -s reload
```

### 6.5 配置 HTTPS（强烈推荐）

见下一节申请 SSL 证书。

---

## 七、申请 HTTPS 证书

微信小程序**强制要求后端必须是 HTTPS**，因此必须配置 SSL 证书。

### 7.1 方式一：Let's Encrypt 免费证书（推荐）

#### 7.1.1 安装 Certbot

```bash
# 安装 certbot
sudo apt install -y certbot

# 停止 Nginx 释放 80 端口（因为 Let's Encrypt 需要 80 端口验证）
docker compose -f docker-compose.prod.yml stop nginx
```

#### 7.1.2 申请证书

```bash
# 替换 your-domain.com 为你的域名
# -d 后面跟你的域名，可以加多个
sudo certbot certonly \
    --standalone \
    -d your-domain.com \
    -d www.your-domain.com \
    --email your-email@example.com \
    --agree-tos \
    --no-eff-email

# 成功后证书位置：
# 证书：/etc/letsencrypt/live/your-domain.com/fullchain.pem
# 私钥：/etc/letsencrypt/live/your-domain.com/privkey.pem
```

#### 7.1.3 配置 Nginx 使用证书

修改 `nginx/conf.d/barhop.conf`，**完整替换**为：

```nginx
upstream barhop_backend {
    server server:3000;
}

# HTTP 重定向到 HTTPS
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$host$request_uri;
}

# HTTPS 主服务
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;
    
    # SSL 证书配置
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    
    # 安全响应头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    
    # 禁止访问隐藏文件
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    # 上传文件静态服务
    location /uploads/ {
        alias /var/www/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin *;
    }
    
    # API 代理
    location /api/ {
        proxy_pass http://barhop_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 文件上传大小限制
        client_max_body_size 50m;
        proxy_max_temp_file_size 0;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # 健康检查
    location /health {
        proxy_pass http://barhop_backend;
        access_log off;
    }
    
    # 默认返回 404
    location / {
        return 404 '{"code":-1,"message":"BarHop API Server"}';
        add_header Content-Type application/json;
    }
}
```

#### 7.1.4 修改 docker-compose 挂载证书

编辑 `docker-compose.prod.yml`，在 nginx 服务的 volumes 中添加证书挂载：

```yaml
  nginx:
    # ... 其他配置
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d
      - ./server/uploads:/var/www/uploads
      - /etc/letsencrypt/live/your-domain.com/fullchain.pem:/etc/nginx/ssl/fullchain.pem:ro
      - /etc/letsencrypt/live/your-domain.com/privkey.pem:/etc/nginx/ssl/privkey.pem:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
```

> 注意：直接挂载单个文件可能导致证书续期后不生效。推荐方式是挂载整个 `/etc/letsencrypt` 目录，并在 Nginx 配置中引用完整路径：
> ```nginx
> ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
> ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
> ```

#### 7.1.5 启动并验证

```bash
# 重新启动所有服务
docker compose -f docker-compose.prod.yml up -d

# 测试 HTTPS
curl https://your-domain.com/health
```

#### 7.1.6 配置自动续期

Let's Encrypt 证书有效期 90 天，需要定期续期。

```bash
# 测试续期命令（不会真正续期）
sudo certbot renew --dry-run

# 添加定时任务：每周一凌晨 3 点检查并续期
sudo crontab -e

# 添加以下行：
0 3 * * 1 certbot renew --quiet --post-hook "docker restart barhop-nginx"
```

### 7.2 方式二：使用云服务商免费证书

阿里云、腾讯云都提供免费 1 年的 SSL 证书：

1. 在云控制台申请免费证书
2. 下载 Nginx 格式的证书（.pem 和 .key 文件）
3. 上传到服务器：

```bash
# 在服务器创建目录
sudo mkdir -p /opt/BarHop/nginx/ssl

# 上传证书文件（在本地执行）
scp your-domain.pem root@服务器IP:/opt/BarHop/nginx/ssl/
scp your-domain.key root@服务器IP:/opt/BarHop/nginx/ssl/
```

4. 修改 `docker-compose.prod.yml`：

```yaml
  nginx:
    volumes:
      - ./nginx/ssl:/etc/nginx/ssl:ro
      # ... 其他配置
```

5. Nginx 配置中使用：
```nginx
ssl_certificate /etc/nginx/ssl/your-domain.pem;
ssl_certificate_key /etc/nginx/ssl/your-domain.key;
```

### 7.3 方式三：自签名证书（仅测试用）

```bash
# 生成自签名证书
sudo openssl req -x509 -nodes -days 365 \
    -newkey rsa:2048 \
    -keyout /opt/BarHop/nginx/ssl/selfsigned.key \
    -out /opt/BarHop/nginx/ssl/selfsigned.crt \
    -subj "/C=CN/ST=Shanghai/L=Shanghai/O=BarHop/CN=your-domain.com"
```

> ⚠️ 自签名证书浏览器会警告不安全，**微信小程序不接受自签名证书**，仅用于本地测试。

---

## 八、配置防火墙与安全组

### 8.1 服务器防火墙（UFW）

```bash
# 查看当前规则
sudo ufw status

# 确保开放必要端口
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS

# 不要对外开放以下端口（仅 Docker 内部使用）：
# 3306/3307 - MySQL
# 6379      - Redis
# 3000      - Node.js（通过 Nginx 代理）
```

### 8.2 云服务商安全组

登录云控制台，在「安全组」中添加规则：

| 协议 | 端口 | 来源 | 说明 |
|------|------|------|------|
| TCP | 22 | 你的 IP | SSH 远程登录 |
| TCP | 80 | 0.0.0.0/0 | HTTP |
| TCP | 443 | 0.0.0.0/0 | HTTPS |

> **重要**：不要将 3306、6379、3000 端口开放到公网！这些端口仅限服务器内部 Docker 网络使用。

### 8.3 Docker 端口暴露问题

检查 `docker-compose.prod.yml`，确保 MySQL 和 Redis **不对宿主机暴露端口**：

```yaml
# 推荐配置（不暴露端口）
mysql:
  # 不要写 ports，仅在 Docker 网络内访问
  expose:
    - "3306"
```

如果确实需要从外部访问数据库（不推荐），用 SSH 隧道：

```bash
# 在本地执行，建立隧道
ssh -L 3306:localhost:3306 root@服务器IP

# 然后本地可以用 127.0.0.1:3306 连接数据库
```

---

## 九、配置微信小程序

### 9.1 登录微信公众平台

访问 [https://mp.weixin.qq.com](https://mp.weixin.qq.com)，用小程序管理员账号登录。

### 9.2 获取小程序凭证

1. 进入「开发」→「开发管理」→「开发设置」
2. 记录：
   - **AppID**：`wx...`（更新到服务器 `.env` 的 `WECHAT_APPID`）
   - **AppSecret**：点击「重置」获取（更新到服务器 `.env` 的 `WECHAT_SECRET`）

### 9.3 配置服务器域名

在「开发设置」→「服务器域名」中添加：

| 类型 | 域名 |
|------|------|
| request 合法域名 | `https://your-domain.com` |
| uploadFile 合法域名 | `https://your-domain.com` |
| downloadFile 合法域名 | `https://your-domain.com` |

> ⚠️ 必须是 HTTPS，不能带端口号，不能带路径。

### 9.4 更新小程序配置

修改 [miniprogram/utils/config.js](file:///e:/coding/selfCoding/BarHop/miniprogram/utils/config.js)：

```javascript
const config = {
  // 生产环境
  API_BASE_URL: 'https://your-domain.com',
  
  // 开发环境（本地调试用，注释掉）
  // API_BASE_URL: 'http://localhost:3000',
  
  // 缓存键
  CACHE_KEYS: {
    TOKEN: 'barhop_token',
    USER_INFO: 'barhop_user_info',
    // ...
  },
  
  // 请求超时
  TIMEOUT: 10000
};
```

### 9.5 上传小程序代码

1. 打开微信开发者工具
2. 导入项目 `miniprogram` 目录
3. 点击「上传」→ 填写版本号和描述
4. 在微信公众平台提交审核

---

## 十、验证部署是否成功

### 10.1 检查服务状态

```bash
# 1. 检查所有容器运行中
docker compose -f docker-compose.prod.yml ps

# 2. 检查健康状态
curl http://localhost:3000/health
# 应返回 database: connected

# 3. 检查 HTTPS 证书
curl -I https://your-domain.com/health
# 应返回 HTTP/2 200
```

### 10.2 检查 API 功能

```bash
# 测试获取酒吧列表
curl -X POST https://your-domain.com/api/bars/nearby \
    -H "Content-Type: application/json" \
    -d '{"lat": 34.2525, "lng": 108.9444, "radius": 5000}'

# 应返回酒吧数据
```

### 10.3 检查图片访问

```bash
# 测试上传的图片是否可访问
# 替换为实际图片路径
curl -I https://your-domain.com/uploads/xxx.png
# 应返回 200 OK
```

### 10.4 检查微信小程序连接

1. 打开微信开发者工具
2. 确认 `config.js` 中的 `API_BASE_URL` 已改为 `https://your-domain.com`
3. 编译运行小程序
4. 查看是否正常加载数据

---

## 十一、日常运维命令

### 11.1 服务管理

```bash
# 启动所有服务
docker compose -f docker-compose.prod.yml up -d

# 停止所有服务
docker compose -f docker-compose.prod.yml down

# 重启所有服务
docker compose -f docker-compose.prod.yml restart

# 重启单个服务
docker compose -f docker-compose.prod.yml restart server
docker compose -f docker-compose.prod.yml restart nginx

# 重新构建并启动（代码更新后）
docker compose -f docker-compose.prod.yml up -d --build server

# 查看服务状态
docker compose -f docker-compose.prod.yml ps
```

### 11.2 代码更新部署

```bash
# 进入项目目录
cd /opt/BarHop

# 拉取最新代码
git pull origin main

# 重新构建并启动
docker compose -f docker-compose.prod.yml up -d --build server

# 查看启动日志
docker compose -f docker-compose.prod.yml logs -f server
```

### 11.3 数据库管理

```bash
# 连接 MySQL（交互式）
docker exec -it barhop-mysql mysql -u barhop_user -p
# 输入密码后进入 MySQL 控制台

# 查看所有数据库
SHOW DATABASES;
USE barhop;
SHOW TABLES;

# 退出
exit;

# 备份数据库
docker exec barhop-mysql mysqldump -u root -p密码 barhop > backup.sql

# 恢复数据库
docker exec -i barhop-mysql mysql -u root -p密码 barhop < backup.sql
```

### 11.4 Redis 管理

```bash
# 连接 Redis
docker exec -it barhop-redis redis-cli -a 你的Redis密码

# 常用命令
KEYS *              # 查看所有 key
GET bars:nearby:*   # 查看缓存数据
FLUSHDB             # 清空当前数据库（⚠️ 慎用）
exit
```

### 11.5 查看日志

```bash
# 实时查看所有日志
docker compose -f docker-compose.prod.yml logs -f

# 查看最近 100 行
docker compose -f docker-compose.prod.yml logs --tail 100 server

# 查看指定时间段日志
docker compose -f docker-compose.prod.yml logs --since 30m server
docker compose -f docker-compose.prod.yml logs --since 2026-07-31T10:00:00 server
```

---

## 十二、日志与监控

### 12.1 日志文件位置

```bash
# 服务器应用日志（在容器内 /app/logs，映射到宿主机）
ls -la /opt/BarHop/server/logs/

# Nginx 访问日志
docker exec barhop-nginx cat /var/log/nginx/access.log

# Nginx 错误日志
docker exec barhop-nginx cat /var/log/nginx/error.log

# Docker 容器日志
docker logs barhop-server
docker logs barhop-mysql
```

### 12.2 Docker 日志轮转配置

已在 `/etc/docker/daemon.json` 中配置（见 4.1 节）：

```json
{
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

### 12.3 系统资源监控

```bash
# 实时监控 CPU、内存、磁盘
htop

# 查看 Docker 资源占用
docker stats

# 查看磁盘使用
df -h

# 查看内存使用
free -h

# 查看网络连接
ss -tlnp
```

### 12.4 简单健康检查脚本

创建 `/opt/BarHop/health-check.sh`：

```bash
#!/bin/bash
# 健康检查脚本

ALERT_EMAIL="your-email@example.com"
SERVER_URL="https://your-domain.com/health"

response=$(curl -s -w "\n%{http_code}" $SERVER_URL)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n -1)

if [ "$http_code" != "200" ]; then
    echo "[$(date)] 服务异常! HTTP状态: $http_code" >> /var/log/barhop-health.log
    # 可以接入邮件/钉钉/企业微信告警
    # echo "BarHop 服务异常" | mail -s "告警" $ALERT_EMAIL
    exit 1
fi

# 检查数据库连接
if echo "$body" | grep -q '"database":"connected"'; then
    echo "[$(date)] 服务正常" >> /var/log/barhop-health.log
else
    echo "[$(date)] 数据库连接异常: $body" >> /var/log/barhop-health.log
fi
```

```bash
# 赋予执行权限
chmod +x /opt/BarHop/health-check.sh

# 添加定时任务：每 5 分钟检查一次
crontab -e
# 添加：
*/5 * * * * /opt/BarHop/health-check.sh
```

---

## 十三、自动备份方案

### 13.1 创建备份脚本

```bash
# 创建备份目录
sudo mkdir -p /opt/backups

# 创建备份脚本
sudo nano /opt/backup.sh
```

脚本内容：

```bash
#!/bin/bash
# BarHop 自动备份脚本

# 配置
BACKUP_DIR="/opt/backups"
PROJECT_DIR="/opt/BarHop"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7  # 保留最近 7 天的备份

# 从 .env 读取密码
source $PROJECT_DIR/.env

# 创建备份目录
mkdir -p $BACKUP_DIR

echo "=========================================="
echo "[$(DATE)] 开始备份..."
echo "=========================================="

# 1. 备份 MySQL 数据库
echo "→ 备份 MySQL 数据库..."
docker exec barhop-mysql mysqldump \
    -u root -p${MYSQL_ROOT_PASSWORD} \
    --single-transaction \
    --routines \
    --triggers \
    barhop | gzip > $BACKUP_DIR/mysql_${DATE}.sql.gz

if [ $? -eq 0 ]; then
    echo "  ✓ MySQL 备份成功: mysql_${DATE}.sql.gz"
else
    echo "  ✗ MySQL 备份失败!"
fi

# 2. 备份 Redis 数据
echo "→ 备份 Redis..."
docker exec barhop-redis redis-cli -a ${REDIS_PASSWORD} BGSAVE 2>/dev/null
sleep 2  # 等待 BGSAVE 完成
docker cp barhop-redis:/data/dump.rdb $BACKUP_DIR/redis_${DATE}.rdb 2>/dev/null

if [ $? -eq 0 ]; then
    echo "  ✓ Redis 备份成功: redis_${DATE}.rdb"
else
    echo "  ✗ Redis 备份失败!"
fi

# 3. 备份上传的图片文件
echo "→ 备份上传文件..."
tar -czf $BACKUP_DIR/uploads_${DATE}.tar.gz \
    -C $PROJECT_DIR server/uploads/ 2>/dev/null

if [ $? -eq 0 ]; then
    echo "  ✓ 上传文件备份成功: uploads_${DATE}.tar.gz"
else
    echo "  ✗ 上传文件备份失败!"
fi

# 4. 备份配置文件
echo "→ 备份配置文件..."
tar -czf $BACKUP_DIR/config_${DATE}.tar.gz \
    -C $PROJECT_DIR .env nginx/ 2>/dev/null

if [ $? -eq 0 ]; then
    echo "  ✓ 配置文件备份成功: config_${DATE}.tar.gz"
else
    echo "  ✗ 配置文件备份失败!"
fi

# 5. 清理过期备份
echo "→ 清理 $RETENTION_DAYS 天前的备份..."
find $BACKUP_DIR -name "*.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.rdb" -mtime +$RETENTION_DAYS -delete

# 6. 显示备份结果
echo ""
echo "=========================================="
echo "备份完成!"
echo "备份目录: $BACKUP_DIR"
echo "备份文件:"
ls -lh $BACKUP_DIR/ | tail -n 10
echo "=========================================="
```

### 13.2 配置自动执行

```bash
# 赋予执行权限
sudo chmod +x /opt/backup.sh

# 测试运行
sudo /opt/backup.sh

# 添加定时任务（每天凌晨 3 点自动备份）
sudo crontab -e
# 添加以下行：
0 3 * * * /opt/backup.sh >> /var/log/barhop-backup.log 2>&1
```

### 13.3 恢复数据

```bash
# 恢复 MySQL
gunzip < /opt/backups/mysql_20260731_030000.sql.gz | \
    docker exec -i barhop-mysql mysql -u root -p密码 barhop

# 恢复上传文件
cd /opt/BarHop
tar -xzf /opt/backups/uploads_20260731_030000.tar.gz
```

---

## 十四、持续集成/持续部署（CI/CD）

项目已配置 GitHub Actions，见 [.github/workflows/deploy.yml](file:///e:/coding/selfCoding/BarHop/.github/workflows/deploy.yml)。

### 14.1 自动构建 Docker 镜像

当你 push 代码到 GitHub `main` 分支时，GitHub Actions 会自动：

1. 构建 Docker 镜像
2. 推送到 GitHub Container Registry (ghcr.io)
3. 可在 `https://github.com/你的用户名/BarHop/pkgs/container/barhop` 查看

### 14.2 配置服务器自动部署

在 GitHub 仓库 Settings → Secrets and variables → Actions 中添加：

| Secret 名 | 值 |
|-----------|-----|
| `SSH_HOST` | 服务器 IP |
| `SSH_USER` | SSH 用户名 |
| `SSH_KEY` | SSH 私钥（完整内容） |

然后取消 `deploy.yml` 中最后一段的注释：

```yaml
      - name: Deploy to server via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /opt/BarHop
            git pull origin main
            docker compose -f docker-compose.prod.yml up -d --build server
            docker image prune -f
```

### 14.3 手动触发部署

```bash
# 在 GitHub 仓库页面
# Actions → Deploy BarHop → Run workflow
```

---

## 十五、性能优化建议

### 15.1 Docker 资源限制

编辑 `docker-compose.prod.yml`，为每个服务添加资源限制：

```yaml
  mysql:
    # ... 其他配置
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1.0'
        reservations:
          memory: 512M

  server:
    # ... 其他配置
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
```

### 15.2 MySQL 优化

在 `docker-compose.prod.yml` 的 MySQL 命令中添加参数：

```yaml
  mysql:
    command: >
      --default-authentication-plugin=mysql_native_password
      --character-set-server=utf8mb4
      --collation-server=utf8mb4_unicode_ci
      --innodb-buffer-pool-size=512M
      --max-connections=100
      --slow-query-log=ON
      --long-query-time=2
```

### 15.3 Nginx 性能优化

在 `nginx/conf.d/barhop.conf` 的 http 块或 server 块中添加：

```nginx
# 开启 gzip 压缩
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript;

# 开启缓存
open_file_cache max=1000 inactive=20s;
open_file_cache_valid 30s;
open_file_cache_min_uses 2;

# 上传文件缓存
location /uploads/ {
    # ... 原有配置
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

### 15.4 Node.js 性能优化

在 `server/Dockerfile` 中设置：

```dockerfile
# 启用 Node.js 生产模式优化
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"
```

---

## 十六、故障排查 FAQ

### Q1: 端口被占用？

```bash
# 查看占用端口的进程
sudo lsof -i :80
sudo lsof -i :443
sudo lsof -i :3000

# 或用 netstat
sudo netstat -tlnp | grep :80

# 终止进程（替换 PID）
sudo kill -9 PID

# 如果是系统进程占用 80（如 Apache）
sudo systemctl stop apache2
sudo systemctl disable apache2
```

### Q2: Docker 容器无法启动？

```bash
# 查看所有容器（包括已停止的）
docker compose -f docker-compose.prod.yml ps -a

# 查看启动失败的日志
docker compose -f docker-compose.prod.yml logs server

# 常见原因：
# 1. .env 文件配置错误 - 检查必填项
# 2. 数据库连接失败 - 检查密码是否正确
# 3. 端口冲突 - 修改端口映射

# 重新构建（清除缓存）
docker compose -f docker-compose.prod.yml build --no-cache server
docker compose -f docker-compose.prod.yml up -d
```

### Q3: MySQL 连接失败？

```bash
# 1. 检查 MySQL 容器状态
docker ps | grep mysql

# 2. 查看 MySQL 日志
docker logs barhop-mysql

# 3. 检查密码是否正确
docker exec -it barhop-mysql mysql -u barhop_user -p

# 4. 如果忘记密码，重置：
docker exec -it barhop-mysql mysql -u root -p
ALTER USER 'barhop_user'@'%' IDENTIFIED BY '新密码';
FLUSH PRIVILEGES;
```

### Q4: 微信小程序无法连接服务器？

**检查清单**：

1. ✅ 服务器必须是 HTTPS（不能是 HTTP）
2. ✅ 服务器域名已添加到微信公众平台的「服务器域名」
3. ✅ `miniprogram/utils/config.js` 的 `API_BASE_URL` 已更新
4. ✅ 服务器端口已开放（80、443）
5. ✅ 防火墙未阻止请求

**调试方法**：

```bash
# 在服务器上测试
curl https://your-domain.com/api/bars/nearby \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"lat": 34.2525, "lng": 108.9444}'
```

### Q5: 图片上传后无法显示？

```bash
# 1. 检查上传目录权限
ls -la /opt/BarHop/server/uploads/

# 2. 检查 Nginx 静态文件服务
curl -I https://your-domain.com/uploads/test.jpg

# 3. 检查 .env 中的 SERVER_BASE_URL 配置
# 必须是完整的 https://your-domain.com
```

### Q6: 服务器磁盘空间不足？

```bash
# 查看磁盘使用情况
df -h

# 查看 Docker 占用空间
docker system df

# 清理未使用的镜像和容器
docker system prune -a

# 清理 Docker 构建缓存
docker builder prune

# 查看大文件
sudo du -sh /opt/* | sort -rh | head -10

# 清理旧日志
sudo find /var/log -name "*.gz" -mtime +30 -delete
```

### Q7: 如何查看实时访问日志？

```bash
# 实时查看 Nginx 访问日志
docker exec barhop-nginx tail -f /var/log/nginx/access.log

# 实时查看 Nginx 错误日志
docker exec barhop-nginx tail -f /var/log/nginx/error.log

# 实时查看 Node.js 日志
docker compose -f docker-compose.prod.yml logs -f server
```

### Q8: 如何完全重置环境？

```bash
# ⚠️ 警告：会删除所有数据！

# 1. 停止并删除所有容器和数据卷
docker compose -f docker-compose.prod.yml down -v

# 2. 删除所有镜像
docker rmi $(docker images -q) -f

# 3. 清理 Docker 系统
docker system prune -a --volumes

# 4. 重新启动
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 附录：项目文件结构

```
BarHop/
├── miniprogram/                  # 微信小程序前端
│   ├── pages/                   # 页面
│   │   ├── index/              # 首页
│   │   ├── detail/             # 详情页
│   │   ├── favorites/          # 收藏页
│   │   ├── review/             # 评价页
│   │   └── profile/            # 个人中心
│   ├── utils/                  # 工具函数
│   │   ├── request.js          # 网络请求封装
│   │   ├── config.js           # 全局配置
│   │   └── ...
│   ├── images/                 # 图片资源
│   ├── app.js                  # 小程序入口
│   └── app.json                # 小程序配置
├── server/                       # Node.js 后端
│   ├── config/                  # 配置
│   ├── controllers/            # 控制器
│   ├── routes/                  # 路由
│   ├── services/                # 业务服务
│   ├── middlewares/             # 中间件
│   ├── utils/                   # 工具
│   ├── Dockerfile               # Docker 镜像配置
│   └── package.json             # 依赖配置
├── nginx/                        # Nginx 配置
│   └── conf.d/
│       └── barhop.conf          # 反向代理配置
├── database/                      # 数据库
│   └── schema.sql              # 表结构
├── .github/workflows/            # CI/CD
│   └── deploy.yml               # GitHub Actions
├── docker-compose.yml           # 开发环境（仅 MySQL + Redis）
├── docker-compose.prod.yml      # 生产环境（完整服务）
├── .env.example                 # 环境变量模板
├── .gitignore                   # Git 忽略规则
└── DEPLOY.md                    # 本部署文档
```

---

## 附录：常用命令速查表

| 操作 | 命令 |
|------|------|
| 启动所有服务 | `docker compose -f docker-compose.prod.yml up -d` |
| 停止所有服务 | `docker compose -f docker-compose.prod.yml down` |
| 重启服务 | `docker compose -f docker-compose.prod.yml restart server` |
| 查看日志 | `docker compose -f docker-compose.prod.yml logs -f server` |
| 更新代码 | `git pull && docker compose -f docker-compose.prod.yml up -d --build server` |
| 查看状态 | `docker compose -f docker-compose.prod.yml ps` |
| 进入 MySQL | `docker exec -it barhop-mysql mysql -u barhop_user -p` |
| 进入 Redis | `docker exec -it barhop-redis redis-cli -a 密码` |
| 备份数据库 | `docker exec barhop-mysql mysqldump -u root -p密码 barhop > backup.sql` |
| 清理缓存 | `docker exec barhop-redis redis-cli -a 密码 FLUSHDB` |
| 查看 Docker 资源 | `docker stats` |
| 查看磁盘 | `df -h` |

---

**文档版本**：v2.0  
**更新日期**：2026-07-31  
**适用系统**：Ubuntu 22.04 LTS / 其他 Linux 发行版  
**如有问题**：请提交 [GitHub Issues](https://github.com/你的用户名/BarHop/issues)
