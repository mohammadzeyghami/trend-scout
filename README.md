# trend-scout

A deep-agent app for content creators. Give it a topic; it finds the posts on
**YouTube, TikTok and Instagram** that are pulling views on that topic inside a
time window you can edit, lists them with references, lets you pick (or picks the
best itself), and writes **60-second Instagram Reel scripts** from the picks.

Full-stack **Next.js 16** (App Router, route handlers, Prisma, PostgreSQL). No
separate backend. Persian RTL dashboard. Agents run over **OpenRouter**.

## The chain

| # | step | agent | does |
|---|---|---|---|
| 1 | Planner | model | topic → 6–10 search queries (creator language + English), hashtags, content angles |
| 2 | Collector | code | one `Provider` per platform → normalised posts, deduped, cached in Postgres |
| 3 | Ranker | code + model | score = 55 % view velocity (views/day, log-normalised) + 15 % engagement + 30 % model relevance (batched, per index) |
| 4 | Selector | human **or** model | the run pauses (`waiting_selection`) until you tick posts, or auto-picks `maxSelected` when the project has `autoSelect` |
| 5 | Extractor | code + model | YouTube transcript when available, else caption → why it worked, hook, structure, key points |
| 6 | Writer | model | one original 60 s script per pick: hook, timed beats (voice + visual), CTA, overlays, captions, hashtags |
| 7 | Editor | model | polish + word-count check → delivered as `Script` rows |

Every step's input/output cards are persisted **live** (`AgentRun.steps`) and every model
call is traced (`AgentRun.trace`). A failing agent marks its step `failed` and passes its
input through; the chain never stops on an agent error. Any run can be re-run from any
step (the steps before it are copied as they are, cards as edited). Editor cards are
editable and mirror into the delivered script.

## Run it

```bash
cp .env.example .env            # set OPENROUTER_API_KEY (providers default to "mock")
pnpm install
docker-compose -f compose.yml up -d db     # Postgres on :5438
pnpm prisma migrate deploy
pnpm dev                        # http://localhost:3600
```

With the default `PROVIDER_*=mock` the whole chain runs on deterministic fake posts, so
you can test the dashboard and the agents without any platform key.

## Platform providers

| platform | adapter (`PROVIDER_*`) | needs | notes |
|---|---|---|---|
| YouTube | `youtube` | `YOUTUBE_API_KEY` (Data API v3, free quota) | `search.list` per query with the date window, `videos.list` for stats; transcripts via captions |
| Instagram | `apify` | `APIFY_TOKEN` | `apify~instagram-scraper` on hashtag pages; reels carry `videoPlayCount` |
| TikTok | `apify` | `APIFY_TOKEN` | `clockworks~tiktok-scraper` keyword + hashtag search |
| any | `mock` | – | deterministic fake posts |

Adapters implement `src/lib/providers/types.ts#Provider` and are swapped in
`src/lib/providers/index.ts`. Instagram/TikTok scrapers do not filter by date, so the
collector over-fetches and filters; results are cached (`Post` + `TopicPost`) and a
window change re-runs from the Collector on the cache first (`refresh` forces a re-fetch).

## Layout

```
prisma/schema.prisma          Project, Topic, Post, TopicPost, AgentRun, Script, AgentSetting
src/lib/agents/               constants (PIPELINE_STEPS), defaults (prompts), settings, context (traced calls)
src/lib/providers/            youtube, apify (instagram + tiktok), mock, index
src/lib/pipeline/             runner (start / rerunFrom / continueWithSelection), steps, scoring, transcript, types
src/app/api/                  route handlers (see below)
src/app/                      / projects · /projects/[id] · /topics/[id] (run view) · /settings
```

## API

```
GET/POST    /api/projects                      PATCH/DELETE /api/projects/{id}
GET/POST    /api/projects/{id}/topics          (POST creates the topic and starts a run)
GET/DELETE  /api/topics/{id}                   topic + project + runs + latest run + scripts
PATCH       /api/topics/{id}/window            {windowFrom, windowTo, refresh?} → re-run from Collector
POST        /api/topics/{id}/select            {postIds:[…]} | {auto:true}   answers the Selector stop
POST        /api/topics/{id}/run               fresh run
GET         /api/runs/{id}                     POST /api/runs/{id}/rerun {fromStep, refresh?}
PATCH       /api/runs/{id}/steps/{key}/cards   {index, patch}
GET/PATCH/DELETE /api/scripts/{id}
GET/PUT/DELETE   /api/agent-settings[?projectId=]   per-agent model / prompt / temperature
GET         /api/models · /api/providers · /api/steps
```

## Deploy

`Dockerfile` builds a standalone Next.js image; `docker/entrypoint.sh` runs
`prisma migrate deploy` then starts the server on `:3000`. Required env:
`DATABASE_URL`, `OPENROUTER_API_KEY`; optional provider keys as above. The dashboard
has no login — keep it behind basic auth or a private network.
