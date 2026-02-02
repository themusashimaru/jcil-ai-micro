/**
 * COLOR SCHEME TOOL
 * Generate and analyze color schemes for design
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface RGB { r: number; g: number; b: number; }
interface HSL { h: number; s: number; l: number; }
interface Color { hex: string; rgb: RGB; hsl: HSL; name?: string; }
interface ColorScheme { name: string; colors: Color[]; type: string; }

function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 0, b: 0 };
}

function rgbToHex(rgb: RGB): string {
  return '#' + [rgb.r, rgb.g, rgb.b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(hsl: HSL): RGB {
  const h = hsl.h / 360, s = hsl.s / 100, l = hsl.l / 100;
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function createColor(hex: string, name?: string): Color {
  const rgb = hexToRgb(hex);
  return { hex: hex.toUpperCase(), rgb, hsl: rgbToHsl(rgb), name };
}

function complementary(color: Color): ColorScheme {
  const compHsl = { ...color.hsl, h: (color.hsl.h + 180) % 360 };
  return { name: 'Complementary', type: 'complementary', colors: [color, createColor(rgbToHex(hslToRgb(compHsl)))] };
}

function triadic(color: Color): ColorScheme {
  const colors = [color];
  for (let i = 1; i <= 2; i++) {
    const hsl = { ...color.hsl, h: (color.hsl.h + 120 * i) % 360 };
    colors.push(createColor(rgbToHex(hslToRgb(hsl))));
  }
  return { name: 'Triadic', type: 'triadic', colors };
}

function analogous(color: Color): ColorScheme {
  const colors: Color[] = [];
  for (let i = -2; i <= 2; i++) {
    const hsl = { ...color.hsl, h: (color.hsl.h + 30 * i + 360) % 360 };
    colors.push(createColor(rgbToHex(hslToRgb(hsl))));
  }
  return { name: 'Analogous', type: 'analogous', colors };
}

function splitComplementary(color: Color): ColorScheme {
  const colors = [color];
  colors.push(createColor(rgbToHex(hslToRgb({ ...color.hsl, h: (color.hsl.h + 150) % 360 }))));
  colors.push(createColor(rgbToHex(hslToRgb({ ...color.hsl, h: (color.hsl.h + 210) % 360 }))));
  return { name: 'Split Complementary', type: 'split-complementary', colors };
}

function monochromatic(color: Color): ColorScheme {
  const colors: Color[] = [];
  for (let l = 20; l <= 80; l += 15) {
    colors.push(createColor(rgbToHex(hslToRgb({ ...color.hsl, l }))));
  }
  return { name: 'Monochromatic', type: 'monochromatic', colors };
}

function tetradic(color: Color): ColorScheme {
  const colors = [color];
  for (const offset of [90, 180, 270]) {
    colors.push(createColor(rgbToHex(hslToRgb({ ...color.hsl, h: (color.hsl.h + offset) % 360 }))));
  }
  return { name: 'Tetradic', type: 'tetradic', colors };
}

function getContrastRatio(c1: Color, c2: Color): number {
  const luminance = (c: Color) => {
    const [r, g, b] = [c.rgb.r, c.rgb.g, c.rgb.b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const l1 = luminance(c1), l2 = luminance(c2);
  const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function randomColor(): Color {
  const hex = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
  return createColor(hex);
}

function generatePalette(count: number): Color[] {
  const colors: Color[] = [];
  const baseHue = Math.floor(Math.random() * 360);
  for (let i = 0; i < count; i++) {
    const hsl = { h: (baseHue + (360 / count) * i) % 360, s: 50 + Math.random() * 30, l: 40 + Math.random() * 30 };
    colors.push(createColor(rgbToHex(hslToRgb(hsl))));
  }
  return colors;
}

function colorToAscii(colors: Color[]): string {
  return colors.map(c => `${c.hex} ${'█'.repeat(10)}`).join('\n');
}

export const colorSchemeTool: UnifiedTool = {
  name: 'color_scheme',
  description: 'Color Scheme: complementary, triadic, analogous, monochromatic, tetradic, contrast, palette',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['complementary', 'triadic', 'analogous', 'split', 'monochromatic', 'tetradic', 'contrast', 'palette', 'convert', 'random', 'info'] },
      color: { type: 'string' },
      color2: { type: 'string' },
      count: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeColorScheme(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const baseColor = args.color ? createColor(args.color) : randomColor();
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'complementary':
        const comp = complementary(baseColor);
        result = { scheme: comp, ascii: colorToAscii(comp.colors) };
        break;
      case 'triadic':
        const tri = triadic(baseColor);
        result = { scheme: tri, ascii: colorToAscii(tri.colors) };
        break;
      case 'analogous':
        const analog = analogous(baseColor);
        result = { scheme: analog, ascii: colorToAscii(analog.colors) };
        break;
      case 'split':
        const split = splitComplementary(baseColor);
        result = { scheme: split, ascii: colorToAscii(split.colors) };
        break;
      case 'monochromatic':
        const mono = monochromatic(baseColor);
        result = { scheme: mono, ascii: colorToAscii(mono.colors) };
        break;
      case 'tetradic':
        const tetra = tetradic(baseColor);
        result = { scheme: tetra, ascii: colorToAscii(tetra.colors) };
        break;
      case 'contrast':
        const color2 = args.color2 ? createColor(args.color2) : createColor('#ffffff');
        const ratio = getContrastRatio(baseColor, color2);
        const wcagAA = ratio >= 4.5;
        const wcagAAA = ratio >= 7;
        result = { color1: baseColor, color2, contrastRatio: ratio.toFixed(2), wcagAA, wcagAAA };
        break;
      case 'palette':
        const palette = generatePalette(args.count || 5);
        result = { palette, ascii: colorToAscii(palette) };
        break;
      case 'convert':
        result = { color: baseColor };
        break;
      case 'random':
        const randColors = Array.from({ length: args.count || 5 }, () => randomColor());
        result = { colors: randColors, ascii: colorToAscii(randColors) };
        break;
      case 'info':
        result = { types: ['complementary', 'triadic', 'analogous', 'split', 'monochromatic', 'tetradic'], description: 'Generate color schemes based on color theory' };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isColorSchemeAvailable(): boolean { return true; }
