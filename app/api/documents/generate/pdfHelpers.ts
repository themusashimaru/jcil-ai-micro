/**
 * PDF GENERATION HELPERS
 *
 * Authentication, markdown parsing, and text processing utilities
 * used by the document generation route.
 * Extracted from route.ts for modularity.
 */

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SpreadsheetDocument } from '@/lib/documents/types';

export async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Cookie operations may fail
            }
          },
        },
      }
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

// Get Supabase admin client for storage operations
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Parse markdown to structured content for PDF
 * Supports special QR code syntax: {{QR:url}} or {{QR:url:count}} for multiple QR codes
 */
export function parseMarkdown(markdown: string): Array<{
  type: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'table' | 'blockquote' | 'qr' | 'hr';
  text: string;
  items?: string[];
  rows?: string[][];
  qrData?: string;
  qrCount?: number;
}> {
  const lines = markdown.split('\n');
  const elements: Array<{
    type: 'h1' | 'h2' | 'h3' | 'p' | 'li' | 'table' | 'blockquote' | 'qr' | 'hr';
    text: string;
    items?: string[];
    rows?: string[][];
    qrData?: string;
    qrCount?: number;
  }> = [];

  let currentList: string[] = [];
  let currentTable: string[][] = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines but flush lists
    if (!line) {
      if (currentList.length > 0) {
        elements.push({ type: 'li', text: '', items: [...currentList] });
        currentList = [];
      }
      if (inTable && currentTable.length > 0) {
        elements.push({ type: 'table', text: '', rows: [...currentTable] });
        currentTable = [];
        inTable = false;
      }
      continue;
    }

    // Headers
    if (line.startsWith('# ')) {
      elements.push({ type: 'h1', text: line.slice(2) });
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push({ type: 'h2', text: line.slice(3) });
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push({ type: 'h3', text: line.slice(4) });
      continue;
    }

    // Detect resume section headers (all-caps or bold section names without ## prefix)
    // These commonly appear when AI doesn't use markdown headers
    const resumeSectionHeaders = [
      'PROFESSIONAL SUMMARY',
      'SUMMARY',
      'PROFILE',
      'OBJECTIVE',
      'EXPERIENCE',
      'PROFESSIONAL EXPERIENCE',
      'WORK EXPERIENCE',
      'EMPLOYMENT HISTORY',
      'WORK HISTORY',
      'EDUCATION',
      'ACADEMIC BACKGROUND',
      'ACADEMIC HISTORY',
      'SKILLS',
      'TECHNICAL SKILLS',
      'CORE COMPETENCIES',
      'KEY SKILLS',
      'AREAS OF EXPERTISE',
      'CERTIFICATIONS',
      'CERTIFICATES',
      'LICENSES',
      'CREDENTIALS',
      'LICENSES & CERTIFICATIONS',
      'AWARDS',
      'HONORS',
      'ACHIEVEMENTS',
      'ACCOMPLISHMENTS',
      'AWARDS & HONORS',
      'PUBLICATIONS',
      'RESEARCH',
      'PROJECTS',
      'PORTFOLIO',
      'LANGUAGES',
      'VOLUNTEER',
      'VOLUNTEER EXPERIENCE',
      'COMMUNITY SERVICE',
      'REFERENCES',
      'PROFESSIONAL AFFILIATIONS',
      'MEMBERSHIPS',
      'ASSOCIATIONS',
      'INTERESTS',
      'ACTIVITIES',
      'ADDITIONAL INFORMATION',
    ];

    // Business plan and general business document section headers
    const businessSectionHeaders = [
      'EXECUTIVE SUMMARY',
      'COMPANY DESCRIPTION',
      'COMPANY OVERVIEW',
      'BUSINESS OVERVIEW',
      'MARKET ANALYSIS',
      'MARKET RESEARCH',
      'INDUSTRY ANALYSIS',
      'COMPETITIVE ANALYSIS',
      'ORGANIZATION AND MANAGEMENT',
      'MANAGEMENT TEAM',
      'ORGANIZATIONAL STRUCTURE',
      'PRODUCTS AND SERVICES',
      'PRODUCTS OR SERVICES',
      'SERVICE OFFERING',
      'PRODUCT LINE',
      'MARKETING AND SALES',
      'MARKETING STRATEGY',
      'SALES STRATEGY',
      'GO-TO-MARKET STRATEGY',
      'FINANCIAL PROJECTIONS',
      'FINANCIAL PLAN',
      'FINANCIAL SUMMARY',
      'REVENUE MODEL',
      'FUNDING REQUEST',
      'FUNDING REQUIREMENTS',
      'INVESTMENT OPPORTUNITY',
      'APPENDIX',
      'SUPPORTING DOCUMENTS',
      'ATTACHMENTS',
      'MISSION STATEMENT',
      'VISION STATEMENT',
      'COMPANY MISSION',
      'OUR MISSION',
      'TARGET MARKET',
      'CUSTOMER SEGMENTS',
      'IDEAL CUSTOMER',
      'VALUE PROPOSITION',
      'UNIQUE SELLING PROPOSITION',
      'COMPETITIVE ADVANTAGE',
      'OPERATIONS PLAN',
      'OPERATIONAL PLAN',
      'BUSINESS OPERATIONS',
      'MILESTONES',
      'TIMELINE',
      'ROADMAP',
      'KEY MILESTONES',
      'RISK ANALYSIS',
      'RISK ASSESSMENT',
      'SWOT ANALYSIS',
      'CONCLUSION',
      'NEXT STEPS',
      'CALL TO ACTION',
      'INTRODUCTION',
      'BACKGROUND',
      'OVERVIEW',
      'ABOUT US',
      'WHO WE ARE',
      'PROBLEM',
      'THE PROBLEM',
      'PROBLEM STATEMENT',
      'SOLUTION',
      'THE SOLUTION',
      'OUR SOLUTION',
      'PROPOSED SOLUTION',
      'BUSINESS MODEL',
      'REVENUE STREAMS',
      'MONETIZATION',
      'TEAM',
      'THE TEAM',
      'OUR TEAM',
      'LEADERSHIP',
      'KEY PERSONNEL',
      'TRACTION',
      'ACHIEVEMENTS TO DATE',
      'PROGRESS',
      'TERMS AND CONDITIONS',
      'LEGAL CONSIDERATIONS',
    ];

    // Check if line is a resume section header (exact match or with ** markers)
    const cleanedLine = line.replace(/^\*\*/, '').replace(/\*\*$/, '').trim();
    const isResumeSectionHeader = resumeSectionHeaders.some(
      (header) =>
        cleanedLine.toUpperCase() === header ||
        cleanedLine.toUpperCase() === header + ':' ||
        line.toUpperCase() === header ||
        line.toUpperCase() === header + ':'
    );

    if (isResumeSectionHeader) {
      elements.push({ type: 'h2', text: cleanedLine.replace(/:$/, '') });
      continue;
    }

    // Check if line is a business document section header
    const isBusinessSectionHeader = businessSectionHeaders.some(
      (header) =>
        cleanedLine.toUpperCase() === header ||
        cleanedLine.toUpperCase() === header + ':' ||
        line.toUpperCase() === header ||
        line.toUpperCase() === header + ':'
    );

    if (isBusinessSectionHeader) {
      elements.push({ type: 'h2', text: cleanedLine.replace(/:$/, '') });
      continue;
    }

    // Horizontal rule (---, ***, ___)
    if (line.match(/^[-*_]{3,}$/)) {
      elements.push({ type: 'hr', text: '' });
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push({ type: 'blockquote', text: line.slice(2) });
      continue;
    }

    // QR Code syntax: {{QR:url}} or {{QR:url:count}}
    const qrMatch = line.match(/\{\{QR:(.+?)(?::(\d+))?\}\}/i);
    if (qrMatch) {
      elements.push({
        type: 'qr',
        text: '',
        qrData: qrMatch[1].trim(),
        qrCount: qrMatch[2] ? parseInt(qrMatch[2], 10) : 1,
      });
      continue;
    }

    // List items
    if (line.match(/^[-*•]\s+/) || line.match(/^\d+\.\s+/)) {
      const text = line.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, '');
      currentList.push(text);
      continue;
    }

    // Table rows
    if (line.startsWith('|') && line.endsWith('|')) {
      // Skip separator rows (|---|---|)
      if (line.match(/^\|[\s-:|]+\|$/)) {
        continue;
      }
      const cells = line
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      currentTable.push(cells);
      inTable = true;
      continue;
    }

    // Flush any pending list before paragraph
    if (currentList.length > 0) {
      elements.push({ type: 'li', text: '', items: [...currentList] });
      currentList = [];
    }

    // Regular paragraph
    elements.push({ type: 'p', text: line });
  }

  // Flush remaining list or table
  if (currentList.length > 0) {
    elements.push({ type: 'li', text: '', items: [...currentList] });
  }
  if (currentTable.length > 0) {
    elements.push({ type: 'table', text: '', rows: [...currentTable] });
  }

  return elements;
}

