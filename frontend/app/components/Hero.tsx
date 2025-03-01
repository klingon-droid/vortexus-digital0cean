import React from "react";
import { FlipWords } from "./ui/Spotlight";

export function FlipWordsDemo() {
  const words = ["Futuristic", "easy", "Agentic"];

  return (
    <div className="h-[40rem] flex justify-center items-center px-4">
      <div className="text-4xl mx-auto font-normal text-neutral-600 dark:text-violet-400">
        Solana is
        <FlipWords words={words} /> <br />
        <div className="text-white">
          with <span className="font-bold text-violet-500 dark:text-violet-500">Vortexus</span>
        </div>
      </div>
    </div>
  );
}
