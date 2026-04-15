# ── Build stage: build the Vite static site ──────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

# Install all dependencies (including devDependencies for Vite build)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:22-slim AS runner

WORKDIR /app

# Only install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built static files
COPY --from=builder /app/dist ./dist

# Copy server and API code
COPY server.js ./
COPY api/ ./api/

# Cloud Run sets PORT env var (default 8080)
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
