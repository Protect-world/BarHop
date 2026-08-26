# BarHop Linux 服务器常用命令速查

> 服务器：42.194.201.142 / barhop.asia / Ubuntu 22.04
> 架构：宿主机 Nginx + 宿主机 PM2 (Node.js) + Docker (MySQL/Redis)

---

## 一、SSH 登录

```bash
# 当前配置：root + 22端口（SSH加固暂未做）
ssh root@42.194.201.142
ssh root@barhop.asia
```

---

## 二、Node.js / PM2 后端服务

```bash
# 查看状态
pm2 status
pm2 monit              # 实时监控（CPU/内存）

# 启动 / 重启 / 停止
pm2 restart barhop-server
pm2 stop barhop-server
pm2 delete barhop-server
pm2 start server.js --name barhop-server   # 在 /opt/BarHop/server 目录执行

# 日志
pm2 logs barhop-server
pm2 logs barhop-server --lines 100         # 最近100行
pm2 logs barhop-server --err               # 只看错误日志

# 保存开机自启
pm2 save
pm2 startup                               # 按提示执行返回的命令
```

---

## 三、Docker 容器（MySQL + Redis）

```bash
cd /opt/BarHop

# 查看状态
docker compose -f docker-compose.prod.yml ps
docker ps

# 启动 / 停止
docker compose -f docker-compose.prod.yml up -d mysql redis
docker compose -f docker-compose.prod.yml stop
docker compose -f docker-compose.prod.yml restart mysql redis

# 日志
docker compose -f docker-compose.prod.yml logs --tail 50
docker compose -f docker-compose.prod.yml logs -f mysql
docker compose -f docker-compose.prod.yml logs -f redis

# 进入容器
docker exec -it barhop-mysql bash
docker exec -it barhop-redis redis-cli -a barhop_redis
```

---

## 四、MySQL 数据库

```bash
# 方式一：宿主机端口直连（3307）
mysql -h 127.0.0.1 -P 3307 -u barhop_user -pbarhop_pass barhop

# 方式二：通过 docker exec
docker exec -it barhop-mysql mysql -u barhop_user -pbarhop_pass barhop

# 常用操作
SHOW TABLES;
DESCRIBE bars;
SELECT * FROM bars LIMIT 5;
SELECT * FROM users LIMIT 5;
SELECT * FROM reviews LIMIT 5;
SELECT * FROM favorites LIMIT 5;

# 改 bars 表结构（已执行过，备忘）
# ALTER TABLE bars ADD COLUMN user_rating DECIMAL(2,1) DEFAULT 0.0;
# ALTER TABLE bars ADD COLUMN user_review_count INT DEFAULT 0;

# 备份
docker exec barhop-mysql mysqldump -u barhop_user -pbarhop_pass barhop > /opt/backup-$(date +%Y%m%d).sql

# 恢复
docker exec -i barhop-mysql mysql -u barhop_user -pbarhop_pass barhop < /opt/backup-20260827.sql
```

---

## 五、Nginx

```bash
# 状态 / 启动 / 停止 / 重启
systemctl status nginx
systemctl start nginx
systemctl stop nginx
systemctl restart nginx
systemctl reload nginx          # 重新加载配置（不中断）

# 测试配置语法（改配置后必须先跑这个）
nginx -t

# 配置文件位置
/etc/nginx/sites-available/barhop    # 站点配置
/etc/nginx/sites-enabled/barhop      # 启用的软链接

# 日志
tail -f /var/log/nginx/access.log    # 访问日志（实时）
tail -f /var/log/nginx/error.log     # 错误日志（实时）
tail -n 100 /var/log/nginx/error.log # 最近100行错误
```

---

## 六、HTTPS 证书（Let's Encrypt / Certbot）

```bash
# 申请新证书（首次）
certbot --nginx -d barhop.asia -d www.barhop.asia

# 续期
certbot renew                         # 尝试续期
certbot renew --dry-run               # 测试续期（不实际续）
certbot certificates                  # 查看现有证书

# 证书位置
/etc/letsencrypt/live/barhop.asia/fullchain.pem
/etc/letsencrypt/live/barhop.asia/privkey.pem

# 自动续期（已配置 crontab：每月1号凌晨3点）
crontab -l
# 0 3 1 * * certbot renew --quiet >> /var/log/letsencrypt/renew.log 2>&1
```

---

## 七、环境变量 .env

```bash
# 位置（软链接同步到 server 目录）
/opt/BarHop/.env
/opt/BarHop/server/.env    # -> /opt/BarHop/.env 的软链接

# 查看
cat /opt/BarHop/.env

# 修改（用 sed 或直接编辑器）
sed -i 's|旧值|新值|' /opt/BarHop/.env
vim /opt/BarHop/.env

# 修改后必须重启 pm2 生效
pm2 restart barhop-server
```

### 当前 .env 内容

