import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserUpdates } from "@/lib/db";

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

    // Get updates from database
    const updates = await getUserUpdates(userId, {
      limit,
      offset,
      updateType: filterType,
      unreadOnly,
    });

    // For now, we don't have total count from getUserUpdates
    // In a production app, you would want to add a count query
    const total = updates.length < limit ? offset + updates.length : offset + limit + 1;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      updates: updates as UpdateItem[],
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching updates:", error);
    return NextResponse.json(
      { error: "Failed to fetch updates" },
      { status: 500 }
    );
  }
}
