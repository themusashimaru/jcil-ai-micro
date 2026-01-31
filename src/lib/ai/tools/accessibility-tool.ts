/**
 * ACCESSIBILITY TOOL
 *
 * WCAG accessibility checking using axe-core.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Check HTML for WCAG violations
 * - Analyze color contrast
 * - Validate ARIA attributes
 * - Check heading hierarchy
 * - Identify missing alt text
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Note: axe-core typically runs in a browser environment
// For server-side, we'll provide static analysis

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const accessibilityTool: UnifiedTool = {
  name: 'check_accessibility',
  description: `Check HTML content for accessibility (WCAG) issues.

Operations:
- check: Analyze HTML for accessibility violations
- contrast: Check color contrast ratios
- aria: Validate ARIA attributes
- structure: Check document structure (headings, landmarks)

WCAG Guidelines checked:
- Missing alt text on images
- Poor color contrast
- Invalid ARIA attributes
- Heading hierarchy issues
- Missing form labels
- Keyboard accessibility issues

Severity levels:
- critical: Must fix (WCAG A)
- serious: Should fix (WCAG AA)
- moderate: Consider fixing (WCAG AAA)
- minor: Nice to have

Use cases:
- Website accessibility audits
- Development testing
- Compliance checking
- Accessibility improvements`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['check', 'contrast', 'aria', 'structure'],
        description: 'Accessibility check operation',
      },
      html: {
        type: 'string',
        description: 'HTML content to check',
      },
      foreground: {
        type: 'string',
        description: 'Foreground color for contrast check (hex, e.g., "#333333")',
      },
      background: {
        type: 'string',
        description: 'Background color for contrast check (hex, e.g., "#ffffff")',
      },
      wcag_level: {
        type: 'string',
        enum: ['A', 'AA', 'AAA'],
        description: 'WCAG conformance level to check (default: AA)',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isAccessibilityAvailable(): boolean {
  return true;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(fg: string, bg: string): number | null {
  const fgRgb = hexToRgb(fg);
  const bgRgb = hexToRgb(bg);

  if (!fgRgb || !bgRgb) return null;

  const l1 = getLuminance(fgRgb.r, fgRgb.g, fgRgb.b);
  const l2 = getLuminance(bgRgb.r, bgRgb.g, bgRgb.b);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

interface A11yIssue {
  type: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  message: string;
  element?: string;
  suggestion?: string;
  wcagCriteria?: string;
}

function checkHtmlAccessibility(html: string): A11yIssue[] {
  const issues: A11yIssue[] = [];

  // Check for images without alt text
  const imgRegex = /<img[^>]*>/gi;
  const imgMatches = html.match(imgRegex) || [];
  for (const img of imgMatches) {
    if (!img.includes('alt=')) {
      issues.push({
        type: 'missing-alt',
        severity: 'critical',
        message: 'Image missing alt attribute',
        element: img.substring(0, 100),
        suggestion:
          'Add alt="" for decorative images or descriptive alt text for meaningful images',
        wcagCriteria: '1.1.1 Non-text Content (Level A)',
      });
    } else if (img.match(/alt=["']\s*["']/)) {
      // Empty alt is OK for decorative, but flag for review
      issues.push({
        type: 'empty-alt',
        severity: 'minor',
        message: 'Image has empty alt attribute - verify it is decorative',
        element: img.substring(0, 100),
        suggestion: 'Empty alt is correct for decorative images only',
        wcagCriteria: '1.1.1 Non-text Content (Level A)',
      });
    }
  }

  // Check for form inputs without labels
  const inputRegex = /<input[^>]*>/gi;
  const inputMatches = html.match(inputRegex) || [];
  for (const input of inputMatches) {
    if (
      !input.includes('type="submit"') &&
      !input.includes('type="button"') &&
      !input.includes('type="hidden"') &&
      !input.includes('aria-label') &&
      !input.includes('aria-labelledby')
    ) {
      // Check if there's an associated label (simplified check)
      const idMatch = input.match(/id=["']([^"']+)["']/);
      if (!idMatch || !html.includes(`for="${idMatch[1]}"`)) {
        issues.push({
          type: 'missing-label',
          severity: 'serious',
          message: 'Form input may be missing an associated label',
          element: input.substring(0, 100),
          suggestion: 'Add a <label> element with for attribute, or use aria-label',
          wcagCriteria: '1.3.1 Info and Relationships (Level A)',
        });
      }
    }
  }

  // Check heading hierarchy
  const headingRegex = /<h([1-6])[^>]*>/gi;
  const headings: number[] = [];
  let match;
  while ((match = headingRegex.exec(html)) !== null) {
    headings.push(parseInt(match[1]));
  }

  for (let i = 1; i < headings.length; i++) {
    if (headings[i] > headings[i - 1] + 1) {
      issues.push({
        type: 'heading-skip',
        severity: 'moderate',
        message: `Heading level skipped from h${headings[i - 1]} to h${headings[i]}`,
        suggestion: 'Use sequential heading levels without skipping',
        wcagCriteria: '1.3.1 Info and Relationships (Level A)',
      });
    }
  }

  if (headings.length > 0 && headings[0] !== 1) {
    issues.push({
      type: 'missing-h1',
      severity: 'moderate',
      message: 'Document does not start with h1',
      suggestion: 'Start document with an h1 heading',
      wcagCriteria: '1.3.1 Info and Relationships (Level A)',
    });
  }

  // Check for links with generic text
  const linkRegex = /<a[^>]*>([^<]*)<\/a>/gi;
  while ((match = linkRegex.exec(html)) !== null) {
    const linkText = match[1].toLowerCase().trim();
    if (['click here', 'here', 'read more', 'more', 'link'].includes(linkText)) {
      issues.push({
        type: 'generic-link-text',
        severity: 'moderate',
        message: `Link has generic text: "${match[1]}"`,
        element: match[0].substring(0, 100),
        suggestion: 'Use descriptive link text that makes sense out of context',
        wcagCriteria: '2.4.4 Link Purpose (In Context) (Level A)',
      });
    }
  }

  // Check for autoplay media
  if (html.includes('autoplay')) {
    issues.push({
      type: 'autoplay-media',
      severity: 'serious',
      message: 'Media element has autoplay attribute',
      suggestion: 'Avoid autoplaying media or provide controls to pause',
      wcagCriteria: '1.4.2 Audio Control (Level A)',
    });
  }

  // Check for missing lang attribute on html
  if (html.includes('<html') && !/<html[^>]*lang=/i.test(html)) {
    issues.push({
      type: 'missing-lang',
      severity: 'serious',
      message: 'HTML element missing lang attribute',
      suggestion: 'Add lang attribute to <html> element (e.g., lang="en")',
      wcagCriteria: '3.1.1 Language of Page (Level A)',
    });
  }

  // Check for potentially inaccessible event handlers
  if (html.includes('onmouseover') || html.includes('ondblclick')) {
    issues.push({
      type: 'mouse-only-event',
      severity: 'moderate',
      message: 'Mouse-only event handler detected',
      suggestion: 'Ensure equivalent keyboard interaction is available',
      wcagCriteria: '2.1.1 Keyboard (Level A)',
    });
  }

  // Check for tabindex > 0
  const tabindexMatch = html.match(/tabindex=["'](\d+)["']/g);
  if (tabindexMatch) {
    for (const ti of tabindexMatch) {
      const value = parseInt(ti.match(/\d+/)?.[0] || '0');
      if (value > 0) {
        issues.push({
          type: 'positive-tabindex',
          severity: 'moderate',
          message: `Positive tabindex value (${value}) can cause unexpected tab order`,
          suggestion: 'Use tabindex="0" or rely on natural DOM order',
          wcagCriteria: '2.4.3 Focus Order (Level A)',
        });
      }
    }
  }

  return issues;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeAccessibility(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args =
    typeof toolCall.arguments === 'string' ? JSON.parse(toolCall.arguments) : toolCall.arguments;

  const { operation, html, foreground, background, wcag_level = 'AA' } = args;

  try {
    let result: Record<string, unknown>;

    switch (operation) {
      case 'check': {
        if (!html) {
          throw new Error('HTML content required for accessibility check');
        }

        const issues = checkHtmlAccessibility(html);

        // Categorize by severity
        const bySeverity = {
          critical: issues.filter((i) => i.severity === 'critical'),
          serious: issues.filter((i) => i.severity === 'serious'),
          moderate: issues.filter((i) => i.severity === 'moderate'),
          minor: issues.filter((i) => i.severity === 'minor'),
        };

        const passedChecks = [
          !issues.some((i) => i.type === 'missing-alt') ? 'All images have alt attributes' : null,
          !issues.some((i) => i.type === 'missing-label') ? 'All form inputs have labels' : null,
          !issues.some((i) => i.type === 'heading-skip') ? 'Heading hierarchy is correct' : null,
          !issues.some((i) => i.type === 'missing-lang') ? 'Language is specified' : null,
        ].filter(Boolean);

        result = {
          operation: 'check',
          wcagLevel: wcag_level,
          summary: {
            totalIssues: issues.length,
            critical: bySeverity.critical.length,
            serious: bySeverity.serious.length,
            moderate: bySeverity.moderate.length,
            minor: bySeverity.minor.length,
          },
          passedChecks,
          issues: issues.slice(0, 20), // First 20 issues
          recommendation:
            issues.length === 0
              ? 'No accessibility issues detected in static analysis'
              : bySeverity.critical.length > 0
                ? 'Critical issues found - these must be fixed for basic accessibility'
                : 'Review and address the issues found',
        };
        break;
      }

      case 'contrast': {
        if (!foreground || !background) {
          throw new Error('Foreground and background colors required for contrast check');
        }

        const ratio = getContrastRatio(foreground, background);

        if (ratio === null) {
          throw new Error('Invalid color format. Use hex colors (e.g., #333333)');
        }

        const wcagAA = {
          normalText: ratio >= 4.5,
          largeText: ratio >= 3,
        };

        const wcagAAA = {
          normalText: ratio >= 7,
          largeText: ratio >= 4.5,
        };

        result = {
          operation: 'contrast',
          foreground,
          background,
          contrastRatio: ratio.toFixed(2) + ':1',
          wcagAA: {
            normalText: wcagAA.normalText ? 'PASS' : 'FAIL',
            largeText: wcagAA.largeText ? 'PASS' : 'FAIL',
            requirement: 'Normal text: 4.5:1, Large text: 3:1',
          },
          wcagAAA: {
            normalText: wcagAAA.normalText ? 'PASS' : 'FAIL',
            largeText: wcagAAA.largeText ? 'PASS' : 'FAIL',
            requirement: 'Normal text: 7:1, Large text: 4.5:1',
          },
          recommendation:
            ratio >= 4.5
              ? 'Good contrast ratio for most text'
              : ratio >= 3
                ? 'Only suitable for large text (18pt+ or 14pt bold)'
                : 'Insufficient contrast - increase difference between colors',
        };
        break;
      }

      case 'aria': {
        if (!html) {
          throw new Error('HTML content required for ARIA check');
        }

        const ariaIssues: A11yIssue[] = [];

        // Check for ARIA attributes
        const ariaRoleRegex = /role=["']([^"']+)["']/gi;
        const ariaRoles = new Set<string>();
        let roleMatch;
        while ((roleMatch = ariaRoleRegex.exec(html)) !== null) {
          ariaRoles.add(roleMatch[1]);
        }

        // Valid ARIA roles
        const validRoles = new Set([
          'alert',
          'alertdialog',
          'application',
          'article',
          'banner',
          'button',
          'cell',
          'checkbox',
          'columnheader',
          'combobox',
          'complementary',
          'contentinfo',
          'definition',
          'dialog',
          'directory',
          'document',
          'feed',
          'figure',
          'form',
          'grid',
          'gridcell',
          'group',
          'heading',
          'img',
          'link',
          'list',
          'listbox',
          'listitem',
          'log',
          'main',
          'marquee',
          'math',
          'menu',
          'menubar',
          'menuitem',
          'menuitemcheckbox',
          'menuitemradio',
          'navigation',
          'none',
          'note',
          'option',
          'presentation',
          'progressbar',
          'radio',
          'radiogroup',
          'region',
          'row',
          'rowgroup',
          'rowheader',
          'scrollbar',
          'search',
          'searchbox',
          'separator',
          'slider',
          'spinbutton',
          'status',
          'switch',
          'tab',
          'table',
          'tablist',
          'tabpanel',
          'term',
          'textbox',
          'timer',
          'toolbar',
          'tooltip',
          'tree',
          'treegrid',
          'treeitem',
        ]);

        for (const role of ariaRoles) {
          if (!validRoles.has(role.toLowerCase())) {
            ariaIssues.push({
              type: 'invalid-role',
              severity: 'serious',
              message: `Invalid ARIA role: "${role}"`,
              suggestion: 'Use a valid ARIA role from the WAI-ARIA specification',
            });
          }
        }

        // Check for aria-hidden on focusable elements
        if (
          /aria-hidden=["']true["'][^>]*(tabindex|href|button|input|select|textarea)/i.test(html)
        ) {
          ariaIssues.push({
            type: 'hidden-focusable',
            severity: 'critical',
            message: 'aria-hidden="true" on focusable element',
            suggestion: 'Remove aria-hidden or make element non-focusable',
          });
        }

        result = {
          operation: 'aria',
          rolesFound: [...ariaRoles],
          issueCount: ariaIssues.length,
          issues: ariaIssues,
          ariaAttributesFound: (html.match(/aria-[a-z]+/gi) || []).length,
          recommendation:
            ariaIssues.length === 0
              ? 'No ARIA issues detected'
              : 'Review and fix ARIA implementation',
        };
        break;
      }

      case 'structure': {
        if (!html) {
          throw new Error('HTML content required for structure check');
        }

        // Extract headings
        const headingRegex = /<h([1-6])[^>]*>([^<]*)<\/h\1>/gi;
        const headings: Array<{ level: number; text: string }> = [];
        let match;
        while ((match = headingRegex.exec(html)) !== null) {
          headings.push({
            level: parseInt(match[1]),
            text: match[2].trim().substring(0, 50),
          });
        }

        // Check for landmarks
        const landmarks = {
          header: /<header|role=["']banner["']/i.test(html),
          nav: /<nav|role=["']navigation["']/i.test(html),
          main: /<main|role=["']main["']/i.test(html),
          footer: /<footer|role=["']contentinfo["']/i.test(html),
          aside: /<aside|role=["']complementary["']/i.test(html),
        };

        const structureIssues: string[] = [];

        if (!landmarks.main) {
          structureIssues.push('Missing main landmark');
        }
        if (!landmarks.nav) {
          structureIssues.push('Missing navigation landmark');
        }
        if (headings.length === 0) {
          structureIssues.push('No headings found');
        } else if (headings[0]?.level !== 1) {
          structureIssues.push('Document should start with h1');
        }

        result = {
          operation: 'structure',
          headings,
          headingCount: headings.length,
          landmarks,
          landmarkCount: Object.values(landmarks).filter(Boolean).length,
          issues: structureIssues,
          recommendation:
            structureIssues.length === 0
              ? 'Document structure looks good'
              : `Fix structure issues: ${structureIssues.join(', ')}`,
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify(result, null, 2),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: `Accessibility check error: ${(error as Error).message}`,
      isError: true,
    };
  }
}
