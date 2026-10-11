import { describe, it, expect } from "vitest";
import { pickImage } from "@/lib/game/pick-image";

const generated = (key: string) => ({ key, uploaded: false, createdAt: new Date() });
const uploaded = (key: string) => ({
  key,
  uploaded: true,
  contact: { name: "Artist" },
  createdAt: new Date(),
});

describe("pickImage", () => {
  it("returns null when there are no images", () => {
    expect(pickImage([])).toBeNull();
  });

  it("picks among all images when none are uploaded", () => {
    const objects = [generated("a"), generated("b"), generated("c")];
    expect(pickImage(objects, () => 0)!.key).toBe("a");
    expect(pickImage(objects, () => 0.99)!.key).toBe("c");
  });

  it("only picks uploaded images when any exist", () => {
    const objects = [generated("a"), uploaded("b"), generated("c"), uploaded("d")];
    expect(pickImage(objects, () => 0)!.key).toBe("b");
    expect(pickImage(objects, () => 0.99)!.key).toBe("d");
  });
});
