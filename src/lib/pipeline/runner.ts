import { AgentContext } from "../agents/context";
import { STEP_KEYS, stepIndex, type StepKey } from "../agents/constants";
import { effectiveSettings } from "../agents/settings";
import { db } from "../db";
import { autoSelect, deliverScripts, fallbackPlan, manualSelect, runCollector, runEditor, runExtractor, runPlanner, runRanker, runWriter, topicCard, type StepEnv } from "./steps";
import type { Card, ExtractCard, PlanCard, PostCard, ScriptCard, StepRecord, Steps, TraceEntry } from "./types";

type State = { plan?: PlanCard; posts: PostCard[]; ranked: PostCard[]; selected: PostCard[]; extracts: ExtractCard[]; drafts: ScriptCard[]; finals: ScriptCard[] };

const now = () => new Date().toISOString();
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Runs of the topic still waiting for a selection are superseded by a newer run. */
async function cancelWaiting(topicId: string) {
  await db.agentRun.updateMany({ where: { topicId, status: "waiting_selection" }, data: { status: "cancelled", finishedAt: new Date() } });
}

/** A new run of the whole chain for a topic. Returns immediately; the chain continues in the background. */
export async function startRun(topicId: string, opts: { refresh?: boolean } = {}) {
  await cancelWaiting(topicId);
  const run = await db.agentRun.create({ data: { topicId, status: "running", currentStep: "planner" } });
  await db.topic.update({ where: { id: topicId }, data: { status: "running" } });
  kick(run.id, "planner", opts);
  return run;
}

/** A new run that keeps the steps before `fromStep` as they are and continues from there. */
export async function rerunFrom(runId: string, fromStep: StepKey, opts: { refresh?: boolean } = {}) {
  const prev = await db.agentRun.findUniqueOrThrow({ where: { id: runId } });
  const kept: Steps = {};
  const prevSteps = (prev.steps ?? {}) as Steps;
  for (const k of STEP_KEYS) if (stepIndex(k) < stepIndex(fromStep) && prevSteps[k]) kept[k] = prevSteps[k];
  await cancelWaiting(prev.topicId);
  const run = await db.agentRun.create({ data: { topicId: prev.topicId, status: "running", currentStep: fromStep, steps: kept as object, selectedIds: fromStep === "extractor" ? prev.selectedIds : [] } });
  await db.topic.update({ where: { id: prev.topicId }, data: { status: "running" } });
  kick(run.id, fromStep, opts);
  return run;
}

/** Answers the Selector's human stop on the same run: records the choice, continues from the Extractor. */
export async function continueWithSelection(runId: string, choice: { postIds: string[] } | { auto: true }) {
  const run = await db.agentRun.findUniqueOrThrow({ where: { id: runId } });
  if (run.status !== "waiting_selection") throw new Error(`run is ${run.status}, not waiting for a selection`);
  const steps = (run.steps ?? {}) as Steps;
  const ranked = (steps.ranker?.output ?? []) as PostCard[];
  const project = await projectOf(run.topicId);
  const topic = await db.topic.findUniqueOrThrow({ where: { id: run.topicId } });
  const ctx = await makeContext(run.id, project.id, (run.trace ?? []) as TraceEntry[]);
  const env: StepEnv = { topic, project, ctx, notes: [], refresh: false };
  const selected = "auto" in choice ? await autoSelect(env, ranked) : manualSelect(ranked, choice.postIds);
  if (!selected.length) throw new Error("nothing selected");
  steps.selector = { ...(steps.selector ?? { notes: [], input: ranked, output: [] }), status: "done", finishedAt: now(), notes: [...(steps.selector?.notes ?? []), ...env.notes], output: selected };
  await db.agentRun.update({ where: { id: runId }, data: { status: "running", currentStep: "extractor", steps: steps as object, trace: ctx.trace as object[], selectedIds: selected.map((s) => s.id) } });
  await db.topic.update({ where: { id: run.topicId }, data: { status: "running" } });
  kick(runId, "extractor", {});
}

function kick(runId: string, from: StepKey, opts: { refresh?: boolean }) {
  void execute(runId, from, opts).catch(async (e) => {
    console.error(`[run ${runId}] crashed:`, e);
    await db.agentRun.update({ where: { id: runId }, data: { status: "failed", error: errMsg(e), finishedAt: new Date() } }).catch(() => {});
  });
}

async function projectOf(topicId: string) {
  const topic = await db.topic.findUniqueOrThrow({ where: { id: topicId } });
  return db.project.findUniqueOrThrow({ where: { id: topic.projectId } });
}

async function makeContext(runId: string, projectId: string, trace: TraceEntry[]) {
  const settings = await effectiveSettings(projectId);
  return new AgentContext(settings, trace, async () => {
    await db.agentRun.update({ where: { id: runId }, data: { trace: trace as object[] } });
  });
}

function rebuild(steps: Steps): State {
  const out = <T>(k: StepKey) => ((steps[k]?.output ?? []) as unknown) as T;
  return {
    plan: out<PlanCard[]>("planner")[0],
    posts: out<PostCard[]>("collector"),
    ranked: out<PostCard[]>("ranker"),
    selected: out<PostCard[]>("selector"),
    extracts: out<ExtractCard[]>("extractor"),
    drafts: out<ScriptCard[]>("writer"),
    finals: out<ScriptCard[]>("editor"),
  };
}

