#!/bin/sh
# 启动脚本 - 同时运行 web 和 worker
# 包含等待数据库和自动迁移

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

# 运行数据库迁移
echo "[start] Running database migrations..."
if npx prisma migrate deploy 2>&1; then
  echo "[start] Migrations completed successfully"
else
  echo "[start] migrate deploy failed, trying db push..."
  if npx prisma db push --accept-data-loss 2>&1; then
    echo "[start] db push completed successfully"
  else
    echo "[start] WARNING: Both migrate and push failed, continuing anyway..."
  fi
fi

# 生成 Prisma Client（确保与数据库同步）
echo "[start] Generating Prisma Client..."
npx prisma generate 2>&1 || echo "[start] Prisma generate skipped"

# 启动 worker 在后台
echo "[start] Starting worker in background..."
node --import tsx scripts/worker.ts 2>&1 &
WORKER_PID=$!
echo "[start] Worker started with PID: $WORKER_PID"

# 启动 web server
echo "[start] Starting web server on port $PORT..."
echo "============================================"
exec node server.js
