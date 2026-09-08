# trend-scout

A deep-agent app for content creators: give it a topic, it finds the posts on
**YouTube, TikTok and Instagram** that are currently pulling views on that topic
(inside a time window the user can edit), lists them with references, lets the
user pick (or picks the best itself), and writes a **60-second Instagram Reel
script** from the picked posts.

Status: **planning** — nothing is implemented yet. The roadmap, data-access
strategy, agent chain, data model and phases live in [PLAN.md](PLAN.md) (Persian).

## Shape

- Backend: FastAPI + PostgreSQL, Rastar module layout, agent chain over
  OpenRouter — same stack and patterns as `awal-backend`, whose
  `agent_run` / `run_history` / `agent_settings` modules are the template.
- Dashboard: Next.js (sibling repo, later).
- Chain: Planner → Collector → Ranker → **Selector (human stop)** → Extractor → Writer → Editor.
- Data: a `Provider` adapter per platform (official YouTube Data API; a
  swappable scraping service for Instagram/TikTok), all results cached in Postgres.

## Open decisions (phase 0)

1. Which scraping service for Instagram/TikTok can actually be paid for and returns `play_count`.
2. Transcript (STT) vs caption-only for the Extractor.
3. Separate repo (this one) vs a module inside `awal-backend`.
4. Default OpenRouter model per agent.
