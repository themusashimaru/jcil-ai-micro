/**
 * COLOR THEORY TOOL
 *
 * Comprehensive color manipulation, conversion, and palette generation.
 * Supports multiple color spaces and harmony calculations.
 *
 * Part of TIER VISUAL MADNESS - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// COLOR TYPES
// ============================================================================

interface RGB {
  r: number; // 0-255
  g: number;
  b: number;
}

interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

interface HSV {
  h: number; // 0-360
  s: number; // 0-100
  v: number; // 0-100
}

interface CMYK {
  c: number; // 0-100
  m: number;
  y: number;
  k: number;
}

interface Lab {
  l: number; // 0-100
  a: number; // -128 to 127
  b: number; // -128 to 127
}

interface ColorInfo {
  hex: string;
  rgb: RGB;
  hsl: HSL;
  hsv: HSV;
  cmyk: CMYK;
  lab: Lab;
  luminance: number;
  name?: string;
}

// ============================================================================
// COLOR CONVERSION
// ============================================================================

function hexToRGB(hex: string): RGB {
  const clean = hex.replace('#', '');
  const expanded = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  const num = parseInt(expanded, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHex(rgb: RGB): string {
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
}

function rgbToHSL(rgb: RGB): HSL {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: l * 100 };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    default:
      h = ((r - g) / d + 4) / 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRGB(hsl: HSL): RGB {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

  if (s === 0) {
    const gray = Math.round(l * 255);
    return { r: gray, g: gray, b: gray };
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

function rgbToHSV(rgb: RGB): HSV {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h: number;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d === 0) {
    h = 0;
  } else {
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
    }
  }

  return { h: h * 360, s: s * 100, v: v * 100 };
}

export function hsvToRGB(hsv: HSV): RGB {
  const h = hsv.h / 360;
  const s = hsv.s / 100;
  const v = hsv.v / 100;

  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);

  let r: number, g: number, b: number;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

function rgbToCMYK(rgb: RGB): CMYK {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const k = 1 - Math.max(r, g, b);

  if (k === 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }

  return {
    c: ((1 - r - k) / (1 - k)) * 100,
    m: ((1 - g - k) / (1 - k)) * 100,
    y: ((1 - b - k) / (1 - k)) * 100,
    k: k * 100,
  };
}

export function cmykToRGB(cmyk: CMYK): RGB {
  const c = cmyk.c / 100;
  const m = cmyk.m / 100;
  const y = cmyk.y / 100;
  const k = cmyk.k / 100;

  return {
    r: Math.round(255 * (1 - c) * (1 - k)),
    g: Math.round(255 * (1 - m) * (1 - k)),
    b: Math.round(255 * (1 - y) * (1 - k)),
  };
}

// RGB to Lab (via XYZ)
function rgbToLab(rgb: RGB): Lab {
  // RGB to XYZ
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  let x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  let y = (r * 0.2126729 + g * 0.7151522 + b * 0.0721750) / 1.0;
  let z = (r * 0.0193339 + g * 0.1191920 + b * 0.9503041) / 1.08883;

  x = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116;
  y = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116;
  z = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116;

  return {
    l: 116 * y - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  };
}

// ============================================================================
// LUMINANCE & CONTRAST
// ============================================================================

function relativeLuminance(rgb: RGB): number {
  const sRGB = [rgb.r, rgb.g, rgb.b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}

function contrastRatio(rgb1: RGB, rgb2: RGB): number {
  const l1 = relativeLuminance(rgb1);
  const l2 = relativeLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function wcagLevel(ratio: number): { aa: boolean; aaa: boolean; aaLarge: boolean; aaaLarge: boolean } {
  return {
    aa: ratio >= 4.5,
    aaa: ratio >= 7,
    aaLarge: ratio >= 3,
    aaaLarge: ratio >= 4.5,
  };
}

// ============================================================================
// COLOR HARMONIES
// ============================================================================

function complementary(hsl: HSL): HSL[] {
  return [
    hsl,
    { ...hsl, h: (hsl.h + 180) % 360 },
  ];
}

function analogous(hsl: HSL, angle: number = 30): HSL[] {
  return [
    { ...hsl, h: (hsl.h - angle + 360) % 360 },
    hsl,
    { ...hsl, h: (hsl.h + angle) % 360 },
  ];
}

function triadic(hsl: HSL): HSL[] {
  return [
    hsl,
    { ...hsl, h: (hsl.h + 120) % 360 },
    { ...hsl, h: (hsl.h + 240) % 360 },
  ];
}

function tetradic(hsl: HSL): HSL[] {
  return [
    hsl,
    { ...hsl, h: (hsl.h + 90) % 360 },
    { ...hsl, h: (hsl.h + 180) % 360 },
    { ...hsl, h: (hsl.h + 270) % 360 },
  ];
}

function splitComplementary(hsl: HSL): HSL[] {
  return [
    hsl,
    { ...hsl, h: (hsl.h + 150) % 360 },
    { ...hsl, h: (hsl.h + 210) % 360 },
  ];
}

function monochromatic(hsl: HSL, count: number = 5): HSL[] {
  const result: HSL[] = [];
  for (let i = 0; i < count; i++) {
    const l = 20 + (i / (count - 1)) * 60;
    result.push({ ...hsl, l });
  }
  return result;
}

// ============================================================================
// COLOR BLENDING
// ============================================================================

function blendColors(rgb1: RGB, rgb2: RGB, ratio: number): RGB {
  return {
    r: Math.round(rgb1.r * (1 - ratio) + rgb2.r * ratio),
    g: Math.round(rgb1.g * (1 - ratio) + rgb2.g * ratio),
    b: Math.round(rgb1.b * (1 - ratio) + rgb2.b * ratio),
  };
}

function generateGradient(color1: string, color2: string, steps: number): string[] {
  const rgb1 = hexToRGB(color1);
  const rgb2 = hexToRGB(color2);
  const result: string[] = [];

  for (let i = 0; i < steps; i++) {
    const ratio = i / (steps - 1);
    result.push(rgbToHex(blendColors(rgb1, rgb2, ratio)));
  }

  return result;
}

// ============================================================================
// COLOR ANALYSIS
// ============================================================================

function analyzeColor(hex: string): ColorInfo {
  const rgb = hexToRGB(hex);
  const hsl = rgbToHSL(rgb);
  const hsv = rgbToHSV(rgb);
  const cmyk = rgbToCMYK(rgb);
  const lab = rgbToLab(rgb);
  const luminance = relativeLuminance(rgb);

  return {
    hex: rgbToHex(rgb),
    rgb,
    hsl: {
      h: Math.round(hsl.h),
      s: Math.round(hsl.s),
      l: Math.round(hsl.l),
    },
    hsv: {
      h: Math.round(hsv.h),
      s: Math.round(hsv.s),
      v: Math.round(hsv.v),
    },
    cmyk: {
      c: Math.round(cmyk.c),
      m: Math.round(cmyk.m),
      y: Math.round(cmyk.y),
      k: Math.round(cmyk.k),
    },
    lab: {
      l: Math.round(lab.l),
      a: Math.round(lab.a),
      b: Math.round(lab.b),
    },
    luminance: Math.round(luminance * 1000) / 1000,
  };
}

function categorizeColor(hsl: HSL): string {
  if (hsl.s < 10) {
    if (hsl.l < 20) return 'black';
    if (hsl.l > 80) return 'white';
    return 'gray';
  }

  const h = hsl.h;
  if (h < 15 || h >= 345) return 'red';
  if (h < 45) return 'orange';
  if (h < 75) return 'yellow';
  if (h < 150) return 'green';
  if (h < 210) return 'cyan';
  if (h < 270) return 'blue';
  if (h < 315) return 'purple';
  return 'pink';
}

// ============================================================================
// COLOR PALETTES
// ============================================================================

const NAMED_PALETTES: Record<string, string[]> = {
  material_primary: ['#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800', '#FF5722'],
  pastel: ['#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF'],
  rainbow: ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'],
  sunset: ['#FF6B6B', '#FEC89A', '#FFD93D', '#6BCB77', '#4D96FF'],
  ocean: ['#0077B6', '#00B4D8', '#90E0EF', '#CAF0F8', '#03045E'],
  forest: ['#2D6A4F', '#40916C', '#52B788', '#74C69D', '#95D5B2'],
  vintage: ['#8D7B68', '#A4907C', '#C8B6A6', '#F1DEC9', '#545B77'],
  neon: ['#FF00FF', '#00FFFF', '#00FF00', '#FFFF00', '#FF0000'],
  earth: ['#774936', '#A5673F', '#D4A373', '#FAEDCD', '#FEFAE0'],
  corporate: ['#1A365D', '#2B6CB0', '#4299E1', '#63B3ED', '#90CDF4'],
};

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const colorTheoryTool: UnifiedTool = {
  name: 'color_theory',
  description: `Comprehensive color manipulation, conversion, and palette generation.

Operations:
- analyze: Full color analysis (all color spaces + luminance)
- convert: Convert between color spaces (hex, rgb, hsl, hsv, cmyk, lab)
- harmony: Generate color harmonies (complementary, analogous, triadic, tetradic, split, monochromatic)
- contrast: Calculate contrast ratio and WCAG compliance
- blend: Blend two colors with ratio
- gradient: Generate color gradient with steps
- palette: Get named color palette
- list_palettes: List available palettes
- categorize: Get color category (red, blue, warm, cool, etc.)

Color spaces supported:
- HEX: #RRGGBB or #RGB
- RGB: 0-255 for each channel
- HSL: Hue 0-360°, Saturation 0-100%, Lightness 0-100%
- HSV: Hue 0-360°, Saturation 0-100%, Value 0-100%
- CMYK: 0-100% for each channel
- Lab: L 0-100, a/b -128 to 127`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['analyze', 'convert', 'harmony', 'contrast', 'blend', 'gradient', 'palette', 'list_palettes', 'categorize'],
        description: 'Type of color operation',
      },
      color: { type: 'string', description: 'Primary color (hex format #RRGGBB)' },
      color2: { type: 'string', description: 'Secondary color for contrast/blend' },
      // Conversion parameters
      from_space: { type: 'string', description: 'Source color space' },
      to_space: { type: 'string', description: 'Target color space' },
      // Harmony parameters
      harmony_type: {
        type: 'string',
        enum: ['complementary', 'analogous', 'triadic', 'tetradic', 'split', 'monochromatic'],
        description: 'Type of color harmony',
      },
      angle: { type: 'number', description: 'Angle for analogous harmony (default 30)' },
      count: { type: 'number', description: 'Number of colors for monochromatic' },
      // Blend/gradient parameters
      ratio: { type: 'number', description: 'Blend ratio 0-1' },
      steps: { type: 'number', description: 'Number of gradient steps' },
      // Palette parameters
      palette_name: { type: 'string', description: 'Name of palette to retrieve' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeColorTheory(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, color = '#4F46E5' } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'analyze': {
        const info = analyzeColor(color);
        const hsl = rgbToHSL(hexToRGB(color));
        const category = categorizeColor(hsl);

        result = {
          operation: 'analyze',
          input: color,
          ...info,
          category,
          is_light: info.luminance > 0.5,
          suggested_text_color: info.luminance > 0.5 ? '#000000' : '#FFFFFF',
        };
        break;
      }

      case 'convert': {
        const rgb = hexToRGB(color);
        const info = analyzeColor(color);
        result = {
          operation: 'convert',
          input: color,
          all_formats: {
            hex: info.hex,
            rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
            hsl: `hsl(${info.hsl.h}, ${info.hsl.s}%, ${info.hsl.l}%)`,
            hsv: `hsv(${info.hsv.h}, ${info.hsv.s}%, ${info.hsv.v}%)`,
            cmyk: `cmyk(${info.cmyk.c}%, ${info.cmyk.m}%, ${info.cmyk.y}%, ${info.cmyk.k}%)`,
            lab: `lab(${info.lab.l}, ${info.lab.a}, ${info.lab.b})`,
          },
          values: {
            hex: info.hex,
            rgb: info.rgb,
            hsl: info.hsl,
            hsv: info.hsv,
            cmyk: info.cmyk,
            lab: info.lab,
          },
        };
        break;
      }

      case 'harmony': {
        const { harmony_type = 'complementary', angle = 30, count = 5 } = args;
        const hsl = rgbToHSL(hexToRGB(color));
        let colors: HSL[];

        switch (harmony_type) {
          case 'complementary': colors = complementary(hsl); break;
          case 'analogous': colors = analogous(hsl, angle); break;
          case 'triadic': colors = triadic(hsl); break;
          case 'tetradic': colors = tetradic(hsl); break;
          case 'split': colors = splitComplementary(hsl); break;
          case 'monochromatic': colors = monochromatic(hsl, count); break;
          default: colors = complementary(hsl);
        }

        const palette = colors.map(c => rgbToHex(hslToRGB(c)));

        result = {
          operation: 'harmony',
          input: color,
          harmony_type,
          palette,
          hsl_values: colors.map(c => ({ h: Math.round(c.h), s: Math.round(c.s), l: Math.round(c.l) })),
          description: `${harmony_type} harmony based on ${color}`,
        };
        break;
      }

      case 'contrast': {
        const { color2 = '#FFFFFF' } = args;
        const rgb1 = hexToRGB(color);
        const rgb2 = hexToRGB(color2);
        const ratio = contrastRatio(rgb1, rgb2);
        const wcag = wcagLevel(ratio);

        result = {
          operation: 'contrast',
          color1: color,
          color2,
          contrast_ratio: Math.round(ratio * 100) / 100,
          wcag_compliance: {
            'AA_normal_text': wcag.aa,
            'AA_large_text': wcag.aaLarge,
            'AAA_normal_text': wcag.aaa,
            'AAA_large_text': wcag.aaaLarge,
          },
          recommendation: ratio < 3 ? 'Poor - not accessible' :
            ratio < 4.5 ? 'Acceptable for large text only' :
              ratio < 7 ? 'Good - passes AA' : 'Excellent - passes AAA',
        };
        break;
      }

      case 'blend': {
        const { color2 = '#FFFFFF', ratio = 0.5 } = args;
        const rgb1 = hexToRGB(color);
        const rgb2 = hexToRGB(color2);
        const blended = blendColors(rgb1, rgb2, ratio);

        result = {
          operation: 'blend',
          color1: color,
          color2,
          ratio,
          result: rgbToHex(blended),
          rgb: blended,
        };
        break;
      }

      case 'gradient': {
        const { color2 = '#FFFFFF', steps = 5 } = args;
        const gradient = generateGradient(color, color2, steps);

        result = {
          operation: 'gradient',
          from: color,
          to: color2,
          steps,
          colors: gradient,
          css_gradient: `linear-gradient(to right, ${gradient.join(', ')})`,
        };
        break;
      }

      case 'palette': {
        const { palette_name = 'material_primary' } = args;
        const palette = NAMED_PALETTES[palette_name];

        if (!palette) {
          throw new Error(`Unknown palette: ${palette_name}. Use list_palettes to see available options.`);
        }

        result = {
          operation: 'palette',
          name: palette_name,
          colors: palette,
          count: palette.length,
        };
        break;
      }

      case 'list_palettes': {
        result = {
          operation: 'list_palettes',
          palettes: Object.entries(NAMED_PALETTES).map(([name, colors]) => ({
            name,
            count: colors.length,
            preview: colors.slice(0, 3),
          })),
        };
        break;
      }

      case 'categorize': {
        const hsl = rgbToHSL(hexToRGB(color));
        const category = categorizeColor(hsl);
        const isWarm = hsl.h < 60 || hsl.h > 300;
        const isCool = hsl.h >= 150 && hsl.h <= 270;

        result = {
          operation: 'categorize',
          color,
          category,
          temperature: isWarm ? 'warm' : isCool ? 'cool' : 'neutral',
          saturation_level: hsl.s < 30 ? 'muted' : hsl.s < 70 ? 'moderate' : 'vivid',
          lightness_level: hsl.l < 30 ? 'dark' : hsl.l < 70 ? 'midtone' : 'light',
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: id,
      content: `Color Theory Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      isError: true,
    };
  }
}

export function isColorTheoryAvailable(): boolean {
  return true;
}
