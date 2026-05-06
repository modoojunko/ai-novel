import type { Metadata } from "next";
import { Noto_Serif_SC, Noto_Sans_SC, JetBrains_Mono } from "next/font/google";
import { ClientShell } from "@/components/ClientShell";
import "./globals.css";

const serifHeading = Noto_Serif_SC({
  variable: "--font-serif-heading",
  subsets: ["chinese-simplified", "latin"],
  weight: ["400", "700"],
});

const sansBody = Noto_Sans_SC({
  variable: "--font-sans",
  subsets: ["chinese-simplified", "latin"],
  weight: ["400", "500"],
});

const monoFont = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NovelForge — AI 辅助长篇小说写作",
  description: "月下青砚，笔墨生花。在深夜的静谧中，与 AI 一起完成你的长篇小说。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${serifHeading.variable} ${sansBody.variable} ${monoFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
