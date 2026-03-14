/**
 * TOOL ORCHESTRATION LAYER
 *
 * Enables intelligent tool chaining by:
 * 1. Tracking artifacts (URLs, files, data) produced by tools
 * 2. Injecting artifact context so tools know about previous outputs
 * 3. Providing orchestration instructions to the system prompt
 * 4. Supporting parallel tool execution where tools are independent
 *
 * This is what turns isolated tools into an integrated platform.
 *
 * Created: 2026-03-06
 */

import { logger } from '@/lib/logger';

const log = logger('ToolOrchestration');

// ============================================================================
// ARTIFACT TRACKING
// ============================================================================

/** Types of artifacts tools can produce */
export type ArtifactType =
  | 'url' // A URL to an image, chart, file, etc.
  | 'file' // A generated file (PDF, DOCX, PPTX, XLSX)
  | 'data' // Structured data (JSON, CSV, table)
  | 'text' // Text content (research results, analysis)
  | 'image' // Image URL specifically (for embedding)
  | 'chart' // Chart URL (QuickChart, etc.)
  | 'code'; // Generated/refactored code

export interface ToolArtifact {
  /** Unique ID for referencing this artifact */
  id: string;
  /** Which tool produced this */
  toolName: string;
  /** What type of artifact this is */
  type: ArtifactType;
  /** The actual content (URL, data, text) */
  content: string;
  /** Human-readable label */
  label: string;
  /** When it was created (for ordering) */
  timestamp: number;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Session-scoped artifact store.
 * Tracks all outputs from tool executions within a single chat session.
 */
export class ArtifactStore {
  private artifacts: ToolArtifact[] = [];
  private idCounter = 0;

  /** Add an artifact produced by a tool */
  add(
    toolName: string,
    type: ArtifactType,
    content: string,
    label: string,
    metadata?: Record<string, unknown>
  ): ToolArtifact {
    const artifact: ToolArtifact = {
      id: `artifact_${++this.idCounter}`,
      toolName,
      type,
      content,
      label,
      timestamp: Date.now(),
      metadata,
    };
    this.artifacts.push(artifact);
    log.debug('Artifact stored', { id: artifact.id, toolName, type, label });
    return artifact;
  }

  /** Get all artifacts */
  getAll(): ToolArtifact[] {
    return [...this.artifacts];
  }

  /** Get artifacts by type */
  getByType(type: ArtifactType): ToolArtifact[] {
    return this.artifacts.filter((a) => a.type === type);
  }

  /** Get artifacts by tool name */
  getByTool(toolName: string): ToolArtifact[] {
    return this.artifacts.filter((a) => a.toolName === toolName);
  }

  /** Get the most recent artifact of a given type */
  getLatest(type?: ArtifactType): ToolArtifact | undefined {
    const filtered = type ? this.getByType(type) : this.artifacts;
    return filtered[filtered.length - 1];
  }

  /** Check if any artifacts exist */
  hasArtifacts(): boolean {
    return this.artifacts.length > 0;
  }

  /** Build context string for injection into tool results */
  buildContextString(): string {
    if (this.artifacts.length === 0) return '';

    const lines = this.artifacts.map((a) => {
      switch (a.type) {
        case 'image':
        case 'chart':
        case 'url':
          return `- [${a.label}] (${a.type}) from ${a.toolName}: ${a.content}`;
        case 'file':
          return `- [${a.label}] (file) from ${a.toolName}: ${a.content}`;
        case 'data':
          return `- [${a.label}] (data) from ${a.toolName}: ${a.content.slice(0, 200)}${a.content.length > 200 ? '...' : ''}`;
        case 'text':
          return `- [${a.label}] (text) from ${a.toolName}: ${a.content.slice(0, 150)}${a.content.length > 150 ? '...' : ''}`;
        case 'code':
          return `- [${a.label}] (code) from ${a.toolName}: ${a.content.slice(0, 100)}...`;
        default:
          return `- [${a.label}] from ${a.toolName}`;
      }
    });

    return [
      '\n<available_artifacts>',
      'Previously generated artifacts you can reference in subsequent tool calls:',
      ...lines,
      '</available_artifacts>',
    ].join('\n');
  }

