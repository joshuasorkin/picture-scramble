import { describe, it, expect } from "vitest";
import { getSHA256Hash } from "@/lib/game/hash";

describe("getSHA256Hash", () => {
  it("produces a known hash for a known input", () => {
    // SHA-256 of "hello" is well-known
    expect(getSHA256Hash("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
  });

  it("is deterministic", () => {
    const hash1 = getSHA256Hash("test");
    const hash2 = getSHA256Hash("test");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different inputs", () => {
    const hash1 = getSHA256Hash("foo");
    const hash2 = getSHA256Hash("bar");
    expect(hash1).not.toBe(hash2);
  });

  it("returns a 64-character hex string", () => {
    const hash = getSHA256Hash("anything");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
