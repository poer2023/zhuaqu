# ==================== 基础镜像 ====================
FROM node:20-bookworm-slim AS base
WORKDIR /app

# 安装必要系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# ==================== 依赖安装阶段 ====================
FROM base AS deps

# 只复制包管理文件 - 利用 Docker 缓存
COPY package.json package-lock.json* ./
COPY prisma/schema.prisma ./prisma/

# 安装所有依赖（用于构建）
RUN npm ci --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps

# ==================== 构建阶段 ====================
FROM base AS builder
WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules

# 复制源码
COPY . .

# 提供构建期可用的 DATABASE_URL
ARG DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres?schema=public
ENV DATABASE_URL=${DATABASE_URL}

# 生成 Prisma Client
RUN npx prisma generate

# 构建 Next.js（启用缓存）
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

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

# 复制运行时需要的文件
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# 从构建阶段复制 node_modules（已包含 tsx 和全部依赖）
COPY --from=deps /app/node_modules ./node_modules

# 创建数据目录
RUN mkdir -p /app/data/media && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 使用启动脚本同时运行 web 和 worker
CMD ["sh", "scripts/start.sh"]
