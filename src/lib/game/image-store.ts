import { Word } from "@/lib/db/models/word";
import { Image } from "@/lib/db/models/image";
import type { Contact } from "@/lib/game/contact-info";

export async function storeImage(
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

    if (!wordDoc || !wordDoc.imageRef) {
      wordDoc = new Word({ word, language, uploaded });
      await wordDoc.save();
    } else {
      imageDoc = await Image.findById(wordDoc.imageRef);
    }

    const MAX_DOC_SIZE = 15 * 1024 * 1024; // 15 MB safety margin under 16 MB BSON limit

    if (!imageDoc) {
      imageDoc = new Image({
        images: [imageBuffer],
        wordRef: wordDoc._id,
      });
    } else {
      // Estimate current doc size by summing existing image buffers
      const currentSize = imageDoc.images.reduce(
        (sum: number, buf: Buffer) => sum + buf.length,
        0
      );
      if (currentSize + imageBuffer.length > MAX_DOC_SIZE) {
        // Remove the oldest non-uploaded image to make room
        const uploadedIndexes = new Set(
          imageDoc.uploadedIndexes.map((u: { imageIndex: number }) => u.imageIndex)
        );
        let removedIndex = -1;
        for (let i = 0; i < imageDoc.images.length; i++) {
          if (!uploadedIndexes.has(i)) {
            removedIndex = i;
            break;
          }
        }
        if (removedIndex === -1) {
          // All images are uploaded — remove the oldest one
          removedIndex = 0;
        }
        imageDoc.images.splice(removedIndex, 1);
        // Adjust uploadedIndexes to reflect the removal
        imageDoc.uploadedIndexes = imageDoc.uploadedIndexes
          .filter((u: { imageIndex: number }) => u.imageIndex !== removedIndex)
          .map((u: { imageIndex: number; contact: Contact | null }) => ({
            ...u,
            imageIndex: u.imageIndex > removedIndex ? u.imageIndex - 1 : u.imageIndex,
          }));
      }
      imageDoc.images.push(imageBuffer);
    }

    if (uploaded) {
      const imageIndex = imageDoc.images.length - 1;
      imageDoc.uploadedIndexes.push({ imageIndex, contact });
    }

    await imageDoc.save();

    wordDoc.imageRef = imageDoc._id;
    await wordDoc.save();

    return true;
  } catch (err) {
    console.error("Error storing image:", err);
    return false;
  }
}

export async function findExistingPicture(word: string): Promise<string | null> {
  const wordDoc = await Word.findOne({ word });

  if (!wordDoc || !wordDoc.imageRef) {
    return null;
  }

  return `/api/image/${word}`;
}
