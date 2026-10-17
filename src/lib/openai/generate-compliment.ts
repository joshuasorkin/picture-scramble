import { CHAT_MODEL, getOpenAIClient } from "./client";

// Shown if generation fails, so a compliment can never break a game
export const FALLBACK_COMPLIMENT = "🎉";

export async function generateCompliment(
  word: string,
  language: string
): Promise<string> {
  let prompt = (process.env.GENERATE_COMPLIMENT ?? "")
    .replaceAll("'word'", word)
    .replace("language", language);

  if (language !== "English") {
    prompt += " Do not include an English translation.";
  }

  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages: [{ role: "user", content: prompt }],
      // Non-Latin scripts need more tokens per word
      max_completion_tokens: 30,
      reasoning_effort: "none",
    });

    return response.choices[0]?.message?.content?.trim() || FALLBACK_COMPLIMENT;
  } catch (error) {
    console.error("Error generating compliment:", error);
    return FALLBACK_COMPLIMENT;
  }
}
