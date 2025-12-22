#!/bin/sh
# 启动脚本 - 同时运行 web 和 worker

set -e

echo "[start] Running database migrations..."
npx prisma migrate deploy || npx prisma db push || echo "[start] Migration/push skipped"

echo "[start] Starting worker in background..."
node --import tsx scripts/worker.ts &
WORKER_PID=$!
echo "[start] Worker started with PID: $WORKER_PID"

echo "[start] Starting web server..."
exec node server.js
