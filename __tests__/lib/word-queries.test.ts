import { describe, it, expect } from "vitest";
import "@/../__tests__/helpers/setup";
import { Word } from "@/lib/db/models/word";
import { Game } from "@/lib/db/models/game";
import {
  getRandomWordByLanguage,
  wordGeneratedToday,
} from "@/lib/game/word-queries";

describe("getRandomWordByLanguage", () => {
  it("returns null when no words exist", async () => {
    const result = await getRandomWordByLanguage("English");
    expect(result).toBeNull();
  });

  it("returns a word matching the language", async () => {
    await Word.create({ word: "hello", language: "English" });
    await Word.create({ word: "hola", language: "Spanish" });

    const result = await getRandomWordByLanguage("English");
    expect(result).toBe("hello");
  });

  it("returns null for language with no words", async () => {
    await Word.create({ word: "hello", language: "English" });

    const result = await getRandomWordByLanguage("French");
    expect(result).toBeNull();
  });
});

describe("wordGeneratedToday", () => {
  it("returns false when no games exist", async () => {
    const result = await wordGeneratedToday("hello");
    expect(result).toBe(false);
  });

  it("returns true when word was used recently", async () => {
    await Game.create({
      language: "English",
      solution: "hello",
      solutionHash: "abc",
      scramble: "lehlo",
      picture: "http://example.com/pic.png",
      compliment: "Nice!",
      date_create: new Date(),
    });

    const result = await wordGeneratedToday("hello");
    expect(result).toBe(true);
  });

  it("returns false when word was used over 24 hours ago", async () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await Game.create({
      language: "English",
      solution: "hello",
      solutionHash: "abc",
      scramble: "lehlo",
      picture: "http://example.com/pic.png",
      compliment: "Nice!",
      date_create: twoDaysAgo,
    });

    const result = await wordGeneratedToday("hello");
    expect(result).toBe(false);
  });
});
