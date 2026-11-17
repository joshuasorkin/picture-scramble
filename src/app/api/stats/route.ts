import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connection";
import { getStats } from "@/lib/analytics/stats";
import { getRetention } from "@/lib/analytics/retention";
import { getSources } from "@/lib/analytics/sources";
import { isStatsKey, parseStatsRange } from "@/lib/analytics/stats-range";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    if (!isStatsKey(searchParams.get("key"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parseResult = parseStatsRange({
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      tz: searchParams.get("tz"),
    });
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues.map((i) => i.message).join("; ") },
        { status: 400 }
      );
    }

    const { from, to, timezone } = parseResult.data;

    await connectToDatabase();
    const [stats, retention, sources] = await Promise.all([
      getStats(from, to, timezone),
      getRetention(from, to, timezone),
      getSources(from, to, timezone),
    ]);
    return NextResponse.json({ ...stats, retention, sources });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Error fetching stats" },
      { status: 500 }
    );
  }
}
