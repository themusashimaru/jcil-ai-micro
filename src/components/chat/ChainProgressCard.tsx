'use client';

/**
 * CHAIN PROGRESS CARD
 *
 * Displays real-time workflow progress as tools execute in a chain.
 * Shows each step with status indicators (pending, running, complete, failed).
 * Matches the ActionPreviewCard / DestructiveActionCard design language.
 */

export interface ChainStep {
  name: string; // Tool name or human-readable label
  label: string; // Display label
  status: 'pending' | 'running' | 'complete' | 'failed';
  duration?: number; // ms
  output?: string; // Brief output summary
}

export interface ChainProgressData {
  chainName: string; // e.g., "Research to Presentation"
  steps: ChainStep[];
  status: 'running' | 'completed' | 'partial' | 'failed';
  startedAt?: number;
}

interface ChainProgressCardProps {
  data: ChainProgressData;
}

// Tool name → human-readable label + icon
const TOOL_DISPLAY: Record<string, { label: string; icon: string }> = {
  parallel_research: { label: 'Researching', icon: '\u{1F50D}' },
  web_search: { label: 'Searching the web', icon: '\u{1F310}' },
  fetch_url: { label: 'Fetching page', icon: '\u{1F4E5}' },
  create_chart: { label: 'Creating chart', icon: '\u{1F4CA}' },
  create_document: { label: 'Generating document', icon: '\u{1F4C4}' },
  create_presentation: { label: 'Building presentation', icon: '\u{1F4CA}' },
  create_spreadsheet: { label: 'Creating spreadsheet', icon: '\u{1F4CA}' },
  excel_advanced: { label: 'Processing spreadsheet', icon: '\u{1F4CA}' },
  run_code: { label: 'Running code', icon: '\u{1F4BB}' },
  screenshot: { label: 'Taking screenshot', icon: '\u{1F4F7}' },
  capture_webpage: { label: 'Capturing page', icon: '\u{1F4F7}' },
  analyze_image: { label: 'Analyzing image', icon: '\u{1F441}\uFE0F' },
  extract_pdf: { label: 'Extracting PDF', icon: '\u{1F4C3}' },
  extract_table: { label: 'Extracting table data', icon: '\u{1F5C2}\uFE0F' },
  analyze_text_nlp: { label: 'Analyzing text', icon: '\u{1F9E0}' },
  audio_transcribe: { label: 'Transcribing audio', icon: '\u{1F3A4}' },
  ocr_extract_text: { label: 'Reading text from image', icon: '\u{1F524}' },
  generate_qr_code: { label: 'Generating QR code', icon: '\u{1F4F1}' },
  sql_query: { label: 'Querying data', icon: '\u{1F5C3}\uFE0F' },
  pdf_manipulate: { label: 'Processing PDF', icon: '\u{1F4C4}' },
  transform_image: { label: 'Transforming image', icon: '\u{1F3A8}' },
  composio_GMAIL_SEND_EMAIL: { label: 'Sending email', icon: '\u2709\uFE0F' },
  composio_GMAIL_CREATE_EMAIL_DRAFT: { label: 'Creating draft', icon: '\u2709\uFE0F' },
  composio_GMAIL_FETCH_EMAILS: { label: 'Fetching emails', icon: '\u{1F4E8}' },
  composio_GMAIL_FORWARD_MESSAGE: { label: 'Forwarding email', icon: '\u{1F4E4}' },
  composio_GOOGLECALENDAR_CREATE_EVENT: { label: 'Creating event', icon: '\u{1F4C5}' },
  composio_GOOGLECALENDAR_LIST_EVENTS: { label: 'Listing events', icon: '\u{1F4C5}' },
  composio_SLACK_SEND_MESSAGE: { label: 'Sending to Slack', icon: '\u{1F4AC}' },
  composio_GITHUB_CREATE_AN_ISSUE: { label: 'Creating issue', icon: '\u{1F41B}' },
};

