/**
 * CRYSTALLOGRAPHY TOOL
 *
 * Crystal structure calculations: lattice parameters, Miller indices,
 * X-ray diffraction, Bragg's law, and symmetry operations.
 *
 * Part of TIER MATERIALS SCIENCE - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// BRAVAIS LATTICE PARAMETERS
// ============================================================================

interface LatticeParams {
  a: number; b: number; c: number;
  alpha: number; beta: number; gamma: number;
}

function cubicLattice(a: number): LatticeParams {
  return { a, b: a, c: a, alpha: 90, beta: 90, gamma: 90 };
}

function tetragonalLattice(a: number, c: number): LatticeParams {
  return { a, b: a, c, alpha: 90, beta: 90, gamma: 90 };
}

function hexagonalLattice(a: number, c: number): LatticeParams {
  return { a, b: a, c, alpha: 90, beta: 90, gamma: 120 };
}

function orthorhombicLattice(a: number, b: number, c: number): LatticeParams {
  return { a, b, c, alpha: 90, beta: 90, gamma: 90 };
}

// ============================================================================
// VOLUME CALCULATIONS
// ============================================================================

function unitCellVolume(params: LatticeParams): number {
  const { a, b, c, alpha, beta, gamma } = params;
  const toRad = Math.PI / 180;
  const cosAlpha = Math.cos(alpha * toRad);
  const cosBeta = Math.cos(beta * toRad);
  const cosGamma = Math.cos(gamma * toRad);

  return a * b * c * Math.sqrt(
    1 - cosAlpha * cosAlpha - cosBeta * cosBeta - cosGamma * cosGamma
    + 2 * cosAlpha * cosBeta * cosGamma
  );
}

// ============================================================================
// BRAGG'S LAW
// ============================================================================

function braggAngle(wavelength: number, dSpacing: number, n: number = 1): number {
  // nλ = 2d sin(θ)
  const sinTheta = (n * wavelength) / (2 * dSpacing);
  if (Math.abs(sinTheta) > 1) return NaN;
  return Math.asin(sinTheta) * 180 / Math.PI;
}

function dSpacingFromAngle(wavelength: number, theta: number, n: number = 1): number {
  const thetaRad = theta * Math.PI / 180;
  return (n * wavelength) / (2 * Math.sin(thetaRad));
}

// ============================================================================
// D-SPACING FOR DIFFERENT CRYSTAL SYSTEMS
// ============================================================================

function dSpacingCubic(a: number, h: number, k: number, l: number): number {
  return a / Math.sqrt(h * h + k * k + l * l);
}

function dSpacingTetragonal(a: number, c: number, h: number, k: number, l: number): number {
  return 1 / Math.sqrt((h * h + k * k) / (a * a) + (l * l) / (c * c));
}

function dSpacingHexagonal(a: number, c: number, h: number, k: number, l: number): number {
  return 1 / Math.sqrt((4 / 3) * (h * h + h * k + k * k) / (a * a) + (l * l) / (c * c));
}

// ============================================================================
// MILLER INDICES
// ============================================================================

function millerIndices(intercepts: [number, number, number]): [number, number, number] {
  // Convert intercepts to Miller indices
  const reciprocals = intercepts.map(i => i === 0 ? Infinity : 1 / i);
  const minNonInf = Math.min(...reciprocals.filter(r => isFinite(r)).map(Math.abs));

  if (minNonInf === 0) return [0, 0, 0];

  const scaled = reciprocals.map(r => isFinite(r) ? Math.round(r / minNonInf) : 0);
  return scaled as [number, number, number];
}

function _planeSpacing(params: LatticeParams, h: number, k: number, l: number): number {
  // General formula for d-spacing
  const { a, b, c, alpha, beta, gamma } = params;

  // For cubic system (simplified)
  if (a === b && b === c && alpha === 90 && beta === 90 && gamma === 90) {
    return dSpacingCubic(a, h, k, l);
  }

  // For tetragonal
  if (a === b && alpha === 90 && beta === 90 && gamma === 90) {
    return dSpacingTetragonal(a, c, h, k, l);
  }

  // For hexagonal
  if (a === b && gamma === 120 && alpha === 90 && beta === 90) {
    return dSpacingHexagonal(a, c, h, k, l);
  }

  // Generic orthorhombic
  return 1 / Math.sqrt((h / a) ** 2 + (k / b) ** 2 + (l / c) ** 2);
}

// ============================================================================
// ATOMIC PACKING
// ============================================================================

function packingFraction(structure: string): number {
  const fractions: Record<string, number> = {
    'sc': Math.PI / 6,                           // Simple cubic: 0.524
    'bcc': Math.PI * Math.sqrt(3) / 8,           // Body-centered: 0.680
    'fcc': Math.PI * Math.sqrt(2) / 6,           // Face-centered: 0.740
    'hcp': Math.PI * Math.sqrt(2) / 6,           // Hexagonal close-packed: 0.740
    'diamond': Math.PI * Math.sqrt(3) / 16,      // Diamond: 0.340
  };
  return fractions[structure] || 0;
}

function coordNumber(structure: string): number {
  const numbers: Record<string, number> = {
    'sc': 6,
    'bcc': 8,
    'fcc': 12,
    'hcp': 12,
    'diamond': 4,
  };
  return numbers[structure] || 0;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const crystallographyTool: UnifiedTool = {
  name: 'crystallography',
  description: `Crystallography and X-ray diffraction calculations.

Operations:
- lattice: Calculate lattice parameters and volume
- bragg: Bragg's law calculations
- d_spacing: Calculate d-spacing for Miller indices
- miller: Convert intercepts to Miller indices
- packing: Atomic packing fractions`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['lattice', 'bragg', 'd_spacing', 'miller', 'packing'],
        description: 'Crystallography operation',
      },
      system: { type: 'string', enum: ['cubic', 'tetragonal', 'hexagonal', 'orthorhombic'], description: 'Crystal system' },
      a: { type: 'number', description: 'Lattice parameter a (Å)' },
      b: { type: 'number', description: 'Lattice parameter b (Å)' },
      c: { type: 'number', description: 'Lattice parameter c (Å)' },
      h: { type: 'number', description: 'Miller index h' },
      k: { type: 'number', description: 'Miller index k' },
      l: { type: 'number', description: 'Miller index l' },
      wavelength: { type: 'number', description: 'X-ray wavelength (Å)' },
      theta: { type: 'number', description: 'Bragg angle (degrees)' },
      structure: { type: 'string', enum: ['sc', 'bcc', 'fcc', 'hcp', 'diamond'], description: 'Crystal structure' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeCrystallography(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'lattice': {
        const { system = 'cubic', a = 3.5, b, c } = args;
        let params: LatticeParams;

        switch (system) {
          case 'tetragonal':
            params = tetragonalLattice(a, c || a * 1.2);
            break;
          case 'hexagonal':
            params = hexagonalLattice(a, c || a * 1.6);
            break;
          case 'orthorhombic':
            params = orthorhombicLattice(a, b || a * 1.1, c || a * 1.2);
            break;
          default:
            params = cubicLattice(a);
        }

        const volume = unitCellVolume(params);

        result = {
          operation: 'lattice',
          crystal_system: system,
          parameters: {
            a_angstrom: params.a,
            b_angstrom: params.b,
            c_angstrom: params.c,
            alpha_degrees: params.alpha,
            beta_degrees: params.beta,
            gamma_degrees: params.gamma,
          },
          volume_angstrom3: Math.round(volume * 1000) / 1000,
          volume_nm3: Math.round(volume / 1000 * 1000) / 1000,
        };
        break;
      }

      case 'bragg': {
        const { wavelength = 1.5406, theta, h = 1, k = 1, l = 1, a = 3.5 } = args;

        if (theta !== undefined) {
          const d = dSpacingFromAngle(wavelength, theta);
          result = {
            operation: 'bragg',
            mode: 'd_from_angle',
            wavelength_angstrom: wavelength,
            theta_degrees: theta,
            two_theta_degrees: 2 * theta,
            d_spacing_angstrom: Math.round(d * 10000) / 10000,
          };
        } else {
          const d = dSpacingCubic(a, h, k, l);
          const angle = braggAngle(wavelength, d);

          result = {
            operation: 'bragg',
            mode: 'angle_from_d',
            wavelength_angstrom: wavelength,
            miller_indices: { h, k, l },
            d_spacing_angstrom: Math.round(d * 10000) / 10000,
            theta_degrees: Math.round(angle * 1000) / 1000,
            two_theta_degrees: Math.round(angle * 2 * 1000) / 1000,
          };
        }
        break;
      }

      case 'd_spacing': {
        const { system = 'cubic', a = 3.5, c, h = 1, k = 1, l = 1 } = args;
        let params: LatticeParams;
        let d: number;

        switch (system) {
          case 'tetragonal':
            params = tetragonalLattice(a, c || a * 1.2);
            d = dSpacingTetragonal(a, c || a * 1.2, h, k, l);
            break;
          case 'hexagonal':
            params = hexagonalLattice(a, c || a * 1.6);
            d = dSpacingHexagonal(a, c || a * 1.6, h, k, l);
            break;
          default:
            params = cubicLattice(a);
            d = dSpacingCubic(a, h, k, l);
        }

        result = {
          operation: 'd_spacing',
          crystal_system: system,
          miller_indices: { h, k, l },
          plane_notation: `(${h}${k}${l})`,
          d_spacing_angstrom: Math.round(d * 10000) / 10000,
          lattice_parameter_a: a,
        };
        break;
      }

      case 'miller': {
        const { intercepts = [1, 2, 3] } = args;
        const indices = millerIndices(intercepts as [number, number, number]);

        result = {
          operation: 'miller',
          intercepts: {
            x: intercepts[0] || Infinity,
            y: intercepts[1] || Infinity,
            z: intercepts[2] || Infinity,
          },
          miller_indices: {
            h: indices[0],
            k: indices[1],
            l: indices[2],
          },
          notation: `(${indices[0]}${indices[1]}${indices[2]})`,
        };
        break;
      }

      case 'packing': {
        const { structure = 'fcc' } = args;
        const pf = packingFraction(structure);
        const cn = coordNumber(structure);

        result = {
          operation: 'packing',
          structure: structure.toUpperCase(),
          packing_fraction: Math.round(pf * 1000) / 1000,
          packing_percent: Math.round(pf * 10000) / 100,
          void_fraction: Math.round((1 - pf) * 1000) / 1000,
          coordination_number: cn,
          all_structures: {
            SC: { packing: 0.524, coordination: 6 },
            BCC: { packing: 0.680, coordination: 8 },
            FCC: { packing: 0.740, coordination: 12 },
            HCP: { packing: 0.740, coordination: 12 },
            Diamond: { packing: 0.340, coordination: 4 },
          },
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Crystallography Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isCrystallographyAvailable(): boolean { return true; }
