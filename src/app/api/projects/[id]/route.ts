import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json, readJson, type Params } from "@/lib/api";
import { PLATFORMS } from "@/lib/providers/types";

export const GET = handle(async (_req: Request, { params }: Params<"id">) => {
  const { id } = await params;
  const project = await db.project.findUniqueOrThrow({ where: { id } });
  const topics = await db.topic.findMany({ where: { projectId: id }, orderBy: { createdAt: "desc" } });
  const scriptCounts = await db.script.groupBy({ by: ["topicId"], _count: { _all: true }, where: { topicId: { in: topics.map((t) => t.id) } } });
  const byTopic = Object.fromEntries(scriptCounts.map((c) => [c.topicId, c._count._all]));
  return json({ ...project, topics: topics.map((t) => ({ ...t, scriptCount: byTopic[t.id] ?? 0 })) });
});

const Patch = z.object({
  name: z.string().trim().min(1).optional(),
  niche: z.string().trim().optional(),
  language: z.string().trim().optional(),
  platforms: z.array(z.enum(PLATFORMS as [string, ...string[]])).min(1).optional(),
  defaultWindowDays: z.number().int().min(1).max(365).optional(),
  autoSelect: z.boolean().optional(),
  maxSelected: z.number().int().min(1).max(8).optional(),
});

export const PATCH = handle(async (req: Request, { params }: Params<"id">) => {
  const { id } = await params;
  return json(await db.project.update({ where: { id }, data: Patch.parse(await readJson(req)) }));
});

export const DELETE = handle(async (_req: Request, { params }: Params<"id">) => {
  const { id } = await params;
  const topics = await db.topic.findMany({ where: { projectId: id }, select: { id: true } });
  const ids = topics.map((t) => t.id);
  await db.$transaction([
    db.script.deleteMany({ where: { topicId: { in: ids } } }),
    db.agentRun.deleteMany({ where: { topicId: { in: ids } } }),
    db.topicPost.deleteMany({ where: { topicId: { in: ids } } }),
    db.topic.deleteMany({ where: { projectId: id } }),
    db.agentSetting.deleteMany({ where: { projectId: id } }),
    db.project.delete({ where: { id } }),
  ]);
  return json({ ok: true });
});
