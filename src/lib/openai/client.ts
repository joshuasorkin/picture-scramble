import OpenAI from "openai";

// Model for word and compliment generation, run without reasoning for speed
export const CHAT_MODEL = "gpt-6-luna";

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return client;
}
