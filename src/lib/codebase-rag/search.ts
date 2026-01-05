/**
 * CODEBASE RAG SEARCH
 *
 * Semantic search over indexed codebase using embeddings.
 * Provides relevant code context for AI agents.
 */

import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { CodeChunk, CodeSearchResult, CodeSearchOptions } from './types';
import { chunkCodeFile, detectLanguage, shouldIndexFile } from './chunker';

// Initialize Gemini for embeddings
const gemini = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY_1 || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
});

// Service client for database operations
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * Search the codebase for relevant code chunks
 */
export async function searchCodebase(
  userId: string,
  repoOwner: string,
  repoName: string,
  query: string,
  options: CodeSearchOptions = {}
): Promise<{
  results: CodeSearchResult[];
  contextString: string;
}> {
  const {
    matchCount = 8,
    matchThreshold = 0.35,
    fileTypes,
    chunkTypes,
  } = options;

  console.log(`[CodebaseRAG] Searching ${repoOwner}/${repoName} for: "${query.substring(0, 50)}..."`);

  try {
    const supabase = createServiceClient();

    // Check if we have an index for this repo
    const { data: index } = await supabase
      .from('codebase_indexes')
      .select('id, status')
      .eq('user_id', userId)
      .eq('repo_owner', repoOwner)
      .eq('repo_name', repoName)
      .single();

    if (!index || index.status !== 'ready') {
      console.log('[CodebaseRAG] No ready index found for repo');
      return { results: [], contextString: '' };
    }

    // Generate query embedding
    console.log('[CodebaseRAG] Generating query embedding...');
    const embeddingResponse = await gemini.models.embedContent({
      model: 'text-embedding-004',
      contents: `Code search: ${query}`,
    });

    if (!embeddingResponse.embeddings?.[0]?.values) {
      console.error('[CodebaseRAG] No embedding returned');
      return { results: [], contextString: '' };
    }

    const queryEmbedding = embeddingResponse.embeddings[0].values;

    // Search using vector similarity
    const { data: results, error } = await supabase.rpc('search_codebase_chunks', {
      p_index_id: index.id,
      p_query_embedding: JSON.stringify(queryEmbedding),
      p_match_count: matchCount,
      p_match_threshold: matchThreshold,
      p_file_types: fileTypes || null,
      p_chunk_types: chunkTypes || null,
    });

    if (error) {
      console.error('[CodebaseRAG] Search error:', error);
      // Fall back to keyword search if RPC doesn't exist
      if (error.code === '42883') {
        return await fallbackKeywordSearch(index.id, query, matchCount);
      }
      return { results: [], contextString: '' };
    }

    if (!results || results.length === 0) {
      console.log('[CodebaseRAG] No results found above threshold');
      return { results: [], contextString: '' };
    }

    // Format results
    const searchResults: CodeSearchResult[] = results.map((r: {
      chunk_id: string;
      file_path: string;
      content: string;
      start_line: number;
      end_line: number;
      language: string;
      similarity: number;
      chunk_type: string;
      metadata: Record<string, unknown>;
    }) => ({
      chunkId: r.chunk_id,
      filePath: r.file_path,
      content: r.content,
      startLine: r.start_line,
      endLine: r.end_line,
      language: r.language,
      similarity: r.similarity,
      chunkType: r.chunk_type,
      metadata: r.metadata,
    }));

    const contextString = formatCodeContext(searchResults, repoOwner, repoName);

    console.log(`[CodebaseRAG] Found ${searchResults.length} relevant chunks`);

    return { results: searchResults, contextString };
  } catch (error) {
    console.error('[CodebaseRAG] Unexpected error:', error);
    return { results: [], contextString: '' };
  }
}

/**
 * Fallback keyword search when vector search is unavailable
 */
