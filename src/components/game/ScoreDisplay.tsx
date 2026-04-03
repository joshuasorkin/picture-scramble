"use client";

interface ScoreDisplayProps {
  score: number;
}

export default function ScoreDisplay({ score }: ScoreDisplayProps) {
  return (
    <div id="score-container">
      <p>
        Score: <span id="score">{score}</span>
      </p>
    </div>
  );
}