| 变量 | 当前值 | 说明 |
|------|--------|------|
| SERVER_BASE_URL | https://barhop.asia | 生产域名 |
| DB_HOST / DB_PORT | 127.0.0.1 / 3307 | MySQL（宿主机映射端口）|
| DB_USER / DB_PASS | barhop_user / barhop_pass | |
| REDIS_HOST / PORT | 127.0.0.1 / 6379 | |
| REDIS_PASSWORD | barhop_redis | |
| JWT_SECRET | 生成的64字节hex | |
| WECHAT_APPID | wxb83650bafb225674 | 小程序AppID |
| WECHAT_SECRET | （已填）| 小程序AppSecret |
| TENCENT_LBS_KEY | O3BBZ-4UDEW-XW5RE-YWCJV-W5QUH-Y5FQQ | 腾讯地图（主数据源）|
| AMAP_KEY | 701064e2a76d132ab506fe7831f48b18 | 高德（补图+评分）|

---

## 八、健康检查 / API 测试

```bash
# 健康检查
curl http://localhost:3000/health           # 直连 node
curl http://127.0.0.1/health                # 通过 nginx (HTTP)
curl https://barhop.asia/health             # HTTPS（正式）

# 酒吧搜索（POST JSON）
curl -X POST https://barhop.asia/api/bars/nearby \
  -H "Content-Type: application/json" \
  -d '{"lat":30.5728,"lng":104.0668,"radius":5000}'

# 登录
curl -X POST https://barhop.asia/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"code":"test_code"}'

# 收藏（需 token）
TOKEN=你的token
curl -H "Authorization: Bearer $TOKEN" https://barhop.asia/api/favorites
```

---

## 九、文件 / 目录 / 磁盘

```bash
# 项目目录
cd /opt/BarHop
/opt/BarHop/server/           # 后端代码
/opt/BarHop/server/uploads/   # 上传的图片
/opt/BarHop/database/         # schema.sql
/opt/BarHop/nginx/            # nginx 配置模板（实际用宿主机 sites-available/barhop）
/opt/BarHop/miniprogram/      # 小程序前端（本地编译，服务器上不用跑）

# 磁盘
df -h                         # 磁盘空间
du -sh /opt/BarHop/*          # 各目录大小
free -h                       # 内存 + swap

# 图片上传目录权限
chown -R www-data:www-data /opt/BarHop/server/uploads
chmod -R 755 /opt/BarHop/server/uploads
ls -la /opt/BarHop/server/uploads
```

---

## 十、防火墙 / 系统

```bash
# UFW（已开放 22/2222/80/443）
ufw status
ufw enable / disable

# 腾讯云控制台防火墙也要开放对应端口
# 位置：轻量应用服务器 -> 实例 -> 防火墙

# 进程
htop                           # 看系统负载
ps aux | grep node
ps aux | grep mysql

# 更新系统
apt update && apt upgrade -y
```

---

## 十一、快速排错流程

### 1. 用户说"加载失败"

```bash
# 后端在跑吗？
pm2 status                   # barhop-server 必须是 online
docker compose -f /opt/BarHop/docker-compose.prod.yml ps  # mysql + redis 必须 running

# 后端能访问吗？
curl http://localhost:3000/health

# 看后端报错
pm2 logs barhop-server --err --lines 50

# 看 nginx 错误
tail -n 50 /var/log/nginx/error.log
```

### 2. 某个表字段找不到（Unknown column）

```bash
# 看表结构
docker exec barhop-mysql mysql -u barhop_user -pbarhop_pass barhop -e "DESCRIBE bars;"

# 加字段
docker exec -i barhop-mysql mysql -u barhop_user -pbarhop_pass barhop << 'SQL'
ALTER TABLE bars ADD COLUMN user_rating DECIMAL(2,1) DEFAULT 0.0;
SQL
```

### 3. API Key 相关错误

```bash
# 确认 .env 是否正确（后端读的是 server/.env，是根目录 .env 的软链接）
ls -la /opt/BarHop/server/.env
cat /opt/BarHop/.env
pm2 restart barhop-server

# 测试腾讯地图
curl 'https://apis.map.qq.com/ws/place/v1/search?keyword=酒吧&boundary=region(成都)&key=你的腾讯Key' | head -c 500

# 测试高德地图
curl 'https://restapi.amap.com/v3/place/text?keywords=酒吧&city=成都&key=你的高德Key' | head -c 500
```

### 4. HTTPS 证书过期

```bash
certbot certificates   # 看有效期
certbot renew          # 续期
systemctl restart nginx
```

### 5. 完全重启整个服务栈

```bash
# 按顺序
pm2 restart barhop-server
docker compose -f /opt/BarHop/docker-compose.prod.yml restart mysql redis
systemctl restart nginx
```

---

## 十二、crontab 定时任务

```bash
crontab -l               # 查看
crontab -e               # 编辑

# 当前任务：
# */5 * * * * ...      # 腾讯云 stargate 自带
# 0 3 1 * * certbot renew --quiet >> /var/log/letsencrypt/renew.log 2>&1
```

**建议添加**：数据库每日自动备份

```bash
# 编辑 crontab，加一行：
0 3 * * * docker exec barhop-mysql mysqldump -u barhop_user -pbarhop_pass barhop > /opt/backups/barhop-$(date +\%Y\%m\%d).sql 2>&1
```
