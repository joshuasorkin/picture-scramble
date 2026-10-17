import type { StatsRow } from "@/lib/analytics/stats";
import { formatAverage, formatCount } from "./format";

export interface Metric {
  key:
    | "visitors"
    | "visitsPerVisitor"
    | "roundsPerVisitor"
    | "solvedPerVisitor"
    | "shares"
    | "sharedPlayed"
    | "shareVisits";
  label: string;
  tab: string;
  format: (n: number) => string;
}

export const METRICS: Metric[] = [
  { key: "visitors", label: "Unique visitors", tab: "Visitors", format: formatCount },
  { key: "visitsPerVisitor", label: "Visits per visitor", tab: "Visits", format: formatAverage },
  {
    key: "roundsPerVisitor",
    label: "Puzzles played per visitor",
    tab: "Puzzles played",
    format: formatAverage,
  },
  {
    key: "solvedPerVisitor",
    label: "Puzzles solved per visitor",
    tab: "Puzzles solved",
    format: formatAverage,
  },
  { key: "shares", label: "Shares", tab: "Shares", format: formatCount },
  {
    key: "sharedPlayed",
    label: "Shared puzzles played",
    tab: "Shared played",
    format: formatCount,
  },
  { key: "shareVisits", label: "Visits from share links", tab: "Share visits", format: formatCount },
];

export function metricValue(row: StatsRow, metric: Metric): number {
  return row[metric.key];
}
