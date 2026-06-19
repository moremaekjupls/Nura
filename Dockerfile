FROM node:20-bookworm-slim

# Native build deps for better-sqlite3 / node-gyp
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Use the exact pnpm version pinned in package.json via corepack
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

COPY package.json ./
COPY pnpm-lock.yaml* ./

RUN pnpm install --no-frozen-lockfile

COPY . .

RUN pnpm build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["pnpm", "start"]
