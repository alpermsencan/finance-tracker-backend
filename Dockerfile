# --- Build Stage ---
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src
RUN npm run build

# --- Production Runner Stage ---
FROM node:18-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY schema.sql ./schema.sql

EXPOSE 3000

CMD ["node", "dist/server.js"]
