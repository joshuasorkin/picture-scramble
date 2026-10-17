import { Game } from "@/lib/db/models/game";

// A round starts when a game is shown to a player. Preloaded games that are
// never shown keep no date_start, so they are not counted as rounds.
// Only the first start counts, so a replayed event cannot move a round to
// another visitor or day.
export async function recordGameStart(
  gameId: string,
  visitorId: string,
  visitId: string
): Promise<boolean> {
  const result = await Game.updateOne(
    { _id: gameId, date_start: { $exists: false } },
    { date_start: new Date(), visitorId, visitId }
  );
  return result.modifiedCount > 0;
}

// Auto-submitted solves are detected client-side, so the server only hears
// about them here. The solution is checked so a solve cannot be faked.
// solveSeconds comes from the client's timer and is not checked.
export async function recordGameSolve(
  gameId: string,
  solution: string,
  solveSeconds?: number
): Promise<boolean> {
  const result = await Game.updateOne(
    { _id: gameId, solution, date_solve: { $exists: false } },
    { date_solve: new Date(), solveSeconds }
  );
  return result.modifiedCount > 0;
}

// Each tap of the Share button counts, including repeat shares of one game.
export async function recordGameShare(gameId: string): Promise<boolean> {
  const result = await Game.updateOne({ _id: gameId }, { $inc: { shareCount: 1 } });
  return result.modifiedCount > 0;
}

// The player hid the page (switched tabs, minimized, or closed it) during an
// unsolved round. activeSeconds is the visible time so far, from the client.
export async function recordGameHide(
  gameId: string,
  activeSeconds?: number
): Promise<boolean> {
  const result = await Game.updateOne(
    {
      _id: gameId,
      date_start: { $exists: true },
      date_solve: { $exists: false },
      date_skip: { $exists: false },
    },
    { $set: { date_hidden: new Date(), activeSeconds }, $inc: { hideCount: 1 } }
  );
  return result.modifiedCount > 0;
}

// The player tapped Skip on an unsolved round. Only the first skip counts.
export async function recordGameSkip(
  gameId: string,
  activeSeconds?: number
): Promise<boolean> {
  const result = await Game.updateOne(
    {
      _id: gameId,
      date_start: { $exists: true },
      date_solve: { $exists: false },
      date_skip: { $exists: false },
    },
    { date_skip: new Date(), activeSeconds }
  );
  return result.modifiedCount > 0;
}
