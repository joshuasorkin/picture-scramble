import type { StatsRow } from "@/lib/analytics/stats";
import { formatAverage, formatCount } from "./format";

export interface Metric {
  key: "visitors" | "visitsPerVisitor" | "roundsPerVisitor" | "solvedPerVisitor";
  label: string;
  format: (n: number) => string;
}

export const METRICS: Metric[] = [
  { key: "visitors", label: "Unique visitors", format: formatCount },
  { key: "visitsPerVisitor", label: "Visits per visitor", format: formatAverage },
  { key: "roundsPerVisitor", label: "Puzzles played per visitor", format: formatAverage },
  { key: "solvedPerVisitor", label: "Puzzles solved per visitor", format: formatAverage },
];

export function metricValue(row: StatsRow, metric: Metric): number {
  return row[metric.key];
}
