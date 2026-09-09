import { callModel, parseJson } from "../openrouter";
import type { StepKey } from "./constants";
import type { AgentSettingView } from "./settings";

export type TraceEntry = {
  agent: StepKey;
  model: string;
  at: string;
  ms: number;
  ok: boolean;
  error?: string;
  promptTokens?: number;
  completionTokens?: number;
  userPreview: string;
  answerPreview?: string;
};

/** Per-run helper: resolves the agent's settings, calls the model, records the call in the trace. */
export class AgentContext {
  constructor(
    private settings: Record<string, AgentSettingView>,
    public trace: TraceEntry[],
    private onTrace: () => Promise<void>,
  ) {}

  setting(agent: StepKey) {
    const s = this.settings[agent];
    if (!s) throw new Error(`no settings for agent ${agent}`);
    return s;
  }

  async callJson<T>(agent: StepKey, user: string, opts?: { maxTokens?: number }): Promise<T> {
    const s = this.setting(agent);
    const entry: TraceEntry = { agent, model: s.model, at: new Date().toISOString(), ms: 0, ok: false, userPreview: user.slice(0, 400) };
    this.trace.push(entry);
    try {
      const r = await callModel({ model: s.model, system: s.prompt, user, temperature: s.temperature, json: true, maxTokens: opts?.maxTokens });
      entry.ms = r.ms;
      entry.promptTokens = r.usage?.prompt_tokens;
      entry.completionTokens = r.usage?.completion_tokens;
      entry.answerPreview = r.content.slice(0, 400);
      const parsed = parseJson<T>(r.content);
      entry.ok = true;
      return parsed;
    } catch (e) {
      entry.error = e instanceof Error ? e.message : String(e);
      throw e;
    } finally {
      await this.onTrace().catch(() => {});
    }
  }
}
