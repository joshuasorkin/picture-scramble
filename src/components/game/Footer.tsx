"use client";

import ScoreDisplay from "./ScoreDisplay";
import SkipButton from "./SkipButton";

interface FooterProps {
  score: number;
  onContactClick: () => void;
  onSkipClick: () => void;
  showSkip: boolean;
}

export default function Footer({
  score,
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
      <ScoreDisplay score={score} />
      <SkipButton onClick={onSkipClick} visible={showSkip} />
    </div>
  );
}
