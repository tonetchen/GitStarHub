import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DEFAULT_AI_MODEL, SUPPORTED_AI_MODELS } from "@/lib/ai-config";

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

    // Return configured default model
    return NextResponse.json({
      preferredModel: DEFAULT_AI_MODEL,
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
    const preferredModel = body.preferredModel ?? DEFAULT_AI_MODEL;

    // Validate model is supported
    if (!SUPPORTED_AI_MODELS.includes(preferredModel)) {
      return NextResponse.json(
        { error: `Unsupported model. Supported models: ${SUPPORTED_AI_MODELS.join(", ")}` },
        { status: 400 }
      );
    }

    // Always return configured default model (no database update)
    return NextResponse.json({
      success: true,
      preferredModel: DEFAULT_AI_MODEL,
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
