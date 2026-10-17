"use client";

import ScoreDisplay from "./ScoreDisplay";
import SkipButton from "./SkipButton";
import Timer from "./Timer";
import type { Clock } from "@/lib/game/clock";

interface FooterProps {
  score: number;
  clock: Clock | null;
  solveSeconds: number | null;
  onContactClick: () => void;
  onSkipClick: () => void;
  showSkip: boolean;
}

export default function Footer({
  score,
  clock,
  solveSeconds,
  onContactClick,
  onSkipClick,
  showSkip,
}: FooterProps) {
  return (
    <div id="footer">
      <div id="linkedImageContainer" onClick={onContactClick}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/contact.png" alt="Contact" />
      </div>
      <ScoreDisplay score={score}>
        <Timer clock={clock} solveSeconds={solveSeconds} />
      </ScoreDisplay>
      <SkipButton onClick={onSkipClick} visible={showSkip} />
    </div>
  );
}
