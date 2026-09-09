---
name: run-dev
description: Launch trend-scout (Next.js on :3600, Postgres via docker-compose on :5438) and open the live tab for Mohammad. Use whenever asked to run/start/بالا بیار this app.
---

# Run trend-scout (dev)

This Mac Studio is remote; Mohammad views it over Tailscale at **100.106.1.79**.
Next binds all interfaces, so report **http://100.106.1.79:3600**.

## One-time setup (skip if present)

```bash
cd ~/projects/trend-scout
[ -f .env ] || cp .env.example .env     # then set OPENROUTER_API_KEY (copy from ~/projects/awal-backend/.env)
[ -d node_modules ] || pnpm install
```

## Launch

```bash
cd ~/projects/trend-scout
docker-compose -f compose.yml up -d db                       # Postgres :5438 (container trend-scout-db)
until docker exec trend-scout-db pg_isready -U trend >/dev/null 2>&1; do sleep 1; done
pnpm prisma migrate deploy
lsof -iTCP:3600 -sTCP:LISTEN -t >/dev/null && echo "3600 busy — probably already running (see Stop)"
nohup pnpm dev > "$SCRATCHPAD/trend-scout.log" 2>&1 &
until grep -q "Ready" "$SCRATCHPAD/trend-scout.log"; do sleep 1; done
```

## Verify, then open the tab

```bash
curl -s localhost:3600/api/providers      # provider + OpenRouter status
"$BROWSER" "http://100.106.1.79:3600"     # open on Mohammad's device
```

## Stop

```bash
kill $(lsof -iTCP:3600 -sTCP:LISTEN -t)
docker-compose -f compose.yml stop db      # optional
```
