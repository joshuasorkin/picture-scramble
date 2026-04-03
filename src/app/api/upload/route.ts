import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { connectToDatabase } from "@/lib/db/connection";
import { createContact } from "@/lib/game/contact-info";
import { storeImage } from "@/lib/game/image-store";

const MAX_FILE_SIZE_MB = 16;

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const formData = await request.formData();

    const uploadKey = formData.get("upload_key") as string | null;
    if (uploadKey !== process.env.UPLOAD_KEY) {
      return NextResponse.json(
        { error: "Incorrect upload key." },
        { status: 400 }
      );
    }

    const imageFile = formData.get("image") as File | null;
    if (!imageFile) {
      return NextResponse.json(
        { error: "No file uploaded." },
        { status: 400 }
      );
    }

    const word = formData.get("word") as string;
    const language =
      (formData.get("language") as string) ||
      process.env.DEFAULT_LANGUAGE ||
      "English";
    const name = formData.get("name") as string | null;
    const phone = formData.get("phone") as string | null;
    const email = formData.get("email") as string | null;
    const socialMediaPlatform = formData.get("socialMediaPlatform") as
      | string
      | null;
    const socialMediaHandle = formData.get("socialMediaHandle") as
      | string
      | null;

    const contact = createContact(
      name,
      phone,
      email,
      socialMediaPlatform,
      socialMediaHandle
    );

    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = await sharp(Buffer.from(arrayBuffer)).png().toBuffer();

    const fileSizeMB = buffer.length / (1024 * 1024);
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      return NextResponse.json(
        {
          error: `When converted to PNG, your image is ${fileSizeMB.toFixed(2)} MB; maximum size is ${MAX_FILE_SIZE_MB} MB.`,
        },
        { status: 400 }
      );
    }

    const result = await storeImage(word, null, language, buffer, true, contact);

    if (result) {
      return NextResponse.json({ message: "image stored" }, { status: 201 });
    } else {
      return NextResponse.json(
        { message: "error storing image" },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error("Error processing upload:", error);
    return NextResponse.json(
      { error: "Error processing the image." },
      { status: 500 }
    );
  }
}
