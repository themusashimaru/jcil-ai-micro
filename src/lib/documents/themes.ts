/**
 * DOCUMENT THEME PRESETS
 * Named color schemes that apply consistently across all document types.
 *
 * Each theme provides colors for primary (headings/headers), accent (highlights),
 * background tints, and text. Generators pull these via the format.theme field.
 */

export interface DocumentTheme {
  name: string;
  description: string;
  primaryColor: string; // Hex — headings, headers, section dividers
  accentColor: string; // Hex — highlights, secondary elements
  headerBg: string; // Hex — table/spreadsheet header background
  headerText: string; // Hex — text on header background
  altRowBg: string; // Hex — alternating row tint
  textColor: string; // Hex — body text
}

/**
 * Five built-in theme presets.
 */
export const THEMES: Record<string, DocumentTheme> = {
  corporate_blue: {
    name: 'Corporate Blue',
    description: 'Professional navy and steel — ideal for business documents',
    primaryColor: '#1e3a5f',
    accentColor: '#4472c4',
    headerBg: '#1e3a5f',
    headerText: '#ffffff',
    altRowBg: '#eef3f8',
    textColor: '#333333',
  },
  modern_dark: {
    name: 'Modern Dark',
    description: 'Sleek charcoal with teal accents — contemporary and bold',
    primaryColor: '#2d2d2d',
    accentColor: '#00b4d8',
    headerBg: '#2d2d2d',
    headerText: '#ffffff',
    altRowBg: '#f0f0f0',
    textColor: '#1a1a1a',
  },
  warm_earth: {
    name: 'Warm Earth',
    description: 'Rich browns and amber — warm and approachable',
    primaryColor: '#5c3d2e',
    accentColor: '#d4a373',
    headerBg: '#5c3d2e',
    headerText: '#ffffff',
    altRowBg: '#faf3ec',
    textColor: '#3b3b3b',
  },
  clean_minimal: {
    name: 'Clean Minimal',
    description: 'Light gray with subtle green — clean and modern',
    primaryColor: '#4a4a4a',
    accentColor: '#22c55e',
    headerBg: '#f5f5f5',
    headerText: '#333333',
    altRowBg: '#fafafa',
    textColor: '#333333',
  },
  bold_red: {
    name: 'Bold Red',
    description: 'Deep red with gold accents — high-impact and assertive',
    primaryColor: '#b91c1c',
    accentColor: '#d97706',
    headerBg: '#b91c1c',
    headerText: '#ffffff',
    altRowBg: '#fef2f2',
    textColor: '#1f1f1f',
  },
};

/**
 * Resolve a theme name to a DocumentTheme.
 * Falls back to corporate_blue if unknown.
 */
export function resolveTheme(themeName?: string): DocumentTheme | null {
  if (!themeName) return null;
  const key = themeName.toLowerCase().replace(/[\s-]+/g, '_');
  return THEMES[key] || null;
}

/**
 * List all available theme names (for schema prompts).
 */
export function getThemeNames(): string[] {
  return Object.keys(THEMES);
}
