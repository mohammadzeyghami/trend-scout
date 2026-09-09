import { db } from "@/lib/db";
import { handle, json, type Params } from "@/lib/api";

export const GET = handle(async (_req: Request, { params }: Params<"id">) => {
  const { id } = await params;
  return json(await db.agentRun.findUniqueOrThrow({ where: { id } }));
});
