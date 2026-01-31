/**
 * CRON EXPRESSION TOOL
 *
 * Parse and explain cron expressions using cron-parser.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Parse cron expressions
 * - Calculate next run times
 * - Human-readable explanations
 * - Validate cron syntax
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded cron-parser
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cronParser: any = null;

async function initCronParser(): Promise<boolean> {
  if (cronParser) return true;
  try {
    cronParser = await import('cron-parser');
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const cronTool: UnifiedTool = {
  name: 'cron_explain',
  description: `Parse and explain cron expressions.

Operations:
- parse: Validate and parse a cron expression
- next: Calculate next N run times
- explain: Get human-readable explanation
- between: Find runs between two dates

Cron format (5 fields):
- minute (0-59)
- hour (0-23)
- day of month (1-31)
- month (1-12)
- day of week (0-7, 0 and 7 are Sunday)

Special characters:
- * : any value
- , : value list separator
- - : range of values
- / : step values

Examples:
- "0 9 * * 1-5" → 9 AM on weekdays
- "*/15 * * * *" → Every 15 minutes
- "0 0 1 * *" → First day of each month at midnight`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['parse', 'next', 'explain', 'between'],
        description: 'Cron operation to perform',
      },
      expression: {
        type: 'string',
        description: 'Cron expression to parse',
      },
      count: {
        type: 'number',
        description: 'For next: number of upcoming runs (default: 5)',
      },
      start_date: {
        type: 'string',
        description: 'For between/next: start date (ISO string)',
      },
      end_date: {
        type: 'string',
        description: 'For between: end date (ISO string)',
      },
      timezone: {
        type: 'string',
        description: 'Timezone (e.g., "America/New_York", "UTC")',
      },
    },
    required: ['operation', 'expression'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isCronAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeCron(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    operation: string;
    expression: string;
    count?: number;
    start_date?: string;
    end_date?: string;
    timezone?: string;
  };

  if (!args.operation || !args.expression) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({ error: 'Operation and expression are required' }),
      isError: true,
    };
  }

  try {
    const initialized = await initCronParser();
    if (!initialized) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ error: 'Failed to initialize cron-parser' }),
        isError: true,
      };
    }

    const options: Record<string, unknown> = {};
    if (args.timezone) {
      options.tz = args.timezone;
    }
    if (args.start_date) {
      options.currentDate = new Date(args.start_date);
    }
    if (args.end_date) {
      options.endDate = new Date(args.end_date);
    }

    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'parse': {
        try {
          const interval = cronParser.parseExpression(args.expression, options);
          const fields = interval.fields;

          result = {
            operation: 'parse',
            expression: args.expression,
            valid: true,
            fields: {
              minute: Array.from(fields.minute),
              hour: Array.from(fields.hour),
              day_of_month: Array.from(fields.dayOfMonth),
              month: Array.from(fields.month),
              day_of_week: Array.from(fields.dayOfWeek),
            },
            explanation: explainCron(args.expression),
          };
        } catch (parseError) {
          result = {
            operation: 'parse',
            expression: args.expression,
            valid: false,
            error: parseError instanceof Error ? parseError.message : 'Invalid cron expression',
          };
        }
        break;
      }

      case 'next': {
        const count = args.count || 5;
        const interval = cronParser.parseExpression(args.expression, options);
        const runs: string[] = [];

        for (let i = 0; i < count; i++) {
          try {
            const next = interval.next();
            runs.push(next.toDate().toISOString());
          } catch {
            break; // No more occurrences (if end date specified)
          }
        }

        result = {
          operation: 'next',
          expression: args.expression,
          count: runs.length,
          timezone: args.timezone || 'local',
          next_runs: runs,
          explanation: explainCron(args.expression),
        };
        break;
      }

      case 'explain': {
        result = {
          operation: 'explain',
          expression: args.expression,
          explanation: explainCron(args.expression),
          parts: explainCronParts(args.expression),
        };
        break;
      }

      case 'between': {
        if (!args.start_date || !args.end_date) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Start and end dates required for between' }),
            isError: true,
          };
        }

        const interval = cronParser.parseExpression(args.expression, {
          currentDate: new Date(args.start_date),
          endDate: new Date(args.end_date),
          tz: args.timezone,
        });

        const runs: string[] = [];
        const maxRuns = 100; // Safety limit

        while (runs.length < maxRuns) {
          try {
            const next = interval.next();
            runs.push(next.toDate().toISOString());
          } catch {
            break;
          }
        }

        result = {
          operation: 'between',
          expression: args.expression,
          start_date: args.start_date,
          end_date: args.end_date,
          total_runs: runs.length,
          runs,
          truncated: runs.length >= maxRuns,
        };
        break;
      }

      default:
        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({ error: `Unknown operation: ${args.operation}` }),
          isError: true,
        };
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify(result),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        error: 'Cron operation failed',
        details: error instanceof Error ? error.message : String(error),
      }),
      isError: true,
    };
  }
}

// Generate human-readable explanation
function explainCron(expression: string): string {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return 'Invalid cron expression (expected 5 fields)';
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  const explanations: string[] = [];

  // Time
  if (minute === '*' && hour === '*') {
    explanations.push('Every minute');
  } else if (minute.startsWith('*/')) {
    explanations.push(`Every ${minute.slice(2)} minutes`);
  } else if (hour === '*') {
    explanations.push(`At minute ${minute} of every hour`);
  } else if (minute === '0') {
    explanations.push(`At ${formatHour(hour)}`);
  } else {
    explanations.push(`At ${formatHour(hour)}:${minute.padStart(2, '0')}`);
  }

  // Day of month
  if (dayOfMonth !== '*') {
    if (dayOfMonth.includes(',')) {
      explanations.push(`on days ${dayOfMonth} of the month`);
    } else if (dayOfMonth.includes('-')) {
      explanations.push(`on days ${dayOfMonth} of the month`);
    } else {
      explanations.push(`on day ${dayOfMonth} of the month`);
    }
  }

  // Month
  if (month !== '*') {
    const monthNames = [
      '',
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    if (month.includes(',')) {
      const months = month
        .split(',')
        .map((m) => monthNames[parseInt(m)] || m)
        .join(', ');
      explanations.push(`in ${months}`);
    } else {
      explanations.push(`in ${monthNames[parseInt(month)] || month}`);
    }
  }

  // Day of week
  if (dayOfWeek !== '*') {
    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];
    if (dayOfWeek === '1-5') {
      explanations.push('on weekdays');
    } else if (dayOfWeek === '0,6' || dayOfWeek === '6,0') {
      explanations.push('on weekends');
    } else if (dayOfWeek.includes(',')) {
      const days = dayOfWeek
        .split(',')
        .map((d) => dayNames[parseInt(d)] || d)
        .join(', ');
      explanations.push(`on ${days}`);
    } else if (dayOfWeek.includes('-')) {
      const [start, end] = dayOfWeek.split('-').map((d) => parseInt(d));
      explanations.push(`on ${dayNames[start]} through ${dayNames[end]}`);
    } else {
      explanations.push(`on ${dayNames[parseInt(dayOfWeek)] || dayOfWeek}`);
    }
  }

  return explanations.join(' ');
}

function formatHour(hour: string): string {
  if (hour === '*') return 'every hour';
  if (hour.startsWith('*/')) return `every ${hour.slice(2)} hours`;

  const h = parseInt(hour);
  if (h === 0) return '12:00 AM (midnight)';
  if (h === 12) return '12:00 PM (noon)';
  if (h < 12) return `${h}:00 AM`;
  return `${h - 12}:00 PM`;
}

function explainCronParts(expression: string): Record<string, string> {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return { error: 'Invalid expression' };
  }

  return {
    minute: parts[0],
    hour: parts[1],
    day_of_month: parts[2],
    month: parts[3],
    day_of_week: parts[4],
  };
}
