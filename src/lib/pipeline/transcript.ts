import { YoutubeTranscript } from "youtube-transcript";

/** Best-effort transcript: YouTube captions only. Other platforms return null (caption fallback). */
export async function fetchTranscript(platform: string, url: string): Promise<string | null> {
  if (platform !== "youtube") return null;
  try {
    const id = /[?&]v=([^&]+)/.exec(url)?.[1] ?? url.split("/").pop();
    if (!id) return null;
    const parts = await YoutubeTranscript.fetchTranscript(id);
    const text = parts.map((p) => p.text).join(" ").replace(/\s+/g, " ").trim();
    return text.length > 40 ? text.slice(0, 12_000) : null;
  } catch {
    return null;
  }
}
