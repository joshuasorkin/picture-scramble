import { Word } from "@/lib/db/models/word";
import { Game } from "@/lib/db/models/game";

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