function getToolDisplay(toolName: string): { label: string; icon: string } {
  if (TOOL_DISPLAY[toolName]) return TOOL_DISPLAY[toolName];
  // Clean up composio prefix for display
  const clean = toolName
    .replace(/^composio_/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { label: clean, icon: '\u{1F527}' };
}

function StatusIcon({ status }: { status: ChainStep['status'] }) {
  switch (status) {
    case 'complete':
      return <span className="text-emerald-400 text-sm">{'\u2713'}</span>;
    case 'running':
      return (
        <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-white/60 animate-spin" />
      );
    case 'failed':
      return <span className="text-red-400 text-sm">{'\u2717'}</span>;
    default:
      return <span className="w-3.5 h-3.5 rounded-full border border-zinc-600 inline-block" />;
  }
}

function ChainStatusBadge({ status }: { status: ChainProgressData['status'] }) {
  const config = {
    running: { text: 'Working', bg: 'bg-zinc-700', color: 'text-white' },
    completed: { text: 'Complete', bg: 'bg-emerald-900/40', color: 'text-emerald-300' },
    partial: { text: 'Partial', bg: 'bg-amber-900/40', color: 'text-amber-300' },
    failed: { text: 'Failed', bg: 'bg-red-900/40', color: 'text-red-300' },
  }[status];

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.bg} ${config.color}`}>
      {config.text}
    </span>
  );
}

export default function ChainProgressCard({ data }: ChainProgressCardProps) {
  const completedCount = data.steps.filter((s) => s.status === 'complete').length;
  const totalCount = data.steps.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="my-4 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-700 max-w-[500px]">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 bg-zinc-800 border-b border-zinc-700">
        <span className="text-lg">{'\u26A1'}</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm truncate">{data.chainName}</div>
          <div className="text-xs text-gray-400">
            {completedCount}/{totalCount} steps
          </div>
        </div>
        <ChainStatusBadge status={data.status} />
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-zinc-800">
        <div
          className="h-full transition-all duration-500 ease-out bg-emerald-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Steps */}
      <div className="p-3 space-y-0">
        {data.steps.map((step, i) => {
          const display = getToolDisplay(step.name);
          const isLast = i === data.steps.length - 1;
          return (
            <div key={`${step.name}-${i}`} className="flex items-start gap-3">
              {/* Vertical line + icon */}
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center w-5 h-5 mt-0.5">
                  <StatusIcon status={step.status} />
                </div>
                {!isLast && (
                  <div
                    className={`w-px h-5 ${
                      step.status === 'complete' ? 'bg-emerald-500/40' : 'bg-zinc-700'
                    }`}
                  />
                )}
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0 pb-1">
                <div
                  className={`text-sm ${
                    step.status === 'running'
                      ? 'text-white font-medium'
                      : step.status === 'complete'
                        ? 'text-gray-400'
                        : step.status === 'failed'
                          ? 'text-red-400'
                          : 'text-gray-500'
                  }`}
                >
                  <span className="mr-1.5">{display.icon}</span>
                  {step.status === 'running'
                    ? (step.label || display.label) + '...'
                    : step.label || display.label}
                </div>
                {step.output && step.status === 'complete' && (
                  <div className="text-xs text-gray-500 truncate mt-0.5">{step.output}</div>
                )}
                {step.duration && step.status === 'complete' && (
                  <div className="text-xs text-gray-600 mt-0.5">
                    {(step.duration / 1000).toFixed(1)}s
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// PARSING HELPERS
// ============================================================================

/**
 * Parse a chain-progress code block from markdown.
 * Format: ```chain-progress\n{JSON}\n```
 */
export function parseChainProgress(block: string): ChainProgressData | null {
  try {
    const match = block.match(/```chain-progress\n([\s\S]*?)\n```/);
    if (!match) return null;
    const data = JSON.parse(match[1]);
    if (!data.chainName || !Array.isArray(data.steps)) return null;
    return data as ChainProgressData;
  } catch {
    return null;
  }
}

/**
 * Check if content contains a chain-progress block.
 */
export function hasChainProgress(content: string): boolean {
  return content.includes('```chain-progress');
}
