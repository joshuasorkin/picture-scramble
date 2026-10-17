import { describe, it, expect } from "vitest";
import {
  ERAS,
  formatYear,
  pickPlace,
  randomArtOrigin,
  randomYear,
  type Place,
} from "@/lib/game/art-style";
import places from "@/data/places.json";

// Returns the given values in turn
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe("randomYear", () => {
  it("picks the first era for a low first draw", () => {
    expect(randomYear(sequence(0, 0))).toBe(-5000);
    expect(randomYear(sequence(0, 0.9999))).toBe(-1);
  });

  it("picks the last era for a high first draw", () => {
    expect(randomYear(sequence(0.9999, 0))).toBe(1800);
    expect(randomYear(sequence(0.9999, 0.9999))).toBe(2026);
  });

  it("stays within the eras and never returns year 0", () => {
    const min = ERAS[0]!.from;
    const max = ERAS[ERAS.length - 1]!.to;
    for (let i = 0; i < 2000; i++) {
      const year = randomYear();
      expect(year).toBeGreaterThanOrEqual(min);
      expect(year).toBeLessThanOrEqual(max);
      expect(year).not.toBe(0);
    }
  });
});

describe("formatYear", () => {
  it("formats BCE, early CE and later years", () => {
    expect(formatYear(-3479)).toBe("3479 BCE");
    expect(formatYear(129)).toBe("129 CE");
    expect(formatYear(1887)).toBe("1887");
  });
});

describe("pickPlace", () => {
  const small: Place = [10, 10, 100];
  const large: Place = [20, 20, 10000];

  it("weights places by the square root of population", () => {
    // sqrt weights are 10 and 100, so draws below 10/110 pick the small place
    expect(pickPlace([small, large], () => 0.09)).toBe(small);
    expect(pickPlace([small, large], () => 0.1)).toBe(large);
  });
});

describe("randomArtOrigin", () => {
  it("gives coordinates near the picked place", () => {
    const origin = randomArtOrigin([[28.51, 100.86, 1000]], sequence(0, 1, 0, 0.5, 0.5));

    expect(origin.coordinates).toBe("29.0100, 100.3600");
  });

  it("wraps longitude across the antimeridian", () => {
    const origin = randomArtOrigin([[0, 179.9, 1000]], sequence(0, 0.5, 1, 0.5, 0.5));

    expect(origin.coordinates).toBe("0.0000, -179.6000");
  });

  it("works with the bundled places", () => {
    expect((places as Place[]).length).toBeGreaterThan(1000);
    const origin = randomArtOrigin(places as Place[]);
    expect(origin.coordinates).toMatch(/^-?\d+\.\d{4}, -?\d+\.\d{4}$/);
  });
});
