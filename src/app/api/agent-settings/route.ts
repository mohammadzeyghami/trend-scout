import { z } from "zod";
import { handle, json, readJson } from "@/lib/api";
import { PIPELINE_STEPS } from "@/lib/agents/constants";
import { effectiveSettings, resetSetting, upsertSetting } from "@/lib/agents/settings";

/** ?projectId= → effective settings for that project (source tells where each comes from). */
export const GET = handle(async (req: Request) => {
  const projectId = new URL(req.url).searchParams.get("projectId");
  const settings = await effectiveSettings(projectId);
  return json(PIPELINE_STEPS.filter((s) => s.model).map((s) => ({ ...settings[s.key], label: s.label, fa: s.fa })));
});

const Put = z.object({ agentKey: z.string(), projectId: z.string().nullable().optional(), model: z.string().min(1).optional(), prompt: z.string().min(1).optional(), temperature: z.number().min(0).max(2).optional() });

export const PUT = handle(async (req: Request) => json(await upsertSetting(Put.parse(await readJson(req)))));

/** ?agentKey=&projectId= → delete the project's copy (or reset the global row to the code default). */
export const DELETE = handle(async (req: Request) => {
  const u = new URL(req.url).searchParams;
  const agentKey = u.get("agentKey");
  if (!agentKey) return json({ error: "agentKey required" }, 422);
  await resetSetting(agentKey, u.get("projectId"));
  return json({ ok: true });
});
