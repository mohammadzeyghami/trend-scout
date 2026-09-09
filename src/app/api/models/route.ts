import { handle, json } from "@/lib/api";
import { listModels } from "@/lib/openrouter";

export const GET = handle(async () => json(await listModels()));
