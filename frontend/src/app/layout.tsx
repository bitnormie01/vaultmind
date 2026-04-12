import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VaultMind — Autonomous Flash-Hedging & Liquidity Guardian",
  description:
    "Protect your DeFi positions on X Layer. VaultMind autonomously prevents Aave liquidations and rebalances Uniswap V3 LP positions using flash loans.",
  keywords: [
    "DeFi", "Aave", "Uniswap V3", "X Layer", "OKX", "Flash Loans",
    "Liquidity", "AI Agent", "Autonomous", "VaultMind",
  ],
  openGraph: {
    title: "VaultMind — Autonomous Flash-Hedging & Liquidity Guardian",
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
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

