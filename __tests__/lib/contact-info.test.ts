import { describe, it, expect } from "vitest";
import { createContact } from "@/lib/game/contact-info";

describe("createContact", () => {
  it("includes non-empty fields", () => {
    const contact = createContact("Alice", "555-1234", "a@b.com", "twitter", "alice");
    expect(contact).toEqual({
      name: "Alice",
      phone: "555-1234",
      email: "a@b.com",
      twitter: "alice",
    });
  });

  it("omits blank fields", () => {
    const contact = createContact("Alice", "", null, undefined, undefined);
    expect(contact).toEqual({ name: "Alice" });
  });

  it("trims values", () => {
    const contact = createContact("  Alice  ", " 555 ", null, null, null);
    expect(contact).toEqual({ name: "Alice", phone: "555" });
  });

  it("uses platform as dynamic key", () => {
    const contact = createContact(null, null, null, "instagram", "utuwildwords");
    expect(contact).toEqual({ instagram: "utuwildwords" });
  });

  it("returns empty object when all fields are blank", () => {
    const contact = createContact("", "", "", "", "");
    expect(contact).toEqual({});
  });

  it("omits platform key when platform is null", () => {
    const contact = createContact("Bob", null, null, null, "handle");
    expect(contact).toEqual({ name: "Bob" });
  });
});
