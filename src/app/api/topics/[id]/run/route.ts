import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json, readJson, type Params } from "@/lib/api";
import { startRun } from "@/lib/pipeline/runner";

const Body = z.object({ refresh: z.boolean().default(false) });

/** Starts a brand-new run of the whole chain for the topic. */
export const POST = handle(async (req: Request, { params }: Params<"id">) => {
  const { id } = await params;
  const b = Body.parse(await readJson(req));
  const running = await db.agentRun.findFirst({ where: { topicId: id, status: "running" } });
  if (running) return json({ error: "a run is already in progress", runId: running.id }, 409);
  const run = await startRun(id, { refresh: b.refresh });
  return json({ ok: true, runId: run.id }, 201);
});