/**
 * Normalize special characters for PDF compatibility
 * Fixes em dashes, smart quotes, and other problematic characters
 */
export function normalizeText(text: string): string {
  return (
    text
      // Em dashes and en dashes to regular dashes
      .replace(/—/g, '-')
      .replace(/–/g, '-')
      // Smart quotes to regular quotes
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      // Ellipsis
      .replace(/…/g, '...')
      // Non-breaking spaces
      .replace(/\u00A0/g, ' ')
      // Other common problematic characters
      .replace(/•/g, '-')
      .replace(/·/g, '-')
      .trim()
  );
}

/**
 * Clean markdown formatting from text
 */
export function cleanMarkdown(text: string): { text: string; bold: boolean; italic: boolean } {
  let normalizedText = normalizeText(text);
  let bold = false;
  let italic = false;

  // Check for bold markers **text**
  if (normalizedText.match(/\*\*(.+?)\*\*/)) {
    normalizedText = normalizedText.replace(/\*\*(.+?)\*\*/g, '$1');
    bold = true;
  }

  // Check for italic markers *text* (single asterisk)
  if (normalizedText.match(/\*(.+?)\*/)) {
    normalizedText = normalizedText.replace(/\*(.+?)\*/g, '$1');
    italic = true;
  }

  // Also handle _italic_ and __bold__
  if (normalizedText.match(/__(.+?)__/)) {
    normalizedText = normalizedText.replace(/__(.+?)__/g, '$1');
    bold = true;
  }
  if (normalizedText.match(/_(.+?)_/)) {
    normalizedText = normalizedText.replace(/_(.+?)_/g, '$1');
    italic = true;
  }

  return { text: normalizedText, bold, italic };
}

