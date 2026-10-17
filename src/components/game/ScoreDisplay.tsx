"use client";

import type { ReactNode } from "react";

interface ScoreDisplayProps {
  score: number;
  children?: ReactNode;
}

export default function ScoreDisplay({ score, children }: ScoreDisplayProps) {
  return (
    <div id="score-container">
      <p>
        Score: <span id="score">{score}</span>
      </p>
      {children}
    </div>
  );
}
