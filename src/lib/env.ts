import { z } from "zod";

export const envSchema = z.object({
  // MongoDB
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  MONGO_DATABASE_NAME: z.string().default("picture-scramble"),

  // OpenAI
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  OPENAI_TIMEOUT_BASE: z.coerce.number().default(20000),
  OPENAI_TIMEOUT_EXP: z.coerce.number().default(2000),
  OPENAI_MAX_RETRIES: z.coerce.number().default(4),
  OPENAI_MAX_TOKENS: z.coerce.number().default(1000),
  RESPONSE_MIN_TOKENS: z.coerce.number().default(200),

  // Game
  EASY_GAMES_COUNT: z.coerce.number().default(3),
  WORD_LENGTH_MAX: z.coerce.number().default(9),
  DEFAULT_LANGUAGE: z.string().default("English"),

  // Prompts
  GENERATE_WORD_PROMPT_CONCRETE: z.string().default(
    "Generate a single easy language word (a concrete noun, color, or simple action) that is between 4 and 9 letters long. Reply with ONLY the word, nothing else."
  ),
  GENERATE_WORD_PROMPT_ABSTRACT: z.string().default(
    "Generate a single language word (can be abstract, unusual, or challenging) that is between 4 and 9 letters long. Reply with ONLY the word, nothing else."
  ),
  GENERATE_WORD_PROMPT_TOPIC: z.string().default(
    "Generate a single language word related to the topic 'topic' that is between 4 and 9 letters long. Reply with ONLY the word, nothing else."
  ),
  GENERATE_COMPLIMENT: z.string().default(
    "Generate a short, fun compliment (under 10 words) for someone who just solved the word 'word'. Reply with ONLY the compliment."
  ),

  // Contact
  DEFAULT_NAME: z.string().default(""),
  DEFAULT_PHONE: z.string().default(""),
  DEFAULT_INSTAGRAM: z.string().default(""),
  DEFAULT_CONTACT_INFO: z.string().default(""),

  // Upload
  UPLOAD_KEY: z.string().default(""),

  // Server
  PORT: z.coerce.number().default(3000),
  BASE_URL: z.string().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  return envSchema.parse(process.env);
}
