"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { CustomWalletProvider } from "../components/ui/WalletProvider";
import { ChatInterface } from "../components/ChatInterface";
import { ConnectWallet } from "../components/ConnectWallet";
import { useState } from "react";
import { LandingPage } from "../components/ChatHero";

export default function ChatApp() {
  const { publicKey } = useWallet();
  const [started, setStarted] = useState(false);
  const [initialMessage, setInitialMessage] = useState("");

  const handleStart = (message: string) => {
    setInitialMessage(message);
    setStarted(true);
  };

  return (
    <CustomWalletProvider>
      <div className="min-h-screen bg-gradient-to-br from-chat-bg via-indigo/20 to-chat-bg animate-gradient">
        {!publicKey ? (
          <ConnectWallet />
        ) : !started ? (
          <LandingPage onStart={handleStart} />
        ) : (
          <ChatInterface />
        )}
      </div>
    </CustomWalletProvider>
  );
}
