// @vitest-environment node
import { describe, it, expect } from "vitest";
import "@/../__tests__/helpers/setup";
import { Game } from "@/lib/db/models/game";
import { getSHA256Hash } from "@/lib/game/hash";
import { copySharedGame } from "@/lib/game/shared-game";
import { recordGameShare } from "@/lib/analytics/game-events";

function createGame(overrides: Record<string, unknown> = {}) {
  return Game.create({
    language: "Spanish",
    topic: "astronomy",
    solution: "albedo",
    solutionHash: getSHA256Hash("albedo"),
    scramble: "doblea",
    picture: "https://img.test/img/abc.webp",
    compliment: "¡Brillas!",
    contact: { name: "Artist" },
    date_create: new Date("2026-10-01"),
    date_start: new Date("2026-10-01"),
    date_solve: new Date("2026-10-01"),
    visitorId: "sharer",
    ...overrides,
  });
}

describe("copySharedGame", () => {
  it("creates a new, unplayed game with the same puzzle", async () => {
    const source = await createGame();

    const copy = await copySharedGame(source.id);

    expect(copy!.id).not.toBe(source.id);
    expect(copy!.sharedFrom).toBe(source.id);
    for (const field of ["language", "topic", "solution", "solutionHash", "scramble", "picture", "compliment"] as const) {
      expect(copy![field]).toBe(source[field]);
    }
    expect(copy!.contact).toEqual({ name: "Artist" });
    // The receiver's round is tracked on its own
    expect(copy!.date_start).toBeUndefined();
    expect(copy!.date_solve).toBeUndefined();
    expect(copy!.visitorId).toBeUndefined();
    expect(await Game.countDocuments()).toBe(2);
  });

  it("credits the original puzzle when a copy is shared again", async () => {
    const source = await createGame();
    const first = await copySharedGame(source.id);

    const second = await copySharedGame(first!.id);

    expect(second!.sharedFrom).toBe(source.id);
  });

  it("returns null for a missing or malformed id", async () => {
    expect(await copySharedGame("6ad1ac73f0bbf390fbf93971")).toBeNull();
    expect(await copySharedGame("not-an-id")).toBeNull();
    expect(await copySharedGame("")).toBeNull();
    expect(await Game.countDocuments()).toBe(0);
  });
});

describe("recordGameShare", () => {
  it("counts every share", async () => {
    const game = await createGame();

    expect(await recordGameShare(game.id)).toBe(true);
    await recordGameShare(game.id);

    expect((await Game.findById(game.id))!.shareCount).toBe(2);
  });

  it("ignores an unknown game", async () => {
    expect(await recordGameShare("6ad1ac73f0bbf390fbf93971")).toBe(false);
  });
});
