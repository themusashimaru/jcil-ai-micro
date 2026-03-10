/**
 * OUTPUT STYLES TESTS
 *
 * Tests for the output styles system
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  OutputStyleManager,
  OUTPUT_STYLES,
  formatMessage,
  truncateContent,
  getFontSizeClass,
  getStyleManager,
  resetStyleManager,
} from './output-styles';

describe('OutputStyleManager', () => {
  let manager: OutputStyleManager;

  beforeEach(() => {
    manager = new OutputStyleManager();
  });

  describe('initialization', () => {
    it('should default to concise style', () => {
      expect(manager.getStyleName()).toBe('concise');
    });

    it('should return valid style config', () => {
      const config = manager.getStyle();
      expect(config.name).toBe('concise');
      expect(config.showCodeHeaders).toBe(true);
    });
  });

  describe('setStyle', () => {
    it('should change to verbose style', () => {
      manager.setStyle('verbose');
      expect(manager.getStyleName()).toBe('verbose');
      expect(manager.getStyle().showThinkingBlocks).toBe(true);
    });

    it('should change to markdown style', () => {
      manager.setStyle('markdown');
      expect(manager.getStyleName()).toBe('markdown');
    });

    it('should change to minimal style', () => {
      manager.setStyle('minimal');
      expect(manager.getStyleName()).toBe('minimal');
      expect(manager.getStyle().showCodeHeaders).toBe(false);
    });

    it('should ignore invalid style', () => {
      // @ts-expect-error Testing invalid input
      manager.setStyle('invalid');
      expect(manager.getStyleName()).toBe('concise');
    });
  });

  describe('setOverrides', () => {
    it('should apply custom overrides', () => {
      manager.setOverrides({ showLineNumbers: true });
      expect(manager.getStyle().showLineNumbers).toBe(true);
    });

    it('should merge multiple overrides', () => {
      manager.setOverrides({ showLineNumbers: true });
      manager.setOverrides({ showTimestamps: true });
      const config = manager.getStyle();
      expect(config.showLineNumbers).toBe(true);
      expect(config.showTimestamps).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset to default style', () => {
      manager.setStyle('verbose');
      manager.setOverrides({ showLineNumbers: false });
      manager.reset();
      expect(manager.getStyleName()).toBe('concise');
      expect(manager.getStyle().showLineNumbers).toBe(false); // concise default
    });
  });

  describe('cycleStyle', () => {
    it('should cycle through all styles', () => {
      expect(manager.getStyleName()).toBe('concise');
      manager.cycleStyle();
      expect(manager.getStyleName()).toBe('verbose');
      manager.cycleStyle();
      expect(manager.getStyleName()).toBe('markdown');
      manager.cycleStyle();
      expect(manager.getStyleName()).toBe('minimal');
      manager.cycleStyle();
      expect(manager.getStyleName()).toBe('concise');
    });
  });

  describe('getAllStyles', () => {
    it('should return all style configs', () => {
      const styles = manager.getAllStyles();
      expect(styles).toHaveLength(4);
      expect(styles.map((s) => s.name)).toContain('concise');
      expect(styles.map((s) => s.name)).toContain('verbose');
      expect(styles.map((s) => s.name)).toContain('markdown');
      expect(styles.map((s) => s.name)).toContain('minimal');
    });
  });
});

describe('OUTPUT_STYLES', () => {
  it('should have all required styles', () => {
    expect(OUTPUT_STYLES.concise).toBeDefined();
    expect(OUTPUT_STYLES.verbose).toBeDefined();
    expect(OUTPUT_STYLES.markdown).toBeDefined();
    expect(OUTPUT_STYLES.minimal).toBeDefined();
  });

  it('concise style should be brief', () => {
    const concise = OUTPUT_STYLES.concise;
    expect(concise.showAgentIndicator).toBe(false);
    expect(concise.showThinkingBlocks).toBe(false);
    expect(concise.showTimestamps).toBe(false);
  });

  it('verbose style should show everything', () => {
    const verbose = OUTPUT_STYLES.verbose;
    expect(verbose.showAgentIndicator).toBe(true);
    expect(verbose.showThinkingBlocks).toBe(true);
    expect(verbose.showTimestamps).toBe(true);
    expect(verbose.showLineNumbers).toBe(true);
  });

  it('minimal style should hide decorations', () => {
    const minimal = OUTPUT_STYLES.minimal;
    expect(minimal.showCodeHeaders).toBe(false);
    expect(minimal.showAgentIndicator).toBe(false);
    expect(minimal.showCopyButtons).toBe(false);
    expect(minimal.showTerminalStyling).toBe(false);
  });
});

describe('formatMessage', () => {
  const sampleContent = `# Heading

This is **bold** and *italic* text.

\`\`\`javascript
const x = 1;
\`\`\`

> Blockquote

---

End of message.`;

  it('should strip formatting in minimal mode', () => {
    const result = formatMessage(sampleContent, OUTPUT_STYLES.minimal);
    expect(result).not.toContain('# Heading');
    expect(result).not.toContain('**');
    expect(result).not.toContain('```');
    expect(result).toContain('Heading');
    expect(result).toContain('bold');
  });

  it('should condense content in concise mode', () => {
    const contentWithBlankLines = 'Line 1\n\n\n\nLine 2\n\n\nLine 3';
    const result = formatMessage(contentWithBlankLines, OUTPUT_STYLES.concise);
    expect(result).not.toContain('\n\n\n');
    expect(result).toContain('Line 1');
    expect(result).toContain('Line 2');
    expect(result).toContain('Line 3');
  });

  it('should preserve content in verbose mode', () => {
    const result = formatMessage(sampleContent, OUTPUT_STYLES.verbose);
    expect(result).toBe(sampleContent);
  });
});

describe('truncateContent', () => {
  it('should not truncate short content', () => {
    const result = truncateContent('Hello', 10);
    expect(result).toBe('Hello');
  });

  it('should truncate long content', () => {
    const result = truncateContent('Hello World', 8);
    expect(result).toBe('Hello...');
    expect(result.length).toBe(8);
  });

  it('should handle exact length', () => {
    const result = truncateContent('Hello', 5);
    expect(result).toBe('Hello');
  });
});

describe('getFontSizeClass', () => {
  it('should return small class for minimal', () => {
    expect(getFontSizeClass(OUTPUT_STYLES.minimal)).toBe('text-xs');
  });

  it('should return normal class for concise', () => {
    expect(getFontSizeClass(OUTPUT_STYLES.concise)).toBe('text-sm');
  });

  it('should return normal class for verbose', () => {
    expect(getFontSizeClass(OUTPUT_STYLES.verbose)).toBe('text-sm');
  });
});

describe('singleton', () => {
  beforeEach(() => {
    resetStyleManager();
  });

  it('should return same instance', () => {
    const manager1 = getStyleManager();
    const manager2 = getStyleManager();
    expect(manager1).toBe(manager2);
  });

  it('should reset instance', () => {
    const manager1 = getStyleManager();
    manager1.setStyle('verbose');
    resetStyleManager();
    const manager2 = getStyleManager();
    expect(manager2.getStyleName()).toBe('concise');
  });
});
