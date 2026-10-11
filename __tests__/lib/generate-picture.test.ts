import { describe, it, expect, vi, beforeEach } from "vitest";
import { generatePicture } from "@/lib/openai/generate-picture";

const generate = vi.fn();

// Mock the OpenAI client
vi.mock("@/lib/openai/client", () => ({
  getOpenAIClient: () => ({ images: { generate } }),
}));

describe("generatePicture", () => {
  const deps = {
    findExistingPicture: vi.fn(),
    storeImage: vi.fn().mockResolvedValue(true),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    generate.mockResolvedValue({ data: [{ url: "http://dalle.test/new.png" }] });
  });

  it("generates and stores a picture for a new word", async () => {
    deps.findExistingPicture.mockResolvedValue(null);

    const result = await generatePicture("apple", "English", deps);

    expect(result).toEqual({ picture: "http://dalle.test/new.png", contact: null });
    expect(deps.storeImage).toHaveBeenCalledWith("apple", "http://dalle.test/new.png", "English");
  });

  it("returns the existing picture and generates an extra one while there is room", async () => {
    const contact = { name: "Artist" };
    deps.findExistingPicture.mockResolvedValue({
      picture: "https://img.test/img/abc.webp",
      contact,
      full: false,
    });

    const result = await generatePicture("apple", "English", deps);

    expect(result).toEqual({ picture: "https://img.test/img/abc.webp", contact });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("does not generate an extra picture once the word is full", async () => {
    deps.findExistingPicture.mockResolvedValue({
      picture: "https://img.test/img/abc.webp",
      contact: null,
      full: true,
    });

    const result = await generatePicture("apple", "English", deps);

    expect(result.picture).toBe("https://img.test/img/abc.webp");
    expect(generate).not.toHaveBeenCalled();
    expect(deps.storeImage).not.toHaveBeenCalled();
  });
});
