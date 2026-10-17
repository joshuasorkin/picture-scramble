import { Suspense } from "react";
import type { Metadata } from "next";
import { isValidObjectId } from "mongoose";
import GameContainer from "@/components/game/GameContainer";
import { connectToDatabase } from "@/lib/db/connection";
import { Game } from "@/lib/db/models/game";

const SHARE_TITLE = "Can you solve this Utu's Wild Words puzzle?";

// A shared link previews with the puzzle's picture (which doesn't reveal
// the word); any problem falls back to the site's default metadata.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ puzzle?: string | string[] }>;
}): Promise<Metadata> {
  const { puzzle } = await searchParams;
  if (typeof puzzle !== "string" || !isValidObjectId(puzzle)) return {};

  try {
    await connectToDatabase();
    const game = await Game.findById(puzzle).select("picture");
    if (!game) return {};

    const description = "Unscramble the word hidden in this picture.";
    return {
      title: SHARE_TITLE,
      description,
      openGraph: {
        title: SHARE_TITLE,
        description,
        images: [{ url: game.picture, width: 1024, height: 1024 }],
      },
      twitter: { card: "summary_large_image", images: [game.picture] },
    };
  } catch (error) {
    console.error("Error loading shared puzzle metadata:", error);
    return {};
  }
}

export default function Home() {
  return (
    <Suspense>
      <GameContainer />
    </Suspense>
  );
}
