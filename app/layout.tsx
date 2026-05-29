import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display", weight: ["400", "600"] });
const body = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "In The Mood",
  description: "Anonymous, consent-first, proximity introductions for adults.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <main className="mx-auto min-h-screen max-w-md px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
