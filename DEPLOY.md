# Zhaqu Docker 部署指南

## 快速开始

### 1. 准备 VPS 环境

确保你的 VPS 已安装：
- Docker 20.10+
- Docker Compose v2+

```bash
# Ubuntu/Debian 安装 Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 重新登录后验证
docker --version
docker compose version
```

### 2. 上传项目

```bash
# 方式1: Git 克隆
git clone <your-repo-url> zhaqu
cd zhaqu

# 方式2: 直接上传
scp -r /path/to/zhaqu user@your-vps:/home/user/
ssh user@your-vps
cd zhaqu
```

### 3. 配置环境变量

```bash
# 复制示例配置
cp env.example .env

# 编辑配置文件
nano .env
```

**必须修改的配置：**

```bash
# 数据库密码 - 请使用强密码
POSTGRES_PASSWORD=your_secure_password_here

# NextAuth 密钥 - 至少 32 字符
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# 你的域名
NEXTAUTH_URL=https://your-domain.com
```

**可选配置：**

```bash
# AI 功能
GEMINI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key

# 需要登录的 X 媒体下载
YTDLP_COOKIES=/path/to/cookies.txt
YTDLP_PROXY=http://proxy:port
```

### 4. 部署

```bash
# 赋予脚本执行权限
chmod +x deploy/deploy.sh

# 一键部署
./deploy/deploy.sh deploy

# 或分步执行
./deploy/deploy.sh build   # 构建镜像
./deploy/deploy.sh start   # 启动服务
```

### 5. 初始化数据

```bash
# 运行数据库种子（创建默认工作区）
./deploy/deploy.sh seed
```

### 6. 访问

打开浏览器访问: `http://your-vps-ip:3000`

---

## 常用命令

```bash
# 查看服务状态
./deploy/deploy.sh status

# 查看日志
./deploy/deploy.sh logs           # 所有服务
./deploy/deploy.sh logs web       # 仅 Web 服务
./deploy/deploy.sh logs worker    # 仅 Worker 服务

# 重启服务
./deploy/deploy.sh restart

# 停止服务
./deploy/deploy.sh stop

# 备份数据库
./deploy/deploy.sh backup
```

---

## 配置 HTTPS (推荐)

### 方式1: 使用 Nginx 反向代理

```bash
# 安装 Nginx 和 Certbot
sudo apt install nginx certbot python3-certbot-nginx

# 配置 Nginx
sudo nano /etc/nginx/sites-available/zhaqu
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# 启用站点
sudo ln -s /etc/nginx/sites-available/zhaqu /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 获取 SSL 证书
sudo certbot --nginx -d your-domain.com
```

### 方式2: 使用 Caddy (更简单)

```bash
# 安装 Caddy
sudo apt install caddy

# 配置 Caddy
sudo nano /etc/caddy/Caddyfile
```

```
your-domain.com {
    reverse_proxy localhost:3000
}
```

```bash
sudo systemctl reload caddy
```

---

## 数据持久化

数据存储在 Docker volumes 中：

| Volume | 路径 | 说明 |
|--------|------|------|
| `postgres_data` | `/var/lib/postgresql/data` | 数据库 |
| `media_data` | `/app/data/media` | 媒体文件 |
| `playwright_cache` | `/root/.cache/ms-playwright` | 浏览器缓存 |

### 备份数据

```bash
# 备份数据库
./deploy/deploy.sh backup

# 备份媒体文件
docker run --rm -v zhaqu_media_data:/data -v $(pwd):/backup alpine \
    tar czf /backup/media_backup.tar.gz -C /data .
```

### 恢复数据

```bash
# 恢复数据库
docker compose exec -T postgres psql -U zhaqu zhaqu < backup_xxx.sql

# 恢复媒体文件
docker run --rm -v zhaqu_media_data:/data -v $(pwd):/backup alpine \
    tar xzf /backup/media_backup.tar.gz -C /data
```

---

## 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建并部署
./deploy/deploy.sh build
./deploy/deploy.sh restart

# 运行迁移（如有数据库变更）
./deploy/deploy.sh migrate
```

---

## 监控与日志

### 查看实时日志

```bash
docker compose logs -f
```

### 查看资源使用

```bash
docker stats
```

### 配置日志轮转

编辑 `docker-compose.yml`，为每个服务添加：

```yaml
services:
  web:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## 故障排查

### 服务无法启动

```bash
# 检查日志
docker compose logs web
docker compose logs worker

# 检查数据库连接
docker compose exec web npx prisma db pull
```

### 数据库连接失败

```bash
# 确认数据库服务运行
docker compose ps postgres

# 手动测试连接
docker compose exec postgres psql -U zhaqu -d zhaqu -c "SELECT 1"
```

### Worker 不处理任务

```bash
# 检查 Worker 日志
docker compose logs -f worker

# 重启 Worker
docker compose restart worker
```

### 媒体下载失败

```bash
# 检查 yt-dlp 是否可用
docker compose exec worker yt-dlp --version

# 如需 cookies，确保文件路径正确
# 将 cookies.txt 放入项目根目录，然后挂载到容器
```

---

## 架构说明

```
┌─────────────────┐     ┌─────────────────┐
│   Nginx/Caddy   │────▶│    Web (3000)   │
│  (HTTPS 终止)   │     │   Next.js App   │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   PostgreSQL    │
                        │    (5432)       │
                        └────────┬────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
     ┌────────▼────────┐               ┌───────────▼───────────┐
     │     Worker      │               │      Watchdog         │
     │  (任务处理)      │               │   (超时任务恢复)       │
     └─────────────────┘               └───────────────────────┘
```

---

## 系统要求

| 配置 | 最低要求 | 推荐配置 |
|------|---------|---------|
| CPU | 1 核 | 2+ 核 |
| 内存 | 2 GB | 4+ GB |
| 磁盘 | 20 GB | 50+ GB |

> 注意：Playwright 浏览器需要较多内存，建议至少 2GB。

---

## 安全建议

1. **修改默认密码** - 确保 `POSTGRES_PASSWORD` 和 `NEXTAUTH_SECRET` 使用强密码
2. **启用 HTTPS** - 生产环境必须使用 HTTPS
3. **限制端口访问** - 使用防火墙仅开放 80/443 端口
4. **定期备份** - 设置自动备份任务
5. **保持更新** - 定期更新 Docker 镜像和依赖

```bash
# UFW 防火墙配置示例
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

