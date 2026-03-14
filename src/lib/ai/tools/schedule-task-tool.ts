/**
 * SCHEDULE TASK TOOL
 *
 * Allows the AI to create scheduled tasks that execute tools at specified times.
 * Works with the scheduled_tasks table and cron executor endpoint.
 *
 * Examples:
 * - "Send this email at 3pm" → schedules composio_GMAIL_SEND_EMAIL
 * - "Post to Slack every Monday at 9am" → schedules recurring composio_SLACK_SEND_MESSAGE
 * - "Create a calendar event tomorrow at 2pm" → schedules composio_GOOGLECALENDAR_CREATE_EVENT
 *
 * Created: 2026-03-14
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { logger } from '@/lib/logger';

const log = logger('ScheduleTaskTool');

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const scheduleTaskTool: UnifiedTool = {
  name: 'schedule_task',
  description: `Schedule a tool to execute at a specific future time. Use this when a user asks to do something later, at a scheduled time, or on a recurring basis.

Examples of when to use:
- "Send this email at 3pm"
- "Remind me every Monday to check sales"
- "Post this to Slack tomorrow morning"
- "Create a calendar event next Tuesday at 2pm"

The task will be saved and automatically executed at the scheduled time.
For recurring tasks, it will re-execute on the specified schedule.`,
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Short descriptive name for the task (e.g., "Weekly Sales Report Email")',
      },
      description: {
        type: 'string',
        description: 'Longer description of what the task does',
      },
      platform: {
        type: 'string',
        description: 'Platform name: gmail, calendar, slack, discord, github, reminder',
      },
      action: {
        type: 'string',
        description: 'Human-readable action: "Send Email", "Create Event", "Post Message", etc.',
      },
      tool_name: {
        type: 'string',
        description: 'The exact tool name to execute (e.g., "composio_GMAIL_SEND_EMAIL")',
      },
      tool_params: {
        type: 'object',
        description: 'Parameters to pass to the tool when it executes',
      },
      scheduled_for: {
        type: 'string',
        description: 'ISO 8601 datetime for when to execute (e.g., "2026-03-14T15:00:00-04:00")',
      },
      timezone: {
        type: 'string',
        description: 'IANA timezone (e.g., "America/New_York"). Defaults to UTC.',
      },
      recurring: {
        type: 'string',
        enum: ['once', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly'],
        description: 'Recurrence schedule. Defaults to "once".',
      },
    },
    required: ['name', 'platform', 'action', 'tool_name', 'tool_params', 'scheduled_for'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isScheduleTaskAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeScheduleTask(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    name: string;
    description?: string;
    platform: string;
    action: string;
    tool_name: string;
    tool_params: Record<string, unknown>;
    scheduled_for: string;
    timezone?: string;
    recurring?: string;
  };

  // Validate required fields
  if (!args.name || !args.platform || !args.tool_name || !args.scheduled_for) {
    return {
      toolCallId: call.id,
      content: JSON.stringify({
        success: false,
        error: 'Missing required fields: name, platform, tool_name, scheduled_for',
      }),
    };
  }

  // Validate scheduled_for is a valid future date
  const scheduledDate = new Date(args.scheduled_for);
  if (isNaN(scheduledDate.getTime())) {
    return {
      toolCallId: call.id,
      content: JSON.stringify({
        success: false,
        error: 'Invalid scheduled_for datetime. Use ISO 8601 format.',
      }),
    };
  }

  if (scheduledDate.getTime() < Date.now() - 60000) {
    return {
      toolCallId: call.id,
      content: JSON.stringify({
        success: false,
        error: 'scheduled_for must be in the future.',
      }),
    };
  }

  try {
    // We return the task data for the chat system to persist via the API.
    // The chat-router will detect this result and save to DB using the user's auth context.
    const taskData = {
      name: args.name,
      description: args.description || null,
      platform: args.platform,
      action: args.action,
      toolName: args.tool_name,
      toolParams: args.tool_params,
      scheduledFor: args.scheduled_for,
      timezone: args.timezone || 'UTC',
      recurring: args.recurring || 'once',
    };

    log.info('Schedule task requested', {
      name: args.name,
      platform: args.platform,
      scheduledFor: args.scheduled_for,
      recurring: args.recurring || 'once',
    });

    // Format display time
    const displayTime = scheduledDate.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: args.timezone || 'UTC',
      timeZoneName: 'short',
    });

    return {
      toolCallId: call.id,
      content: JSON.stringify({
        success: true,
        __scheduleTask: true,
        task: taskData,
        message: `Scheduled "${args.name}" for ${displayTime}${args.recurring && args.recurring !== 'once' ? ` (recurring ${args.recurring})` : ''}.`,
        displayTime,
      }),
    };
  } catch (error) {
    log.error('Failed to create scheduled task', error as Error);
    return {
      toolCallId: call.id,
      content: JSON.stringify({
        success: false,
        error: `Failed to schedule task: ${(error as Error).message}`,
      }),
    };
  }
}
