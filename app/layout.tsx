import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Support ticket triage",
  description: "Classify support tickets and evaluate triage predictions.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="site-nav" aria-label="Main navigation">
          <Link href="/chat">Chat</Link>
          <Link href="/">Triage</Link>
          <Link href="/admin">Admin</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
