import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/connection";
import { Game } from "@/lib/db/models/game";
import { findMismatches } from "@/lib/game/mismatches";

const querySchema = z.object({
  gameId: z.string().min(1),
  playerSolution: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = request.nextUrl;
    const parseResult = querySchema.safeParse({
      gameId: searchParams.get("gameId"),
      playerSolution: searchParams.get("playerSolution"),
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Missing gameId or playerSolution" },
        { status: 400 }
      );
    }

    const { gameId, playerSolution } = parseResult.data;

    const game = await Game.findById(gameId);
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const checkResult = game.solution === playerSolution;
    let mismatches: number[] = [];

    if (checkResult) {
      await Game.findByIdAndUpdate(gameId, { date_solve: new Date() });
    } else {
      mismatches = findMismatches(game.solution, playerSolution);
    }

    return NextResponse.json({
      checkResult,
      compliment: game.compliment,
      mismatches,
    });
  } catch (error) {
    console.error("Error checking answer:", error);
    return NextResponse.json(
      { error: "Error checking answer" },
      { status: 500 }
    );
  }
}
