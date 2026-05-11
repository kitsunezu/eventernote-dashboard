#!/bin/sh
set -e

# Substitute __OTEL_BACKEND__ placeholder in nginx conf at container start.
# Default to localhost:4318 (no-op) when OTEL_BACKEND is not configured.
OTEL_BACKEND="${OTEL_BACKEND:-http://localhost:4318}"

sed "s|__OTEL_BACKEND__|${OTEL_BACKEND}|g" \
    /etc/nginx/conf.d/default.conf.tmpl \
    > /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"
