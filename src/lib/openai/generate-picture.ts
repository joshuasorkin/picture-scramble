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

// Asked for "a random historical art style", the model always picks the same
// muted European old-master look, so the style is chosen here instead
export const ART_STYLES = [
  "an ancient Egyptian tomb painting, with flat figures in ochre, turquoise and lapis blue",
  "a Roman mosaic of small glossy tiles in bold colors",
  "a medieval illuminated manuscript, with gold leaf and jewel-toned blues and reds",
  "a Byzantine icon with a shining gold background",
  "a Persian miniature painting, with intricate patterns and brilliant colors",
  "a Mughal miniature painting, with fine detail and rich, saturated colors",
  "a Japanese ukiyo-e woodblock print, with crisp outlines and flat, vivid color",
  "a Chinese gongbi painting on silk, with fine lines and bright mineral pigments",
  "a Maya mural, with strong outlines and bright red, blue and yellow",
  "an Aboriginal Australian dot painting in warm, vibrant colors",
  "a Mexican folk art painting in hot pink, orange and turquoise",
  "a West African kente-inspired design with bold geometric color",
  "a stained glass window glowing with saturated light",
  "an Impressionist painting full of bright sunlight and color",
  "a Post-Impressionist painting with swirling brushstrokes and intense color",
  "a Fauvist painting with wild, unnatural, saturated colors",
  "an Art Nouveau poster with flowing lines and decorative borders",
  "an Art Deco poster with sleek geometric shapes and bold color",
  "a 1930s travel poster with flat, vivid color blocks",
  "a 1960s Pop Art print with bold outlines and bright primary colors",
  "a 1970s psychedelic poster in electric colors",
  "a mid-century modern children's book illustration in cheerful colors",
  "a Bauhaus composition of bold primary-colored shapes",
  "a Cubist painting of colorful fractured planes",
  "a Russian lacquer box painting, with bright figures on a black background",
  "a Ndebele house mural with bold black-outlined geometric color",
];

export function buildPicturePrompt(word: string, style: string): string {
  return `Generate a picture of ${word}, in the style of ${style}. Use vivid, saturated colors; avoid muted or dingy tones. Do not include the word '${word}' in the picture. Do not include any text in the picture.`;
}

function randomArtStyle(): string {
  return ART_STYLES[Math.floor(Math.random() * ART_STYLES.length)] ?? ART_STYLES[0]!;
}

export async function generateAndStorePicture(
  word: string,
  language: string,
  deps: PictureDeps
): Promise<string> {
  const client = getOpenAIClient();

  const response = await client.images.generate({
    model: IMAGE_MODEL,
    prompt: buildPicturePrompt(word, randomArtStyle()),
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
