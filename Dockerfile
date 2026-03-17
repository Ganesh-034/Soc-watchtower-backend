
# Node 22 runtime
FROM node:22-bookworm-slim

WORKDIR /app

# Install system dependencies for Puppeteer (optional)
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      fonts-liberation \
      libasound2 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libatspi2.0-0 \
      libc6 \
      libcairo2 \
      libcups2 \
      libdbus-1-3 \
      libdrm2 \
      libexpat1 \
      libgbm1 \
      libgcc1 \
      libglib2.0-0 \
      libgtk-3-0 \
      libnss3 \
      libpango-1.0-0 \
      libpangocairo-1.0-0 \
      libstdc++6 \
      libx11-6 \
      libx11-xcb1 \
      libxcb1 \
      libxcomposite1 \
      libxcursor1 \
      libxdamage1 \
      libxext6 \
      libxfixes3 \
      libxi6 \
      libxrandr2 \
      libxrender1 \
      libxss1 \
      libxtst6 \
    ; rm -rf /var/lib/apt/lists/*

# Avoid downloading chromium in production image
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Install only production deps
COPY package*.json ./
# If your package-lock.json is committed (recommended), npm ci is deterministic
# RUN npm ci --omit=dev
RUN npm install --omit=dev

# Copy application source
COPY . .

# Environment & port
ENV NODE_ENV=production
# Puppeteer runs headless by default; uncomment if you use custom chromium path/options
# ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
# ENV PUPPETEER_SKIP_DOWNLOAD=true

EXPOSE 5000

# Start the server (matches your package.json "start": "node src/server.js")
CMD ["npm", "start"]