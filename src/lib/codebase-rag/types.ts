/**
 * CODEBASE RAG TYPES
 *
 * Type definitions for the codebase retrieval-augmented generation system.
 * Used to provide intelligent code context to AI agents.
 */

export interface CodeFile {
  path: string;
  content: string;
  language: string;
  size: number;
  sha: string;
}

export interface CodeChunk {
  id: string;
  repoId: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  language: string;
  chunkType: 'function' | 'class' | 'import' | 'export' | 'block' | 'file';
  embedding?: number[];
  metadata?: {
    functionName?: string;
    className?: string;
    exports?: string[];
    imports?: string[];
  };
}

export interface CodebaseIndex {
  id: string;
  userId: string;
  repoOwner: string;
  repoName: string;
  branch: string;
  totalFiles: number;
  totalChunks: number;
  lastIndexed: Date;
  status: 'pending' | 'indexing' | 'ready' | 'error';
  error?: string;
}

export interface CodeSearchResult {
  chunkId: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  language: string;
  similarity: number;
  chunkType: string;
  metadata?: Record<string, unknown>;
}

export interface CodeSearchOptions {
  matchCount?: number;
  matchThreshold?: number;
  fileTypes?: string[];
  includeImports?: boolean;
  chunkTypes?: string[];
}
