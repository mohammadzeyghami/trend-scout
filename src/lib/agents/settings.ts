import { db } from "../db";
import { env } from "../env";
import { MODEL_AGENT_KEYS, type StepKey } from "./constants";
import { DEFAULT_PROMPTS } from "./defaults";

export type AgentSettingView = {
  agentKey: StepKey;
  model: string;
  prompt: string;
  temperature: number;
  source: "default" | "global" | "project";
};

const isModelAgent = (k: string): k is Exclude<StepKey, "collector"> => (MODEL_AGENT_KEYS as string[]).includes(k);

/** Creates the global default rows once, so the settings page always has something to edit. */
export async function ensureDefaultSettings() {
  for (const key of MODEL_AGENT_KEYS) {
    if (!isModelAgent(key)) continue;
    const exists = await db.agentSetting.findFirst({ where: { agentKey: key, projectId: null } });
    if (!exists) {
      await db.agentSetting.create({ data: { agentKey: key, projectId: null, model: env.openrouterModel, prompt: DEFAULT_PROMPTS[key], temperature: 0.3 } });
    }
  }
}

/** Effective settings for a project: project rows over global rows over code defaults. */
export async function effectiveSettings(projectId?: string | null): Promise<Record<string, AgentSettingView>> {
  await ensureDefaultSettings();
  const rows = await db.agentSetting.findMany({ where: { OR: [{ projectId: null }, ...(projectId ? [{ projectId }] : [])] } });
  const out: Record<string, AgentSettingView> = {};
  for (const key of MODEL_AGENT_KEYS) {
    if (!isModelAgent(key)) continue;
    out[key] = { agentKey: key, model: env.openrouterModel, prompt: DEFAULT_PROMPTS[key], temperature: 0.3, source: "default" };
  }
  for (const r of rows.filter((r) => r.projectId === null)) out[r.agentKey] = { agentKey: r.agentKey as StepKey, model: r.model, prompt: r.prompt, temperature: r.temperature, source: "global" };
  for (const r of rows.filter((r) => r.projectId !== null)) out[r.agentKey] = { agentKey: r.agentKey as StepKey, model: r.model, prompt: r.prompt, temperature: r.temperature, source: "project" };
  return out;
}

export async function upsertSetting(input: { agentKey: string; projectId?: string | null; model?: string; prompt?: string; temperature?: number }) {
  if (!isModelAgent(input.agentKey)) throw new Error(`unknown agent: ${input.agentKey}`);
  const projectId = input.projectId ?? null;
  const base = (await effectiveSettings(projectId))[input.agentKey];
  const data = { model: input.model ?? base.model, prompt: input.prompt ?? base.prompt, temperature: input.temperature ?? base.temperature };
  const existing = await db.agentSetting.findFirst({ where: { agentKey: input.agentKey, projectId } });
  return existing
    ? db.agentSetting.update({ where: { id: existing.id }, data })
    : db.agentSetting.create({ data: { agentKey: input.agentKey, projectId, ...data } });
}

/** A project's copy is deleted (back to global); a global row is reset to the code default. */
export async function resetSetting(agentKey: string, projectId?: string | null) {
  if (!isModelAgent(agentKey)) throw new Error(`unknown agent: ${agentKey}`);
  if (projectId) return db.agentSetting.deleteMany({ where: { agentKey, projectId } });
  const row = await db.agentSetting.findFirst({ where: { agentKey, projectId: null } });
  if (row) await db.agentSetting.update({ where: { id: row.id }, data: { model: env.openrouterModel, prompt: DEFAULT_PROMPTS[agentKey], temperature: 0.3 } });
}
