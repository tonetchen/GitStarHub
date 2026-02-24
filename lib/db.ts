import { sql } from '@vercel/postgres';

// Database error class
export class DatabaseError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'DatabaseError';
  }
}

// User type definition (internal use only)
interface UserRow {
  id: number;
  github_id: number;
  username: string;
  email: string | null;
  avatar_url: string | null;
  access_token: string;
  created_at: Date;
  updated_at: Date;
}

// Public user type (without sensitive fields)
export interface User {
  id: number;
  github_id: number;
  username: string;
  email: string | null;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserInput {
  githubId: number;
  username: string;
  email?: string | null;
  avatarUrl?: string | null;
  accessToken: string;
}

/**
 * Safe row to user conversion
 */
function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    github_id: row.github_id,
    username: row.username,
    email: row.email,
    avatar_url: row.avatar_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Get user by ID (without access_token)
 * @param id - User ID
 * @returns User object or null if not found
 */
export async function getUserById(id: number): Promise<User | null> {
  try {
    const result = await sql`
      SELECT
        id,
        github_id,
        username,
        email,
        avatar_url,
        created_at,
        updated_at
      FROM users
      WHERE id = ${id}
    `;

    if (result.rows.length === 0) {
      return null;
    }

    return rowToUser(result.rows[0] as UserRow);
  } catch (error) {
    throw new DatabaseError('Failed to get user by ID', error as Error);
  }
}

/**
 * Get user by GitHub ID (without access_token)
 * @param githubId - GitHub user ID
 * @returns User object or null if not found
 */
export async function getUserByGithubId(githubId: number): Promise<User | null> {
  try {
    const result = await sql`
      SELECT
        id,
        github_id,
        username,
        email,
        avatar_url,
        created_at,
        updated_at
      FROM users
      WHERE github_id = ${githubId}
    `;

    if (result.rows.length === 0) {
      return null;
    }

    return rowToUser(result.rows[0] as UserRow);
  } catch (error) {
    throw new DatabaseError('Failed to get user by GitHub ID', error as Error);
  }
}

/**
 * Get user with access token (for authentication)
 * @param id - User ID
 * @returns User row with access_token or null if not found
 */
export async function getUserWithToken(id: number): Promise<UserRow | null> {
  try {
    const result = await sql`
      SELECT * FROM users WHERE id = ${id}
    `;

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as UserRow;
  } catch (error) {
    throw new DatabaseError('Failed to get user with token', error as Error);
  }
}

/**
 * Create a new user
 * @param user - User data to create
 * @returns Created user object
 */
export async function createUser(user: CreateUserInput): Promise<User> {
  try {
    const result = await sql`
      INSERT INTO users (github_id, username, email, avatar_url, access_token)
      VALUES (${user.githubId}, ${user.username}, ${user.email ?? null}, ${user.avatarUrl ?? null}, ${user.accessToken})
      RETURNING
        id,
        github_id,
        username,
        email,
        avatar_url,
        created_at,
        updated_at
    `;

    return rowToUser(result.rows[0] as UserRow);
  } catch (error) {
    throw new DatabaseError('Failed to create user', error as Error);
  }
}

/**
 * Update user
 * @param id - User ID
 * @param updates - Fields to update
 * @returns Updated user object
 */
export async function updateUser(
  id: number,
  updates: Partial<Pick<UserRow, 'avatar_url' | 'email' | 'username'>>
): Promise<User | null> {
  try {
    const result = await sql`
      UPDATE users
      SET
        avatar_url = COALESCE(${updates.avatar_url ?? null}, avatar_url),
        email = COALESCE(${updates.email ?? null}, email),
        username = COALESCE(${updates.username ?? null}, username),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING
        id,
        github_id,
        username,
        email,
        avatar_url,
        created_at,
        updated_at
    `;

    if (result.rows.length === 0) {
      return null;
    }

    return rowToUser(result.rows[0] as UserRow);
  } catch (error) {
    throw new DatabaseError('Failed to update user', error as Error);
  }
}

/**
 * Save repository to database
 * @param userId - User ID
 * @param repo - Repository data from GitHub
 * @returns Saved repository ID
 */
export async function saveRepository(
  userId: number,
  repo: {
    id: number;
    name: string;
    full_name: string;
    description: string | null;
    html_url: string;
    language: string | null;
    stargazers_count: number;
    topics: string[];
    owner: { avatar_url: string | null };
  }
): Promise<number> {
  try {
    // Convert topics array to PostgreSQL array format or null
    const topicsValue = repo.topics.length > 0
      ? `{${repo.topics.map(t => `"${t.replace(/"/g, '""')}"`).join(',')}}`
      : null;