/**
 * Parse markdown content (especially tables) into SpreadsheetDocument format
 */
export function parseMarkdownToSpreadsheet(content: string, title: string): SpreadsheetDocument {
  const sheets: SpreadsheetDocument['sheets'] = [];
  const lines = content.split('\n');

  let currentSheet: SpreadsheetDocument['sheets'][0] | null = null;
  let currentSheetName = title || 'Sheet1';
  let inTable = false;
  let isFirstTableRow = true;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Detect sheet name from headers (## or ###)
    if (trimmedLine.startsWith('##')) {
      // Save current sheet if exists
      if (currentSheet && currentSheet.rows.length > 0) {
        sheets.push(currentSheet);
      }
      currentSheetName = trimmedLine.replace(/^#+\s*/, '').trim();
      currentSheet = null;
      inTable = false;
      isFirstTableRow = true;
      continue;
    }

    // Detect markdown table row
    if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
      // Skip separator rows (| :--- | :--- |)
      if (/^\|[\s:-]+\|$/.test(trimmedLine) || /^\|(\s*:?-+:?\s*\|)+$/.test(trimmedLine)) {
        continue;
      }

      // Initialize new sheet if needed
      if (!currentSheet) {
        currentSheet = {
          name: currentSheetName,
          rows: [],
          freezeRow: 1, // Freeze header row
        };
        isFirstTableRow = true;
      }

      inTable = true;

      // Parse table row
      const cells = trimmedLine
        .slice(1, -1) // Remove leading and trailing |
        .split('|')
        .map((cell) => {
          const value = cell.trim();
          // Detect if it looks like a number
          const numValue = parseFloat(value.replace(/[$,]/g, ''));
          const isCurrency = /^\$[\d,.]+$/.test(value);
          const isPercent = /^\d+(\.\d+)?%$/.test(value);

          return {
            value: isNaN(numValue) ? value : isCurrency || isPercent ? value : numValue,
            currency: isCurrency,
            percent: isPercent,
            alignment: isNaN(numValue) ? ('left' as const) : ('right' as const),
          };
        });

      currentSheet.rows.push({
        isHeader: isFirstTableRow,
        cells,
      });

      isFirstTableRow = false;
    } else if (inTable && trimmedLine === '') {
      // End of table, save sheet
      if (currentSheet && currentSheet.rows.length > 0) {
        sheets.push(currentSheet);
        currentSheet = null;
      }
      inTable = false;
      isFirstTableRow = true;
    }
  }

  // Save last sheet if exists
  if (currentSheet && currentSheet.rows.length > 0) {
    sheets.push(currentSheet);
  }

  // If no tables found, create a simple single-cell sheet with the content
  if (sheets.length === 0) {
    sheets.push({
      name: title || 'Sheet1',
      rows: [
        {
          isHeader: false,
          cells: [{ value: content.slice(0, 1000) }], // Truncate long content
        },
      ],
    });
  }

  return {
    type: 'spreadsheet',
    title,
    sheets,
  };
}
