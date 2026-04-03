import { getOpenAIClient } from "./client";

export interface PictureDeps {
  findExistingPicture: (word: string) => Promise<string | null>;
  storeImage: (
    word: string,
    url: string | null,
    language: string,
    buffer?: Buffer | null,
    uploaded?: boolean
  ) => Promise<boolean>;
}

export async function generateAndStorePicture(
  word: string,
  language: string,
  deps: PictureDeps
): Promise<string> {
  const client = getOpenAIClient();

  const response = await client.images.generate({
    model: "dall-e-3",
    prompt: `Generate a picture of ${word}, in a random historical art style. Do not include the word '${word}' in the picture. Do not include any text in the picture.`,
    n: 1,
    size: "1024x1024",
  });

  const picture = response.data?.[0]?.url;
  if (!picture) {
    throw new Error("No image URL in DALL-E response");
  }

  // Store asynchronously — don't block the response
  deps.storeImage(word, picture, language).catch((err) => {
    console.error("Error storing image:", err);
  });

  return picture;
}

export async function generatePicture(
  word: string,
  language: string,
  deps: PictureDeps
): Promise<string> {
  const existingPicture = await deps.findExistingPicture(word);

  if (existingPicture) {
    // Generate an extra picture async for variety, but return the existing one
    generateAndStorePicture(word, language, deps).catch((err) => {
      console.error("Error generating extra picture:", err);
    });
    return existingPicture;
  }

  return generateAndStorePicture(word, language, deps);
}
