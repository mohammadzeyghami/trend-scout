import { db } from "@/lib/db";
import { handle, json, type Params } from "@/lib/api";

/** Topic + its project + run summaries + the latest run in full + delivered scripts. */
export const GET = handle(async (_req: Request, { params }: Params<"id">) => {
  const { id } = await params;
  const topic = await db.topic.findUniqueOrThrow({ where: { id } });
  const project = await db.project.findUniqueOrThrow({ where: { id: topic.projectId } });
  const runs = await db.agentRun.findMany({ where: { topicId: id }, orderBy: { startedAt: "desc" }, select: { id: true, status: true, currentStep: true, startedAt: true, finishedAt: true, error: true } });
  const latest = runs[0] ? await db.agentRun.findUnique({ where: { id: runs[0].id } }) : null;
  const scripts = await db.script.findMany({ where: { topicId: id }, orderBy: { createdAt: "desc" } });
  return json({ ...topic, project, runs, latestRun: latest, scripts });
});

export const DELETE = handle(async (_req: Request, { params }: Params<"id">) => {
  const { id } = await params;
  await db.$transaction([
    db.script.deleteMany({ where: { topicId: id } }),
    db.agentRun.deleteMany({ where: { topicId: id } }),
    db.topicPost.deleteMany({ where: { topicId: id } }),
    db.topic.delete({ where: { id } }),
  ]);
  return json({ ok: true });
});
