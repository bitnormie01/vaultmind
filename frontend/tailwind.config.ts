/**
 * tailwind.config.ts — Tailwind v4
 *
 * In Tailwind v4, all design tokens are defined in globals.css using @theme.
 * This config file only controls content scanning (which files to scan for class names).
 *
 * Custom tokens (colors, animations, backgrounds) are in:
 *   src/app/globals.css → @theme { ... }
 */
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/hooks/**/*.{js,ts,jsx,tsx}",
    "./src/lib/**/*.{js,ts,jsx,tsx}",
  ],
};

export default config;
