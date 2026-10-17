import { generateWord, getRandomWord } from "./generate-word";
import { generatePicture, type PictureDeps, type PictureOptions } from "./generate-picture";
import type { Contact } from "@/lib/game/contact-info";

export interface WordAndPictureDeps extends PictureDeps {
  getRandomWordByLanguage: (language: string) => Promise<string | null>;
  wordGeneratedToday: (word: string) => Promise<boolean>;
  recentTopicWords: (topic: string, language: string) => Promise<string[]>;
  claimTopicWord: (topic: string, language: string, word: string) => Promise<boolean>;
}

export interface WordAndPictureResult {
  word: string;
  picture: string;
  // Attribution for the chosen image, when it was uploaded by an artist
  contact: Contact | null;
}

// Unexpected errors (e.g. OpenAI failures) before giving up
export const MAX_FAILURES = 3;
// All attempts, including routine retries for repeated or too-long words
export const MAX_ATTEMPTS = 20;

export async function generateWordAndPictureUntilSuccess(
  topicParam: string | null,
  score: number,
  language: string,
  deps: WordAndPictureDeps,
  pictureOptions: PictureOptions = {}
): Promise<WordAndPictureResult> {
  let success = false;
  let alreadyShownToday = false;
  let generateAttempts = 0;
  let attempts = 0;
  let failures = 0;
  let word = "";
  let picture = "";
  let contact: Contact | null = null;
  // Words already played on this topic, fetched once on the first topic attempt
  let topicWordsToAvoid: string[] | null = null;
  const wordLengthMax = Number(process.env.WORD_LENGTH_MAX ?? 9);

  while (!success) {
    attempts++;
    try {
      if (alreadyShownToday && generateAttempts > 3) {
        word = getRandomWord();
      } else if (topicParam) {
        // Topic specified — generate a fresh word from OpenAI, steering away
        // from words recently played on this topic, and claim it right away
        // so games being made at the same time don't pick it too
        const topic = topicParam;
        topicWordsToAvoid ??= await deps.recentTopicWords(topic, language);
        word = await generateWord(topic, score, language, topicWordsToAvoid, (w) =>
          deps.claimTopicWord(topic, language, w)
        );
      } else {
        // No topic — try to find an existing word in this language
        const existingWord = await deps.getRandomWordByLanguage(language);
        if (!existingWord) {
          word = await generateWord(topicParam, score, language);
        } else {
          word = existingWord;
        }

        alreadyShownToday = await deps.wordGeneratedToday(word);
        if (alreadyShownToday) {
          generateAttempts++;
          throw new Error("already shown today");
        }

        if (word.length > wordLengthMax) {
          throw new Error("word too long");
        }
      }

      ({ picture, contact } = await generatePicture(word, language, deps, pictureOptions));
      success = true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (msg !== "already shown today" && msg !== "word too long") {
        console.error("Error generating word and picture:", error);
        failures++;
      }
      if (failures >= MAX_FAILURES || attempts >= MAX_ATTEMPTS) {
        throw new Error(
          `Gave up generating a word and picture after ${attempts} attempts`,
          { cause: error }
        );
      }
    }
  }

  return { word, picture, contact };
}
