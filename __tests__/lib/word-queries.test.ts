import { describe, it, expect } from "vitest";
import "@/../__tests__/helpers/setup";
import { Word } from "@/lib/db/models/word";
import { Game } from "@/lib/db/models/game";
import { TopicWord } from "@/lib/db/models/topic-word";
import {
  claimTopicWord,
  getRandomWordByLanguage,
  recentTopicWords,
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

describe("recentTopicWords", () => {
  const claimed = (word: string, overrides: Record<string, unknown> = {}) =>
    TopicWord.create({ topic: "agents", language: "English", word, ...overrides });

  it("returns words claimed for the topic and language, newest first", async () => {
    const now = Date.now();
    await claimed("routing", { createdAt: new Date(now - 2000) });
    await claimed("guardrail", { createdAt: new Date(now - 1000) });

    expect(await recentTopicWords("agents", "English")).toEqual(["guardrail", "routing"]);
  });

  it("ignores other topics, other languages and claims over 24 hours old", async () => {
    await claimed("planner", { topic: "robots" });
    await claimed("planeador", { language: "Spanish" });
    await claimed("toolbox", { createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000) });

    expect(await recentTopicWords("agents", "English")).toEqual([]);
  });
});

describe("claimTopicWord", () => {
  it("claims a word once per topic and language", async () => {
    expect(await claimTopicWord("agents", "English", "routing")).toBe(true);
    expect(await claimTopicWord("agents", "English", "routing")).toBe(false);
    expect(await claimTopicWord("agents", "Spanish", "routing")).toBe(true);
    expect(await claimTopicWord("robots", "English", "routing")).toBe(true);
    expect(await recentTopicWords("agents", "English")).toEqual(["routing"]);
  });

  it("lets only one of several simultaneous claims win", async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () => claimTopicWord("agents", "English", "routing"))
    );

    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
