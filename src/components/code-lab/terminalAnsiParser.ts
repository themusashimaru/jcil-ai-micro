/**
 * ANSI Color Parser & Terminal Types
 *
 * Parses ANSI escape codes into styled segments for terminal rendering.
 * Supports 16 standard colors, bold, dim, italic, underline, and strikethrough.
 *
 * Also exports shared terminal types used across all terminal sub-components.
 */

import type React from 'react';

// ============================================================================
// SHARED TERMINAL TYPES
// ============================================================================

export interface TerminalLine {
  id: string;
  type: 'command' | 'stdout' | 'stderr' | 'info' | 'success' | 'error' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface TerminalTab {
  id: string;
  name: string;
  cwd: string;
  lines: TerminalLine[];
  commandHistory: string[];
  historyIndex: number;
  isRunning: boolean;
  currentProcess?: {
    id: string;
    command: string;
    startTime: Date;
  };
}

// ============================================================================
// TYPES
// ============================================================================

export interface ANSISegment {
  text: string;
  style: React.CSSProperties;
}

// ============================================================================
// COLOR MAPS
// ============================================================================

const ANSI_COLORS: Record<string, string> = {
  '30': '#1a1a1a',
  '31': '#ef4444',
  '32': '#22c55e',
  '33': '#eab308',
  '34': '#3b82f6',
  '35': '#a855f7',
  '36': '#06b6d4',
  '37': '#e5e5e5',
  '90': '#6b7280',
  '91': '#f87171',
  '92': '#4ade80',
  '93': '#facc15',
  '94': '#60a5fa',
  '95': '#c084fc',
  '96': '#22d3ee',
  '97': '#ffffff',
};

const BG_COLORS: Record<string, string> = {
  '40': '#1a1a1a',
  '41': '#ef4444',
  '42': '#22c55e',
  '43': '#eab308',
  '44': '#3b82f6',
  '45': '#a855f7',
  '46': '#06b6d4',
  '47': '#e5e5e5',
  '100': '#6b7280',
  '101': '#f87171',
  '102': '#4ade80',
  '103': '#facc15',
  '104': '#60a5fa',
  '105': '#c084fc',
  '106': '#22d3ee',
  '107': '#ffffff',
};

// ============================================================================
// PARSER FUNCTIONS
// ============================================================================

/**
 * Parse ANSI escape codes in text into an array of styled segments.
 */
export function parseANSI(text: string): ANSISegment[] {
  const segments: ANSISegment[] = [];
  // eslint-disable-next-line no-control-regex
  const regex = /\x1b\[([0-9;]*)m/g;
  let lastIndex = 0;
  let currentStyle: React.CSSProperties = {};
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), style: { ...currentStyle } });
    }

    const codes = match[1].split(';').filter(Boolean);
    for (const code of codes) {
      if (code === '0') {
        currentStyle = {};
      } else if (code === '1') {
        currentStyle.fontWeight = 'bold';
      } else if (code === '2') {
        currentStyle.opacity = 0.7;
      } else if (code === '3') {
        currentStyle.fontStyle = 'italic';
      } else if (code === '4') {
        currentStyle.textDecoration = 'underline';
      } else if (code === '9') {
        currentStyle.textDecoration = 'line-through';
      } else if (ANSI_COLORS[code]) {
        currentStyle.color = ANSI_COLORS[code];
      } else if (BG_COLORS[code]) {
        currentStyle.backgroundColor = BG_COLORS[code];
      }
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), style: { ...currentStyle } });
  }

  return segments.length > 0 ? segments : [{ text, style: {} }];
}

/**
 * Strip ANSI escape codes from text, returning plain text.
 */
export function stripANSI(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

// ============================================================================
// LINE ID GENERATOR
// ============================================================================

let lineIdCounter = 0;

/**
 * Generate a unique ID for a terminal line.
 */
export function generateLineId(): string {
  return `line-${++lineIdCounter}-${Date.now()}`;
}
