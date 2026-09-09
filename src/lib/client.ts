"use client";

/** fetch wrapper for the dashboard: JSON in/out, throws the API's error message. */
export async function api<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  return data as T;
}

export const fmtNum = (n: number | null | undefined) => (n == null ? "—" : new Intl.NumberFormat("fa-IR").format(Math.round(n)));
export const fmtDate = (d: string | Date | null | undefined) => (d ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date(d)) : "—");
export const fmtDateTime = (d: string | Date | null | undefined) => (d ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(d)) : "—");
export const toDateInput = (d: string | Date) => new Date(d).toISOString().slice(0, 10);
export const fromDateInput = (s: string, endOfDay = false) => new Date(`${s}T${endOfDay ? "23:59:59" : "00:00:00"}.000Z`).toISOString();

export const PLATFORM_FA: Record<string, string> = { youtube: "یوتیوب", instagram: "اینستاگرام", tiktok: "تیک‌تاک" };
export const PLATFORM_COLOR: Record<string, string> = { youtube: "bg-red-100 text-red-800", instagram: "bg-pink-100 text-pink-800", tiktok: "bg-zinc-800 text-white" };

export const STATUS_FA: Record<string, string> = {
  idle: "آماده", running: "در حال اجرا", waiting_selection: "منتظر انتخاب", finished: "تمام‌شده", failed: "شکست‌خورده", cancelled: "لغوشده (اجرای جدیدتر)",
  pending: "در انتظار", done: "انجام‌شده", waiting: "منتظر", draft: "پیش‌نویس", final: "نهایی",
};
export const STATUS_COLOR: Record<string, string> = {
  idle: "bg-zinc-100 text-zinc-700", running: "bg-blue-100 text-blue-800", waiting_selection: "bg-amber-100 text-amber-800",
  finished: "bg-green-100 text-green-800", failed: "bg-red-100 text-red-800", cancelled: "bg-zinc-200 text-zinc-500", pending: "bg-zinc-100 text-zinc-500",
  done: "bg-green-100 text-green-800", waiting: "bg-amber-100 text-amber-800", draft: "bg-zinc-100 text-zinc-700", final: "bg-green-100 text-green-800",
};
