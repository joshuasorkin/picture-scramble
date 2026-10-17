"use client";

import { useEffect, useState } from "react";
import { formatTimer } from "@/lib/game/share";
import { clockSeconds, type Clock } from "@/lib/game/clock";

interface TimerProps {
  // Clock for the current game; null while loading
  clock: Clock | null;
  // Final time once solved; stops the clock
  solveSeconds: number | null;
}

export default function Timer({ clock, solveSeconds }: TimerProps) {
  const [now, setNow] = useState(() => Date.now());
  const running = clock?.resumedAt != null && solveSeconds === null;

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [running, clock]);

  // now can trail a just-started or just-resumed clock until the next tick;
  // clockMs treats that as no time passed
  const seconds = solveSeconds ?? clockSeconds(clock, now);

  return (
    <p id="timer-line">
      Time: <span id="timer">{formatTimer(seconds)}</span>
    </p>
  );
}
