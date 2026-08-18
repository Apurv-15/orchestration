import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orchnex AI Suite",
  description: "Multi-LLM Orchestration & RAG Quality Control System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-950 text-slate-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
