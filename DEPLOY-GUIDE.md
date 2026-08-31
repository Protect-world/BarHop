# BarHop 后续迭代部署指南

## 一、后端更新（服务器代码）

### 方式 A：Git（推荐）
```bash
# 本机：commit + push
git add 具体文件名
git commit -m "描述改动"
git push

# 服务器：
cd /opt/BarHop
git pull
pm2 restart barhop-server
pm2 logs barhop-server --lines 30   # 确认无报错
```

### 方式 B：SCP（快速改单个文件）
```powershell
# 本机 PowerShell（先关代理）：
$env:HTTP_PROXY=""
$env:HTTPS_PROXY=""
scp e:\coding\selfCoding\BarHop\server\services\xxx.js root@服务器IP:/opt/BarHop/server/services/
```
```bash
# 服务器：
cd /opt/BarHop
pm2 restart barhop-server
pm2 logs barhop-server --lines 30
```

---

## 二、数据库变更（Navicat 连接执行）

### Navicat 连接配置
- SSH 隧道：服务器 IP，root 账号
- MySQL 主机：`127.0.0.1`
- 端口：`3307`
- 用户名：`barhop_user`
- 密码：`barhop_pass`
- 数据库：`barhop`

### 加字段（直接在 Navicat 查询窗口执行）

```sql
-- 加单字段
ALTER TABLE bars ADD COLUMN category VARCHAR(255) DEFAULT '' COMMENT '酒吧大类' AFTER tags;
ALTER TABLE bars ADD COLUMN user_rating DECIMAL(3,1) DEFAULT 0.0 COMMENT '用户评价平均分' AFTER avg_rating;
ALTER TABLE bars ADD COLUMN user_review_count INT DEFAULT 0 COMMENT '用户评价条数' AFTER user_rating;
```

> 已存在的字段会报错"Duplicate column"，忽略即可。

---

## 三、清缓存（后端改了搜索/数据逻辑后必做）

```bash
# 服务器上执行：
curl -s -X POST http://127.0.0.1:3000/api/bars/clear-cache
# → {"code":0,"message":"缓存清理成功"}

# 然后重启：
pm2 restart barhop-server
```

---

## 四、前端更新（小程序）

```
1. 开发者工具编译预览 → 确认无误
2. 右上角"上传" → 填版本号 + 备注
3. 公众台 → 版本管理 → 设为体验版 → 真机扫码测试
4. 测试通过 → 提交审核
5. 审核通过 → 发布
```

前端不需要动服务器。

---

## 五、完整发布流程（前后端都改了）

```
① 后端代码 → git push 或 SCP → 服务器
② 数据库变更（如有）→ Navicat 执行 SQL
③ 清缓存 → curl clear-cache
④ 重启后端 → pm2 restart barhop-server
⑤ 验证后端 → curl 测试接口
⑥ 前端开发者工具编译 → 真机预览测试
⑦ 前端上传代码 → 体验版测试
⑧ 提交审核 → 发布
```

---

## 六、验证命令速查

```bash
# 健康检查
curl -s http://127.0.0.1:3000/health | python3 -m json.tool

# 搜索酒吧
curl -s -X POST http://127.0.0.1:3000/api/bars/nearby \
  -H "Content-Type: application/json" \
  -d '{"lat":34.3416,"lng":108.9398,"radius":5000}' | python3 -m json.tool | head -40

# 测腾讯 LBS
curl -s "https://apis.map.qq.com/ws/place/v1/search?key=你的KEY&keyword=酒吧&boundary=nearby(34.3416,108.9398,5000)&output=json&page_size=3"

# 测高德
curl -s 'https://restapi.amap.com/v3/place/around?key=你的KEY&location=108.9398,34.3416&radius=5000&keywords=酒吧&offset=5&output=JSON&extensions=base'

# PM2 状态
pm2 status

# 实时日志
pm2 logs barhop-server --lines 100

# 只看错误
pm2 logs barhop-server --err --lines 50

# 数据库表结构（命令行）
docker exec barhop-mysql mysql -u barhop_user -pbarhop_pass barhop -e "DESCRIBE bars;"

# 数据库数据量
docker exec barhop-mysql mysql -u barhop_user -pbarhop_pass barhop -e "SELECT COUNT(*), source FROM bars GROUP BY source;"

# Nginx 错误日志
tail -20 /var/log/nginx/error.log
```

---

## 七、API 额度

| 服务 | 免费额度 | 重置周期 | 付费方案 |
|------|---------|---------|---------|
| 腾讯 LBS | 1万次/日 | 每天 0 点 | 30元/1万次（云市场流量包） |
| 高德 | 5000次/月 | 每月 1 号 | 30元/10万次/年（控制台购买） |

```bash
# 估算今日调用量
pm2 logs barhop-server --lines 5000 --nostream | grep -c "LBS"
pm2 logs barhop-server --lines 5000 --nostream | grep -c "Amap"
```

---

## 八、应急处理

```bash
# 后端挂了
pm2 restart barhop-server

# PM2 进程丢了
cd /opt/BarHop/server && pm2 start server.js --name barhop-server && pm2 save

# 数据库连不上
docker restart barhop-mysql && sleep 10 && pm2 restart barhop-server

# Redis 连不上
docker restart barhop-redis && pm2 restart barhop-server

# 临时禁用 Preloader（省 API 额度）
sed -i 's/preloaderService.start();/\/\/ preloaderService.start();/' /opt/BarHop/server/server.js
pm2 restart barhop-server

# 恢复 Preloader
sed -i 's/\/\/ preloaderService.start();/preloaderService.start();/' /opt/BarHop/server/server.js
pm2 restart barhop-server
```
