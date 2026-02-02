/**
 * COLOR-GRADING TOOL
 * Professional color grading and Look-Up Table (LUT) processing
 *
 * Implements:
 * - 3D LUT generation and application
 * - Color space conversions (sRGB, Linear, ACEScg, Rec.709, Rec.2020)
 * - Lift/Gamma/Gain color wheels
 * - HSL/HSV adjustments
 * - Color curves (RGB, Luma)
 * - Color matching and transfer
 * - Split toning (shadows/highlights)
 * - Film emulation and stylization
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface RGBColor {
  r: number;
  g: number;
  b: number;
}

interface HSLColor {
  h: number;  // 0-360
  s: number;  // 0-1
  l: number;  // 0-1
}

interface HSVColor {
  h: number;  // 0-360
  s: number;  // 0-1
  v: number;  // 0-1
}

interface LUTData {
  size: number;
  data: number[][][];  // [r][g][b] -> [R, G, B]
  title?: string;
  domainMin?: [number, number, number];
  domainMax?: [number, number, number];
}

interface ColorWheels {
  lift: RGBColor;     // Shadows
  gamma: RGBColor;    // Midtones
  gain: RGBColor;     // Highlights
  offset: RGBColor;   // Overall offset
}

interface CurvePoint {
  input: number;
  output: number;
}

interface ColorCurves {
  master?: CurvePoint[];
  red?: CurvePoint[];
  green?: CurvePoint[];
  blue?: CurvePoint[];
}

interface SplitToning {
  shadowsHue: number;
  shadowsSaturation: number;
  highlightsHue: number;
  highlightsSaturation: number;
  balance: number;  // -1 to 1
}

interface GradingSettings {
  exposure?: number;
  contrast?: number;
  saturation?: number;
  vibrance?: number;
  temperature?: number;
  tint?: number;
  colorWheels?: ColorWheels;
  curves?: ColorCurves;
  splitToning?: SplitToning;
  hslAdjustments?: Record<string, { hue: number; saturation: number; lightness: number }>;
}

// ============================================================================
// COLOR SPACE CONVERSIONS
// ============================================================================

class ColorSpaceConverter {
  /**
   * sRGB to Linear RGB
   */
  static sRGBToLinear(c: number): number {
    return c <= 0.04045
      ? c / 12.92
      : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  /**
   * Linear RGB to sRGB
   */
  static linearTosRGB(c: number): number {
    return c <= 0.0031308
      ? c * 12.92
      : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  }

  /**
   * Convert full RGB from sRGB to Linear
   */
  static rgbToLinear(rgb: RGBColor): RGBColor {
    return {
      r: this.sRGBToLinear(rgb.r),
      g: this.sRGBToLinear(rgb.g),
      b: this.sRGBToLinear(rgb.b)
    };
  }

  /**
   * Convert full RGB from Linear to sRGB
   */
  static linearToRGB(rgb: RGBColor): RGBColor {
    return {
      r: this.linearTosRGB(rgb.r),
      g: this.linearTosRGB(rgb.g),
      b: this.linearTosRGB(rgb.b)
    };
  }

  /**
   * RGB to HSL conversion
   */
  static rgbToHSL(rgb: RGBColor): HSLColor {
    const r = rgb.r;
    const g = rgb.g;
    const b = rgb.b;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return { h: h * 360, s, l };
  }

  /**
   * HSL to RGB conversion
   */
  static hslToRGB(hsl: HSLColor): RGBColor {
    const h = hsl.h / 360;
    const s = hsl.s;
    const l = hsl.l;

    if (s === 0) {
      return { r: l, g: l, b: l };
    }

    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    return {
      r: hue2rgb(p, q, h + 1/3),
      g: hue2rgb(p, q, h),
      b: hue2rgb(p, q, h - 1/3)
    };
  }

  /**
   * RGB to HSV conversion
   */
  static rgbToHSV(rgb: RGBColor): HSVColor {
    const r = rgb.r;
    const g = rgb.g;
    const b = rgb.b;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    const v = max;
    const s = max === 0 ? 0 : d / max;
    let h = 0;

    if (max !== min) {
      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return { h: h * 360, s, v };
  }

  /**
   * HSV to RGB conversion
   */
  static hsvToRGB(hsv: HSVColor): RGBColor {
    const h = hsv.h / 360;
    const s = hsv.s;
    const v = hsv.v;

    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    switch (i % 6) {
      case 0: return { r: v, g: t, b: p };
      case 1: return { r: q, g: v, b: p };
      case 2: return { r: p, g: v, b: t };
      case 3: return { r: p, g: q, b: v };
      case 4: return { r: t, g: p, b: v };
      case 5: return { r: v, g: p, b: q };
      default: return { r: v, g: t, b: p };
    }
  }

  /**
   * sRGB to Rec.709 (same primaries, different gamma)
   */
  static sRGBToRec709(rgb: RGBColor): RGBColor {
    // sRGB and Rec.709 share primaries, differ in transfer function
    const linearize = (c: number) => this.sRGBToLinear(c);
    const rec709Gamma = (c: number) => c < 0.018
      ? c * 4.5
      : 1.099 * Math.pow(c, 0.45) - 0.099;

    return {
      r: rec709Gamma(linearize(rgb.r)),
      g: rec709Gamma(linearize(rgb.g)),
      b: rec709Gamma(linearize(rgb.b))
    };
  }

  /**
   * RGB to XYZ (D65)
   */
  static rgbToXYZ(rgb: RGBColor): { x: number; y: number; z: number } {
    const linear = this.rgbToLinear(rgb);
    return {
      x: linear.r * 0.4124564 + linear.g * 0.3575761 + linear.b * 0.1804375,
      y: linear.r * 0.2126729 + linear.g * 0.7151522 + linear.b * 0.0721750,
      z: linear.r * 0.0193339 + linear.g * 0.1191920 + linear.b * 0.9503041
    };
  }

  /**
   * XYZ to RGB (D65)
   */
  static xyzToRGB(xyz: { x: number; y: number; z: number }): RGBColor {
    const linear = {
      r: xyz.x *  3.2404542 + xyz.y * -1.5371385 + xyz.z * -0.4985314,
      g: xyz.x * -0.9692660 + xyz.y *  1.8760108 + xyz.z *  0.0415560,
      b: xyz.x *  0.0556434 + xyz.y * -0.2040259 + xyz.z *  1.0572252
    };
    return this.linearToRGB(linear);
  }

  /**
   * XYZ to Lab (D65)
   */
  static xyzToLab(xyz: { x: number; y: number; z: number }): { l: number; a: number; b: number } {
    // D65 reference white
    const xn = 0.95047, yn = 1.0, zn = 1.08883;

    const f = (t: number) => t > 0.008856
      ? Math.pow(t, 1/3)
      : (903.3 * t + 16) / 116;

    const fx = f(xyz.x / xn);
    const fy = f(xyz.y / yn);
    const fz = f(xyz.z / zn);

    return {
      l: 116 * fy - 16,
      a: 500 * (fx - fy),
      b: 200 * (fy - fz)
    };
  }

  /**
   * Lab to XYZ (D65)
   */
  static labToXYZ(lab: { l: number; a: number; b: number }): { x: number; y: number; z: number } {
    const xn = 0.95047, yn = 1.0, zn = 1.08883;

    const fy = (lab.l + 16) / 116;
    const fx = lab.a / 500 + fy;
    const fz = fy - lab.b / 200;

    const f_inv = (t: number) => t > 0.206893
      ? Math.pow(t, 3)
      : (116 * t - 16) / 903.3;

    return {
      x: xn * f_inv(fx),
      y: yn * f_inv(fy),
      z: zn * f_inv(fz)
    };
  }
}

// ============================================================================
// 3D LUT PROCESSING
// ============================================================================

class LUTProcessor {
  /**
   * Create identity LUT
   */
  static createIdentity(size: number): LUTData {
    const data: number[][][] = [];

    for (let r = 0; r < size; r++) {
      data[r] = [];
      for (let g = 0; g < size; g++) {
        data[r][g] = [];
        for (let b = 0; b < size; b++) {
          data[r][g][b] = [
            r / (size - 1),
            g / (size - 1),
            b / (size - 1)
          ];
        }
      }
    }

    return {
      size,
      data,
      title: 'Identity LUT',
      domainMin: [0, 0, 0],
      domainMax: [1, 1, 1]
    };
  }

  /**
   * Trilinear interpolation lookup
   */
  static lookup(lut: LUTData, rgb: RGBColor): RGBColor {
    const size = lut.size;
    const maxIdx = size - 1;

    // Map to LUT coordinates
    const r = Math.max(0, Math.min(1, rgb.r)) * maxIdx;
    const g = Math.max(0, Math.min(1, rgb.g)) * maxIdx;
    const b = Math.max(0, Math.min(1, rgb.b)) * maxIdx;

    // Get integer and fractional parts
    const r0 = Math.floor(r), r1 = Math.min(r0 + 1, maxIdx);
    const g0 = Math.floor(g), g1 = Math.min(g0 + 1, maxIdx);
    const b0 = Math.floor(b), b1 = Math.min(b0 + 1, maxIdx);

    const fr = r - r0;
    const fg = g - g0;
    const fb = b - b0;

    // Trilinear interpolation
    const interpolate = (channel: number): number => {
      const c000 = lut.data[r0][g0][b0][channel];
      const c001 = lut.data[r0][g0][b1][channel];
      const c010 = lut.data[r0][g1][b0][channel];
      const c011 = lut.data[r0][g1][b1][channel];
      const c100 = lut.data[r1][g0][b0][channel];
      const c101 = lut.data[r1][g0][b1][channel];
      const c110 = lut.data[r1][g1][b0][channel];
      const c111 = lut.data[r1][g1][b1][channel];

      const c00 = c000 * (1 - fr) + c100 * fr;
      const c01 = c001 * (1 - fr) + c101 * fr;
      const c10 = c010 * (1 - fr) + c110 * fr;
      const c11 = c011 * (1 - fr) + c111 * fr;

      const c0 = c00 * (1 - fg) + c10 * fg;
      const c1 = c01 * (1 - fg) + c11 * fg;

      return c0 * (1 - fb) + c1 * fb;
    };

    return {
      r: interpolate(0),
      g: interpolate(1),
      b: interpolate(2)
    };
  }

  /**
   * Apply LUT to image
   */
  static applyToImage(
    image: RGBColor[][],
    lut: LUTData
  ): RGBColor[][] {
    return image.map(row =>
      row.map(pixel => this.lookup(lut, pixel))
    );
  }

  /**
   * Combine two LUTs
   */
  static combine(lut1: LUTData, lut2: LUTData): LUTData {
    const size = Math.min(lut1.size, lut2.size);
    const data: number[][][] = [];

    for (let r = 0; r < size; r++) {
      data[r] = [];
      for (let g = 0; g < size; g++) {
        data[r][g] = [];
        for (let b = 0; b < size; b++) {
          const color1: RGBColor = {
            r: r / (size - 1),
            g: g / (size - 1),
            b: b / (size - 1)
          };

          const color2 = this.lookup(lut1, color1);
          const color3 = this.lookup(lut2, color2);

          data[r][g][b] = [color3.r, color3.g, color3.b];
        }
      }
    }

    return {
      size,
      data,
      title: `${lut1.title || 'LUT1'} + ${lut2.title || 'LUT2'}`
    };
  }

  /**
   * Export LUT to .cube format string
   */
  static exportCube(lut: LUTData): string {
    const lines: string[] = [];

    lines.push(`TITLE "${lut.title || 'Untitled LUT'}"`);
    lines.push(`LUT_3D_SIZE ${lut.size}`);

    if (lut.domainMin) {
      lines.push(`DOMAIN_MIN ${lut.domainMin.join(' ')}`);
    }
    if (lut.domainMax) {
      lines.push(`DOMAIN_MAX ${lut.domainMax.join(' ')}`);
    }

    lines.push('');

    // Output in B-major order (standard .cube format)
    for (let b = 0; b < lut.size; b++) {
      for (let g = 0; g < lut.size; g++) {
        for (let r = 0; r < lut.size; r++) {
          const color = lut.data[r][g][b];
          lines.push(`${color[0].toFixed(6)} ${color[1].toFixed(6)} ${color[2].toFixed(6)}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Parse .cube format string
   */
  static parseCube(cubeStr: string): LUTData {
    const lines = cubeStr.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

    let size = 0;
    let title = '';
    let domainMin: [number, number, number] = [0, 0, 0];
    let domainMax: [number, number, number] = [1, 1, 1];
    const colorData: number[][] = [];

    for (const line of lines) {
      if (line.startsWith('TITLE')) {
        title = line.replace('TITLE', '').replace(/"/g, '').trim();
      } else if (line.startsWith('LUT_3D_SIZE')) {
        size = parseInt(line.split(/\s+/)[1]);
      } else if (line.startsWith('DOMAIN_MIN')) {
        const parts = line.split(/\s+/).slice(1).map(Number);
        domainMin = [parts[0], parts[1], parts[2]];
      } else if (line.startsWith('DOMAIN_MAX')) {
        const parts = line.split(/\s+/).slice(1).map(Number);
        domainMax = [parts[0], parts[1], parts[2]];
      } else if (!line.startsWith('LUT_') && !line.startsWith('DOMAIN')) {
        const values = line.split(/\s+/).map(Number);
        if (values.length === 3 && !isNaN(values[0])) {
          colorData.push(values);
        }
      }
    }

    // Build 3D array
    const data: number[][][] = [];
    let idx = 0;

    for (let r = 0; r < size; r++) {
      data[r] = [];
      for (let g = 0; g < size; g++) {
        data[r][g] = [];
        for (let b = 0; b < size; b++) {
          // .cube format is B-major, so we need to reorder
          const cubeIdx = b * size * size + g * size + r;
          data[r][g][b] = colorData[cubeIdx] || [r/(size-1), g/(size-1), b/(size-1)];
          idx++;
        }
      }
    }

    return { size, data, title, domainMin, domainMax };
  }
}

// ============================================================================
// LIFT/GAMMA/GAIN COLOR WHEELS
// ============================================================================

class ColorWheelProcessor {
  /**
   * Apply lift/gamma/gain adjustments
   */
  static apply(rgb: RGBColor, wheels: ColorWheels): RGBColor {
    // Lift (shadows) - adds to dark values
    let r = rgb.r + (wheels.lift.r - 0.5) * 2 * (1 - rgb.r);
    let g = rgb.g + (wheels.lift.g - 0.5) * 2 * (1 - rgb.g);
    let b = rgb.b + (wheels.lift.b - 0.5) * 2 * (1 - rgb.b);

    // Gamma (midtones) - power function
    const gammaR = 1 / (1 + (wheels.gamma.r - 0.5) * 2);
    const gammaG = 1 / (1 + (wheels.gamma.g - 0.5) * 2);
    const gammaB = 1 / (1 + (wheels.gamma.b - 0.5) * 2);

    r = Math.pow(Math.max(0, r), gammaR);
    g = Math.pow(Math.max(0, g), gammaG);
    b = Math.pow(Math.max(0, b), gammaB);

    // Gain (highlights) - multiplier
    r = r * (wheels.gain.r * 2);
    g = g * (wheels.gain.g * 2);
    b = b * (wheels.gain.b * 2);

    // Offset - overall shift
    r = r + (wheels.offset.r - 0.5) * 2;
    g = g + (wheels.offset.g - 0.5) * 2;
    b = b + (wheels.offset.b - 0.5) * 2;

    return {
      r: Math.max(0, Math.min(1, r)),
      g: Math.max(0, Math.min(1, g)),
      b: Math.max(0, Math.min(1, b))
    };
  }

  /**
   * Create default neutral wheels
   */
  static neutral(): ColorWheels {
    return {
      lift: { r: 0.5, g: 0.5, b: 0.5 },
      gamma: { r: 0.5, g: 0.5, b: 0.5 },
      gain: { r: 0.5, g: 0.5, b: 0.5 },
      offset: { r: 0.5, g: 0.5, b: 0.5 }
    };
  }
}

// ============================================================================
// COLOR CURVES
// ============================================================================

class CurveProcessor {
  /**
   * Create spline from control points
   */
  static buildCurve(points: CurvePoint[]): (input: number) => number {
    if (points.length === 0) {
      return (x) => x;
    }

    // Sort by input
    const sorted = [...points].sort((a, b) => a.input - b.input);

    // Add endpoints if needed
    if (sorted[0].input > 0) {
      sorted.unshift({ input: 0, output: 0 });
    }
    if (sorted[sorted.length - 1].input < 1) {
      sorted.push({ input: 1, output: 1 });
    }

    return (x: number): number => {
      x = Math.max(0, Math.min(1, x));

      // Find segment
      let i = 0;
      while (i < sorted.length - 1 && sorted[i + 1].input < x) {
        i++;
      }

      if (i >= sorted.length - 1) {
        return sorted[sorted.length - 1].output;
      }

      // Linear interpolation within segment
      const p1 = sorted[i];
      const p2 = sorted[i + 1];
      const t = (x - p1.input) / (p2.input - p1.input);

      return p1.output + t * (p2.output - p1.output);
    };
  }

  /**
   * Apply curves to RGB color
   */
  static apply(rgb: RGBColor, curves: ColorCurves): RGBColor {
    const masterCurve = curves.master ? this.buildCurve(curves.master) : (x: number) => x;
    const redCurve = curves.red ? this.buildCurve(curves.red) : (x: number) => x;
    const greenCurve = curves.green ? this.buildCurve(curves.green) : (x: number) => x;
    const blueCurve = curves.blue ? this.buildCurve(curves.blue) : (x: number) => x;

    // Apply individual channel curves first, then master
    return {
      r: masterCurve(redCurve(rgb.r)),
      g: masterCurve(greenCurve(rgb.g)),
      b: masterCurve(blueCurve(rgb.b))
    };
  }

  /**
   * Create S-curve for contrast
   */
  static createSCurve(intensity: number): CurvePoint[] {
    const mid = 0.5;
    const offset = intensity * 0.2;

    return [
      { input: 0, output: 0 },
      { input: 0.25, output: 0.25 - offset },
      { input: 0.5, output: 0.5 },
      { input: 0.75, output: 0.75 + offset },
      { input: 1, output: 1 }
    ];
  }
}

// ============================================================================
// SPLIT TONING
// ============================================================================

class SplitToneProcessor {
  /**
   * Apply split toning
   */
  static apply(rgb: RGBColor, settings: SplitToning): RGBColor {
    // Calculate luminance
    const luma = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;

    // Create shadow and highlight colors
    const shadowColor = ColorSpaceConverter.hslToRGB({
      h: settings.shadowsHue,
      s: settings.shadowsSaturation,
      l: 0.5
    });

    const highlightColor = ColorSpaceConverter.hslToRGB({
      h: settings.highlightsHue,
      s: settings.highlightsSaturation,
      l: 0.5
    });

    // Calculate blend factors
    const balance = (settings.balance + 1) / 2;  // 0 to 1
    const shadowWeight = Math.pow(1 - luma, 2) * (1 - balance);
    const highlightWeight = Math.pow(luma, 2) * balance;

    // Blend
    return {
      r: Math.max(0, Math.min(1, rgb.r + (shadowColor.r - 0.5) * shadowWeight + (highlightColor.r - 0.5) * highlightWeight)),
      g: Math.max(0, Math.min(1, rgb.g + (shadowColor.g - 0.5) * shadowWeight + (highlightColor.g - 0.5) * highlightWeight)),
      b: Math.max(0, Math.min(1, rgb.b + (shadowColor.b - 0.5) * shadowWeight + (highlightColor.b - 0.5) * highlightWeight))
    };
  }
}

// ============================================================================
// BASIC ADJUSTMENTS
// ============================================================================

class BasicAdjustments {
  /**
   * Apply exposure adjustment
   */
  static exposure(rgb: RGBColor, stops: number): RGBColor {
    const multiplier = Math.pow(2, stops);
    return {
      r: Math.max(0, Math.min(1, rgb.r * multiplier)),
      g: Math.max(0, Math.min(1, rgb.g * multiplier)),
      b: Math.max(0, Math.min(1, rgb.b * multiplier))
    };
  }

  /**
   * Apply contrast adjustment
   */
  static contrast(rgb: RGBColor, amount: number): RGBColor {
    const factor = (1 + amount);
    return {
      r: Math.max(0, Math.min(1, (rgb.r - 0.5) * factor + 0.5)),
      g: Math.max(0, Math.min(1, (rgb.g - 0.5) * factor + 0.5)),
      b: Math.max(0, Math.min(1, (rgb.b - 0.5) * factor + 0.5))
    };
  }

  /**
   * Apply saturation adjustment
   */
  static saturation(rgb: RGBColor, amount: number): RGBColor {
    const hsl = ColorSpaceConverter.rgbToHSL(rgb);
    hsl.s = Math.max(0, Math.min(1, hsl.s * (1 + amount)));
    return ColorSpaceConverter.hslToRGB(hsl);
  }

  /**
   * Apply vibrance (smart saturation)
   */
  static vibrance(rgb: RGBColor, amount: number): RGBColor {
    const hsl = ColorSpaceConverter.rgbToHSL(rgb);
    // Less saturated colors get more boost
    const satBoost = amount * (1 - hsl.s);
    hsl.s = Math.max(0, Math.min(1, hsl.s + satBoost));
    return ColorSpaceConverter.hslToRGB(hsl);
  }

  /**
   * Apply white balance (temperature/tint)
   */
  static whiteBalance(rgb: RGBColor, temperature: number, tint: number): RGBColor {
    // Temperature: negative = cool (blue), positive = warm (yellow)
    // Tint: negative = green, positive = magenta
    return {
      r: Math.max(0, Math.min(1, rgb.r + temperature * 0.1)),
      g: Math.max(0, Math.min(1, rgb.g - tint * 0.1)),
      b: Math.max(0, Math.min(1, rgb.b - temperature * 0.1))
    };
  }
}

// ============================================================================
// FILM EMULATION
// ============================================================================

class FilmEmulation {
  /**
   * Create Kodak Portra-style LUT
   */
  static createPortraLUT(size: number = 17): LUTData {
    const lut = LUTProcessor.createIdentity(size);

    for (let r = 0; r < size; r++) {
      for (let g = 0; g < size; g++) {
        for (let b = 0; b < size; b++) {
          const origR = r / (size - 1);
          const origG = g / (size - 1);
          const origB = b / (size - 1);

          // Portra characteristics: lifted shadows, warm highlights, reduced contrast
          let newR = origR * 0.9 + 0.05;
          let newG = origG * 0.92 + 0.04;
          let newB = origB * 0.85 + 0.08;

          // Slight orange shift in shadows
          const luma = 0.2126 * origR + 0.7152 * origG + 0.0722 * origB;
          if (luma < 0.5) {
            newR += (0.5 - luma) * 0.05;
            newG += (0.5 - luma) * 0.02;
          }

          lut.data[r][g][b] = [
            Math.max(0, Math.min(1, newR)),
            Math.max(0, Math.min(1, newG)),
            Math.max(0, Math.min(1, newB))
          ];
        }
      }
    }

    lut.title = 'Portra-style Film';
    return lut;
  }

  /**
   * Create Fuji Velvia-style LUT
   */
  static createVelviaLUT(size: number = 17): LUTData {
    const lut = LUTProcessor.createIdentity(size);

    for (let r = 0; r < size; r++) {
      for (let g = 0; g < size; g++) {
        for (let b = 0; b < size; b++) {
          let origR = r / (size - 1);
          let origG = g / (size - 1);
          let origB = b / (size - 1);

          // Velvia: high saturation, deep shadows, punchy contrast

          // Increase contrast
          origR = (origR - 0.5) * 1.2 + 0.5;
          origG = (origG - 0.5) * 1.2 + 0.5;
          origB = (origB - 0.5) * 1.2 + 0.5;

          // Boost saturation
          const hsl = ColorSpaceConverter.rgbToHSL({ r: origR, g: origG, b: origB });
          hsl.s = Math.min(1, hsl.s * 1.3);
          const saturated = ColorSpaceConverter.hslToRGB(hsl);

          lut.data[r][g][b] = [
            Math.max(0, Math.min(1, saturated.r)),
            Math.max(0, Math.min(1, saturated.g)),
            Math.max(0, Math.min(1, saturated.b))
          ];
        }
      }
    }

    lut.title = 'Velvia-style Film';
    return lut;
  }

  /**
   * Create cinematic teal/orange look
   */
  static createCinematicLUT(size: number = 17): LUTData {
    const lut = LUTProcessor.createIdentity(size);

    for (let r = 0; r < size; r++) {
      for (let g = 0; g < size; g++) {
        for (let b = 0; b < size; b++) {
          const origR = r / (size - 1);
          const origG = g / (size - 1);
          const origB = b / (size - 1);

          const luma = 0.2126 * origR + 0.7152 * origG + 0.0722 * origB;

          // Teal shadows, orange highlights
          let newR = origR;
          let newG = origG;
          let newB = origB;

          if (luma < 0.5) {
            // Push shadows toward teal
            newR -= (0.5 - luma) * 0.1;
            newG += (0.5 - luma) * 0.02;
            newB += (0.5 - luma) * 0.15;
          } else {
            // Push highlights toward orange
            newR += (luma - 0.5) * 0.15;
            newG += (luma - 0.5) * 0.05;
            newB -= (luma - 0.5) * 0.1;
          }

          lut.data[r][g][b] = [
            Math.max(0, Math.min(1, newR)),
            Math.max(0, Math.min(1, newG)),
            Math.max(0, Math.min(1, newB))
          ];
        }
      }
    }

    lut.title = 'Cinematic Teal/Orange';
    return lut;
  }
}

// ============================================================================
// COLOR GRADING PROCESSOR
// ============================================================================

class ColorGradingProcessor {
  /**
   * Apply full grading pipeline
   */
  static grade(rgb: RGBColor, settings: GradingSettings): RGBColor {
    let result = { ...rgb };

    // 1. Basic adjustments
    if (settings.exposure !== undefined && settings.exposure !== 0) {
      result = BasicAdjustments.exposure(result, settings.exposure);
    }

    if (settings.temperature !== undefined || settings.tint !== undefined) {
      result = BasicAdjustments.whiteBalance(
        result,
        settings.temperature || 0,
        settings.tint || 0
      );
    }

    if (settings.contrast !== undefined && settings.contrast !== 0) {
      result = BasicAdjustments.contrast(result, settings.contrast);
    }

    // 2. Color wheels
    if (settings.colorWheels) {
      result = ColorWheelProcessor.apply(result, settings.colorWheels);
    }

    // 3. Curves
    if (settings.curves) {
      result = CurveProcessor.apply(result, settings.curves);
    }

    // 4. Saturation/Vibrance
    if (settings.vibrance !== undefined && settings.vibrance !== 0) {
      result = BasicAdjustments.vibrance(result, settings.vibrance);
    }

    if (settings.saturation !== undefined && settings.saturation !== 0) {
      result = BasicAdjustments.saturation(result, settings.saturation);
    }

    // 5. Split toning
    if (settings.splitToning) {
      result = SplitToneProcessor.apply(result, settings.splitToning);
    }

    // 6. HSL adjustments (per-color)
    if (settings.hslAdjustments) {
      const hsl = ColorSpaceConverter.rgbToHSL(result);

      // Determine which color range this hue falls into
      for (const [colorName, adjustment] of Object.entries(settings.hslAdjustments)) {
        const hueRanges: Record<string, [number, number]> = {
          red: [330, 30],
          orange: [15, 45],
          yellow: [45, 75],
          green: [75, 165],
          cyan: [165, 195],
          blue: [195, 255],
          purple: [255, 285],
          magenta: [285, 330]
        };

        const range = hueRanges[colorName.toLowerCase()];
        if (range) {
          const [start, end] = range;
          const inRange = start > end
            ? (hsl.h >= start || hsl.h <= end)
            : (hsl.h >= start && hsl.h <= end);

          if (inRange) {
            hsl.h = (hsl.h + adjustment.hue + 360) % 360;
            hsl.s = Math.max(0, Math.min(1, hsl.s * (1 + adjustment.saturation)));
            hsl.l = Math.max(0, Math.min(1, hsl.l + adjustment.lightness));
          }
        }
      }

      result = ColorSpaceConverter.hslToRGB(hsl);
    }

    return {
      r: Math.max(0, Math.min(1, result.r)),
      g: Math.max(0, Math.min(1, result.g)),
      b: Math.max(0, Math.min(1, result.b))
    };
  }

  /**
   * Grade full image
   */
  static gradeImage(image: RGBColor[][], settings: GradingSettings): RGBColor[][] {
    return image.map(row =>
      row.map(pixel => this.grade(pixel, settings))
    );
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const colorgradingTool: UnifiedTool = {
  name: 'color_grading',
  description: 'Professional color grading and LUT processing tool. Supports 3D LUT generation/application, color space conversions, lift/gamma/gain wheels, curves, split toning, HSL adjustments, and film emulation presets.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'grade', 'create_lut', 'apply_lut', 'combine_luts', 'export_cube', 'parse_cube',
          'convert_colorspace', 'film_preset', 'demo', 'info', 'examples'
        ],
        description: 'Operation to perform'
      },
      image: {
        type: 'array',
        description: 'Input image as 2D array of {r, g, b} pixels (0-1 range)'
      },
      color: {
        type: 'object',
        description: 'Single color to process {r, g, b}'
      },
      settings: {
        type: 'object',
        properties: {
          exposure: { type: 'number', description: 'Exposure in stops (-5 to +5)' },
          contrast: { type: 'number', description: 'Contrast (-1 to +1)' },
          saturation: { type: 'number', description: 'Saturation (-1 to +1)' },
          vibrance: { type: 'number', description: 'Vibrance (-1 to +1)' },
          temperature: { type: 'number', description: 'Temperature (-1 cool to +1 warm)' },
          tint: { type: 'number', description: 'Tint (-1 green to +1 magenta)' },
          colorWheels: { type: 'object', description: 'Lift/Gamma/Gain/Offset wheels' },
          curves: { type: 'object', description: 'RGB and master curves' },
          splitToning: { type: 'object', description: 'Split toning settings' },
          hslAdjustments: { type: 'object', description: 'Per-color HSL adjustments' }
        },
        description: 'Grading settings'
      },
      lut: {
        type: 'object',
        description: 'LUT data for apply/combine operations'
      },
      lutSize: {
        type: 'number',
        description: 'LUT cube size (default: 17)'
      },
      cubeString: {
        type: 'string',
        description: '.cube format string for parsing'
      },
      fromSpace: {
        type: 'string',
        enum: ['srgb', 'linear', 'rec709', 'hsl', 'hsv', 'xyz', 'lab'],
        description: 'Source color space'
      },
      toSpace: {
        type: 'string',
        enum: ['srgb', 'linear', 'rec709', 'hsl', 'hsv', 'xyz', 'lab'],
        description: 'Target color space'
      },
      filmPreset: {
        type: 'string',
        enum: ['portra', 'velvia', 'cinematic', 'bw_high_contrast', 'bw_soft'],
        description: 'Film emulation preset'
      }
    },
    required: ['operation']
  }
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executecolorgrading(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, image, color, settings, lut, lutSize, cubeString, fromSpace, toSpace, filmPreset } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'info': {
        result = {
          tool: 'color_grading',
          description: 'Professional color grading with LUT support',
          features: {
            colorSpaces: ['sRGB', 'Linear RGB', 'Rec.709', 'HSL', 'HSV', 'XYZ', 'Lab'],
            adjustments: ['exposure', 'contrast', 'saturation', 'vibrance', 'white_balance'],
            colorWheels: ['lift', 'gamma', 'gain', 'offset'],
            curves: ['master', 'red', 'green', 'blue'],
            splitToning: ['shadows_hue', 'highlights_hue', 'balance'],
            hslAdjustments: ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta'],
            lutSupport: ['create', 'apply', 'combine', 'export_cube', 'parse_cube'],
            filmPresets: ['portra', 'velvia', 'cinematic']
          },
          operations: [
            'grade', 'create_lut', 'apply_lut', 'combine_luts', 'export_cube',
            'parse_cube', 'convert_colorspace', 'film_preset', 'demo', 'info', 'examples'
          ]
        };
        break;
      }

      case 'examples': {
        result = {
          examples: [
            {
              name: 'Basic grading',
              operation: 'grade',
              color: { r: 0.5, g: 0.4, b: 0.3 },
              settings: { exposure: 0.5, contrast: 0.2, saturation: 0.1 }
            },
            {
              name: 'Split toning',
              operation: 'grade',
              settings: {
                splitToning: {
                  shadowsHue: 220,
                  shadowsSaturation: 0.3,
                  highlightsHue: 40,
                  highlightsSaturation: 0.25,
                  balance: 0
                }
              }
            },
            {
              name: 'Color wheels',
              operation: 'grade',
              settings: {
                colorWheels: {
                  lift: { r: 0.48, g: 0.5, b: 0.52 },
                  gamma: { r: 0.5, g: 0.5, b: 0.5 },
                  gain: { r: 0.52, g: 0.5, b: 0.48 },
                  offset: { r: 0.5, g: 0.5, b: 0.5 }
                }
              }
            },
            {
              name: 'Create film LUT',
              operation: 'film_preset',
              filmPreset: 'portra',
              lutSize: 17
            },
            {
              name: 'Color space conversion',
              operation: 'convert_colorspace',
              color: { r: 0.5, g: 0.3, b: 0.2 },
              fromSpace: 'srgb',
              toSpace: 'lab'
            }
          ]
        };
        break;
      }

      case 'demo': {
        // Demo with test gradient
        const testGradient: RGBColor[][] = [];
        for (let y = 0; y < 8; y++) {
          testGradient[y] = [];
          for (let x = 0; x < 8; x++) {
            testGradient[y][x] = {
              r: x / 7,
              g: y / 7,
              b: (x + y) / 14
            };
          }
        }

        const demoSettings: GradingSettings = {
          exposure: 0.3,
          contrast: 0.15,
          vibrance: 0.2,
          temperature: 0.1,
          splitToning: {
            shadowsHue: 210,
            shadowsSaturation: 0.2,
            highlightsHue: 45,
            highlightsSaturation: 0.15,
            balance: 0.1
          }
        };

        const graded = ColorGradingProcessor.gradeImage(testGradient, demoSettings);

        result = {
          operation: 'demo',
          description: 'Color grading demo with gradient',
          settings: demoSettings,
          inputSample: {
            topLeft: testGradient[0][0],
            center: testGradient[4][4],
            bottomRight: testGradient[7][7]
          },
          outputSample: {
            topLeft: graded[0][0],
            center: graded[4][4],
            bottomRight: graded[7][7]
          },
          message: 'Applied warm split-toning with lifted exposure and subtle vibrance'
        };
        break;
      }

      case 'grade': {
        if (color) {
          const graded = ColorGradingProcessor.grade(color, settings || {});
          result = {
            operation: 'grade',
            input: color,
            settings: settings || {},
            output: graded
          };
        } else if (image && Array.isArray(image)) {
          const graded = ColorGradingProcessor.gradeImage(image, settings || {});
          result = {
            operation: 'grade',
            inputSize: { width: image[0]?.length || 0, height: image.length },
            settings: settings || {},
            output: graded.length <= 16 ? graded : 'Output truncated'
          };
        } else {
          throw new Error('Either color or image required');
        }
        break;
      }

      case 'create_lut': {
        const size = lutSize || 17;
        const identity = LUTProcessor.createIdentity(size);

        if (settings) {
          // Bake grading settings into LUT
          for (let r = 0; r < size; r++) {
            for (let g = 0; g < size; g++) {
              for (let b = 0; b < size; b++) {
                const inputColor: RGBColor = {
                  r: r / (size - 1),
                  g: g / (size - 1),
                  b: b / (size - 1)
                };
                const graded = ColorGradingProcessor.grade(inputColor, settings);
                identity.data[r][g][b] = [graded.r, graded.g, graded.b];
              }
            }
          }
          identity.title = 'Custom Grading LUT';
        }

        result = {
          operation: 'create_lut',
          size,
          hasSettings: !!settings,
          lutPreview: {
            black: identity.data[0][0][0],
            midGray: identity.data[Math.floor(size/2)][Math.floor(size/2)][Math.floor(size/2)],
            white: identity.data[size-1][size-1][size-1]
          },
          lut: identity
        };
        break;
      }

      case 'apply_lut': {
        if (!lut) {
          throw new Error('LUT required for apply operation');
        }

        if (color) {
          const output = LUTProcessor.lookup(lut, color);
          result = {
            operation: 'apply_lut',
            input: color,
            output
          };
        } else if (image && Array.isArray(image)) {
          const output = LUTProcessor.applyToImage(image, lut);
          result = {
            operation: 'apply_lut',
            inputSize: { width: image[0]?.length || 0, height: image.length },
            output: output.length <= 16 ? output : 'Output truncated'
          };
        } else {
          throw new Error('Either color or image required');
        }
        break;
      }

      case 'combine_luts': {
        if (!lut || !args.lut2) {
          throw new Error('Two LUTs required for combine');
        }

        const combined = LUTProcessor.combine(lut, args.lut2);
        result = {
          operation: 'combine_luts',
          lut1Title: lut.title || 'LUT 1',
          lut2Title: args.lut2.title || 'LUT 2',
          combinedSize: combined.size,
          combinedTitle: combined.title,
          lut: combined
        };
        break;
      }

      case 'export_cube': {
        if (!lut) {
          throw new Error('LUT required for export');
        }

        const cubeOutput = LUTProcessor.exportCube(lut);
        result = {
          operation: 'export_cube',
          lutTitle: lut.title || 'Untitled',
          lutSize: lut.size,
          cubeFormat: cubeOutput,
          lineCount: cubeOutput.split('\n').length
        };
        break;
      }

      case 'parse_cube': {
        if (!cubeString) {
          throw new Error('Cube string required for parsing');
        }

        const parsed = LUTProcessor.parseCube(cubeString);
        result = {
          operation: 'parse_cube',
          title: parsed.title,
          size: parsed.size,
          domainMin: parsed.domainMin,
          domainMax: parsed.domainMax,
          lut: parsed
        };
        break;
      }

      case 'convert_colorspace': {
        if (!color) {
          throw new Error('Color required for conversion');
        }

        const from = fromSpace || 'srgb';
        const to = toSpace || 'hsl';

        let output: Record<string, number>;

        // First convert to a common format (linear RGB or XYZ)
        let intermediate: RGBColor | { x: number; y: number; z: number } | HSLColor | HSVColor | { l: number; a: number; b: number };

        // Convert from source
        switch (from) {
          case 'srgb':
            intermediate = color;
            break;
          case 'linear':
            intermediate = ColorSpaceConverter.linearToRGB(color);
            break;
          case 'hsl':
            intermediate = ColorSpaceConverter.hslToRGB(color as unknown as HSLColor);
            break;
          case 'hsv':
            intermediate = ColorSpaceConverter.hsvToRGB(color as unknown as HSVColor);
            break;
          case 'xyz':
            intermediate = ColorSpaceConverter.xyzToRGB(color as unknown as { x: number; y: number; z: number });
            break;
          case 'lab':
            const xyz = ColorSpaceConverter.labToXYZ(color as unknown as { l: number; a: number; b: number });
            intermediate = ColorSpaceConverter.xyzToRGB(xyz);
            break;
          default:
            intermediate = color;
        }

        // Convert to target
        const rgbIntermediate = intermediate as RGBColor;
        switch (to) {
          case 'srgb':
            output = rgbIntermediate;
            break;
          case 'linear':
            output = ColorSpaceConverter.rgbToLinear(rgbIntermediate);
            break;
          case 'rec709':
            output = ColorSpaceConverter.sRGBToRec709(rgbIntermediate);
            break;
          case 'hsl':
            output = ColorSpaceConverter.rgbToHSL(rgbIntermediate);
            break;
          case 'hsv':
            output = ColorSpaceConverter.rgbToHSV(rgbIntermediate);
            break;
          case 'xyz':
            output = ColorSpaceConverter.rgbToXYZ(rgbIntermediate);
            break;
          case 'lab':
            const toXyz = ColorSpaceConverter.rgbToXYZ(rgbIntermediate);
            output = ColorSpaceConverter.xyzToLab(toXyz);
            break;
          default:
            output = rgbIntermediate;
        }

        result = {
          operation: 'convert_colorspace',
          input: color,
          fromSpace: from,
          toSpace: to,
          output
        };
        break;
      }

      case 'film_preset': {
        const preset = filmPreset || 'portra';
        const size = lutSize || 17;
        let filmLut: LUTData;

        switch (preset) {
          case 'portra':
            filmLut = FilmEmulation.createPortraLUT(size);
            break;
          case 'velvia':
            filmLut = FilmEmulation.createVelviaLUT(size);
            break;
          case 'cinematic':
            filmLut = FilmEmulation.createCinematicLUT(size);
            break;
          default:
            filmLut = FilmEmulation.createPortraLUT(size);
        }

        if (color) {
          const output = LUTProcessor.lookup(filmLut, color);
          result = {
            operation: 'film_preset',
            preset,
            input: color,
            output,
            lut: filmLut
          };
        } else if (image && Array.isArray(image)) {
          const output = LUTProcessor.applyToImage(image, filmLut);
          result = {
            operation: 'film_preset',
            preset,
            inputSize: { width: image[0]?.length || 0, height: image.length },
            output: output.length <= 16 ? output : 'Output truncated',
            lut: filmLut
          };
        } else {
          result = {
            operation: 'film_preset',
            preset,
            lutSize: size,
            lut: filmLut,
            message: `Created ${preset}-style film emulation LUT`
          };
        }
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };

  } catch (e) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${error}`, isError: true };
  }
}

export function iscolorgradingAvailable(): boolean {
  return true;
}
