import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserRepositories, getSyncSettings } from "@/lib/db";
import { sql } from "@vercel/postgres";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(session.user.id, 10);
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const language = searchParams.get("language") || undefined;

    // Get repositories from database
    const repositories = await getUserRepositories(userId, {
      limit,
      offset,
      language,
    });

    // Get sync settings for stats
    const syncSettings = await getSyncSettings(userId);

    // Get today's updates count
    const { rows: todayRows } = await sql`
      SELECT COUNT(DISTINCT sr.id) as count 
      FROM repository_updates ru
      JOIN starred_repositories sr ON ru.repo_id = sr.id
      WHERE sr.user_id = ${userId} 
      AND ru.detected_at >= current_date
    `;
    const todayUpdates = parseInt(todayRows[0].count, 10);

    // Get start of week (Sunday)
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // Get weekly active repos count (unique repos with updates this week)
    const { rows: weeklyRows } = await sql`
      SELECT COUNT(DISTINCT sr.id) as count 
      FROM repository_updates ru
      JOIN starred_repositories sr ON ru.repo_id = sr.id
      WHERE sr.user_id = ${userId} 
      AND ru.detected_at >= ${startOfWeek.toISOString()}
    `;
    const weeklyActive = parseInt(weeklyRows[0].count, 10);

    // Calculate stats
    const stats = {
      totalStars: repositories.length,
      weeklyActive,
      todayUpdates,
      lastSync: syncSettings?.last_sync_at || null,
    };

    return NextResponse.json({
      repositories,
      stats,
    });
  } catch (error) {
    console.error("Error fetching repositories:", error);
    return NextResponse.json(
      { error: "Failed to fetch repositories" },
      { status: 500 }
    );
  }
}
