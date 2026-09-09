import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json, readJson, type Params } from "@/lib/api";

export const GET = handle(async (_req: Request, { params }: Params<"id">) => {
  const { id } = await params;
  return json(await db.script.findUniqueOrThrow({ where: { id } }));
});

const Patch = z.object({
  title: z.string().optional(),
  hook: z.string().optional(),
  body: z.array(z.object({ time: z.string(), voice: z.string(), visual: z.string() })).optional(),
  cta: z.string().optional(),
  onScreenText: z.array(z.string()).optional(),
  captions: z.array(z.string()).optional(),
  hashtags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  status: z.enum(["draft", "final"]).optional(),
});

export const PATCH = handle(async (req: Request, { params }: Params<"id">) => {
  const { id } = await params;
  return json(await db.script.update({ where: { id }, data: Patch.parse(await readJson(req)) }));
});

export const DELETE = handle(async (_req: Request, { params }: Params<"id">) => {
  const { id } = await params;
  await db.script.delete({ where: { id } });
  return json({ ok: true });
});
