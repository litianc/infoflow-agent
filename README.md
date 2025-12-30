# InfoFlow Agent - 行业情报平台

一个开源的行业新闻资讯聚合平台，支持多行业板块分类、智能采集和评分系统。

## 功能特性

- **多行业板块**: 数据中心、云计算、AI算力、芯片半导体、网络通信、政策监管、投资并购
- **智能采集**: 傻瓜式数据源配置，自动识别网页结构
- **定时任务**: 支持定时自动采集
- **评分系统**: 四维评分（相关性、时效性、影响力、可信度）
- **后台管理**: 数据源管理、内容管理、采集日志、系统设置
- **深色模式**: 支持深色/浅色主题切换
- **AI摘要** (可选): 集成 LLM 生成文章摘要

## 技术栈

- **框架**: Next.js 15 (App Router)
- **UI**: Tailwind CSS + shadcn/ui
- **数据库**: Turso (libSQL/SQLite)
- **ORM**: Drizzle ORM
- **部署**: Vercel / Ubuntu 服务器

---

## Ubuntu 服务器部署指南

### 系统要求

- Ubuntu 20.04 LTS 或更高版本
- 最低配置: 1核 CPU, 1GB 内存
- Node.js 20.x 或更高版本

### 1. 安装 Node.js

```bash
# 使用 NodeSource 安装 Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 验证安装
node -v  # 应显示 v20.x.x
npm -v   # 应显示 10.x.x
```

### 2. 安装 pnpm

```bash
# 全局安装 pnpm
sudo npm install -g pnpm

# 验证安装
pnpm -v
```

### 3. 克隆项目

```bash
# 克隆代码仓库
git clone <your-repo-url> infoflow-agent
cd infoflow-agent
```

### 4. 安装依赖

```bash
pnpm install
```

### 5. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env.local

# 编辑配置文件
nano .env.local
```

**必填配置项：**

```bash
# 数据库 (本地开发使用文件数据库)
TURSO_DATABASE_URL=file:./local.db
TURSO_AUTH_TOKEN=

# 管理员密码 (请修改为强密码)
ADMIN_PASSWORD=YourSecurePassword123!

# 站点配置
NEXT_PUBLIC_SITE_NAME=行业情报平台
NEXT_PUBLIC_SITE_URL=http://your-domain.com
```

**可选配置项：**

```bash
# LLM配置 (可选，用于AI摘要，不配置也能正常运行)
LLM_API_KEY=your-api-key
LLM_API_BASE=https://open.bigmodel.cn/api/paas/v4
LLM_MODEL=GLM-4.5-Air

# 定时任务密钥 (可选，用于保护定时接口)
CRON_SECRET=your-cron-secret
```

### 6. 初始化数据库

```bash
# 生成数据库表结构
pnpm db:push

# 填充初始数据 (7个行业板块)
pnpm db:seed
```

### 7. 构建项目

```bash
pnpm build
```

### 8. 启动服务

#### 方式一：直接启动 (测试用)

```bash
pnpm start

# 或指定端口
PORT=3000 pnpm start
```

#### 方式二：使用 PM2 进程管理 (推荐)

```bash
# 安装 PM2
sudo npm install -g pm2

# 启动服务
pm2 start npm --name "infoflow" -- start

# 设置开机自启
pm2 startup
pm2 save

# 常用命令
pm2 status          # 查看状态
pm2 logs infoflow   # 查看日志
pm2 restart infoflow # 重启服务
pm2 stop infoflow   # 停止服务
```

#### 方式三：使用 systemd 服务

```bash
# 创建服务文件
sudo nano /etc/systemd/system/infoflow.service
```

写入以下内容：

```ini
[Unit]
Description=InfoFlow Agent
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/infoflow-agent
ExecStart=/usr/bin/npm start
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable infoflow
sudo systemctl start infoflow
sudo systemctl status infoflow
```

### 9. 配置 Nginx 反向代理 (可选)

```bash
# 安装 Nginx
sudo apt install -y nginx

# 创建站点配置
sudo nano /etc/nginx/sites-available/infoflow
```

写入以下内容：

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

启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/infoflow /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 10. 配置定时采集

使用系统 crontab 实现定时采集：

```bash
# 编辑 crontab
crontab -e

# 每天早8点执行采集
0 8 * * * curl -s http://localhost:3000/api/cron/collect >> /var/log/infoflow-cron.log 2>&1

# 或每6小时采集一次
0 */6 * * * curl -s http://localhost:3000/api/cron/collect >> /var/log/infoflow-cron.log 2>&1
```

如果设置了 CRON_SECRET：

```bash
0 8 * * * curl -s -H "Authorization: Bearer your-cron-secret" http://localhost:3000/api/cron/collect
```

### 11. 配置 HTTPS (推荐)

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com

# 自动续期测试
sudo certbot renew --dry-run
```

---

## 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 访问 http://localhost:3000
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 开发模式 |
| `pnpm build` | 构建生产版本 |
| `pnpm start` | 启动生产服务 |
| `pnpm lint` | 代码检查 |
| `pnpm test` | 运行测试 (watch 模式) |
| `pnpm test:run` | 运行所有测试 |
| `pnpm test:coverage` | 运行测试并生成覆盖率报告 |
| `pnpm db:push` | 同步数据库结构 |
| `pnpm db:seed` | 填充初始数据 |
| `pnpm db:studio` | 数据库管理界面 |

## 测试

项目使用 [Vitest](https://vitest.dev/) 作为测试框架，包含以下测试：

### 测试结构

```
tests/
├── setup.ts              # 测试环境配置
├── helpers.ts            # 测试辅助函数
├── lib/                  # 库函数测试
│   ├── utils.test.ts     # 工具函数测试
│   ├── constants.test.ts # 常量配置测试
│   ├── auth.test.ts      # 认证模块测试
│   └── llm.test.ts       # LLM 服务测试
├── api/                  # API 路由测试
│   ├── auth.test.ts      # 认证 API 测试
│   └── collect.test.ts   # 采集逻辑测试
└── components/           # 组件测试
    ├── ThemeToggle.test.tsx
    └── ArticleCard.test.tsx
```

### 运行测试

```bash
# 运行所有测试
npm run test:run

# Watch 模式（开发时使用）
npm run test

# 生成覆盖率报告
npm run test:coverage

# 打开测试 UI
npm run test:ui
```

### 测试覆盖

- **lib 层**: utils, constants, auth, llm 模块
- **API 层**: 认证接口、采集逻辑（文章提取、评分计算）
- **组件层**: ThemeToggle, ArticleCard

## 访问地址

- 前台首页: `http://your-domain.com/`
- 后台管理: `http://your-domain.com/admin`

## 常见问题

### 端口被占用

```bash
sudo lsof -i :3000
sudo kill -9 <PID>
```

### 权限问题

```bash
sudo chown -R $USER:$USER /path/to/infoflow-agent
```

### 查看日志

```bash
# PM2 日志
pm2 logs infoflow

# systemd 日志
sudo journalctl -u infoflow -f
```

## License

MIT
