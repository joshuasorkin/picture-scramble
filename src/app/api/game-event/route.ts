import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db/connection";
import { recordGameStart, recordGameSolve } from "@/lib/analytics/game-events";
import { touchVisit } from "@/lib/analytics/visits";

const VISITOR_COOKIE = "vid";
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const gameId = z.string().regex(/^[0-9a-f]{24}$/);

const bodySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("visit"),
    referrer: z.string().max(2048).optional(),
    utmSource: z.string().max(100).optional(),
  }),
  z.object({ type: z.literal("start"), gameId }),
  z.object({ type: z.literal("solve"), gameId, solution: z.string().min(1) }),
]);

// Keep only the referring site's hostname, and only when it is another site.
function referrerHost(referrer: string | undefined, ownHost: string): string | undefined {
  if (!referrer) return undefined;
  try {
    const host = new URL(referrer).hostname;
    return host && host !== ownHost ? host : undefined;
  } catch {
    return undefined;
  }
}

export async function POST(request: NextRequest) {
  try {
    const parseResult = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid event" }, { status: 400 });
    }
    const event = parseResult.data;

    await connectToDatabase();

    // Anonymous visitor id: a random UUID kept in a first-party cookie.
    const existing = request.cookies.get(VISITOR_COOKIE)?.value;
    const visitorId = z.uuid().safeParse(existing).success
      ? existing!
      : crypto.randomUUID();

    if (event.type === "visit") {
      await touchVisit(visitorId, {
        referrer: referrerHost(event.referrer, request.nextUrl.hostname),
        utmSource: event.utmSource || undefined,
      });
    } else if (event.type === "start") {
      const visit = await touchVisit(visitorId);
      await recordGameStart(event.gameId, visitorId, visit.id);
    } else {
      await touchVisit(visitorId);
      await recordGameSolve(event.gameId, event.solution);
    }

    const response = new NextResponse(null, { status: 204 });
    response.cookies.set(VISITOR_COOKIE, visitorId, {
      maxAge: VISITOR_COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Error recording game event:", error);
    return NextResponse.json(
      { error: "Error recording game event" },
      { status: 500 }
    );
  }
}
