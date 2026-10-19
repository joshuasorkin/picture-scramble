import { CHAT_MODEL, getOpenAIClient } from "./client";
import fs from "fs";
import path from "path";

// Models answer "a random word" with the same word nearly every time, so ask
// for a list and pick from it
const WORD_LIST_SUFFIX =
  " Instead of one word, respond with 20 different such words separated by commas, and nothing else." +
  " Use only real, correctly spelled, complete words. Never shorten or alter a word to fit the length; leave it out instead.";

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
 * Pick a random word from a comma- or newline-separated model response,
 * keeping only single words of 4 to maxLength letters. Words in `avoid` are
 * skipped unless every usable word is in it, so a small topic still plays.
 */
export function pickWord(
  response: string,
  maxLength: number,
  random: () => number = Math.random,
  avoid: string[] = []
): string | null {
  const candidates = response
    .split(/[,\n]/)
    .map((w) => w.trim().toLowerCase().replace(/^["'“‘]+|["'”’.!]+$/g, ""))
    .filter((w) => /^\p{L}+$/u.test(w))
    .filter((w) => [...w].length >= 4 && [...w].length <= maxLength);
  if (candidates.length === 0) {
    return null;
  }
  const avoided = new Set(avoid.map((w) => w.toLowerCase()));
  const fresh = candidates.filter((w) => !avoided.has(w));
  const pool = fresh.length > 0 ? fresh : candidates;
  return pool[Math.floor(random() * pool.length)]!;
}

/**
 * Ask the model whether a picked word is real. Without reasoning, the list
 * reply sometimes holds made-up or truncated words ("actuateg", "kaleidosc").
 */
export async function isRealWord(
  word: string,
  language: string,
  topic: string | null
): Promise<boolean> {
  const field = topic ? ` (a technical term in ${topic} counts)` : "";
  const response = await getOpenAIClient().chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      {
        role: "user",
        content: `Is "${word}" a real, correctly spelled, complete ${language} word${field}? Answer only yes or no.`,
      },
    ],
    max_completion_tokens: 10,
    reasoning_effort: "none",
  });
  const answer = response.choices[0]?.message?.content ?? "";
  return /^\W*yes\b/i.test(answer);
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
  language: string,
  // Recent words to steer away from, e.g. ones already played on this topic
  avoid: string[] = [],
  // Reserves the picked word; false means another game just took it, so pick
  // again from the same reply
  claim?: (word: string) => Promise<boolean>
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

  const avoidSuffix =
    avoid.length > 0 ? ` Do not include any of these words: ${avoid.join(", ")}.` : "";

  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: CHAT_MODEL,
    messages: [{ role: "user", content: prompt + WORD_LIST_SUFFIX + avoidSuffix }],
    max_completion_tokens: 200,
    reasoning_effort: "none",
  });

  const wordLengthMax = Number(process.env.WORD_LENGTH_MAX ?? 9);
  const content = response.choices[0]?.message?.content ?? "";
  const taken = [...avoid];
  const fake: string[] = [];
  for (;;) {
    const word = pickWord(content, wordLengthMax, Math.random, [...taken, ...fake]);
    if (!word || fake.includes(word)) {
      throw new Error("No usable word in OpenAI response");
    }
    // A word that was already taken means every usable word is, so reuse it
    if (taken.includes(word)) {
      return word;
    }
    if (!(await isRealWord(word, language, topicParam))) {
      fake.push(word);
      continue;
    }
    if (!claim || (await claim(word))) {
      return word;
    }
    taken.push(word);
  }
}
