import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/connection";
import { generateWordAndPictureUntilSuccess } from "@/lib/openai/word-and-picture";
import { generateCompliment } from "@/lib/openai/generate-compliment";
import { scramblePhrase } from "@/lib/game/scramble";
import { getSHA256Hash } from "@/lib/game/hash";
import { getDefaultContact } from "@/lib/game/contact-info";
import { Game } from "@/lib/db/models/game";
import { getRandomWordByLanguage, wordGeneratedToday } from "@/lib/game/word-queries";
import { createImageStore } from "@/lib/game/image-store";
import { getImageStorage } from "@/lib/storage/r2";

const querySchema = z.object({
  topic: z.string().optional(),
  lang: z.string().optional(),
  score: z.coerce.number().default(0),
});

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = request.nextUrl;
    const params = querySchema.parse({
      topic: searchParams.get("topic") ?? undefined,
      lang: searchParams.get("lang") ?? undefined,
      score: searchParams.get("score") ?? 0,
    });

    const language = params.lang ?? process.env.DEFAULT_LANGUAGE ?? "English";
    const topicParam = params.topic ?? null;

    const deps = {
      getRandomWordByLanguage,
      wordGeneratedToday,
      ...createImageStore(getImageStorage()),
    };

    const wordAndPicture = await generateWordAndPictureUntilSuccess(
      topicParam,
      params.score,
      language,
      deps
    );

    const word = wordAndPicture.word;
    const picture = wordAndPicture.picture;
    const compliment = await generateCompliment(word, language);
    const scramble = scramblePhrase(word);
    const solutionHash = getSHA256Hash(word);
    const contact = wordAndPicture.contact ?? getDefaultContact();

    const newGame = new Game({
      language,
      solution: word,
      solutionHash,
      scramble,
      picture,
      compliment,
      date_create: new Date(),
      contact,
    });

    await newGame.save();

    return NextResponse.json({
      gameId: newGame._id,
      scramble,
      picture,
      solutionHash,
      compliment,
      contact,
    });
  } catch (error) {
    console.error("Error creating new game:", error);
    return NextResponse.json(
      { error: "Error creating new game" },
      { status: 500 }
    );
  }
}
