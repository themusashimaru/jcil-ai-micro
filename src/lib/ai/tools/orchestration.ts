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
// TOOL DISPLAY LABELS (shared between backend chain progress + frontend UI)
// ============================================================================

/** Human-readable labels for tool execution status messages */
const TOOL_DISPLAY_LABELS: Record<string, string> = {
  // Research & content
  web_search: 'Searching the web',
  fetch_url: 'Fetching page',
  // Documents & media
  create_chart: 'Creating chart',
  create_document: 'Generating document',
  create_presentation: 'Building presentation',
  excel_advanced: 'Processing spreadsheet',
  pdf_manipulate: 'Processing PDF',
  extract_pdf: 'Extracting PDF',
  extract_table: 'Extracting table data',
  // Code & analysis
  run_code: 'Running code',
  create_and_run_tool: 'Running custom tool',
  analyze_text_nlp: 'Analyzing text',
  analyze_sequence: 'Analyzing sequence',
  sql_query: 'Querying data',
  math_compute: 'Computing',
  // Media
  browser_visit: 'Browsing page',
  analyze_image: 'Analyzing image',
  transform_image: 'Transforming image',
  generate_qr_code: 'Generating QR code',
  generate_barcode: 'Generating barcode',
  generate_diagram: 'Generating diagram',
  audio_transcribe: 'Transcribing audio',
  ocr_extract_text: 'Reading text from image',
  process_media: 'Processing media',
  // File operations
  convert_file: 'Converting file',
  zip_files: 'Creating ZIP',
  // Composio tools
  composio_GMAIL_SEND_EMAIL: 'Sending email',
  composio_GMAIL_CREATE_EMAIL_DRAFT: 'Creating draft',
  composio_GMAIL_FETCH_EMAILS: 'Fetching emails',
  composio_GMAIL_LIST_EMAILS: 'Listing emails',
  composio_GMAIL_FORWARD_MESSAGE: 'Forwarding email',
  composio_GMAIL_REPLY_TO_THREAD: 'Replying to thread',
  composio_GOOGLECALENDAR_CREATE_EVENT: 'Creating calendar event',
  composio_GOOGLECALENDAR_LIST_EVENTS: 'Listing events',
  composio_GOOGLECALENDAR_FIND_EVENT: 'Finding event',
  composio_SLACK_SEND_MESSAGE: 'Sending to Slack',
  composio_GITHUB_CREATE_AN_ISSUE: 'Creating GitHub issue',
  composio_GOOGLEDRIVE_UPLOAD_FILE: 'Uploading to Drive',
  spawn_agents: 'Delegating to sub-agents',
};

/**
 * Get a human-readable display label for a tool name.
 * Falls back to cleaned-up tool name if no mapping exists.
 */
