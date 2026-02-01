// ============================================================================
// OPTICS SIMULATION TOOL - TIER BEYOND
// ============================================================================
// Optical calculations: ray tracing, lens systems, diffraction, interference.
// Pure TypeScript implementation - no external dependencies.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Snell's law: n1*sin(θ1) = n2*sin(θ2)
function snellsLaw(n1: number, n2: number, theta1: number): number | null {
  const sinTheta2 = (n1 / n2) * Math.sin(theta1);
  if (Math.abs(sinTheta2) > 1) return null; // Total internal reflection
  return Math.asin(sinTheta2);
}

// Thin lens equation: 1/f = 1/do + 1/di
function thinLens(
  f: number,
  objectDist: number
): { imageDist: number; magnification: number; real: boolean; inverted: boolean } {
  const di = 1 / (1 / f - 1 / objectDist);
  const m = -di / objectDist;
  return { imageDist: di, magnification: m, real: di > 0, inverted: m < 0 };
}

// Lensmaker's equation: 1/f = (n-1)*(1/R1 - 1/R2)
function lensmakerEquation(n: number, r1: number, r2: number): number {
  return 1 / ((n - 1) * (1 / r1 - 1 / r2));
}

// Diffraction grating: d*sin(θ) = m*λ
function diffractionGrating(d: number, wavelength: number, order: number): number | null {
  const sinTheta = (order * wavelength) / d;
  if (Math.abs(sinTheta) > 1) return null;
  return Math.asin(sinTheta);
}

// Single slit diffraction minima: a*sin(θ) = m*λ
function singleSlitMinima(slitWidth: number, wavelength: number, order: number): number | null {
  const sinTheta = (order * wavelength) / slitWidth;
  if (Math.abs(sinTheta) > 1) return null;
  return Math.asin(sinTheta);
}

// Double slit interference maxima: d*sin(θ) = m*λ
function doubleSlitMaxima(separation: number, wavelength: number, order: number): number | null {
  const sinTheta = (order * wavelength) / separation;
  if (Math.abs(sinTheta) > 1) return null;
  return Math.asin(sinTheta);
}

// Rayleigh criterion: θ = 1.22 * λ / D
function rayleighCriterion(wavelength: number, aperture: number): number {
  return (1.22 * wavelength) / aperture;
}

// Brewster's angle: tan(θB) = n2/n1
function brewsterAngle(n1: number, n2: number): number {
  return Math.atan(n2 / n1);
}

// Critical angle for total internal reflection
function criticalAngle(n1: number, n2: number): number | null {
  if (n1 <= n2) return null;
  return Math.asin(n2 / n1);
}

