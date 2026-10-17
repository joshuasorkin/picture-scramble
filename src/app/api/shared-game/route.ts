import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connection";
import { getDefaultContact } from "@/lib/game/contact-info";
import { copySharedGame } from "@/lib/game/shared-game";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const id = request.nextUrl.searchParams.get("id") ?? "";
    const game = await copySharedGame(id);
    if (!game) {
      return NextResponse.json({ error: "Puzzle not found" }, { status: 404 });
    }

    return NextResponse.json({
      gameId: game._id,
      scramble: game.scramble,
      picture: game.picture,
      solutionHash: game.solutionHash,
      compliment: game.compliment,
      contact: game.contact ?? getDefaultContact(),
    });
  } catch (error) {
    console.error("Error loading shared game:", error);
    return NextResponse.json(
      { error: "Error loading shared game" },
      { status: 500 }
    );
  }
}
