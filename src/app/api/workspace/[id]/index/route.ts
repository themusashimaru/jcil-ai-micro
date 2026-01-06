/**
 * WORKSPACE INDEX API
 *
 * Codebase indexing and semantic search
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ContainerManager } from '@/lib/workspace/container';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 120;

const openai = new OpenAI();

/**
 * GET - Get current index or search
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
    const query = url.searchParams.get('query');
    const action = url.searchParams.get('action') || 'status';

    if (action === 'search' && query) {
      // Semantic search
      const results = await semanticSearch(workspaceId, query, supabase);
      return NextResponse.json({ results });
    }

    // Return index status (table created by workspace schema)
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
    console.error('Index operation failed:', error);
    return NextResponse.json({ error: 'Index operation failed' }, { status: 500 });
  }
}

/**
 * POST - Start indexing the codebase
 */
export async function POST(
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

    const body = await request.json().catch(() => ({}));
    const { includeEmbeddings = true, path = '/workspace' } = body;

    // Start indexing
    const container = new ContainerManager();

    // Get all source files
    const filePatterns = ['*.ts', '*.tsx', '*.js', '*.jsx', '*.py', '*.go', '*.rs', '*.java'];
    const allFiles: Array<{ path: string; content: string; language: string }> = [];

    for (const pattern of filePatterns) {
      const result = await container.executeCommand(
        workspaceId,
        `find ${path} -name "${pattern}" -type f ! -path "*/node_modules/*" ! -path "*/.git/*" | head -200`
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

    // Store basic index
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

    // Generate embeddings if requested
    if (includeEmbeddings) {
      await generateEmbeddings(workspaceId, allFiles, supabase);
    }

    return NextResponse.json({
      success: true,
      stats: {
        files: allFiles.length,
        symbols: symbols.length,
        dependencies: dependencies.length,
        embeddingsGenerated: includeEmbeddings,
      },
    });

  } catch (error) {
    console.error('Indexing failed:', error);
    return NextResponse.json({
      error: 'Indexing failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * Semantic search using embeddings
 */
async function semanticSearch(
  workspaceId: string,
  query: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Array<{ path: string; content: string; similarity: number }>> {
  // Generate embedding for query
  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });

  const queryEmbedding = embeddingResponse.data[0].embedding;

  // Search using pgvector (custom RPC function)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: results } = await (supabase as any).rpc('search_code_embeddings', {
    p_workspace_id: workspaceId,
    p_query_embedding: queryEmbedding,
    p_limit: 10,
  });

  return results || [];
}

/**
 * Generate embeddings for code chunks
 */
async function generateEmbeddings(
  workspaceId: string,
  files: Array<{ path: string; content: string; language: string }>,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<void> {
  // Delete existing embeddings (table created by workspace schema)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('file_embeddings')
    .delete()
    .eq('workspace_id', workspaceId);

  // Process files in batches
  const BATCH_SIZE = 20;
  const CHUNK_SIZE = 1000; // Characters per chunk

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const embeddings: Array<{
      workspace_id: string;
      file_path: string;
      chunk_index: number;
      content: string;
      embedding: number[];
    }> = [];

    for (const file of batch) {
      // Split file into chunks
      const chunks = splitIntoChunks(file.content, CHUNK_SIZE);

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        try {
          const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: `File: ${file.path}\n\n${chunks[chunkIndex]}`,
          });

          embeddings.push({
            workspace_id: workspaceId,
            file_path: file.path,
            chunk_index: chunkIndex,
            content: chunks[chunkIndex],
            embedding: response.data[0].embedding,
          });
        } catch {
          // Skip failed embeddings
        }
      }
    }

    // Insert batch
    if (embeddings.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('file_embeddings').insert(embeddings);
    }
  }
}

/**
 * Split text into chunks
 */
function splitIntoChunks(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  const lines = text.split('\n');
  let currentChunk = '';

  for (const line of lines) {
    if (currentChunk.length + line.length > chunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = line;
    } else {
      currentChunk += '\n' + line;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
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
