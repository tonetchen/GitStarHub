import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserRepositories } from "@/lib/db";

interface SearchResult {
  id: number;
  repo_name: string;
  owner_login: string;
  repo_full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  relevanceReason?: string;
}

interface RepoData {
  id: number;
  repo_name: string;
  owner_login: string;
  repo_full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  topics: string[] | null;
}

interface ScoredResult extends SearchResult {
  score: number;
}

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(session.user.id, 10);
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    // Get all user repositories (limit to 1000 for contextual search)
    const repositories = await getUserRepositories(userId, { limit: 1000 });

    if (repositories.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Try AI search first if API key is configured
    const apiKey = process.env.GLM_API_KEY || process.env.OPENAI_API_KEY;
    const baseURL = process.env.GLM_API_KEY ? "https://open.bigmodel.cn/api/paas/v4" : (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1");
    let defaultModel = "gpt-4o-mini";
    if (baseURL.includes("bigmodel.cn")) {
      defaultModel = "glm-4";
    }
    const model = process.env.GLM_API_KEY ? "glm-4" : (process.env.OPENAI_MODEL || defaultModel); // fallback model
    
    if (apiKey) {
      try {
        // Build a massive compact repository context to feed into AI
        const repoContext = (repositories as RepoData[])
          .map((repo) => {
            const topics = repo.topics?.length ? `|Topics:${repo.topics.join(',')}` : '';
            return `ID:${repo.id}|Name:${repo.repo_full_name}|Desc:${(repo.description || '').slice(0, 100)}${topics}`;
          })
          .join('\n');

        const systemPrompt = `You are an intelligent repository search assistant. Find the most relevant repositories from the provided list based on the user's search query.
Focus on semantic meaning and intent, not just exact keyword matching (e.g., if user asks for "intelligent agent", recommend langchain, autogen, etc.).
IMPORTANT: You MUST return ONLY a valid JSON array. Each object in the array must have:
- "id": the numeric ID of the matching repository
- "relevanceReason": a brief, precise explanation in the user's language of why it matches (max 15 words)
If no repositories are relevant, return [].`;

        const userPrompt = `Search Query: "${query}"

Available Repositories (Format: ID|Name|Desc|Topics):
${repoContext}

Respond ONLY with the JSON array of up to 10 most relevant matches.`;

        const response = await fetch(`${baseURL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.1,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || "[]";
          
          // Try to parse JSON from the response
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]) as Array<any>;
            
            // Map the parsed IDs back to actual repository objects
            const aiResults = parsed
              .map(item => {
                // GLM sometimes hallucinates keys like "ID" instead of "id"
                const rawId = item.id || item.ID || item.Id;
                const rawReason = item.relevanceReason || item.RelevanceReason || item.reason || "AI matched";
                
                const repo = (repositories as RepoData[]).find(r => r.id === Number(rawId));
                if (repo) {
                  return {
                    id: repo.id,
                    repo_name: repo.repo_name,
                    owner_login: repo.owner_login,
                    repo_full_name: repo.repo_full_name,
                    description: repo.description,
                    language: repo.language,
                    stargazers_count: repo.stargazers_count,
                    relevanceReason: rawReason,
                  };
                }
                return null;
              })
              .filter(Boolean) as SearchResult[];

            if (aiResults.length > 0) {
              return NextResponse.json({ results: aiResults });
            }
          }
        } else {
          console.error("AI enhancement failed, HTTP status:", response.status, await response.text());
        }
      } catch (error) {
        console.error("AI search crashed, falling back to basic search:", error);
      }
    }

    // Fallback: Simple keyword matching search
    const queryLower = query.toLowerCase();
    
    // Split on whitespace or any individual Chinese character to properly handle Chinese sentences
    const queryTerms = queryLower
      .replace(/[\u4e00-\u9fa5]/g, ' $& ') // Add spaces around Chinese characters
      .split(/\s+/)
      .filter(t => t.length > 0 && !["我", "想", "要", "的", "有", "么", "个", "这", "那", "是", "在"].includes(t)); // Basic stop words filter

    const results: SearchResult[] = (repositories as RepoData[])
      .map((repo) => {
        let score = 0;
        const reasons: string[] = [];

        const nameMatch = repo.repo_name?.toLowerCase() || "";
        const descMatch = repo.description?.toLowerCase() || "";
        const topics = repo.topics || [];
        const language = repo.language?.toLowerCase() || "";

        // Check each term
        for (const term of queryTerms) {
          // Name match (highest priority)
          if (nameMatch.includes(term)) {
            score += 10;
            reasons.push(`Name matches "${term}"`);
          }

          // Description match
          if (descMatch.includes(term)) {
            score += 5;
            if (!reasons.length) reasons.push(`Description matches "${term}"`);
          }

          // Topics match
          if (topics.some((t) => t.toLowerCase().includes(term))) {
            score += 3;
            if (!reasons.length) reasons.push(`Has related topic`);
          }

          // Language match
          if (language.includes(term)) {
            score += 2;
            if (!reasons.length) reasons.push(`${repo.language} repository`);
          }
        }

        return {
          id: repo.id,
          repo_name: repo.repo_name,
          owner_login: repo.owner_login,
          repo_full_name: repo.repo_full_name,
          description: repo.description,
          language: repo.language,
          stargazers_count: repo.stargazers_count,
          score,
          relevanceReason: reasons[0] || "Matches your search",
        };
      })
      .filter((repo) => repo.score > 0)
      .sort((a: ScoredResult, b: ScoredResult) => b.score - a.score)
      .slice(0, 10)
      .map((repo: ScoredResult): SearchResult => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { score: _, ...result } = repo;
        return result;
      });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to search repositories" },
      { status: 500 }
    );
  }
}
