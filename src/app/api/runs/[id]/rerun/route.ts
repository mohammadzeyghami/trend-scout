import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json, readJson, type Params } from "@/lib/api";
import { isStepKey } from "@/lib/agents/constants";
import { rerunFrom } from "@/lib/pipeline/runner";

const Body = z.object({ fromStep: z.string(), refresh: z.boolean().default(false) });

/** New run that keeps the steps before `fromStep` (cards as edited) and continues from there. */
export const POST = handle(async (req: Request, { params }: Params<"id">) => {
  const { id } = await params;
  const b = Body.parse(await readJson(req));
  if (!isStepKey(b.fromStep)) return json({ error: "unknown step" }, 422);
  const prev = await db.agentRun.findUniqueOrThrow({ where: { id } });
  const running = await db.agentRun.findFirst({ where: { topicId: prev.topicId, status: "running" } });
  if (running) return json({ error: "a run is already in progress", runId: running.id }, 409);
  const run = await rerunFrom(id, b.fromStep, { refresh: b.refresh });
  return json({ ok: true, runId: run.id }, 201);
});
