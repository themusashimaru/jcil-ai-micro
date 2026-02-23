import { describe, it, expect } from 'vitest';
import { parseANSI, stripANSI, generateLineId } from './terminalAnsiParser';

// ============================================================================
// parseANSI
// ============================================================================

describe('parseANSI', () => {
  // ------------------------------------------------------------------
  // Basic / no-code inputs
  // ------------------------------------------------------------------

  it('returns a single segment with empty style for plain text', () => {
    const result = parseANSI('hello world');
    expect(result).toEqual([{ text: 'hello world', style: {} }]);
  });

  it('returns a single segment with text "" and empty style for empty string', () => {
    const result = parseANSI('');
    expect(result).toEqual([{ text: '', style: {} }]);
  });

  // ------------------------------------------------------------------
  // Individual style codes
  // ------------------------------------------------------------------

  it('parses bold (\\x1b[1m)', () => {
    const result = parseANSI('\x1b[1mbold text');
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('bold text');
    expect(result[0].style.fontWeight).toBe('bold');
  });

  it('parses dim (\\x1b[2m)', () => {
    const result = parseANSI('\x1b[2mdim text');
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('dim text');
    expect(result[0].style.opacity).toBe(0.7);
  });

  it('parses italic (\\x1b[3m)', () => {
    const result = parseANSI('\x1b[3mitalic text');
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('italic text');
    expect(result[0].style.fontStyle).toBe('italic');
  });

  it('parses underline (\\x1b[4m)', () => {
    const result = parseANSI('\x1b[4munderlined');
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('underlined');
    expect(result[0].style.textDecoration).toBe('underline');
  });

  it('parses strikethrough (\\x1b[9m)', () => {
    const result = parseANSI('\x1b[9mstruck');
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('struck');
    expect(result[0].style.textDecoration).toBe('line-through');
  });

  // ------------------------------------------------------------------
  // Standard foreground colors (30–37)
  // ------------------------------------------------------------------

  it('parses red foreground (\\x1b[31m) → #ef4444', () => {
    const result = parseANSI('\x1b[31mred');
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('red');
    expect(result[0].style.color).toBe('#ef4444');
  });

  it('parses green foreground (\\x1b[32m) → #22c55e', () => {
    const result = parseANSI('\x1b[32mgreen');
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('green');
    expect(result[0].style.color).toBe('#22c55e');
  });

  it('parses blue foreground (\\x1b[34m) → #3b82f6', () => {
    const result = parseANSI('\x1b[34mblue');
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('blue');
    expect(result[0].style.color).toBe('#3b82f6');
  });

  it('parses black foreground (\\x1b[30m) → #1a1a1a', () => {
    const result = parseANSI('\x1b[30mblack');
    expect(result[0].style.color).toBe('#1a1a1a');
  });

  it('parses yellow foreground (\\x1b[33m) → #eab308', () => {
    const result = parseANSI('\x1b[33myellow');
    expect(result[0].style.color).toBe('#eab308');
  });

  it('parses magenta foreground (\\x1b[35m) → #a855f7', () => {
    const result = parseANSI('\x1b[35mmagenta');
    expect(result[0].style.color).toBe('#a855f7');
  });

  it('parses cyan foreground (\\x1b[36m) → #06b6d4', () => {
    const result = parseANSI('\x1b[36mcyan');
    expect(result[0].style.color).toBe('#06b6d4');
  });

  it('parses white foreground (\\x1b[37m) → #e5e5e5', () => {
    const result = parseANSI('\x1b[37mwhite');
    expect(result[0].style.color).toBe('#e5e5e5');
  });

  // ------------------------------------------------------------------
  // Bright foreground colors (90–97)
  // ------------------------------------------------------------------

  it('parses bright red (\\x1b[91m) → #f87171', () => {
    const result = parseANSI('\x1b[91mbright red');
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('bright red');
    expect(result[0].style.color).toBe('#f87171');
  });

  it('parses bright green (\\x1b[92m) → #4ade80', () => {
    const result = parseANSI('\x1b[92mtext');
    expect(result[0].style.color).toBe('#4ade80');
  });

  it('parses bright yellow (\\x1b[93m) → #facc15', () => {
    const result = parseANSI('\x1b[93mtext');
    expect(result[0].style.color).toBe('#facc15');
  });

  it('parses bright blue (\\x1b[94m) → #60a5fa', () => {
    const result = parseANSI('\x1b[94mtext');
    expect(result[0].style.color).toBe('#60a5fa');
  });

  it('parses bright magenta (\\x1b[95m) → #c084fc', () => {
    const result = parseANSI('\x1b[95mtext');
    expect(result[0].style.color).toBe('#c084fc');
  });

  it('parses bright cyan (\\x1b[96m) → #22d3ee', () => {
    const result = parseANSI('\x1b[96mtext');
    expect(result[0].style.color).toBe('#22d3ee');
  });

  it('parses bright white (\\x1b[97m) → #ffffff', () => {
    const result = parseANSI('\x1b[97mtext');
    expect(result[0].style.color).toBe('#ffffff');
  });

  it('parses bright black / gray (\\x1b[90m) → #6b7280', () => {
    const result = parseANSI('\x1b[90mtext');
    expect(result[0].style.color).toBe('#6b7280');
  });

  // ------------------------------------------------------------------
  // Background colors (40–47, 100–107)
  // ------------------------------------------------------------------

  it('parses standard background red (\\x1b[41m) → backgroundColor #ef4444', () => {
    const result = parseANSI('\x1b[41mtext');
    expect(result[0].style.backgroundColor).toBe('#ef4444');
  });

  it('parses standard background green (\\x1b[42m) → backgroundColor #22c55e', () => {
    const result = parseANSI('\x1b[42mtext');
    expect(result[0].style.backgroundColor).toBe('#22c55e');
  });

  it('parses bright background blue (\\x1b[104m) → backgroundColor #60a5fa', () => {
    const result = parseANSI('\x1b[104mtext');
    expect(result[0].style.backgroundColor).toBe('#60a5fa');
  });

  // ------------------------------------------------------------------
  // Reset code
  // ------------------------------------------------------------------

  it('reset code (\\x1b[0m) clears all accumulated styles', () => {
    const result = parseANSI('\x1b[1;31mbold red\x1b[0mplain');
    expect(result).toHaveLength(2);

    expect(result[0].text).toBe('bold red');
    expect(result[0].style.fontWeight).toBe('bold');
    expect(result[0].style.color).toBe('#ef4444');

    expect(result[1].text).toBe('plain');
    expect(result[1].style).toEqual({});
  });

  // ------------------------------------------------------------------
  // Multiple segments
  // ------------------------------------------------------------------

  it('produces 3 segments for "normal \\x1b[31mred\\x1b[0m normal"', () => {
    const result = parseANSI('normal \x1b[31mred\x1b[0m normal');
    expect(result).toHaveLength(3);

    expect(result[0].text).toBe('normal ');
    expect(result[0].style).toEqual({});

    expect(result[1].text).toBe('red');
    expect(result[1].style.color).toBe('#ef4444');

    expect(result[2].text).toBe(' normal');
    expect(result[2].style).toEqual({});
  });

  // ------------------------------------------------------------------
  // Combined codes (semicolon-separated)
  // ------------------------------------------------------------------

  it('parses combined codes \\x1b[1;31m as bold + red', () => {
    const result = parseANSI('\x1b[1;31mtext');
    expect(result).toHaveLength(1);
    expect(result[0].style.fontWeight).toBe('bold');
    expect(result[0].style.color).toBe('#ef4444');
  });

  it('parses combined codes \\x1b[1;3;4;32m as bold + italic + underline + green', () => {
    const result = parseANSI('\x1b[1;3;4;32mfancy');
    expect(result).toHaveLength(1);
    expect(result[0].style.fontWeight).toBe('bold');
    expect(result[0].style.fontStyle).toBe('italic');
    expect(result[0].style.textDecoration).toBe('underline');
    expect(result[0].style.color).toBe('#22c55e');
  });

  it('parses foreground + background in one escape \\x1b[31;42m', () => {
    const result = parseANSI('\x1b[31;42mtext');
    expect(result[0].style.color).toBe('#ef4444');
    expect(result[0].style.backgroundColor).toBe('#22c55e');
  });

  // ------------------------------------------------------------------
  // Text preservation
  // ------------------------------------------------------------------

  it('preserves text before and after ANSI codes', () => {
    const result = parseANSI('before\x1b[31mcolored\x1b[0mafter');
    const fullText = result.map((s) => s.text).join('');
    expect(fullText).toBe('beforecoloredafter');
  });

  it('preserves whitespace and special characters', () => {
    const result = parseANSI('  \ttab\n\x1b[32mnewline  ');
    const fullText = result.map((s) => s.text).join('');
    expect(fullText).toBe('  \ttab\nnewline  ');
  });

  // ------------------------------------------------------------------
  // Styles accumulate until reset
  // ------------------------------------------------------------------

  it('accumulates styles across multiple escape sequences', () => {
    const result = parseANSI('\x1b[1mfirst\x1b[31msecond');
    // "first" has bold only
    expect(result[0].style.fontWeight).toBe('bold');
    expect(result[0].style.color).toBeUndefined();

    // "second" has bold (carried over) + red
    expect(result[1].style.fontWeight).toBe('bold');
    expect(result[1].style.color).toBe('#ef4444');
  });

  // ------------------------------------------------------------------
  // Edge: only escape codes, no visible text
  // ------------------------------------------------------------------

  it('returns a single empty-text segment for input with only escape codes', () => {
    const result = parseANSI('\x1b[31m\x1b[0m');
    // No visible text between or after codes → fallback to [{ text: input, style: {} }]
    // Actually the segments array will be empty, so the fallback kicks in
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('\x1b[31m\x1b[0m');
    expect(result[0].style).toEqual({});
  });
});

