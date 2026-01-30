/**
 * Research Executors
 *
 * Primary: Brave Search (cost-effective, rich data, up to 20 queries)
 * Extended: Browser (Puppeteer), Vision (Claude), Code (E2B), Documents (RAG)
 * Fallback: Perplexity (for deep research if needed)
 */

// Search executors
export { braveExecutor, BraveExecutor } from './BraveExecutor';
export { perplexityExecutor, PerplexityExecutor } from './PerplexityExecutor';

// Extended capability executors
export { browserExecutor, BrowserExecutor } from './BrowserExecutor';
export { visionExecutor, VisionExecutor, type VisionInput } from './VisionExecutor';
export {
  codeExecutor,
  CodeExecutor,
  type CodeInput,
  type CodeExecutionResult,
} from './CodeExecutor';
export { documentExecutor, DocumentExecutor, type DocumentInput } from './DocumentExecutor';
