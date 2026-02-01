// ============================================================================
// ANTENNA RF TOOL - TIER BEYOND
// ============================================================================
// RF and antenna calculations: radiation patterns, link budget, impedance.
// Pure TypeScript implementation - no external dependencies.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const C = 299792458; // Speed of light m/s

// Wavelength from frequency
function wavelength(freq: number): number {
  return C / freq;
}

// Dipole length (half-wave)
function halfWaveDipoleLength(freq: number): number {
  return wavelength(freq) / 2;
}

// Free space path loss: FSPL = 20*log10(d) + 20*log10(f) + 20*log10(4π/c)
function freeSpacePathLoss(distance: number, freq: number): number {
  return 20 * Math.log10(distance) + 20 * Math.log10(freq) + 20 * Math.log10((4 * Math.PI) / C);
}

// Link budget: Pr = Pt + Gt + Gr - FSPL - losses
function linkBudget(
  ptDbm: number,
  gtDbi: number,
  grDbi: number,
  fsplDb: number,
  lossesDb: number
): number {
  return ptDbm + gtDbi + grDbi - fsplDb - lossesDb;
}

// Friis transmission: Pr/Pt = Gt*Gr*(λ/4πd)²
function friisRatio(gtLinear: number, grLinear: number, wl: number, distance: number): number {
  return gtLinear * grLinear * Math.pow(wl / (4 * Math.PI * distance), 2);
}

// dBm to Watts
function dbmToWatts(dbm: number): number {
  return Math.pow(10, (dbm - 30) / 10);
}
function wattsToDbm(watts: number): number {
  return 10 * Math.log10(watts) + 30;
}

// dBi to linear
function dbiToLinear(dbi: number): number {
  return Math.pow(10, dbi / 10);
}

// EIRP
function eirp(ptDbm: number, gtDbi: number): number {
  return ptDbm + gtDbi;
}

// Noise floor: kTB
function noiseFloor(tempK: number, bandwidthHz: number): number {
  const k = 1.38e-23; // Boltzmann
  return wattsToDbm(k * tempK * bandwidthHz);
}

// Impedance matching - reflection coefficient
function reflectionCoeff(zLoad: number, z0: number): number {
  return (zLoad - z0) / (zLoad + z0);
}

// VSWR from reflection coefficient
function vswr(gamma: number): number {
  const g = Math.abs(gamma);
  return (1 + g) / (1 - g);
}

// Return loss from VSWR
function returnLoss(vswrVal: number): number {
  return -20 * Math.log10((vswrVal - 1) / (vswrVal + 1));
}

