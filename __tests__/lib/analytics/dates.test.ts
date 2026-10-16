import { describe, it, expect, afterEach } from "vitest";
import { addDays, daysInRange, isValidDay, isValidTimezone, todayIn } from "@/lib/analytics/dates";
import { parseStatsRange, isStatsKey } from "@/lib/analytics/stats-range";

describe("date helpers", () => {
  it("validates days", () => {
    expect(isValidDay("2026-10-15")).toBe(true);
    expect(isValidDay("2026-02-30")).toBe(false);
    expect(isValidDay("10/15/2026")).toBe(false);
  });

  it("validates timezones", () => {
    expect(isValidTimezone("America/Los_Angeles")).toBe(true);
    expect(isValidTimezone("Mars/Olympus")).toBe(false);
  });

  it("finds today in a timezone", () => {
    const now = new Date("2026-10-15T03:00:00Z");
    expect(todayIn("UTC", now)).toBe("2026-10-15");
    expect(todayIn("America/Los_Angeles", now)).toBe("2026-10-14");
  });

  it("adds days across month boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("lists every day in a range", () => {
    expect(daysInRange("2026-10-30", "2026-11-02")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });
});

describe("parseStatsRange", () => {
  it("defaults to the last 14 days in Pacific time", () => {
    const result = parseStatsRange({});
    expect(result.success).toBe(true);
    const { from, to, timezone } = result.data!;
    expect(timezone).toBe("America/Los_Angeles");
    expect(to).toBe(todayIn("America/Los_Angeles"));
    expect(daysInRange(from, to)).toHaveLength(14);
  });

  it("accepts an explicit range", () => {
    const result = parseStatsRange({ from: "2026-10-01", to: "2026-10-15", tz: "UTC" });
    expect(result.data).toEqual({ from: "2026-10-01", to: "2026-10-15", timezone: "UTC" });
  });

  it("rejects bad input", () => {
    expect(parseStatsRange({ from: "2026-10-15", to: "2026-10-01" }).success).toBe(false);
    expect(parseStatsRange({ from: "2024-01-01", to: "2026-10-15" }).success).toBe(false);
    expect(parseStatsRange({ tz: "Nowhere" }).success).toBe(false);
    expect(parseStatsRange({ from: "yesterday" }).success).toBe(false);
  });
});

describe("isStatsKey", () => {
  const original = process.env.STATS_KEY;
  afterEach(() => {
    process.env.STATS_KEY = original;
  });

  it("matches only a configured key", () => {
    process.env.STATS_KEY = "secret";
    expect(isStatsKey("secret")).toBe(true);
    expect(isStatsKey("wrong")).toBe(false);
    expect(isStatsKey(null)).toBe(false);
  });

  it("rejects everything when no key is configured", () => {
    process.env.STATS_KEY = "";
    expect(isStatsKey("")).toBe(false);
  });
});
