import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSyncSettings, updateSyncSettings } from "@/lib/db";

/**
 * GET /api/settings/sync
 * Get user's sync settings
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(session.user.id, 10);
    const settings = await getSyncSettings(userId);

    // Return default settings if none exist
    return NextResponse.json({
      syncEnabled: settings?.sync_enabled ?? true,
      syncIntervalMinutes: settings?.sync_interval_minutes ?? 120,
      lastSyncAt: settings?.last_sync_at ?? null,
    });
  } catch (error) {
    console.error("Error fetching sync settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch sync settings" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/sync
 * Update user's sync settings
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(session.user.id, 10);
    const body = await request.json();

    // Validate input
    const syncEnabled = body.syncEnabled ?? true;
    const syncIntervalMinutes = body.syncIntervalMinutes ?? 120;

    // Validate sync interval (minimum 30 minutes, maximum 1440 minutes / 24 hours)
    if (
      typeof syncIntervalMinutes !== "number" ||
      syncIntervalMinutes < 30 ||
      syncIntervalMinutes > 1440
    ) {
      return NextResponse.json(
        { error: "Sync interval must be between 30 and 1440 minutes" },
        { status: 400 }
      );
    }

    // Update settings
    await updateSyncSettings(userId, {
      syncEnabled,
      syncIntervalMinutes,
    });

    // Fetch and return updated settings
    const updatedSettings = await getSyncSettings(userId);

    return NextResponse.json({
      success: true,
      syncEnabled: updatedSettings?.sync_enabled ?? syncEnabled,
      syncIntervalMinutes: updatedSettings?.sync_interval_minutes ?? syncIntervalMinutes,
      lastSyncAt: updatedSettings?.last_sync_at ?? null,
    });
  } catch (error) {
    console.error("Error updating sync settings:", error);
    return NextResponse.json(
      { error: "Failed to update sync settings" },
      { status: 500 }
    );
  }
}
