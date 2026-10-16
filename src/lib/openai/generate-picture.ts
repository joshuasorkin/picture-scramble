import { getOpenAIClient } from "./client";
import type { Contact } from "@/lib/game/contact-info";

export interface ExistingPicture {
  picture: string;
  contact: Contact | null;
  // True when the word already holds its maximum number of images
  full: boolean;
}

export interface PictureResult {
  picture: string;
  contact: Contact | null;
}

export interface PictureDeps {
  findExistingPicture: (word: string) => Promise<ExistingPicture | null>;
  storeImage: (
    word: string,
    url: string | null,
    language: string,
    buffer?: Buffer | null,
    uploaded?: boolean
  ) => Promise<string | null>;
}

const IMAGE_MODEL = "gpt-image-2.5-flare";

export async function generateAndStorePicture(
  word: string,
  language: string,
  deps: PictureDeps
): Promise<string> {
  const client = getOpenAIClient();

  const response = await client.images.generate({
    model: IMAGE_MODEL,
    prompt: `Generate a picture of ${word}, in a random historical art style. Do not include the word '${word}' in the picture. Do not include any text in the picture.`,
    n: 1,
    size: "1024x1024",
    quality: "medium",
    output_format: "webp",
  });

  // GPT Image models return the image data, not a URL
  const b64 = response.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("No image data in image generation response");
  }

  const picture = await deps.storeImage(
    word,
    null,
    language,
    Buffer.from(b64, "base64")
  );
  if (!picture) {
    throw new Error(`Failed to store generated image for '${word}'`);
  }

  return picture;
}

export async function generatePicture(
  word: string,
  language: string,
  deps: PictureDeps
): Promise<PictureResult> {
  const existingPicture = await deps.findExistingPicture(word);

  if (existingPicture) {
    if (!existingPicture.full) {
      // Generate an extra picture async for variety, but return the existing one
      generateAndStorePicture(word, language, deps).catch((err) => {
        console.error("Error generating extra picture:", err);
      });
    }
    return {
      picture: existingPicture.picture,
      contact: existingPicture.contact,
    };
  }

  const picture = await generateAndStorePicture(word, language, deps);
  return { picture, contact: null };
}
