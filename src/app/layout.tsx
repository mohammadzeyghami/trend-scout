import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const vazir = Vazirmatn({ subsets: ["arabic", "latin"], variable: "--font-vazir" });

export const metadata: Metadata = {
  title: "Trend Scout",
  description: "ایده‌یاب و سناریونویس ریلز برای تولیدکننده‌های محتوا",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={`${vazir.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <header className="border-b border-zinc-200 bg-white">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 text-sm">
            <Link href="/" className="font-bold text-base">
              Trend Scout
            </Link>
            <Link href="/" className="text-zinc-600 hover:text-zinc-900">پروژه‌ها</Link>
            <Link href="/settings" className="text-zinc-600 hover:text-zinc-900">تنظیمات ایجنت‌ها</Link>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
