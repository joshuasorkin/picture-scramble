import { Visit } from "@/lib/db/models/visit";
import { addDays, daysInRange, todayIn } from "@/lib/analytics/dates";

// Return windows, in days after a visitor's first day: D1 is the next day
// only; D7 and D30 are any day from the next day through D+7 / D+30.
export const RETURN_WINDOWS = { d1: 1, d7: 7, d30: 30 } as const;
export type ReturnWindow = keyof typeof RETURN_WINDOWS;

export interface ReturnRate {
  visitors: number; // visitors in cohorts whose window has fully passed
  returned: number; // of those, visitors with a visit in the window
  rate: number; // returned / visitors, 0 when there are no visitors
}

export interface RetentionCohort {
  date: string; // first day of every visitor in the cohort
  visitors: number;
  // null until the window has fully passed (its last day is before today)
  d1: ReturnRate | null;
  d7: ReturnRate | null;
  d30: ReturnRate | null;
}

export interface Retention {
  cohorts: RetentionCohort[]; // every day in the range, oldest first
  // Pooled over the cohorts whose window has fully passed, or null if none has
  total: Record<ReturnWindow, ReturnRate | null>;
}

function returnRate(visitors: number, returned: number): ReturnRate {
  return { visitors, returned, rate: visitors ? returned / visitors : 0 };
}

// D1 / D7 / D30 return rate for visitors whose first day (the local day of
// their earliest visit, over all time) falls from `from` to `to`. `now` sets
// "today", so a cohort's figure stays null until its window has fully passed.
export async function getRetention(
  from: string,
  to: string,
  timezone: string,
  now = new Date()
): Promise<Retention> {
  const today = todayIn(timezone, now);
  const localDay = (date: string) => ({
    $dateToString: { format: "%Y-%m-%d", date, timezone },
  });

  const visitors = await Visit.aggregate<{ firstDay: string; days: string[] }>([
    {
      $group: {
        _id: "$visitorId",
        first: { $min: "$startedAt" },
        days: { $addToSet: localDay("$startedAt") },
      },
    },
    { $project: { _id: 0, firstDay: localDay("$first"), days: 1 } },
    { $match: { firstDay: { $gte: from, $lte: to } } },
  ]);

  const counts = new Map<string, { visitors: number } & Record<ReturnWindow, number>>();
  for (const { firstDay, days } of visitors) {
    const c = counts.get(firstDay) ?? { visitors: 0, d1: 0, d7: 0, d30: 0 };
    c.visitors++;
    const next = addDays(firstDay, 1);
    for (const [window, n] of Object.entries(RETURN_WINDOWS) as [ReturnWindow, number][]) {
      const last = addDays(firstDay, n);
      if (days.some((d) => d >= next && d <= last)) c[window]++;
    }
    counts.set(firstDay, c);
  }

  const totals = { d1: returnRate(0, 0), d7: returnRate(0, 0), d30: returnRate(0, 0) };
  const complete = { d1: false, d7: false, d30: false };

  const cohorts = daysInRange(from, to).map((date) => {
    const c = counts.get(date) ?? { visitors: 0, d1: 0, d7: 0, d30: 0 };
    const figure = (window: ReturnWindow) => {
      if (addDays(date, RETURN_WINDOWS[window]) >= today) return null;
      complete[window] = true;
      totals[window].visitors += c.visitors;
      totals[window].returned += c[window];
      return returnRate(c.visitors, c[window]);
    };
    return { date, visitors: c.visitors, d1: figure("d1"), d7: figure("d7"), d30: figure("d30") };
  });

  const total = (window: ReturnWindow) =>
    complete[window] ? returnRate(totals[window].visitors, totals[window].returned) : null;

  return { cohorts, total: { d1: total("d1"), d7: total("d7"), d30: total("d30") } };
}
