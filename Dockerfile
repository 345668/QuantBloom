# QuantBloom Terminal — single-container local deployment.
# Builds the front-end, then runs server.js which serves both the UI and the
# API from one process on PORT (default 3001).

FROM node:22-slim

WORKDIR /app

# Install dependencies first so the layer caches across source changes.
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Copy source and build the front-end into dist/.
COPY . .
RUN npm run build:local

ENV API_PORT=3001
EXPOSE 3001

# server.js serves dist/ when present, so this is UI + API together.
CMD ["node", "server.js"]
