import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connectToDatabase } from "@/lib/db/connection";
import { getStats } from "@/lib/analytics/stats";
import { isStatsKey, parseStatsRange } from "@/lib/analytics/stats-range";
import StatsDashboard from "@/components/stats/StatsDashboard";
import "./stats.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stats · Utu's Wild Words",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StatsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const key = param(params.key);
  // 404 rather than 401, so the page does not advertise that it exists.
  if (!isStatsKey(key)) notFound();

  const requested = parseStatsRange({
    from: param(params.from),
    to: param(params.to),
    tz: param(params.tz),
  });
  const range = requested.success ? requested.data : parseStatsRange({}).data!;
  const error = requested.success
    ? undefined
    : requested.error.issues.map((i) => i.message).join("; ");

  await connectToDatabase();
  const stats = await getStats(range.from, range.to, range.timezone);

  return (
    <div className="stats-root">
      <StatsDashboard stats={stats} statsKey={key!} error={error} />
    </div>
  );
}
