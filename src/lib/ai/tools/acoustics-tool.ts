// ============================================================================
// ACOUSTICS TOOL - TIER BEYOND
// ============================================================================
// Sound and acoustics: room modes, speaker design, sound propagation.
// Pure TypeScript implementation - no external dependencies.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const SPEED_OF_SOUND = 343; // m/s at 20°C

// Speed of sound with temperature: c = 331.3 * sqrt(1 + T/273.15)
function speedOfSound(tempC: number): number {
  return 331.3 * Math.sqrt(1 + tempC / 273.15);
}

// Wavelength: λ = c / f
function wavelength(freq: number, c: number = SPEED_OF_SOUND): number {
  return c / freq;
}

// Room modes: f = c/2 * sqrt((nx/Lx)² + (ny/Ly)² + (nz/Lz)²)
function roomMode(
  nx: number,
  ny: number,
  nz: number,
  lx: number,
  ly: number,
  lz: number,
  c: number = SPEED_OF_SOUND
): number {
  return (c / 2) * Math.sqrt(Math.pow(nx / lx, 2) + Math.pow(ny / ly, 2) + Math.pow(nz / lz, 2));
}

// Calculate all room modes up to a frequency
function allRoomModes(
  lx: number,
  ly: number,
  lz: number,
  maxFreq: number,
  c: number = SPEED_OF_SOUND
): { freq: number; mode: string; type: string }[] {
  const modes: { freq: number; mode: string; type: string }[] = [];
  const maxN = Math.ceil((2 * maxFreq * Math.max(lx, ly, lz)) / c);

  for (let nx = 0; nx <= maxN; nx++) {
    for (let ny = 0; ny <= maxN; ny++) {
      for (let nz = 0; nz <= maxN; nz++) {
        if (nx === 0 && ny === 0 && nz === 0) continue;
        const f = roomMode(nx, ny, nz, lx, ly, lz, c);
        if (f <= maxFreq) {
          const nonzero = [nx, ny, nz].filter((n) => n > 0).length;
          const type = nonzero === 1 ? 'axial' : nonzero === 2 ? 'tangential' : 'oblique';
          modes.push({ freq: +f.toFixed(1), mode: `(${nx},${ny},${nz})`, type });
        }
      }
    }
  }

  return modes.sort((a, b) => a.freq - b.freq);
}

// Schroeder frequency (transition to diffuse field)
function schroederFrequency(volume: number, rt60: number): number {
  return 2000 * Math.sqrt(rt60 / volume);
}

// RT60 Sabine equation: RT60 = 0.161 * V / A
function sabineRT60(volume: number, absorptionArea: number): number {
  return (0.161 * volume) / absorptionArea;
}

// Inverse square law: SPL = SPL_ref - 20*log10(d/d_ref)
function splAtDistance(splRef: number, dRef: number, d: number): number {
  return splRef - 20 * Math.log10(d / dRef);
}

// Add SPL levels: SPL_total = 10*log10(sum(10^(SPL_i/10)))
function addSPLs(spls: number[]): number {
  const sum = spls.reduce((s, spl) => s + Math.pow(10, spl / 10), 0);
  return 10 * Math.log10(sum);
}

// Speaker box volume (sealed): Vas / Vb = (fc/fs)² - 1, Qtc
function sealedBoxVolume(vas: number, _fs: number, qts: number, targetQtc: number = 0.707): number {
  // _fs is available for extended calculations
  void _fs;
  const ratio = Math.pow(targetQtc / qts, 2) - 1;
  return vas / ratio;
}

// Speaker cutoff frequency in sealed box
function sealedCutoff(fs: number, _qts: number, vas: number, vb: number): number {
  return fs * Math.sqrt((vas + vb) / vb);
}

// Ported box tuning frequency
function portedTuning(fs: number, _qts: number): number {
  return fs * 0.9;
}

