import { createHash } from "node:crypto";
import sharp from "sharp";
import { Word } from "@/lib/db/models/word";
import { Image, type ImageObject } from "@/lib/db/models/image";
import type { Contact } from "@/lib/game/contact-info";
import { pickImage } from "@/lib/game/pick-image";
import type { ExistingPicture } from "@/lib/openai/generate-picture";
import type { ImageStorage } from "@/lib/storage/r2";

export const MAX_IMAGES_PER_WORD = 6;
const WEBP_QUALITY = 85;

// Legacy documents may still carry the old `images` buffers (up to 15 MB);
// never load them.
const IMAGE_FIELDS = "objects wordRef";

export function createImageStore(storage: ImageStorage) {
  async function storeImage(
    word: string,
    url: string | null = null,
    language: string,
    buffer: Buffer | null = null,
    uploaded = false,
    contact: Contact | null = null
  ): Promise<boolean> {
    try {
      let imageBuffer: Buffer;

      if (url) {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
      } else if (buffer) {
        imageBuffer = buffer;
      } else {
        throw new Error(`No image URL or buffer provided for '${word}'.`);
      }

      // Find or create the Word document
      let wordDoc = await Word.findOne({ word, language });
      let imageDoc = null;

      if (!wordDoc) {
        wordDoc = new Word({ word, language, uploaded });
        await wordDoc.save();
      } else if (wordDoc.imageRef) {
        imageDoc = await Image.findById(wordDoc.imageRef).select(IMAGE_FIELDS);
      }

      if (!imageDoc) {
        imageDoc = new Image({ objects: [], wordRef: wordDoc._id });
      }

      let evicted: ImageObject | undefined;
      if (imageDoc.objects.length >= MAX_IMAGES_PER_WORD) {
        if (!uploaded) {
          // Word is full — only uploads displace existing images
          return false;
        }
        // Remove the oldest non-uploaded image to make room
        let removedIndex = imageDoc.objects.findIndex((o) => !o.uploaded);
        if (removedIndex === -1) {
          // All images are uploaded — remove the oldest one
          removedIndex = 0;
        }
        [evicted] = imageDoc.objects.splice(removedIndex, 1);
      }

      const hash = createHash("sha256").update(imageBuffer).digest("hex");
      const key = `img/${hash}.webp`;
      const webp = await sharp(imageBuffer)
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
      await storage.put(key, webp, "image/webp");

      imageDoc.objects.push({
        key,
        uploaded,
        contact: uploaded ? contact : null,
        createdAt: new Date(),
      });

      await imageDoc.save();

      wordDoc.imageRef = imageDoc._id;
      await wordDoc.save();

      if (evicted && !imageDoc.objects.some((o) => o.key === evicted.key)) {
        await storage.delete(evicted.key).catch((err) => {
          console.error(`Error deleting evicted image ${evicted.key}:`, err);
        });
      }

      return true;
    } catch (err) {
      console.error("Error storing image:", err);
      return false;
    }
  }

  async function findExistingPicture(
    word: string
  ): Promise<ExistingPicture | null> {
    const wordDoc = await Word.findOne({ word });

    if (!wordDoc || !wordDoc.imageRef) {
      return null;
    }

    const imageDoc = await Image.findById(wordDoc.imageRef).select(IMAGE_FIELDS);
    const chosen = pickImage(imageDoc?.objects ?? []);
    if (!imageDoc || !chosen) {
      return null;
    }

    return {
      picture: storage.publicUrl(chosen.key),
      contact: chosen.contact ?? null,
      full: imageDoc.objects.length >= MAX_IMAGES_PER_WORD,
    };
  }

  return { storeImage, findExistingPicture };
}
