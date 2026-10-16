// @vitest-environment node
import { describe, it, expect } from "vitest";
import "@/../__tests__/helpers/setup";
import { Game } from "@/lib/db/models/game";
import { Visit } from "@/lib/db/models/visit";
import { getSHA256Hash } from "@/lib/game/hash";
import { recordGameStart, recordGameSolve } from "@/lib/analytics/game-events";
import { touchVisit, VISIT_TIMEOUT_MS } from "@/lib/analytics/visits";
import { getStats } from "@/lib/analytics/stats";

function createGame(fields: Record<string, unknown> = {}) {
  return Game.create({
    language: "English",
    solution: "apple",
    solutionHash: getSHA256Hash("apple"),
    scramble: "ppale",
    picture: "http://example.com/pic.png",
    compliment: "Great job!",
    date_create: new Date(),
    ...fields,
  });
}

function createVisit(visitorId: string, startedAt: string) {
  const at = new Date(startedAt);
  return Visit.create({ visitorId, startedAt: at, lastSeenAt: at });
}

describe("recordGameStart", () => {
  it("records the visitor, visit and start time once", async () => {
    const game = await createGame();

    expect(await recordGameStart(game.id, "visitor-a", "visit-1")).toBe(true);
    expect(await recordGameStart(game.id, "visitor-b", "visit-2")).toBe(false);

    const updated = await Game.findById(game.id);
    expect(updated?.visitorId).toBe("visitor-a");
    expect(updated?.visitId).toBe("visit-1");
    expect(updated?.date_start).toBeInstanceOf(Date);
  });
});

describe("recordGameSolve", () => {
  it("sets date_solve for the correct solution", async () => {
    const game = await createGame();
    expect(await recordGameSolve(game.id, "apple")).toBe(true);
    expect((await Game.findById(game.id))?.date_solve).toBeInstanceOf(Date);
  });

  it("ignores a wrong solution", async () => {
    const game = await createGame();
    expect(await recordGameSolve(game.id, "ppale")).toBe(false);
    expect((await Game.findById(game.id))?.date_solve).toBeUndefined();
  });
});

describe("touchVisit", () => {
  const start = new Date("2026-10-15T10:00:00Z");
  const later = (ms: number) => new Date(start.getTime() + ms);

  it("extends the current visit while the visitor stays active", async () => {
    const first = await touchVisit("a", { referrer: "google.com" }, start);
    const second = await touchVisit("a", {}, later(20 * 60 * 1000));
    const third = await touchVisit("a", {}, later(45 * 60 * 1000));

    expect(second.id).toBe(first.id);
    expect(third.id).toBe(first.id);
    expect(third.lastSeenAt).toEqual(later(45 * 60 * 1000));
    expect(third.referrer).toBe("google.com");
  });

  it("starts a new visit after the inactivity timeout", async () => {
    const first = await touchVisit("a", {}, start);
    const second = await touchVisit("a", {}, later(VISIT_TIMEOUT_MS + 1));

    expect(second.id).not.toBe(first.id);
    expect(await Visit.countDocuments({ visitorId: "a" })).toBe(2);
  });

  it("keeps visitors separate", async () => {
    const a = await touchVisit("a", {}, start);
    const b = await touchVisit("b", {}, start);
    expect(a.id).not.toBe(b.id);
  });
});

describe("getStats", () => {
  it("computes per-day and whole-range averages", async () => {
    await Promise.all([
      // Day 1: a visits twice and plays 3 (solves 2); b visits once, plays nothing
      createVisit("a", "2026-10-14T09:00:00Z"),
      createVisit("a", "2026-10-14T18:00:00Z"),
      createVisit("b", "2026-10-14T12:00:00Z"),
      createGame({ visitorId: "a", date_start: new Date("2026-10-14T09:01:00Z"), date_solve: new Date() }),
      createGame({ visitorId: "a", date_start: new Date("2026-10-14T09:05:00Z") }),
      createGame({ visitorId: "a", date_start: new Date("2026-10-14T18:01:00Z"), date_solve: new Date() }),
      // Day 2: a returns once and plays 1 (solves 1)
      createVisit("a", "2026-10-15T10:00:00Z"),
      createGame({ visitorId: "a", date_start: new Date("2026-10-15T10:01:00Z"), date_solve: new Date() }),
      // Preloaded but never shown: not a round
      createGame(),
    ]);

    const stats = await getStats("2026-10-13", "2026-10-15", "UTC");

    expect(stats.days.map((d) => d.date)).toEqual(["2026-10-13", "2026-10-14", "2026-10-15"]);
    expect(stats.days[0]).toMatchObject({ visitors: 0, visits: 0, rounds: 0, roundsPerVisitor: 0 });
    expect(stats.days[1]).toMatchObject({
      visitors: 2,
      visits: 3,
      rounds: 3,
      solved: 2,
      visitsPerVisitor: 1.5,
      roundsPerVisitor: 1.5,
      solvedPerVisitor: 1,
    });
    expect(stats.days[2]).toMatchObject({ visitors: 1, visits: 1, rounds: 1, solved: 1 });

    // Visitor a appears on both days but is counted once in the total
    expect(stats.total).toMatchObject({
      visitors: 2,
      visits: 4,
      rounds: 4,
      solved: 3,
      visitsPerVisitor: 2,
      roundsPerVisitor: 2,
      solvedPerVisitor: 1.5,
    });
  });

  it("buckets days in the requested timezone", async () => {
    // 03:00 UTC on the 15th is the evening of the 14th in Los Angeles
    await createVisit("a", "2026-10-15T03:00:00Z");

    const utc = await getStats("2026-10-14", "2026-10-15", "UTC");
    const la = await getStats("2026-10-14", "2026-10-15", "America/Los_Angeles");

    expect(utc.days.map((d) => d.visitors)).toEqual([0, 1]);
    expect(la.days.map((d) => d.visitors)).toEqual([1, 0]);
  });

  it("excludes activity outside the range", async () => {
    await Promise.all([
      createVisit("a", "2026-10-12T12:00:00Z"),
      createVisit("b", "2026-10-14T12:00:00Z"),
      createVisit("c", "2026-10-16T12:00:00Z"),
    ]);

    const stats = await getStats("2026-10-13", "2026-10-15", "UTC");
    expect(stats.total.visitors).toBe(1);
  });
});
