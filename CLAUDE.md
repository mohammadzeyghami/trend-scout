# trend-scout

Deep-agent app for content creators: topic → trending posts on YouTube/TikTok/Instagram
(user-editable time window) → user or agent picks → 60-second Instagram Reel script.

**Planning stage.** Read `PLAN.md` first — it is the single source of truth for scope,
the agent chain, the data model, the API sketch, phases and risks. Do not start
implementing until the phase-0 decisions in `README.md` are closed.

When implementation starts:
- Same stack and conventions as `../awal-backend` (FastAPI, Rastar module layout,
  Postgres only, OpenRouter agents, no dashboard login). Copy its
  `agent_run` / `run_history` / `agent_settings` modules as the starting point and
  use the `rastar-*` skills from that repo.
- Platform access goes through a `Provider` adapter per platform; provider keys live in
  `.env`, never in code. Cache every collected post in Postgres.
- The Selector step is a human stop implemented with resume-from-step.
