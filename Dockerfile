# 单阶段简化构建 - 解决 Coolify 构建问题
FROM node:20-bookworm-slim
WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# 复制包文件
COPY package.json package-lock.json* ./
COPY prisma/schema.prisma ./prisma/

# 设置 npm 配置减少网络问题
RUN npm config set registry https://registry.npmjs.org/ && \
    npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000

# 安装依赖（增加超时和重试）
ENV NODE_OPTIONS="--max-old-space-size=2048"
RUN npm install --legacy-peer-deps || \
    (sleep 10 && npm install --legacy-peer-deps) || \
    (sleep 20 && npm install --legacy-peer-deps --force)

# 复制源码
COPY . .

# 生成 Prisma Client
ARG DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres?schema=public
ENV DATABASE_URL=${DATABASE_URL}
RUN npx prisma generate

# 构建 Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 创建非 root 用户
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home nextjs && \
    mkdir -p /app/data/media && \
    chown -R nextjs:nodejs /app

USER nextjs

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

CMD ["sh", "scripts/start.sh"]
