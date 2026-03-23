#!/bin/sh
# Inject runtime environment variables into the built frontend.
# Vite bakes VITE_* at build time, but we want to configure
# VITE_OTEL_ENDPOINT at deploy time without rebuilding.

RUNTIME_JS=/usr/share/nginx/html/runtime-config.js

cat <<EOF > "$RUNTIME_JS"
window.__RUNTIME_CONFIG__ = {
  VITE_OTEL_ENDPOINT: "${VITE_OTEL_ENDPOINT:-}"
};
EOF

echo "[entrypoint] runtime-config.js written (VITE_OTEL_ENDPOINT=${VITE_OTEL_ENDPOINT:-<unset>})"

exec nginx -g 'daemon off;'
