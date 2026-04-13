import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VaultMind — Autonomous DeFi Position Guardian",
  description:
    "Protect your DeFi positions on X Layer. VaultMind autonomously prevents Aave liquidations and rebalances Uniswap V3 LP positions using flash loans.",
  keywords: [
    "DeFi", "Aave", "Uniswap V3", "X Layer", "OKX", "Flash Loans",
    "Liquidity", "AI Agent", "Autonomous", "VaultMind",
  ],
  openGraph: {
    title: "VaultMind — Autonomous DeFi Position Guardian",
    description: "AI-powered DeFi protection on X Layer",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
