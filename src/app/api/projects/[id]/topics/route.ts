import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json, readJson, type Params } from "@/lib/api";
import { startRun } from "@/lib/pipeline/runner";

export const GET = handle(async (_req: Request, { params }: Params<"id">) => {
  const { id } = await params;
  return json(await db.topic.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" } }));
});

const Body = z.object({
  title: z.string().trim().min(2),
  windowFrom: z.string().datetime().optional(),
  windowTo: z.string().datetime().optional(),
  windowDays: z.number().int().min(1).max(365).optional(),
  start: z.boolean().default(true),
});

/** Creates a topic and (by default) starts its first run. */
export const POST = handle(async (req: Request, { params }: Params<"id">) => {
  const { id } = await params;
  const project = await db.project.findUniqueOrThrow({ where: { id } });
  const b = Body.parse(await readJson(req));
  const windowTo = b.windowTo ? new Date(b.windowTo) : new Date();
  const windowFrom = b.windowFrom ? new Date(b.windowFrom) : new Date(windowTo.getTime() - (b.windowDays ?? project.defaultWindowDays) * 86_400_000);
  const topic = await db.topic.create({ data: { projectId: id, title: b.title, windowFrom, windowTo } });
  const run = b.start ? await startRun(topic.id) : null;
  return json({ ...topic, runId: run?.id ?? null }, 201);
});
