// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

/**
 * COMPREHENSIVE TESTS for src/agents/strategy/tools/comparisonTable.ts
 *
 * Tests all exported functions:
 *   - generateComparisonTable
 *   - parseComparisonData
 *
 * Tests all exported types/interfaces:
 *   - ComparisonItem
 *   - ComparisonTableInput
 *   - ComparisonTableOutput
 *   - ParsedComparisonData
 *
 * All external dependencies are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  logger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────────

import { generateComparisonTable, parseComparisonData } from '../comparisonTable';

import type { ComparisonItem, ComparisonTableInput } from '../comparisonTable';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeItem(
  name: string,
  attributes: Record<string, string | number | boolean | null>,
  sourceUrl?: string
): ComparisonItem {
  return { name, attributes, sourceUrl };
}

function makeInput(overrides: Partial<ComparisonTableInput> = {}): ComparisonTableInput {
  return {
    title: 'Test Comparison',
    items: [
      makeItem('Product A', { Price: 10, Rating: 4.5 }),
      makeItem('Product B', { Price: 20, Rating: 3.8 }),
      makeItem('Product C', { Price: 15, Rating: 4.9 }),
    ],
    ...overrides,
  };
}

// =============================================================================
// generateComparisonTable
// =============================================================================

describe('generateComparisonTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Basic success cases ──────────────────────────────────────────────────

  it('should return success=true for valid input with multiple items', () => {
    const result = generateComparisonTable(makeInput());
    expect(result.success).toBe(true);
    expect(result.table).toBeDefined();
    expect(result.markdown).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it('should return success=true for a single item', () => {
    const result = generateComparisonTable(
      makeInput({
        items: [makeItem('Solo', { Price: 5 })],
      })
    );
    expect(result.success).toBe(true);
    expect(result.table!.rows).toHaveLength(1);
  });

  it('should set the table title from the input', () => {
    const result = generateComparisonTable(makeInput({ title: 'My Title' }));
    expect(result.table!.title).toBe('My Title');
  });

  // ── Empty input ──────────────────────────────────────────────────────────

  it('should return success=false with error when items array is empty', () => {
    const result = generateComparisonTable(makeInput({ items: [] }));
    expect(result.success).toBe(false);
    expect(result.error).toBe('No items to compare');
    expect(result.table).toBeUndefined();
    expect(result.markdown).toBeUndefined();
  });

  // ── Header generation ────────────────────────────────────────────────────

  it('should include "Name" as the first header', () => {
    const result = generateComparisonTable(makeInput());
    expect(result.table!.headers[0]).toBe('Name');
  });

  it('should collect all unique attribute keys into headers', () => {
    const result = generateComparisonTable(
      makeInput({
        items: [
          makeItem('A', { Color: 'red', Size: 'L' }),
          makeItem('B', { Color: 'blue', Weight: 10 }),
        ],
      })
    );
    const headers = result.table!.headers;
    expect(headers).toContain('Color');
    expect(headers).toContain('Size');
    expect(headers).toContain('Weight');
  });

  it('should not duplicate attribute keys across items in headers', () => {
    const result = generateComparisonTable(
      makeInput({
        items: [makeItem('A', { Price: 10 }), makeItem('B', { Price: 20 })],
      })
    );
    const priceCount = result.table!.headers.filter((h) => h === 'Price').length;
    expect(priceCount).toBe(1);
  });

  // ── Row generation ───────────────────────────────────────────────────────

  it('should create one row per item', () => {
    const input = makeInput();
    const result = generateComparisonTable(input);
    expect(result.table!.rows).toHaveLength(input.items.length);
  });

  it('should include item names in each row', () => {
    const result = generateComparisonTable(makeInput());
    const names = result.table!.rows.map((r) => r.name);
    expect(names).toEqual(['Product A', 'Product B', 'Product C']);
  });

  it('should convert null attribute values to "—"', () => {
    const result = generateComparisonTable(
      makeInput({
        items: [makeItem('A', { Price: null })],
      })
    );
    expect(result.table!.rows[0].values).toContain('—');
  });

  it('should convert boolean true to "✓"', () => {
    const result = generateComparisonTable(
      makeInput({
        items: [makeItem('A', { Available: true })],
      })
    );
    expect(result.table!.rows[0].values).toContain('✓');
  });

  it('should convert boolean false to "✗"', () => {
    const result = generateComparisonTable(
      makeInput({
        items: [makeItem('A', { Available: false })],
      })
    );
    expect(result.table!.rows[0].values).toContain('✗');
  });

  it('should convert numeric values to strings', () => {
    const result = generateComparisonTable(
      makeInput({
        items: [makeItem('A', { Price: 42 })],
      })
    );
    expect(result.table!.rows[0].values).toContain('42');
  });

  it('should convert string values as-is', () => {
    const result = generateComparisonTable(
      makeInput({
        items: [makeItem('A', { Color: 'red' })],
      })
    );
    expect(result.table!.rows[0].values).toContain('red');
  });

  it('should show "—" for missing attributes when items have different attribute sets', () => {
    const result = generateComparisonTable(
      makeInput({
        items: [makeItem('A', { Price: 10 }), makeItem('B', { Rating: 4.5 })],
      })
    );
    // A should have "—" for Rating, B should have "—" for Price
    const rowA = result.table!.rows.find((r) => r.name === 'A')!;
    const rowB = result.table!.rows.find((r) => r.name === 'B')!;
    expect(rowA.values).toContain('—');
    expect(rowB.values).toContain('—');
  });

  it('should preserve sourceUrl on rows', () => {
    const result = generateComparisonTable(
      makeInput({
        items: [makeItem('A', { Price: 10 }, 'https://example.com')],
      })
    );
    expect(result.table!.rows[0].sourceUrl).toBe('https://example.com');
  });

  it('should set sourceUrl to undefined when not provided', () => {
    const result = generateComparisonTable(
      makeInput({
        items: [makeItem('A', { Price: 10 })],
      })
    );
    expect(result.table!.rows[0].sourceUrl).toBeUndefined();
  });

  // ── Sorting ──────────────────────────────────────────────────────────────

  it('should sort items ascending by a numeric attribute when sortBy and sortOrder=asc', () => {
    const result = generateComparisonTable(
      makeInput({
        sortBy: 'Price',
        sortOrder: 'asc',
      })
    );
    const names = result.table!.rows.map((r) => r.name);
    expect(names).toEqual(['Product A', 'Product C', 'Product B']);
  });

  it('should sort items descending by a numeric attribute when sortOrder=desc', () => {
    const result = generateComparisonTable(
      makeInput({
        sortBy: 'Price',
        sortOrder: 'desc',
      })
    );
    const names = result.table!.rows.map((r) => r.name);
    expect(names).toEqual(['Product B', 'Product C', 'Product A']);
  });

  it('should default to ascending sort when sortOrder is not specified', () => {
    const result = generateComparisonTable(
      makeInput({
        sortBy: 'Price',
      })
    );
    const names = result.table!.rows.map((r) => r.name);
    expect(names).toEqual(['Product A', 'Product C', 'Product B']);
  });

  it('should sort string attributes alphabetically ascending', () => {
    const result = generateComparisonTable(
      makeInput({
        items: [
          makeItem('A', { Color: 'cherry' }),
          makeItem('B', { Color: 'apple' }),
          makeItem('C', { Color: 'banana' }),
        ],
        sortBy: 'Color',
        sortOrder: 'asc',
      })
    );
    const names = result.table!.rows.map((r) => r.name);
    expect(names).toEqual(['B', 'C', 'A']);
  });

  it('should sort string attributes descending', () => {
    const result = generateComparisonTable(
      makeInput({
        items: [
          makeItem('A', { Color: 'cherry' }),
          makeItem('B', { Color: 'apple' }),
          makeItem('C', { Color: 'banana' }),
        ],
        sortBy: 'Color',
        sortOrder: 'desc',
      })
    );
    const names = result.table!.rows.map((r) => r.name);
    expect(names).toEqual(['A', 'C', 'B']);
  });

  it('should place items with null sort values at the end', () => {
    const result = generateComparisonTable(
      makeInput({
        items: [
          makeItem('A', { Price: null }),
          makeItem('B', { Price: 5 }),
          makeItem('C', { Price: 10 }),
        ],
        sortBy: 'Price',
        sortOrder: 'asc',
      })
    );
    const names = result.table!.rows.map((r) => r.name);
    expect(names[names.length - 1]).toBe('A');
  });

  it('should not sort when sortBy attribute does not exist in items', () => {
    const input = makeInput({ sortBy: 'NonExistentAttr' });
    const result = generateComparisonTable(input);
    const names = result.table!.rows.map((r) => r.name);
    // Original order preserved
    expect(names).toEqual(['Product A', 'Product B', 'Product C']);
  });

  it('should not sort when sortBy is not provided', () => {
    const result = generateComparisonTable(makeInput());
    const names = result.table!.rows.map((r) => r.name);
    expect(names).toEqual(['Product A', 'Product B', 'Product C']);
  });

  it('should sort nulls to end even when both values are null', () => {
    const result = generateComparisonTable(
      makeInput({
        items: [
          makeItem('A', { Price: null }),
          makeItem('B', { Price: null }),
          makeItem('C', { Price: 5 }),
        ],
        sortBy: 'Price',
        sortOrder: 'asc',
      })
    );
    const names = result.table!.rows.map((r) => r.name);
    expect(names[0]).toBe('C');
  });

  // ── Highlighting ─────────────────────────────────────────────────────────

  it('should highlight the item with the lowest price when highlightBest includes a price attribute', () => {
    const result = generateComparisonTable(
      makeInput({
        highlightBest: ['Price'],
      })
    );
    const rowA = result.table!.rows.find((r) => r.name === 'Product A')!;
    const priceIdx = result.table!.headers.indexOf('Price') - 1; // subtract 1 for 'Name'
    expect(rowA.highlights[priceIdx]).toBe(true);
  });

  it('should highlight the item with the highest rating when highlightBest includes a non-price attribute', () => {
    const result = generateComparisonTable(
      makeInput({
        highlightBest: ['Rating'],
      })
    );
    const rowC = result.table!.rows.find((r) => r.name === 'Product C')!;
    const ratingIdx = result.table!.headers.indexOf('Rating') - 1;
    expect(rowC.highlights[ratingIdx]).toBe(true);
  });

  it('should not highlight items that are not the best', () => {
    const result = generateComparisonTable(
      makeInput({
        highlightBest: ['Price'],
      })
    );
    const rowB = result.table!.rows.find((r) => r.name === 'Product B')!;
    const priceIdx = result.table!.headers.indexOf('Price') - 1;
    expect(rowB.highlights[priceIdx]).toBe(false);
  });

  it('should highlight lowest for cost-related attributes', () => {
    const result = generateComparisonTable(
      makeInput({
        items: [makeItem('A', { 'Monthly Cost': 50 }), makeItem('B', { 'Monthly Cost': 30 })],
        highlightBest: ['Monthly Cost'],
      })
    );
    const rowB = result.table!.rows.find((r) => r.name === 'B')!;
    expect(rowB.highlights[0]).toBe(true);
  });

  it('should skip highlighting for attributes not in the items', () => {
    const result = generateComparisonTable(
      makeInput({
        highlightBest: ['NonExistent'],
      })
    );
    // All highlights should be false
    for (const row of result.table!.rows) {
      expect(row.highlights.every((h) => h === false)).toBe(true);
    }
  });

  it('should skip highlighting for non-numeric attributes', () => {
    const result = generateComparisonTable(
      makeInput({
        items: [makeItem('A', { Color: 'red' }), makeItem('B', { Color: 'blue' })],
        highlightBest: ['Color'],
      })
    );
    for (const row of result.table!.rows) {
      expect(row.highlights.every((h) => h === false)).toBe(true);
    }
  });

  it('should highlight multiple attributes simultaneously', () => {
    const result = generateComparisonTable(
      makeInput({
        highlightBest: ['Price', 'Rating'],
      })
    );
    const summary = result.table!.summary;
    expect(summary.bestByAttribute).toHaveProperty('Price');
    expect(summary.bestByAttribute).toHaveProperty('Rating');
  });

  it('should default highlightBest to empty array when not provided', () => {
    const result = generateComparisonTable(makeInput());
    // No highlights should be set
    for (const row of result.table!.rows) {
      expect(row.highlights.every((h) => h === false)).toBe(true);
    }
  });

  // ── Summary / bestOverall ────────────────────────────────────────────────

  it('should populate bestByAttribute in the summary', () => {
    const result = generateComparisonTable(
      makeInput({
        highlightBest: ['Price'],
      })
    );
    expect(result.table!.summary.bestByAttribute.Price).toContain('Product A');
  });

  it('should determine bestOverall when one item wins the most categories', () => {
    const result = generateComparisonTable(
      makeInput({
        items: [
          makeItem('X', { Price: 5, Rating: 4.9, Speed: 100 }),
          makeItem('Y', { Price: 50, Rating: 2.0, Speed: 10 }),
        ],
        highlightBest: ['Price', 'Rating', 'Speed'],
      })
    );
    expect(result.table!.summary.bestOverall).toBe('X');
  });

  it('should set bestOverall to undefined when there is a tie', () => {
    const result = generateComparisonTable(
      makeInput({
        items: [
          makeItem('X', { Price: 5, Rating: 3.0 }),
          makeItem('Y', { Price: 10, Rating: 5.0 }),
        ],
        highlightBest: ['Price', 'Rating'],
      })
    );
    // X wins Price, Y wins Rating — tie
    expect(result.table!.summary.bestOverall).toBeUndefined();
  });

  it('should set bestOverall to undefined when no highlights are specified', () => {
    const result = generateComparisonTable(makeInput());
    expect(result.table!.summary.bestOverall).toBeUndefined();
  });

  it('should format bestByAttribute as "Item (value)"', () => {
    const result = generateComparisonTable(
      makeInput({
        highlightBest: ['Price'],
      })
    );
    expect(result.table!.summary.bestByAttribute.Price).toBe('Product A (10)');
  });

  // ── Markdown generation ──────────────────────────────────────────────────

  it('should include the title as a markdown heading', () => {
    const result = generateComparisonTable(makeInput({ title: 'Great Table' }));
    expect(result.markdown).toContain('## Great Table');
  });

  it('should include a markdown table header row', () => {
    const result = generateComparisonTable(makeInput());
    expect(result.markdown).toContain('| Name |');
    expect(result.markdown).toContain('| --- |');
  });

  it('should include item names in the markdown table', () => {
    const result = generateComparisonTable(makeInput());
    expect(result.markdown).toContain('Product A');
    expect(result.markdown).toContain('Product B');
  });

  it('should bold and add sparkle to highlighted values in markdown', () => {
    const result = generateComparisonTable(
      makeInput({
        highlightBest: ['Price'],
      })
    );
    expect(result.markdown).toContain('**10**');
  });

  it('should render linked names in markdown when sourceUrl is provided', () => {
    const result = generateComparisonTable(
      makeInput({
        items: [makeItem('Widget', { Price: 10 }, 'https://example.com')],
      })
    );
    expect(result.markdown).toContain('[Widget](https://example.com)');
  });

  it('should render plain names in markdown when sourceUrl is not provided', () => {
    const result = generateComparisonTable(
      makeInput({
        items: [makeItem('Widget', { Price: 10 })],
      })
    );
    expect(result.markdown).not.toContain('[Widget]');
    expect(result.markdown).toContain('Widget');
  });

  it('should include Key Findings section in markdown when there are highlights', () => {
    const result = generateComparisonTable(
      makeInput({
        highlightBest: ['Price'],
      })
    );
    expect(result.markdown).toContain('### Key Findings');
    expect(result.markdown).toContain('**Best Price**');
  });

  it('should not include Key Findings section when there are no highlights', () => {
    const result = generateComparisonTable(makeInput());
    expect(result.markdown).not.toContain('### Key Findings');
  });

  // ── Error handling ───────────────────────────────────────────────────────

  it('should catch errors and return success=false with error message', () => {
    // Pass an input whose items will cause an error by making items a
    // proxy that throws on iteration — but simpler: we can use a getter
    // that throws on attribute access.
    const badItem = {
      name: 'Bad',
      attributes: new Proxy(
        {},
        {
          ownKeys() {
            throw new Error('Proxy explosion');
          },
          getOwnPropertyDescriptor() {
            throw new Error('Proxy explosion');
          },
        }
      ),
    };
    const result = generateComparisonTable({
      title: 'Broken',
      items: [badItem],
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Proxy explosion');
  });

  it('should handle Error objects in catch block', () => {
    const badItem = {
      name: 'Bad',
      attributes: new Proxy(
        {},
        {
          ownKeys() {
            throw new Error('Specific error');
          },
          getOwnPropertyDescriptor() {
            throw new Error('Specific error');
          },
        }
      ),
    };
    const result = generateComparisonTable({ title: 'Test', items: [badItem] });
    expect(result.error).toBe('Specific error');
  });

  it('should handle non-Error throws in catch block', () => {
    const badItem = {
      name: 'Bad',
      attributes: new Proxy(
        {},
        {
          ownKeys() {
            throw 'string error';
          },
          getOwnPropertyDescriptor() {
            throw 'string error';
          },
        }
      ),
    };
    const result = generateComparisonTable({ title: 'Test', items: [badItem] });
    expect(result.error).toBe('string error');
  });
});

// =============================================================================
// parseComparisonData
// =============================================================================

describe('parseComparisonData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Basic parsing ────────────────────────────────────────────────────────

  it('should parse basic data entries into ComparisonItems', () => {
    const result = parseComparisonData([{ name: 'A', rawData: { price: 10 } }]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('A');
  });

  it('should return empty items for empty input array', () => {
    const result = parseComparisonData([]);
    expect(result.items).toHaveLength(0);
    expect(result.suggestedHighlights).toHaveLength(0);
  });

  // ── Key normalization ────────────────────────────────────────────────────

  it('should normalize underscore-separated keys to title case', () => {
    const result = parseComparisonData([{ name: 'A', rawData: { monthly_price: 10 } }]);
    expect(result.items[0].attributes).toHaveProperty('Monthly Price');
  });

  it('should normalize lowercase keys to title case', () => {
    const result = parseComparisonData([{ name: 'A', rawData: { color: 'red' } }]);
    expect(result.items[0].attributes).toHaveProperty('Color');
  });

  it('should capitalize each word in multi-word keys', () => {
    const result = parseComparisonData([{ name: 'A', rawData: { max_download_speed: 100 } }]);
    expect(result.items[0].attributes).toHaveProperty('Max Download Speed');
  });

  // ── Value parsing ────────────────────────────────────────────────────────

  it('should preserve null values', () => {
    const result = parseComparisonData([{ name: 'A', rawData: { price: null } }]);
    expect(result.items[0].attributes.Price).toBeNull();
  });

  it('should preserve undefined values as null', () => {
    const result = parseComparisonData([{ name: 'A', rawData: { price: undefined } }]);
    expect(result.items[0].attributes.Price).toBeNull();
  });

  it('should preserve number values as-is', () => {
    const result = parseComparisonData([{ name: 'A', rawData: { rating: 4.5 } }]);
    expect(result.items[0].attributes.Rating).toBe(4.5);
  });

  it('should preserve boolean values as-is', () => {
    const result = parseComparisonData([
      { name: 'A', rawData: { available: true, discontinued: false } },
    ]);
    expect(result.items[0].attributes.Available).toBe(true);
    expect(result.items[0].attributes.Discontinued).toBe(false);
  });

  it('should parse dollar-prefixed strings as numbers', () => {
    const result = parseComparisonData([{ name: 'A', rawData: { price: '$29.99' } }]);
    expect(result.items[0].attributes.Price).toBe(29.99);
  });

  it('should parse comma-separated numeric strings as numbers', () => {
    const result = parseComparisonData([{ name: 'A', rawData: { revenue: '1,234,567' } }]);
    expect(result.items[0].attributes.Revenue).toBe(1234567);
  });

  it('should parse plain numeric strings as numbers', () => {
    const result = parseComparisonData([{ name: 'A', rawData: { count: '42' } }]);
    expect(result.items[0].attributes.Count).toBe(42);
  });

  it('should keep non-numeric strings as strings', () => {
    const result = parseComparisonData([{ name: 'A', rawData: { color: 'blue' } }]);
    expect(result.items[0].attributes.Color).toBe('blue');
  });

  it('should stringify object values', () => {
    const result = parseComparisonData([{ name: 'A', rawData: { details: { nested: 'obj' } } }]);
    expect(typeof result.items[0].attributes.Details).toBe('string');
  });

  it('should stringify array values', () => {
    const result = parseComparisonData([{ name: 'A', rawData: { tags: ['a', 'b'] } }]);
    expect(typeof result.items[0].attributes.Tags).toBe('string');
  });

  // ── Source metadata ──────────────────────────────────────────────────────

  it('should map source field to item.source', () => {
    const result = parseComparisonData([{ name: 'A', source: 'Google', rawData: {} }]);
    expect(result.items[0].source).toBe('Google');
  });

  it('should map url field to item.sourceUrl', () => {
    const result = parseComparisonData([{ name: 'A', url: 'https://example.com', rawData: {} }]);
    expect(result.items[0].sourceUrl).toBe('https://example.com');
  });

  it('should handle entries without source or url', () => {
    const result = parseComparisonData([{ name: 'A', rawData: { price: 10 } }]);
    expect(result.items[0].source).toBeUndefined();
    expect(result.items[0].sourceUrl).toBeUndefined();
  });

  // ── Suggested highlights ─────────────────────────────────────────────────

  it('should suggest highlighting for numeric attributes present in 70%+ of items', () => {
    const result = parseComparisonData([
      { name: 'A', rawData: { price: 10 } },
      { name: 'B', rawData: { price: 20 } },
      { name: 'C', rawData: { price: 30 } },
    ]);
    expect(result.suggestedHighlights).toContain('Price');
  });

  it('should not suggest highlighting for attributes present in less than 70% of items', () => {
    const result = parseComparisonData([
      { name: 'A', rawData: { price: 10, rare: 1 } },
      { name: 'B', rawData: { price: 20 } },
      { name: 'C', rawData: { price: 30 } },
      { name: 'D', rawData: { price: 40 } },
      { name: 'E', rawData: { price: 50 } },
    ]);
    // 'rare' appears in 1/5 = 20% of items, should not be suggested
    expect(result.suggestedHighlights).not.toContain('Rare');
  });

  it('should not suggest highlighting for non-numeric attributes', () => {
    const result = parseComparisonData([
      { name: 'A', rawData: { color: 'red' } },
      { name: 'B', rawData: { color: 'blue' } },
      { name: 'C', rawData: { color: 'green' } },
    ]);
    expect(result.suggestedHighlights).not.toContain('Color');
  });

  it('should suggest highlighting for attributes that are mostly numeric (50%+ numeric)', () => {
    const result = parseComparisonData([
      { name: 'A', rawData: { score: 10 } },
      { name: 'B', rawData: { score: 20 } },
      { name: 'C', rawData: { score: 'N/A' } },
    ]);
    // 2 out of 3 are numeric (66.7%), attribute present in 100% of items
    expect(result.suggestedHighlights).toContain('Score');
  });

  it('should handle multiple suggested highlights', () => {
    const result = parseComparisonData([
      { name: 'A', rawData: { price: 10, rating: 4.5 } },
      { name: 'B', rawData: { price: 20, rating: 3.8 } },
      { name: 'C', rawData: { price: 15, rating: 4.2 } },
    ]);
    expect(result.suggestedHighlights).toContain('Price');
    expect(result.suggestedHighlights).toContain('Rating');
  });

  // ── Multiple items combined ──────────────────────────────────────────────

  it('should parse multiple items preserving order', () => {
    const result = parseComparisonData([
      { name: 'First', rawData: { x: 1 } },
      { name: 'Second', rawData: { x: 2 } },
      { name: 'Third', rawData: { x: 3 } },
    ]);
    expect(result.items.map((i) => i.name)).toEqual(['First', 'Second', 'Third']);
  });
});

// =============================================================================
// Integration: parseComparisonData -> generateComparisonTable
// =============================================================================

describe('parseComparisonData + generateComparisonTable integration', () => {
  it('should produce a valid comparison table from parsed research data', () => {
    const parsed = parseComparisonData([
      {
        name: 'Tool A',
        source: 'Review Site',
        url: 'https://a.com',
        rawData: { price: '$19.99', rating: 4.5, has_free_tier: true },
      },
      {
        name: 'Tool B',
        source: 'Review Site',
        url: 'https://b.com',
        rawData: { price: '$29.99', rating: 4.2, has_free_tier: false },
      },
      {
        name: 'Tool C',
        source: 'Review Site',
        url: 'https://c.com',
        rawData: { price: '$9.99', rating: 4.8, has_free_tier: true },
      },
    ]);

    const result = generateComparisonTable({
      title: 'Tool Comparison',
      items: parsed.items,
      sortBy: 'Price',
      sortOrder: 'asc',
      highlightBest: parsed.suggestedHighlights,
    });

    expect(result.success).toBe(true);
    expect(result.table!.rows).toHaveLength(3);
    // Sorted by price ascending: Tool C ($9.99), Tool A ($19.99), Tool B ($29.99)
    expect(result.table!.rows[0].name).toBe('Tool C');
    expect(result.table!.rows[1].name).toBe('Tool A');
    expect(result.table!.rows[2].name).toBe('Tool B');
    // Markdown should contain links
    expect(result.markdown).toContain('[Tool C](https://c.com)');
  });

  it('should handle mixed numeric and string parsing end-to-end', () => {
    const parsed = parseComparisonData([
      { name: 'X', rawData: { revenue: '$1,500,000', category: 'enterprise' } },
      { name: 'Y', rawData: { revenue: '$500,000', category: 'startup' } },
    ]);

    const result = generateComparisonTable({
      title: 'Revenue Comparison',
      items: parsed.items,
      sortBy: 'Revenue',
      sortOrder: 'desc',
      highlightBest: ['Revenue'],
    });

    expect(result.success).toBe(true);
    expect(result.table!.rows[0].name).toBe('X');
    // Should not suggest category for highlighting since it's non-numeric
    expect(parsed.suggestedHighlights).not.toContain('Category');
  });
});
