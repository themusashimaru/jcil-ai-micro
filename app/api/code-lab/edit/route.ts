/**
 * SURGICAL EDIT API - LINE-BASED PRECISE EDITING
 *
 * Provides Claude Code-style surgical editing capabilities:
 * - Line-number based edits
 * - Multi-edit batching
 * - Dry-run preview
 * - Diff generation
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/user-guard';
import {
  surgicalEdit,
  LineEdit,
  formatDiffForDisplay,
  generateUnifiedDiff,
} from '@/lib/workspace/surgical-edit';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';

const log = logger('SurgicalEditAPI');

// Simple file operations for the API
// In production, these would use E2B or another sandbox
async function readFileFromWorkspace(
  workspaceId: string,
  filePath: string
): Promise<string> {
  // TODO: Connect to actual workspace file system (E2B, container, etc.)
  // For now, use Supabase storage or return error

  const supabase = await createClient();

  // Check if file exists in workspace storage
  const { data, error } = await supabase.storage
    .from('workspaces')
    .download(`${workspaceId}/${filePath}`);

  if (error) {
    // Try to read from GitHub if workspace is linked
    throw new Error(`File not found: ${filePath}. Connect a workspace or repository first.`);
  }

  return await data.text();
}

async function writeFileToWorkspace(
  workspaceId: string,
  filePath: string,
  content: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase.storage
    .from('workspaces')
    .upload(`${workspaceId}/${filePath}`, content, {
      upsert: true,
      contentType: 'text/plain',
    });

  if (error) {
    throw new Error(`Failed to write file: ${error.message}`);
  }
}

/**
 * POST /api/code-lab/edit
 *
 * Apply surgical edits to a file
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const auth = await requireUser(request);
    if (!auth.authorized) {
      return auth.response;
    }

    const body = await request.json();
    const {
      sessionId,
      workspaceId,
      filePath,
      edits,
      dryRun = false,
      format = 'json', // 'json' | 'diff' | 'unified'
    } = body as {
      sessionId?: string;
      workspaceId?: string;
      filePath: string;
      edits: LineEdit[];
      dryRun?: boolean;
      format?: 'json' | 'diff' | 'unified';
    };

    // Validate required fields
    if (!filePath) {
      return NextResponse.json({ error: 'Missing filePath' }, { status: 400 });
    }
    if (!edits || !Array.isArray(edits) || edits.length === 0) {
      return NextResponse.json({ error: 'Missing or empty edits array' }, { status: 400 });
    }

    // Get workspace ID from session if not provided
    const effectiveWorkspaceId = workspaceId || sessionId || auth.user.id;

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
        filePath: 'string - path to file',
        edits: 'Array<{ startLine: number, endLine: number, newContent: string }>',
        dryRun: 'boolean (optional) - preview without applying',
        format: '"json" | "diff" | "unified" (optional) - response format',
      },
      example: {
        filePath: 'src/index.ts',
        edits: [
          { startLine: 10, endLine: 12, newContent: '// Updated content\nconst x = 1;' },
        ],
        dryRun: true,
      },
    },
  });
}
