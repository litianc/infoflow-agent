#!/bin/bash

# InfoFlow Agent - Ubuntu 服务器初始化脚本
# 用法: bash scripts/setup-ubuntu.sh

set -e

echo "=========================================="
echo "  InfoFlow Agent - Ubuntu 初始化脚本"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否为 root 用户
if [ "$EUID" -eq 0 ]; then
    SUDO=""
else
    SUDO="sudo"
fi

# 步骤 1: 检查并安装 Node.js
echo -e "${YELLOW}[1/6] 检查 Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓ Node.js 已安装: $NODE_VERSION${NC}"
else
    echo "正在安装 Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash -
    $SUDO apt install -y nodejs
    echo -e "${GREEN}✓ Node.js 安装完成${NC}"
fi

# 步骤 2: 检查并安装 PM2
echo ""
echo -e "${YELLOW}[2/6] 检查 PM2...${NC}"
if command -v pm2 &> /dev/null; then
    echo -e "${GREEN}✓ PM2 已安装${NC}"
else
    echo "正在安装 PM2..."
    $SUDO npm install -g pm2
    echo -e "${GREEN}✓ PM2 安装完成${NC}"
fi

# 步骤 3: 安装项目依赖
echo ""
echo -e "${YELLOW}[3/6] 安装项目依赖...${NC}"
npm install
echo -e "${GREEN}✓ 依赖安装完成${NC}"

# 步骤 4: 配置环境变量
echo ""
echo -e "${YELLOW}[4/6] 配置环境变量...${NC}"
if [ -f .env.local ]; then
    echo -e "${GREEN}✓ .env.local 已存在${NC}"
    read -p "是否要重新配置? (y/N): " RECONFIG
    if [ "$RECONFIG" != "y" ] && [ "$RECONFIG" != "Y" ]; then
        SKIP_ENV=true
    fi
fi

if [ "$SKIP_ENV" != "true" ]; then
    cp .env.example .env.local
    
    # 获取服务器 IP
    SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "localhost")
    
    echo ""
    echo "请输入以下配置信息："
    echo ""
    
    read -p "站点名称 [InfoFlow]: " SITE_NAME
    SITE_NAME=${SITE_NAME:-InfoFlow}
    
    read -p "站点地址 [http://$SERVER_IP:3000]: " SITE_URL
    SITE_URL=${SITE_URL:-http://$SERVER_IP:3000}
    
    read -sp "管理员密码: " ADMIN_PWD
    echo ""
    
    if [ -z "$ADMIN_PWD" ]; then
        ADMIN_PWD="admin123"
        echo -e "${YELLOW}警告: 使用默认密码 admin123，请尽快修改！${NC}"
    fi
    
    # 写入配置
    cat > .env.local << ENVEOF
# 站点配置
NEXT_PUBLIC_SITE_NAME=$SITE_NAME
NEXT_PUBLIC_SITE_URL=$SITE_URL

# 管理员密码
ADMIN_PASSWORD=$ADMIN_PWD

# 数据库（本地 SQLite）
TURSO_DATABASE_URL=file:./local.db
TURSO_AUTH_TOKEN=

# LLM 配置（可选）
# LLM_API_KEY=
# LLM_API_BASE=https://open.bigmodel.cn/api/paas/v4
# LLM_MODEL=GLM-4-Flash

# 邮件配置（可选）
# EMAIL_SMTP_HOST=
# EMAIL_SMTP_PORT=465
# EMAIL_SMTP_SECURE=true
# EMAIL_SMTP_USER=
# EMAIL_SMTP_PASSWORD=
# EMAIL_FROM=
ENVEOF

    echo -e "${GREEN}✓ 环境变量配置完成${NC}"
fi

# 步骤 5: 初始化数据库
echo ""
echo -e "${YELLOW}[5/6] 初始化数据库...${NC}"
export TURSO_DATABASE_URL=file:./local.db
export TURSO_AUTH_TOKEN=

if [ -f local.db ]; then
    echo "数据库已存在"
    read -p "是否要重新初始化? (会清空数据) (y/N): " REINIT_DB
    if [ "$REINIT_DB" = "y" ] || [ "$REINIT_DB" = "Y" ]; then
        rm -f local.db
        npx drizzle-kit push
        npx tsx lib/db/seed.ts
        echo -e "${GREEN}✓ 数据库重新初始化完成${NC}"
    else
        echo -e "${GREEN}✓ 保留现有数据库${NC}"
    fi
else
    npx drizzle-kit push
    npx tsx lib/db/seed.ts
    echo -e "${GREEN}✓ 数据库初始化完成${NC}"
fi

# 步骤 6: 构建并启动
echo ""
echo -e "${YELLOW}[6/6] 构建并启动服务...${NC}"
npm run build
echo -e "${GREEN}✓ 构建完成${NC}"

# 启动/重启 PM2
if pm2 list | grep -q "infoflow"; then
    pm2 restart infoflow
    echo -e "${GREEN}✓ 服务已重启${NC}"
else
    pm2 start npm --name "infoflow" -- start
    pm2 save
    echo -e "${GREEN}✓ 服务已启动${NC}"
fi

# 完成
echo ""
echo "=========================================="
echo -e "${GREEN}  ✅ 初始化完成！${NC}"
echo "=========================================="
echo ""
echo "访问地址："
echo "  - 前台: $SITE_URL"
echo "  - 后台: $SITE_URL/admin"
echo ""
echo "常用命令："
echo "  pm2 status        # 查看服务状态"
echo "  pm2 logs infoflow # 查看日志"
echo "  pm2 restart infoflow # 重启服务"
echo ""
echo "设置开机自启（首次需要执行）："
echo "  pm2 startup"
echo "  pm2 save"
echo ""
