# ── Stage 1: Build ───────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Serve with Nginx ────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
# nginx.conf uses __OTEL_BACKEND__ placeholder; entrypoint substitutes it at start
COPY nginx.conf /etc/nginx/conf.d/default.conf.tmpl
# Cache zone must load before default.conf (alphabetical inclusion order)
COPY 00-cache.conf /etc/nginx/conf.d/00-cache.conf
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh \
 && mkdir -p /var/cache/nginx/eventernote

EXPOSE 80

CMD ["/docker-entrypoint.sh"]
