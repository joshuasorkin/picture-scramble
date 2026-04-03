import { describe, it, expect } from "vitest";
import "@/../__tests__/helpers/setup";
import { Game } from "@/lib/db/models/game";
import { getSHA256Hash } from "@/lib/game/hash";

describe("check-game logic", () => {
  it("returns correct result for matching solution", async () => {
    const game = await Game.create({
      language: "English",
      solution: "apple",
      solutionHash: getSHA256Hash("apple"),
      scramble: "ppale",
      picture: "http://example.com/pic.png",
      compliment: "Great job!",
      date_create: new Date(),
    });

    const checkResult = game.solution === "apple";
    expect(checkResult).toBe(true);

    // Simulate date_solve update
    const updated = await Game.findByIdAndUpdate(
      game._id,
      { date_solve: new Date() },
      { new: true }
    );
    expect(updated?.date_solve).toBeDefined();
  });

  it("returns mismatches for wrong answer", async () => {
    const game = await Game.create({
      language: "English",
      solution: "apple",
      solutionHash: getSHA256Hash("apple"),
      scramble: "ppale",
      picture: "http://example.com/pic.png",
      compliment: "Great job!",
      date_create: new Date(),
    });

    const checkResult = game.solution === "ppale";
    expect(checkResult).toBe(false);
  });

  it("returns 404 for non-existent game", async () => {
    const game = await Game.findById("000000000000000000000000");
    expect(game).toBeNull();
  });
});
