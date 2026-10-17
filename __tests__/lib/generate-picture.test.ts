import { describe, it, expect, vi, beforeEach } from "vitest";
import { ART_STYLES, generatePicture } from "@/lib/openai/generate-picture";

const generate = vi.fn();
const chat = vi.fn();
const STYLE = "Sasanian mural painting in deep reds, blues and gold.";

// Mock the OpenAI client
vi.mock("@/lib/openai/client", () => ({
  CHAT_MODEL: "gpt-6-luna",
  getOpenAIClient: () => ({ images: { generate }, chat: { completions: { create: chat } } }),
}));

describe("generatePicture", () => {
  const deps = {
    findExistingPicture: vi.fn(),
    storeImage: vi.fn(),
    saveArtStyle: vi.fn(),
    getRandomSavedArtStyle: vi.fn(),
  };
  const imageData = Buffer.from("generated image");

  beforeEach(() => {
    vi.clearAllMocks();
    generate.mockResolvedValue({ data: [{ b64_json: imageData.toString("base64") }] });
    chat.mockResolvedValue({ choices: [{ message: { content: STYLE } }] });
    deps.storeImage.mockResolvedValue("https://img.test/img/new.webp");
    deps.saveArtStyle.mockResolvedValue(undefined);
    deps.getRandomSavedArtStyle.mockResolvedValue(null);
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

  it("draws the picture in the style described for a random time and place", async () => {
    deps.findExistingPicture.mockResolvedValue(null);

    await generatePicture("apple", "English", deps);

    const question: string = chat.mock.calls[0]?.[0].messages[0].content;
    expect(question).toMatch(/GPS coordinates -?\d+\.\d{4}, -?\d+\.\d{4} in the year \d+/);
    const prompt: string = generate.mock.calls[0]?.[0].prompt;
    expect(prompt).toContain(`Art style: ${STYLE}`);
    expect(prompt).toMatch(/apple clearly the main subject/);
    expect(prompt).toMatch(/vivid, saturated colors/);
    expect(prompt).toMatch(/suitable for all ages/);
    expect(deps.saveArtStyle).toHaveBeenCalledWith(
      STYLE,
      expect.objectContaining({ coordinates: expect.any(String), year: expect.any(Number) })
    );
    expect(deps.getRandomSavedArtStyle).not.toHaveBeenCalled();
  });

  it("reuses a saved art style without describing a new one when asked to", async () => {
    deps.findExistingPicture.mockResolvedValue(null);
    deps.getRandomSavedArtStyle.mockResolvedValue("Komi folk embroidery in red and black.");

    await generatePicture("apple", "English", deps, { savedStyle: true });

    expect(chat).not.toHaveBeenCalled();
    expect(deps.saveArtStyle).not.toHaveBeenCalled();
    const prompt: string = generate.mock.calls[0]?.[0].prompt;
    expect(prompt).toContain("Art style: Komi folk embroidery in red and black.");
  });

  it("describes a new art style when no saved one is available", async () => {
    deps.findExistingPicture.mockResolvedValue(null);

    await generatePicture("apple", "English", deps, { savedStyle: true });

    expect(chat).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0]?.[0].prompt).toContain(`Art style: ${STYLE}`);
  });

  it("still generates the picture when saving the art style fails", async () => {
    deps.findExistingPicture.mockResolvedValue(null);
    deps.saveArtStyle.mockRejectedValue(new Error("db down"));

    const result = await generatePicture("apple", "English", deps);

    expect(result.picture).toBe("https://img.test/img/new.webp");
  });

  it("falls back to a listed art style when the style can't be described", async () => {
    deps.findExistingPicture.mockResolvedValue(null);
    chat.mockRejectedValue(new Error("chat down"));

    const result = await generatePicture("apple", "English", deps);

    expect(result.picture).toBe("https://img.test/img/new.webp");
    const prompt: string = generate.mock.calls[0]?.[0].prompt;
    expect(ART_STYLES.some((style) => prompt.includes(`Art style: ${style}.`))).toBe(true);
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
    // The extra picture is generated in the background
    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(1));
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
