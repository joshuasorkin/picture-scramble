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
    storeImage: vi.fn(),
  };
  const imageData = Buffer.from("generated image");

  beforeEach(() => {
    vi.clearAllMocks();
    generate.mockResolvedValue({ data: [{ b64_json: imageData.toString("base64") }] });
    deps.storeImage.mockResolvedValue("https://img.test/img/new.webp");
  });

  it("generates and stores a picture for a new word, returning its stored URL", async () => {
    deps.findExistingPicture.mockResolvedValue(null);

    const result = await generatePicture("apple", "English", deps);

    expect(result).toEqual({ picture: "https://img.test/img/new.webp", contact: null });
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-image-2.5-flare", quality: "medium" })
    );
    expect(deps.storeImage).toHaveBeenCalledWith("apple", null, "English", imageData);
  });

  it("throws when the generated picture cannot be stored", async () => {
    deps.findExistingPicture.mockResolvedValue(null);
    deps.storeImage.mockResolvedValue(null);

    await expect(generatePicture("apple", "English", deps)).rejects.toThrow(/store/);
  });

  it("throws when the response has no image data", async () => {
    deps.findExistingPicture.mockResolvedValue(null);
    generate.mockResolvedValue({ data: [{}] });

    await expect(generatePicture("apple", "English", deps)).rejects.toThrow(/image data/);
    expect(deps.storeImage).not.toHaveBeenCalled();
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
