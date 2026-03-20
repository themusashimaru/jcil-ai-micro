'use client';

import type { ToolCall } from '@/app/chat/types';

/**
 * Grok-style tool activity strip — minimal favicon row
 * Shows small animated favicons for active tools during streaming.
 */

/** Map tool names to favicon domains */
const TOOL_DOMAINS: Record<string, string> = {
  web_search: 'google.com',
  fetch_url: 'google.com',
  browser_visit: 'google.com',
  extract_pdf_url: 'adobe.com',
  create_chart: 'quickchart.io',
  run_code: 'e2b.dev',
  e2b_visualize: 'e2b.dev',
  create_and_run_tool: 'e2b.dev',
  generate_diagram: 'mermaid.ink',
  composio_GMAIL_SEND_EMAIL: 'gmail.com',
  composio_GMAIL_FETCH_EMAILS: 'gmail.com',
  composio_GMAIL_LIST_EMAILS: 'gmail.com',
  composio_GOOGLECALENDAR_CREATE_EVENT: 'calendar.google.com',
  composio_GOOGLECALENDAR_LIST_EVENTS: 'calendar.google.com',
  composio_SLACK_SEND_MESSAGE: 'slack.com',
  composio_GITHUB_CREATE_AN_ISSUE: 'github.com',
  composio_GOOGLEDRIVE_UPLOAD_FILE: 'drive.google.com',
};

/** Short labels for tools without favicon domains */
const TOOL_LABELS: Record<string, string> = {
  create_document: 'Doc',
  create_presentation: 'Slides',
  excel_advanced: 'Excel',
  pdf_manipulate: 'PDF',
  extract_pdf: 'PDF',
  extract_table: 'Table',
  sql_query: 'SQL',
  math_compute: 'Math',
  analyze_text_nlp: 'NLP',
  analyze_sequence: 'DNA',
  analyze_image: 'Vision',
  transform_image: 'Image',
  generate_qr_code: 'QR',
  audio_transcribe: 'Audio',
  ocr_extract_text: 'OCR',
};

interface ToolActivityBubblesProps {
  toolCalls: ToolCall[];
}

export function ToolActivityBubbles({ toolCalls }: ToolActivityBubblesProps) {
  if (!toolCalls || toolCalls.length === 0) return null;

  // Deduplicate by tool name — only show unique tools
  const seen = new Set<string>();
  const unique = toolCalls.filter((t) => {
    if (seen.has(t.name)) return false;
    seen.add(t.name);
    return true;
  });

  const hasRunning = toolCalls.some((t) => t.status === 'running');

  return (
    <div className="flex items-center gap-1.5 py-1.5" role="status" aria-label="Working">
      {/* Animated dots while running */}
      {hasRunning && (
        <span className="flex items-center gap-0.5 mr-1">
          <span
            className="w-1 h-1 rounded-full bg-blue-400 animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-1 h-1 rounded-full bg-blue-400 animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-1 h-1 rounded-full bg-blue-400 animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </span>
      )}

      {/* Favicon strip */}
      {unique.map((tool) => {
        const domain = TOOL_DOMAINS[tool.name];
        const label = TOOL_LABELS[tool.name];
        const isDone = tool.status === 'completed' || tool.status === 'error';

        if (domain) {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={tool.id}
              src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
              alt={tool.name.replace(/_/g, ' ')}
              width={16}
              height={16}
              className={`rounded-sm transition-opacity duration-300 ${isDone ? 'opacity-40' : 'opacity-100'}`}
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          );
        }

        // Tools without a favicon — show a tiny text label
        if (label) {
          return (
            <span
              key={tool.id}
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-800 transition-opacity duration-300 ${isDone ? 'opacity-40 text-zinc-500' : 'text-zinc-300'}`}
            >
              {label}
            </span>
          );
        }

        return null;
      })}

      {/* Count if many tools */}
      {toolCalls.length > unique.length && (
        <span className="text-[10px] text-zinc-500 ml-0.5">
          +{toolCalls.length - unique.length}
        </span>
      )}
    </div>
  );
}
