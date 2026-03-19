import { describe, it, expect } from 'vitest';

import {
  meetingMinutesTool,
  isMeetingMinutesAvailable,
  executeMeetingMinutes,
} from './meeting-minutes-tool';

// ============================================================================
// TOOL DEFINITION
// ============================================================================

describe('meetingMinutesTool definition', () => {
  it('should have correct name', () => {
    expect(meetingMinutesTool.name).toBe('create_meeting_minutes');
  });

  it('should have a description', () => {
    expect(meetingMinutesTool.description.length).toBeGreaterThan(0);
  });

  it('should have parameters schema', () => {
    expect(meetingMinutesTool.parameters).toBeDefined();
    expect(meetingMinutesTool.parameters.type).toBe('object');
  });

  it('should require title, date, and attendees', () => {
    expect(meetingMinutesTool.parameters.required).toContain('title');
    expect(meetingMinutesTool.parameters.required).toContain('date');
    expect(meetingMinutesTool.parameters.required).toContain('attendees');
  });
});

describe('isMeetingMinutesAvailable', () => {
  it('should return true', () => {
    expect(isMeetingMinutesAvailable()).toBe(true);
  });
});

// ============================================================================
// EXECUTOR - VALID INPUT
// ============================================================================

describe('executeMeetingMinutes', () => {
  it('should generate markdown meeting minutes with valid input', async () => {
    const result = await executeMeetingMinutes({
      id: 'test-1',
      name: 'create_meeting_minutes',
      arguments: {
        title: 'Q1 Product Review',
        date: '2026-03-19',
        attendees: ['Alice Johnson', 'Bob Smith', 'Carol Lee'],
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.success).toBe(true);
    expect(data.format).toBe('markdown');
    expect(data.formatted_output).toContain('Q1 Product Review');
    expect(data.formatted_output).toContain('Alice Johnson');
  });

  it('should generate HTML format when requested', async () => {
    const result = await executeMeetingMinutes({
      id: 'test-2',
      name: 'create_meeting_minutes',
      arguments: {
        title: 'HTML Minutes Test',
        date: '2026-03-19',
        attendees: ['Dev Team'],
        format: 'html',
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.success).toBe(true);
    expect(data.format).toBe('html');
    expect(data.formatted_output).toContain('<');
    expect(data.formatted_output).toContain('HTML Minutes Test');
  });

  it('should include agenda items and action items when provided', async () => {
    const result = await executeMeetingMinutes({
      id: 'test-3',
      name: 'create_meeting_minutes',
      arguments: {
        title: 'Sprint Planning',
        date: '2026-03-19',
        attendees: ['Alice', 'Bob'],
        agenda_items: [
          { topic: 'Sprint goals', discussion: 'Discussed Q2 priorities', decision: 'Focus on reliability' },
        ],
        action_items: [
          { task: 'Write RFP for monitoring', assignee: 'Bob', deadline: '2026-03-25' },
        ],
      },
    });

    expect(result.isError).toBeFalsy();
    const data = JSON.parse(result.content);
    expect(data.formatted_output).toContain('Sprint goals');
    expect(data.formatted_output).toContain('Write RFP for monitoring');
    expect(data.formatted_output).toContain('Bob');
  });

  // ============================================================================
  // EXECUTOR - ERROR CASES
  // ============================================================================

  it('should error when title is missing', async () => {
    const result = await executeMeetingMinutes({
      id: 'test-4',
      name: 'create_meeting_minutes',
      arguments: {
        date: '2026-03-19',
        attendees: ['Alice'],
      },
    });

    expect(result.isError).toBe(true);
  });

  it('should error when attendees is empty', async () => {
    const result = await executeMeetingMinutes({
      id: 'test-5',
      name: 'create_meeting_minutes',
      arguments: {
        title: 'No Attendees',
        date: '2026-03-19',
        attendees: [],
      },
    });

    expect(result.isError).toBe(true);
  });

  it('should error when date is missing', async () => {
    const result = await executeMeetingMinutes({
      id: 'test-6',
      name: 'create_meeting_minutes',
      arguments: {
        title: 'No Date Meeting',
        attendees: ['Alice'],
      },
    });

    expect(result.isError).toBe(true);
  });

  it('should include toolCallId in result', async () => {
    const result = await executeMeetingMinutes({
      id: 'my-meeting-id',
      name: 'create_meeting_minutes',
      arguments: {
        title: 'ToolCallId Test',
        date: '2026-03-19',
        attendees: ['Alice'],
      },
    });

    expect(result.toolCallId).toBe('my-meeting-id');
  });
});
