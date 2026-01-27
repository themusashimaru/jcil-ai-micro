/**
 * COMPARISON TABLE GENERATOR
 *
 * Generates structured comparison tables from research data.
 * Used by scouts to present findings in an organized format.
 */

import { logger } from '@/lib/logger';

const log = logger('ComparisonTable');

// =============================================================================
// TYPES
// =============================================================================

export interface ComparisonItem {
  name: string;
  source?: string;
  sourceUrl?: string;
  attributes: Record<string, string | number | boolean | null>;
}

export interface ComparisonTableInput {
  title: string;
  items: ComparisonItem[];
  sortBy?: string; // attribute key to sort by
  sortOrder?: 'asc' | 'desc';
  highlightBest?: string[]; // attribute keys where we should highlight best values
}

export interface ComparisonTableOutput {
  success: boolean;
  table?: {
    title: string;
    headers: string[];
    rows: Array<{
      name: string;
      values: string[];
      highlights: boolean[]; // which values are "best"
      sourceUrl?: string;
    }>;
    summary: {
      bestOverall?: string;
      bestByAttribute: Record<string, string>;
    };
  };
  markdown?: string;
  error?: string;
}

// =============================================================================
// COMPARISON TABLE GENERATOR
// =============================================================================

/**
 * Generate a comparison table from collected data
 */
