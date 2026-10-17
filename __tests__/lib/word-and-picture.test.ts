import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateWordAndPictureUntilSuccess,
  MAX_ATTEMPTS,
  MAX_FAILURES,
} from "@/lib/openai/word-and-picture";
import { generatePicture } from "@/lib/openai/generate-picture";
import { generateWord } from "@/lib/openai/generate-word";

// Mock the OpenAI modules
vi.mock("@/lib/openai/generate-word", () => ({
  generateWord: vi.fn().mockResolvedValue("apple"),
  getRandomWord: vi.fn().mockReturnValue("grape"),
  chance: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/openai/generate-picture", () => ({
  generatePicture: vi.fn().mockResolvedValue({
    picture: "http://example.com/pic.png",
    contact: null,
  }),
}));

describe("generateWordAndPictureUntilSuccess", () => {
  const mockDeps = {
    getRandomWordByLanguage: vi.fn(),
    wordGeneratedToday: vi.fn(),
    recentTopicWords: vi.fn(),
    claimTopicWord: vi.fn(),
    findExistingPicture: vi.fn(),
    storeImage: vi.fn(),
    saveArtStyle: vi.fn(),
    getRandomSavedArtStyle: vi.fn(),
  };

  beforeEach(() => {
    vi.stubEnv("WORD_LENGTH_MAX", "9");
    vi.clearAllMocks();
    vi.mocked(generatePicture).mockResolvedValue({
      picture: "http://example.com/pic.png",
      contact: null,
    });
  });

  it("uses existing word from language when available", async () => {
    mockDeps.getRandomWordByLanguage.mockResolvedValue("hello");
    mockDeps.wordGeneratedToday.mockResolvedValue(false);

    const result = await generateWordAndPictureUntilSuccess(
      null, 0, "English", mockDeps
    );

    expect(result.word).toBe("hello");
    expect(result.picture).toBe("http://example.com/pic.png");
    expect(result.contact).toBeNull();
    expect(mockDeps.getRandomWordByLanguage).toHaveBeenCalledWith("English");
  });

  it("passes the saved style option through to picture generation", async () => {
    mockDeps.getRandomWordByLanguage.mockResolvedValue("hello");
    mockDeps.wordGeneratedToday.mockResolvedValue(false);

    await generateWordAndPictureUntilSuccess(null, 0, "English", mockDeps, { savedStyle: true });

    expect(generatePicture).toHaveBeenCalledWith("hello", "English", mockDeps, { savedStyle: true });
  });

  it("retries when word was shown today", async () => {
    // First call: word shown today; second call: different word not shown
    mockDeps.getRandomWordByLanguage
      .mockResolvedValueOnce("hello")
      .mockResolvedValueOnce("world");
    mockDeps.wordGeneratedToday
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const result = await generateWordAndPictureUntilSuccess(
      null, 0, "English", mockDeps
    );

    expect(result.word).toBe("world");
    expect(mockDeps.wordGeneratedToday).toHaveBeenCalledTimes(2);
  });

  it("falls back to random word after too many attempts", async () => {
    mockDeps.getRandomWordByLanguage.mockResolvedValue("repeat");
    mockDeps.wordGeneratedToday.mockResolvedValue(true);

    // After 4 failed attempts with alreadyShownToday, it falls back to getRandomWord
    // getRandomWord returns "grape" per mock, which won't trigger wordGeneratedToday
    const result = await generateWordAndPictureUntilSuccess(
      null, 0, "English", mockDeps
    );

    expect(result.word).toBe("grape");
  });

  it("asks for a topic word that avoids words recently played on the topic", async () => {
    mockDeps.recentTopicWords.mockResolvedValue(["routing", "guardrail"]);

    const result = await generateWordAndPictureUntilSuccess(
      "agentic engineering", 0, "English", mockDeps
    );

    expect(result.word).toBe("apple");
    expect(mockDeps.recentTopicWords).toHaveBeenCalledWith("agentic engineering", "English");
    expect(generateWord).toHaveBeenCalledWith(
      "agentic engineering", 0, "English", ["routing", "guardrail"], expect.any(Function)
    );
  });

  it("claims the topic word through the deps", async () => {
    mockDeps.recentTopicWords.mockResolvedValue([]);
    mockDeps.claimTopicWord.mockResolvedValue(true);

    await generateWordAndPictureUntilSuccess("agents", 0, "English", mockDeps);

    const claim = vi.mocked(generateWord).mock.calls[0]![4]!;
    expect(await claim("routing")).toBe(true);
    expect(mockDeps.claimTopicWord).toHaveBeenCalledWith("agents", "English", "routing");
  });

  it("looks up recent topic words only once across retries", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockDeps.recentTopicWords.mockResolvedValue([]);
    vi.mocked(generatePicture)
      .mockRejectedValueOnce(new Error("flaky"))
      .mockResolvedValueOnce({ picture: "http://example.com/pic.png", contact: null });

    await generateWordAndPictureUntilSuccess("animals", 0, "English", mockDeps);

    expect(generateWord).toHaveBeenCalledTimes(2);
    expect(mockDeps.recentTopicWords).toHaveBeenCalledTimes(1);
  });

  it("gives up after repeated picture failures instead of retrying forever", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(generatePicture).mockRejectedValue(new Error("model does not exist"));

    await expect(
      generateWordAndPictureUntilSuccess("animals", 0, "English", mockDeps)
    ).rejects.toThrow(/Gave up/);
    expect(generatePicture).toHaveBeenCalledTimes(MAX_FAILURES);
  });

  it("gives up after too many routine retries", async () => {
    mockDeps.getRandomWordByLanguage.mockResolvedValue("extraordinarily");
    mockDeps.wordGeneratedToday.mockResolvedValue(false);

    await expect(
      generateWordAndPictureUntilSuccess(null, 0, "English", mockDeps)
    ).rejects.toThrow(/Gave up/);
    expect(mockDeps.getRandomWordByLanguage).toHaveBeenCalledTimes(MAX_ATTEMPTS);
  });
});
