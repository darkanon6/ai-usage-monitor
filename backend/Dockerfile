FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY public ./public

# Overridable at `docker run` / compose time.
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV PUBLIC_DIR=/app/public
VOLUME ["/app/data"]

# The base image ships a non-root "node" user (uid 1000); no reason to run
# as root when nothing here needs it.
RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3000
CMD ["node", "dist/server.js"]
