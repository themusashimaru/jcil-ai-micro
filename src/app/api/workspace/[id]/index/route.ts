/**
 * WORKSPACE INDEX API
 *
 * Codebase indexing (symbol extraction and basic search)
 * Note: Semantic search via embeddings disabled (Claude + Perplexity only mode)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ContainerManager, getContainerManager } from '@/lib/workspace/container';
import { validateCSRF } from '@/lib/security/csrf';
import { sanitizeFilePath, sanitizeGlobPattern } from '@/lib/workspace/security';
import { logger } from '@/lib/logger';

const log = logger('IndexAPI');

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * GET - Get current index status or simple search
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify workspace ownership
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'status';

    if (action === 'search') {
      // Semantic search disabled - suggest using grep/find in Code Lab
      return NextResponse.json({
        message: 'Semantic search disabled. Use Code Lab grep/find tools for code search.',
        results: [],
      });
    }

    // Return index status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: index } = await (supabase as any)
      .from('codebase_indexes')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single();

    if (!index) {
      return NextResponse.json({
        indexed: false,
        message: 'Workspace not indexed. POST to this endpoint to start indexing.',
      });
    }

    return NextResponse.json({
      indexed: true,
      lastIndexed: index.last_indexed_at,
      stats: {
        files: index.files?.length || 0,
        symbols: index.symbols?.length || 0,
        dependencies: index.dependencies?.length || 0,
      },
    });

  } catch (error) {
    log.error('Index operation failed', error as Error);
    return NextResponse.json({ error: 'Index operation failed' }, { status: 500 });
  }
}

/**
 * POST - Index the codebase (symbols and structure only, no embeddings)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const { id: workspaceId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify workspace ownership
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    // SECURITY: Sanitize path to prevent traversal attacks
    const rawPath = body.path || '/workspace';
    const safePath = sanitizeFilePath(rawPath, '/workspace');

    const container = getContainerManager();

    // Get all source files
    const filePatterns = ['*.ts', '*.tsx', '*.js', '*.jsx', '*.py', '*.go', '*.rs', '*.java'];
    const allFiles: Array<{ path: string; content: string; language: string }> = [];

    for (const pattern of filePatterns) {
      // SECURITY: Sanitize glob pattern
      const safePattern = sanitizeGlobPattern(pattern);
      const result = await container.executeCommand(
        workspaceId,
        `find ${safePath} -name "${safePattern}" -type f ! -path "*/node_modules/*" ! -path "*/.git/*" | head -200`
      );

      const files = result.stdout.split('\n').filter(f => f.trim());

      for (const filePath of files) {
        try {
          const content = await container.readFile(workspaceId, filePath);
          allFiles.push({
            path: filePath,
            content,
            language: detectLanguage(filePath),
          });
        } catch {
          // Skip unreadable files
        }
      }
    }

    // Extract symbols
    const symbols = extractAllSymbols(allFiles);

    // Parse dependencies
    const dependencies = await parseDependencies(container, workspaceId);

    // Store basic index (no embeddings)
    const indexData = {
      workspace_id: workspaceId,
      files: allFiles.map(f => ({
        path: f.path,
        language: f.language,
        size: f.content.length,
      })),
      symbols,
      dependencies,
      last_indexed_at: new Date().toISOString(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('codebase_indexes')
      .upsert(indexData);

    return NextResponse.json({
      success: true,
      stats: {
        files: allFiles.length,
        symbols: symbols.length,
        dependencies: dependencies.length,
      },
      note: 'Index created. Use Code Lab grep/find tools for code search.',
    });

  } catch (error) {
    log.error('Indexing failed', error as Error);
    return NextResponse.json({
      error: 'Indexing failed',
    }, { status: 500 });
  }
}

/**
 * Detect language from file extension
 */
function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
  };
  return langMap[ext] || 'unknown';
}

/**
 * Extract symbols from all files
 */
function extractAllSymbols(
  files: Array<{ path: string; content: string; language: string }>
): Array<{ name: string; type: string; file: string; line: number }> {
  const symbols: Array<{ name: string; type: string; file: string; line: number }> = [];

  const patterns: Record<string, Array<{ regex: RegExp; type: string }>> = {
    typescript: [
      { regex: /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g, type: 'function' },
      { regex: /(?:export\s+)?class\s+(\w+)/g, type: 'class' },
      { regex: /(?:export\s+)?interface\s+(\w+)/g, type: 'interface' },
      { regex: /(?:export\s+)?type\s+(\w+)/g, type: 'type' },
      { regex: /(?:export\s+)?const\s+(\w+)\s*=/g, type: 'variable' },
      { regex: /(?:export\s+)?enum\s+(\w+)/g, type: 'enum' },
    ],
    python: [
      { regex: /def\s+(\w+)\s*\(/g, type: 'function' },
      { regex: /class\s+(\w+)/g, type: 'class' },
    ],
    go: [
      { regex: /func\s+(\w+)/g, type: 'function' },
      { regex: /type\s+(\w+)\s+struct/g, type: 'struct' },
      { regex: /type\s+(\w+)\s+interface/g, type: 'interface' },
    ],
  };

  for (const file of files) {
    const langPatterns = patterns[file.language] || patterns.typescript;
    const lines = file.content.split('\n');

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      for (const { regex, type } of langPatterns) {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(line)) !== null) {
          symbols.push({
            name: match[1],
            type,
            file: file.path,
            line: lineNum + 1,
          });
        }
      }
    }
  }

  return symbols;
}

/**
 * Parse project dependencies
 */
async function parseDependencies(
  container: ContainerManager,
  workspaceId: string
): Promise<Array<{ name: string; version: string; type: string }>> {
  const deps: Array<{ name: string; version: string; type: string }> = [];

  try {
    const packageJson = await container.readFile(workspaceId, '/workspace/package.json');
    const pkg = JSON.parse(packageJson);

    for (const [name, version] of Object.entries(pkg.dependencies || {})) {
      deps.push({ name, version: version as string, type: 'production' });
    }
    for (const [name, version] of Object.entries(pkg.devDependencies || {})) {
      deps.push({ name, version: version as string, type: 'development' });
    }
  } catch {
    // No package.json
  }

  return deps;
}
