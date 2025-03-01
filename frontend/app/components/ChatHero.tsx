"use client";

import { motion } from "framer-motion";
import { ArrowRight, Copy } from "lucide-react";
import { useState } from "react";
import Image from "next/image";

interface LandingPageProps {
  onStart: (message: string) => void;
}

export function LandingPage({ onStart }: LandingPageProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart(input.trim() || ""); // Allow clicking even if input is empty
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setInput(text);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col items-center justify-center p-4 bg-cover bg-center relative"
      style={{ backgroundImage: "url('/background.jpg')" }}
    >
      {/* Optional Dark Overlay for Text Visibility */}
      <div className="absolute inset-0 bg-black/40"></div>
      <div className="flex flex-col items-center justify-center h-[30rem]">
        <Image src={"/linear.png"} alt="image" width={400} height={400} />
      </div>

      {/* Content Container */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Heading */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-6xl font-bold text-white mb-8 text-center"
        >
          Ask <span className="text-violet-500 dark:text-violet-500">Vortexus</span> Anything
        </motion.h1>

        {/* Form */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-8 text-indigo-200 text-center cursor-pointer"
          onClick={handleSubmit}
        >
          <p className="text-3xl font-semibold text-white hover:text-indigo-300 transition">
            Let's dive in <ArrowRight className="inline w-6 h-6" />
          </p>
        </motion.div>

        {/* Example Prompts */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="bg-white/10 mt-6 p-6 rounded-lg shadow-lg w-full max-w-2xl text-center text-white"
        >
          <p className="text-lg mb-4 font-semibold">Copy any example Prompt:</p>
          <ul className="space-y-4">
            <li
              className="flex items-center space-x-3 cursor-pointer hover:text-indigo-300"
              onClick={() => copyToClipboard("Check my wallet balance")}
            >
              <Copy className="w-5 h-5" />
              <span>Check my wallet balance</span>
            </li>
            <li
              className="flex items-center space-x-3 cursor-pointer hover:text-indigo-300"
              onClick={() => copyToClipboard("Create a token")}
            >
              <Copy className="w-5 h-5" />
              <span>Create a token</span>
            </li>
            <li
              className="flex items-center space-x-3 cursor-pointer hover:text-indigo-300"
              onClick={() => copyToClipboard("Deploy an NFT collection")}
            >
              <Copy className="w-5 h-5" />
              <span>Deploy an NFT collection</span>
            </li>
            <li
              className="flex items-center space-x-3 cursor-pointer hover:text-indigo-300"
              onClick={() => copyToClipboard("Deposit to a Meteora pool")}
            >
              <Copy className="w-5 h-5" />
              <span>Deposit to a Meteora pool</span>
            </li>
          </ul>
        </motion.div>
      </div>
    </motion.div>
  );
}
