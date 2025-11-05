# Multi-stage build for Remix + Express application
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and npm config
COPY package*.json .npmrc ./

# Install ALL dependencies (including dev dependencies for build)
RUN npm ci

# Copy configuration files
COPY tsconfig.json vite.config.ts ./

# Copy source code
COPY server.ts ./
COPY app ./app
COPY public ./public

# Build Remix
RUN npm run build

# Compile server.ts and app/.server files to JavaScript
RUN npx tsc server.ts app/.server/*.ts app/types.ts --outDir . --module esnext --target esnext --moduleResolution bundler --esModuleInterop --skipLibCheck --rootDir .

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Copy package files and npm config
COPY package*.json .npmrc ./

# Install only production dependencies
RUN npm ci --omit=dev --legacy-peer-deps

# Copy built files from builder stage
COPY --from=builder /app/build ./build
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/app ./app

# Expose port
EXPOSE 3000

# Start the production server
CMD ["node", "server.js"]
