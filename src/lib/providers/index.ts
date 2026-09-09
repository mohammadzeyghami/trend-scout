import { env } from "../env";
import { apifyInstagramProvider, apifyTiktokProvider } from "./apify";
import { mockProvider } from "./mock";
import { PLATFORMS, type Platform, type Provider } from "./types";
import { youtubeProvider } from "./youtube";

/** The adapter configured for a platform (`PROVIDER_<PLATFORM>` in .env). Unknown names fall back to mock. */
export function getProvider(platform: Platform): Provider {
  const kind = env.providers[platform];
  if (kind === "youtube" && platform === "youtube") return youtubeProvider;
  if (kind === "apify" && platform === "instagram") return apifyInstagramProvider;
  if (kind === "apify" && platform === "tiktok") return apifyTiktokProvider;
  return mockProvider(platform);
}

export function providerStatus() {
  return PLATFORMS.map((platform) => {
    const p = getProvider(platform);
    const r = p.ready();
    return { platform, configured: env.providers[platform], adapter: p.name, ready: r.ok, reason: r.reason ?? null };
  });
}
