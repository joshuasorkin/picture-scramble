import { getOpenAIClient } from "./client";

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

  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 10,
  });

  return response.choices[0]?.message?.content ?? "";
}
