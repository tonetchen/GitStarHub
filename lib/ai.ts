/**
 * AI Client Module
 * Provides AI-powered search functionality using OpenAI-compatible API
 */

import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

// Repository data structure for AI context
export interface RepositoryForAI {
  id: number;
  repo_name: string;
  owner_login: string;
  repo_full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  topics: string[] | null;
  html_url: string;
}

// AI search result
export interface AISearchResult {
  repo_id: number;
  repo_full_name: string;
  relevance_reason: string;
}

// Create OpenAI-compatible client
function createAIClient(baseURL?: string, apiKey?: string) {
  const baseUrl = baseURL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const key = apiKey || process.env.OPENAI_API_KEY;

  if (!key) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  return createOpenAI({
    baseURL: baseUrl,
    apiKey: key,
  });
}

/**
 * Search repositories using AI
 * @param query - User's search query
 * @param repositories - List of repositories to search from
 * @param modelName - AI model to use (e.g., 'gpt-4', 'glm-4')
 * @returns Streamed AI response
 */
export async function searchWithAI(
  query: string,
  repositories: RepositoryForAI[],
  modelName: string = 'glm-4'
) {
  const client = createAIClient();

  // Build repository context for AI
  const repoContext = repositories
    .slice(0, 50) // Limit to 50 repositories to avoid token limits
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

  const result = streamText({
    model: client(modelName),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    maxTokens: 1000,
  });

  return result;
}

/**
 * Get structured search results from AI
 * This returns a parsed response with repository matches
 * @param query - User's search query
 * @param repositories - List of repositories to search from
 * @param modelName - AI model to use
 * @returns Structured search results
 */
export async function getStructuredSearchResults(
  query: string,
  repositories: RepositoryForAI[],
  modelName: string = 'glm-4'
): Promise<AISearchResult[]> {
  const client = createAIClient();

  // Create a map for quick lookup
  const repoMap = new Map<string, RepositoryForAI>();
  repositories.forEach((repo) => {
    repoMap.set(repo.repo_full_name.toLowerCase(), repo);
  });

  // Build simplified context
  const repoList = repositories
    .slice(0, 50)
    .map((repo) => `- ${repo.repo_full_name}: ${repo.description?.slice(0, 100) || 'No description'}`)
    .join('\n');

  const systemPrompt = `You are a repository search engine. Given a search query and a list of repositories, return the most relevant ones.

IMPORTANT: You must respond with ONLY a valid JSON array, no other text. Each item should have:
- "repo_full_name": the exact repository name (owner/repo)
- "relevance_reason": brief explanation (max 15 words)

Example response format:
[{"repo_full_name": "owner/repo", "relevance_reason": "Matches because..."}]

If no repositories match, return: []`;

  const userPrompt = `Query: "${query}"

Repositories:
${repoList}

Return the most relevant repositories as JSON:`;

  const response = await fetch(
    (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1') + '/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '[]';

  try {
    // Try to parse JSON from the response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        repo_full_name: string;
        relevance_reason: string;
      }>;

      // Map back to repository IDs
      return parsed
        .filter((item) => repoMap.has(item.repo_full_name.toLowerCase()))
        .map((item) => {
          const repo = repoMap.get(item.repo_full_name.toLowerCase())!;
          return {
            repo_id: repo.id,
            repo_full_name: repo.repo_full_name,
            relevance_reason: item.relevance_reason,
          };
        });
    }
  } catch (parseError) {
    console.error('Failed to parse AI response:', parseError);
  }

  return [];
}

/**
 * Check if AI is configured
 * @returns true if AI is available
 */
export function isAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Get available AI models
 * @returns List of available model names
 */
export function getAvailableModels(): string[] {
  return ['glm-4', 'glm-4-flash', 'gpt-4', 'gpt-3.5-turbo'];
}

/**
 * Get default model based on configuration
 * @param preferredModel - User's preferred model
 * @returns Model name to use
 */
export function getDefaultModel(preferredModel?: string): string {
  if (preferredModel && getAvailableModels().includes(preferredModel)) {
    return preferredModel;
  }
  return 'glm-4';
}