const MATERIALS: Record<string, number> = {
  vacuum: 1.0,
  air: 1.0003,
  water: 1.333,
  glass_crown: 1.52,
  glass_flint: 1.62,
  diamond: 2.42,
  acrylic: 1.49,
  polycarbonate: 1.58,
};

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const opticsSimTool: UnifiedTool = {
  name: 'optics_sim',
  description: `Optics simulation: lenses, refraction, diffraction, interference.`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'refraction',
          'lens',
          'lensmaker',
          'diffraction_grating',
          'single_slit',
          'double_slit',
          'resolution',
          'brewster',
          'critical_angle',
          'materials',
        ],
        description: 'Optics operation to perform',
      },
      n1: { type: 'number', description: 'Refractive index of medium 1' },
      n2: { type: 'number', description: 'Refractive index of medium 2' },
      material1: { type: 'string', description: 'Material name for medium 1' },
      material2: { type: 'string', description: 'Material name for medium 2' },
      angle: { type: 'number', description: 'Angle in radians' },
      angle_deg: { type: 'number', description: 'Angle in degrees' },
      focal_length: { type: 'number', description: 'Focal length' },
      object_distance: { type: 'number', description: 'Object distance' },
      r1: { type: 'number', description: 'Radius of curvature 1' },
      r2: { type: 'number', description: 'Radius of curvature 2' },
      wavelength: { type: 'number', description: 'Wavelength in meters' },
      wavelength_nm: { type: 'number', description: 'Wavelength in nanometers' },
      slit_width: { type: 'number', description: 'Slit width in meters' },
      separation: { type: 'number', description: 'Slit separation in meters' },
      grating_lines_per_mm: { type: 'number', description: 'Grating lines per mm' },
      order: { type: 'number', description: 'Diffraction order' },
      aperture: { type: 'number', description: 'Aperture diameter in meters' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeOpticsSim(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;
    const n1 = args.n1 || (args.material1 && MATERIALS[args.material1]) || 1;
    const n2 = args.n2 || (args.material2 && MATERIALS[args.material2]) || 1.5;
    const wavelength = args.wavelength || (args.wavelength_nm ? args.wavelength_nm * 1e-9 : 550e-9);
    const angle = args.angle || (args.angle_deg ? (args.angle_deg * Math.PI) / 180 : 0);

    let result: Record<string, unknown>;

    switch (operation) {
      case 'refraction': {
        const theta2 = snellsLaw(n1, n2, angle);
        result = {
          operation: 'refraction',
          n1,
          n2,
          incident_angle_deg: +((angle * 180) / Math.PI).toFixed(2),
          refracted_angle_deg: theta2 !== null ? +((theta2 * 180) / Math.PI).toFixed(2) : null,
          total_internal_reflection: theta2 === null,
        };
        break;
      }
      case 'lens': {
        const { focal_length, object_distance } = args;
        if (!focal_length || !object_distance)
          throw new Error('lens requires focal_length and object_distance');
        const lensResult = thinLens(focal_length, object_distance);
        result = { operation: 'lens', focal_length, object_distance, ...lensResult };
        break;
      }
      case 'lensmaker': {
        const { r1, r2 } = args;
        if (!r1 || !r2) throw new Error('lensmaker requires r1 and r2');
        const f = lensmakerEquation(n2, r1, r2);
        result = { operation: 'lensmaker', refractive_index: n2, r1, r2, focal_length: f };
        break;
      }
      case 'diffraction_grating': {
        const d = args.grating_lines_per_mm
          ? 1e-3 / args.grating_lines_per_mm
          : args.separation || 1e-6;
        const order = args.order || 1;
        const theta = diffractionGrating(d, wavelength, order);
        result = {
          operation: 'diffraction_grating',
          grating_spacing_m: d,
          wavelength_nm: wavelength * 1e9,
          order,
          angle_deg: theta !== null ? +((theta * 180) / Math.PI).toFixed(2) : null,
        };
        break;
      }
      case 'single_slit': {
        const a = args.slit_width || 1e-5;
        const order = args.order || 1;
        const theta = singleSlitMinima(a, wavelength, order);
        result = {
          operation: 'single_slit',
          slit_width_m: a,
          wavelength_nm: wavelength * 1e9,
          order,
          minima_angle_deg: theta !== null ? +((theta * 180) / Math.PI).toFixed(2) : null,
        };
        break;
      }
      case 'double_slit': {
        const d = args.separation || 1e-4;
        const order = args.order || 1;
        const theta = doubleSlitMaxima(d, wavelength, order);
        result = {
          operation: 'double_slit',
          separation_m: d,
          wavelength_nm: wavelength * 1e9,
          order,
          maxima_angle_deg: theta !== null ? +((theta * 180) / Math.PI).toFixed(2) : null,
        };
        break;
      }
      case 'resolution': {
        const D = args.aperture || 0.01;
        const theta = rayleighCriterion(wavelength, D);
        result = {
          operation: 'resolution',
          aperture_m: D,
          wavelength_nm: wavelength * 1e9,
          angular_resolution_rad: theta,
          angular_resolution_arcsec: +(theta * 206265).toFixed(2),
        };
        break;
      }
      case 'brewster': {
        const thetaB = brewsterAngle(n1, n2);
        result = {
          operation: 'brewster',
          n1,
          n2,
          brewster_angle_deg: +((thetaB * 180) / Math.PI).toFixed(2),
        };
        break;
      }
      case 'critical_angle': {
        const thetaC = criticalAngle(n1, n2);
        result = {
          operation: 'critical_angle',
          n1,
          n2,
          critical_angle_deg: thetaC !== null ? +((thetaC * 180) / Math.PI).toFixed(2) : null,
          tir_possible: thetaC !== null,
        };
        break;
      }
      case 'materials': {
        result = {
          operation: 'materials',
          available: Object.entries(MATERIALS).map(([k, v]) => ({
            material: k,
            refractive_index: v,
          })),
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
      content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      isError: true,
    };
  }
}

export function isOpticsSimAvailable(): boolean {
  return true;
}
