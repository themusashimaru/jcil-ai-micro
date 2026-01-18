/**
 * SURGICAL EDIT API - LINE-BASED PRECISE EDITING
 *
 * Provides Claude Code-style surgical editing capabilities:
 * - Line-number based edits
 * - Multi-edit batching
 * - Dry-run preview
 * - Diff generation
 *
 * Uses ContainerManager (E2B) for file operations - same backend as Files API.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/user-guard';
import {
  surgicalEdit,
  LineEdit,
  formatDiffForDisplay,
  generateUnifiedDiff,
} from '@/lib/workspace/surgical-edit';
import { ContainerManager } from '@/lib/workspace/container';
import { sanitizeFilePath } from '@/lib/workspace/security';
import { validateCSRF } from '@/lib/security/csrf';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';

const log = logger('SurgicalEditAPI');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

// Helper to verify session ownership
async function verifySessionOwnership(
  supabase: AnySupabase,
  sessionId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await (supabase.from('code_lab_sessions') as AnySupabase)
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .single();

  return !error && !!data;
}

// Container-based file operations (matches Files API backend)
async function readFileFromWorkspace(sessionId: string, filePath: string): Promise<string> {
  const container = new ContainerManager();
  const safePath = sanitizeFilePath(filePath);
  return await container.readFile(sessionId, safePath);
}

async function writeFileToWorkspace(
  sessionId: string,
  filePath: string,
  content: string
): Promise<void> {
  const container = new ContainerManager();
  const safePath = sanitizeFilePath(filePath);
  await container.writeFile(sessionId, safePath, content);
}

/**
 * POST /api/code-lab/edit
 *
 * Apply surgical edits to a file
 */
export async function POST(request: NextRequest) {
  try {
    // CSRF Protection (skip for dry-run requests as they don't mutate)
    const body = await request.json();
    const { dryRun = false } = body as { dryRun?: boolean };

    if (!dryRun) {
      const csrfCheck = validateCSRF(request);
      if (!csrfCheck.valid) return csrfCheck.response!;
    }

    // Auth check
    const auth = await requireUser(request);
    if (!auth.authorized) {
      return auth.response;
    }

    const {
      sessionId,
      filePath,
      edits,
      format = 'json', // 'json' | 'diff' | 'unified'
    } = body as {
      sessionId: string;
      filePath: string;
      edits: LineEdit[];
      dryRun?: boolean;
      format?: 'json' | 'diff' | 'unified';
    };

    // Validate required fields
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }
    if (!filePath) {
      return NextResponse.json({ error: 'Missing filePath' }, { status: 400 });
    }
    if (!edits || !Array.isArray(edits) || edits.length === 0) {
      return NextResponse.json({ error: 'Missing or empty edits array' }, { status: 400 });
    }

    // Verify session ownership
    const supabase = await createClient();
    const hasAccess = await verifySessionOwnership(supabase, sessionId, auth.user.id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Session not found or access denied' }, { status: 403 });
    }

    // Use sessionId as the workspace identifier (matches Files API)
    const effectiveWorkspaceId = sessionId;

    log.info('Surgical edit request', {
      userId: auth.user.id,
      workspaceId: effectiveWorkspaceId,
      filePath,
      editCount: edits.length,
      dryRun,
    });

    // Execute surgical edit
    const result = await surgicalEdit(
      {
        filePath,
        edits,
        dryRun,
        createBackup: true,
      },
      (path) => readFileFromWorkspace(effectiveWorkspaceId, path),
      (path, content) => writeFileToWorkspace(effectiveWorkspaceId, path, content)
    );

    // Format response based on requested format
    if (format === 'diff' && result.success) {
      return NextResponse.json({
        success: true,
        diff: formatDiffForDisplay(result.diffs),
        stats: {
          linesAdded: result.linesAdded,
          linesRemoved: result.linesRemoved,
          linesModified: result.linesModified,
        },
      });
    }

    if (format === 'unified' && result.success && result.originalContent && result.newContent) {
      return NextResponse.json({
        success: true,
        unifiedDiff: generateUnifiedDiff(filePath, result.originalContent, result.newContent),
        stats: {
          linesAdded: result.linesAdded,
          linesRemoved: result.linesRemoved,
          linesModified: result.linesModified,
        },
      });
    }

    // Default JSON response
    return NextResponse.json(result);
  } catch (error) {
    log.error('Surgical edit API error', error as Error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/code-lab/edit
 *
 * Get information about the edit API
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    version: '1.0.0',
    capabilities: {
      lineBasedEditing: true,
      multiEdit: true,
      dryRun: true,
      diffPreview: true,
      unifiedDiff: true,
      backup: true,
    },
    usage: {
      endpoint: 'POST /api/code-lab/edit',
      body: {
        sessionId: 'string (required) - Code Lab session ID',
        filePath: 'string (required) - path to file within workspace',
        edits: 'Array<{ startLine: number, endLine: number, newContent: string }>',
        dryRun: 'boolean (optional) - preview without applying',
        format: '"json" | "diff" | "unified" (optional) - response format',
      },
      example: {
        sessionId: 'abc123',
        filePath: 'src/index.ts',
        edits: [{ startLine: 10, endLine: 12, newContent: '// Updated content\nconst x = 1;' }],
        dryRun: true,
      },
      notes:
        'Uses same E2B container backend as /api/code-lab/files. CSRF token required for non-dry-run requests.',
    },
  });
}
