/**
 * GitHub API Client
 * Encapsulates GitHub REST API v3 calls with rate limiting and error handling
 */

const GITHUB_API_BASE = 'https://api.github.com';

// Types for GitHub API responses
export interface GitHubRepository {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
    type: string;
  };
  html_url: string;
  description: string | null;
  fork: boolean;
  url: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  homepage: string | null;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  forks_count: number;
  open_issues_count: number;
  topics: string[];
  visibility: string;
  default_branch: string;
  license: {
    key: string;
    name: string;
    spdx_id: string;
  } | null;
}

export interface GitHubCommit {
  sha: string;
  node_id: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
    tree: {
      sha: string;
      url: string;
    };
    url: string;
    comment_count: number;
  };
  url: string;
  html_url: string;
  comments_url: string;
  author: {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
  } | null;
  committer: {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
  } | null;
}

export interface GitHubIssue {
  id: number;
  node_id: string;
  url: string;
  repository_url: string;
  html_url: string;
  number: number;
  state: string;
  title: string;
  body: string | null;
  user: {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
  };
  labels: Array<{
    id: number;
    name: string;
    color: string;
  }>;
  assignee: {
    login: string;
    id: number;
    avatar_url: string;
  } | null;
  assignees: Array<{
    login: string;
    id: number;
    avatar_url: string;
  }>;
  comments: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  pull_request?: {
    url: string;
    html_url: string;
    diff_url: string;
    patch_url: string;
  };
}

export interface GitHubPullRequest {
  id: number;
  node_id: string;
  url: string;
  html_url: string;
  diff_url: string;
  patch_url: string;
  issue_url: string;
  number: number;
  state: string;
  title: string;
  body: string | null;
  user: {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
  };
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merge_commit_sha: string | null;
  draft: boolean;
  head: {
    label: string;
    ref: string;
    sha: string;
    user: {
      login: string;
      id: number;
    };
    repo: {
      id: number;
      name: string;
      full_name: string;
    };
  };
  base: {
    label: string;
    ref: string;
    sha: string;
    user: {
      login: string;
      id: number;
    };
    repo: {
      id: number;
      name: string;
      full_name: string;
    };
  };
  merged: boolean;
  mergeable: boolean | null;
  comments: number;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
}

export interface GitHubRateLimit {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  hasNextPage: boolean;
  nextPage: number | null;
  rateLimit: GitHubRateLimit | null;
}

/**
 * Custom error class for GitHub API errors
 */
export class GitHubApiError extends Error {
  public status: number;
  public rateLimit: GitHubRateLimit | null;

  constructor(message: string, status: number, rateLimit: GitHubRateLimit | null = null) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
    this.rateLimit = rateLimit;
  }
}

/**
 * GitHub API Client class
 * Handles authentication, rate limiting, and error handling
 */
export class GitHubClient {
  private accessToken: string;
  private baseUrl: string;

  constructor(accessToken: string, baseUrl: string = GITHUB_API_BASE) {
    this.accessToken = accessToken;
    this.baseUrl = baseUrl;
  }

