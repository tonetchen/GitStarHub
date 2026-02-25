import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  saveRepository,
  updateSyncSettings,
} from "@/lib/db";

// GitHub API types
interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  topics: string[];
  owner: {
    login: string;
    avatar_url: string;
  };
}

export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = parseInt(session.user.id, 10);
    const accessToken = session.accessToken;

    // Fetch starred repositories from GitHub
    let allRepos: GitHubRepository[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await fetch(
        `https://api.github.com/user/starred?per_page=${perPage}&page=${page}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "GitStarHub",
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          return NextResponse.json(
            { error: "GitHub token expired" },
            { status: 401 }
          );
        }
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const repos: GitHubRepository[] = await response.json();

      if (repos.length === 0) {
        break;
      }

      allRepos = allRepos.concat(repos);

      // Check if there are more pages
      const linkHeader = response.headers.get("link");
      if (!linkHeader || !linkHeader.includes('rel="next"')) {
        break;
      }

      page++;
    }

    // Save repositories to database
    let savedCount = 0;
    for (const repo of allRepos) {
      try {
        await saveRepository(userId, {
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          html_url: repo.html_url,
          language: repo.language,
          stargazers_count: repo.stargazers_count,
          topics: repo.topics || [],
          owner: {
            avatar_url: repo.owner.avatar_url,
          },
        });
        savedCount++;
      } catch (error) {
        console.error(`Failed to save repo ${repo.full_name}:`, error);
      }
    }

    // Update sync settings
    await updateSyncSettings(userId, {
      syncEnabled: true,
    });

    return NextResponse.json({
      success: true,
      message: `Synced ${savedCount} repositories`,
      count: savedCount,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync repositories" },
      { status: 500 }
    );
  }
}
