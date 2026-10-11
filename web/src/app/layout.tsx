import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phone Finder — Emergency Mode Web Console",
  description: "Locate and secure your lost Android phone using open maps and zero-knowledge recovery authentication.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-slate-950">
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