const MATERIALS: Record<string, number> = {
  concrete: 0.02,
  brick: 0.03,
  plaster: 0.04,
  glass: 0.03,
  wood_floor: 0.1,
  carpet_heavy: 0.5,
  curtains_heavy: 0.6,
  acoustic_tile: 0.7,
  foam: 0.8,
  fiberglass: 0.9,
};

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const acousticsTool: UnifiedTool = {
  name: 'acoustics',
  description: `Acoustics: room modes, reverb time, speaker design, sound levels.`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'room_modes',
          'rt60',
          'distance',
          'add_spl',
          'speaker_box',
          'wavelength',
          'materials',
        ],
        description: 'Acoustics calculation to perform',
      },
      length: { type: 'number', description: 'Room length (m)' },
      width: { type: 'number', description: 'Room width (m)' },
      height: { type: 'number', description: 'Room height (m)' },
      volume: { type: 'number', description: 'Room volume (m^3)' },
      absorption_area: { type: 'number', description: 'Total absorption area (m^2)' },
      max_frequency: { type: 'number', description: 'Maximum frequency for mode calculation' },
      temperature: { type: 'number', description: 'Temperature (C)' },
      spl_ref: { type: 'number', description: 'Reference SPL (dB)' },
      distance_ref: { type: 'number', description: 'Reference distance (m)' },
      distance: { type: 'number', description: 'Target distance (m)' },
      spls: {
        type: 'array',
        items: { type: 'number' },
        description: 'Array of SPL values to add',
      },
      frequency: { type: 'number', description: 'Frequency in Hz' },
      vas: { type: 'number', description: 'Speaker Vas (liters)' },
      fs: { type: 'number', description: 'Speaker resonance frequency (Hz)' },
      qts: { type: 'number', description: 'Speaker Qts' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeAcoustics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;
    const temp = args.temperature ?? 20;
    const c = speedOfSound(temp);

    let result: Record<string, unknown>;

    switch (operation) {
      case 'room_modes': {
        const { length, width, height, max_frequency } = args;
        if (!length || !width || !height)
          throw new Error('room_modes requires length, width, height');
        const maxF = max_frequency || 300;
        const modes = allRoomModes(length, width, height, maxF, c);
        const vol = length * width * height;
        const schroeder = schroederFrequency(vol, 0.5); // Assume RT60 = 0.5s

        result = {
          operation: 'room_modes',
          dimensions: { length, width, height },
          volume_m3: +vol.toFixed(1),
          speed_of_sound_m_s: +c.toFixed(1),
          schroeder_frequency_hz: +schroeder.toFixed(0),
          modes_below_schroeder: modes.filter((m) => m.freq < schroeder).length,
          first_10_modes: modes.slice(0, 10),
          total_modes_found: modes.length,
        };
        break;
      }
      case 'rt60': {
        let vol = args.volume;
        if (!vol && args.length && args.width && args.height) {
          vol = args.length * args.width * args.height;
        }
        if (!vol) throw new Error('rt60 requires volume or dimensions');
        const A = args.absorption_area || vol * 0.1; // Default 10% absorption
        const rt60 = sabineRT60(vol, A);
        result = {
          operation: 'rt60',
          volume_m3: vol,
          absorption_area_m2: A,
          rt60_seconds: +rt60.toFixed(2),
          room_type:
            rt60 < 0.5 ? 'dead' : rt60 < 1 ? 'controlled' : rt60 < 2 ? 'live' : 'very reverberant',
        };
        break;
      }
      case 'distance': {
        const { spl_ref, distance_ref, distance } = args;
        if (spl_ref === undefined || !distance_ref || !distance)
          throw new Error('distance requires spl_ref, distance_ref, distance');
        const spl = splAtDistance(spl_ref, distance_ref, distance);
        result = {
          operation: 'distance',
          reference_spl_db: spl_ref,
          reference_distance_m: distance_ref,
          target_distance_m: distance,
          spl_at_target_db: +spl.toFixed(1),
          level_change_db: +(spl - spl_ref).toFixed(1),
        };
        break;
      }
      case 'add_spl': {
        const spls = args.spls || [80, 80];
        const total = addSPLs(spls);
        result = {
          operation: 'add_spl',
          input_levels_db: spls,
          combined_spl_db: +total.toFixed(1),
          note: 'Two equal sources add 3 dB',
        };
        break;
      }
      case 'speaker_box': {
        const { vas, fs, qts } = args;
        if (!vas || !fs || !qts) throw new Error('speaker_box requires vas, fs, qts');
        const vb = sealedBoxVolume(vas, fs, qts);
        const fc = sealedCutoff(fs, qts, vas, vb);
        const fb = portedTuning(fs, qts);
        result = {
          operation: 'speaker_box',
          driver_params: { vas_liters: vas, fs_hz: fs, qts },
          sealed_box: {
            volume_liters: +vb.toFixed(1),
            cutoff_hz: +fc.toFixed(0),
            qtc: 0.707,
          },
          ported_estimate: {
            tuning_hz: +fb.toFixed(0),
            note: 'Detailed design requires Xmax, port calculations',
          },
        };
        break;
      }
      case 'wavelength': {
        const freq = args.frequency || 1000;
        const lambda = wavelength(freq, c);
        result = {
          operation: 'wavelength',
          frequency_hz: freq,
          wavelength_m: +lambda.toFixed(3),
          wavelength_cm: +(lambda * 100).toFixed(1),
          speed_of_sound_m_s: +c.toFixed(1),
          quarter_wavelength_m: +(lambda / 4).toFixed(3),
        };
        break;
      }
      case 'materials': {
        result = {
          operation: 'materials',
          absorption_coefficients: Object.entries(MATERIALS).map(([k, v]) => ({
            material: k,
            coefficient_500hz: v,
          })),
          note: 'Coefficients vary with frequency; these are approximate at 500 Hz',
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

export function isAcousticsAvailable(): boolean {
  return true;
}
