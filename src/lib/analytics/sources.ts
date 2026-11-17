import { Game } from "@/lib/db/models/game";
import { Visit } from "@/lib/db/models/visit";
import { addDays } from "@/lib/analytics/dates";

// Where a visit came from: its ?utm_source= if it had one, otherwise the
// referring site's hostname, otherwise "direct".
export type SourceKind = "utm" | "referrer" | "direct";

export interface SourceRow {
  source: string;
  kind: SourceKind;
  visitors: number;
  visits: number;
  rounds: number; // rounds shown during this source's visits
  solved: number;
  roundsPerVisitor: number;
  solvedPerVisitor: number;
}

interface SourceKey {
  source: string;
  kind: SourceKind;
}

const sourceKey = (key: SourceKey) => `${key.kind}:${key.source}`;

// Visits, visitors, rounds and solves for each source of the visits that
// started from `from` to `to` (inclusive, YYYY-MM-DD in `timezone`), most
// visitors first. Rounds count toward the visit they were shown in. A visitor
// who came from several sources counts once under each.
export async function getSources(
  from: string,
  to: string,
  timezone: string
): Promise<SourceRow[]> {
  // A UTC window wide enough to cover any timezone; exact day bounds are
  // applied after converting timestamps to local days.
  const window = {
    $gte: new Date(`${addDays(from, -1)}T00:00:00Z`),
    $lt: new Date(`${addDays(to, 2)}T00:00:00Z`),
  };
  const inRange = (date: string) => ({
    $let: {
      vars: { day: { $dateToString: { format: "%Y-%m-%d", date, timezone } } },
      in: { $and: [{ $gte: ["$$day", from] }, { $lte: ["$$day", to] }] },
    },
  });
  const source = (visit: string) => ({
    source: { $ifNull: [`${visit}utmSource`, `${visit}referrer`, "direct"] },
    kind: {
      $cond: [
        { $ifNull: [`${visit}utmSource`, false] },
        "utm",
        { $cond: [{ $ifNull: [`${visit}referrer`, false] }, "referrer", "direct"] },
      ],
    },
  });

  const [visits, rounds] = await Promise.all([
    Visit.aggregate<SourceKey & { visitors: number; visits: number }>([
      { $match: { startedAt: window } },
      { $match: { $expr: inRange("$startedAt") } },
      {
        $group: {
          _id: source("$"),
          visitors: { $addToSet: "$visitorId" },
          visits: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          source: "$_id.source",
          kind: "$_id.kind",
          visitors: { $size: "$visitors" },
          visits: 1,
        },
      },
    ]),
    // A round can't start before its visit, and visits are short, so rounds
    // in the same wide window cover every visit that started in the range.
    Game.aggregate<SourceKey & { rounds: number; solved: number }>([
      { $match: { date_start: window, visitId: { $type: "string" } } },
      {
        $addFields: {
          visitObjectId: { $convert: { input: "$visitId", to: "objectId", onError: null } },
        },
      },
      {
        $lookup: {
          from: Visit.collection.collectionName,
          localField: "visitObjectId",
          foreignField: "_id",
          as: "visit",
        },
      },
      { $unwind: "$visit" },
      { $match: { $expr: inRange("$visit.startedAt") } },
      {
        $group: {
          _id: source("$visit."),
          rounds: { $sum: 1 },
          solved: { $sum: { $cond: [{ $ifNull: ["$date_solve", false] }, 1, 0] } },
        },
      },
      { $project: { _id: 0, source: "$_id.source", kind: "$_id.kind", rounds: 1, solved: 1 } },
    ]),
  ]);

  const roundsBySource = new Map(rounds.map((r) => [sourceKey(r), r]));

  return visits
    .map(({ source, kind, visitors, visits }) => {
      const { rounds = 0, solved = 0 } = roundsBySource.get(sourceKey({ source, kind })) ?? {};
      const per = (n: number) => (visitors ? n / visitors : 0);
      return {
        source,
        kind,
        visitors,
        visits,
        rounds,
        solved,
        roundsPerVisitor: per(rounds),
        solvedPerVisitor: per(solved),
      };
    })
    .sort((a, b) => b.visitors - a.visitors || b.visits - a.visits || a.source.localeCompare(b.source));
}
