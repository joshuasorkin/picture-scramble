import { describe, it, expect } from "vitest";
import { findMismatches } from "@/lib/game/mismatches";

describe("findMismatches", () => {
  it("returns empty array for matching strings", () => {
    expect(findMismatches("hello", "hello")).toEqual([]);
  });

  it("returns correct indexes for mismatches", () => {
    expect(findMismatches("hello", "hxllo")).toEqual([1]);
  });

  it("handles multiple mismatches", () => {
    expect(findMismatches("abcd", "xbyd")).toEqual([0, 2]);
  });

  it("marks extra characters in playerSolution as mismatches", () => {
    expect(findMismatches("ab", "abcd")).toEqual([2, 3]);
  });

  it("handles playerSolution shorter than solution", () => {
    // Only compares up to playerSolution length
    expect(findMismatches("hello", "he")).toEqual([]);
  });

  it("handles completely different strings", () => {
    expect(findMismatches("abc", "xyz")).toEqual([0, 1, 2]);
  });

  it("handles empty strings", () => {
    expect(findMismatches("", "")).toEqual([]);
  });
});
