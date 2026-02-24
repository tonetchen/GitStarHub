/**
 * Cron-based Sync API
 * Triggered by Vercel Cron Jobs every hour
 * Verifies CRON_SECRET for security
 */

import { NextResponse } from 'next/server';
import { getUsersToSync } from '@/lib/db';
import { syncUsers, SyncResult } from '@/lib/sync';

// Verify cron secret for security
function verifyCronSecret(authHeader: string | null): boolean {
  if (!authHeader) {
    return false;
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('CRON_SECRET environment variable is not set');
    return false;
  }

  // Support both "Bearer <token>" and raw token formats
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  return token === cronSecret;
}

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    if (!verifyCronSecret(authHeader)) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or missing CRON_SECRET' },
        { status: 401 }
      );
    }

    console.log('[Cron Sync] Starting scheduled sync...');

    // Get users that need syncing
    const usersToSync = await getUsersToSync();

    if (usersToSync.length === 0) {
      console.log('[Cron Sync] No users need syncing at this time');
      return NextResponse.json({
        success: true,
        message: 'No users need syncing at this time',
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[Cron Sync] Found ${usersToSync.length} users to sync`);

    // Sync users
    const userIds = usersToSync.map((u) => u.id);
    const results = await syncUsers(
      userIds,
      (userId, result, index, total) => {
        console.log(
          `[Cron Sync] Synced user ${userId} (${index}/${total}): ` +
            `${result.reposSynced} repos, ${result.updatesDetected} updates, ` +
            `${result.errors.length} errors`
        );
      }
    );

    // Aggregate results
    const successfulSyncs = results.filter((r) => r.success).length;
    const failedSyncs = results.filter((r) => !r.success).length;
    const totalRepos = results.reduce((sum, r) => sum + r.reposSynced, 0);
    const totalUpdates = results.reduce((sum, r) => sum + r.updatesDetected, 0);
    const allErrors = results.flatMap((r) => r.errors);

    const duration = Date.now() - startTime;

    console.log(
      `[Cron Sync] Complete: ${successfulSyncs} successful, ${failedSyncs} failed, ` +
        `${totalRepos} repos, ${totalUpdates} updates in ${duration}ms`
    );

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      duration,
      summary: {
        usersProcessed: results.length,
        successfulSyncs,
        failedSyncs,
        totalReposSynced: totalRepos,
        totalUpdatesDetected: totalUpdates,
      },
      errors: allErrors.length > 0 ? allErrors : undefined,
    });
  } catch (error) {
    console.error('[Cron Sync] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Sync failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering with CRON_SECRET
export async function POST(request: Request) {
  return GET(request);
}
