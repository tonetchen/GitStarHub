import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Hardcoded model - no database
const HARDCODED_MODEL = "deepseek-chat";

// List of supported AI models
const SUPPORTED_MODELS = [
  "deepseek-chat",
  "glm-4",
  "glm-4-flash",
  "gpt-4",
  "gpt-3.5-turbo",
  "claude-3",
];

/**
 * GET /api/settings/ai
 * Get user's AI settings (hardcoded)
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Return hardcoded model
    return NextResponse.json({
      preferredModel: HARDCODED_MODEL,
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
 * Update user's AI settings (no-op, always returns hardcoded model)
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const preferredModel = body.preferredModel ?? HARDCODED_MODEL;

    // Validate model is supported
    if (!SUPPORTED_MODELS.includes(preferredModel)) {
      return NextResponse.json(
        { error: `Unsupported model. Supported models: ${SUPPORTED_MODELS.join(", ")}` },
        { status: 400 }
      );
    }

    // Always return hardcoded model (no database update)
    return NextResponse.json({
      success: true,
      preferredModel: HARDCODED_MODEL,
    });
  } catch (error) {
    console.error("Error updating AI settings:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to update AI settings", details: errorMessage },
      { status: 500 }
    );
  }
}
