import { env } from "./env";

export type ModelCall = {
  model: string;
  system: string;
  user: string;
  temperature?: number;
  json?: boolean;
  maxTokens?: number;
};

export type ModelResult = {
  content: string;
  ms: number;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

/** One chat completion over OpenRouter. Throws on transport/HTTP errors. */
export async function callModel(c: ModelCall): Promise<ModelResult> {
  if (!env.openrouterKey) throw new Error("OPENROUTER_API_KEY is not set");
  const t0 = Date.now();
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.openrouterKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3600",
      "X-Title": "trend-scout",
    },
    body: JSON.stringify({
      model: c.model,
      temperature: c.temperature ?? 0.3,
      max_tokens: c.maxTokens ?? 4000,
      ...(c.json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: c.system },
        { role: "user", content: c.user },
      ],
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content ?? "";
  return { content, ms: Date.now() - t0, usage: data.usage };
}

/** Tolerant JSON parse: strips code fences and trailing prose around the first {...} or [...] block. */
export function parseJson<T>(text: string): T {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = Math.min(...["{", "["].map((ch) => cleaned.indexOf(ch)).filter((i) => i >= 0));
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (!Number.isFinite(start) || end < 0) throw new Error("model answer is not JSON");
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  }
}

let modelCache: { at: number; items: { id: string; name: string; pricing?: unknown }[] } | null = null;

/** OpenRouter model catalogue, cached for an hour. */
export async function listModels() {
  if (modelCache && Date.now() - modelCache.at < 3_600_000) return modelCache.items;
  const res = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`OpenRouter models ${res.status}`);
  const data = await res.json();
  const items = (data.data as { id: string; name: string; pricing?: unknown }[])
    .map((m) => ({ id: m.id, name: m.name, pricing: m.pricing }))
    .sort((a, b) => a.id.localeCompare(b.id));
  modelCache = { at: Date.now(), items };
  return items;
}
