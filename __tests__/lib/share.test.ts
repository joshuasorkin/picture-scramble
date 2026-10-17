import { describe, it, expect } from "vitest";
import { formatTimer, shareMessage, shareUrl } from "@/lib/game/share";

describe("shareMessage", () => {
  it("includes the solve time in seconds", () => {
    expect(shareMessage(42)).toBe(
      "I solved this Utu's Wild Words puzzle in 42 seconds, how about you?"
    );
  });

  it("uses the singular for one second", () => {
    expect(shareMessage(1)).toContain("in 1 second,");
  });
});

describe("shareUrl", () => {
  const origin = "https://utuswildwords.com";
  const id = "6ad1ac73f0bbf390fbf93971";

  it("links to the puzzle and tags the visit as a share", () => {
    expect(shareUrl(origin, id)).toBe(`${origin}/?puzzle=${id}&utm_source=share`);
  });

  it("carries the language and topic", () => {
    const url = new URL(shareUrl(origin, id, "Spanish", "musical instruments"));
    expect(url.searchParams.get("puzzle")).toBe(id);
    expect(url.searchParams.get("lang")).toBe("Spanish");
    expect(url.searchParams.get("topic")).toBe("musical instruments");
  });
});

describe("formatTimer", () => {
  it("formats seconds as m:ss", () => {
    expect(formatTimer(0)).toBe("0:00");
    expect(formatTimer(7)).toBe("0:07");
    expect(formatTimer(65)).toBe("1:05");
    expect(formatTimer(600)).toBe("10:00");
  });
});
