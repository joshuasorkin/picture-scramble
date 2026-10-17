import { isValidObjectId, type HydratedDocument } from "mongoose";
import { Game, type IGame } from "@/lib/db/models/game";

/**
 * Create a new game with the same puzzle as a shared one, so the receiver's
 * round is tracked separately from the sharer's. Returns null if the shared
 * game does not exist.
 */
export async function copySharedGame(
  sourceId: string
): Promise<HydratedDocument<IGame> | null> {
  if (!isValidObjectId(sourceId)) {
    return null;
  }
  const source = await Game.findById(sourceId);
  if (!source) {
    return null;
  }

  return Game.create({
    language: source.language,
    topic: source.topic,
    solution: source.solution,
    solutionHash: source.solutionHash,
    scramble: source.scramble,
    picture: source.picture,
    compliment: source.compliment,
    contact: source.contact,
    date_create: new Date(),
    // Point at the original puzzle, so a share of a share credits the first
    sharedFrom: source.sharedFrom ?? source.id,
  });
}
