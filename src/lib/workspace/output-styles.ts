/**
 * OUTPUT STYLES SYSTEM
 *
 * Claude Code-compatible output formatting styles.
 * Controls how messages are displayed to users.
 *
 * Styles:
 * - concise: Brief, focused responses
 * - verbose: Detailed explanations
 * - markdown: Rich formatting with headers
 * - minimal: Bare essentials only
 */

import { logger } from '@/lib/logger';

const log = logger('OutputStyles');

// ============================================================================
// TYPES
// ============================================================================

export type OutputStyle = 'concise' | 'verbose' | 'markdown' | 'minimal';

export interface OutputStyleConfig {
  /** Style identifier */
  name: OutputStyle;
  /** Human-readable description */
  description: string;
  /** Show code block headers */
  showCodeHeaders: boolean;
  /** Show agent type indicators */
  showAgentIndicator: boolean;
  /** Show thinking blocks */
  showThinkingBlocks: boolean;
  /** Show timestamps */
  showTimestamps: boolean;
  /** Show line numbers in code */
  showLineNumbers: boolean;
  /** Max preview length for collapsed content */
  maxPreviewLength: number;
  /** Default expand state for collapsible sections */
  defaultExpanded: boolean;
  /** Show terminal styling for commands */
  showTerminalStyling: boolean;
  /** Show copy buttons */
  showCopyButtons: boolean;
  /** Word wrap in code blocks */
  wordWrap: boolean;
  /** Font size class override */
  fontSizeClass?: 'small' | 'normal' | 'large';
}

export interface FormatOptions {
  /** Current output style */
  style: OutputStyle;
  /** Whether message is streaming */
  isStreaming?: boolean;
  /** Override specific style options */
  overrides?: Partial<OutputStyleConfig>;
}

// ============================================================================
// STYLE CONFIGURATIONS
// ============================================================================

export const OUTPUT_STYLES: Record<OutputStyle, OutputStyleConfig> = {
  concise: {
    name: 'concise',
    description: 'Brief, focused responses without extra decoration',
    showCodeHeaders: true,
    showAgentIndicator: false,
    showThinkingBlocks: false,
    showTimestamps: false,
    showLineNumbers: false,
    maxPreviewLength: 100,
    defaultExpanded: true,
    showTerminalStyling: true,
    showCopyButtons: true,
    wordWrap: true,
    fontSizeClass: 'normal',
  },
  verbose: {
    name: 'verbose',
    description: 'Detailed explanations with full context',
    showCodeHeaders: true,
    showAgentIndicator: true,
    showThinkingBlocks: true,
    showTimestamps: true,
    showLineNumbers: true,
    maxPreviewLength: 500,
    defaultExpanded: true,
    showTerminalStyling: true,
    showCopyButtons: true,
    wordWrap: false,
    fontSizeClass: 'normal',
  },
  markdown: {
    name: 'markdown',
    description: 'Rich formatting with headers and sections',
    showCodeHeaders: true,
    showAgentIndicator: true,
    showThinkingBlocks: true,
    showTimestamps: false,
    showLineNumbers: true,
    maxPreviewLength: 300,
    defaultExpanded: false,
    showTerminalStyling: true,
    showCopyButtons: true,
    wordWrap: true,
    fontSizeClass: 'normal',
  },
  minimal: {
    name: 'minimal',
    description: 'Bare essentials only - no decorations',
    showCodeHeaders: false,
    showAgentIndicator: false,
    showThinkingBlocks: false,
    showTimestamps: false,
    showLineNumbers: false,
    maxPreviewLength: 50,
    defaultExpanded: true,
    showTerminalStyling: false,
    showCopyButtons: false,
    wordWrap: true,
    fontSizeClass: 'small',
  },
};

// ============================================================================
// STYLE MANAGER
// ============================================================================

export class OutputStyleManager {
  private currentStyle: OutputStyle = 'concise';
  private customOverrides: Partial<OutputStyleConfig> = {};

  /**
   * Get the current style configuration
   */
  getStyle(): OutputStyleConfig {
    const base = OUTPUT_STYLES[this.currentStyle];
    return { ...base, ...this.customOverrides };
  }

  /**
   * Get the current style name
   */
  getStyleName(): OutputStyle {
    return this.currentStyle;
  }

  /**
   * Set the output style
   */
  setStyle(style: OutputStyle): void {
    if (!(style in OUTPUT_STYLES)) {
      log.warn('Invalid output style', { style });
      return;
    }
    this.currentStyle = style;
    this.customOverrides = {};
    log.info('Output style changed', { style });
  }

  /**
   * Set custom overrides
   */
  setOverrides(overrides: Partial<OutputStyleConfig>): void {
    this.customOverrides = { ...this.customOverrides, ...overrides };
  }

  /**
   * Reset to default style
   */
  reset(): void {
    this.currentStyle = 'concise';
    this.customOverrides = {};
  }

  /**
   * Get all available styles
   */
  getAllStyles(): OutputStyleConfig[] {
    return Object.values(OUTPUT_STYLES);
  }

  /**
   * Cycle to next style
   */
  cycleStyle(): OutputStyle {
    const styles: OutputStyle[] = ['concise', 'verbose', 'markdown', 'minimal'];
    const currentIndex = styles.indexOf(this.currentStyle);
    const nextIndex = (currentIndex + 1) % styles.length;
    this.setStyle(styles[nextIndex]);
    return this.currentStyle;
  }
}

// ============================================================================
// FORMAT UTILITIES
// ============================================================================

/**
 * Format a message based on the current style
 */
export function formatMessage(content: string, styleConfig: OutputStyleConfig): string {
  if (styleConfig.name === 'minimal') {
    return stripFormatting(content);
  }

  if (styleConfig.name === 'concise') {
    return condenseContent(content);
  }

  return content;
}

/**
 * Strip all formatting from content
 */
function stripFormatting(content: string): string {
  return (
    content
      // Remove headers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold/italic
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
      // Remove code markers but keep content
      .replace(/```\w*\n?/g, '')
      // Remove inline code markers
      .replace(/`([^`]+)`/g, '$1')
      // Remove blockquotes
      .replace(/^>\s+/gm, '')
      // Remove horizontal rules
      .replace(/^[-*_]{3,}$/gm, '')
      // Trim whitespace
      .trim()
  );
}

/**
 * Condense content for concise style
 */
function condenseContent(content: string): string {
  return (
    content
      // Remove multiple blank lines
      .replace(/\n{3,}/g, '\n\n')
      // Trim each line
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .trim()
  );
}

/**
 * Truncate content with ellipsis
 */
export function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }
  return content.substring(0, maxLength - 3) + '...';
}

/**
 * Get CSS class for font size
 */
export function getFontSizeClass(config: OutputStyleConfig): string {
  switch (config.fontSizeClass) {
    case 'small':
      return 'text-xs';
    case 'large':
      return 'text-base';
    default:
      return 'text-sm';
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let styleManagerInstance: OutputStyleManager | null = null;

/**
 * Get the singleton style manager
 */
export function getStyleManager(): OutputStyleManager {
  if (!styleManagerInstance) {
    styleManagerInstance = new OutputStyleManager();
  }
  return styleManagerInstance;
}

/**
 * Reset the style manager instance
 */
export function resetStyleManager(): void {
  styleManagerInstance = null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { OutputStyleManager as StyleManager };
