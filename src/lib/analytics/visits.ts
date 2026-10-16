import type { HydratedDocument } from "mongoose";
import { Visit, type IVisit } from "@/lib/db/models/visit";

// A visit ends after this long with no activity; the next activity starts a
// new one. Same rule as most web analytics tools.
export const VISIT_TIMEOUT_MS = 30 * 60 * 1000;

export interface VisitSource {
  referrer?: string;
  utmSource?: string;
}

// Extends the visitor's current visit, or starts a new one if the last was
// idle too long. Source info is only recorded on a visit's first event.
export async function touchVisit(
  visitorId: string,
  source: VisitSource = {},
  now = new Date()
): Promise<HydratedDocument<IVisit>> {
  const current = await Visit.findOneAndUpdate(
    { visitorId, lastSeenAt: { $gte: new Date(now.getTime() - VISIT_TIMEOUT_MS) } },
    { lastSeenAt: now },
    { sort: { lastSeenAt: -1 }, returnDocument: "after" }
  );
  if (current) return current;

  return Visit.create({ visitorId, startedAt: now, lastSeenAt: now, ...source });
}
