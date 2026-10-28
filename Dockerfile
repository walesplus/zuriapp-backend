
# Zuri backend - secure production image
FROM node:22-alpine

ENV NODE_ENV=production

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application files
COPY server.js ./
COPY data ./data

# Run as an unprivileged user
USER node

EXPOSE 5000

CMD ["node", "server.js"]
