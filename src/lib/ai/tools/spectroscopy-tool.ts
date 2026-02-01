/**
 * SPECTROSCOPY TOOL
 *
 * Spectroscopy calculations: Beer-Lambert law, IR/NMR analysis,
 * mass spectrometry, UV-Vis.
 *
 * Part of TIER CHEMISTRY - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// BEER-LAMBERT LAW
// ============================================================================

function beerLambert(epsilon: number, c: number, l: number): { absorbance: number; transmittance: number } {
  const A = epsilon * c * l;
  const T = Math.pow(10, -A);
  return { absorbance: A, transmittance: T };
}

function concentrationFromAbsorbance(A: number, epsilon: number, l: number): number {
  return A / (epsilon * l);
}

// ============================================================================
// IR SPECTROSCOPY
// ============================================================================

const IR_PEAKS: Record<string, { range: string; description: string }> = {
  'O-H_alcohol': { range: '3200-3550 cm⁻¹', description: 'Broad, strong (H-bonded)' },
  'O-H_acid': { range: '2500-3300 cm⁻¹', description: 'Very broad' },
  'N-H': { range: '3300-3500 cm⁻¹', description: 'Medium, 1 or 2 bands' },
  'C-H_alkane': { range: '2850-3000 cm⁻¹', description: 'Strong, saturated' },
  'C-H_alkene': { range: '3000-3100 cm⁻¹', description: '=C-H stretch' },
  'C-H_alkyne': { range: '3300 cm⁻¹', description: '≡C-H stretch' },
  'C-H_aldehyde': { range: '2700-2850 cm⁻¹', description: 'Two weak bands' },
  'C=O_aldehyde': { range: '1720-1740 cm⁻¹', description: 'Strong' },
  'C=O_ketone': { range: '1705-1725 cm⁻¹', description: 'Strong' },
  'C=O_acid': { range: '1700-1725 cm⁻¹', description: 'Strong' },
  'C=O_ester': { range: '1735-1750 cm⁻¹', description: 'Strong' },
  'C=O_amide': { range: '1630-1690 cm⁻¹', description: 'Strong' },
  'C=C_alkene': { range: '1620-1680 cm⁻¹', description: 'Variable' },
  'C≡C': { range: '2100-2260 cm⁻¹', description: 'Weak to medium' },
  'C≡N': { range: '2210-2260 cm⁻¹', description: 'Medium' },
  'C-O': { range: '1000-1300 cm⁻¹', description: 'Strong' },
  'C-N': { range: '1180-1360 cm⁻¹', description: 'Medium' },
  'N-O_nitro': { range: '1515-1560 cm⁻¹', description: 'Two strong bands' },
};

// ============================================================================
// NMR SPECTROSCOPY
// ============================================================================

const NMR_SHIFTS: Record<string, { shift: string; description: string }> = {
  'R-CH3': { shift: '0.7-1.3 ppm', description: 'Methyl group' },
  'R-CH2-R': { shift: '1.2-1.4 ppm', description: 'Methylene' },
  'R3C-H': { shift: '1.4-1.7 ppm', description: 'Methine' },
  'C=C-CH3': { shift: '1.6-2.0 ppm', description: 'Allylic' },
  'C≡C-H': { shift: '2.0-3.0 ppm', description: 'Alkyne' },
  'N-CH3': { shift: '2.2-2.9 ppm', description: 'N-methyl' },
  'O-CH3': { shift: '3.3-3.9 ppm', description: 'Methoxy' },
  'Cl-CH': { shift: '3.0-4.0 ppm', description: 'Chloro' },
  'Br-CH': { shift: '2.5-4.0 ppm', description: 'Bromo' },
  'C=C-H': { shift: '4.5-6.5 ppm', description: 'Vinylic' },
  'Ar-H': { shift: '6.5-8.0 ppm', description: 'Aromatic' },
  'CHO': { shift: '9.0-10.0 ppm', description: 'Aldehyde' },
  'COOH': { shift: '10.5-12.0 ppm', description: 'Carboxylic acid' },
};

// ============================================================================
// MASS SPECTROMETRY
// ============================================================================

interface MassFragment {
  mz: number;
  formula: string;
  loss: string;
}

const COMMON_LOSSES: { loss: number; formula: string; name: string }[] = [
  { loss: 1, formula: 'H', name: 'Hydrogen' },
  { loss: 15, formula: 'CH₃', name: 'Methyl' },
  { loss: 17, formula: 'OH', name: 'Hydroxyl' },
  { loss: 18, formula: 'H₂O', name: 'Water' },
  { loss: 28, formula: 'CO', name: 'Carbon monoxide' },
  { loss: 29, formula: 'CHO', name: 'Formyl' },
  { loss: 31, formula: 'OCH₃', name: 'Methoxy' },
  { loss: 43, formula: 'CH₃CO', name: 'Acetyl' },
  { loss: 44, formula: 'CO₂', name: 'Carbon dioxide' },
  { loss: 45, formula: 'OC₂H₅', name: 'Ethoxy' },
  { loss: 46, formula: 'NO₂', name: 'Nitro' },
];

function predictFragments(mw: number): MassFragment[] {
  const fragments: MassFragment[] = [{ mz: mw, formula: 'M⁺', loss: 'Molecular ion' }];

  for (const l of COMMON_LOSSES) {
    if (mw - l.loss > 0) {
      fragments.push({ mz: mw - l.loss, formula: `[M-${l.formula}]⁺`, loss: l.name });
    }
  }

  return fragments;
}

// ============================================================================
// WAVELENGTH/FREQUENCY CONVERSIONS
// ============================================================================

const c = 2.998e8; // Speed of light (m/s)
const h = 6.626e-34; // Planck's constant (J·s)

function wavelengthToFrequency(lambda: number): number {
  return c / lambda;
}

function wavelengthToEnergy(lambda: number): number {
  return h * c / lambda;
}

function wavenumberToWavelength(wavenumber: number): number {
  return 1e7 / wavenumber; // cm⁻¹ to nm
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const spectroscopyTool: UnifiedTool = {
  name: 'spectroscopy',
  description: `Spectroscopy analysis and calculations.

Operations:
- beer_lambert: Calculate absorbance/transmittance
- ir_peaks: Look up IR absorption peaks
- nmr_shifts: Look up ¹H NMR chemical shifts
- mass_spec: Predict mass spectrometry fragments
- wavelength_convert: Convert between wavelength, frequency, energy`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['beer_lambert', 'ir_peaks', 'nmr_shifts', 'mass_spec', 'wavelength_convert'],
        description: 'Spectroscopy operation',
      },
      epsilon: { type: 'number', description: 'Molar absorptivity (L/(mol·cm))' },
      concentration: { type: 'number', description: 'Concentration (M)' },
      path_length: { type: 'number', description: 'Path length (cm)' },
      absorbance: { type: 'number', description: 'Absorbance' },
      functional_group: { type: 'string', description: 'Functional group for IR/NMR' },
      molecular_weight: { type: 'number', description: 'Molecular weight for MS' },
      wavelength: { type: 'number', description: 'Wavelength (m or nm)' },
      wavenumber: { type: 'number', description: 'Wavenumber (cm⁻¹)' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeSpectroscopy(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'beer_lambert': {
        if (args.absorbance) {
          const { absorbance, epsilon = 1000, path_length = 1 } = args;
          const conc = concentrationFromAbsorbance(absorbance, epsilon, path_length);
          result = {
            operation: 'beer_lambert',
            mode: 'calculate_concentration',
            absorbance,
            epsilon,
            path_length_cm: path_length,
            concentration_M: conc.toExponential(4),
          };
        } else {
          const { epsilon = 1000, concentration = 0.0001, path_length = 1 } = args;
          const data = beerLambert(epsilon, concentration, path_length);
          result = {
            operation: 'beer_lambert',
            mode: 'calculate_absorbance',
            epsilon,
            concentration_M: concentration,
            path_length_cm: path_length,
            absorbance: Math.round(data.absorbance * 10000) / 10000,
            transmittance: Math.round(data.transmittance * 10000) / 10000,
            percent_transmittance: Math.round(data.transmittance * 10000) / 100 + '%',
          };
        }
        break;
      }

      case 'ir_peaks': {
        const group = args.functional_group;
        if (group && IR_PEAKS[group]) {
          result = { operation: 'ir_peaks', functional_group: group, ...IR_PEAKS[group] };
        } else {
          result = {
            operation: 'ir_peaks',
            available_groups: Object.keys(IR_PEAKS),
            table: Object.entries(IR_PEAKS).map(([name, data]) => ({ group: name, ...data })),
          };
        }
        break;
      }

      case 'nmr_shifts': {
        const group = args.functional_group;
        if (group && NMR_SHIFTS[group]) {
          result = { operation: 'nmr_shifts', proton_type: group, ...NMR_SHIFTS[group] };
        } else {
          result = {
            operation: 'nmr_shifts',
            available_types: Object.keys(NMR_SHIFTS),
            table: Object.entries(NMR_SHIFTS).map(([name, data]) => ({ proton: name, ...data })),
          };
        }
        break;
      }

      case 'mass_spec': {
        const { molecular_weight = 120 } = args;
        const fragments = predictFragments(molecular_weight);
        result = {
          operation: 'mass_spec',
          molecular_weight: molecular_weight,
          predicted_fragments: fragments,
          common_losses: COMMON_LOSSES,
        };
        break;
      }

      case 'wavelength_convert': {
        const { wavelength, wavenumber } = args;
        if (wavelength) {
          const lambda = wavelength < 1e-3 ? wavelength : wavelength * 1e-9;
          const freq = wavelengthToFrequency(lambda);
          const energy = wavelengthToEnergy(lambda);
          result = {
            operation: 'wavelength_convert',
            wavelength_m: lambda,
            wavelength_nm: lambda * 1e9,
            frequency_Hz: freq.toExponential(4),
            energy_J: energy.toExponential(4),
            energy_eV: (energy / 1.602e-19).toFixed(4),
            wavenumber_cm: (1e-2 / lambda).toFixed(0),
          };
        } else if (wavenumber) {
          const lambdaNm = wavenumberToWavelength(wavenumber);
          result = {
            operation: 'wavelength_convert',
            wavenumber_cm: wavenumber,
            wavelength_nm: Math.round(lambdaNm * 100) / 100,
            wavelength_um: Math.round(lambdaNm / 10) / 100,
          };
        } else {
          result = { operation: 'wavelength_convert', error: 'Provide wavelength or wavenumber' };
        }
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Spectroscopy Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isSpectroscopyAvailable(): boolean { return true; }
