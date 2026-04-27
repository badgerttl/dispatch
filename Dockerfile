FROM node:22 AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:22-slim
WORKDIR /app
RUN apt-get update && apt-get install -y python3 --no-install-recommends && rm -rf /var/lib/apt/lists/*
COPY server/package*.json ./
RUN npm ci --production
COPY server/ ./
COPY --from=client-builder /app/client/dist ./public
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["node", "index.js"]