  /**
   * Make an authenticated request to GitHub API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T; rateLimit: GitHubRateLimit | null }> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${this.accessToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    };

    let lastError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        // Extract rate limit info from headers
        const rateLimit: GitHubRateLimit | null = response.headers.get('x-ratelimit-remaining')
          ? {
              limit: parseInt(response.headers.get('x-ratelimit-limit') || '0', 10),
              remaining: parseInt(response.headers.get('x-ratelimit-remaining') || '0', 10),
              reset: parseInt(response.headers.get('x-ratelimit-reset') || '0', 10),
              used: parseInt(response.headers.get('x-ratelimit-used') || '0', 10),
            }
          : null;

        // Handle rate limiting
        if (response.status === 403 && rateLimit && rateLimit.remaining === 0) {
          const resetTime = new Date(rateLimit.reset * 1000);
          const waitTime = resetTime.getTime() - Date.now();

          if (waitTime > 0 && waitTime < 3600000) {
            // Wait up to 1 hour for rate limit reset
            console.warn(`Rate limit exceeded. Waiting ${Math.ceil(waitTime / 1000)} seconds until reset.`);
            await this.sleep(waitTime + 1000); // Add 1 second buffer
            continue; // Retry after waiting
          }

          throw new GitHubApiError(
            `GitHub API rate limit exceeded. Resets at ${resetTime.toISOString()}`,
            403,
            rateLimit
          );
        }

        if (!response.ok) {
          const errorBody = await response.text();
          let errorMessage = `GitHub API error: ${response.status}`;

          try {
            const errorJson = JSON.parse(errorBody);
            errorMessage = errorJson.message || errorMessage;
          } catch {
            // Use default error message
          }

          throw new GitHubApiError(errorMessage, response.status, rateLimit);
        }

        const data = await response.json();
        return { data, rateLimit };
      } catch (error) {
        lastError = error as Error;

        // Don't retry on GitHub API errors (non-network errors)
        if (error instanceof GitHubApiError) {
          throw error;
        }

        // Retry on network errors
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.warn(`Request failed, retrying in ${delay}ms...`, error);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Sleep utility for rate limiting and retries
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get starred repositories for the authenticated user
   * @param page - Page number (1-indexed)
   * @param perPage - Number of results per page (max 100)
   */
  async getStarredRepos(
    page: number = 1,
    perPage: number = 30
  ): Promise<PaginatedResponse<GitHubRepository>> {
    const { data, rateLimit } = await request<GitHubRepository[]>(
      `/user/starred?page=${page}&per_page=${Math.min(perPage, 100)}&sort=created&direction=desc`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    // Check if there's a next page by looking at the Link header
    // For simplicity, we'll check if we got a full page of results
    const hasNextPage = data.length === perPage;

    return {
      data,
      hasNextPage,
      nextPage: hasNextPage ? page + 1 : null,
      rateLimit,
    };
  }

  /**
   * Get all starred repositories with automatic pagination
   * @param onProgress - Optional callback for progress updates
   * @param maxPages - Maximum number of pages to fetch (default: 100, safety limit)
   */
  async getAllStarredRepos(
    onProgress?: (page: number, total: number) => void,
    maxPages: number = 100
  ): Promise<GitHubRepository[]> {
    const allRepos: GitHubRepository[] = [];
    let page = 1;
    const perPage = 100; // Maximum allowed by GitHub
    let hasMore = true;

    while (hasMore && page <= maxPages) {
      const response = await this.getStarredRepos(page, perPage);
      allRepos.push(...response.data);

      // Report progress
      if (onProgress) {
        onProgress(page, allRepos.length);
      }

      hasMore = response.hasNextPage;
      page++;

      // Add a small delay between requests to be nice to the API
      if (hasMore) {
        await this.sleep(100);
      }
    }

    return allRepos;
  }

  /**
   * Get recent commits for a repository
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param count - Number of commits to fetch (max 100)
   */
  async getRecentCommits(
    owner: string,
    repo: string,
    count: number = 10
  ): Promise<GitHubCommit[]> {
    const { data } = await this.request<GitHubCommit[]>(
      `/repos/${owner}/${repo}/commits?per_page=${Math.min(count, 100)}`
    );

    return data;
  }

  /**
   * Get recent issues for a repository
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param count - Number of issues to fetch (max 100)
   * @param state - Issue state filter ('open', 'closed', 'all')
   */
  async getRecentIssues(
    owner: string,
    repo: string,
    count: number = 10,
    state: 'open' | 'closed' | 'all' = 'open'
  ): Promise<GitHubIssue[]> {
    const { data } = await this.request<GitHubIssue[]>(
      `/repos/${owner}/${repo}/issues?state=${state}&sort=updated&direction=desc&per_page=${Math.min(count, 100)}`
    );

    // Filter out pull requests (they're included in the issues endpoint)
    return data.filter((issue) => !issue.pull_request);
  }

  /**
   * Get recent pull requests for a repository
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param count - Number of PRs to fetch (max 100)
   * @param state - PR state filter ('open', 'closed', 'all')
   */
  async getRecentPRs(
    owner: string,
    repo: string,
    count: number = 10,
    state: 'open' | 'closed' | 'all' = 'open'
  ): Promise<GitHubPullRequest[]> {
    const { data } = await this.request<GitHubPullRequest[]>(
      `/repos/${owner}/${repo}/pulls?state=${state}&sort=updated&direction=desc&per_page=${Math.min(count, 100)}`
    );

    return data;
  }

  /**
   * Get a single repository
   * @param owner - Repository owner
   * @param repo - Repository name
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    const { data } = await this.request<GitHubRepository>(`/repos/${owner}/${repo}`);
    return data;
  }

  /**
   * Get the authenticated user's rate limit status
   */
  async getRateLimit(): Promise<{
    resources: {
      core: GitHubRateLimit;
      search: GitHubRateLimit;
      graphql: GitHubRateLimit;
    };
    rate: GitHubRateLimit;
  }> {
    const { data } = await this.request<{
      resources: {
        core: GitHubRateLimit;
        search: GitHubRateLimit;
        graphql: GitHubRateLimit;
      };
      rate: GitHubRateLimit;
    }>('/rate_limit');

    return data;
  }

  /**
   * Search repositories
   * @param query - Search query
   * @param page - Page number (1-indexed)
   * @param perPage - Number of results per page (max 100)
   */
  async searchRepositories(
    query: string,
    page: number = 1,
    perPage: number = 30
  ): Promise<{
    total_count: number;
    incomplete_results: boolean;
    items: GitHubRepository[];
  }> {
    const { data } = await this.request<{
      total_count: number;
      incomplete_results: boolean;
      items: GitHubRepository[];
    }>(
      `/search/repositories?q=${encodeURIComponent(query)}&page=${page}&per_page=${Math.min(perPage, 100)}`
    );

    return data;
  }
}

/**
 * Create a GitHub client instance from an access token
 */
export function createGitHubClient(accessToken: string): GitHubClient {
  return new GitHubClient(accessToken);
}

// Helper function for fetch with authorization
async function request<T>(
  input: string | URL | globalThis.Request,
  init?: RequestInit
): Promise<{ data: T; rateLimit: GitHubRateLimit | null }> {
  const response = await fetch(input, init);

  const rateLimit: GitHubRateLimit | null = response.headers.get('x-ratelimit-remaining')
    ? {
        limit: parseInt(response.headers.get('x-ratelimit-limit') || '0', 10),
        remaining: parseInt(response.headers.get('x-ratelimit-remaining') || '0', 10),
        reset: parseInt(response.headers.get('x-ratelimit-reset') || '0', 10),
        used: parseInt(response.headers.get('x-ratelimit-used') || '0', 10),
      }
    : null;

  if (!response.ok) {
    const errorBody = await response.text();
    let errorMessage = `GitHub API error: ${response.status}`;

    try {
      const errorJson = JSON.parse(errorBody);
      errorMessage = errorJson.message || errorMessage;
    } catch {
      // Use default error message
    }

    throw new GitHubApiError(errorMessage, response.status, rateLimit);
  }

  const data = await response.json();
  return { data, rateLimit };
}