async function fallbackKeywordSearch(
  indexId: string,
  query: string,
  limit: number
): Promise<{ results: CodeSearchResult[]; contextString: string }> {
  try {
    const supabase = createServiceClient();

    // Extract keywords
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 2);

    // Build a simple ILIKE query
    const { data: chunks } = await supabase
      .from('codebase_chunks')
      .select('*')
      .eq('index_id', indexId)
      .or(keywords.map(k => `content.ilike.%${k}%`).join(','))
      .limit(limit);

    if (!chunks || chunks.length === 0) {
      return { results: [], contextString: '' };
    }

    const results: CodeSearchResult[] = chunks.map((c: {
      id: string;
      file_path: string;
      content: string;
      start_line: number;
      end_line: number;
      language: string;
      chunk_type: string;
      metadata: Record<string, unknown>;
    }) => ({
      chunkId: c.id,
      filePath: c.file_path,
      content: c.content,
      startLine: c.start_line,
      endLine: c.end_line,
      language: c.language,
      similarity: 0.5, // Arbitrary for keyword match
      chunkType: c.chunk_type,
      metadata: c.metadata,
    }));

    return { results, contextString: formatCodeContext(results, '', '') };
  } catch (error) {
    console.error('[CodebaseRAG] Fallback search error:', error);
    return { results: [], contextString: '' };
  }
}

/**
 * Format code search results into context for AI
 */
function formatCodeContext(
  results: CodeSearchResult[],
  repoOwner: string,
  repoName: string
): string {
  if (results.length === 0) return '';

  let context = `## CODEBASE CONTEXT: ${repoOwner}/${repoName}\n\n`;
  context += 'The following code snippets are relevant to your query:\n\n';

  // Group by file for cleaner presentation
  const byFile = new Map<string, CodeSearchResult[]>();

  for (const result of results) {
    if (!byFile.has(result.filePath)) {
      byFile.set(result.filePath, []);
    }
    byFile.get(result.filePath)!.push(result);
  }

  for (const [filePath, chunks] of byFile) {
    context += `### \`${filePath}\`\n\n`;

    for (const chunk of chunks) {
      context += `\`\`\`${chunk.language}:${filePath}#L${chunk.startLine}-${chunk.endLine}\n`;
      context += chunk.content;
      context += '\n```\n\n';
    }
  }

  context += '---\n\n';
  context += 'Use this code context to provide accurate, specific answers. Reference file paths and line numbers when relevant.\n';

  return context;
}

/**
 * Index a repository's codebase
 */
