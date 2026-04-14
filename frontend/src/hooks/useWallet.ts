

/**
 * useWallet — wagmi v2 wallet connection hook
 *
 * Replaces the old ethers.js useWallet.ts with native wagmi v2 hooks:
 *   - useAccount     → address, chainId, isConnected, status
 *   - useConnect     → connect(connector), connectors
 *   - useDisconnect  → disconnect()
 *   - useChainId     → current chain ID
 *
 * No manual event listeners needed — wagmi handles wallet events internally.
 * No ethers.js BrowserProvider — viem transport handles all RPC.
 */

import { useAccount, useConnect, useDisconnect, useChainId } from "wagmi";
import { useState } from "react";
import { injected } from "wagmi/connectors";
import { xLayer } from "@/lib/wagmi";

export interface WalletState {
  address: `0x${string}` | undefined;
  chainId: number | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  isCorrectChain: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  shortAddress: string;
}

export function useWallet(): WalletState {
  const { address, isConnected, status } = useAccount();
  const chainId = useChainId();
  const { connect, isPending, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const [localError, setLocalError] = useState<string | null>(null);

  const isConnecting = isPending || status === "connecting" || status === "reconnecting";
  const isCorrectChain = chainId === xLayer.id; // 196

  const handleConnect = () => {
    setLocalError(null);
    try {
      // Provide an explicit target so wagmi hooks straight into window.okxwallet
      // This bypasses any confusion with window.ethereum or MetaMask taking priority.
      connect({ 
        connector: injected({ 
          target() {
            return {
              id: 'okxWallet',
              name: 'OKX Wallet',
              provider: typeof window !== 'undefined' ? (window as any).okxwallet : undefined
            }
          }
        }) 
      });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Connection failed");
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setLocalError(null);
  };

  const shortAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : "";

  const error = localError ?? (connectError?.message ?? null);

  return {
    address,
    chainId,
    isConnected,
    isConnecting,
    isCorrectChain,
    error,
    connect: handleConnect,
    disconnect: handleDisconnect,
    shortAddress,
  };
}
