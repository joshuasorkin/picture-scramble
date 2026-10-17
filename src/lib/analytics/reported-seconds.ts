import { z } from "zod";

// A time in seconds reported by the client. A missing or invalid value is
// dropped rather than rejected, so it never blocks the event it rides on.
export const reportedSeconds = z
  .number()
  .int()
  .min(0)
  .max(60 * 60 * 24)
  .optional()
  .catch(undefined);
