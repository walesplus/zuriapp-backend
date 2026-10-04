FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev


FROM node:20-alpine AS runtime

WORKDIR /app

RUN apk upgrade --no-cache

COPY --from=build /app/node_modules ./node_modules

COPY server.js ./
COPY data ./data

EXPOSE 5000

CMD ["node", "server.js"]