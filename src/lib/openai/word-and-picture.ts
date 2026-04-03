import { generateWord, getRandomWord } from "./generate-word";
import { generatePicture, type PictureDeps } from "./generate-picture";

export interface WordAndPictureDeps extends PictureDeps {
  getRandomWordByLanguage: (language: string) => Promise<string | null>;
  wordGeneratedToday: (word: string) => Promise<boolean>;
}

export interface WordAndPictureResult {
  word: string;
  picture: string;
}

export async function generateWordAndPictureUntilSuccess(
  topicParam: string | null,
  score: number,
  language: string,
  deps: WordAndPictureDeps
): Promise<WordAndPictureResult> {
  let success = false;
  let alreadyShownToday = false;
  let generateAttempts = 0;
  let word = "";
  let picture = "";
  const wordLengthMax = Number(process.env.WORD_LENGTH_MAX ?? 9);

  while (!success) {
    try {
      if (alreadyShownToday && generateAttempts > 3) {
        word = getRandomWord();
      } else if (topicParam) {
        // Topic specified — always generate a fresh word from OpenAI
        word = await generateWord(topicParam, score, language);
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

      picture = await generatePicture(word, language, deps);
      success = true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (msg !== "already shown today" && msg !== "word too long") {
        console.error("Error generating word and picture:", error);
      }
    }
  }

  return { word, picture };
}
