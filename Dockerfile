# ==================== 基础镜像 ====================
FROM node:20-bookworm-slim AS base
WORKDIR /app

# 安装必要系统依赖（openssl 给 Prisma 用）
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# ==================== 依赖安装阶段（含开发依赖，供构建用） ====================
FROM base AS deps

# 复制包管理文件
COPY package.json ./
COPY prisma ./prisma/

# 安装依赖（含 dev，用于构建）
RUN npm install --legacy-peer-deps || npm install --legacy-peer-deps --force

# ==================== 构建阶段 ====================
FROM base AS builder
WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules

# 复制源码
COPY . .

# 提供构建期可用的 DATABASE_URL，避免 prisma generate 报错
ARG DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres?schema=public
ENV DATABASE_URL=${DATABASE_URL}

# 生成 Prisma Client
RUN npx prisma generate

# 构建 Next.js
RUN npm run build

# ==================== 生产依赖阶段（仅 prod 依赖，减小体积） ====================
FROM base AS proddeps
WORKDIR /app

COPY package.json ./
# 安装生产依赖 + tsx（Worker/Watchdog 运行时需要）
RUN npm install --omit=dev --legacy-peer-deps || npm install --omit=dev --legacy-peer-deps --force
RUN npm install tsx --save-prod

# ==================== 生产镜像 ====================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home nextjs

# 复制构建产物
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=proddeps /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# 创建数据目录
RUN mkdir -p /app/data/media && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 使用启动脚本同时运行 web 和 worker
CMD ["sh", "scripts/start.sh"]
