import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sql } from "@vercel/postgres";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(session.user.id, 10);
    const { id } = await params;
    const repoId = parseInt(id, 10);

    if (isNaN(repoId)) {
      return NextResponse.json(
        { error: "Invalid repository ID" },
        { status: 400 }
      );
    }

    // Get repository from database
    const result = await sql`
      SELECT *
      FROM starred_repositories
      WHERE id = ${repoId} AND user_id = ${userId}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Repository not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      repository: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching repository details:", error);
    return NextResponse.json(
      { error: "Failed to fetch repository details" },
      { status: 500 }
    );
  }
}
