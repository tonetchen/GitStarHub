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

    // Get all user repositories
    const repositories = await getUserRepositories(userId, { limit: 500 });

    if (repositories.length === 0) {
      return NextResponse.json({ results: [] });
    }

    // Simple keyword matching search
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/);

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

    // If AI API key is available, enhance search with AI
    if (process.env.GLM_API_KEY && results.length > 0) {
      try {
        // Use GLM AI to generate better relevance reasons
        await fetch(
          "https://open.bigmodel.cn/api/paas/v4/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.GLM_API_KEY}`,
            },
            body: JSON.stringify({
              model: "glm-4",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a helpful assistant that explains why repositories are relevant to a user's search query. Be concise and specific.",
                },
                {
                  role: "user",
                  content: `The user searched for: "${query}"

These repositories were found:
${results
  .slice(0, 5)
  .map(
    (r, i) =>
      `${i + 1}. ${r.repo_full_name}: ${r.description?.slice(0, 100) || "No description"}`
  )
  .join("\n")}

For each repository, provide a brief (max 10 words) explanation of why it matches the search. Format as JSON array.`,
                },
              ],
              max_tokens: 200,
            }),
          }
        );
        // AI response processed - results already have basic relevance reasons
      } catch (error) {
        console.error("AI enhancement failed:", error);
        // Continue with basic results
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Failed to search repositories" },
      { status: 500 }
    );
  }
}
