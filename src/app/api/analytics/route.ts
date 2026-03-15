import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { event, data, path } = body as {
      event?: string;
      data?: Record<string, unknown>;
      path?: string;
    };

    if (!event || typeof event !== "string") {
      return NextResponse.json({ error: "Missing event" }, { status: 400 });
    }

    // Read user ID from session (optional — guests can track too)
    let userId: string | null = null;
    try {
      const session = await auth();
      userId = session?.user?.id ?? null;
    } catch {
      // No session — guest user, continue without userId
    }

    // Use provided path or fall back to referer header
    const eventPath = path || req.headers.get("referer") || null;

    // Fire and forget — store in database
    prisma.analyticsEvent
      .create({
        data: {
          userId,
          event,
          data: data ? JSON.stringify(data) : null,
          path: eventPath,
        },
      })
      .catch(() => {
        // Silently fail — analytics should never break anything
      });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
