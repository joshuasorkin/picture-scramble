"use client";

import ScoreDisplay from "./ScoreDisplay";
import SkipButton from "./SkipButton";
import Timer from "./Timer";

interface FooterProps {
  score: number;
  startedAt: number | null;
  solveSeconds: number | null;
  onContactClick: () => void;
  onSkipClick: () => void;
  showSkip: boolean;
}

export default function Footer({
  score,
  startedAt,
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
        <Timer startedAt={startedAt} solveSeconds={solveSeconds} />
      </ScoreDisplay>
      <SkipButton onClick={onSkipClick} visible={showSkip} />
    </div>
  );
}
