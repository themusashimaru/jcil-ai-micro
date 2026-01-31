/**
 * RECURRENCE RULE TOOL
 *
 * Calendar recurrence rules using rrule (RFC 5545).
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Generate recurring dates
 * - Parse iCal RRULE strings
 * - Complex recurrence patterns
 * - Date range queries
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded library
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let rruleLib: any = null;

async function initRRule(): Promise<boolean> {
  if (rruleLib) return true;
  try {
    rruleLib = await import('rrule');
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const recurrenceTool: UnifiedTool = {
  name: 'recurrence_rule',
  description: `Generate and analyze recurring date patterns (RFC 5545 RRULE).

Operations:
- generate: Generate recurring dates from a rule
- parse: Parse an iCal RRULE string
- between: Get occurrences between two dates
- next: Get next N occurrences
- describe: Get human-readable description of rule

Frequency options:
- YEARLY, MONTHLY, WEEKLY, DAILY, HOURLY, MINUTELY

Use cases:
- Calendar event scheduling
- Recurring payment dates
- Backup schedules
- Subscription renewals
- Meeting patterns`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['generate', 'parse', 'between', 'next', 'describe'],
        description: 'Recurrence operation',
      },
      rrule_string: {
        type: 'string',
        description: 'iCal RRULE string (e.g., "FREQ=WEEKLY;BYDAY=MO,WE,FR")',
      },
      frequency: {
        type: 'string',
        enum: ['YEARLY', 'MONTHLY', 'WEEKLY', 'DAILY', 'HOURLY', 'MINUTELY'],
        description: 'Recurrence frequency',
      },
      interval: {
        type: 'number',
        description: 'Interval between occurrences (default: 1)',
      },
      count: {
        type: 'number',
        description: 'Maximum number of occurrences',
      },
      start_date: {
        type: 'string',
        description: 'Start date (ISO 8601 format)',
      },
      end_date: {
        type: 'string',
        description: 'End date for recurrence or query',
      },
      by_day: {
        type: 'array',
        items: { type: 'string' },
        description: 'Days of week: ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]',
      },
      by_month: {
        type: 'array',
        items: { type: 'number' },
        description: 'Months (1-12)',
      },
      by_monthday: {
        type: 'array',
        items: { type: 'number' },
        description: 'Days of month (1-31, negative for end of month)',
      },
      by_setpos: {
        type: 'array',
        items: { type: 'number' },
        description: 'Position in set (e.g., [1] for first, [-1] for last)',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isRecurrenceAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeRecurrence(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    operation: string;
    rrule_string?: string;
    frequency?: string;
    interval?: number;
    count?: number;
    start_date?: string;
    end_date?: string;
    by_day?: string[];
    by_month?: number[];
    by_monthday?: number[];
    by_setpos?: number[];
  };

  const { operation } = args;

  try {
    const initialized = await initRRule();
    if (!initialized) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({ error: 'Failed to initialize rrule library' }),
        isError: true,
      };
    }

    const { RRule, rrulestr } = rruleLib;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    // Map frequency strings to RRule constants
    const freqMap: Record<string, number> = {
      YEARLY: RRule.YEARLY,
      MONTHLY: RRule.MONTHLY,
      WEEKLY: RRule.WEEKLY,
      DAILY: RRule.DAILY,
      HOURLY: RRule.HOURLY,
      MINUTELY: RRule.MINUTELY,
    };

    // Map day strings to RRule constants
    const dayMap: Record<string, unknown> = {
      MO: RRule.MO,
      TU: RRule.TU,
      WE: RRule.WE,
      TH: RRule.TH,
      FR: RRule.FR,
      SA: RRule.SA,
      SU: RRule.SU,
    };

    switch (operation) {
      case 'generate':
      case 'next': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let rule: any;

        if (args.rrule_string) {
          rule = rrulestr(args.rrule_string);
        } else {
          if (!args.frequency) {
            throw new Error('frequency or rrule_string required');
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const options: any = {
            freq: freqMap[args.frequency],
            interval: args.interval || 1,
            dtstart: args.start_date ? new Date(args.start_date) : new Date(),
          };

          if (args.count) options.count = args.count;
          if (args.end_date) options.until = new Date(args.end_date);
          if (args.by_day) options.byweekday = args.by_day.map((d: string) => dayMap[d]);
          if (args.by_month) options.bymonth = args.by_month;
          if (args.by_monthday) options.bymonthday = args.by_monthday;
          if (args.by_setpos) options.bysetpos = args.by_setpos;

          rule = new RRule(options);
        }

        const limit = args.count || 20;
        const dates = rule.all((_date: Date, i: number) => i < limit);

        result = {
          operation,
          rule_string: rule.toString(),
          description: rule.toText(),
          occurrence_count: dates.length,
          occurrences: dates.map((d: Date) => d.toISOString()),
        };
        break;
      }

      case 'parse': {
        if (!args.rrule_string) {
          throw new Error('rrule_string required for parse');
        }

        const rule = rrulestr(args.rrule_string);
        const options = rule.origOptions;

        result = {
          operation: 'parse',
          input: args.rrule_string,
          parsed: {
            frequency: Object.keys(freqMap).find((k) => freqMap[k] === options.freq),
            interval: options.interval,
            count: options.count,
            until: options.until?.toISOString(),
            byweekday: options.byweekday,
            bymonth: options.bymonth,
            bymonthday: options.bymonthday,
          },
          description: rule.toText(),
          normalized: rule.toString(),
        };
        break;
      }

      case 'between': {
        if (!args.start_date || !args.end_date) {
          throw new Error('start_date and end_date required for between');
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let rule: any;

        if (args.rrule_string) {
          rule = rrulestr(args.rrule_string);
        } else if (args.frequency) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const options: any = {
            freq: freqMap[args.frequency],
            interval: args.interval || 1,
            dtstart: new Date(args.start_date),
          };
          if (args.by_day) options.byweekday = args.by_day.map((d: string) => dayMap[d]);
          rule = new RRule(options);
        } else {
          throw new Error('frequency or rrule_string required');
        }

        const dates = rule.between(new Date(args.start_date), new Date(args.end_date), true);

        result = {
          operation: 'between',
          start: args.start_date,
          end: args.end_date,
          rule_string: rule.toString(),
          occurrence_count: dates.length,
          occurrences: dates.map((d: Date) => d.toISOString()),
        };
        break;
      }

      case 'describe': {
        if (!args.rrule_string && !args.frequency) {
          throw new Error('rrule_string or frequency required');
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let rule: any;

        if (args.rrule_string) {
          rule = rrulestr(args.rrule_string);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const options: any = {
            freq: freqMap[args.frequency!],
            interval: args.interval || 1,
          };
          if (args.by_day) options.byweekday = args.by_day.map((d: string) => dayMap[d]);
          if (args.by_month) options.bymonth = args.by_month;
          if (args.by_monthday) options.bymonthday = args.by_monthday;
          rule = new RRule(options);
        }

        result = {
          operation: 'describe',
          rule_string: rule.toString(),
          description: rule.toText(),
          human_readable: rule.toText(),
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: call.id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: call.id,
      content: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        operation,
      }),
      isError: true,
    };
  }
}
