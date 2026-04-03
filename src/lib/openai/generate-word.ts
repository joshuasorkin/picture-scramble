import { getOpenAIClient } from "./client";
import fs from "fs";
import path from "path";

let wordListCache: string[] | null = null;

function getWordList(): string[] {
  if (!wordListCache) {
    const filePath = path.join(process.cwd(), "src/data/wordlist4to9.txt");
    wordListCache = fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean);
  }
  return wordListCache;
}

export function getRandomWord(wordList?: string[]): string {
  const list = wordList ?? getWordList();
  const randomIndex = Math.floor(Math.random() * list.length);
  return list[randomIndex]!;
}

/**
 * Give user a chance at getting an easy game.
 * Below EASY_GAMES_COUNT, always easy. Above, progressively harder.
 */
export function chance(score: number): boolean {
  const easyGamesCount = Number(process.env.EASY_GAMES_COUNT ?? 3);
  if (score < easyGamesCount) {
    return true;
  }
  const num = Math.floor(score);
  const result = Math.floor(Math.random() * (num + 1));
  return result >= num / 2;
}

export async function generateWord(
  topicParam: string | null,
  score = 0,
  language: string
): Promise<string> {
  let prompt: string;

  if (topicParam) {
    prompt = (process.env.GENERATE_WORD_PROMPT_TOPIC ?? "")
      .replace("topic", topicParam)
      .replace("language", language);
  } else if (chance(score)) {
    prompt = (process.env.GENERATE_WORD_PROMPT_CONCRETE ?? "").replace(
      "language",
      language
    );
  } else {
    prompt = (process.env.GENERATE_WORD_PROMPT_ABSTRACT ?? "").replace(
      "language",
      language
    );
  }

  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 10,
  });

  const word = response.choices[0]?.message?.content?.toLowerCase().trim();
  if (!word) {
    throw new Error("No word generated from OpenAI response");
  }

  return word;
}
