/** The chain, in order. A step is one agent; a step's output is the next step's input. */
export const PIPELINE_STEPS = [
  { key: "planner", label: "Planner", fa: "برنامه‌ریز", model: true, desc: "از عنوان، کوئری‌ها و هشتگ‌ها و زاویه‌ها را می‌سازد" },
  { key: "collector", label: "Collector", fa: "جمع‌آوری", model: false, desc: "پست‌ها را از پلتفرم‌ها می‌گیرد و نرمال می‌کند" },
  { key: "ranker", label: "Ranker", fa: "رتبه‌بندی", model: true, desc: "سرعت ویو + تعامل + ربط موضوعی" },
  { key: "selector", label: "Selector", fa: "انتخاب", model: true, desc: "توقف انسانی؛ یا انتخاب خودکار" },
  { key: "extractor", label: "Extractor", fa: "استخراج", model: true, desc: "ترنسکریپت/کپشن و «چرا گرفت»" },
  { key: "writer", label: "Writer", fa: "نویسنده", model: true, desc: "سناریوی ریلز ۶۰ ثانیه" },
  { key: "editor", label: "Editor", fa: "ویراستار", model: true, desc: "پولیش نهایی و چک زمان‌بندی" },
] as const;

export type StepKey = (typeof PIPELINE_STEPS)[number]["key"];
export const STEP_KEYS = PIPELINE_STEPS.map((s) => s.key) as StepKey[];
export const MODEL_AGENT_KEYS = PIPELINE_STEPS.filter((s) => s.model).map((s) => s.key) as StepKey[];
export const stepIndex = (k: StepKey) => STEP_KEYS.indexOf(k);
export const isStepKey = (k: string): k is StepKey => (STEP_KEYS as string[]).includes(k);
