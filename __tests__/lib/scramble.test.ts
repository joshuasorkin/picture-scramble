import { describe, it, expect } from "vitest";
import { scrambleWord, scramblePhrase } from "@/lib/game/scramble";

describe("scrambleWord", () => {
  it("returns a string of the same length", () => {
    const word = "hello";
    const result = scrambleWord(word);
    expect(result).toHaveLength(word.length);
  });

  it("contains the same characters", () => {
    const word = "scramble";
    const result = scrambleWord(word);
    expect(result.split("").sort().join("")).toBe(
      word.split("").sort().join("")
    );
  });

  it("handles single character", () => {
    expect(scrambleWord("a")).toBe("a");
  });

  it("handles empty string", () => {
    expect(scrambleWord("")).toBe("");
  });
});

describe("scramblePhrase", () => {
  it("preserves spaces between words", () => {
    const phrase = "hello world";
    const result = scramblePhrase(phrase);
    const words = result.split(" ");
    expect(words).toHaveLength(2);
  });

  it("each word has the same characters as the original", () => {
    const phrase = "foo bar";
    const result = scramblePhrase(phrase);
    const originalWords = phrase.split(" ");
    const scrambledWords = result.split(" ");

    for (let i = 0; i < originalWords.length; i++) {
      expect(scrambledWords[i]!.split("").sort().join("")).toBe(
        originalWords[i]!.split("").sort().join("")
      );
    }
  });
});
