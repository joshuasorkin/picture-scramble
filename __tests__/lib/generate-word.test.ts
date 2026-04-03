import { describe, it, expect, vi, beforeEach } from "vitest";
import { chance, getRandomWord } from "@/lib/openai/generate-word";

describe("chance", () => {
  beforeEach(() => {
    vi.stubEnv("EASY_GAMES_COUNT", "3");
  });

  it("returns true when score is below EASY_GAMES_COUNT", () => {
    expect(chance(0)).toBe(true);
    expect(chance(1)).toBe(true);
    expect(chance(2)).toBe(true);
  });

  it("returns a boolean for scores at or above EASY_GAMES_COUNT", () => {
    // Can't predict random, just verify it returns boolean
    const result = chance(10);
    expect(typeof result).toBe("boolean");
  });
});

describe("getRandomWord", () => {
  it("returns a word from the provided list", () => {
    const list = ["apple", "banana", "cherry"];
    const result = getRandomWord(list);
    expect(list).toContain(result);
  });

  it("returns the only word from a single-item list", () => {
    expect(getRandomWord(["solo"])).toBe("solo");
  });
});
