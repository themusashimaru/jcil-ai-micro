/**
 * CODEBASE RAG (Retrieval-Augmented Generation)
 *
 * Intelligent code context retrieval for AI agents.
 * Indexes codebases and enables semantic search over code.
 *
 * Features:
 * - Semantic code chunking (functions, classes, blocks)
 * - Vector embeddings via Gemini text-embedding-004
 * - Similarity search with configurable thresholds
 * - Multi-language support (TypeScript, Python, etc.)
 */

export * from './types';
export * from './chunker';
export {
  searchCodebase,
  indexCodebase,
  hasCodebaseIndex,
  deleteCodebaseIndex,
} from './search';