export function generateComparisonTable(input: ComparisonTableInput): ComparisonTableOutput {
  const { title, items, sortBy, sortOrder = 'asc', highlightBest = [] } = input;

  log.info('Generating comparison table', { title, itemCount: items.length });

  if (items.length === 0) {
    return {
      success: false,
      error: 'No items to compare',
    };
  }

  try {
    // Collect all unique attribute keys
    const allAttributes = new Set<string>();
    items.forEach((item) => {
      Object.keys(item.attributes).forEach((key) => allAttributes.add(key));
    });

    const attributeKeys = Array.from(allAttributes);
    const headers = ['Name', ...attributeKeys];

    // Sort items if requested
    const sortedItems = [...items];
    if (sortBy && attributeKeys.includes(sortBy)) {
      sortedItems.sort((a, b) => {
        const aVal = a.attributes[sortBy];
        const bVal = b.attributes[sortBy];

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        }

        const aStr = String(aVal);
        const bStr = String(bVal);
        return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }

    // Find best values for highlighted attributes
    const bestValues: Record<string, { value: string | number; item: string }> = {};
    for (const attr of highlightBest) {
      if (!attributeKeys.includes(attr)) continue;

      let bestValue: number | null = null;
      let bestItem: string | null = null;

      for (const item of items) {
        const val = item.attributes[attr];
        if (typeof val === 'number') {
          // Assuming lower is better for prices, higher for ratings
          const isBetter =
            attr.toLowerCase().includes('price') || attr.toLowerCase().includes('cost')
              ? bestValue === null || val < bestValue
              : bestValue === null || val > bestValue;

          if (isBetter) {
            bestValue = val;
            bestItem = item.name;
          }
        }
      }

      if (bestItem) {
        bestValues[attr] = { value: bestValue!, item: bestItem };
      }
    }

    // Build rows with highlight flags
    const rows = sortedItems.map((item) => {
      const values = attributeKeys.map((key) => {
        const val = item.attributes[key];
        if (val === null || val === undefined) return '—';
        if (typeof val === 'boolean') return val ? '✓' : '✗';
        return String(val);
      });

      const highlights = attributeKeys.map((key) => {
        return bestValues[key]?.item === item.name;
      });

      return {
        name: item.name,
        values,
        highlights,
        sourceUrl: item.sourceUrl,
      };
    });

    // Build summary
    const bestByAttribute: Record<string, string> = {};
    for (const [attr, data] of Object.entries(bestValues)) {
      bestByAttribute[attr] = `${data.item} (${data.value})`;
    }

    // Determine best overall (simple scoring: +1 for each "best" attribute)
    let bestOverall: string | undefined;
    if (Object.keys(bestValues).length > 0) {
      const scores: Record<string, number> = {};
      for (const item of items) {
        scores[item.name] = 0;
        for (const attr of Object.keys(bestValues)) {
          if (bestValues[attr].item === item.name) {
            scores[item.name]++;
          }
        }
      }
      const topScore = Math.max(...Object.values(scores));
      if (topScore > 0) {
        const winners = Object.entries(scores).filter(([, s]) => s === topScore);
        bestOverall = winners.length === 1 ? winners[0][0] : undefined;
      }
    }

    // Generate markdown table
    const markdown = generateMarkdownTable({
      title,
      headers,
      rows,
      bestValues,
    });

    log.info('Comparison table generated', {
      title,
      rowCount: rows.length,
      columnCount: headers.length,
    });

    return {
      success: true,
      table: {
        title,
        headers,
        rows,
        summary: {
          bestOverall,
          bestByAttribute,
        },
      },
      markdown,
    };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.error('Comparison table generation failed', { error: errMsg });
    return {
      success: false,
      error: errMsg,
    };
  }
}

// =============================================================================
// MARKDOWN GENERATION
// =============================================================================

function generateMarkdownTable(params: {
  title: string;
  headers: string[];
  rows: Array<{
    name: string;
    values: string[];
    highlights: boolean[];
    sourceUrl?: string;
  }>;
  bestValues: Record<string, { value: string | number; item: string }>;
}): string {
  const { title, headers, rows, bestValues } = params;

  const lines: string[] = [];

  // Title
  lines.push(`## ${title}`);
  lines.push('');

  // Table header
  lines.push('| ' + headers.join(' | ') + ' |');
  lines.push('| ' + headers.map(() => '---').join(' | ') + ' |');

  // Table rows
  for (const row of rows) {
    const name = row.sourceUrl ? `[${row.name}](${row.sourceUrl})` : row.name;
    const values = row.values.map((val, i) => {
      // Bold best values
      if (row.highlights[i]) {
        return `**${val}** ✨`;
      }
      return val;
    });
    lines.push('| ' + [name, ...values].join(' | ') + ' |');
  }

  // Summary section
  if (Object.keys(bestValues).length > 0) {
    lines.push('');
    lines.push('### Key Findings');
    for (const [attr, data] of Object.entries(bestValues)) {
      lines.push(`- **Best ${attr}**: ${data.item} (${data.value})`);
    }
  }

  return lines.join('\n');
}

// =============================================================================
// HELPER: PARSE COMPARISON DATA FROM RESEARCH
// =============================================================================

export interface ParsedComparisonData {
  items: ComparisonItem[];
  suggestedHighlights: string[];
}

/**
 * Helper to parse comparison data from various research outputs
 */
export function parseComparisonData(
  data: Array<{
    name: string;
    source?: string;
    url?: string;
    rawData: Record<string, unknown>;
  }>
): ParsedComparisonData {
  const items: ComparisonItem[] = [];
  const attributeFrequency: Record<string, number> = {};

  for (const entry of data) {
    const attributes: Record<string, string | number | boolean | null> = {};

    for (const [key, value] of Object.entries(entry.rawData)) {
      // Normalize attribute names
      const normalizedKey = key
        .toLowerCase()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

      // Parse values
      if (value === null || value === undefined) {
        attributes[normalizedKey] = null;
      } else if (typeof value === 'number') {
        attributes[normalizedKey] = value;
      } else if (typeof value === 'boolean') {
        attributes[normalizedKey] = value;
      } else if (typeof value === 'string') {
        // Try to parse as number
        const numMatch = value.match(/^\$?([\d,]+(?:\.\d+)?)/);
        if (numMatch) {
          attributes[normalizedKey] = parseFloat(numMatch[1].replace(/,/g, ''));
        } else {
          attributes[normalizedKey] = value;
        }
      } else {
        attributes[normalizedKey] = String(value);
      }

      // Track attribute frequency for suggesting highlights
      attributeFrequency[normalizedKey] = (attributeFrequency[normalizedKey] || 0) + 1;
    }

    items.push({
      name: entry.name,
      source: entry.source,
      sourceUrl: entry.url,
      attributes,
    });
  }

  // Suggest highlighting attributes that appear in most items and are numeric
  const suggestedHighlights: string[] = [];
  for (const [attr, count] of Object.entries(attributeFrequency)) {
    if (count >= data.length * 0.7) {
      // Present in 70%+ of items
      // Check if mostly numeric
      const numericCount = items.filter((item) => typeof item.attributes[attr] === 'number').length;
      if (numericCount >= count * 0.5) {
        suggestedHighlights.push(attr);
      }
    }
  }

  return { items, suggestedHighlights };
}
