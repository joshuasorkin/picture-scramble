import { describe, it, expect, vi, beforeEach } from "vitest";
import { FALLBACK_COMPLIMENT, generateCompliment } from "@/lib/openai/generate-compliment";

const create = vi.fn();

// Mock the OpenAI client
vi.mock("@/lib/openai/client", () => ({
  CHAT_MODEL: "test-model",
  getOpenAIClient: () => ({ chat: { completions: { create } } }),
}));

describe("generateCompliment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GENERATE_COMPLIMENT", "In language, compliment someone who is 'word'.");
  });

  it("returns the generated compliment", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: " Eres pura luz. " } }] });

    expect(await generateCompliment("mariposa", "Spanish")).toBe("Eres pura luz.");
    const request = create.mock.calls[0]![0];
    expect(request.reasoning_effort).toBe("none");
    expect(request.messages[0].content).toBe(
      "In Spanish, compliment someone who is mariposa. Do not include an English translation."
    );
  });

  it("falls back instead of failing the game when OpenAI errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    create.mockRejectedValue(new Error("model does not exist"));

    expect(await generateCompliment("umbrella", "English")).toBe(FALLBACK_COMPLIMENT);
  });

  it("falls back when the response is empty", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: "" } }] });

    expect(await generateCompliment("umbrella", "English")).toBe(FALLBACK_COMPLIMENT);
  });
});
