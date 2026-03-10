/**
 * Context Management Module
 *
 * Exports utilities for managing document context in chat:
 * - Document chunking for large files
 * - Synopsis generation
 * - Relevance-based chunk selection
 */

export {
  makeDocProfile,
  getRelevantChunks,
  needsChunking,
  processDocumentForContext,
  type DocProfile,
  type DocSection,
  type ChunkResult,
} from './chunking';
