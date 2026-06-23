# JACK — production container (Bun server + LLM proxy)
# Serves the built app and the /api/chat brain proxy on port 8080.
FROM oven/bun:1.3

WORKDIR /app

# Install deps first for better layer caching
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# App source
COPY . .

# Build the React bundle into ./public
RUN bun run build

ENV NODE_ENV=production
EXPOSE 8080

# server.ts skips the file watcher in production and serves public/ + /api/*
CMD ["bun", "run", "server.ts"]
