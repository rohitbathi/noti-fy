# build stage
FROM ghcr.io/puppeteer/puppeteer:24.4.0 AS build

USER root

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

RUN apt-get update && apt-get install gnupg wget -y && \
  wget --quiet --output-document=- https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /etc/apt/trusted.gpg.d/google-archive.gpg && \
  sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' && \
  apt-get update && \
  apt-get install google-chrome-stable -y --no-install-recommends && \
  rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/notify-scrape

COPY package*.json ./
COPY tsconfig.json ./

RUN npm i

COPY . .
# COPY .env ./.env

RUN npm run gcp-build

# production stage
FROM ghcr.io/puppeteer/puppeteer:24.4.0 AS production

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /usr/src/notify-scrape

COPY package*.json .

RUN npm ci --only=production

# Copy compiled build from the build stage
COPY --from=build /usr/src/notify-scrape/dist ./dist

CMD ["node", "dist/main.js"]