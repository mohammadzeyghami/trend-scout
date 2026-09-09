# trend-scout

Deep-agent app for content creators: topic → trending posts on YouTube/TikTok/Instagram
(user-editable time window) → user or agent picks → 60-second Instagram Reel scripts.
**Full-stack Next.js 16** (App Router + route handlers + Prisma/PostgreSQL) — there is no
FastAPI backend; the chain runs inside the Next server process. Persian RTL dashboard.
`README.md` documents the chain, providers, layout, API and deploy; `PLAN.md` is the
original roadmap (kept for history; decisions there that changed are listed at its top).

## Conventions

- `src/lib/agents/constants.ts#PIPELINE_STEPS` is the single definition of the chain.
  Adding a step = add it there, implement it in `pipeline/steps.ts`, wire it in
  `pipeline/runner.ts` (`inputFor` / `applyOutput` / `passThrough` / `runStep`).
- Model agents answer JSON; batched ones answer per index (`{"items":[{"index":0,…}]}`).
  Prompts live in `agents/defaults.ts`; runtime overrides in `AgentSetting`
  (global rows with `projectId NULL`, per-project copies created on first edit).
- A failing agent must not stop the chain: throw inside the step → runner marks it
  `failed` and passes input through. Partial failures go to `env.notes`.
- Platform access only through a `Provider` (`providers/types.ts`); never call a
  platform from a step directly. Keys and adapter choice live in `.env`.
- The Selector is the only human stop: `waiting_selection` on run + topic, answered by
  `POST /api/topics/{id}/select`, continued on the **same** run from the Extractor.
- Runs execute fire-and-forget inside the route handler (`kick()` in runner). Works on a
  long-lived Node server (dev, `next start`, Docker); not on serverless.
- Ports: app **3600**, Postgres **5438** (`compose.yml`). Other apps on this Mac use
  3200/3300/3400/3500 and 5434/5435/5437.

## Commands

```bash
pnpm install && docker-compose -f compose.yml up -d db
pnpm prisma migrate dev            # after editing prisma/schema.prisma
pnpm dev                            # :3600
npx tsc --noEmit -p . && pnpm lint && pnpm build
```

To run it for Mohammad follow `.claude/skills/run-dev/SKILL.md` (he opens
**http://100.106.1.79:3600** over Tailscale).
