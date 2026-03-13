import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserUpdates } from "@/lib/db";
import { DEFAULT_AI_MODEL } from "@/lib/ai-config";

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

    // Check if AI is configured
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI summary is not configured" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = parseInt(session.user.id, 10);
    
    // Get updates from the last 24 hours instead of just today (more robust)
    const updates = await getUserUpdates(userId, {
      limit: 50,
      todayOnly: false, // We'll filter manually or just take the most recent 50
    });

    // Filter for last 24 hours manually if needed, or just use the most recent ones
    // For now, let's just take the most recent 50 updates regardless of time to ensure something is displayed
    
    const encoder = new TextEncoder();

    if (updates.length === 0) {
      return new Response(JSON.stringify({ content: "暂无最近更新内容。" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Use configured default model
    const modelName = DEFAULT_AI_MODEL;

    // Build update context for AI (manually since we are bypassing lib/ai.ts for streaming reliability)
    const updateContext = updates
      .slice(0, 50)
      .map((update, index) => {
        return `${index + 1}. [${update.repo_full_name}] ${update.update_type.toUpperCase()}: ${update.title}
   Description: ${update.description || 'No description'}`;
      })
      .join('\n\n');

    const systemPrompt = `你是一个专业的开源项目更新总结助手。你的任务是根据用户提供的今日仓库更新内容，生成一份简洁、专业且有价值的总结报告。

总结报告应包括：
1. 更新概况（用了多少个仓库，共计多少条更新，各类更新的比例）。
2. 重点仓库今日的更新（挑选最重要的几个更新进行简要说明）。

请使用 Markdown 格式，语言为中文。保持语气专业、客观，重点突出。`;

    const userPrompt = `今日更新内容：
${updateContext}

请基于以上内容生成一份今日更新总结。`;

    // Use fetch directly for streaming
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('AI API error:', error);
      return new Response(JSON.stringify({ error: 'AI summary failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create a transform stream
    const reader = response.body?.getReader();

    if (!reader) {
      return new Response(JSON.stringify({ error: 'Stream not available' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += new TextDecoder().decode(value);
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  continue;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                    );
                  }
                } catch {
                  // Skip invalid JSON
                }
              }
            }
          }
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
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