    const result = await sql`
      INSERT INTO starred_repositories (
        user_id,
        github_repo_id,
        repo_name,
        owner_login,
        repo_full_name,
        description,
        html_url,
        language,
        stargazers_count,
        fork_count,
        open_issues_count,
        topics,
        created_at
      )
      VALUES (
        ${userId},
        ${repo.id},
        ${repo.name},
        ${repo.full_name.split('/')[0]},
        ${repo.full_name},
        ${repo.description},
        ${repo.html_url},
        ${repo.language},
        ${repo.stargazers_count},
        0,
        0,
        ${topicsValue},
        NOW()
      )
      ON CONFLICT (user_id, github_repo_id)
      DO UPDATE SET
        description = EXCLUDED.description,
        html_url = EXCLUDED.html_url,
        language = EXCLUDED.language,
        stargazers_count = EXCLUDED.stargazers_count,
        fork_count = EXCLUDED.fork_count,
        open_issues_count = EXCLUDED.open_issues_count,
        topics = EXCLUDED.topics,
        updated_at = NOW()
      RETURNING id
    `;

    return (result.rows[0] as { id: number }).id;
  } catch (error) {
    throw new DatabaseError('Failed to save repository', error as Error);
  }
}

/**
 * Get repository by GitHub ID
 * @param userId - User ID
 * @param githubRepoId - GitHub repository ID
 * @returns Repository internal ID or null
 */
export async function getRepositoryByGithubId(
  userId: number,
  githubRepoId: number
): Promise<{ id: number } | null> {
  try {
    const result = await sql`
      SELECT id FROM starred_repositories
      WHERE user_id = ${userId} AND github_repo_id = ${githubRepoId}
    `;

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as { id: number };
  } catch (error) {
    throw new DatabaseError('Failed to get repository by GitHub ID', error as Error);
  }
}

/**
 * Save repository update to database
 * @param repositoryId - Repository ID in our database
 * @param update - Update data
 */
export async function saveRepositoryUpdate(
  repositoryId: number,
  update: {
    type: 'commit' | 'release' | 'issue' | 'pr' | 'readme';
    title: string;
    description: string | null;
    url: string;
    author: string;
    createdAt: string;
  }
): Promise<void> {
  try {
    await sql`
      INSERT INTO repository_updates (
        repo_id,
        update_type,
        title,
        description,
        url,
        author,
        detected_at,
        is_read
      )
      VALUES (
        ${repositoryId},
        ${update.type},
        ${update.title},
        ${update.description},
        ${update.url},
        ${update.author},
        ${update.createdAt},
        false
      )
      ON CONFLICT DO NOTHING
    `;
  } catch (error) {
    throw new DatabaseError('Failed to save repository update', error as Error);
  }
}

/**
 * Save repository update by GitHub repo ID (convenience function)
 * @param userId - User ID
 * @param repoGithubId - GitHub repository ID
 * @param update - Update data
 */
export async function saveRepositoryUpdateByGithubId(
  userId: number,
  repoGithubId: number,
  update: {
    type: 'commit' | 'release' | 'issue' | 'pr' | 'readme';
    title: string;
    description: string | null;
    url: string;
    author: string;
    createdAt: string;
  }
): Promise<boolean> {
  try {
    const repo = await getRepositoryByGithubId(userId, repoGithubId);
    if (!repo) {
      console.warn(`Repository ${repoGithubId} not found for user ${userId}`);
      return false;
    }

    await saveRepositoryUpdate(repo.id, update);
    return true;
  } catch (error) {
    throw new DatabaseError('Failed to save repository update by GitHub ID', error as Error);
  }
}

/**
 * Update user sync settings
 * @param userId - User ID
 * @param settings - Sync settings to update
 */
export async function updateSyncSettings(
  userId: number,
  settings: {
    syncEnabled?: boolean;
    syncIntervalMinutes?: number;
  }
): Promise<void> {
  try {
    await sql`
      INSERT INTO user_sync_settings (user_id, sync_enabled, sync_interval_minutes)
      VALUES (
        ${userId},
        ${settings.syncEnabled ?? true},
        ${settings.syncIntervalMinutes ?? 120}
      )
      ON CONFLICT (user_id)
      DO UPDATE SET
        sync_enabled = COALESCE(EXCLUDED.sync_enabled, sync_enabled),
        sync_interval_minutes = COALESCE(EXCLUDED.sync_interval_minutes, sync_interval_minutes),
        last_sync_at = NOW(),
        updated_at = NOW()
    `;
  } catch (error) {
    throw new DatabaseError('Failed to update sync settings', error as Error);
  }
}

/**
 * Get user sync settings
 * @param userId - User ID
 * @returns Sync settings or null
 */
export async function getSyncSettings(userId: number): Promise<{
  sync_enabled: boolean;
  sync_interval_minutes: number;
  last_sync_at: Date | null;
} | null> {
  try {
    const result = await sql`
      SELECT sync_enabled, sync_interval_minutes, last_sync_at
      FROM user_sync_settings
      WHERE user_id = ${userId}
    `;

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as {
      sync_enabled: boolean;
      sync_interval_minutes: number;
      last_sync_at: Date | null;
    };
  } catch (error) {
    throw new DatabaseError('Failed to get sync settings', error as Error);
  }
}

/**
 * Update user AI settings
 * @param userId - User ID
 * @param settings - AI settings to update
 */
