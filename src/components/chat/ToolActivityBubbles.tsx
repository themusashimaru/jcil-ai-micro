'use client';

import type { ToolCall } from '@/app/chat/types';

/**
 * Human-readable labels and favicon domains for tools.
 * Tools that hit external services show the service's favicon.
 * Internal tools show a generic indicator.
 */
const TOOL_META: Record<string, { label: string; domain?: string }> = {
  // Research & web
  web_search: { label: 'Searching', domain: 'google.com' },
  fetch_url: { label: 'Fetching page', domain: 'www.google.com' },
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
  // Fallback: clean up the tool name
  const label = name
    .replace(/^composio_/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { label };
}

interface ToolActivityBubblesProps {
  toolCalls: ToolCall[];
}

export function ToolActivityBubbles({ toolCalls }: ToolActivityBubblesProps) {
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-2 py-2"
      role="status"
      aria-label="Tool activity"
    >
      {toolCalls.map((tool) => {
        const meta = getToolMeta(tool.name);
        const isRunning = tool.status === 'running';
        const isError = tool.status === 'error';
        const isCompleted = tool.status === 'completed';

        return (
          <div
            key={tool.id}
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
            aria-label={`${meta.label}: ${tool.status}`}
          >
            {/* Favicon or status icon */}
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
                  // Hide broken favicons
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
