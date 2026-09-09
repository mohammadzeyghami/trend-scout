import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json, readJson, type Params } from "@/lib/api";
import { continueWithSelection } from "@/lib/pipeline/runner";

const Body = z.union([z.object({ postIds: z.array(z.string()).min(1) }), z.object({ auto: z.literal(true) })]);

/** Answers the Selector's human stop on the topic's waiting run. */
export const POST = handle(async (req: Request, { params }: Params<"id">) => {
  const { id } = await params;
  const b = Body.parse(await readJson(req));
  const run = await db.agentRun.findFirst({ where: { topicId: id, status: "waiting_selection" }, orderBy: { startedAt: "desc" } });
  if (!run) return json({ error: "no run is waiting for a selection" }, 409);
  await continueWithSelection(run.id, b);
  return json({ ok: true, runId: run.id });
});
