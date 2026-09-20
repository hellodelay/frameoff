# Multi-stage Dockerfile for Google Photos Digital Frame
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests and locks
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Build Vite client and backend server bundle
RUN npm run build

# Runner stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled assets from builder
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
