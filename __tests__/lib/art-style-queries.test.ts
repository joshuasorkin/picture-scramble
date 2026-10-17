import { describe, it, expect } from "vitest";
import "@/../__tests__/helpers/setup";
import { ArtStyle } from "@/lib/db/models/art-style";
import { getRandomSavedArtStyle, saveArtStyle } from "@/lib/game/art-style-queries";

describe("saveArtStyle", () => {
  it("stores the style with the time and place it came from", async () => {
    await saveArtStyle("Thule Inuit carved ivory.", { coordinates: "63.7056, -68.2356", year: 1465 });

    const docs = await ArtStyle.find();
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      style: "Thule Inuit carved ivory.",
      coordinates: "63.7056, -68.2356",
      year: 1465,
    });
    expect(docs[0]!.createdAt).toBeInstanceOf(Date);
  });
});

describe("getRandomSavedArtStyle", () => {
  it("returns null when no styles are saved", async () => {
    expect(await getRandomSavedArtStyle()).toBeNull();
  });

  it("returns one of the saved styles", async () => {
    await saveArtStyle("Komi folk embroidery.", { coordinates: "61.2397, 50.3254", year: 1805 });
    await saveArtStyle("Liangzhu carved jade.", { coordinates: "30.2015, 120.1494", year: -3119 });

    expect(["Komi folk embroidery.", "Liangzhu carved jade."]).toContain(
      await getRandomSavedArtStyle()
    );
  });
});