export async function indexCodebase(
  userId: string,
  repoOwner: string,
  repoName: string,
  branch: string,
  files: Array<{ path: string; content: string; sha: string }>
): Promise<{ success: boolean; error?: string; indexId?: string }> {
  console.log(`[CodebaseRAG] Indexing ${repoOwner}/${repoName} (${files.length} files)`);

  const supabase = createServiceClient();

  try {
    // Create or update index record
    const { data: existingIndex } = await supabase
      .from('codebase_indexes')
      .select('id')
      .eq('user_id', userId)
      .eq('repo_owner', repoOwner)
      .eq('repo_name', repoName)
      .single();

    let indexId: string;

    if (existingIndex) {
      indexId = existingIndex.id;
      // Update status to indexing
      await supabase
        .from('codebase_indexes')
        .update({ status: 'indexing', error: null })
        .eq('id', indexId);

      // Clear existing chunks
      await supabase
        .from('codebase_chunks')
        .delete()
        .eq('index_id', indexId);
    } else {
      // Create new index
      const { data: newIndex, error: createError } = await supabase
        .from('codebase_indexes')
        .insert({
          user_id: userId,
          repo_owner: repoOwner,
          repo_name: repoName,
          branch,
          status: 'indexing',
        })
        .select('id')
        .single();

      if (createError || !newIndex) {
        throw new Error(`Failed to create index: ${createError?.message}`);
      }
      indexId = newIndex.id;
    }

    // Filter indexable files
    const indexableFiles = files.filter(f => shouldIndexFile(f.path));
    console.log(`[CodebaseRAG] ${indexableFiles.length} indexable files of ${files.length} total`);

    // Chunk all files
    const allChunks: CodeChunk[] = [];

    for (const file of indexableFiles) {
      const language = detectLanguage(file.path);
      const chunks = chunkCodeFile(
        {
          path: file.path,
          content: file.content,
          language,
          size: file.content.length,
          sha: file.sha,
        },
        indexId
      );
      allChunks.push(...chunks);
    }

    console.log(`[CodebaseRAG] Generated ${allChunks.length} chunks`);

    // Generate embeddings in batches
    const batchSize = 20;
    const chunksWithEmbeddings: Array<CodeChunk & { embedding: number[] }> = [];

    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);

      // Generate embeddings for batch
      const embeddings = await Promise.all(
        batch.map(async (chunk) => {
          try {
            const response = await gemini.models.embedContent({
              model: 'text-embedding-004',
              contents: `${chunk.filePath}\n\n${chunk.content}`,
            });
            return response.embeddings?.[0]?.values || null;
          } catch {
            return null;
          }
        })
      );

      // Add chunks with successful embeddings
      for (let j = 0; j < batch.length; j++) {
        if (embeddings[j]) {
          chunksWithEmbeddings.push({
            ...batch[j],
            embedding: embeddings[j]!,
          });
        }
      }

      // Progress logging
      console.log(`[CodebaseRAG] Embedded ${Math.min(i + batchSize, allChunks.length)}/${allChunks.length} chunks`);
    }

    // Insert chunks into database
    if (chunksWithEmbeddings.length > 0) {
      const insertData = chunksWithEmbeddings.map(chunk => ({
        id: chunk.id,
        index_id: indexId,
        file_path: chunk.filePath,
        content: chunk.content,
        start_line: chunk.startLine,
        end_line: chunk.endLine,
        language: chunk.language,
        chunk_type: chunk.chunkType,
        embedding: JSON.stringify(chunk.embedding),
        metadata: chunk.metadata || {},
      }));

      // Insert in batches
      for (let i = 0; i < insertData.length; i += 100) {
        const batch = insertData.slice(i, i + 100);
        const { error: insertError } = await supabase
          .from('codebase_chunks')
          .insert(batch);

        if (insertError) {
          console.error('[CodebaseRAG] Insert error:', insertError);
        }
      }
    }

    // Update index status
    await supabase
      .from('codebase_indexes')
      .update({
        status: 'ready',
        total_files: indexableFiles.length,
        total_chunks: chunksWithEmbeddings.length,
        last_indexed: new Date().toISOString(),
      })
      .eq('id', indexId);

    console.log(`[CodebaseRAG] Indexing complete: ${chunksWithEmbeddings.length} chunks`);

    return { success: true, indexId };
  } catch (error) {
    console.error('[CodebaseRAG] Indexing error:', error);

    // Update index with error status
    await supabase
      .from('codebase_indexes')
      .update({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('user_id', userId)
      .eq('repo_owner', repoOwner)
      .eq('repo_name', repoName);

    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Check if a repo has been indexed
 */
export async function hasCodebaseIndex(
  userId: string,
  repoOwner: string,
  repoName: string
): Promise<{ indexed: boolean; status?: string; totalChunks?: number }> {
  try {
    const supabase = createServiceClient();

    const { data } = await supabase
      .from('codebase_indexes')
      .select('status, total_chunks')
      .eq('user_id', userId)
      .eq('repo_owner', repoOwner)
      .eq('repo_name', repoName)
      .single();

    if (!data) {
      return { indexed: false };
    }

    return {
      indexed: data.status === 'ready',
      status: data.status,
      totalChunks: data.total_chunks,
    };
  } catch {
    return { indexed: false };
  }
}

/**
 * Delete a codebase index
 */
export async function deleteCodebaseIndex(
  userId: string,
  repoOwner: string,
  repoName: string
): Promise<{ success: boolean }> {
  try {
    const supabase = createServiceClient();

    // Get index ID
    const { data: index } = await supabase
      .from('codebase_indexes')
      .select('id')
      .eq('user_id', userId)
      .eq('repo_owner', repoOwner)
      .eq('repo_name', repoName)
      .single();

    if (index) {
      // Delete chunks first
      await supabase
        .from('codebase_chunks')
        .delete()
        .eq('index_id', index.id);

      // Delete index
      await supabase
        .from('codebase_indexes')
        .delete()
        .eq('id', index.id);
    }

    return { success: true };
  } catch {
    return { success: false };
  }
}
