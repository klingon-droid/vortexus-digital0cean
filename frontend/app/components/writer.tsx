"use client";

import { TypewriterEffectSmooth } from "./ui/typewriter-effect";
import Link from "next/link";

export function TypewriterEffectSmoothDemo() {
  const words = [
    {
      text: "Prompt",
    },
    {
      text: "at",
    },
    {
      text: "the speed of",
    },
    {
      image: "/solana.png",
    },
    {
      text: "with",
    },
    {
      text: "Vortexus",
      className: "text-violet-500 dark:text-violet-500",
    },
  ];
  return (
    <div className="flex flex-col items-center justify-center h-[40rem]">
      <TypewriterEffectSmooth words={words} />
      <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 space-x-0 md:space-x-4">
        <Link href="/Chat">
          <button className="w-40 h-10 rounded-xl bg-violet-500 border border-transparent text-white text-sm">
            Vortexus Web
          </button>
        </Link>
        <Link href="https://t.me/vvvortexus_bot">
          <button className="w-40 h-10 rounded-xl bg-violet-500 text-white border-transparent text-sm">
            Vortexus Telegram
          </button>
        </Link>
      </div>
    </div>
  );
}