const ANTENNA_TYPES: Record<string, { gain_dbi: number; pattern: string }> = {
  isotropic: { gain_dbi: 0, pattern: 'omnidirectional' },
  dipole_half_wave: { gain_dbi: 2.15, pattern: 'omnidirectional (donut)' },
  monopole_quarter_wave: { gain_dbi: 5.15, pattern: 'omnidirectional' },
  yagi_3el: { gain_dbi: 7, pattern: 'directional' },
  yagi_5el: { gain_dbi: 10, pattern: 'directional' },
  parabolic_1m: { gain_dbi: 30, pattern: 'highly directional' },
  patch: { gain_dbi: 6, pattern: 'hemispherical' },
  helical: { gain_dbi: 12, pattern: 'directional, circular polarization' },
};

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const antennaRfTool: UnifiedTool = {
  name: 'antenna_rf',
  description: `RF and antenna engineering: link budgets, path loss, impedance.`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'wavelength',
          'dipole',
          'path_loss',
          'link_budget',
          'friis',
          'impedance',
          'noise',
          'antennas',
        ],
        description: 'RF calculation to perform',
      },
      frequency: { type: 'number', description: 'Frequency in Hz' },
      frequency_mhz: { type: 'number', description: 'Frequency in MHz' },
      frequency_ghz: { type: 'number', description: 'Frequency in GHz' },
      distance: { type: 'number', description: 'Distance in meters' },
      distance_km: { type: 'number', description: 'Distance in km' },
      tx_power_dbm: { type: 'number', description: 'Transmit power in dBm' },
      tx_power_watts: { type: 'number', description: 'Transmit power in Watts' },
      tx_gain_dbi: { type: 'number', description: 'Transmit antenna gain in dBi' },
      rx_gain_dbi: { type: 'number', description: 'Receive antenna gain in dBi' },
      losses_db: { type: 'number', description: 'Additional losses in dB' },
      z_load: { type: 'number', description: 'Load impedance in Ohms' },
      z0: { type: 'number', description: 'Characteristic impedance in Ohms' },
      bandwidth_hz: { type: 'number', description: 'Bandwidth in Hz' },
      temperature_k: { type: 'number', description: 'Temperature in Kelvin' },
      antenna_type: { type: 'string', description: 'Antenna type' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeAntennaRf(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    // Normalize frequency to Hz
    let freq = args.frequency || 0;
    if (args.frequency_mhz) freq = args.frequency_mhz * 1e6;
    if (args.frequency_ghz) freq = args.frequency_ghz * 1e9;
    if (!freq) freq = 2.4e9; // Default 2.4 GHz

    // Normalize distance to meters
    let dist = args.distance || 0;
    if (args.distance_km) dist = args.distance_km * 1000;

    // Normalize power to dBm
    let ptDbm = args.tx_power_dbm || 0;
    if (args.tx_power_watts) ptDbm = wattsToDbm(args.tx_power_watts);

    let result: Record<string, unknown>;

    switch (operation) {
      case 'wavelength': {
        const lambda = wavelength(freq);
        result = {
          operation: 'wavelength',
          frequency_hz: freq,
          frequency_mhz: +(freq / 1e6).toFixed(2),
          frequency_ghz: +(freq / 1e9).toFixed(4),
          wavelength_m: +lambda.toFixed(4),
          wavelength_cm: +(lambda * 100).toFixed(2),
        };
        break;
      }
      case 'dipole': {
        const halfWave = halfWaveDipoleLength(freq);
        result = {
          operation: 'dipole',
          frequency_mhz: +(freq / 1e6).toFixed(2),
          half_wave_length_m: +halfWave.toFixed(4),
          half_wave_length_cm: +(halfWave * 100).toFixed(2),
          quarter_wave_m: +(halfWave / 2).toFixed(4),
          typical_gain_dbi: 2.15,
        };
        break;
      }
      case 'path_loss': {
        if (!dist) throw new Error('path_loss requires distance');
        const fspl = freeSpacePathLoss(dist, freq);
        result = {
          operation: 'path_loss',
          frequency_ghz: +(freq / 1e9).toFixed(3),
          distance_m: dist,
          distance_km: +(dist / 1000).toFixed(3),
          free_space_path_loss_db: +fspl.toFixed(2),
        };
        break;
      }
      case 'link_budget': {
        if (!dist) throw new Error('link_budget requires distance');
        const gtDbi = args.tx_gain_dbi || 0;
        const grDbi = args.rx_gain_dbi || 0;
        const losses = args.losses_db || 0;
        const fspl = freeSpacePathLoss(dist, freq);
        const rxPower = linkBudget(ptDbm, gtDbi, grDbi, fspl, losses);
        const eirpVal = eirp(ptDbm, gtDbi);

        result = {
          operation: 'link_budget',
          inputs: {
            tx_power_dbm: ptDbm,
            tx_gain_dbi: gtDbi,
            rx_gain_dbi: grDbi,
            distance_km: +(dist / 1000).toFixed(2),
            frequency_ghz: +(freq / 1e9).toFixed(3),
          },
          results: {
            eirp_dbm: +eirpVal.toFixed(2),
            free_space_path_loss_db: +fspl.toFixed(2),
            received_power_dbm: +rxPower.toFixed(2),
            received_power_watts: +dbmToWatts(rxPower).toExponential(3),
          },
        };
        break;
      }
      case 'friis': {
        if (!dist) throw new Error('friis requires distance');
        const gt = dbiToLinear(args.tx_gain_dbi || 0);
        const gr = dbiToLinear(args.rx_gain_dbi || 0);
        const lambda = wavelength(freq);
        const ratio = friisRatio(gt, gr, lambda, dist);
        const prDbm = ptDbm + 10 * Math.log10(ratio);
        result = {
          operation: 'friis',
          power_ratio: +ratio.toExponential(4),
          power_ratio_db: +(10 * Math.log10(ratio)).toFixed(2),
          received_power_dbm: +prDbm.toFixed(2),
        };
        break;
      }
      case 'impedance': {
        const zLoad = args.z_load || 75;
        const z0 = args.z0 || 50;
        const gamma = reflectionCoeff(zLoad, z0);
        const vswr_val = vswr(gamma);
        const rl = returnLoss(vswr_val);
        result = {
          operation: 'impedance',
          z_load: zLoad,
          z0,
          reflection_coefficient: +gamma.toFixed(4),
          vswr: +vswr_val.toFixed(2),
          return_loss_db: +rl.toFixed(2),
          mismatch_loss_db: +(-10 * Math.log10(1 - gamma * gamma)).toFixed(2),
          matched: vswr_val < 1.5,
        };
        break;
      }
      case 'noise': {
        const T = args.temperature_k || 290;
        const BW = args.bandwidth_hz || 1e6;
        const nf = noiseFloor(T, BW);
        result = {
          operation: 'noise',
          temperature_k: T,
          bandwidth_hz: BW,
          thermal_noise_floor_dbm: +nf.toFixed(2),
          thermal_noise_watts: +dbmToWatts(nf).toExponential(3),
        };
        break;
      }
      case 'antennas': {
        result = {
          operation: 'antennas',
          available: Object.entries(ANTENNA_TYPES).map(([k, v]) => ({ type: k, ...v })),
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

export function isAntennaRfAvailable(): boolean {
  return true;
}
