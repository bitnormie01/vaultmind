"use client";

/**
 * WagmiProvider + QueryClientProvider wrapper
 *
 * Must be a Client Component — wagmi relies on React context and browser APIs.
 * Wraps the entire app so every child component can access wagmi hooks.
 *
 * Uses wagmi v2 / viem v2 patterns:
 *   - WagmiProvider replaces the deprecated WagmiConfig
 *   - QueryClientProvider (TanStack Query) is now a required peer
 */

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/wagmi";

// Single QueryClient instance for the lifetime of the app
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: 12s (≈1 X Layer block) — matches our agent poll interval
      staleTime: 12_000,
      // Retry failed queries once before surfacing error
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
