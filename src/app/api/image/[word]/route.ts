import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connection";
import { Word } from "@/lib/db/models/word";
import { Image } from "@/lib/db/models/image";
import type { Contact } from "@/lib/game/contact-info";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ word: string }> }
) {
  try {
    await connectToDatabase();

    const { word } = await params;
    const wordDoc = await Word.findOne({ word });

    if (!wordDoc || !wordDoc.imageRef) {
      return NextResponse.json(
        { error: `No word entry or imageRef for '${word}'` },
        { status: 404 }
      );
    }

    const imageDoc = await Image.findById(wordDoc.imageRef);
    if (!imageDoc) {
      return NextResponse.json(
        {
          error: `Dangling imageRef for '${word}': Image ${wordDoc.imageRef} not found`,
        },
        { status: 404 }
      );
    }

    if (!imageDoc.images || imageDoc.images.length === 0) {
      return NextResponse.json(
        { error: `Image document for '${word}' has no image buffers` },
        { status: 404 }
      );
    }

    let randomIndex: number;
    let contact: Contact | null | undefined;

    // Prioritize uploaded images
    if (imageDoc.uploadedIndexes && imageDoc.uploadedIndexes.length > 0) {
      const randomUploadedIdx = Math.floor(
        Math.random() * imageDoc.uploadedIndexes.length
      );
      const uploadedIndexValue = imageDoc.uploadedIndexes[randomUploadedIdx];

      let candidateIndex: unknown;
      if (
        typeof uploadedIndexValue === "object" &&
        uploadedIndexValue !== null
      ) {
        candidateIndex = uploadedIndexValue.imageIndex;
        contact = uploadedIndexValue.contact;
      } else {
        // Legacy format: just an integer index
        candidateIndex = uploadedIndexValue;
      }

      if (
        typeof candidateIndex === "number" &&
        Number.isInteger(candidateIndex) &&
        candidateIndex >= 0 &&
        candidateIndex < imageDoc.images.length &&
        imageDoc.images[candidateIndex]
      ) {
        randomIndex = candidateIndex;
      } else {
        // Malformed uploadedIndexes entry — fall back to any available image
        console.warn(
          `Malformed uploadedIndexes entry for '${word}':`,
          JSON.stringify(uploadedIndexValue),
          `(images.length=${imageDoc.images.length}). Falling back to random image.`
        );
        contact = null;
        randomIndex = Math.floor(Math.random() * imageDoc.images.length);
      }
    } else {
      randomIndex = Math.floor(Math.random() * imageDoc.images.length);
    }

    const imageBuffer = imageDoc.images[randomIndex];
    if (!imageBuffer) {
      return NextResponse.json(
        {
          error: `No image buffer at index ${randomIndex} for '${word}' (images.length=${imageDoc.images.length})`,
        },
        { status: 404 }
      );
    }

    const imageBase64 = imageBuffer.toString("base64");

    return NextResponse.json({
      image: `data:image/png;base64,${imageBase64}`,
      contact: contact ?? null,
    });
  } catch (err) {
    console.error("Error retrieving image:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
