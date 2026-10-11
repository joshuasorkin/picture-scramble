// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import sharp from "sharp";
import "@/../__tests__/helpers/setup";
import { createMemoryStorage } from "@/../__tests__/helpers/memory-storage";
import { makePng } from "@/../__tests__/helpers/test-image";
import { Word } from "@/lib/db/models/word";
import { Image } from "@/lib/db/models/image";
import { createImageStore, MAX_IMAGES_PER_WORD } from "@/lib/game/image-store";

describe("image store", () => {
  let memory: ReturnType<typeof createMemoryStorage>;
  let store: ReturnType<typeof createImageStore>;

  beforeEach(() => {
    memory = createMemoryStorage();
    store = createImageStore(memory.storage);
  });

  it("stores an image as WebP under a content-hash key", async () => {
    const result = await store.storeImage("test", null, "English", await makePng());
    expect(result).toBe(true);

    const wordDoc = await Word.findOne({ word: "test" });
    const imageDoc = await Image.findById(wordDoc!.imageRef);
    expect(imageDoc!.objects).toHaveLength(1);

    const { key, uploaded } = imageDoc!.objects[0]!;
    expect(key).toMatch(/^img\/[0-9a-f]{64}\.webp$/);
    expect(uploaded).toBe(false);

    const stored = memory.objects.get(key);
    expect(stored!.contentType).toBe("image/webp");
    expect((await sharp(stored!.body).metadata()).format).toBe("webp");
  });

  it("finds the stored picture by word without exposing the word", async () => {
    await store.storeImage("sunrise", null, "English", await makePng());

    const existing = await store.findExistingPicture("sunrise");
    expect(existing!.picture).toMatch(/^https:\/\/img\.test\/img\/[0-9a-f]{64}\.webp$/);
    expect(existing!.picture).not.toContain("sunrise");
    expect(existing!.contact).toBeNull();
    expect(existing!.full).toBe(false);
  });

  it("prioritizes uploaded images and returns their contact", async () => {
    const contact = { name: "Artist" };
    await store.storeImage("test", null, "English", await makePng(1));
    await store.storeImage("test", null, "English", await makePng(2), true, contact);
    await store.storeImage("test", null, "English", await makePng(3));

    const imageDoc = await Image.findOne({});
    const uploadedKey = imageDoc!.objects.find((o) => o.uploaded)!.key;

    for (let i = 0; i < 10; i++) {
      const existing = await store.findExistingPicture("test");
      expect(existing!.picture).toBe(memory.storage.publicUrl(uploadedKey));
      expect(existing!.contact).toEqual(contact);
    }
  });

  it("returns null for non-existent word", async () => {
    expect(await store.findExistingPicture("nonexistent")).toBeNull();
  });

  it("returns null for a word whose image document has no objects", async () => {
    const imageDoc = await Image.create({ objects: [] });
    await Word.create({ word: "empty", language: "English", imageRef: imageDoc._id });

    expect(await store.findExistingPicture("empty")).toBeNull();
  });

  it("refuses generated images once a word is full", async () => {
    for (let i = 0; i < MAX_IMAGES_PER_WORD; i++) {
      expect(await store.storeImage("test", null, "English", await makePng(i))).toBe(true);
    }
    expect((await store.findExistingPicture("test"))!.full).toBe(true);

    const result = await store.storeImage("test", null, "English", await makePng(99));
    expect(result).toBe(false);

    const imageDoc = await Image.findOne({});
    expect(imageDoc!.objects).toHaveLength(MAX_IMAGES_PER_WORD);
    expect(memory.objects.size).toBe(MAX_IMAGES_PER_WORD);
  });

  it("evicts the oldest generated image when an upload arrives at a full word", async () => {
    await store.storeImage("test", null, "English", await makePng(50), true, { name: "First" });
    for (let i = 1; i < MAX_IMAGES_PER_WORD; i++) {
      await store.storeImage("test", null, "English", await makePng(i));
    }
    const before = await Image.findOne({});
    const oldestGeneratedKey = before!.objects[1]!.key;

    const result = await store.storeImage(
      "test", null, "English", await makePng(99), true, { name: "Second" }
    );
    expect(result).toBe(true);

    const after = await Image.findOne({});
    expect(after!.objects).toHaveLength(MAX_IMAGES_PER_WORD);
    expect(after!.objects.map((o) => o.key)).not.toContain(oldestGeneratedKey);
    expect(after!.objects.filter((o) => o.uploaded)).toHaveLength(2);
    expect(memory.objects.has(oldestGeneratedKey)).toBe(false);
    expect(memory.objects.size).toBe(MAX_IMAGES_PER_WORD);
  });
});
