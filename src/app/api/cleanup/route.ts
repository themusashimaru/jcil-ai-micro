// /app/api/cleanup/route.ts
// API endpoint for automated file cleanup

import { NextRequest, NextResponse } from 'next/server';
import { cleanupOldFiles, previewCleanup } from '@/lib/file-cleanup';

export const dynamic = 'force-dynamic';

/**
 * Verify request is authorized (secret key or cron job)
 */
function isAuthorized(request: NextRequest): boolean {
  // Check for secret key in Authorization header
  const authHeader = request.headers.get('authorization');
  const secretKey = process.env.CLEANUP_SECRET_KEY;

  if (!secretKey) {
    console.error('CLEANUP_SECRET_KEY not configured');
    return false;
  }

  // Support both "Bearer token" and just "token"
  const token = authHeader?.replace('Bearer ', '');
  
  return token === secretKey;
}

/**
 * GET - Preview what files would be deleted (safe, no deletion)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('📋 Preview cleanup requested');
    
    const preview = await previewCleanup();

    return NextResponse.json({
      success: true,
      preview,
      message: 'Preview completed (no files deleted)',
    });

  } catch (error) {
    console.error('Error in preview:', error);
    return NextResponse.json(
      { 
        error: 'Preview failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Actually run the cleanup (deletes files)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authorization
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('🧹 File cleanup started');
    
    const stats = await cleanupOldFiles();

    return NextResponse.json({
      success: true,
      stats,
      message: 'Cleanup completed successfully',
    });

  } catch (error) {
    console.error('Error in cleanup:', error);
    return NextResponse.json(
      { 
        error: 'Cleanup failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}