  /** Clear all artifacts (end of session) */
  clear(): void {
    this.artifacts = [];
    this.idCounter = 0;
  }
}

// ============================================================================
// ARTIFACT EXTRACTION FROM TOOL RESULTS
// ============================================================================

/** URL patterns to detect in tool output */
const URL_PATTERN = /https?:\/\/[^\s"'<>]+/g;
const CHART_URL_PATTERN = /https?:\/\/quickchart\.io[^\s"'<>]+/g;
const SUPABASE_URL_PATTERN = /https?:\/\/[^/]*supabase[^\s"'<>]*/g;

/**
 * Extract artifacts from a tool's result content.
 * Each tool type has specific patterns we look for.
 */
export function extractArtifacts(
  toolName: string,
  resultContent: string,
  isError: boolean
): Array<{
  type: ArtifactType;
  content: string;
  label: string;
  metadata?: Record<string, unknown>;
}> {
  if (isError) return [];

  const artifacts: Array<{
    type: ArtifactType;
    content: string;
    label: string;
    metadata?: Record<string, unknown>;
  }> = [];

  switch (toolName) {
    case 'create_chart': {
      const chartUrls = resultContent.match(CHART_URL_PATTERN) || [];
      for (const url of chartUrls) {
        artifacts.push({ type: 'chart', content: url, label: 'Generated chart' });
      }
      break;
    }

    case 'create_document': {
      // Document tool returns base64 or download URLs
      if (resultContent.includes('data:application/pdf')) {
        artifacts.push({ type: 'file', content: 'PDF document generated', label: 'PDF document' });
      }
      if (resultContent.includes('.docx') || resultContent.includes('application/vnd.openxml')) {
        artifacts.push({
          type: 'file',
          content: 'DOCX document generated',
          label: 'Word document',
        });
      }
      // Check for download URLs
      const docUrls = resultContent.match(URL_PATTERN) || [];
      for (const url of docUrls) {
        artifacts.push({ type: 'file', content: url, label: 'Document download' });
      }
      break;
    }

    case 'create_presentation': {
      if (resultContent.includes('.pptx') || resultContent.includes('presentation')) {
        artifacts.push({
          type: 'file',
          content: 'PPTX generated',
          label: 'PowerPoint presentation',
        });
      }
      const pptxUrls = resultContent.match(URL_PATTERN) || [];
      for (const url of pptxUrls) {
        artifacts.push({ type: 'file', content: url, label: 'Presentation download' });
      }
      break;
    }

    case 'create_spreadsheet':
    case 'excel_advanced': {
      artifacts.push({
        type: 'file',
        content: 'Spreadsheet generated',
        label: 'Excel spreadsheet',
      });
      break;
    }

    case 'transform_image':
    case 'generate_qr_code':
    case 'generate_barcode': {
      const imageUrls = resultContent.match(URL_PATTERN) || [];
      for (const url of imageUrls) {
        artifacts.push({ type: 'image', content: url, label: `Image from ${toolName}` });
      }
      // Check for base64 images
      if (resultContent.includes('data:image/')) {
        artifacts.push({
          type: 'image',
          content: 'Base64 image generated',
          label: `Image from ${toolName}`,
        });
      }
      break;
    }

    case 'screenshot':
    case 'capture_webpage': {
      const screenshotUrls = resultContent.match(URL_PATTERN) || [];
      for (const url of screenshotUrls) {
        artifacts.push({ type: 'image', content: url, label: 'Screenshot' });
      }
      break;
    }

    case 'web_search':
    case 'parallel_research':
    case 'fetch_url': {
      if (resultContent.length > 100) {
        artifacts.push({
          type: 'text',
          content: resultContent,
          label: `Research from ${toolName}`,
        });
      }
      break;
    }

    case 'run_code':
    case 'create_and_run_tool': {
      if (resultContent.length > 50) {
        artifacts.push({
          type: 'data',
          content: resultContent,
          label: 'Code execution output',
        });
      }
      break;
    }

    case 'sql_query': {
      artifacts.push({ type: 'data', content: resultContent, label: 'SQL query results' });
      break;
    }

    case 'fix_error':
    case 'refactor_code':
    case 'format_code': {
      artifacts.push({ type: 'code', content: resultContent, label: `Code from ${toolName}` });
      break;
    }

    case 'analyze_text_nlp': {
      artifacts.push({
        type: 'data',
        content: resultContent,
        label: 'NLP analysis results',
      });
      break;
    }

    case 'analyze_sequence': {
      artifacts.push({
        type: 'data',
        content: resultContent,
        label: 'DNA/protein analysis',
      });
      break;
    }

    case 'medical_calc': {
      artifacts.push({
        type: 'data',
        content: resultContent,
        label: 'Clinical calculation results',
      });
      break;
    }

    default: {
      // Generic URL extraction for any tool
      const urls = resultContent.match(URL_PATTERN) || [];
      const supabaseUrls = resultContent.match(SUPABASE_URL_PATTERN) || [];
      for (const url of supabaseUrls) {
        artifacts.push({ type: 'image', content: url, label: `File from ${toolName}` });
      }
      // Only add non-supabase URLs if no supabase ones found
      if (supabaseUrls.length === 0) {
        for (const url of urls.slice(0, 3)) {
          artifacts.push({ type: 'url', content: url, label: `URL from ${toolName}` });
        }
      }
      break;
    }
  }

  return artifacts;
}

// ============================================================================
// TOOL CHAIN DEFINITIONS
// ============================================================================

/**
 * Known tool chains — sequences of tools that work well together.
 * Used for system prompt enrichment so the model knows it CAN chain these.
 */
export const TOOL_CHAINS = [
  {
    name: 'Research to Presentation',
    description: 'Research a topic, create charts from data, generate images, build a presentation',
    tools: ['parallel_research', 'create_chart', 'create_presentation'],
    trigger: 'when user asks to create a presentation/deck about a topic',
  },
  {
    name: 'Research to Document',
    description: 'Research a topic, create charts/visuals, generate a PDF or DOCX report',
    tools: ['parallel_research', 'create_chart', 'create_document'],
    trigger: 'when user asks for a report or document about a topic',
  },
  {
    name: 'Data Analysis Pipeline',
    description: 'Run code to analyze data, create charts from results, build a spreadsheet',
    tools: ['run_code', 'create_chart', 'create_spreadsheet'],
    trigger: 'when user asks to analyze data and visualize it',
  },
  {
    name: 'Web Scrape to Analysis',
    description: 'Fetch a webpage, extract tables, analyze data, create charts',
    tools: ['fetch_url', 'extract_table', 'run_code', 'create_chart'],
    trigger: 'when user asks to analyze data from a website',
  },
  {
    name: 'Screenshot to Report',
    description: 'Take a screenshot, analyze it with vision, generate a document',
    tools: ['screenshot', 'analyze_image', 'create_document'],
    trigger: 'when user asks to document or analyze a webpage visually',
  },
  {
    name: 'Code Review Pipeline',
    description: 'Analyze code, check accessibility, fix errors, refactor',
    tools: ['check_accessibility', 'fix_error', 'refactor_code'],
    trigger: 'when user asks for comprehensive code review',
  },
  {
    name: 'PDF Processing Pipeline',
    description: 'Extract PDF content, analyze it, create a summary document',
    tools: ['extract_pdf', 'analyze_text_nlp', 'create_document'],
    trigger: 'when user uploads a PDF and wants analysis or summary',
  },
  {
    name: 'Media Processing Pipeline',
    description: 'Transcribe audio, process media, create document from content',
    tools: ['audio_transcribe', 'process_media', 'create_document'],
    trigger: 'when user uploads audio/video and wants transcription or document',
  },
  {
    name: 'QR/Barcode Generation',
    description: 'Generate QR codes or barcodes, embed in documents or presentations',
    tools: ['generate_qr_code', 'create_document'],
    trigger: 'when user needs QR codes or barcodes in a document',
  },
  {
    name: 'Full Creative Pipeline',
    description: 'Research → generate images → create charts → build presentation → export as PDF',
    tools: ['parallel_research', 'create_chart', 'create_presentation', 'pdf_manipulate'],
    trigger: 'when user asks for a comprehensive creative deliverable',
  },
  {
    name: 'Document and Email',
    description: 'Create a document (PDF, DOCX, resume), then email it to a recipient',
    tools: ['create_document', 'composio_GMAIL_SEND_EMAIL'],
    trigger: 'when user asks to create a document AND send/email it',
  },
  {
    name: 'Document and Calendar',
    description: 'Create a document, then add a calendar event related to it',
    tools: ['create_document', 'composio_GOOGLECALENDAR_CREATE_EVENT'],
    trigger: 'when user asks to create a document AND add a calendar event',
  },
  {
    name: 'Multi-Action Workflow',
    description:
      'Handle multiple user requests in sequence: documents, emails, calendar, file operations',
    tools: ['create_document', 'composio_GMAIL_SEND_EMAIL', 'composio_GOOGLECALENDAR_CREATE_EVENT'],
    trigger: 'when user asks for multiple distinct tasks in one message',
  },
];

// ============================================================================
// SYSTEM PROMPT ORCHESTRATION CONTEXT
// ============================================================================

/**
 * Generate orchestration instructions for the system prompt.
 * Teaches the model about tool chaining and artifact reuse.
 */
export function getOrchestrationPrompt(artifactStore?: ArtifactStore): string {
  const sections: string[] = [];

  sections.push(`<tool_orchestration>
You have access to a powerful set of tools that work TOGETHER as an integrated system.
When a user makes a complex request, you should chain multiple tools together to deliver
complete results — don't just use one tool when a combination would be better.

KEY PRINCIPLE: Tool outputs are artifacts. URLs, files, data, and text from one tool
can be passed as input to another tool. Always look for opportunities to chain tools.

KNOWN TOOL CHAINS (use these patterns when appropriate):
${TOOL_CHAINS.map((chain) => `- **${chain.name}**: ${chain.tools.join(' → ')} — ${chain.trigger}`).join('\n')}

CHAINING RULES:
1. When create_chart returns a URL, pass it as image_url in create_presentation slides
2. When parallel_research returns findings, use them as content for create_document or create_presentation
3. When run_code produces data, feed it into create_chart for visualization
4. When screenshot or capture_webpage returns an image, pass it to analyze_image for analysis
5. When extract_pdf returns text, feed it to analyze_text_nlp or run_code for analysis
6. When any tool returns a URL, it can be embedded in documents, presentations, or emails
7. When fetch_url returns HTML with tables, use extract_table to structure the data
8. When create_document generates a file, you can reference its download URL in a follow-up email tool call
9. When a user asks to create something AND email/share/send it, complete ALL tasks in sequence — do not stop after just the document creation
10. For multi-task requests (e.g., "create a resume, update my calendar, and email me the resume"), handle each task in order using the appropriate tools

PARALLEL EXECUTION: When tool calls are independent (don't depend on each other's results),
call them simultaneously. For example, generate multiple charts at once, or run web_search
while creating a chart from already-known data.

IMPORTANT: Always complete the full chain. If a user asks for "a presentation about AI trends,"
don't just research — research, THEN create charts, THEN build the presentation with those charts.
</tool_orchestration>`);

  // Add artifact context if there are any
  if (artifactStore?.hasArtifacts()) {
    sections.push(artifactStore.buildContextString());
  }

  return sections.join('\n');
}

// ============================================================================
// PARALLEL TOOL EXECUTION HELPER
// ============================================================================

/**
 * Determine which tool calls can run in parallel vs which need sequential execution.
 * Tools that don't reference each other's outputs can run simultaneously.
 */
export function partitionParallelCalls(
  toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> | string }>
): Array<Array<{ id: string; name: string; arguments: Record<string, unknown> | string }>> {
  // If only 1 tool call, no parallelism needed
  if (toolCalls.length <= 1) return [toolCalls];

  // Tools that produce artifacts others might consume
  const PRODUCER_TOOLS = new Set([
    'web_search',
    'parallel_research',
    'fetch_url',
    'run_code',
    'create_chart',
    'screenshot',
    'extract_pdf',
    'extract_table',
    'analyze_image',
    'sql_query',
  ]);

  // Tools that typically consume artifacts from other tools
  const CONSUMER_TOOLS = new Set([
    'create_presentation',
    'create_document',
    'create_spreadsheet',
    'pdf_manipulate',
    'transform_image',
  ]);

  // Simple heuristic: if we have both producers and consumers, run producers first
  const producers = toolCalls.filter((tc) => PRODUCER_TOOLS.has(tc.name));
  const consumers = toolCalls.filter((tc) => CONSUMER_TOOLS.has(tc.name));
  const neutral = toolCalls.filter(
    (tc) => !PRODUCER_TOOLS.has(tc.name) && !CONSUMER_TOOLS.has(tc.name)
  );

  const batches: Array<
    Array<{ id: string; name: string; arguments: Record<string, unknown> | string }>
  > = [];

  // Batch 1: Producers + neutral (can run in parallel)
  if (producers.length > 0 || neutral.length > 0) {
    batches.push([...producers, ...neutral]);
  }

  // Batch 2: Consumers (run after producers)
  if (consumers.length > 0) {
    batches.push(consumers);
  }

  // If no clear batching, just return all as one batch (parallel)
  if (batches.length === 0) {
    batches.push(toolCalls);
  }

  return batches;
}
