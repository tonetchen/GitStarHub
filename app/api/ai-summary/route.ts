import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserUpdates } from "@/lib/db";
import { isAIConfigured, summarizeTodayUpdates } from "@/lib/ai";
import { DEFAULT_AI_MODEL } from "@/lib/ai-config";

export async function POST(_request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check if AI is configured
    if (!isAIConfigured()) {
      return new Response(JSON.stringify({ error: "AI summary is not configured" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = parseInt(session.user.id, 10);
    
    // Get today's updates
    const updates = await getUserUpdates(userId, {
      limit: 50,
      todayOnly: true,
    });

    if (updates.length === 0) {
      return new Response(JSON.stringify({ content: "今日暂无更新内容。" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Use configured default model
    const modelName = DEFAULT_AI_MODEL;

    // Call AI summarization
    const result = await summarizeTodayUpdates(updates, modelName);

    // Return the stream
    return result.toTextStreamResponse();
  } catch (error) {
    console.error("AI summary error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate AI summary" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
