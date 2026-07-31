# BarHop 部署文档

## 一、项目上传到 GitHub 步骤

### 1.1 初始化 Git 仓库

```bash
# 在项目根目录执行
cd E:\coding\selfCoding\BarHop

# 初始化 Git 仓库（如果还没有）
git init

# 添加所有文件
git add .

# 首次提交
git commit -m "feat: 初始化 BarHop 项目"
```

### 1.2 创建 GitHub 仓库

1. 访问 [https://github.com/new](https://github.com/new)
2. Repository name 填写：`BarHop`
3. 选择 `Public` 或 `Private`
4. **不要**勾选 "Add a README file"（因为已有代码）
5. 点击 "Create repository"

### 1.3 推送到 GitHub

```bash
# 设置远程仓库（替换 your-username 为你的 GitHub 用户名）
git remote add origin https://github.com/your-username/BarHop.git

# 重命名主分支为 main（如果需要）
git branch -M main

# 推送到 GitHub
git push -u origin main
```

### 1.4 如果已有仓库，更新代码

```bash
# 拉取最新代码
git pull origin main

# 添加修改的文件
git add .

# 提交
git commit -m "fix: 修复收藏页评分显示问题"

# 推送
git push origin main
```

### 1.5 常用 Git 命令

```bash
# 查看状态
git status

# 查看提交历史
git log --oneline -10

# 创建新分支（开发新功能时）
git checkout -b feature/new-feature

# 切换分支
git checkout main

# 合并分支
git merge feature/new-feature
```

---

## 二、云服务器部署步骤

### 2.1 选择云服务器

推荐云服务商：
- **阿里云**：[https://www.aliyun.com](https://www.aliyun.com)
- **腾讯云**：[https://cloud.tencent.com](https://cloud.tencent.com)
- **华为云**：[https://www.huaweicloud.com](https://www.huaweicloud.com)

推荐配置（入门级）：
- **CPU**：2 核
- **内存**：4GB
- **硬盘**：40GB SSD
- **系统**：Ubuntu 22.04 LTS
- **带宽**：5Mbps

### 2.2 服务器初始化

#### 2.2.1 连接服务器

```bash
# Windows 用户使用 PowerShell 或 CMD
ssh root@your-server-ip

# 或者使用工具：PuTTY、Xshell、FinalShell
```

#### 2.2.2 安装 Docker 和 Docker Compose

```bash
# 更新系统
apt update && apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 启动 Docker
sudo systemctl enable docker
sudo systemctl start docker

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version

# 将当前用户加入 docker 组（可选，免 sudo）
sudo usermod -aG docker $USER
newgrp docker
```

#### 2.2.3 安装 Git

```bash
apt install git -y
git --version
```

### 2.3 部署项目

#### 2.3.1 克隆项目

```bash
# 进入项目目录
cd /opt

# 克隆项目
git clone https://github.com/your-username/BarHop.git

# 进入项目目录
cd BarHop
```

#### 2.3.2 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置（填写实际的密码和密钥）
nano .env

# 或者使用 vim
# vim .env
```

需要修改的配置：
```env
# 必填项
MYSQL_ROOT_PASSWORD=你的MySQL根密码
MYSQL_PASSWORD=你的数据库密码
REDIS_PASSWORD=你的Redis密码
JWT_SECRET=你的JWT密钥（至少32位字符）
WECHAT_APPID=你的微信小程序AppID
WECHAT_SECRET=你的微信小程序密钥
AMAP_KEY=你的高德地图Key
SERVER_BASE_URL=https://你的域名
```

#### 2.3.3 创建必要目录

```bash
# 创建上传目录
mkdir -p server/uploads
touch server/uploads/.gitkeep

# 创建日志目录
mkdir -p server/logs

# 创建 Nginx 配置目录
mkdir -p nginx/conf.d
```

#### 2.3.4 启动服务

```bash
# 开发模式（仅 MySQL + Redis）
docker compose up -d

# 生产部署模式（全部服务）
docker compose -f docker-compose.prod.yml up -d --build
```

#### 2.3.5 查看服务状态

```bash
# 查看所有服务状态
docker compose -f docker-compose.prod.yml ps

# 查看服务日志
docker compose -f docker-compose.prod.yml logs -f server

# 查看 MySQL 日志
docker compose -f docker-compose.prod.yml logs -f mysql

# 查看 Redis 日志
docker compose -f docker-compose.prod.yml logs -f redis
```

### 2.4 配置域名和 HTTPS（可选但推荐）

#### 2.4.1 域名解析

1. 在域名服务商处添加 A 记录，将域名指向服务器 IP
2. 等待 DNS 解析生效（通常几分钟到几小时）

#### 2.4.2 安装 SSL 证书（使用 Let's Encrypt 免费证书）

```bash
# 安装 certbot
apt install certbot python3-certbot-nginx -y

# 生成证书（替换 your-domain.com 为你的域名）
certbot --nginx -d your-domain.com -d www.your-domain.com

# 自动续期测试
certbot renew --dry-run
```

#### 2.4.3 更新 Nginx 配置

编辑 `nginx/conf.d/barhop.conf`：
```nginx
# 取消 HTTPS 相关的注释，或者使用 certbot 自动配置

server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # 其他配置同 barhop.conf
}
```

### 2.5 配置微信小程序

#### 2.5.1 登录微信公众平台

访问 [https://mp.weixin.qq.com](https://mp.weixin.qq.com)

#### 2.5.2 配置服务器域名

在「开发」→「开发管理」→「开发设置」中配置：

- **request 合法域名**：`https://你的域名`
- **uploadFile 合法域名**：`https://你的域名`
- **downloadFile 合法域名**：`https://你的域名`

#### 2.5.3 更新小程序配置

修改 `miniprogram/utils/config.js`：
```javascript
const config = {
  // 开发环境
  API_BASE_URL: 'http://localhost:3000',
  // 生产环境
  // API_BASE_URL: 'https://你的域名',
};
```

---

## 三、常用运维命令

### 3.1 Docker 管理

```bash
# 启动所有服务
docker compose -f docker-compose.prod.yml up -d

# 停止所有服务
docker compose -f docker-compose.prod.yml down

# 重启单个服务
docker compose -f docker-compose.prod.yml restart server

# 重新构建并启动
docker compose -f docker-compose.prod.yml up -d --build server

# 清理所有容器和数据（⚠️ 危险操作）
docker compose -f docker-compose.prod.yml down -v
```

### 3.2 数据库管理

```bash
# 连接 MySQL
docker exec -it barhop-mysql mysql -u root -p

# 导入数据
docker exec -i barhop-mysql mysql -u root -p barhop < backup.sql

# 导出数据
docker exec barhop-mysql mysqldump -u root -p barhop > backup.sql

# Redis 连接
docker exec -it barhop-redis redis-cli -a your_redis_password
```

### 3.3 日志查看

```bash
# 实时查看服务日志
docker compose -f docker-compose.prod.yml logs -f server

# 查看最近 100 行
docker compose -f docker-compose.prod.yml logs --tail 100 server

# 查看 Nginx 日志
docker compose -f docker-compose.prod.yml logs -f nginx
```

### 3.4 数据备份

```bash
# 创建备份脚本
cat > /opt/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# 创建备份目录
mkdir -p $BACKUP_DIR

# 备份 MySQL
docker exec barhop-mysql mysqldump -u root -p${MYSQL_ROOT_PASSWORD} barhop | gzip > $BACKUP_DIR/mysql_${DATE}.sql.gz

# 备份 Redis
docker exec barhop-redis redis-cli -a ${REDIS_PASSWORD} BGSAVE
docker cp barhop-redis:/data/dump.rdb $BACKUP_DIR/redis_${DATE}.rdb

# 备份上传文件
tar -czf $BACKUP_DIR/uploads_${DATE}.tar.gz server/uploads/

# 删除7天前的备份
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete
find $BACKUP_DIR -name "*.rdb" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "备份完成: $DATE"
EOF

# 添加执行权限
chmod +x /opt/backup.sh

# 添加定时任务（每天凌晨3点备份）
crontab -e
0 3 * * * /opt/backup.sh >> /opt/backup.log 2>&1
```

---

## 四、项目结构说明

```
BarHop/
├── miniprogram/              # 微信小程序前端
│   ├── pages/               # 页面
│   │   ├── index/          # 首页
│   │   ├── detail/         # 详情页
│   │   ├── favorites/      # 收藏页
│   │   ├── review/         # 评价页
│   │   └── profile/        # 个人中心
│   ├── utils/              # 工具函数
│   ├── images/             # 图片资源
│   ├── app.js             # 小程序入口
│   └── app.json           # 小程序配置
├── server/                   # Node.js 后端
│   ├── config/             # 配置文件
│   ├── controllers/        # 控制器
│   ├── routes/             # 路由
│   ├── services/           # 业务服务
│   ├── middlewares/        # 中间件
│   ├── utils/              # 工具函数
│   ├── Dockerfile          # Docker 配置
│   └── package.json        # 依赖配置
├── nginx/                    # Nginx 配置
│   └── conf.d/
│       └── barhop.conf    # 反向代理配置
├── database/                  # 数据库
│   └── schema.sql          # 表结构
├── docker-compose.yml       # 开发环境配置
├── docker-compose.prod.yml  # 生产环境配置
├── .env.example             # 环境变量示例
└── README.md                # 说明文档
```

---

## 五、常见问题

### Q1: 端口被占用怎么办？
```bash
# 查看占用端口的进程
lsof -i :3000
# 或
netstat -tlnp | grep 3000

# 终止进程
kill -9 PID
```

### Q2: Docker 容器无法启动？
```bash
# 查看容器状态
docker ps -a

# 查看容器日志
docker logs barhop-server

# 重启 Docker 服务
systemctl restart docker
```

### Q3: MySQL 连接失败？
```bash
# 确认 MySQL 容器正在运行
docker ps | grep mysql

# 查看 MySQL 日志
docker logs barhop-mysql

# 重置 MySQL 密码
docker exec -it barhop-mysql mysql -u root -p
ALTER USER 'barhop_user'@'%' IDENTIFIED BY 'new_password';
FLUSH PRIVILEGES;
```

### Q4: 如何更新服务？
```bash
# 拉取最新代码
cd /opt/BarHop
git pull origin main

# 重新构建并启动
docker compose -f docker-compose.prod.yml up -d --build server
```

---

## 六、安全建议

1. **定期更新密码**：MySQL、Redis、JWT 密钥等
2. **启用防火墙**：仅开放 80、443 端口
3. **配置 HTTPS**：使用 SSL 证书加密传输
4. **定期备份**：使用上方的备份脚本
5. **监控日志**：定期检查服务器日志
6. **更新系统**：定期安装安全更新

---

## 七、技术支持

如遇到问题，请查看：
- GitHub Issues：提交 Bug 或功能请求
- Docker Hub：查看 [https://hub.docker.com](https://hub.docker.com)
- 官方文档：
  - [Node.js](https://nodejs.org/docs)
  - [Docker](https://docs.docker.com)
  - [微信小程序](https://developers.weixin.qq.com/miniprogram/dev/framework/)
  - [MySQL](https://dev.mysql.com/doc/)
