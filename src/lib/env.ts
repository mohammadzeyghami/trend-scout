const s = (k: string, d = "") => process.env[k] ?? d;

export const env = {
  openrouterKey: s("OPENROUTER_API_KEY"),
  openrouterModel: s("OPENROUTER_MODEL", "openai/gpt-4o-mini"),
  providers: {
    youtube: s("PROVIDER_YOUTUBE", "mock"),
    instagram: s("PROVIDER_INSTAGRAM", "mock"),
    tiktok: s("PROVIDER_TIKTOK", "mock"),
  },
  youtubeKey: s("YOUTUBE_API_KEY"),
  apifyToken: s("APIFY_TOKEN"),
  apifyInstagramActor: s("APIFY_INSTAGRAM_ACTOR", "apify~instagram-scraper"),
  apifyTiktokActor: s("APIFY_TIKTOK_ACTOR", "clockworks~tiktok-scraper"),
  maxPostsPerPlatform: Number(s("MAX_POSTS_PER_PLATFORM", "30")),
};
