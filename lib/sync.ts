/**
 * Sync Logic Module
 * Shared synchronization logic for both cron-based and manual sync
 */

import { GitHubClient } from './github';
import {
  saveRepository,
  saveRepositoryUpdateByGithubId,
  updateLastSyncTime,
  getUserWithToken,
  getSyncSettings,
} from './db';

// Sync result types
export interface SyncResult {
  success: boolean;
  userId: number;
  reposSynced: number;
  updatesDetected: number;
  errors: string[];
  duration: number;
}

export interface SyncProgress {
  stage: 'fetching' | 'saving' | 'updates' | 'complete';
  current: number;
  total: number;
  message: string;
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry wrapper with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  delayMs: number = RETRY_DELAY_MS
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on certain errors
      if (error instanceof Error) {
        // Don't retry on authentication errors
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          throw error;
        }
      }

      if (attempt < maxRetries - 1) {
        const delay = delayMs * Math.pow(2, attempt);
        console.warn(`Retry attempt ${attempt + 1} after ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Sync a single user's starred repositories
 * @param userId - User ID to sync
 * @param onProgress - Optional progress callback
 */
export async function syncUserRepositories(
  userId: number,
  onProgress?: (progress: SyncProgress) => void
): Promise<SyncResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let reposSynced = 0;
  let updatesDetected = 0;

  try {
    // Get user with access token
    const user = await getUserWithToken(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    if (!user.access_token) {
      throw new Error(`User ${userId} has no access token`);
    }

    // Check sync settings
    const syncSettings = await getSyncSettings(userId);
    if (syncSettings && !syncSettings.sync_enabled) {
      return {
        success: false,
        userId,
        reposSynced: 0,
        updatesDetected: 0,
        errors: ['Sync is disabled for this user'],
        duration: Date.now() - startTime,
      };
    }

    // Create GitHub client
    const githubClient = new GitHubClient(user.access_token);

    // Fetch all starred repositories
    onProgress?.({
      stage: 'fetching',
      current: 0,
      total: 0,
      message: 'Fetching starred repositories from GitHub...',
    });

    const allRepos = await withRetry(() =>
      githubClient.getAllStarredRepos((page, total) => {
        onProgress?.({
          stage: 'fetching',
          current: page,
          total,
          message: `Fetching page ${page}, found ${total} repositories...`,
        });
      })
    );

    // Save repositories to database
    onProgress?.({
      stage: 'saving',
      current: 0,
      total: allRepos.length,
      message: 'Saving repositories to database...',
    });

    for (let i = 0; i < allRepos.length; i++) {
      const repo = allRepos[i];
      try {
        await withRetry(() =>
          saveRepository(userId, {
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
          })
        );
        reposSynced++;

        if ((i + 1) % 10 === 0 || i === allRepos.length - 1) {
          onProgress?.({
            stage: 'saving',
            current: i + 1,
            total: allRepos.length,
            message: `Saved ${i + 1}/${allRepos.length} repositories...`,
          });
        }
      } catch (error) {
        const errorMsg = `Failed to save repo ${repo.full_name}: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Fetch updates for each repository (only recent updates)
    onProgress?.({
      stage: 'updates',
      current: 0,
      total: allRepos.length,
      message: 'Fetching repository updates...',
    });

    // Only fetch updates for top repositories to avoid rate limiting
    const reposToUpdate = allRepos.slice(0, 20);

    for (let i = 0; i < reposToUpdate.length; i++) {
      const repo = reposToUpdate[i];
      try {
        const [owner, name] = repo.full_name.split('/');

        // Fetch recent commits
        const commits = await withRetry(() =>
          githubClient.getRecentCommits(owner, name, 5)
        );

        for (const commit of commits) {
          const saved = await saveRepositoryUpdateByGithubId(userId, repo.id, {
            type: 'commit',
            title: commit.commit.message.split('\n')[0], // First line only
            description: commit.commit.message,
            url: commit.html_url,
            author: commit.commit.author.name,
            createdAt: commit.commit.author.date,
          });
          if (saved) updatesDetected++;
        }

        // Fetch recent issues
        const issues = await withRetry(() =>
          githubClient.getRecentIssues(owner, name, 5, 'open')
        );

        for (const issue of issues) {
          const saved = await saveRepositoryUpdateByGithubId(userId, repo.id, {
            type: 'issue',
            title: issue.title,
            description: issue.body,
            url: issue.html_url,
            author: issue.user.login,
            createdAt: issue.created_at,
          });
          if (saved) updatesDetected++;
        }

        // Fetch recent PRs
        const prs = await withRetry(() =>
          githubClient.getRecentPRs(owner, name, 5, 'open')
        );

        for (const pr of prs) {
          const saved = await saveRepositoryUpdateByGithubId(userId, repo.id, {
            type: 'pr',
            title: pr.title,
            description: pr.body,
            url: pr.html_url,
            author: pr.user.login,
            createdAt: pr.created_at,
          });
          if (saved) updatesDetected++;
        }

        if ((i + 1) % 5 === 0 || i === reposToUpdate.length - 1) {
          onProgress?.({
            stage: 'updates',
            current: i + 1,
            total: reposToUpdate.length,
            message: `Fetched updates for ${i + 1}/${reposToUpdate.length} repositories...`,
          });
        }

        // Small delay to avoid rate limiting
        await sleep(100);
      } catch (error) {
        const errorMsg = `Failed to fetch updates for ${repo.full_name}: ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Update last sync time
    await updateLastSyncTime(userId);

    onProgress?.({
      stage: 'complete',
      current: allRepos.length,
      total: allRepos.length,
      message: 'Sync complete!',
    });

    return {
      success: true,
      userId,
      reposSynced,
      updatesDetected,
      errors,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    const errorMsg = `Sync failed for user ${userId}: ${error}`;
    console.error(errorMsg);
    errors.push(errorMsg);

    return {
      success: false,
      userId,
      reposSynced,
      updatesDetected,
      errors,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Sync multiple users
 * @param userIds - List of user IDs to sync
 * @param onProgress - Optional progress callback
 */
export async function syncUsers(
  userIds: number[],
  onProgress?: (userId: number, result: SyncResult, index: number, total: number) => void
): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];
    const result = await syncUserRepositories(userId);
    results.push(result);
    onProgress?.(userId, result, i + 1, userIds.length);
  }

  return results;
}
