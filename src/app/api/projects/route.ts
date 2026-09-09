import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json, readJson } from "@/lib/api";
import { PLATFORMS } from "@/lib/providers/types";

export const GET = handle(async () => {
  const projects = await db.project.findMany({ orderBy: { createdAt: "desc" } });
  const counts = await db.topic.groupBy({ by: ["projectId"], _count: { _all: true } });
  const byId = Object.fromEntries(counts.map((c) => [c.projectId, c._count._all]));
  return json(projects.map((p) => ({ ...p, topicCount: byId[p.id] ?? 0 })));
});

const Body = z.object({
  name: z.string().trim().min(1),
  niche: z.string().trim().default(""),
  language: z.string().trim().default("fa"),
  platforms: z.array(z.enum(PLATFORMS as [string, ...string[]])).min(1).default([...PLATFORMS]),
  defaultWindowDays: z.number().int().min(1).max(365).default(30),
  autoSelect: z.boolean().default(false),
  maxSelected: z.number().int().min(1).max(8).default(3),
});

export const POST = handle(async (req: Request) => {
  const data = Body.parse(await readJson(req));
  return json(await db.project.create({ data }), 201);
});
