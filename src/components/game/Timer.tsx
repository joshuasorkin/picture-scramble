"use client";

import { useEffect, useState } from "react";
import { formatTimer } from "@/lib/game/share";

interface TimerProps {
  // When the current game was shown (ms epoch); null while loading
  startedAt: number | null;
  // Final time once solved; stops the clock
  solveSeconds: number | null;
}

export default function Timer({ startedAt, solveSeconds }: TimerProps) {
  const [now, setNow] = useState(() => Date.now());
  const running = startedAt !== null && solveSeconds === null;

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [running, startedAt]);

  let seconds = 0;
  if (solveSeconds !== null) {
    seconds = solveSeconds;
  } else if (startedAt !== null) {
    // now can trail a just-started game until the next tick
    seconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  }

  return (
    <p id="timer-line">
      Time: <span id="timer">{formatTimer(seconds)}</span>
    </p>
  );
}