export function getToolDisplayLabel(toolName: string): string {
  if (TOOL_DISPLAY_LABELS[toolName]) return TOOL_DISPLAY_LABELS[toolName];

  // Clean up composio prefix for display
  return toolName
    .replace(/^composio_/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
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

    case 'web_search':
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
    tools: ['web_search', 'create_chart', 'create_presentation'],
    trigger: 'when user asks to create a presentation/deck about a topic',
    category: 'research',
  },
  {
    name: 'Research to Document',
    description: 'Research a topic, create charts/visuals, generate a PDF or DOCX report',
    tools: ['web_search', 'create_chart', 'create_document'],
    trigger: 'when user asks for a report or document about a topic',
    category: 'research',
  },
  {
    name: 'Research to Spreadsheet',
    description: 'Research data, organize findings into a structured spreadsheet',
    tools: ['web_search', 'run_code', 'excel_advanced'],
    trigger: 'when user asks for research data in spreadsheet form',
    category: 'research',
  },
  {
    name: 'Research to Email Digest',
    description: 'Research a topic, summarize findings, email the digest',
    tools: ['web_search', 'composio_GMAIL_SEND_EMAIL'],
    trigger: 'when user asks to research something and email the results',
    category: 'research',
  },
  {
    name: 'Full Creative Pipeline',
    description: 'Research → charts → presentation → export as PDF',
    tools: ['web_search', 'create_chart', 'create_presentation', 'pdf_manipulate'],
    trigger: 'when user asks for a comprehensive creative deliverable',
    category: 'research',
  },

  // ── DATA ANALYSIS ────────────────────────────────────────────────────
  {
    name: 'Data Analysis Pipeline',
    description: 'Run code to analyze data, create charts from results, build a spreadsheet',
    tools: ['run_code', 'create_chart', 'excel_advanced'],
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
    tools: ['fetch_url', 'extract_table', 'excel_advanced'],
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
    tools: ['sql_query', 'excel_advanced'],
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
    tools: ['extract_pdf', 'extract_table', 'excel_advanced'],
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
    tools: ['browser_visit', 'analyze_image', 'create_document'],
    trigger: 'when user asks to document or analyze a webpage visually',
    category: 'documents',
  },
  {
    name: 'Screenshot to Email',
    description: 'Capture a webpage screenshot and email it',
    tools: ['browser_visit', 'composio_GMAIL_SEND_EMAIL'],
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
    tools: ['excel_advanced', 'composio_GMAIL_SEND_EMAIL'],
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
      'web_search',
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
      'web_search',
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
    tools: ['web_search', 'fetch_url', 'extract_table', 'create_chart', 'create_document'],
    trigger: 'when user asks for competitive analysis or comparison',
    category: 'workflow',
  },
  {
    name: 'Website Audit',
    description: 'Screenshot pages, check accessibility, analyze images, generate report',
    tools: ['browser_visit', 'check_accessibility', 'analyze_image', 'create_document'],
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
  web_search: ['fetch_url'],
  fetch_url: ['web_search', 'browser_visit'],

  // Document generation fallbacks
  create_document: ['excel_advanced'], // if DOCX fails, try spreadsheet
  create_presentation: ['create_document'], // if PPTX fails, create doc instead
  excel_advanced: ['create_document'], // if XLSX fails, export as doc

  // Image/media fallbacks
  browser_visit: ['fetch_url'],
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
// COMPENSATING TRANSACTIONS (ROLLBACK)
// ============================================================================

/**
 * Maps tools that create side effects to tools that can undo them.
 * Used to offer rollback when a multi-step workflow fails partway.
 */
export const COMPENSATING_ACTIONS: Record<
  string,
  {
    undoTool: string;
    description: string;
  }
> = {
  composio_GMAIL_SEND_EMAIL: {
    undoTool: 'composio_GMAIL_MOVE_TO_TRASH',
    description: 'Move sent email to Trash',
  },
  composio_GMAIL_CREATE_EMAIL_DRAFT: {
    undoTool: 'composio_GMAIL_DELETE_DRAFT',
    description: 'Delete the draft',
  },
  composio_GOOGLECALENDAR_CREATE_EVENT: {
    undoTool: 'composio_GOOGLECALENDAR_DELETE_EVENT',
    description: 'Delete the calendar event',
  },
  composio_SLACK_SEND_MESSAGE: {
    undoTool: 'composio_SLACK_DELETE_MESSAGE',
    description: 'Delete the Slack message',
  },
  composio_GITHUB_CREATE_AN_ISSUE: {
    undoTool: 'composio_GITHUB_UPDATE_AN_ISSUE',
    description: 'Close the GitHub issue',
  },
  composio_GMAIL_ADD_LABEL_TO_EMAIL: {
    undoTool: 'composio_GMAIL_ADD_LABEL_TO_EMAIL',
    description: 'Remove the label (reverse operation)',
  },
};

/**
 * Check if a tool has a compensating (undo) action available.
 */
export function hasCompensatingAction(toolName: string): boolean {
  return toolName in COMPENSATING_ACTIONS;
}

/**
 * Get the compensating action details for a tool.
 */
export function getCompensatingAction(
  toolName: string
): (typeof COMPENSATING_ACTIONS)[string] | null {
  return COMPENSATING_ACTIONS[toolName] || null;
}

/**
 * Build rollback instructions for Claude when a chain fails midway.
 * Lists what was completed and what can be undone.
 */
export function buildRollbackContext(
  completedTools: Array<{ name: string; params: Record<string, unknown> }>
): string {
  if (completedTools.length === 0) return '';

  const undoable: string[] = [];
  const permanent: string[] = [];

  for (const tool of completedTools) {
    const comp = COMPENSATING_ACTIONS[tool.name];
    if (comp) {
      undoable.push(`- ${tool.name}: Can undo via ${comp.undoTool} (${comp.description})`);
    } else {
      const label = tool.name.replace(/^composio_/, '').replace(/_/g, ' ');
      permanent.push(`- ${label}: Already completed (cannot be automatically undone)`);
    }
  }

  const lines = [
    '\n<rollback_context>',
    'The workflow failed partway. Here is what was already done:',
  ];
  if (undoable.length > 0) {
    lines.push('\nReversible (can offer to undo):', ...undoable);
  }
  if (permanent.length > 0) {
    lines.push('\nNot automatically reversible:', ...permanent);
  }
  lines.push('</rollback_context>');
  return lines.join('\n');
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
 *
 * DESIGN PHILOSOPHY (Updated Mar 2026):
 * Opus 4.6 / Sonnet 4.6 inherently understand tool chaining, fallback strategies,
 * and artifact reuse. We no longer enumerate chain definitions or step-by-step
 * workflows in the prompt. Instead, we provide only the minimal context the model
 * cannot infer from tool schemas alone (scheduled action JSON format for the
 * frontend parser, and artifact context from the current session).
 *
 * The TOOL_CHAINS, TOOL_FALLBACKS, and other data structures above are still used
 * by server-side code (telemetry, chain detection, rollback) — they just aren't
 * injected into the system prompt anymore.
 */
export function getOrchestrationPrompt(artifactStore?: ArtifactStore): string {
  const sections: string[] = [];

  sections.push(`<tool_orchestration>
When a user asks to schedule an action for a specific time, show a scheduled-action block:
\`\`\`scheduled-action
{
  "action": "Action name",
  "platform": "Platform",
  "summary": "What will happen",
  "scheduledFor": "ISO 8601 datetime",
  "scheduledDisplay": "Human-readable time",
  "timezone": "IANA timezone",
  "toolName": "tool_name",
  "toolParams": {},
  "recurring": "once|daily|weekly|biweekly|monthly|quarterly"
}
\`\`\`
Wait for user confirmation before scheduling.
</tool_orchestration>`);

  sections.push(`<agent_orchestration>
You have the ability to spawn parallel sub-agents via the spawn_agents tool. Each sub-agent is a full Opus instance with access to all tools.

When to use spawn_agents:
- Multiple independent research tasks (e.g., "compare X, Y, and Z" — spawn 3 agents)
- Complex requests with separable sub-tasks (research + document creation)
- Gathering information from multiple sources simultaneously
- Any time parallel execution saves meaningful time over sequential

When NOT to use spawn_agents:
- Simple sequential tool chains (just call tools directly)
- Tasks with strong dependencies between steps (results from step 1 feed step 2)
- Single, focused requests that don't benefit from parallelism

You have full autonomy to decide when parallelism helps. Trust your judgment. Each sub-agent costs tokens, so use it when the value is clear. Max 5 concurrent agents.

Sub-agents can use ANY tool (web_search, run_code, create_chart, create_document, etc.) and chain tools within their own execution. They cannot spawn further sub-agents (no recursion).

Give each agent a clear, specific task with all context it needs — sub-agents have no conversation history.
</agent_orchestration>`);

  // Add artifact context if there are any from the current session
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
    'web_search',
    'fetch_url',
    'run_code',
    'create_chart',
    'browser_visit',
    'browser_visit',
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
    'excel_advanced',
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
