'use client';

import type { ToolCall } from '@/app/chat/types';

/**
 * Human-readable labels and favicon domains for tools.
 * Tools that hit external services show the service's favicon.
 * Internal tools show a generic indicator.
 */
const TOOL_META: Record<string, { label: string; domain?: string }> = {
  // Research & web
  web_search: { label: 'Searching the web', domain: 'google.com' },
  fetch_url: { label: 'Reading sources', domain: 'www.google.com' },
  browser_visit: { label: 'Browsing', domain: 'www.google.com' },
  extract_pdf_url: { label: 'Reading PDF', domain: 'pdf.org' },
  // Documents
  create_document: { label: 'Writing document' },
  create_presentation: { label: 'Building slides' },
  create_chart: { label: 'Creating chart', domain: 'quickchart.io' },
  excel_advanced: { label: 'Processing spreadsheet' },
  pdf_manipulate: { label: 'Processing PDF' },
  extract_pdf: { label: 'Extracting PDF' },
  extract_table: { label: 'Extracting table' },
  // Code & compute
  run_code: { label: 'Running code', domain: 'e2b.dev' },
  e2b_visualize: { label: 'Creating chart', domain: 'e2b.dev' },
  create_and_run_tool: { label: 'Custom tool', domain: 'e2b.dev' },
  sql_query: { label: 'Querying data' },
  math_compute: { label: 'Computing' },
  analyze_text_nlp: { label: 'Analyzing text' },
  analyze_sequence: { label: 'Analyzing sequence' },
  // Media
  analyze_image: { label: 'Analyzing image' },
  transform_image: { label: 'Transforming image' },
  generate_qr_code: { label: 'Generating QR' },
  generate_diagram: { label: 'Drawing diagram', domain: 'mermaid.ink' },
  audio_transcribe: { label: 'Transcribing' },
  ocr_extract_text: { label: 'Reading image' },
  // Integrations
  composio_GMAIL_SEND_EMAIL: { label: 'Sending email', domain: 'gmail.com' },
  composio_GMAIL_FETCH_EMAILS: { label: 'Fetching emails', domain: 'gmail.com' },
  composio_GMAIL_LIST_EMAILS: { label: 'Listing emails', domain: 'gmail.com' },
  composio_GOOGLECALENDAR_CREATE_EVENT: { label: 'Calendar event', domain: 'calendar.google.com' },
  composio_GOOGLECALENDAR_LIST_EVENTS: { label: 'Listing events', domain: 'calendar.google.com' },
  composio_SLACK_SEND_MESSAGE: { label: 'Sending to Slack', domain: 'slack.com' },
  composio_GITHUB_CREATE_AN_ISSUE: { label: 'GitHub issue', domain: 'github.com' },
  composio_GOOGLEDRIVE_UPLOAD_FILE: { label: 'Uploading to Drive', domain: 'drive.google.com' },
  spawn_agents: { label: 'Delegating tasks' },
};

function getToolMeta(name: string): { label: string; domain?: string } {
  if (TOOL_META[name]) return TOOL_META[name];
  const label = name
    .replace(/^composio_/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { label };
}

/** Group tool calls by name, tracking counts and aggregate status */
interface ToolGroup {
  name: string;
  total: number;
  running: number;
  completed: number;
  errored: number;
}

function groupToolCalls(toolCalls: ToolCall[]): ToolGroup[] {
  const map = new Map<string, ToolGroup>();
  for (const tc of toolCalls) {
    let group = map.get(tc.name);
    if (!group) {
      group = { name: tc.name, total: 0, running: 0, completed: 0, errored: 0 };
      map.set(tc.name, group);
    }
    group.total++;
    if (tc.status === 'running') group.running++;
    else if (tc.status === 'completed') group.completed++;
    else if (tc.status === 'error') group.errored++;
  }
  return Array.from(map.values());
}

interface ToolActivityBubblesProps {
  toolCalls: ToolCall[];
}

export function ToolActivityBubbles({ toolCalls }: ToolActivityBubblesProps) {
  if (!toolCalls || toolCalls.length === 0) return null;

  const groups = groupToolCalls(toolCalls);

  return (
    <div
      className="flex flex-wrap items-center gap-2 py-2"
      role="status"
      aria-label="Tool activity"
    >
      {groups.map((group) => {
        const meta = getToolMeta(group.name);
        const isRunning = group.running > 0;
        const isError = !isRunning && group.errored > 0;
        const isCompleted = !isRunning && !isError && group.completed === group.total;

        return (
          <div
            key={group.name}
            className={`
              inline-flex items-center gap-2 rounded-full px-3 py-1.5
              text-xs font-medium transition-all duration-300
              ${
                isRunning
                  ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                  : isError
                    ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                    : isCompleted
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/30'
              }
            `}
            aria-label={`${meta.label}: ${isRunning ? 'running' : isCompleted ? 'completed' : isError ? 'error' : 'pending'}${group.total > 1 ? ` (${group.total})` : ''}`}
          >
            {/* Favicon or status dot */}
            {meta.domain ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://www.google.com/s2/favicons?domain=${meta.domain}&sz=32`}
                alt=""
                width={16}
                height={16}
                className={`rounded-full ${isRunning ? 'animate-pulse' : ''} ${isCompleted || isError ? 'opacity-60' : ''}`}
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <span
                className={`
                  inline-block w-4 h-4 rounded-full
                  ${
                    isRunning
                      ? 'bg-blue-400 animate-pulse'
                      : isError
                        ? 'bg-red-400'
                        : isCompleted
                          ? 'bg-emerald-400'
                          : 'bg-zinc-500'
                  }
                `}
              />
            )}

            {/* Label */}
            <span className={isCompleted || isError ? 'opacity-70' : ''}>{meta.label}</span>

            {/* Count badge when > 1 */}
            {group.total > 1 && (
              <span
                className={`
                  inline-flex items-center justify-center min-w-[18px] h-[18px]
                  rounded-full px-1 text-[10px] font-bold leading-none
                  ${
                    isRunning
                      ? 'bg-blue-400/30 text-blue-200'
                      : isCompleted
                        ? 'bg-emerald-400/30 text-emerald-200'
                        : isError
                          ? 'bg-red-400/30 text-red-200'
                          : 'bg-zinc-400/30 text-zinc-300'
                  }
                `}
              >
                {group.total}
              </span>
            )}

            {/* Running spinner */}
            {isRunning && (
              <svg
                className="w-3 h-3 animate-spin text-blue-300"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray="60"
                  strokeDashoffset="20"
                  strokeLinecap="round"
                />
              </svg>
            )}

            {/* Completed check */}
            {isCompleted && (
              <svg
                className="w-3 h-3 text-emerald-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            )}

            {/* Error X */}
            {isError && (
              <svg
                className="w-3 h-3 text-red-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}
