FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev


FROM node:20-alpine AS runtime

WORKDIR /app

RUN apk upgrade --no-cache \
    && rm -rf /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm \
    && rm -f /usr/local/bin/npx

COPY --from=build /app/node_modules ./node_modules

COPY server.js ./
COPY data ./data

EXPOSE 5000

CMD ["node", "server.js"]