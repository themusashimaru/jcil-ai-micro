import { describe, it, expect } from 'vitest';
import {
  textColors,
  textColorsDark,
  borderColors,
  backgroundColors,
  semanticColors,
  interactiveColors,
  spacing,
  radii,
  shadows,
  zIndices,
  typography,
  tokens,
} from './design-tokens';

// -------------------------------------------------------------------
// textColors (light mode)
// -------------------------------------------------------------------
describe('textColors', () => {
  it('should have all required light mode keys', () => {
    expect(textColors.primary).toBe('#1a1f36');
    expect(textColors.secondary).toBe('#374151');
    expect(textColors.muted).toBe('#4b5563');
    expect(textColors.placeholder).toBe('#6b7280');
    expect(textColors.disabled).toBe('#6b7280');
  });

  it('should have valid hex color format', () => {
    Object.values(textColors).forEach((color) => {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });
});

// -------------------------------------------------------------------
// textColorsDark
// -------------------------------------------------------------------
describe('textColorsDark', () => {
  it('should have all dark mode keys', () => {
    expect(textColorsDark.primary).toBe('#f9fafb');
    expect(textColorsDark.secondary).toBe('#e5e7eb');
    expect(textColorsDark.muted).toBe('#9ca3af');
  });

  it('should have valid hex color format', () => {
    Object.values(textColorsDark).forEach((color) => {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });
});

// -------------------------------------------------------------------
// borderColors
// -------------------------------------------------------------------
describe('borderColors', () => {
  it('should have all border color keys', () => {
    expect(borderColors.light).toBeDefined();
    expect(borderColors.default).toBeDefined();
    expect(borderColors.focus).toBeDefined();
    expect(borderColors.error).toBeDefined();
  });
});

// -------------------------------------------------------------------
// backgroundColors
// -------------------------------------------------------------------
describe('backgroundColors', () => {
  it('should have white as #ffffff', () => {
    expect(backgroundColors.white).toBe('#ffffff');
  });

  it('should have dark backgrounds', () => {
    expect(backgroundColors.dark).toBe('#1f2937');
    expect(backgroundColors.darker).toBe('#111827');
  });

  it('should have all light background variants', () => {
    expect(backgroundColors.subtle).toBeDefined();
    expect(backgroundColors.muted).toBeDefined();
    expect(backgroundColors.hover).toBeDefined();
    expect(backgroundColors.active).toBeDefined();
  });
});

// -------------------------------------------------------------------
// semanticColors
// -------------------------------------------------------------------
describe('semanticColors', () => {
  it('should have success, error, warning, info colors', () => {
    expect(semanticColors.success).toBeDefined();
    expect(semanticColors.error).toBeDefined();
    expect(semanticColors.warning).toBeDefined();
    expect(semanticColors.info).toBeDefined();
  });

  it('should have light variants', () => {
    expect(semanticColors.successLight).toBeDefined();
    expect(semanticColors.errorLight).toBeDefined();
    expect(semanticColors.warningLight).toBeDefined();
    expect(semanticColors.infoLight).toBeDefined();
  });
});

// -------------------------------------------------------------------
// interactiveColors
// -------------------------------------------------------------------
describe('interactiveColors', () => {
  it('should have primary and link colors', () => {
    expect(interactiveColors.primary).toBe('#4f46e5');
    expect(interactiveColors.link).toBe('#2563eb');
  });

  it('should have hover and active states', () => {
    expect(interactiveColors.primaryHover).toBeDefined();
    expect(interactiveColors.primaryActive).toBeDefined();
    expect(interactiveColors.linkHover).toBeDefined();
  });
});

// -------------------------------------------------------------------
// spacing
// -------------------------------------------------------------------
describe('spacing', () => {
  it('should have xs through 2xl', () => {
    expect(spacing.xs).toBe('0.25rem');
    expect(spacing.sm).toBe('0.5rem');
    expect(spacing.md).toBe('1rem');
    expect(spacing.lg).toBe('1.5rem');
    expect(spacing.xl).toBe('2rem');
    expect(spacing['2xl']).toBe('3rem');
  });
});

// -------------------------------------------------------------------
// radii
// -------------------------------------------------------------------
describe('radii', () => {
  it('should have all radius values', () => {
    expect(radii.sm).toBe('4px');
    expect(radii.md).toBe('8px');
    expect(radii.lg).toBe('12px');
    expect(radii.full).toBe('9999px');
  });
});

// -------------------------------------------------------------------
// shadows
// -------------------------------------------------------------------
describe('shadows', () => {
  it('should have all shadow levels', () => {
    expect(shadows.sm).toContain('rgba');
    expect(shadows.md).toContain('rgba');
    expect(shadows.lg).toContain('rgba');
    expect(shadows.xl).toContain('rgba');
  });
});

// -------------------------------------------------------------------
// zIndices
// -------------------------------------------------------------------
describe('zIndices', () => {
  it('should have correct hierarchy', () => {
    expect(zIndices.base).toBe(0);
    expect(zIndices.dropdown).toBeLessThan(zIndices.sidebar);
    expect(zIndices.sidebar).toBeLessThan(zIndices.modal);
    expect(zIndices.modal).toBeLessThan(zIndices.commandPalette);
    expect(zIndices.commandPalette).toBeLessThan(zIndices.popover);
    expect(zIndices.popover).toBeLessThan(zIndices.toast);
  });
});

// -------------------------------------------------------------------
// typography
// -------------------------------------------------------------------
describe('typography', () => {
  it('should have font sizes', () => {
    expect(typography.fontSizes.base).toBe('1rem');
    expect(typography.fontSizes.sm).toBe('0.875rem');
  });

  it('should have font weights', () => {
    expect(typography.fontWeights.normal).toBe(400);
    expect(typography.fontWeights.bold).toBe(700);
  });

  it('should have line heights', () => {
    expect(typography.lineHeights.normal).toBe(1.5);
  });
});

// -------------------------------------------------------------------
// tokens (combined export)
// -------------------------------------------------------------------
describe('tokens', () => {
  it('should combine all token groups', () => {
    expect(tokens.text).toBe(textColors);
    expect(tokens.textDark).toBe(textColorsDark);
    expect(tokens.border).toBe(borderColors);
    expect(tokens.background).toBe(backgroundColors);
    expect(tokens.semantic).toBe(semanticColors);
    expect(tokens.interactive).toBe(interactiveColors);
    expect(tokens.spacing).toBe(spacing);
    expect(tokens.radii).toBe(radii);
    expect(tokens.shadows).toBe(shadows);
    expect(tokens.zIndices).toBe(zIndices);
    expect(tokens.typography).toBe(typography);
  });
});
