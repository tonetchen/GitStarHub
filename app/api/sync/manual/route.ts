/**
 * Manual Sync API
 * Allows authenticated users to manually trigger a sync of their starred repositories
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { syncUserRepositories, SyncProgress } from '@/lib/sync';
import { getSyncSettings, updateLastSyncTime } from '@/lib/db';

// Minimum time between manual syncs (in milliseconds)
const MIN_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in to sync' },
        { status: 401 }
      );
    }

    const userId = parseInt(session.user.id, 10);

    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    // Check if user has synced recently (rate limiting)
    const syncSettings = await getSyncSettings(userId);

    if (syncSettings?.last_sync_at) {
      const lastSync = new Date(syncSettings.last_sync_at).getTime();
      const timeSinceLastSync = Date.now() - lastSync;

      if (timeSinceLastSync < MIN_SYNC_INTERVAL_MS) {
        const waitTime = Math.ceil((MIN_SYNC_INTERVAL_MS - timeSinceLastSync) / 1000);
        return NextResponse.json(
          {
            error: 'Please wait before syncing again',
            waitTime,
            lastSyncAt: syncSettings.last_sync_at,
          },
          { status: 429 }
        );
      }
    }

    console.log(`[Manual Sync] Starting sync for user ${userId}...`);

    // Check if this is a streaming request
    const url = new URL(request.url);
    const stream = url.searchParams.get('stream') === 'true';

    if (stream) {
      // Return Server-Sent Events for real-time progress
      return new Response(
        new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();

            const sendProgress = (progress: SyncProgress) => {
              const data = JSON.stringify({ type: 'progress', ...progress });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            };

            try {
              const result = await syncUserRepositories(userId, sendProgress);

              // Send final result
              const data = JSON.stringify({ type: 'complete', ...result });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              controller.close();
            } catch (error) {
              const data = JSON.stringify({
                type: 'error',
                error: error instanceof Error ? error.message : 'Sync failed',
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              controller.close();
            }
          },
        }),
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        }
      );
    }

    // Non-streaming sync (standard JSON response)
    const result = await syncUserRepositories(userId);

    const duration = Date.now() - startTime;

    console.log(
      `[Manual Sync] Complete for user ${userId}: ` +
        `${result.reposSynced} repos, ${result.updatesDetected} updates, ` +
        `${result.errors.length} errors in ${duration}ms`
    );

    return NextResponse.json({
      success: result.success,
      userId: result.userId,
      reposSynced: result.reposSynced,
      updatesDetected: result.updatesDetected,
      duration: result.duration,
      errors: result.errors.length > 0 ? result.errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Manual Sync] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Sync failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check sync status
export async function GET(request: Request) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = parseInt(session.user.id, 10);
    const syncSettings = await getSyncSettings(userId);

    if (!syncSettings) {
      return NextResponse.json({
        hasSynced: false,
        canSync: true,
        syncEnabled: true,
      });
    }

    const lastSync = syncSettings.last_sync_at
      ? new Date(syncSettings.last_sync_at)
      : null;

    const timeSinceLastSync = lastSync
      ? Date.now() - lastSync.getTime()
      : Infinity;

    const canSync = timeSinceLastSync >= MIN_SYNC_INTERVAL_MS;

    return NextResponse.json({
      hasSynced: lastSync !== null,
      lastSyncAt: lastSync?.toISOString() || null,
      syncEnabled: syncSettings.sync_enabled,
      syncIntervalMinutes: syncSettings.sync_interval_minutes,
      canSync,
      waitTime: canSync
        ? 0
        : Math.ceil((MIN_SYNC_INTERVAL_MS - timeSinceLastSync) / 1000),
    });
  } catch (error) {
    console.error('[Sync Status] Error:', error);

    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}
