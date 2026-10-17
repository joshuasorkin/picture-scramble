// A puzzle clock that counts only while the page is visible, so time spent
// in another tab (or with the tab closed) is not counted as solving time.
export interface Clock {
  // Time counted before the current run
  activeMs: number;
  // When the current run began (ms epoch); null while paused
  resumedAt: number | null;
}

export function startClock(now: number, paused = false): Clock {
  return { activeMs: 0, resumedAt: paused ? null : now };
}

export function pauseClock(clock: Clock, now: number): Clock {
  if (clock.resumedAt === null) return clock;
  return { activeMs: clockMs(clock, now), resumedAt: null };
}

export function resumeClock(clock: Clock, now: number): Clock {
  if (clock.resumedAt !== null) return clock;
  return { ...clock, resumedAt: now };
}

export function clockMs(clock: Clock, now: number): number {
  const run = clock.resumedAt === null ? 0 : Math.max(0, now - clock.resumedAt);
  return clock.activeMs + run;
}

// Whole seconds, rounded down to match what the on-screen timer shows
export function clockSeconds(clock: Clock | null, now: number): number {
  return clock === null ? 0 : Math.floor(clockMs(clock, now) / 1000);
}
