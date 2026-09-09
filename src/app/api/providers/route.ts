import { handle, json } from "@/lib/api";
import { env } from "@/lib/env";
import { providerStatus } from "@/lib/providers";

export const GET = handle(async () => json({ providers: providerStatus(), openrouter: { configured: !!env.openrouterKey, defaultModel: env.openrouterModel }, maxPostsPerPlatform: env.maxPostsPerPlatform }));
