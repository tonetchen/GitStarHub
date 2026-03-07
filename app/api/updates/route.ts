import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserUpdates, getUserUpdatesCount } from "@/lib/db";

export interface UpdateItem {
  id: number;
  repo_id: number;
  update_type: "commit" | "issue" | "pr" | "release" | "readme";
  title: string;
  description: string | null;
  url: string;
  author: string;
  detected_at: string;
  is_read: boolean;
  repo_name: string;
  repo_full_name: string;
  owner_login: string;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(session.user.id, 10);
    const { searchParams } = new URL(request.url);

    // Pagination parameters
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const offset = (page - 1) * limit;

    // Filter parameters
    const updateType = searchParams.get("type") || undefined;
    const unreadOnly = searchParams.get("unread") === "true";

    // Validate update type
    const validTypes = ["commit", "issue", "pr", "release", "readme"];
    const filterType = updateType && validTypes.includes(updateType) ? updateType : undefined;

    const updates = await getUserUpdates(userId, {
      limit,
      offset,
      updateType: filterType,
      unreadOnly,
      todayOnly: true,
    });

    // Get accurate count from db
    const counts = await getUserUpdatesCount(userId, { unreadOnly, todayOnly: true });
    const total = filterType ? (counts.byType[filterType] || 0) : counts.total;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      updates: updates as UpdateItem[],
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      counts: counts.byType,
    });
  } catch (error) {
    console.error("Error fetching updates:", error);
    return NextResponse.json(
      { error: "Failed to fetch updates" },
      { status: 500 }
    );
  }
}
