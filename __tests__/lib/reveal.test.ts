import { describe, it, expect } from "vitest";
import { createRevealOrder, revealTarget } from "@/lib/game/reveal";

// Small deterministic generator so failures are reproducible
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function drain(width: number, height: number, start: number, seed = 1): number[] {
  const order = createRevealOrder(width, height, start, seeded(seed));
  const out: number[] = [];
  for (let p = order.next(); p !== -1; p = order.next()) out.push(p);
  return out;
}

describe("createRevealOrder", () => {
  it("starts at the given pixel", () => {
    expect(drain(10, 8, 37)[0]).toBe(37);
  });

  it("gives every pixel exactly once", () => {
    const order = drain(37, 23, 400, 7);
    expect(order).toHaveLength(37 * 23);
    expect(new Set(order).size).toBe(37 * 23);
  });

  it("only reveals pixels touching one already revealed (incl. diagonals)", () => {
    const width = 20;
    const height = 15;
    const order = drain(width, height, 0, 3);
    const revealed = new Set<number>([order[0]!]);
    for (const p of order.slice(1)) {
      const x = p % width;
      const y = Math.floor(p / width);
      let touches = false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if ((dx || dy) && nx >= 0 && ny >= 0 && nx < width && ny < height) {
            touches ||= revealed.has(ny * width + nx);
          }
        }
      }
      expect(touches).toBe(true);
      revealed.add(p);
    }
  });

  it("keeps returning -1 when done", () => {
    const order = createRevealOrder(1, 1, 0, seeded(1));
    expect(order.next()).toBe(0);
    expect(order.next()).toBe(-1);
    expect(order.next()).toBe(-1);
  });

  it("handles an empty picture", () => {
    expect(createRevealOrder(0, 0, 0, seeded(1)).next()).toBe(-1);
  });

  it("covers a full-size picture", () => {
    const order = drain(1024, 1024, 524800);
    expect(order).toHaveLength(1024 * 1024);
  });
});

describe("revealTarget", () => {
  it("grows in proportion to elapsed time", () => {
    expect(revealTarget(1000, 0, 2000)).toBe(0);
    expect(revealTarget(1000, 500, 2000)).toBe(250);
    expect(revealTarget(1000, 1999, 2000)).toBe(999);
  });

  it("is complete at or after the duration", () => {
    expect(revealTarget(1000, 2000, 2000)).toBe(1000);
    expect(revealTarget(1000, 5000, 2000)).toBe(1000);
  });

  it("is complete at once with no duration", () => {
    expect(revealTarget(1000, 0, 0)).toBe(1000);
  });

  it("never goes negative", () => {
    expect(revealTarget(1000, -10, 2000)).toBe(0);
  });
});
