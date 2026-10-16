import { z } from "zod";
import { addDays, isValidDay, isValidTimezone, todayIn } from "@/lib/analytics/dates";

export const DEFAULT_STATS_TIMEZONE = "America/Los_Angeles";
export const DEFAULT_STATS_DAYS = 14;
const MAX_STATS_DAYS = 366;

const rangeSchema = z
  .object({
    from: z.string().refine(isValidDay, "from must be YYYY-MM-DD").optional(),
    to: z.string().refine(isValidDay, "to must be YYYY-MM-DD").optional(),
    tz: z.string().refine(isValidTimezone, "Unknown timezone").default(DEFAULT_STATS_TIMEZONE),
  })
  .transform(({ from, to, tz }, ctx) => {
    const end = to ?? todayIn(tz);
    const start = from ?? addDays(end, -(DEFAULT_STATS_DAYS - 1));
    if (start > end) {
      ctx.addIssue({ code: "custom", message: "from must not be after to" });
      return z.NEVER;
    }
    if (start < addDays(end, -(MAX_STATS_DAYS - 1))) {
      ctx.addIssue({ code: "custom", message: `Range is limited to ${MAX_STATS_DAYS} days` });
      return z.NEVER;
    }
    return { from: start, to: end, timezone: tz };
  });

export type StatsRange = z.output<typeof rangeSchema>;

// Reads ?from=&to=&tz= (all optional). Defaults to the last 14 days,
// today included, in Pacific time.
export function parseStatsRange(params: {
  from?: string | null;
  to?: string | null;
  tz?: string | null;
}) {
  return rangeSchema.safeParse({
    from: params.from || undefined,
    to: params.to || undefined,
    tz: params.tz || undefined,
  });
}

export function isStatsKey(key: string | null | undefined): boolean {
  const statsKey = process.env.STATS_KEY;
  return !!statsKey && key === statsKey;
}
