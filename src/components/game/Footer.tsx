"use client";

import HelpButton from "./HelpButton";
import ScoreDisplay from "./ScoreDisplay";
import SkipButton from "./SkipButton";
import Timer from "./Timer";
import type { Clock } from "@/lib/game/clock";

interface FooterProps {
  score: number;
  clock: Clock | null;
  solveSeconds: number | null;
  onHelpClick: () => void;
  onSkipClick: () => void;
  showSkip: boolean;
}

export default function Footer({
  score,
  clock,
  solveSeconds,
  onHelpClick,
  onSkipClick,
  showSkip,
}: FooterProps) {
  return (
    <div id="footer">
      <HelpButton onClick={onHelpClick} />
      <ScoreDisplay score={score}>
        <Timer clock={clock} solveSeconds={solveSeconds} />
      </ScoreDisplay>
      <SkipButton onClick={onSkipClick} visible={showSkip} />
    </div>
  );
}
