import { describe, it, expect, vi, beforeEach } from "vitest";
import { chance, generateWord, getRandomWord, pickWord } from "@/lib/openai/generate-word";

const create = vi.fn();

// Mock the OpenAI client
vi.mock("@/lib/openai/client", () => ({
  CHAT_MODEL: "test-model",
  getOpenAIClient: () => ({ chat: { completions: { create } } }),
}));

const reply = (content: string) => ({ choices: [{ message: { content } }] });

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

describe("pickWord", () => {
  it("picks from a comma-separated list using the random source", () => {
    expect(pickWord("apple, chair, river", 9, () => 0)).toBe("apple");
    expect(pickWord("apple, chair, river", 9, () => 0.99)).toBe("river");
  });

  it("lowercases and strips quotes and trailing punctuation", () => {
    expect(pickWord('"Celesta."', 9)).toBe("celesta");
  });

  it("keeps only single words of 4 to maxLength letters", () => {
    const response = "key, f-holes, sound post, organology, timbre, ore";
    for (let i = 0; i < 20; i++) {
      expect(pickWord(response, 9, () => i / 20)).toBe("timbre");
    }
  });

  it("counts letters, not bytes, for non-Latin scripts", () => {
    expect(pickWord("подсолнух", 9)).toBe("подсолнух");
    expect(pickWord("ностальгия", 9)).toBeNull();
  });

  it("returns null when nothing fits", () => {
    expect(pickWord("", 9)).toBeNull();
    expect(pickWord("a, bb, ccc", 9)).toBeNull();
  });
});

describe("generateWord", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("WORD_LENGTH_MAX", "9");
    vi.stubEnv("GENERATE_WORD_PROMPT_TOPIC", "A language word about topic.");
  });

  it("asks for a list without reasoning and returns one word from it", async () => {
    create.mockResolvedValue(reply("aerophone, fipple, diapason"));

    const word = await generateWord("music", 0, "Spanish");

    expect(["aerophone", "fipple", "diapason"]).toContain(word);
    const request = create.mock.calls[0]![0];
    expect(request.model).toBe("test-model");
    expect(request.reasoning_effort).toBe("none");
    expect(request.messages[0].content).toMatch(/^A Spanish word about music\. .*20 different/);
  });

  it("throws when the response has no usable word", async () => {
    create.mockResolvedValue(reply("hi, extraordinarily"));

    await expect(generateWord("music", 0, "English")).rejects.toThrow(/No usable word/);
  });
});
