import { z } from "zod";
import { db } from "@/lib/db";
import { handle, json, readJson, type Params } from "@/lib/api";
import { isStepKey, STEP_KEYS, stepIndex } from "@/lib/agents/constants";
import type { Card, ScriptCard, Steps } from "@/lib/pipeline/types";
import { scriptWordCount } from "@/lib/pipeline/types";

const Body = z.object({ index: z.number().int().min(0), patch: z.record(z.string(), z.unknown()) });

/** Edits one output card of a step and its mirror copy (the next step's input). Editor cards also update the delivered script. */
export const PATCH = handle(async (req: Request, { params }: Params<"id" | "key">) => {
  const { id, key } = await params;
  if (!isStepKey(key)) return json({ error: "unknown step" }, 422);
  const b = Body.parse(await readJson(req));
  const run = await db.agentRun.findUniqueOrThrow({ where: { id } });
  const steps = (run.steps ?? {}) as Steps;
  const step = steps[key];
  if (!step || !step.output[b.index]) return json({ error: "card not found" }, 404);
  const merged = { ...step.output[b.index], ...b.patch } as Card;
  if (merged.kind === "script") (merged as ScriptCard).wordCount = scriptWordCount(merged as ScriptCard);
  step.output[b.index] = merged;
  const next = STEP_KEYS[stepIndex(key) + 1];
  const nextStep = next ? steps[next] : undefined;
  if (nextStep && nextStep.input[b.index]) nextStep.input[b.index] = merged;
  if (key === "editor" && merged.kind === "script" && merged.scriptId) {
    const s = merged as ScriptCard;
    await db.script.update({ where: { id: s.scriptId }, data: { title: s.title, hook: s.hook, body: s.body, cta: s.cta, onScreenText: s.onScreenText, captions: s.captions, hashtags: s.hashtags, notes: s.notes } }).catch(() => {});
  }
  await db.agentRun.update({ where: { id }, data: { steps: steps as object } });
  return json(merged);
});
