# ── Stage 1: Build ───────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Serve with Nginx ────────────────────────────────────
FROM node:22-alpine AS api

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/server/db/schema.sql ./dist-server/server/db/schema.sql

USER node
EXPOSE 8787
CMD ["node", "dist-server/server/index.js"]

FROM nginx:alpine AS web

COPY --from=builder /app/dist /usr/share/nginx/html
# nginx.conf uses __OTEL_BACKEND__ placeholder; entrypoint substitutes it at start
COPY nginx.conf /etc/nginx/conf.d/default.conf.tmpl
# Cache zone must load before default.conf (alphabetical inclusion order)
COPY 00-cache.conf /etc/nginx/conf.d/00-cache.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN sed -i 's/\r$//' /docker-entrypoint.sh \
 && chmod +x /docker-entrypoint.sh \
 && mkdir -p /var/cache/nginx/eventernote

EXPOSE 80

CMD ["/docker-entrypoint.sh"]
