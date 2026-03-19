/**
 * CALENDAR EVENT TOOL
 *
 * Generates valid iCalendar (.ics) files from event data.
 * Supports single events, all-day events, recurring events,
 * attendees, reminders, and locations.
 *
 * RFC 5545 compliant. No external dependencies.
 *
 * Created: 2026-03-19
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// HELPERS
// ============================================================================

/** Format a Date to iCalendar DATE-TIME format: 20260325T140000 */
function formatDateTime(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  const s = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

/** Format a Date to iCalendar DATE format: 20260325 */
function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** Escape special characters per RFC 5545 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/** Fold long lines per RFC 5545 (max 75 octets per line) */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  parts.push(line.substring(0, 75));
  let remaining = line.substring(75);
  while (remaining.length > 0) {
    parts.push(' ' + remaining.substring(0, 74));
    remaining = remaining.substring(74);
  }
  return parts.join('\r\n');
}

/** Create a slug from text for filename */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 30);
}

/** Map recurring string to RRULE FREQ value */
function getFrequency(recurring: string): string | null {
  const map: Record<string, string> = {
    daily: 'DAILY',
    weekly: 'WEEKLY',
    monthly: 'MONTHLY',
    yearly: 'YEARLY',
  };
  return map[recurring] ?? null;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const calendarEventTool: UnifiedTool = {
  name: 'calendar_event',
  description: `Create calendar events as downloadable .ics files. Supports single events, all-day events, recurring events, attendees, reminders, and locations.

Use this when:
- User wants to create a calendar event or meeting
- User asks to schedule something
- User needs a calendar file to share or import

Returns a downloadable .ics file compatible with Google Calendar, Apple Calendar, Outlook, and all major calendar apps.`,
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Event title',
      },
      start_date: {
        type: 'string',
        description: 'Start datetime in ISO 8601 format (e.g., "2026-03-25T14:00:00")',
      },
      end_date: {
        type: 'string',
        description: 'End datetime in ISO 8601 format. Defaults to 1 hour after start if omitted.',
      },
      location: {
        type: 'string',
        description: 'Event location',
      },
      description: {
        type: 'string',
        description: 'Event description or notes',
      },
      attendees: {
        type: 'array',
        items: { type: 'string' },
        description: 'Email addresses of attendees',
      },
      reminder_minutes: {
        type: 'number',
        description: 'Minutes before event for reminder alarm. Default: 15',
      },
      recurring: {
        type: 'string',
        enum: ['daily', 'weekly', 'monthly', 'yearly'],
        description: 'Recurrence frequency',
      },
      all_day: {
        type: 'boolean',
        description: 'Whether this is an all-day event',
      },
    },
    required: ['title', 'start_date'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isCalendarEventAvailable(): boolean {
  // Pure string generation — always available
  return true;
}

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeCalendarEvent(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    title: string;
    start_date: string;
    end_date?: string;
    location?: string;
    description?: string;
    attendees?: string[];
    reminder_minutes?: number;
    recurring?: 'daily' | 'weekly' | 'monthly' | 'yearly';
    all_day?: boolean;
  };

  // Validate required parameters
  if (!args.title || !args.title.trim()) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: title parameter is required',
      isError: true,
    };
  }

  if (!args.start_date) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: start_date parameter is required',
      isError: true,
    };
  }

  // Parse dates
  const startDate = new Date(args.start_date);
  if (isNaN(startDate.getTime())) {
    return {
      toolCallId: toolCall.id,
      content: 'Error: start_date is not a valid ISO 8601 datetime',
      isError: true,
    };
  }

  let endDate: Date;
  if (args.end_date) {
    endDate = new Date(args.end_date);
    if (isNaN(endDate.getTime())) {
      return {
        toolCallId: toolCall.id,
        content: 'Error: end_date is not a valid ISO 8601 datetime',
        isError: true,
      };
    }
    if (endDate <= startDate) {
      return {
        toolCallId: toolCall.id,
        content: 'Error: end_date must be after start_date',
        isError: true,
      };
    }
  } else {
    // Default: 1 hour after start (or next day for all-day)
    if (args.all_day) {
      endDate = new Date(startDate);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
    } else {
      endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    }
  }

  // Validate attendee emails
  if (args.attendees && args.attendees.length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of args.attendees) {
      if (!emailRegex.test(email)) {
        return {
          toolCallId: toolCall.id,
          content: `Error: Invalid attendee email address: "${email}"`,
          isError: true,
        };
      }
    }
  }

  // Validate recurring
  if (args.recurring) {
    const freq = getFrequency(args.recurring);
    if (!freq) {
      return {
        toolCallId: toolCall.id,
        content: 'Error: recurring must be one of: daily, weekly, monthly, yearly',
        isError: true,
      };
    }
  }

  try {
    const uid = crypto.randomUUID();
    const now = formatDateTime(new Date());
    const reminderMinutes = args.reminder_minutes ?? 15;
    const isAllDay = args.all_day === true;

    // Build iCalendar content
    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//JCIL AI Micro//Calendar Event Tool//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      '',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `CREATED:${now}`,
      `LAST-MODIFIED:${now}`,
    ];

    // Date properties
    if (isAllDay) {
      lines.push(`DTSTART;VALUE=DATE:${formatDate(startDate)}`);
      lines.push(`DTEND;VALUE=DATE:${formatDate(endDate)}`);
    } else {
      lines.push(`DTSTART:${formatDateTime(startDate)}`);
      lines.push(`DTEND:${formatDateTime(endDate)}`);
    }

    // Summary (title)
    lines.push(foldLine(`SUMMARY:${escapeICalText(args.title)}`));

    // Optional fields
    if (args.description) {
      lines.push(foldLine(`DESCRIPTION:${escapeICalText(args.description)}`));
    }
    if (args.location) {
      lines.push(foldLine(`LOCATION:${escapeICalText(args.location)}`));
    }

    // Recurring rule
    if (args.recurring) {
      const freq = getFrequency(args.recurring);
      lines.push(`RRULE:FREQ=${freq}`);
    }

    // Attendees
    if (args.attendees && args.attendees.length > 0) {
      for (const email of args.attendees) {
        lines.push(`ATTENDEE;RSVP=TRUE:mailto:${email}`);
      }
    }

    // Status and transparency
    lines.push('STATUS:CONFIRMED');
    lines.push(isAllDay ? 'TRANSP:TRANSPARENT' : 'TRANSP:OPAQUE');

    // Alarm (reminder)
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(foldLine(`DESCRIPTION:Reminder: ${escapeICalText(args.title)}`));
    lines.push(`TRIGGER:-PT${reminderMinutes}M`);
    lines.push('END:VALARM');

    lines.push('END:VEVENT');
    lines.push('END:VCALENDAR');

    const icsContent = lines.join('\r\n');
    const slug = slugify(args.title);
    const timestamp = Date.now();
    const filename = `event_${slug}_${timestamp}.ics`;

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        success: true,
        message: `Calendar event created: "${args.title}"`,
        filename,
        mimeType: 'text/calendar',
        eventDetails: {
          title: args.title,
          start: args.start_date,
          end: args.end_date ?? endDate.toISOString(),
          location: args.location ?? null,
          allDay: isAllDay,
          recurring: args.recurring ?? null,
          attendees: args.attendees ?? [],
          reminderMinutes,
        },
        icsContent,
      }),
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Error generating calendar event: ${(error as Error).message}`,
      isError: true,
    };
  }
}
