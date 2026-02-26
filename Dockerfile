# Use official Node.js slim image
FROM node:18-slim

# Install Chromium and required font/libs for Puppeteer PDF rendering.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    fonts-noto \
    fonts-noto-cjk \
    libxss1 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies.
# Skip Puppeteer's browser download and use system Chromium.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
  PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN npm install --omit=dev

# Copy app source
COPY . .

# Ensure reports output directory exists.
RUN mkdir -p public/reports

# Expose default app port (Render injects PORT at runtime).
EXPOSE 8080

ENV NODE_ENV=production

# Start server
CMD [ "npm", "start" ]
