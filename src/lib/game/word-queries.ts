import { Word } from "@/lib/db/models/word";
import { Game } from "@/lib/db/models/game";
import { TopicWord, TOPIC_WORD_TTL_SECONDS } from "@/lib/db/models/topic-word";

export async function getRandomWordByLanguage(
  language: string
): Promise<string | null> {
  const randomWordDoc = await Word.aggregate([
    { $match: { language } },
    { $sample: { size: 1 } },
  ]);

  if (randomWordDoc.length > 0) {
    return (randomWordDoc[0] as { word: string }).word;
  }

  return null;
}

export async function wordGeneratedToday(word: string): Promise<boolean> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const recentGames = await Game.find({
    solution: word,
    date_create: { $gte: twentyFourHoursAgo },
  });

  return recentGames.length > 0;
}

// Most avoided words to name in a prompt, newest first
const RECENT_TOPIC_WORDS_LIMIT = 40;

/**
 * Words claimed for games on this topic and language in the last 24 hours,
 * newest first, including games still being made.
 */
export async function recentTopicWords(
  topic: string,
  language: string
): Promise<string[]> {
  // The TTL monitor deletes expired claims only every minute or so
  const since = new Date(Date.now() - TOPIC_WORD_TTL_SECONDS * 1000);

  const recent = await TopicWord.find(
    { topic, language, createdAt: { $gte: since } },
    { word: 1 }
  )
    .sort({ createdAt: -1 })
    .limit(RECENT_TOPIC_WORDS_LIMIT)
    .lean();

  return recent.map((r) => r.word);
}

/**
 * Claim a word for a game on this topic. Returns false when it is already
 * claimed, including by a request running at the same time.
 */
export async function claimTopicWord(
  topic: string,
  language: string,
  word: string
): Promise<boolean> {
  // The unique index must exist before the insert can be trusted
  await TopicWord.init();
  try {
    await TopicWord.create({ topic, language, word });
    return true;
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return false;
    throw error;
  }
}
