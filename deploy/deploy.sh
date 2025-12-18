#!/bin/bash
# Zhaqu Docker 部署脚本
# 使用方式: ./deploy/deploy.sh [命令]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 检查 Docker
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}错误: Docker 未安装${NC}"
        exit 1
    fi
    if ! docker compose version &> /dev/null; then
        echo -e "${RED}错误: Docker Compose 未安装${NC}"
        exit 1
    fi
}

# 检查环境变量文件
check_env() {
    if [ ! -f ".env" ]; then
        echo -e "${YELLOW}警告: .env 文件不存在${NC}"
        echo "正在从 env.example 创建..."
        cp env.example .env
        echo -e "${YELLOW}请编辑 .env 文件配置必要的环境变量${NC}"
        exit 1
    fi
}

# 构建镜像
build() {
    echo -e "${GREEN}开始构建镜像...${NC}"
    docker compose build --no-cache
    echo -e "${GREEN}构建完成${NC}"
}

# 启动服务
start() {
    echo -e "${GREEN}启动服务...${NC}"
    docker compose up -d
    echo -e "${GREEN}服务已启动${NC}"
    echo ""
    echo "访问地址: http://localhost:${WEB_PORT:-3000}"
    echo ""
    echo "查看日志: docker compose logs -f"
}

# 停止服务
stop() {
    echo -e "${YELLOW}停止服务...${NC}"
    docker compose down
    echo -e "${GREEN}服务已停止${NC}"
}

# 重启服务
restart() {
    echo -e "${YELLOW}重启服务...${NC}"
    docker compose restart
    echo -e "${GREEN}服务已重启${NC}"
}

# 查看日志
logs() {
    docker compose logs -f "$@"
}

# 查看状态
status() {
    docker compose ps
}

# 运行数据库迁移
migrate() {
    echo -e "${GREEN}运行数据库迁移...${NC}"
    docker compose exec web npx prisma migrate deploy
    echo -e "${GREEN}迁移完成${NC}"
}

# 运行数据库种子
seed() {
    echo -e "${GREEN}运行数据库种子...${NC}"
    docker compose exec web npx tsx prisma/seed.ts
    echo -e "${GREEN}种子数据已导入${NC}"
}

# 备份数据库
backup() {
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    echo -e "${GREEN}备份数据库到 ${BACKUP_FILE}...${NC}"
    docker compose exec postgres pg_dump -U ${POSTGRES_USER:-zhaqu} ${POSTGRES_DB:-zhaqu} > "$BACKUP_FILE"
    echo -e "${GREEN}备份完成: ${BACKUP_FILE}${NC}"
}

# 清理未使用的资源
cleanup() {
    echo -e "${YELLOW}清理 Docker 资源...${NC}"
    docker system prune -f
    echo -e "${GREEN}清理完成${NC}"
}

# 完整部署流程
deploy() {
    check_docker
    check_env
    build
    start
    echo ""
    echo -e "${GREEN}部署完成！${NC}"
}

# 帮助信息
help() {
    echo "Zhaqu Docker 部署脚本"
    echo ""
    echo "使用方式: $0 [命令]"
    echo ""
    echo "命令:"
    echo "  deploy    - 完整部署流程 (构建 + 启动)"
    echo "  build     - 构建 Docker 镜像"
    echo "  start     - 启动所有服务"
    echo "  stop      - 停止所有服务"
    echo "  restart   - 重启所有服务"
    echo "  logs      - 查看日志 (可指定服务名)"
    echo "  status    - 查看服务状态"
    echo "  migrate   - 运行数据库迁移"
    echo "  seed      - 运行数据库种子"
    echo "  backup    - 备份数据库"
    echo "  cleanup   - 清理 Docker 资源"
    echo "  help      - 显示此帮助信息"
}

# 主入口
case "${1:-help}" in
    deploy)  deploy ;;
    build)   check_docker && build ;;
    start)   check_docker && check_env && start ;;
    stop)    check_docker && stop ;;
    restart) check_docker && restart ;;
    logs)    check_docker && shift && logs "$@" ;;
    status)  check_docker && status ;;
    migrate) check_docker && migrate ;;
    seed)    check_docker && seed ;;
    backup)  check_docker && backup ;;
    cleanup) check_docker && cleanup ;;
    help)    help ;;
    *)       echo -e "${RED}未知命令: $1${NC}" && help && exit 1 ;;
esac

