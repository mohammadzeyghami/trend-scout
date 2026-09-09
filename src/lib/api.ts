import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type Params<K extends string> = { params: Promise<Record<K, string>> };

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

/** Wraps a handler: zod errors → 422, "not found" → 404, everything else → 500 with the message. */
export const handle = <T extends unknown[]>(fn: (...a: T) => Promise<Response>) =>
  async (...a: T): Promise<Response> => {
    try {
      return await fn(...a);
    } catch (e) {
      if (e instanceof ZodError) return json({ error: "validation", issues: e.issues }, 422);
      const msg = e instanceof Error ? e.message : String(e);
      const status = /not found|No .* found|Record to (update|delete) does not exist/i.test(msg) ? 404 : 500;
      return json({ error: msg }, status);
    }
  };

export const readJson = async (req: Request) => (await req.json().catch(() => ({}))) as Record<string, unknown>;
