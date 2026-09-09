#!/bin/sh
set -e
echo "→ prisma migrate deploy"
node node_modules/prisma/build/index.js migrate deploy
echo "→ next start on :${PORT:-3000}"
exec node server.js
