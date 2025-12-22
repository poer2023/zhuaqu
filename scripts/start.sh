#!/bin/sh
# 启动脚本 - 同时运行 web 和 worker
# 简化版：跳过数据库同步，直接启动服务

echo "============================================"
echo "[start] Zhaqu Container Starting..."
echo "============================================"

# 等待数据库就绪（简单检查）
echo "[start] Waiting for database connection..."
sleep 3

# 跳过 prisma db push - 表已经存在
# 如果需要同步 schema，手动在 Terminal 执行: npx prisma db push
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
echo "[start] Starting web server on port $PORT..."
echo "============================================"
exec node server.js
