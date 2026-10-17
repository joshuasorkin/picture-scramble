import { describe, it, expect } from "vitest";
import {
  startClock,
  pauseClock,
  resumeClock,
  clockMs,
  clockSeconds,
} from "@/lib/game/clock";

describe("clock", () => {
  it("counts from the start while running", () => {
    const clock = startClock(1_000);
    expect(clockMs(clock, 6_500)).toBe(5_500);
    expect(clockSeconds(clock, 6_500)).toBe(5);
  });

  it("does not count time while paused", () => {
    let clock = startClock(0);
    clock = pauseClock(clock, 10_000);
    expect(clockMs(clock, 500_000)).toBe(10_000);
    clock = resumeClock(clock, 500_000);
    expect(clockSeconds(clock, 503_000)).toBe(13);
  });

  it("can start paused", () => {
    let clock = startClock(0, true);
    expect(clockMs(clock, 60_000)).toBe(0);
    clock = resumeClock(clock, 60_000);
    expect(clockMs(clock, 62_000)).toBe(2_000);
  });

  it("ignores a repeated pause or resume", () => {
    let clock = startClock(0);
    clock = pauseClock(clock, 4_000);
    clock = pauseClock(clock, 9_000);
    expect(clockMs(clock, 9_000)).toBe(4_000);
    clock = resumeClock(clock, 10_000);
    clock = resumeClock(clock, 20_000);
    expect(clockMs(clock, 20_000)).toBe(14_000);
  });

  it("reads 0 before a game starts", () => {
    expect(clockSeconds(null, 123_456)).toBe(0);
  });
});
