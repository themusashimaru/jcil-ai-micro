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
      // Extract download URLs (hosted URLs from Supabase upload, or data URLs as fallback)
      const docUrls = resultContent.match(URL_PATTERN) || [];
      for (const url of docUrls) {
        const isDocx = url.includes('.docx') || resultContent.includes('DOCX');
        const isPdf = url.includes('.pdf') || resultContent.includes('PDF');
        const label = isPdf ? 'PDF document' : isDocx ? 'Word document' : 'Document';
        artifacts.push({ type: 'file', content: url, label });
      }
      // Fallback: if no HTTP URLs found but has data URL, note it
      if (docUrls.length === 0 && resultContent.includes('data:application/')) {
        artifacts.push({ type: 'file', content: 'Document generated (inline)', label: 'Document' });
      }
      break;
    }

    case 'create_presentation': {
      const pptxUrls = resultContent.match(URL_PATTERN) || [];
      for (const url of pptxUrls) {
        artifacts.push({ type: 'file', content: url, label: 'PowerPoint presentation' });
      }
      if (pptxUrls.length === 0 && resultContent.includes('data:application/')) {
        artifacts.push({
          type: 'file',
          content: 'Presentation generated (inline)',
          label: 'Presentation',
        });
      }
      break;
    }

    case 'create_spreadsheet':
    case 'excel_advanced': {
      const xlsxUrls = resultContent.match(URL_PATTERN) || [];
      for (const url of xlsxUrls) {
        artifacts.push({ type: 'file', content: url, label: 'Excel spreadsheet' });
      }
      if (xlsxUrls.length === 0 && resultContent.includes('data:application/')) {
        artifacts.push({
          type: 'file',
          content: 'Spreadsheet generated (inline)',
          label: 'Spreadsheet',
        });
      }
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

    case 'audio_transcribe': {
      if (resultContent.length > 50) {
        artifacts.push({
          type: 'text',
          content: resultContent,
          label: 'Audio transcription',
        });
      }
      break;
    }

    case 'ocr_extract_text': {
      if (resultContent.length > 20) {
        artifacts.push({
          type: 'text',
          content: resultContent,
          label: 'OCR extracted text',
        });
      }
      break;
    }

    case 'extract_table': {
      artifacts.push({
        type: 'data',
        content: resultContent,
        label: 'Extracted table data',
      });
      break;
    }

    case 'generate_diagram': {
      const diagramUrls = resultContent.match(URL_PATTERN) || [];
      for (const url of diagramUrls) {
        artifacts.push({ type: 'image', content: url, label: 'Generated diagram' });
      }
      break;
    }

    case 'math_compute': {
      artifacts.push({
        type: 'data',
        content: resultContent,
        label: 'Math computation result',
      });
      break;
    }

    case 'convert_file': {
      const convertedUrls = resultContent.match(URL_PATTERN) || [];
      for (const url of convertedUrls) {
        artifacts.push({ type: 'file', content: url, label: 'Converted file' });
      }
      break;
    }

    case 'zip_files': {
      const zipUrls = resultContent.match(URL_PATTERN) || [];
      for (const url of zipUrls) {
        artifacts.push({ type: 'file', content: url, label: 'ZIP archive' });
      }
      break;
    }

    default: {
      // Handle Composio tool results (email data, calendar data, etc.)
      if (
        toolName.startsWith('composio_GMAIL_FETCH') ||
        toolName.startsWith('composio_GMAIL_LIST')
      ) {
        if (resultContent.length > 100) {
          artifacts.push({
            type: 'data',
            content: resultContent,
            label: `Email data from ${toolName}`,
          });
        }
      } else if (
        toolName.startsWith('composio_GOOGLECALENDAR_LIST') ||
        toolName.startsWith('composio_GOOGLECALENDAR_FIND') ||
        toolName.startsWith('composio_GOOGLECALENDAR_GET')
      ) {
        if (resultContent.length > 50) {
          artifacts.push({
            type: 'data',
            content: resultContent,
            label: `Calendar data from ${toolName}`,
          });
        }
      } else {
        // Generic URL extraction for any tool
        const urls = resultContent.match(URL_PATTERN) || [];
        const supabaseUrls = resultContent.match(SUPABASE_URL_PATTERN) || [];
        for (const url of supabaseUrls) {
          artifacts.push({ type: 'file', content: url, label: `File from ${toolName}` });
        }
        // Only add non-supabase URLs if no supabase ones found
        if (supabaseUrls.length === 0) {
          for (const url of urls.slice(0, 3)) {
            artifacts.push({ type: 'url', content: url, label: `URL from ${toolName}` });
          }
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

export interface ToolChain {
  name: string;
  description: string;
  tools: string[];
  trigger: string;
  category: 'research' | 'documents' | 'data' | 'media' | 'code' | 'communication' | 'workflow';
}

/**
 * Known tool chains — sequences of tools that work well together.
 * Used for system prompt enrichment so the model knows it CAN chain these.
 */
export const TOOL_CHAINS: ToolChain[] = [
  // ── RESEARCH & CONTENT CREATION ──────────────────────────────────────
  {
    name: 'Research to Presentation',
    description: 'Research a topic, create charts from data, build a presentation',
    tools: ['parallel_research', 'create_chart', 'create_presentation'],
    trigger: 'when user asks to create a presentation/deck about a topic',
    category: 'research',
  },
  {
    name: 'Research to Document',
    description: 'Research a topic, create charts/visuals, generate a PDF or DOCX report',
    tools: ['parallel_research', 'create_chart', 'create_document'],
    trigger: 'when user asks for a report or document about a topic',
    category: 'research',
  },
  {
    name: 'Research to Spreadsheet',
    description: 'Research data, organize findings into a structured spreadsheet',
    tools: ['parallel_research', 'run_code', 'create_spreadsheet'],
    trigger: 'when user asks for research data in spreadsheet form',
    category: 'research',
  },
  {
    name: 'Research to Email Digest',
    description: 'Research a topic, summarize findings, email the digest',
    tools: ['parallel_research', 'composio_GMAIL_SEND_EMAIL'],
    trigger: 'when user asks to research something and email the results',
    category: 'research',
  },
  {
    name: 'Full Creative Pipeline',
    description: 'Research → charts → presentation → export as PDF',
    tools: ['parallel_research', 'create_chart', 'create_presentation', 'pdf_manipulate'],
    trigger: 'when user asks for a comprehensive creative deliverable',
    category: 'research',
  },

  // ── DATA ANALYSIS ────────────────────────────────────────────────────
  {
    name: 'Data Analysis Pipeline',
    description: 'Run code to analyze data, create charts from results, build a spreadsheet',
    tools: ['run_code', 'create_chart', 'create_spreadsheet'],
    trigger: 'when user asks to analyze data and visualize it',
    category: 'data',
  },
  {
    name: 'Web Scrape to Analysis',
    description: 'Fetch a webpage, extract tables, analyze data, create charts',
    tools: ['fetch_url', 'extract_table', 'run_code', 'create_chart'],
    trigger: 'when user asks to analyze data from a website',
    category: 'data',
  },
  {
    name: 'Web Scrape to Spreadsheet',
    description: 'Fetch a webpage, extract tables, export to Excel',
    tools: ['fetch_url', 'extract_table', 'create_spreadsheet'],
    trigger: 'when user asks to export website data to a spreadsheet',
    category: 'data',
  },
  {
    name: 'Data to Report',
    description: 'Analyze data with code, chart the results, generate a PDF report',
    tools: ['run_code', 'create_chart', 'create_document'],
    trigger: 'when user asks to analyze data and produce a report',
    category: 'data',
  },
  {
    name: 'Data to Email Report',
    description: 'Analyze data, chart results, create document, email it',
    tools: ['run_code', 'create_chart', 'create_document', 'composio_GMAIL_SEND_EMAIL'],
    trigger: 'when user asks to analyze data and email the report',
    category: 'data',
  },
  {
    name: 'SQL to Chart',
    description: 'Query data with SQL, visualize results as charts',
    tools: ['sql_query', 'create_chart'],
    trigger: 'when user asks to query data and chart the results',
    category: 'data',
  },
  {
    name: 'SQL to Spreadsheet',
    description: 'Query data, export results to Excel',
    tools: ['sql_query', 'create_spreadsheet'],
    trigger: 'when user asks to export query results to a spreadsheet',
    category: 'data',
  },

  // ── DOCUMENT PROCESSING ──────────────────────────────────────────────
  {
    name: 'PDF Processing Pipeline',
    description: 'Extract PDF content, analyze it, create a summary document',
    tools: ['extract_pdf', 'analyze_text_nlp', 'create_document'],
    trigger: 'when user uploads a PDF and wants analysis or summary',
    category: 'documents',
  },
  {
    name: 'PDF to Spreadsheet',
    description: 'Extract PDF tables, convert to Excel spreadsheet',
    tools: ['extract_pdf', 'extract_table', 'create_spreadsheet'],
    trigger: 'when user wants to extract PDF tables into a spreadsheet',
    category: 'documents',
  },
  {
    name: 'PDF to Email Summary',
    description: 'Extract PDF, summarize content, email the summary',
    tools: ['extract_pdf', 'analyze_text_nlp', 'composio_GMAIL_SEND_EMAIL'],
    trigger: 'when user wants a PDF summarized and emailed',
    category: 'documents',
  },
  {
    name: 'Screenshot to Report',
    description: 'Take a screenshot, analyze it with vision, generate a document',
    tools: ['screenshot', 'analyze_image', 'create_document'],
    trigger: 'when user asks to document or analyze a webpage visually',
    category: 'documents',
  },
  {
    name: 'Screenshot to Email',
    description: 'Capture a webpage screenshot and email it',
    tools: ['screenshot', 'composio_GMAIL_SEND_EMAIL'],
    trigger: 'when user asks to screenshot a page and send it',
    category: 'documents',
  },
  {
    name: 'QR/Barcode to Document',
    description: 'Generate QR codes or barcodes, embed in documents',
    tools: ['generate_qr_code', 'create_document'],
    trigger: 'when user needs QR codes or barcodes in a document',
    category: 'documents',
  },
  {
    name: 'OCR to Document',
    description: 'Extract text from image via OCR, create editable document',
    tools: ['ocr_extract_text', 'create_document'],
    trigger: 'when user wants to convert an image/screenshot to editable text',
    category: 'documents',
  },

  // ── MEDIA PROCESSING ─────────────────────────────────────────────────
  {
    name: 'Media Processing Pipeline',
    description: 'Transcribe audio, process media, create document from content',
    tools: ['audio_transcribe', 'process_media', 'create_document'],
    trigger: 'when user uploads audio/video and wants transcription document',
    category: 'media',
  },
  {
    name: 'Transcription to Email',
    description: 'Transcribe audio/video, email the transcript',
    tools: ['audio_transcribe', 'composio_GMAIL_SEND_EMAIL'],
    trigger: 'when user wants audio transcribed and emailed',
    category: 'media',
  },
  {
    name: 'Transcription to Summary',
    description: 'Transcribe audio, analyze with NLP, create summary document',
    tools: ['audio_transcribe', 'analyze_text_nlp', 'create_document'],
    trigger: 'when user wants meeting notes or key points from audio',
    category: 'media',
  },
  {
    name: 'Image Analysis to Document',
    description: 'Analyze image with vision, generate report document',
    tools: ['analyze_image', 'create_document'],
    trigger: 'when user uploads an image and wants a detailed analysis report',
    category: 'media',
  },

  // ── CODE & DEVOPS ────────────────────────────────────────────────────
  {
    name: 'Code Review Pipeline',
    description: 'Analyze code, check accessibility, fix errors, refactor',
    tools: ['check_accessibility', 'fix_error', 'refactor_code'],
    trigger: 'when user asks for comprehensive code review',
    category: 'code',
  },
  {
    name: 'Code to Documentation',
    description: 'Analyze/generate code, create documentation document',
    tools: ['run_code', 'create_document'],
    trigger: 'when user asks to generate docs from code or analysis',
    category: 'code',
  },
  {
    name: 'Code to GitHub Issue',
    description: 'Analyze code, create GitHub issue for findings',
    tools: ['run_code', 'composio_GITHUB_CREATE_AN_ISSUE'],
    trigger: 'when user finds a bug and wants to file a GitHub issue',
    category: 'code',
  },

  // ── COMMUNICATION & SHARING ──────────────────────────────────────────
  {
    name: 'Document and Email',
    description: 'Create a document (PDF, DOCX, resume), then email it',
    tools: ['create_document', 'composio_GMAIL_SEND_EMAIL'],
    trigger: 'when user asks to create a document AND send/email it',
    category: 'communication',
  },
  {
    name: 'Document and Calendar',
    description: 'Create a document, then add a calendar event related to it',
    tools: ['create_document', 'composio_GOOGLECALENDAR_CREATE_EVENT'],
    trigger: 'when user asks to create a document AND add a calendar event',
    category: 'communication',
  },
  {
    name: 'Spreadsheet and Email',
    description: 'Create a spreadsheet and email it to recipients',
    tools: ['create_spreadsheet', 'composio_GMAIL_SEND_EMAIL'],
    trigger: 'when user asks to create a spreadsheet and email it',
    category: 'communication',
  },
  {
    name: 'Presentation and Email',
    description: 'Create a presentation and email it to recipients',
    tools: ['create_presentation', 'composio_GMAIL_SEND_EMAIL'],
    trigger: 'when user asks to create a presentation and email it',
    category: 'communication',
  },
  {
    name: 'Chart and Email',
    description: 'Create a chart/visualization and email it',
    tools: ['create_chart', 'composio_GMAIL_SEND_EMAIL'],
    trigger: 'when user asks to create a chart and email it',
    category: 'communication',
  },
  {
    name: 'Document and Slack',
    description: 'Create a document and share it to a Slack channel',
    tools: ['create_document', 'composio_SLACK_SEND_MESSAGE'],
    trigger: 'when user asks to create a document and share on Slack',
    category: 'communication',
  },
  {
    name: 'Email Search and Forward',
    description: 'Search for emails and forward relevant ones',
    tools: ['composio_GMAIL_FETCH_EMAILS', 'composio_GMAIL_FORWARD_MESSAGE'],
    trigger: 'when user asks to find emails and forward them',
    category: 'communication',
  },
  {
    name: 'Email to Calendar',
    description: 'Read email details, create calendar event from them',
    tools: ['composio_GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID', 'composio_GOOGLECALENDAR_CREATE_EVENT'],
    trigger: 'when user asks to add an email meeting to calendar',
    category: 'communication',
  },
  {
    name: 'Email to Document',
    description: 'Fetch emails, compile them into a document/report',
    tools: ['composio_GMAIL_FETCH_EMAILS', 'create_document'],
    trigger: 'when user asks to export emails as a document',
    category: 'communication',
  },

  // ── COMPLEX WORKFLOWS ────────────────────────────────────────────────
  {
    name: 'Multi-Action Workflow',
    description: 'Handle multiple tasks in sequence: documents, emails, calendar, etc.',
    tools: ['create_document', 'composio_GMAIL_SEND_EMAIL', 'composio_GOOGLECALENDAR_CREATE_EVENT'],
    trigger: 'when user asks for multiple distinct tasks in one message',
    category: 'workflow',
  },
  {
    name: 'Research and Distribute',
    description: 'Research a topic, create a report, email it AND post to Slack',
    tools: [
      'parallel_research',
      'create_document',
      'composio_GMAIL_SEND_EMAIL',
      'composio_SLACK_SEND_MESSAGE',
    ],
    trigger: 'when user asks to research, document, and distribute findings',
    category: 'workflow',
  },
  {
    name: 'Meeting Prep Workflow',
    description: 'Research topic, create presentation, email attendees, add calendar event',
    tools: [
      'parallel_research',
      'create_chart',
      'create_presentation',
      'composio_GMAIL_SEND_EMAIL',
      'composio_GOOGLECALENDAR_CREATE_EVENT',
    ],
    trigger: 'when user asks to prepare for a meeting with materials',
    category: 'workflow',
  },
  {
    name: 'Invoice Workflow',
    description: 'Create invoice document, email to client, add payment reminder to calendar',
    tools: ['create_document', 'composio_GMAIL_SEND_EMAIL', 'composio_GOOGLECALENDAR_CREATE_EVENT'],
    trigger: 'when user asks to create and send an invoice',
    category: 'workflow',
  },
  {
    name: 'Competitive Analysis',
    description: 'Research competitors, scrape data, create comparison charts, build report',
    tools: ['parallel_research', 'fetch_url', 'extract_table', 'create_chart', 'create_document'],
    trigger: 'when user asks for competitive analysis or comparison',
    category: 'workflow',
  },
  {
    name: 'Website Audit',
    description: 'Screenshot pages, check accessibility, analyze images, generate report',
    tools: ['screenshot', 'check_accessibility', 'analyze_image', 'create_document'],
    trigger: 'when user asks for a website audit or review',
    category: 'workflow',
  },
];

// ============================================================================
// TOOL FALLBACK DEFINITIONS
// ============================================================================

/**
 * When a tool fails, these fallbacks tell the model what alternative to try.
 * Maps tool name → ordered list of alternatives.
 */
export const TOOL_FALLBACKS: Record<string, string[]> = {
  // Research fallbacks
  web_search: ['parallel_research', 'fetch_url'],
  parallel_research: ['web_search', 'fetch_url'],
  fetch_url: ['web_search', 'screenshot'],

  // Document generation fallbacks
  create_document: ['create_spreadsheet'], // if DOCX fails, try spreadsheet
  create_presentation: ['create_document'], // if PPTX fails, create doc instead
  create_spreadsheet: ['create_document'], // if XLSX fails, export as doc

  // Image/media fallbacks
  screenshot: ['capture_webpage', 'fetch_url'],
  capture_webpage: ['screenshot', 'fetch_url'],
  analyze_image: ['ocr_extract_text'],
  ocr_extract_text: ['analyze_image'],
  transform_image: ['create_chart'], // if image transform fails, try chart

  // Data extraction fallbacks
  extract_table: ['run_code', 'fetch_url'],
  extract_pdf: ['ocr_extract_text', 'fetch_url'],
  sql_query: ['run_code'],

  // Code fallbacks
  run_code: ['create_and_run_tool'],
  create_and_run_tool: ['run_code'],

  // Communication fallbacks
  composio_GMAIL_SEND_EMAIL: ['composio_GMAIL_CREATE_EMAIL_DRAFT'],
  composio_SLACK_SEND_MESSAGE: ['composio_GMAIL_SEND_EMAIL'],
};

/**
 * Get fallback tools for a failed tool.
 */
export function getToolFallbacks(toolName: string): string[] {
  return TOOL_FALLBACKS[toolName] || [];
}

// ============================================================================
// CHAIN TELEMETRY
// ============================================================================

export interface ChainExecution {
  chainName: string;
  tools: string[];
  startTime: number;
  endTime?: number;
  status: 'running' | 'completed' | 'partial' | 'failed';
  completedSteps: number;
  totalSteps: number;
  failedTool?: string;
  failureReason?: string;
}

/**
 * Tracks chain executions for telemetry and debugging.
 * Session-scoped, lives alongside ArtifactStore.
 */
export class ChainTelemetry {
  private executions: ChainExecution[] = [];

  /** Start tracking a chain execution */
  startChain(chainName: string, tools: string[]): ChainExecution {
    const execution: ChainExecution = {
      chainName,
      tools,
      startTime: Date.now(),
      status: 'running',
      completedSteps: 0,
      totalSteps: tools.length,
    };
    this.executions.push(execution);
    log.info('Chain started', { chainName, totalSteps: tools.length });
    return execution;
  }

  /** Record a completed step in the current chain */
  stepCompleted(chainName: string): void {
    const exec = this.getRunning(chainName);
    if (exec) {
      exec.completedSteps++;
      if (exec.completedSteps >= exec.totalSteps) {
        exec.status = 'completed';
        exec.endTime = Date.now();
        log.info('Chain completed', {
          chainName,
          durationMs: exec.endTime - exec.startTime,
        });
      }
    }
  }

  /** Record a chain failure */
  stepFailed(chainName: string, toolName: string, reason: string): void {
    const exec = this.getRunning(chainName);
    if (exec) {
      exec.status = exec.completedSteps > 0 ? 'partial' : 'failed';
      exec.failedTool = toolName;
      exec.failureReason = reason;
      exec.endTime = Date.now();
      log.warn('Chain step failed', { chainName, toolName, reason });
    }
  }

  /** Get the currently running chain */
  private getRunning(chainName: string): ChainExecution | undefined {
    return this.executions.find((e) => e.chainName === chainName && e.status === 'running');
  }

  /** Get all chain executions */
  getAll(): ChainExecution[] {
    return [...this.executions];
  }

  /** Get summary stats */
  getStats(): {
    total: number;
    completed: number;
    partial: number;
    failed: number;
    avgDurationMs: number;
  } {
    const finished = this.executions.filter((e) => e.endTime);
    const completed = this.executions.filter((e) => e.status === 'completed');
    const durations = finished.map((e) => (e.endTime || 0) - e.startTime);
    const avgDuration =
      durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    return {
      total: this.executions.length,
      completed: completed.length,
      partial: this.executions.filter((e) => e.status === 'partial').length,
      failed: this.executions.filter((e) => e.status === 'failed').length,
      avgDurationMs: Math.round(avgDuration),
    };
  }

  /** Clear all telemetry */
  clear(): void {
    this.executions = [];
  }
}

// ============================================================================
// CHAIN DETECTION
// ============================================================================

/**
 * Detect which chain pattern a sequence of tool calls matches.
 * Used to auto-tag chains for telemetry and to suggest next steps.
 */
export function detectChainPattern(executedTools: string[]): ToolChain | null {
  if (executedTools.length < 2) return null;

  // Find the best matching chain (most tools matched in order)
  let bestMatch: ToolChain | null = null;
  let bestScore = 0;

  for (const chain of TOOL_CHAINS) {
    let score = 0;
    let chainIdx = 0;
    for (const tool of executedTools) {
      if (chainIdx < chain.tools.length && tool === chain.tools[chainIdx]) {
        score++;
        chainIdx++;
      }
    }
    // Score must be at least 2 and match at least 50% of the chain
    if (score >= 2 && score > bestScore && score >= chain.tools.length * 0.5) {
      bestMatch = chain;
      bestScore = score;
    }
  }

  return bestMatch;
}

/**
 * Suggest the next tool in a chain based on what's been executed so far.
 */
export function suggestNextTool(executedTools: string[]): string | null {
  const chain = detectChainPattern(executedTools);
  if (!chain) return null;

  const lastExecuted = executedTools[executedTools.length - 1];
  const lastIdx = chain.tools.lastIndexOf(lastExecuted);
  if (lastIdx >= 0 && lastIdx < chain.tools.length - 1) {
    return chain.tools[lastIdx + 1];
  }
  return null;
}

// ============================================================================
// SYSTEM PROMPT ORCHESTRATION CONTEXT
// ============================================================================

/**
 * Generate orchestration instructions for the system prompt.
 * Teaches the model about tool chaining, fallbacks, and artifact reuse.
 */
export function getOrchestrationPrompt(artifactStore?: ArtifactStore): string {
  const sections: string[] = [];

  // Group chains by category for readable system prompt
  const byCategory = new Map<string, ToolChain[]>();
  for (const chain of TOOL_CHAINS) {
    const list = byCategory.get(chain.category) || [];
    list.push(chain);
    byCategory.set(chain.category, list);
  }

  const chainLines: string[] = [];
  for (const [category, chains] of byCategory) {
    chainLines.push(`\n  [${category.toUpperCase()}]`);
    for (const chain of chains) {
      chainLines.push(`  - **${chain.name}**: ${chain.tools.join(' → ')} — ${chain.trigger}`);
    }
  }

  // Build fallback table
  const fallbackLines = Object.entries(TOOL_FALLBACKS)
    .map(([tool, fallbacks]) => `  - ${tool} → try: ${fallbacks.join(', ')}`)
    .join('\n');

  sections.push(`<tool_orchestration>
You have access to a powerful set of tools that work TOGETHER as an integrated system.
When a user makes a complex request, you should chain multiple tools together to deliver
complete results — don't just use one tool when a combination would be better.

KEY PRINCIPLE: Tool outputs are artifacts. URLs, files, data, and text from one tool
can be passed as input to another tool. Always look for opportunities to chain tools.
Any tool that generates a file (PDF, DOCX, XLSX, PPTX, images, CSV, etc.) automatically
gets a hosted download URL — you can use that URL in emails, Slack messages, calendar
events, or as input to other tools.

## TOOL CHAIN LIBRARY (${TOOL_CHAINS.length} chains)
${chainLines.join('\n')}

## ARTIFACT CHAINING RULES
1. When create_chart returns a URL, pass it as image_url in create_presentation slides
2. When parallel_research returns findings, use them as content for create_document or create_presentation
3. When run_code produces data, feed it into create_chart for visualization
4. When screenshot or capture_webpage returns an image, pass it to analyze_image for analysis
5. When extract_pdf returns text, feed it to analyze_text_nlp or run_code for analysis
6. When any tool returns a URL, it can be embedded in documents, presentations, or emails
7. When fetch_url returns HTML with tables, use extract_table to structure the data
8. When create_document/create_spreadsheet/create_presentation generates a file, use the download URL as attachment_urls in email or as a link in Slack/calendar
9. When a user asks to create something AND email/share/send it, complete ALL tasks in sequence
10. For multi-task requests, handle each task in order using the appropriate tools
11. When audio_transcribe produces text, it can feed into create_document, analyze_text_nlp, or be emailed directly
12. When sql_query returns data, it can feed into create_chart, create_spreadsheet, or create_document
13. When ocr_extract_text extracts text from an image, use it to create an editable document
14. When generate_qr_code produces an image URL, embed it in documents or email it
15. When composio_GMAIL_FETCH_EMAILS returns email data, it can be compiled into documents or fed to analysis tools

## TOOL FALLBACKS (Automatic Recovery)
When a tool fails, try the alternative instead of giving up:
${fallbackLines}

When a tool fails:
1. Check if there's a fallback tool listed above
2. Try the fallback with equivalent parameters
3. If the fallback also fails, explain the issue to the user
4. NEVER silently skip a step — either recover or explain

## MULTI-TASK WORKFLOW
When a user asks for multiple things in one message (e.g., "create a resume,
update my calendar, and email it to me"), handle ALL tasks sequentially:
1. Generate the document first (create_document) — note the download URL from the result
2. Use the download URL as attachment_urls in composio_GMAIL_SEND_EMAIL
3. Create calendar events with composio_GOOGLECALENDAR_CREATE_EVENT
4. Show action-preview cards for each action that needs user approval (emails, calendar events)
Never stop after completing only the first task — complete the ENTIRE request.

## CROSS-PLATFORM DISTRIBUTION
Any generated file can be distributed to ANY connected platform:
- **Email**: Use attachment_urls with composio_GMAIL_SEND_EMAIL or composio_OUTLOOK_SEND_EMAIL
- **Slack**: Share the download URL in a composio_SLACK_SEND_MESSAGE
- **Calendar**: Include the URL in calendar event description
- **GitHub**: Reference in issue/PR descriptions via composio_GITHUB_*
- **Google Drive**: Upload via composio_GOOGLEDRIVE_* tools
- **Discord**: Share URL in composio_DISCORD_* message

## PARALLEL EXECUTION
When tool calls are independent (don't depend on each other's results),
call them simultaneously. Examples:
- Generate multiple charts at once from different datasets
- Run web_search AND create_chart simultaneously if they're independent
- Fetch multiple URLs in parallel
- Create a document AND schedule a calendar event if document content is already known

## BATCH OPERATIONS
For repetitive tasks, maximize efficiency:
- Use composio_GMAIL_BATCH_MODIFY_MESSAGES for bulk email operations
- Create multiple documents by calling create_document multiple times with different formats
- Use parallel_research to gather info from multiple sources simultaneously
- Process multiple data sets in parallel with run_code

IMPORTANT: Always complete the full chain. If a user asks for "a presentation about AI trends,"
don't just research — research, THEN create charts, THEN build the presentation with those charts.
If they say "and email it to me," the chain isn't done until the email is sent.
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
    'capture_webpage',
    'extract_pdf',
    'extract_table',
    'analyze_image',
    'analyze_text_nlp',
    'sql_query',
    'ocr_extract_text',
    'audio_transcribe',
    'generate_qr_code',
    'generate_barcode',
    // Composio read operations
    'composio_GMAIL_FETCH_EMAILS',
    'composio_GMAIL_FETCH_MESSAGE_BY_MESSAGE_ID',
    'composio_GMAIL_FETCH_MESSAGE_BY_THREAD_ID',
    'composio_GMAIL_LIST_THREADS',
    'composio_GOOGLECALENDAR_LIST_EVENTS',
    'composio_GOOGLECALENDAR_FIND_EVENT',
  ]);

  // Tools that typically consume artifacts from other tools
  const CONSUMER_TOOLS = new Set([
    'create_presentation',
    'create_document',
    'create_spreadsheet',
    'excel_advanced',
    'pdf_manipulate',
    'transform_image',
    // Composio write operations that often depend on generated artifacts
    'composio_GMAIL_SEND_EMAIL',
    'composio_GMAIL_CREATE_EMAIL_DRAFT',
    'composio_GMAIL_FORWARD_MESSAGE',
    'composio_SLACK_SEND_MESSAGE',
    'composio_GOOGLECALENDAR_CREATE_EVENT',
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
