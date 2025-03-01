"use client";

import React, { ReactNode, useMemo, useCallback } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  TorusWalletAdapter,
  BackpackWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { WalletError } from '@solana/wallet-adapter-base';

// Import required styles for wallet modal
require("@solana/wallet-adapter-react-ui/styles.css");

interface Props {
  children: ReactNode;
}

export function CustomWalletProvider({ children }: Props) {
  // Get the endpoint from environment variable if available, otherwise use clusterApiUrl
  const endpoint = useMemo(() => {
    // Try to use environment variable first
    const envEndpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (envEndpoint) return envEndpoint;
    
    // Fall back to clusterApiUrl
    return clusterApiUrl("mainnet-beta");
  }, []);

  // Configure available wallets
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new BackpackWalletAdapter(),
      new TorusWalletAdapter(),
    ],
    []
  );

  // Error handling callback
  const onError = useCallback(
    (error: WalletError) => {
      console.error('Wallet error:', error);
      // You could display a toast notification here
    },
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider 
        wallets={wallets} 
        autoConnect={false} 
        onError={onError}
      >
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
