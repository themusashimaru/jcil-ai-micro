/**
 * COMPRESSOR TOOL
 * Comprehensive dynamic range compressor with multiple modes
 * Implements RMS/peak detection, soft/hard knee, sidechain, and multiband compression
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const compressorTool: UnifiedTool = {
  name: 'compressor',
  description: 'Dynamic range compressor with RMS/peak detection, soft knee, and multiband modes',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'examples', 'demo', 'compress', 'multiband', 'sidechain', 'analyze', 'transfer_curve'],
        description: 'Operation to perform'
      },
      signal: {
        type: 'array',
        items: { type: 'number' },
        description: 'Input audio signal samples'
      },
      sampleRate: {
        type: 'number',
        description: 'Sample rate in Hz (default: 44100)'
      },
      threshold: {
        type: 'number',
        description: 'Threshold level in dB (default: -20)'
      },
      ratio: {
        type: 'number',
        description: 'Compression ratio (e.g., 4 for 4:1, default: 4)'
      },
      attack: {
        type: 'number',
        description: 'Attack time in milliseconds (default: 10)'
      },
      release: {
        type: 'number',
        description: 'Release time in milliseconds (default: 100)'
      },
      knee: {
        type: 'number',
        description: 'Knee width in dB (0 = hard knee, default: 6)'
      },
      makeupGain: {
        type: 'number',
        description: 'Output makeup gain in dB (default: 0)'
      },
      detectionMode: {
        type: 'string',
        enum: ['peak', 'rms'],
        description: 'Level detection mode (default: rms)'
      },
      sidechainSignal: {
        type: 'array',
        items: { type: 'number' },
        description: 'External sidechain signal for sidechain compression'
      },
      bands: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            lowFreq: { type: 'number' },
            highFreq: { type: 'number' },
            threshold: { type: 'number' },
            ratio: { type: 'number' }
          }
        },
        description: 'Multiband compressor band settings'
      }
    },
    required: ['operation']
  }
};

// Convert linear amplitude to dB
function linearToDb(linear: number): number {
  return 20 * Math.log10(Math.max(linear, 1e-10));
}

// Convert dB to linear amplitude
function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

// Calculate gain reduction using soft knee
function calculateGainReduction(
  inputLevel: number,  // in dB
  threshold: number,   // in dB
  ratio: number,
  kneeWidth: number    // in dB
): number {
  // Below threshold
  if (inputLevel < threshold - kneeWidth / 2) {
    return 0;
  }

  // Above threshold + knee
  if (inputLevel > threshold + kneeWidth / 2) {
    return (inputLevel - threshold) * (1 - 1 / ratio);
  }

  // In the knee region (soft knee)
  const x = inputLevel - threshold + kneeWidth / 2;
  return (x * x) / (2 * kneeWidth) * (1 - 1 / ratio);
}

// RMS level detector
function rmsDetector(
  samples: number[],
  windowSize: number
): number[] {
  const levels: number[] = new Array(samples.length).fill(0);
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < samples.length; i++) {
    let sum = 0;
    let count = 0;

    const start = Math.max(0, i - halfWindow);
    const end = Math.min(samples.length, i + halfWindow);

    for (let j = start; j < end; j++) {
      sum += samples[j] * samples[j];
      count++;
    }

    levels[i] = Math.sqrt(sum / count);
  }

  return levels;
}

// Peak detector with attack/release envelope
function peakDetector(
  samples: number[],
  attackCoeff: number,
  releaseCoeff: number
): number[] {
  const levels: number[] = new Array(samples.length).fill(0);
  let envelope = 0;

  for (let i = 0; i < samples.length; i++) {
    const inputAbs = Math.abs(samples[i]);

    if (inputAbs > envelope) {
      envelope = attackCoeff * (envelope - inputAbs) + inputAbs;
    } else {
      envelope = releaseCoeff * (envelope - inputAbs) + inputAbs;
    }

    levels[i] = envelope;
  }

  return levels;
}

// Main compression function
function compress(
  signal: number[],
  sampleRate: number,
  threshold: number,
  ratio: number,
  attackMs: number,
  releaseMs: number,
  kneeWidth: number,
  makeupGain: number,
  detectionMode: 'peak' | 'rms',
  sidechainSignal?: number[]
): { output: number[]; gainReduction: number[]; analysis: object } {
  // Calculate time constants
  const attackCoeff = Math.exp(-1 / (attackMs * sampleRate / 1000));
  const releaseCoeff = Math.exp(-1 / (releaseMs * sampleRate / 1000));

  // Detect levels from sidechain or main signal
  const detectionSignal = sidechainSignal || signal;

  let levels: number[];
  if (detectionMode === 'rms') {
    // RMS window based on attack time
    const rmsWindow = Math.max(32, Math.floor(attackMs * sampleRate / 1000));
    levels = rmsDetector(detectionSignal, rmsWindow);
  } else {
    levels = peakDetector(detectionSignal, attackCoeff, releaseCoeff);
  }

  // Process compression
  const output: number[] = new Array(signal.length);
  const gainReduction: number[] = new Array(signal.length);
  let smoothedGainReduction = 0;

  // Statistics
  let maxGainReduction = 0;
  let totalGainReduction = 0;
  let samplesCompressed = 0;

  for (let i = 0; i < signal.length; i++) {
    // Convert to dB
    const levelDb = linearToDb(levels[i]);

    // Calculate instantaneous gain reduction
    const instantGr = calculateGainReduction(levelDb, threshold, ratio, kneeWidth);

    // Smooth gain reduction with attack/release
    if (instantGr > smoothedGainReduction) {
      smoothedGainReduction = attackCoeff * (smoothedGainReduction - instantGr) + instantGr;
    } else {
      smoothedGainReduction = releaseCoeff * (smoothedGainReduction - instantGr) + instantGr;
    }

    // Apply gain
    const totalGainDb = -smoothedGainReduction + makeupGain;
    const gainLinear = dbToLinear(totalGainDb);

    output[i] = signal[i] * gainLinear;
    gainReduction[i] = smoothedGainReduction;

    // Statistics
    if (smoothedGainReduction > 0.1) {
      samplesCompressed++;
      totalGainReduction += smoothedGainReduction;
    }
    maxGainReduction = Math.max(maxGainReduction, smoothedGainReduction);
  }

  return {
    output,
    gainReduction,
    analysis: {
      type: 'Dynamic Range Compressor',
      settings: {
        threshold: threshold + ' dB',
        ratio: ratio + ':1',
        attack: attackMs + ' ms',
        release: releaseMs + ' ms',
        knee: kneeWidth + ' dB',
        makeupGain: makeupGain + ' dB',
        detectionMode
      },
      statistics: {
        maxGainReduction: maxGainReduction.toFixed(2) + ' dB',
        avgGainReduction: samplesCompressed > 0 ?
          (totalGainReduction / samplesCompressed).toFixed(2) + ' dB' : '0 dB',
        compressionActivity: ((samplesCompressed / signal.length) * 100).toFixed(1) + '%'
      }
    }
  };
}

// Simple biquad lowpass/highpass for multiband
function applyFilter(
  signal: number[],
  sampleRate: number,
  frequency: number,
  type: 'lowpass' | 'highpass'
): number[] {
  const w0 = 2 * Math.PI * frequency / sampleRate;
  const cosw0 = Math.cos(w0);
  const sinw0 = Math.sin(w0);
  const alpha = sinw0 / (2 * 0.707); // Q = 0.707 for Butterworth

  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;

  if (type === 'lowpass') {
    b0 = (1 - cosw0) / 2;
    b1 = 1 - cosw0;
    b2 = (1 - cosw0) / 2;
  } else {
    b0 = (1 + cosw0) / 2;
    b1 = -(1 + cosw0);
    b2 = (1 + cosw0) / 2;
  }
  a0 = 1 + alpha;
  a1 = -2 * cosw0;
  a2 = 1 - alpha;

  // Normalize
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;

  // Apply filter
  const output: number[] = new Array(signal.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;

  for (let i = 0; i < signal.length; i++) {
    const x0 = signal[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;

    x2 = x1; x1 = x0;
    y2 = y1; y1 = y0;
    output[i] = y0;
  }

  return output;
}

// Multiband compressor
function multibandCompress(
  signal: number[],
  sampleRate: number,
  bands: { lowFreq: number; highFreq: number; threshold: number; ratio: number; attack?: number; release?: number }[]
): { output: number[]; bandOutputs: number[][]; analysis: object } {
  // Sort bands by frequency
  const sortedBands = [...bands].sort((a, b) => a.lowFreq - b.lowFreq);

  // Split signal into bands
  const bandSignals: number[][] = [];

  for (const band of sortedBands) {
    let bandSignal = signal;

    // Apply highpass at low frequency
    if (band.lowFreq > 20) {
      bandSignal = applyFilter(bandSignal, sampleRate, band.lowFreq, 'highpass');
    }

    // Apply lowpass at high frequency
    if (band.highFreq < sampleRate / 2 - 100) {
      bandSignal = applyFilter(bandSignal, sampleRate, band.highFreq, 'lowpass');
    }

    bandSignals.push(bandSignal);
  }

  // Compress each band
  const compressedBands: number[][] = [];
  const bandAnalyses: object[] = [];

  for (let i = 0; i < sortedBands.length; i++) {
    const band = sortedBands[i];
    const result = compress(
      bandSignals[i],
      sampleRate,
      band.threshold,
      band.ratio,
      band.attack || 10,
      band.release || 100,
      6, // knee
      0, // makeup
      'rms'
    );

    compressedBands.push(result.output);
    bandAnalyses.push({
      frequency: `${band.lowFreq}-${band.highFreq} Hz`,
      threshold: band.threshold + ' dB',
      ratio: band.ratio + ':1',
      ...result.analysis.statistics
    });
  }

  // Sum bands
  const output: number[] = new Array(signal.length).fill(0);
  for (let i = 0; i < signal.length; i++) {
    for (const band of compressedBands) {
      output[i] += band[i];
    }
  }

  return {
    output,
    bandOutputs: compressedBands,
    analysis: {
      type: 'Multiband Compressor',
      bandCount: bands.length,
      bands: bandAnalyses
    }
  };
}

// Generate transfer curve data
function generateTransferCurve(
  threshold: number,
  ratio: number,
  kneeWidth: number,
  makeupGain: number
): { inputLevels: number[]; outputLevels: number[] } {
  const inputLevels: number[] = [];
  const outputLevels: number[] = [];

  for (let inputDb = -60; inputDb <= 0; inputDb += 1) {
    inputLevels.push(inputDb);

    const gainReduction = calculateGainReduction(inputDb, threshold, ratio, kneeWidth);
    const outputDb = inputDb - gainReduction + makeupGain;

    outputLevels.push(outputDb);
  }

  return { inputLevels, outputLevels };
}

// Analyze dynamics of a signal
function analyzeDynamics(signal: number[], _sampleRate: number): object {
  // Calculate levels
  const absSignal = signal.map(Math.abs);
  const maxLevel = Math.max(...absSignal);
  const minLevel = Math.min(...absSignal.filter(s => s > 1e-6));

  // Calculate RMS
  const rms = Math.sqrt(signal.reduce((sum, s) => sum + s * s, 0) / signal.length);

  // Peak to RMS ratio (crest factor)
  const crestFactor = linearToDb(maxLevel / rms);

  // Dynamic range
  const dynamicRange = linearToDb(maxLevel) - linearToDb(minLevel);

  // Level histogram
  const histogram: { [key: string]: number } = {};
  for (let i = -60; i <= 0; i += 6) {
    histogram[`${i} dB`] = 0;
  }

  for (const sample of absSignal) {
    if (sample > 1e-6) {
      const db = Math.round(linearToDb(sample) / 6) * 6;
      const key = `${Math.max(-60, db)} dB`;
      histogram[key] = (histogram[key] || 0) + 1;
    }
  }

  // Normalize histogram
  const totalSamples = signal.length;
  const histogramPercent: { [key: string]: string } = {};
  for (const [key, count] of Object.entries(histogram)) {
    histogramPercent[key] = ((count / totalSamples) * 100).toFixed(1) + '%';
  }

  return {
    levels: {
      peakLevel: linearToDb(maxLevel).toFixed(2) + ' dB',
      rmsLevel: linearToDb(rms).toFixed(2) + ' dB',
      crestFactor: crestFactor.toFixed(2) + ' dB',
      dynamicRange: dynamicRange.toFixed(2) + ' dB'
    },
    levelDistribution: histogramPercent,
    recommendations: {
      suggestedThreshold: (linearToDb(rms) + 6).toFixed(0) + ' dB',
      suggestedRatio: crestFactor > 12 ? '4:1 to 8:1' : '2:1 to 4:1',
      suggestedMakeup: Math.min(6, crestFactor / 2).toFixed(0) + ' dB'
    }
  };
}

export async function executecompressor(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation,
      signal = [],
      sampleRate = 44100,
      threshold = -20,
      ratio = 4,
      attack = 10,
      release = 100,
      knee = 6,
      makeupGain = 0,
      detectionMode = 'rms',
      sidechainSignal,
      bands = []
    } = args;

    let result: object;

    switch (operation) {
      case 'info':
        result = {
          tool: 'compressor',
          description: 'Dynamic range compressor with multiple detection and compression modes',
          features: {
            detection: 'Peak or RMS level detection',
            knee: 'Soft knee for smooth compression onset',
            sidechain: 'External sidechain input support',
            multiband: 'Multi-band compression with crossover filters'
          },
          parameters: {
            threshold: 'Level above which compression begins (dB)',
            ratio: 'Compression ratio (e.g., 4 for 4:1)',
            attack: 'Time to reach full compression (ms)',
            release: 'Time to release compression (ms)',
            knee: 'Soft knee width (dB, 0 = hard knee)',
            makeupGain: 'Output gain compensation (dB)'
          },
          operations: [
            'compress - Standard compression',
            'multiband - Multi-band compression',
            'sidechain - Sidechain compression',
            'analyze - Analyze signal dynamics',
            'transfer_curve - Generate transfer function'
          ]
        };
        break;

      case 'examples':
        result = {
          basicCompression: {
            description: 'Standard vocal compression',
            parameters: {
              operation: 'compress',
              signal: [0.5, 0.8, 0.3, -0.7, 0.2],
              threshold: -18,
              ratio: 4,
              attack: 5,
              release: 80
            }
          },
          multiband: {
            description: 'Three-band mastering compression',
            parameters: {
              operation: 'multiband',
              signal: [0.5, 0.8, 0.3, -0.7, 0.2],
              bands: [
                { lowFreq: 20, highFreq: 200, threshold: -24, ratio: 2 },
                { lowFreq: 200, highFreq: 2000, threshold: -20, ratio: 3 },
                { lowFreq: 2000, highFreq: 20000, threshold: -18, ratio: 4 }
              ]
            }
          },
          transferCurve: {
            description: 'Visualize compression curve',
            parameters: {
              operation: 'transfer_curve',
              threshold: -20,
              ratio: 4,
              knee: 6
            }
          }
        };
        break;

      case 'demo':
        // Generate dynamic test signal
        const demoSignal: number[] = [];
        for (let i = 0; i < 2000; i++) {
          // Varying amplitude envelope
          const envelope = 0.3 + 0.7 * Math.sin(2 * Math.PI * i / 500);
          const tone = Math.sin(2 * Math.PI * 440 * i / sampleRate);
          demoSignal.push(tone * envelope);
        }

        const demoResult = compress(
          demoSignal,
          sampleRate,
          -20,
          4,
          10,
          100,
          6,
          4,
          'rms'
        );

        result = {
          demo: 'Compression of dynamic signal',
          inputSignal: {
            type: 'Amplitude-modulated 440Hz tone',
            length: demoSignal.length,
            peakLevel: linearToDb(Math.max(...demoSignal.map(Math.abs))).toFixed(2) + ' dB'
          },
          settings: {
            threshold: '-20 dB',
            ratio: '4:1',
            attack: '10 ms',
            release: '100 ms',
            knee: '6 dB',
            makeupGain: '4 dB'
          },
          outputPreview: demoResult.output.slice(0, 50).map(v => v.toFixed(4)),
          gainReductionPreview: demoResult.gainReduction.slice(0, 50).map(v => v.toFixed(2) + ' dB'),
          analysis: demoResult.analysis
        };
        break;

      case 'compress':
        if (signal.length === 0) {
          throw new Error('Signal array is required for compress operation');
        }

        const compResult = compress(
          signal,
          sampleRate,
          threshold,
          ratio,
          attack,
          release,
          knee,
          makeupGain,
          detectionMode as 'peak' | 'rms'
        );

        result = {
          operation: 'compress',
          inputLength: signal.length,
          output: compResult.output.slice(0, 100),
          gainReduction: compResult.gainReduction.slice(0, 100).map(gr => gr.toFixed(2)),
          analysis: compResult.analysis
        };
        break;

      case 'multiband':
        if (signal.length === 0) {
          throw new Error('Signal array is required for multiband operation');
        }

        const defaultBands = bands.length > 0 ? bands : [
          { lowFreq: 20, highFreq: 200, threshold: -24, ratio: 2 },
          { lowFreq: 200, highFreq: 2000, threshold: -20, ratio: 3 },
          { lowFreq: 2000, highFreq: 20000, threshold: -18, ratio: 4 }
        ];

        const mbResult = multibandCompress(signal, sampleRate, defaultBands);

        result = {
          operation: 'multiband',
          inputLength: signal.length,
          output: mbResult.output.slice(0, 100),
          analysis: mbResult.analysis
        };
        break;

      case 'sidechain':
        if (signal.length === 0) {
          throw new Error('Signal array is required for sidechain operation');
        }

        // Use provided sidechain or generate kick-like sidechain
        let sidechain = sidechainSignal;
        if (!sidechain || sidechain.length === 0) {
          // Generate periodic "kick" sidechain
          sidechain = new Array(signal.length).fill(0);
          const kickInterval = Math.floor(sampleRate / 2); // 2 kicks per second
          const kickLength = Math.floor(sampleRate * 0.1); // 100ms kick

          for (let i = 0; i < signal.length; i += kickInterval) {
            for (let j = 0; j < kickLength && i + j < signal.length; j++) {
              const decay = Math.exp(-j / (kickLength / 4));
              sidechain[i + j] = decay;
            }
          }
        }

        const scResult = compress(
          signal,
          sampleRate,
          threshold,
          ratio,
          attack,
          release,
          knee,
          makeupGain,
          detectionMode as 'peak' | 'rms',
          sidechain
        );

        result = {
          operation: 'sidechain',
          description: 'Sidechain compression (ducking)',
          inputLength: signal.length,
          sidechainLength: sidechain.length,
          output: scResult.output.slice(0, 100),
          gainReduction: scResult.gainReduction.slice(0, 100).map(gr => gr.toFixed(2)),
          analysis: {
            ...scResult.analysis,
            sidechainInfo: sidechainSignal ?
              'External sidechain provided' :
              'Auto-generated periodic kick sidechain'
          }
        };
        break;

      case 'analyze':
        if (signal.length === 0) {
          throw new Error('Signal array is required for analyze operation');
        }

        result = {
          operation: 'analyze',
          signalLength: signal.length,
          analysis: analyzeDynamics(signal, sampleRate)
        };
        break;

      case 'transfer_curve':
        const curve = generateTransferCurve(threshold, ratio, knee, makeupGain);

        // Format for display
        const curvePoints: { input: string; output: string; reduction: string }[] = [];
        for (let i = 0; i < curve.inputLevels.length; i += 5) {
          curvePoints.push({
            input: curve.inputLevels[i] + ' dB',
            output: curve.outputLevels[i].toFixed(1) + ' dB',
            reduction: (curve.inputLevels[i] - curve.outputLevels[i] + makeupGain).toFixed(1) + ' dB'
          });
        }

        result = {
          operation: 'transfer_curve',
          settings: {
            threshold: threshold + ' dB',
            ratio: ratio + ':1',
            knee: knee + ' dB',
            makeupGain: makeupGain + ' dB'
          },
          curve: curvePoints,
          keyPoints: {
            thresholdPoint: {
              input: threshold + ' dB',
              output: (threshold + makeupGain) + ' dB'
            },
            kneeStart: (threshold - knee / 2) + ' dB',
            kneeEnd: (threshold + knee / 2) + ' dB'
          }
        };
        break;

      default:
        result = {
          error: `Unknown operation: ${operation}`,
          availableOperations: ['info', 'examples', 'demo', 'compress', 'multiband', 'sidechain', 'analyze', 'transfer_curve']
        };
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2)
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return {
      toolCallId: id,
      content: `Error: ${err}`,
      isError: true
    };
  }
}

export function iscompressorAvailable(): boolean {
  return true;
}
