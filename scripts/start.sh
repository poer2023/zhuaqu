#!/bin/sh
# 启动脚本 - 同时运行 web 和 worker
# 使用 prisma db push（不使用 migrations）

set -e

echo "============================================"
echo "[start] Zhaqu Container Starting..."
echo "============================================"

# 等待数据库就绪
echo "[start] Waiting for database to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0
until npx prisma db execute --stdin <<< "SELECT 1" > /dev/null 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "[start] ERROR: Database not ready after $MAX_RETRIES attempts"
    exit 1
  fi
  echo "[start] Database not ready, retrying in 2s... ($RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done
echo "[start] Database is ready!"

# 同步数据库 schema（使用 db push，更简单可靠）
echo "[start] Syncing database schema..."
if npx prisma db push --skip-generate 2>&1; then
  echo "[start] Database schema synced successfully"
else
  echo "[start] WARNING: db push failed, tables might already exist. Continuing..."
fi

# 启动 worker 在后台
echo "[start] Starting worker in background..."
node --import tsx scripts/worker.ts 2>&1 &
WORKER_PID=$!
echo "[start] Worker started with PID: $WORKER_PID"

# 给 worker 一点启动时间
sleep 1

# 启动 web server
echo "[start] Starting web server on port $PORT..."
echo "============================================"
exec node server.js
