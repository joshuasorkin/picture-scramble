import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { envSchema } from "@/lib/env";

describe("envSchema", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws when MONGO_URI is missing", () => {
    const result = envSchema.safeParse({
      OPENAI_API_KEY: "sk-test",
    });
    expect(result.success).toBe(false);
  });

  it("throws when OPENAI_API_KEY is missing", () => {
    const result = envSchema.safeParse({
      MONGO_URI: "mongodb://localhost",
    });
    expect(result.success).toBe(false);
  });

  it("parses successfully with required vars", () => {
    const result = envSchema.safeParse({
      MONGO_URI: "mongodb://localhost",
      OPENAI_API_KEY: "sk-test",
    });
    expect(result.success).toBe(true);
  });

  it("applies defaults", () => {
    const result = envSchema.parse({
      MONGO_URI: "mongodb://localhost",
      OPENAI_API_KEY: "sk-test",
    });
    expect(result.EASY_GAMES_COUNT).toBe(3);
    expect(result.WORD_LENGTH_MAX).toBe(9);
    expect(result.PORT).toBe(3000);
    expect(result.MONGO_DATABASE_NAME).toBe("picture-scramble");
  });

  it("coerces string numbers", () => {
    const result = envSchema.parse({
      MONGO_URI: "mongodb://localhost",
      OPENAI_API_KEY: "sk-test",
      PORT: "8080",
      EASY_GAMES_COUNT: "5",
    });
    expect(result.PORT).toBe(8080);
    expect(result.EASY_GAMES_COUNT).toBe(5);
  });
});
