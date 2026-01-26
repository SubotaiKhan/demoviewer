# Stage 1: Build frontend
FROM node:22-slim AS builder

WORKDIR /build/client
COPY client/package.json client/package-lock.json* ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Production server
FROM node:22-slim

RUN apt-get update && apt-get install -y dumb-init && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install server dependencies
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm ci --omit=dev

# Copy server code
COPY server/ ./server/

# Copy built frontend
COPY --from=builder /build/client/dist ./client/dist

# Copy map assets
COPY maps/ ./maps/

# Create demos directory (will be mounted as volume)
RUN mkdir -p /app/demos

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server/index.js"]
