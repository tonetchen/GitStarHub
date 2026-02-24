/**
 * AI Search API Route
 * Provides AI-powered semantic search for starred repositories
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { streamText } from 'ai';
import { authOptions } from '@/lib/auth';
import { getUserRepositories, getAiSettings } from '@/lib/db';
import {
  isAIConfigured,
  getDefaultModel,
  RepositoryForAI,
} from '@/lib/ai';

// Create OpenAI-compatible client
function createOpenAIClient() {
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  return {
    baseURL,
    apiKey,
  };
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if AI is configured
    if (!isAIConfigured()) {
      return new Response(JSON.stringify({ error: 'AI search is not configured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userId = parseInt(session.user.id, 10);
    const body = await request.json();
    const { query, model } = body;

    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get user's preferred model or use default
    const aiSettings = await getAiSettings(userId);
    const modelName = model || getDefaultModel(aiSettings?.preferred_model);

    // Get user repositories
    const repositories = await getUserRepositories(userId, { limit: 100 });

    if (repositories.length === 0) {
      return new Response(JSON.stringify({ results: [], message: 'No repositories found' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Transform repositories for AI context
    const reposForAI: RepositoryForAI[] = repositories.map((repo: any) => ({
      id: repo.id,
      repo_name: repo.repo_name,
      owner_login: repo.owner_login,
      repo_full_name: repo.repo_full_name,
      description: repo.description,
      language: repo.language,
      stargazers_count: repo.stargazers_count,
      topics: repo.topics,
      html_url: repo.html_url,
    }));

    // Create OpenAI client config
    const clientConfig = createOpenAIClient();

    // Build repository context for AI
    const repoContext = reposForAI
      .slice(0, 50)
      .map((repo, index) => {
        const topics = repo.topics?.length ? `Topics: ${repo.topics.join(', ')}` : '';
        return `${index + 1}. ${repo.repo_full_name}
   Language: ${repo.language || 'Unknown'}
   Stars: ${repo.stargazers_count}
   Description: ${repo.description || 'No description'}
   ${topics}`;
      })
      .join('\n\n');

    const systemPrompt = `You are an intelligent repository search assistant. Your task is to help users find the most relevant repositories from their starred list based on their search query.

For each relevant repository you find, provide:
1. The repository full name (owner/repo)
2. A brief explanation of why it matches the query

Focus on:
- Semantic meaning and intent, not just keyword matching
- Technical relevance (programming language, framework, purpose)
- Project topics and categories

Be concise but informative. If no repositories are relevant, say so clearly.`;

    const userPrompt = `Search Query: "${query}"

Available Repositories:
${repoContext}

Based on the search query, identify the most relevant repositories and explain why each matches. Format your response as a helpful list.`;

    // Use fetch directly for streaming
    const response = await fetch(`${clientConfig.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clientConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('AI API error:', error);
      return new Response(JSON.stringify({ error: 'AI search failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create a transform stream to convert the AI response
    const encoder = new TextEncoder();
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

            if (done) {
              controller.close();
              break;
            }

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
                    // Forward the SSE event
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
    console.error('AI search error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to perform AI search' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