// ============================================================================
// stripANSI
// ============================================================================

describe('stripANSI', () => {
  it('returns plain text unchanged', () => {
    expect(stripANSI('hello world')).toBe('hello world');
  });

  it('strips a single color code', () => {
    expect(stripANSI('\x1b[31mred text')).toBe('red text');
  });

  it('strips multiple codes', () => {
    expect(stripANSI('\x1b[1;31mbold red\x1b[0m normal')).toBe('bold red normal');
  });

  it('strips all style codes from complex input', () => {
    const input = '\x1b[1m\x1b[3m\x1b[4m\x1b[31mfancy\x1b[0m plain';
    expect(stripANSI(input)).toBe('fancy plain');
  });

  it('returns empty string for empty input', () => {
    expect(stripANSI('')).toBe('');
  });

  it('strips codes that have no visible text between them', () => {
    expect(stripANSI('\x1b[31m\x1b[0m')).toBe('');
  });
});

// ============================================================================
// generateLineId
// ============================================================================

describe('generateLineId', () => {
  it('returns a string starting with "line-"', () => {
    const id = generateLineId();
    expect(id.startsWith('line-')).toBe(true);
  });

  it('generates unique IDs across consecutive calls', () => {
    const id1 = generateLineId();
    const id2 = generateLineId();
    expect(id1).not.toBe(id2);
  });

  it('contains a timestamp-like number as the last segment', () => {
    const id = generateLineId();
    const parts = id.split('-');
    // format: line-{counter}-{timestamp}
    expect(parts.length).toBe(3);
    const timestamp = Number(parts[2]);
    expect(Number.isNaN(timestamp)).toBe(false);
    // timestamp should be a recent epoch millis (> 2020-01-01)
    expect(timestamp).toBeGreaterThan(1577836800000);
  });

  it('has an incrementing counter as the second segment', () => {
    const id1 = generateLineId();
    const id2 = generateLineId();
    const counter1 = Number(id1.split('-')[1]);
    const counter2 = Number(id2.split('-')[1]);
    expect(counter2).toBeGreaterThan(counter1);
  });
});
