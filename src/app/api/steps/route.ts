import { json } from "@/lib/api";
import { PIPELINE_STEPS } from "@/lib/agents/constants";

export const GET = () => json(PIPELINE_STEPS);
