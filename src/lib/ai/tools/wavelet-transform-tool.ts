/**
 * WAVELET TRANSFORM TOOL
 *
 * Discrete and continuous wavelet transforms for signal analysis.
 * Essential for signal processing and data compression.
 *
 * Features:
 * - Haar wavelet transform
 * - Daubechies wavelets (D4, D6, D8)
 * - Discrete Wavelet Transform (DWT)
 * - Inverse DWT
 * - Multi-resolution analysis
 * - Wavelet denoising
 * - 2D wavelet transform
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// WAVELET FILTER COEFFICIENTS
// ============================================================================

// Haar wavelet
const HAAR = {
  low: [1 / Math.sqrt(2), 1 / Math.sqrt(2)],
  high: [1 / Math.sqrt(2), -1 / Math.sqrt(2)],
};

// Daubechies D4 wavelet
const D4 = {
  low: [
    (1 + Math.sqrt(3)) / (4 * Math.sqrt(2)),
    (3 + Math.sqrt(3)) / (4 * Math.sqrt(2)),
    (3 - Math.sqrt(3)) / (4 * Math.sqrt(2)),
    (1 - Math.sqrt(3)) / (4 * Math.sqrt(2)),
  ],
  high: [
    (1 - Math.sqrt(3)) / (4 * Math.sqrt(2)),
    -(3 - Math.sqrt(3)) / (4 * Math.sqrt(2)),
    (3 + Math.sqrt(3)) / (4 * Math.sqrt(2)),
    -(1 + Math.sqrt(3)) / (4 * Math.sqrt(2)),
  ],
};

// Daubechies D6 wavelet
const D6 = {
  low: [
    0.33267055295, 0.806891509311, 0.459877502118, -0.13501102001, -0.085441273882, 0.035226291882,
  ],
  high: [
    0.035226291882, 0.085441273882, -0.13501102001, -0.459877502118, 0.806891509311, -0.33267055295,
  ],
};

// Daubechies D8 wavelet
const D8 = {
  low: [
    0.230377813309, 0.714846570553, 0.63088076793, -0.027983769417, -0.187034811719, 0.030841381836,
    0.032883011667, -0.010597401785,
  ],
  high: [
    -0.010597401785, -0.032883011667, 0.030841381836, 0.187034811719, -0.027983769417,
    -0.63088076793, 0.714846570553, -0.230377813309,
  ],
};

// Symlet 4 (Sym4) wavelet
const SYM4 = {
  low: [
    -0.0757657147893407, -0.0296355276459541, 0.4976186676324578, 0.8037387518052163,
    0.2978577956055422, -0.0992195435769354, -0.0126039672622612, 0.0322231006040782,
  ],
  high: [
    -0.0322231006040782, -0.0126039672622612, 0.0992195435769354, 0.2978577956055422,
    -0.8037387518052163, 0.4976186676324578, 0.0296355276459541, -0.0757657147893407,
  ],
};

// Coiflet 2 wavelet
const COIF2 = {
  low: [-0.0156557281, -0.0727326195, 0.3848648469, 0.8525720202, 0.3378976625, -0.0727326195],
  high: [0.0727326195, 0.3378976625, -0.8525720202, 0.3848648469, 0.0727326195, -0.0156557281],
};

type WaveletType = 'haar' | 'd4' | 'd6' | 'd8' | 'sym4' | 'coif2';

const WAVELETS: Record<WaveletType, { low: number[]; high: number[] }> = {
  haar: HAAR,
  d4: D4,
  d6: D6,
  d8: D8,
  sym4: SYM4,
  coif2: COIF2,
};

// ============================================================================
// 1D WAVELET TRANSFORMS
// ============================================================================

// Single level DWT decomposition
function dwtDecompose(
  signal: number[],
  wavelet: WaveletType
): { approx: number[]; detail: number[] } {
  const { low, high } = WAVELETS[wavelet];
  const n = signal.length;
  const filterLen = low.length;

  // Pad signal for circular convolution
  const padded = [...signal, ...signal.slice(0, filterLen - 1)];

  const approx: number[] = [];
  const detail: number[] = [];

  // Convolve and downsample by 2
  for (let i = 0; i < n; i += 2) {
    let sumLow = 0;
    let sumHigh = 0;

    for (let j = 0; j < filterLen; j++) {
      sumLow += padded[i + j] * low[j];
      sumHigh += padded[i + j] * high[j];
    }

    approx.push(sumLow);
    detail.push(sumHigh);
  }

  return { approx, detail };
}

// Single level inverse DWT reconstruction
function idwtReconstruct(approx: number[], detail: number[], wavelet: WaveletType): number[] {
  const { low, high } = WAVELETS[wavelet];
  const n = approx.length * 2;
  const filterLen = low.length;

  // Reverse filters for reconstruction
  const lowRec = [...low].reverse();
  const highRec = [...high].reverse();

  // Upsample
  const upApprox: number[] = Array(n).fill(0);
  const upDetail: number[] = Array(n).fill(0);

  for (let i = 0; i < approx.length; i++) {
    upApprox[i * 2] = approx[i];
    upDetail[i * 2] = detail[i];
  }

  // Reconstruct
  const result: number[] = Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < filterLen; j++) {
      const idx = (i - j + n) % n;
      result[i] += upApprox[idx] * lowRec[j] + upDetail[idx] * highRec[j];
    }
  }

  return result;
}

// Multi-level DWT
function dwtMultiLevel(
  signal: number[],
  wavelet: WaveletType,
  levels: number
): { coefficients: number[][]; lengths: number[] } {
  const coefficients: number[][] = [];
  const lengths: number[] = [];
  let currentSignal = [...signal];

  for (let level = 0; level < levels; level++) {
    const { approx, detail } = dwtDecompose(currentSignal, wavelet);
    coefficients.unshift(detail); // Add detail at the beginning
    lengths.unshift(detail.length);
    currentSignal = approx;
  }

  coefficients.unshift(currentSignal); // Add final approximation
  lengths.unshift(currentSignal.length);

  return { coefficients, lengths };
}

// Multi-level inverse DWT
function idwtMultiLevel(coefficients: number[][], wavelet: WaveletType): number[] {
  let approx = coefficients[0];

  for (let i = 1; i < coefficients.length; i++) {
    approx = idwtReconstruct(approx, coefficients[i], wavelet);
  }

  return approx;
}

// ============================================================================
// WAVELET DENOISING
// ============================================================================

// Soft thresholding
function softThreshold(value: number, threshold: number): number {
  if (Math.abs(value) <= threshold) return 0;
  return Math.sign(value) * (Math.abs(value) - threshold);
}

// Hard thresholding
function hardThreshold(value: number, threshold: number): number {
  if (Math.abs(value) <= threshold) return 0;
  return value;
}

// Universal threshold (VisuShrink)
function universalThreshold(n: number, noiseStd: number): number {
  return noiseStd * Math.sqrt(2 * Math.log(n));
}

// Median absolute deviation for noise estimation
function estimateNoise(detail: number[]): number {
  const sorted = [...detail].map(Math.abs).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return median / 0.6745; // MAD estimator
}

// Denoise signal using wavelets
function waveletDenoise(
  signal: number[],
  wavelet: WaveletType,
  levels: number,
  thresholdType: 'soft' | 'hard' = 'soft'
): { denoised: number[]; noiseEstimate: number } {
  const { coefficients } = dwtMultiLevel(signal, wavelet, levels);

  // Estimate noise from finest detail level
  const finestDetail = coefficients[coefficients.length - 1];
  const noiseStd = estimateNoise(finestDetail);
  const threshold = universalThreshold(signal.length, noiseStd);

  // Apply thresholding to detail coefficients
  const thresholdedCoeffs = coefficients.map((coeff, i) => {
    if (i === 0) return coeff; // Don't threshold approximation
    return coeff.map((v) =>
      thresholdType === 'soft' ? softThreshold(v, threshold) : hardThreshold(v, threshold)
    );
  });

  // Reconstruct
  const denoised = idwtMultiLevel(thresholdedCoeffs, wavelet);

  return { denoised, noiseEstimate: noiseStd };
}

// ============================================================================
// 2D WAVELET TRANSFORM
// ============================================================================

// 2D DWT for images
function dwt2D(
  image: number[][],
  wavelet: WaveletType
): {
  LL: number[][];
  LH: number[][];
  HL: number[][];
  HH: number[][];
} {
  const rows = image.length;

  // Apply DWT to rows
  const rowTransformed: { approx: number[][]; detail: number[][] } = {
    approx: [],
    detail: [],
  };

  for (let i = 0; i < rows; i++) {
    const { approx, detail } = dwtDecompose(image[i], wavelet);
    rowTransformed.approx.push(approx);
    rowTransformed.detail.push(detail);
  }

  // Apply DWT to columns of row-transformed data
  const LL: number[][] = [];
  const LH: number[][] = [];
  const HL: number[][] = [];
  const HH: number[][] = [];

  // Transform columns of approximation
  const newCols = rowTransformed.approx[0].length;
  for (let j = 0; j < newCols; j++) {
    const colApprox = rowTransformed.approx.map((row) => row[j]);
    const colDetail = rowTransformed.detail.map((row) => row[j]);

    const { approx: llCol, detail: lhCol } = dwtDecompose(colApprox, wavelet);
    const { approx: hlCol, detail: hhCol } = dwtDecompose(colDetail, wavelet);

    for (let i = 0; i < llCol.length; i++) {
      if (!LL[i]) LL[i] = [];
      if (!LH[i]) LH[i] = [];
      if (!HL[i]) HL[i] = [];
      if (!HH[i]) HH[i] = [];

      LL[i][j] = llCol[i];
      LH[i][j] = lhCol[i];
      HL[i][j] = hlCol[i];
      HH[i][j] = hhCol[i];
    }
  }

  return { LL, LH, HL, HH };
}

// ============================================================================
// CONTINUOUS WAVELET TRANSFORM (APPROXIMATE)
// ============================================================================

// Mexican hat (Ricker) wavelet
function mexicanHat(t: number, scale: number): number {
  const x = t / scale;
  return (2 / (Math.sqrt(3) * Math.pow(Math.PI, 0.25))) * (1 - x * x) * Math.exp((-x * x) / 2);
}

// Morlet wavelet
function morlet(t: number, scale: number, omega0: number = 6): number {
  const x = t / scale;
  return Math.exp((-x * x) / 2) * Math.cos(omega0 * x);
}

// Continuous wavelet transform
function cwt(
  signal: number[],
  scales: number[],
  waveletType: 'mexican_hat' | 'morlet'
): { coefficients: number[][]; scales: number[] } {
  const n = signal.length;
  const coefficients: number[][] = [];

  for (const scale of scales) {
    const scaleCoeffs: number[] = [];

    for (let t = 0; t < n; t++) {
      let sum = 0;

      for (let tau = 0; tau < n; tau++) {
        const waveletValue =
          waveletType === 'mexican_hat' ? mexicanHat(tau - t, scale) : morlet(tau - t, scale);
        sum += signal[tau] * waveletValue;
      }

      scaleCoeffs.push(sum / Math.sqrt(scale));
    }

    coefficients.push(scaleCoeffs);
  }

  return { coefficients, scales };
}

// ============================================================================
// WAVELET POWER SPECTRUM
// ============================================================================

function waveletPowerSpectrum(coefficients: number[][]): {
  power: number[][];
  totalPower: number[];
} {
  const power: number[][] = coefficients.map((row) => row.map((v) => v * v));

  const totalPower: number[] = coefficients.map((row) => row.reduce((sum, v) => sum + v * v, 0));

  return { power, totalPower };
}

// ============================================================================
// MULTI-RESOLUTION ANALYSIS
// ============================================================================

function multiResolutionAnalysis(
  signal: number[],
  wavelet: WaveletType,
  levels: number
): {
  approximations: number[][];
  details: number[][];
  energyDistribution: number[];
} {
  const approximations: number[][] = [];
  const details: number[][] = [];
  const energyDistribution: number[] = [];

  let currentSignal = [...signal];

  for (let level = 0; level < levels; level++) {
    const { approx, detail } = dwtDecompose(currentSignal, wavelet);

    // Upsample to original length for visualization
    const upsampledDetail = detail.flatMap((v) => [v, v]);
    details.push(upsampledDetail.slice(0, signal.length));

    // Calculate energy
    const energy = detail.reduce((sum, v) => sum + v * v, 0);
    energyDistribution.push(energy);

    currentSignal = approx;
  }

  // Add final approximation
  const upsampledApprox = currentSignal.flatMap((v) => [v, v]);
  approximations.push(upsampledApprox.slice(0, signal.length));

  const approxEnergy = currentSignal.reduce((sum, v) => sum + v * v, 0);
  energyDistribution.push(approxEnergy);

  // Normalize energy distribution
  const totalEnergy = energyDistribution.reduce((a, b) => a + b, 0);
  const normalizedEnergy = energyDistribution.map((e) => e / totalEnergy);

  return { approximations, details, energyDistribution: normalizedEnergy };
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const waveletTransformTool: UnifiedTool = {
  name: 'wavelet_transform',
  description: `Wavelet transforms for signal analysis and processing.

Available operations:
- dwt: Discrete Wavelet Transform decomposition
- idwt: Inverse DWT reconstruction
- dwt_multilevel: Multi-level DWT decomposition
- denoise: Wavelet denoising with thresholding
- dwt2d: 2D DWT for images
- cwt: Continuous Wavelet Transform
- power_spectrum: Wavelet power spectrum
- mra: Multi-Resolution Analysis

Available wavelets: haar, d4, d6, d8, sym4, coif2
CWT wavelets: mexican_hat, morlet`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['dwt', 'idwt', 'dwt_multilevel', 'denoise', 'dwt2d', 'cwt', 'power_spectrum', 'mra'],
        description: 'Wavelet transform operation',
      },
      signal: {
        type: 'array',
        description: '1D signal as array of numbers',
      },
      image: {
        type: 'array',
        description: '2D image as array of arrays',
      },
      wavelet: {
        type: 'string',
        enum: ['haar', 'd4', 'd6', 'd8', 'sym4', 'coif2'],
        description: 'Wavelet type for DWT',
      },
      cwt_wavelet: {
        type: 'string',
        enum: ['mexican_hat', 'morlet'],
        description: 'Wavelet type for CWT',
      },
      levels: {
        type: 'number',
        description: 'Number of decomposition levels',
      },
      scales: {
        type: 'array',
        description: 'Array of scales for CWT',
      },
      approx: {
        type: 'array',
        description: 'Approximation coefficients for IDWT',
      },
      detail: {
        type: 'array',
        description: 'Detail coefficients for IDWT',
      },
      coefficients: {
        type: 'array',
        description: 'Wavelet coefficients for power spectrum',
      },
      threshold_type: {
        type: 'string',
        enum: ['soft', 'hard'],
        description: 'Thresholding type for denoising',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isWaveletTransformAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeWaveletTransform(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as Record<string, unknown>;
  const operation = args.operation as string;

  try {
    const result: Record<string, unknown> = { operation };

    switch (operation) {
      case 'dwt': {
        const signal = args.signal as number[];
        const wavelet = (args.wavelet as WaveletType) || 'haar';
        const { approx, detail } = dwtDecompose(signal, wavelet);
        result.approximation = approx;
        result.detail = detail;
        result.wavelet = wavelet;
        result.compression_ratio = signal.length / (approx.length + detail.length);
        break;
      }

      case 'idwt': {
        const approx = args.approx as number[];
        const detail = args.detail as number[];
        const wavelet = (args.wavelet as WaveletType) || 'haar';
        const reconstructed = idwtReconstruct(approx, detail, wavelet);
        result.reconstructed = reconstructed;
        result.wavelet = wavelet;
        break;
      }

      case 'dwt_multilevel': {
        const signal = args.signal as number[];
        const wavelet = (args.wavelet as WaveletType) || 'haar';
        const levels = (args.levels as number) || 3;
        const { coefficients, lengths } = dwtMultiLevel(signal, wavelet, levels);
        result.coefficients = coefficients;
        result.lengths = lengths;
        result.levels = levels;
        result.wavelet = wavelet;

        // Calculate energy at each level
        const energies = coefficients.map((c) => c.reduce((s, v) => s + v * v, 0));
        const totalEnergy = energies.reduce((a, b) => a + b, 0);
        result.energy_distribution = energies.map((e) => e / totalEnergy);
        break;
      }

      case 'denoise': {
        const signal = args.signal as number[];
        const wavelet = (args.wavelet as WaveletType) || 'haar';
        const levels = (args.levels as number) || 3;
        const thresholdType = (args.threshold_type as 'soft' | 'hard') || 'soft';
        const { denoised, noiseEstimate } = waveletDenoise(signal, wavelet, levels, thresholdType);
        result.denoised = denoised;
        result.noise_estimate = noiseEstimate;
        result.threshold_type = thresholdType;
        result.snr_improvement_estimate = `Removed noise with std ~${noiseEstimate.toFixed(4)}`;
        break;
      }

      case 'dwt2d': {
        const image = args.image as number[][];
        const wavelet = (args.wavelet as WaveletType) || 'haar';
        const { LL, LH, HL, HH } = dwt2D(image, wavelet);
        result.LL = LL; // Approximation
        result.LH = LH; // Horizontal detail
        result.HL = HL; // Vertical detail
        result.HH = HH; // Diagonal detail
        result.wavelet = wavelet;
        result.subband_sizes = {
          LL: `${LL.length}x${LL[0].length}`,
          LH: `${LH.length}x${LH[0].length}`,
          HL: `${HL.length}x${HL[0].length}`,
          HH: `${HH.length}x${HH[0].length}`,
        };
        break;
      }

      case 'cwt': {
        const signal = args.signal as number[];
        const scales = (args.scales as number[]) || [1, 2, 4, 8, 16, 32];
        const waveletType = (args.cwt_wavelet as 'mexican_hat' | 'morlet') || 'morlet';
        const { coefficients } = cwt(signal, scales, waveletType);
        result.coefficients = coefficients;
        result.scales = scales;
        result.wavelet = waveletType;

        // Calculate power at each scale
        const power = coefficients.map((row) => row.reduce((s, v) => s + v * v, 0) / row.length);
        result.scale_power = power;
        break;
      }

      case 'power_spectrum': {
        const coefficients = args.coefficients as number[][];
        const { power, totalPower } = waveletPowerSpectrum(coefficients);
        result.power = power;
        result.total_power_by_scale = totalPower;
        result.dominant_scale = totalPower.indexOf(Math.max(...totalPower));
        break;
      }

      case 'mra': {
        const signal = args.signal as number[];
        const wavelet = (args.wavelet as WaveletType) || 'haar';
        const levels = (args.levels as number) || 3;
        const { approximations, details, energyDistribution } = multiResolutionAnalysis(
          signal,
          wavelet,
          levels
        );
        result.approximation = approximations[0];
        result.details = details;
        result.energy_distribution = energyDistribution;
        result.levels = levels;
        result.wavelet = wavelet;
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: call.id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: call.id,
      content: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        operation,
      }),
      isError: true,
    };
  }
}
