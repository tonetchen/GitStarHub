import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAiSettings, updateAiSettings } from "@/lib/db";

// List of supported AI models
const SUPPORTED_MODELS = [
  "glm-4",
  "glm-4-flash",
  "gpt-4",
  "gpt-3.5-turbo",
  "claude-3",
];

/**
 * GET /api/settings/ai
 * Get user's AI settings
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(session.user.id, 10);
    const settings = await getAiSettings(userId);

    // Return default settings if none exist
    return NextResponse.json({
      preferredModel: settings?.preferred_model ?? "glm-4",
    });
  } catch (error) {
    console.error("Error fetching AI settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI settings" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/ai
 * Update user's AI settings
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
    const preferredModel = body.preferredModel ?? "glm-4";

    // Validate model is supported
    if (!SUPPORTED_MODELS.includes(preferredModel)) {
      return NextResponse.json(
        { error: `Unsupported model. Supported models: ${SUPPORTED_MODELS.join(", ")}` },
        { status: 400 }
      );
    }

    // Update settings
    await updateAiSettings(userId, {
      preferredModel,
    });

    // Fetch and return updated settings
    const updatedSettings = await getAiSettings(userId);

    return NextResponse.json({
      success: true,
      preferredModel: updatedSettings?.preferred_model ?? preferredModel,
    });
  } catch (error) {
    console.error("Error updating AI settings:", error);
    return NextResponse.json(
      { error: "Failed to update AI settings" },
      { status: 500 }
    );
  }
}