export async function updateAiSettings(
  userId: number,
  settings: {
    preferredModel?: string;
  }
): Promise<void> {
  try {
    await sql`
      INSERT INTO user_ai_settings (user_id, preferred_model)
      VALUES (${userId}, ${settings.preferredModel ?? 'glm-4'})
      ON CONFLICT (user_id)
      DO UPDATE SET
        preferred_model = COALESCE(EXCLUDED.preferred_model, preferred_model),
        updated_at = NOW()
    `;
  } catch (error) {
    throw new DatabaseError('Failed to update AI settings', error as Error);
  }
}

/**
 * Get user AI settings
 * @param userId - User ID
 * @returns AI settings or null
 */
export async function getAiSettings(userId: number): Promise<{
  preferred_model: string;
} | null> {
  try {
    const result = await sql`
      SELECT preferred_model
      FROM user_ai_settings
      WHERE user_id = ${userId}
    `;

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as { preferred_model: string };
  } catch (error) {
    throw new DatabaseError('Failed to get AI settings', error as Error);
  }
}

/**
 * Get repositories for user
 * @param userId - User ID
 * @param options - Query options
 * @returns List of repositories
 */
export async function getUserRepositories(
  userId: number,
  options: {
    limit?: number;
    offset?: number;
    language?: string;
  } = {}
): Promise<any[]> {
  try {
    // Build query based on options
    let query = `SELECT * FROM starred_repositories WHERE user_id = ${userId}`;

    if (options.language) {
      query += ` AND language = '${options.language.replace(/'/g, "''")}'`;
    }

    query += ` ORDER BY starred_at DESC`;

    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    if (options.offset) {
      query += ` OFFSET ${options.offset}`;
    }

    const result = await sql.query(query);
    return result.rows;
  } catch (error) {
    throw new DatabaseError('Failed to get user repositories', error as Error);
  }
}

/**
 * Get recent updates for user
 * @param userId - User ID
 * @param options - Query options
 * @returns List of updates
 */
export async function getUserUpdates(
  userId: number,
  options: {
    limit?: number;
    offset?: number;
    updateType?: string;
    unreadOnly?: boolean;
  } = {}
): Promise<any[]> {
  try {
    // Build query based on options
    let query = `
      SELECT
        ru.*,
        sr.repo_name,
        sr.repo_full_name,
        sr.owner_login
      FROM repository_updates ru
      JOIN starred_repositories sr ON ru.repo_id = sr.id
      WHERE sr.user_id = ${userId}
    `;

    if (options.updateType) {
      query += ` AND ru.update_type = '${options.updateType.replace(/'/g, "''")}'`;
    }

    if (options.unreadOnly) {
      query += ` AND ru.is_read = false`;
    }

    query += ` ORDER BY ru.detected_at DESC`;

    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    if (options.offset) {
      query += ` OFFSET ${options.offset}`;
    }

    const result = await sql.query(query);
    return result.rows;
  } catch (error) {
    throw new DatabaseError('Failed to get user updates', error as Error);
  }
}

/**
 * Mark updates as read
 * @param userId - User ID
 * @param updateIds - Update IDs to mark as read
 */
export async function markUpdatesAsRead(userId: number, updateIds: number[]): Promise<void> {
  try {
    // Build query with proper array handling
    const idsList = updateIds.join(',');
    await sql.query(`
      UPDATE repository_updates
      SET is_read = true
      WHERE id = ANY(ARRAY[${idsList}]::int[])
        AND repo_id IN (SELECT id FROM starred_repositories WHERE user_id = ${userId})
    `);
  } catch (error) {
    throw new DatabaseError('Failed to mark updates as read', error as Error);
  }
}

/**
 * Get users that need syncing
 * @returns List of users to sync
 */
export async function getUsersToSync(): Promise<Array<{
  id: number;
  access_token: string;
  sync_interval_minutes: number;
  last_sync_at: Date | null;
}>> {
  try {
    const result = await sql`
      SELECT
        u.id,
        u.access_token,
        s.sync_interval_minutes,
        s.last_sync_at
      FROM users u
      JOIN user_sync_settings s ON u.id = s.user_id
      WHERE s.sync_enabled = true
        AND (
          s.last_sync_at IS NULL
          OR s.last_sync_at <= NOW() - (s.sync_interval_minutes || '1') * INTERVAL '1 minute'
        )
    `;

    return result.rows as Array<{
      id: number;
      access_token: string;
      sync_interval_minutes: number;
      last_sync_at: Date | null;
    }>;
  } catch (error) {
    throw new DatabaseError('Failed to get users to sync', error as Error);
  }
}

/**
 * Update user last sync time
 * @param userId - User ID
 */
export async function updateLastSyncTime(userId: number): Promise<void> {
  try {
    await sql`
      UPDATE user_sync_settings
      SET last_sync_at = NOW(), updated_at = NOW()
      WHERE user_id = ${userId}
    `;
  } catch (error) {
    throw new DatabaseError('Failed to update last sync time', error as Error);
  }
}
