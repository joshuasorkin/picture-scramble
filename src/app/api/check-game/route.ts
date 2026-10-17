import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/connection";
import { Game } from "@/lib/db/models/game";
import { findMismatches } from "@/lib/game/mismatches";
import { reportedSeconds } from "@/lib/analytics/reported-seconds";

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
    // Optional; a missing or bad value is dropped and the check goes ahead
    const rawSeconds = searchParams.get("solveSeconds");
    const solveSeconds = reportedSeconds.parse(rawSeconds ? Number(rawSeconds) : undefined);

    const game = await Game.findById(gameId);
    if (!game) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const checkResult = game.solution === playerSolution;
    let mismatches: number[] = [];

    if (checkResult) {
      await Game.findByIdAndUpdate(gameId, { date_solve: new Date(), solveSeconds });
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
