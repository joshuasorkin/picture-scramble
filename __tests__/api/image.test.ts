import { describe, it, expect } from "vitest";
import "@/../__tests__/helpers/setup";
import { Word } from "@/lib/db/models/word";
import { Image } from "@/lib/db/models/image";

describe("image retrieval logic", () => {
  it("retrieves image from word reference", async () => {
    const imageDoc = await Image.create({
      images: [Buffer.from("fake-image-data")],
      uploadedIndexes: [],
    });

    const wordDoc = await Word.create({
      word: "test",
      language: "English",
      imageRef: imageDoc._id,
    });

    const foundWord = await Word.findOne({ word: "test" });
    expect(foundWord?.imageRef).toBeDefined();

    const foundImage = await Image.findById(foundWord!.imageRef);
    expect(foundImage?.images).toHaveLength(1);

    const base64 = foundImage!.images[0]!.toString("base64");
    expect(base64).toBeTruthy();
  });

  it("prioritizes uploaded images", async () => {
    const imageDoc = await Image.create({
      images: [
        Buffer.from("generated-image"),
        Buffer.from("uploaded-image"),
      ],
      uploadedIndexes: [
        { imageIndex: 1, contact: { name: "Artist" } },
      ],
    });

    const uploadedIdx = imageDoc.uploadedIndexes[0];
    expect(uploadedIdx).toBeDefined();
    expect(uploadedIdx!.imageIndex).toBe(1);
    expect(uploadedIdx!.contact).toEqual({ name: "Artist" });
  });

  it("returns null for non-existent word", async () => {
    const foundWord = await Word.findOne({ word: "nonexistent" });
    expect(foundWord).toBeNull();
  });
});
