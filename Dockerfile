
# Stage 1: Install production dependencies
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev


# Stage 2: Production runtime
FROM node:22-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

# Remove package-management tools not required at runtime
RUN rm -rf /usr/local/lib/node_modules/npm \
    /usr/local/lib/node_modules/corepack \
    /opt/yarn-v* \
    && rm -f /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/bin/corepack \
    /usr/local/bin/yarn \
    /usr/local/bin/yarnpkg

# Copy only the application and production dependencies
COPY --from=build /app/node_modules ./node_modules

COPY server.js ./
COPY data ./data

# Run the application without root privileges
USER node

EXPOSE 5000

CMD ["node", "server.js"]
