import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json, readJson, type Params } from "@/lib/api";
import { rerunFrom, startRun } from "@/lib/pipeline/runner";

const Body = z.object({ windowFrom: z.string().datetime(), windowTo: z.string().datetime(), refresh: z.boolean().default(false), rerun: z.boolean().default(true) });

/** Changes the time window; by default re-runs from the Collector (cache first, platforms only if `refresh`). */
export const PATCH = handle(async (req: Request, { params }: Params<"id">) => {
  const { id } = await params;
  const b = Body.parse(await readJson(req));
  const from = new Date(b.windowFrom), to = new Date(b.windowTo);
  if (from >= to) return json({ error: "windowFrom must be before windowTo" }, 422);
  const topic = await db.topic.update({ where: { id }, data: { windowFrom: from, windowTo: to } });
  let runId: string | null = null;
  if (b.rerun) {
    const running = await db.agentRun.findFirst({ where: { topicId: id, status: "running" } });
    if (running) return json({ error: "a run is already in progress", runId: running.id }, 409);
    const latest = await db.agentRun.findFirst({ where: { topicId: id }, orderBy: { startedAt: "desc" } });
    const hasPlan = !!latest && !!(latest.steps as Record<string, unknown>)?.planner;
    const run = hasPlan ? await rerunFrom(latest!.id, "collector", { refresh: b.refresh }) : await startRun(id, { refresh: b.refresh });
    runId = run.id;
  }
  return json({ ...topic, runId });
});