async function execute(runId: string, from: StepKey, opts: { refresh?: boolean }) {
  const run = await db.agentRun.findUniqueOrThrow({ where: { id: runId } });
  const topic = await db.topic.findUniqueOrThrow({ where: { id: run.topicId } });
  const project = await db.project.findUniqueOrThrow({ where: { id: topic.projectId } });
  const steps = (run.steps ?? {}) as Steps;
  const ctx = await makeContext(runId, project.id, (run.trace ?? []) as TraceEntry[]);
  const state = rebuild(steps);

  const persist = async (extra: { status?: string; currentStep?: string | null; error?: string; finishedAt?: Date } = {}) => {
    await db.agentRun.update({ where: { id: runId }, data: { steps: steps as object, trace: ctx.trace as object[], ...extra } });
  };

  for (const key of STEP_KEYS.slice(stepIndex(from))) {
    const env: StepEnv = { topic, project, ctx, notes: [], refresh: !!opts.refresh };
    const input = inputFor(key, state, topic, project);
    const rec: StepRecord = { status: "running", startedAt: now(), notes: [], input, output: [] };
    steps[key] = rec;
    await persist({ currentStep: key });
    try {
      const output = await runStep(key, env, state);
      if (output === "waiting") {
        rec.status = "waiting";
        rec.notes = env.notes;
        await persist({ status: "waiting_selection", currentStep: key });
        await db.topic.update({ where: { id: topic.id }, data: { status: "waiting_selection" } });
        return;
      }
      rec.output = output;
      rec.status = "done";
    } catch (e) {
      rec.status = "failed";
      rec.error = errMsg(e);
      rec.output = passThrough(key, input, topic);
      applyOutput(key, state, rec.output);
      rec.notes = env.notes;
      rec.finishedAt = now();
      await persist();
      continue;
    }
    rec.notes = env.notes;
    rec.finishedAt = now();
    await persist();
  }

  await persist({ status: "finished", currentStep: null, finishedAt: new Date() });
  await db.topic.update({ where: { id: topic.id }, data: { status: "finished" } });
}

function inputFor(key: StepKey, s: State, topic: Parameters<typeof topicCard>[0], project: Parameters<typeof topicCard>[1]): Card[] {
  switch (key) {
    case "planner": return [topicCard(topic, project)];
    case "collector": return s.plan ? [s.plan] : [];
    case "ranker": return s.posts;
    case "selector": return s.ranked;
    case "extractor": return s.selected;
    case "writer": return s.extracts;
    case "editor": return s.drafts;
  }
}

function applyOutput(key: StepKey, s: State, output: Card[]) {
  switch (key) {
    case "planner": s.plan = output[0] as PlanCard; break;
    case "collector": s.posts = output as PostCard[]; break;
    case "ranker": s.ranked = output as PostCard[]; break;
    case "selector": s.selected = output as PostCard[]; break;
    case "extractor": s.extracts = output as ExtractCard[]; break;
    case "writer": s.drafts = output as ScriptCard[]; break;
    case "editor": s.finals = output as ScriptCard[]; break;
  }
}

/** A failed agent passes its input through so the chain never stops. */
function passThrough(key: StepKey, input: Card[], topic: Parameters<typeof fallbackPlan>[0]): Card[] {
  if (key === "planner") return [fallbackPlan(topic)];
  if (key === "extractor") return (input as PostCard[]).map((p): ExtractCard => ({ ...p, kind: "extract", source: "caption", sourceText: [p.title, p.caption].filter(Boolean).join("\n"), angle: "", whyItWorked: "", hook: "", structure: [], keyPoints: [] }));
  if (key === "collector" || key === "writer") return [];
  return input;
}

async function runStep(key: StepKey, env: StepEnv, s: State): Promise<Card[] | "waiting"> {
  switch (key) {
    case "planner": { s.plan = await runPlanner(env); return [s.plan]; }
    case "collector": { s.posts = await runCollector(env, s.plan ?? fallbackPlan(env.topic)); return s.posts; }
    case "ranker": { s.ranked = await runRanker(env, s.posts); return s.ranked; }
    case "selector": {
      if (!s.ranked.length) throw new Error("nothing to select from");
      if (!env.project.autoSelect) return "waiting";
      s.selected = await autoSelect(env, s.ranked);
      await db.agentRun.updateMany({ where: { topicId: env.topic.id, status: "running" }, data: { selectedIds: s.selected.map((p) => p.id) } });
      return s.selected;
    }
    case "extractor": { s.extracts = await runExtractor(env, s.selected, s.plan); return s.extracts; }
    case "writer": { s.drafts = await runWriter(env, s.extracts); return s.drafts; }
    case "editor": {
      const finals = await runEditor(env, s.drafts);
      const runRow = await db.agentRun.findFirst({ where: { topicId: env.topic.id, currentStep: "editor" }, orderBy: { startedAt: "desc" } });
      s.finals = await deliverScripts(env.topic.id, runRow?.id ?? "", finals);
      return s.finals;
    }
  }
}
