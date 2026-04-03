import { describe, it, expect } from "vitest";
import "@/../__tests__/helpers/setup";
import { Game } from "@/lib/db/models/game";
import { Word } from "@/lib/db/models/word";
import { Image } from "@/lib/db/models/image";
import { getSHA256Hash } from "@/lib/game/hash";
import { scramblePhrase } from "@/lib/game/scramble";
import { findMismatches } from "@/lib/game/mismatches";
import { storeImage } from "@/lib/game/image-store";

describe("full game flow", () => {
  it("create game → wrong answer → correct answer", async () => {
    const word = "apple";
    const scramble = scramblePhrase(word);
    const solutionHash = getSHA256Hash(word);

    // Create game
    const game = await Game.create({
      language: "English",
      solution: word,
      solutionHash,
      scramble,
      picture: "http://example.com/pic.png",
      compliment: "Nice work!",
      date_create: new Date(),
      contact: { name: "Test" },
    });

    // Wrong answer
    const wrongAnswer = "aplpe";
    const checkWrong = game.solution === wrongAnswer;
    expect(checkWrong).toBe(false);
    const mismatches = findMismatches(game.solution, wrongAnswer);
    expect(mismatches.length).toBeGreaterThan(0);

    // Correct answer
    const checkCorrect = game.solution === word;
    expect(checkCorrect).toBe(true);
    const updated = await Game.findByIdAndUpdate(
      game._id,
      { date_solve: new Date() },
      { new: true }
    );
    expect(updated?.date_solve).toBeDefined();
  });
});

describe("image upload flow", () => {
  it("stores and retrieves uploaded image with contact", async () => {
    const word = "sunset";
    const language = "English";
    const buffer = Buffer.from("fake-png-data");
    const contact = { name: "Artist", instagram: "artist123" };

    const result = await storeImage(word, null, language, buffer, true, contact);
    expect(result).toBe(true);

    // Verify word document
    const wordDoc = await Word.findOne({ word, language });
    expect(wordDoc).toBeDefined();
    expect(wordDoc!.uploaded).toBe(true);

    // Verify image document
    const imageDoc = await Image.findById(wordDoc!.imageRef);
    expect(imageDoc).toBeDefined();
    expect(imageDoc!.images).toHaveLength(1);
    expect(imageDoc!.uploadedIndexes).toHaveLength(1);
    expect(imageDoc!.uploadedIndexes[0]!.contact).toEqual(contact);
  });
});
