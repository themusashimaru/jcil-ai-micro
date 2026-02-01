/**
 * POLYMER CHEMISTRY TOOL
 *
 * Polymer calculations: molecular weight, viscosity,
 * polymerization kinetics, and thermal properties.
 *
 * Part of TIER CHEMISTRY - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// MOLECULAR WEIGHT AVERAGES
// ============================================================================

function _numberAverageMW(ni: number[], Mi: number[]): number {
  // Mn = Σ(ni × Mi) / Σ(ni)
  const sumNiMi = ni.reduce((acc, n, i) => acc + n * Mi[i], 0);
  const sumNi = ni.reduce((a, b) => a + b, 0);
  return sumNiMi / sumNi;
}

function _weightAverageMW(wi: number[], Mi: number[]): number {
  // Mw = Σ(wi × Mi) / Σ(wi)
  const sumWiMi = wi.reduce((acc, w, i) => acc + w * Mi[i], 0);
  const sumWi = wi.reduce((a, b) => a + b, 0);
  return sumWiMi / sumWi;
}

function polydispersityIndex(Mw: number, Mn: number): number {
  // PDI = Mw / Mn
  return Mw / Mn;
}

function degreeOfPolymerization(Mn: number, M0: number): number {
  // DPn = Mn / M0
  return Mn / M0;
}

// ============================================================================
// POLYMERIZATION KINETICS
// ============================================================================

function stepGrowthConversion(t: number, k: number, c0: number): number {
  // p = 1 - 1/(1 + k×c0×t)
  return 1 - 1 / (1 + k * c0 * t);
}

function stepGrowthDP(p: number): number {
  // DPn = 1/(1-p) for step growth
  return 1 / (1 - p);
}

function _carothersEquation(p: number, f: number = 2): number {
  // DPn = 2 / (2 - p×f) for functionality f
  return 2 / (2 - p * f);
}

function gelPoint(favg: number): number {
  // pc = 2 / favg for gelation
  return 2 / favg;
}

// ============================================================================
// VISCOSITY
// ============================================================================

function intrinsicViscosity(K: number, a: number, M: number): number {
  // [η] = K × M^a (Mark-Houwink equation)
  return K * Math.pow(M, a);
}

function _specificViscosity(eta: number, eta0: number): number {
  return (eta - eta0) / eta0;
}

function _reducedViscosity(etasp: number, c: number): number {
  return etasp / c;
}

function _inherentViscosity(eta: number, eta0: number, c: number): number {
  return Math.log(eta / eta0) / c;
}

// ============================================================================
// THERMAL PROPERTIES
// ============================================================================

function _glassTrans(Tg1: number, w1: number, Tg2: number, w2: number): number {
  // Fox equation: 1/Tg = w1/Tg1 + w2/Tg2
  return 1 / (w1 / Tg1 + w2 / Tg2);
}

function freeVolume(T: number, Tg: number, alphaL: number = 4.8e-4, alphag: number = 2e-4): number {
  // vf = fg + (αL - αg)(T - Tg)
  const fg = 0.025; // Universal constant ~2.5%
  if (T < Tg) return fg;
  return fg + (alphaL - alphag) * (T - Tg);
}

// ============================================================================
// CHAIN STATISTICS
// ============================================================================

function endToEndDistance(n: number, l: number): number {
  // <r²>^0.5 = l × √n for freely jointed chain
  return l * Math.sqrt(n);
}

function radiusOfGyration(n: number, l: number): number {
  // Rg = l × √(n/6)
  return l * Math.sqrt(n / 6);
}

function _persistenceLength(Lp: number, L: number): { type: string; ratio: number } {
  const ratio = L / Lp;
  let type = 'Flexible coil';
  if (ratio < 1) type = 'Rigid rod';
  else if (ratio < 10) type = 'Semi-flexible';

  return { type, ratio };
}

// ============================================================================
// COMMON POLYMERS
// ============================================================================

const POLYMERS: Record<string, { M0: number; Tg: number; Tm: number; name: string }> = {
  PE: { M0: 28, Tg: -125, Tm: 135, name: 'Polyethylene' },
  PP: { M0: 42, Tg: -10, Tm: 165, name: 'Polypropylene' },
  PS: { M0: 104, Tg: 100, Tm: 240, name: 'Polystyrene' },
  PMMA: { M0: 100, Tg: 105, Tm: 160, name: 'Poly(methyl methacrylate)' },
  PVC: { M0: 62.5, Tg: 80, Tm: 212, name: 'Poly(vinyl chloride)' },
  PTFE: { M0: 100, Tg: -73, Tm: 327, name: 'Polytetrafluoroethylene' },
  Nylon6: { M0: 113, Tg: 50, Tm: 220, name: 'Nylon 6' },
  PET: { M0: 192, Tg: 70, Tm: 260, name: 'Polyethylene terephthalate' },
};

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const polymerChemistryTool: UnifiedTool = {
  name: 'polymer_chemistry',
  description: `Polymer chemistry calculations.

Operations:
- molecular_weight: MW averages and polydispersity
- kinetics: Polymerization kinetics and conversion
- viscosity: Intrinsic and solution viscosity
- thermal: Glass transition and thermal properties
- chain: Chain statistics and dimensions
- lookup: Common polymer properties`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['molecular_weight', 'kinetics', 'viscosity', 'thermal', 'chain', 'lookup'],
        description: 'Polymer operation',
      },
      Mn: { type: 'number', description: 'Number average MW (g/mol)' },
      Mw: { type: 'number', description: 'Weight average MW (g/mol)' },
      M0: { type: 'number', description: 'Monomer molecular weight (g/mol)' },
      conversion: { type: 'number', description: 'Conversion (0-1)' },
      time: { type: 'number', description: 'Reaction time (s)' },
      rate_constant: { type: 'number', description: 'Rate constant' },
      concentration: { type: 'number', description: 'Concentration (mol/L)' },
      K: { type: 'number', description: 'Mark-Houwink K constant' },
      a: { type: 'number', description: 'Mark-Houwink a exponent' },
      Tg: { type: 'number', description: 'Glass transition temperature (K)' },
      temperature: { type: 'number', description: 'Temperature (K)' },
      chain_length: { type: 'number', description: 'Number of repeat units' },
      bond_length: { type: 'number', description: 'Bond length (nm)' },
      polymer: { type: 'string', description: 'Polymer abbreviation (PE, PS, etc.)' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executePolymerChemistry(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'molecular_weight': {
        const { Mn = 50000, Mw = 100000, M0 = 100 } = args;
        const PDI = polydispersityIndex(Mw, Mn);
        const DPn = degreeOfPolymerization(Mn, M0);
        const DPw = degreeOfPolymerization(Mw, M0);

        result = {
          operation: 'molecular_weight',
          number_average_Mn: Mn,
          weight_average_Mw: Mw,
          monomer_MW: M0,
          polydispersity_index: Math.round(PDI * 1000) / 1000,
          degree_of_polymerization: {
            DPn: Math.round(DPn),
            DPw: Math.round(DPw),
          },
          distribution: PDI < 1.1 ? 'Very narrow (living polymerization)' :
                        PDI < 1.5 ? 'Narrow (anionic)' :
                        PDI < 2.5 ? 'Typical (radical/step)' : 'Broad',
        };
        break;
      }

      case 'kinetics': {
        const { conversion, time, rate_constant = 0.01, concentration = 1 } = args;

        if (conversion !== undefined) {
          const DP = stepGrowthDP(conversion);
          const gel = gelPoint(2.5); // Assume some functionality

          result = {
            operation: 'kinetics',
            mode: 'from_conversion',
            conversion: conversion,
            degree_of_polymerization: Math.round(DP * 10) / 10,
            Mn_relative: DP,
            gel_point_pc: Math.round(gel * 1000) / 1000,
            note: conversion > gel ? 'Past gel point - network formed' : 'Before gel point',
          };
        } else if (time !== undefined) {
          const p = stepGrowthConversion(time, rate_constant, concentration);
          const DP = stepGrowthDP(p);

          result = {
            operation: 'kinetics',
            mode: 'from_time',
            time_s: time,
            rate_constant: rate_constant,
            initial_concentration: concentration,
            conversion: Math.round(p * 10000) / 10000,
            degree_of_polymerization: Math.round(DP * 10) / 10,
          };
        } else {
          throw new Error('Provide conversion or time');
        }
        break;
      }

      case 'viscosity': {
        const { Mn = 100000, K = 1.7e-4, a = 0.74 } = args;
        const intrinsic = intrinsicViscosity(K, a, Mn);

        result = {
          operation: 'viscosity',
          molecular_weight: Mn,
          mark_houwink: {
            K: K,
            a: a,
            polymer_solvent: 'Typical values for PS in toluene',
          },
          intrinsic_viscosity_dL_g: Math.round(intrinsic * 1000) / 1000,
          theta_solvent: a === 0.5,
          good_solvent: a > 0.5,
          exponent_meaning: {
            '0.5': 'Theta solvent (ideal)',
            '0.6-0.8': 'Good solvent (expanded coil)',
            '0.8+': 'Very good solvent',
          },
        };
        break;
      }

      case 'thermal': {
        const { Tg = 373, temperature = 400 } = args;
        const fv = freeVolume(temperature, Tg);
        const TgC = Tg - 273;

        result = {
          operation: 'thermal',
          glass_transition: {
            Tg_K: Tg,
            Tg_C: TgC,
          },
          temperature_K: temperature,
          temperature_C: temperature - 273,
          state: temperature > Tg ? 'Rubbery/Melt' : 'Glassy',
          free_volume_fraction: Math.round(fv * 10000) / 10000,
          mobility: temperature > Tg ? 'High (segmental motion)' : 'Low (frozen)',
          WLF_applicable: temperature > Tg && temperature < Tg + 100,
        };
        break;
      }

      case 'chain': {
        const { chain_length = 1000, bond_length = 0.154 } = args;
        const r = endToEndDistance(chain_length, bond_length);
        const Rg = radiusOfGyration(chain_length, bond_length);
        const contourLength = chain_length * bond_length;

        result = {
          operation: 'chain',
          repeat_units: chain_length,
          bond_length_nm: bond_length,
          contour_length_nm: Math.round(contourLength * 100) / 100,
          end_to_end_distance_nm: Math.round(r * 100) / 100,
          radius_of_gyration_nm: Math.round(Rg * 100) / 100,
          r_over_Rg: Math.round(r / Rg * 100) / 100,
          ideal_ratio: Math.sqrt(6),
          model: 'Freely-jointed chain (Gaussian)',
        };
        break;
      }

      case 'lookup': {
        const { polymer = 'PS' } = args;
        const poly = POLYMERS[polymer.toUpperCase()];

        if (poly) {
          result = {
            operation: 'lookup',
            abbreviation: polymer.toUpperCase(),
            full_name: poly.name,
            monomer_MW_g_mol: poly.M0,
            glass_transition_Tg_C: poly.Tg,
            melting_point_Tm_C: poly.Tm,
            Tg_K: poly.Tg + 273,
            Tm_K: poly.Tm + 273,
          };
        } else {
          result = {
            operation: 'lookup',
            polymer: polymer,
            found: false,
            available: Object.entries(POLYMERS).map(([abbr, info]) => ({
              abbreviation: abbr,
              name: info.name,
            })),
          };
        }
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Polymer Chemistry Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isPolymerChemistryAvailable(): boolean { return true; }
