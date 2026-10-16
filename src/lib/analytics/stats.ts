import { Game } from "@/lib/db/models/game";
import { Visit } from "@/lib/db/models/visit";
import { addDays, daysInRange } from "@/lib/analytics/dates";

export interface StatsRow {
  visitors: number;
  visits: number;
  rounds: number;
  solved: number;
  visitsPerVisitor: number;
  roundsPerVisitor: number;
  solvedPerVisitor: number;
}

export interface DayStatsRow extends StatsRow {
  date: string;
}

export interface Stats {
  from: string;
  to: string;
  timezone: string;
  total: StatsRow; // visitors counted once across the whole range
  days: DayStatsRow[]; // every day in the range, oldest first
}

interface Counts {
  visitors: number;
  visits: number;
  rounds: number;
  solved: number;
}

const EMPTY: Counts = { visitors: 0, visits: 0, rounds: 0, solved: 0 };

function withAverages(counts: Counts): StatsRow {
  const per = (n: number) => (counts.visitors ? n / counts.visitors : 0);
  return {
    ...counts,
    visitsPerVisitor: per(counts.visits),
    roundsPerVisitor: per(counts.rounds),
    solvedPerVisitor: per(counts.solved),
  };
}

const countsGroup = {
  visitors: { $addToSet: "$visitorId" },
  visits: { $sum: "$visit" },
  rounds: { $sum: "$round" },
  solved: { $sum: "$solved" },
};

const countsProjection = {
  _id: 0,
  visitors: { $size: "$visitors" },
  visits: 1,
  rounds: 1,
  solved: 1,
};

// Visitors, visits, rounds and solves for each day from `from` to `to`
// (inclusive, YYYY-MM-DD in `timezone`). A visitor is anyone with a visit or
// a round that day. Visits count on the day they start; rounds and their
// solves count on the day the round was shown.
export async function getStats(
  from: string,
  to: string,
  timezone: string
): Promise<Stats> {
  // A UTC window wide enough to cover any timezone; exact day bounds are
  // applied after converting timestamps to local days.
  const window = {
    $gte: new Date(`${addDays(from, -1)}T00:00:00Z`),
    $lt: new Date(`${addDays(to, 2)}T00:00:00Z`),
  };

  const [result] = await Visit.aggregate<{
    days: (Counts & { date: string })[];
    total: Counts[];
  }>([
    { $match: { startedAt: window } },
    {
      $project: {
        visitorId: 1,
        at: "$startedAt",
        visit: { $literal: 1 },
        round: { $literal: 0 },
        solved: { $literal: 0 },
      },
    },
    {
      $unionWith: {
        coll: Game.collection.collectionName,
        pipeline: [
          { $match: { date_start: window, visitorId: { $type: "string" } } },
          {
            $project: {
              visitorId: 1,
              at: "$date_start",
              visit: { $literal: 0 },
              round: { $literal: 1 },
              solved: { $cond: [{ $ifNull: ["$date_solve", false] }, 1, 0] },
            },
          },
        ],
      },
    },
    {
      $addFields: {
        day: { $dateToString: { format: "%Y-%m-%d", date: "$at", timezone } },
      },
    },
    { $match: { day: { $gte: from, $lte: to } } },
    {
      $facet: {
        days: [
          { $group: { _id: "$day", ...countsGroup } },
          { $project: { ...countsProjection, date: "$_id" } },
        ],
        total: [
          { $group: { _id: null, ...countsGroup } },
          { $project: countsProjection },
        ],
      },
    },
  ]);

  const byDay = new Map(result?.days.map((d) => [d.date, d]));

  return {
    from,
    to,
    timezone,
    total: withAverages(result?.total[0] ?? EMPTY),
    days: daysInRange(from, to).map((date) => {
      const { visitors, visits, rounds, solved } = byDay.get(date) ?? EMPTY;
      return { date, ...withAverages({ visitors, visits, rounds, solved }) };
    }),
  };
}
