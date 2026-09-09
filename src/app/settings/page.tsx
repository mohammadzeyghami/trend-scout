import { Suspense } from "react";
import SettingsView from "./view";

export default function SettingsPage() {
  return <Suspense fallback={<p className="text-sm text-zinc-500">در حال بارگذاری…</p>}><SettingsView /></Suspense>;
}
