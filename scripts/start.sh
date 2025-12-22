#!/bin/sh
# 启动脚本 - 同时运行 web 和 worker

echo "============================================"
echo "[start] Zhaqu Container Starting..."
echo "============================================"

# 等待数据库连接
echo "[start] Waiting for database connection..."
sleep 3

# 跳过 prisma db push - 表已经存在
echo "[start] Skipping database sync (tables should already exist)"

# 确保 Prisma Client 已生成
echo "[start] Ensuring Prisma Client is ready..."
npx prisma generate 2>&1 || true

# 启动 worker 在后台
echo "[start] Starting worker in background..."
node --import tsx scripts/worker.ts 2>&1 &
WORKER_PID=$!
echo "[start] Worker started with PID: $WORKER_PID"

# 给 worker 一点启动时间
sleep 2

# 启动 web server
# Next.js standalone 模式下 server.js 在 .next/standalone/ 目录
echo "[start] Starting web server on port $PORT..."
echo "============================================"

if [ -f ".next/standalone/server.js" ]; then
    exec node .next/standalone/server.js
elif [ -f "server.js" ]; then
    exec node server.js
else
    # 如果没有 standalone，使用 npm start
    exec npm start
fi
