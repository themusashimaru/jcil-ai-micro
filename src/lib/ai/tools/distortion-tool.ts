/**
 * DISTORTION TOOL
 * Comprehensive distortion and overdrive effect processor
 * Implements various clipping, waveshaping, and tube emulation algorithms
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const distortionTool: UnifiedTool = {
  name: 'distortion',
  description: 'Distortion and overdrive with multiple algorithms and tone shaping',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'examples', 'demo', 'overdrive', 'distortion', 'fuzz', 'bitcrush', 'waveshape', 'tube', 'analyze'],
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
      drive: {
        type: 'number',
        description: 'Drive/gain amount 0.0-1.0 (default: 0.5)'
      },
      tone: {
        type: 'number',
        description: 'Tone control 0.0-1.0 (default: 0.5)'
      },
      mix: {
        type: 'number',
        description: 'Wet/dry mix 0.0-1.0 (default: 1.0)'
      },
      outputLevel: {
        type: 'number',
        description: 'Output level in dB (default: 0)'
      },
      algorithm: {
        type: 'string',
        enum: ['soft', 'hard', 'asymmetric', 'tube', 'foldback', 'rectify'],
        description: 'Clipping algorithm'
      },
      bitDepth: {
        type: 'number',
        description: 'Bit depth for bitcrusher (1-16, default: 8)'
      },
      downsample: {
        type: 'number',
        description: 'Downsample factor for bitcrusher (default: 1)'
      }
    },
    required: ['operation']
  }
};

// Soft clipping (tanh-based)
function softClip(x: number, drive: number): number {
  const gain = 1 + drive * 20;
  return Math.tanh(x * gain);
}

// Hard clipping
function hardClip(x: number, drive: number): number {
  const gain = 1 + drive * 10;
  const threshold = 1 - drive * 0.8;
  const amplified = x * gain;
  return Math.max(-threshold, Math.min(threshold, amplified));
}

// Asymmetric clipping (like some tube/transistor circuits)
function asymmetricClip(x: number, drive: number): number {
  const gain = 1 + drive * 15;
  const amplified = x * gain;

  if (amplified > 0) {
    // Softer positive clipping
    return Math.tanh(amplified);
  } else {
    // Harder negative clipping
    const threshold = 0.7 - drive * 0.4;
    return Math.max(-threshold, amplified * 0.8);
  }
}

// Tube emulation (polynomial approximation)
function tubeClip(x: number, drive: number): number {
  const gain = 1 + drive * 8;
  const amplified = x * gain;

  // Polynomial waveshaping approximating tube saturation
  // Based on simplified triode transfer function
  if (amplified >= 0) {
    const t = Math.min(amplified, 1);
    return t - (t * t * t / 3);
  } else {
    const t = Math.max(amplified, -1);
    return t - (t * t * t / 3) * 0.5; // Asymmetric
  }
}

// Foldback distortion
function foldbackClip(x: number, drive: number): number {
  const gain = 1 + drive * 20;
  let amplified = x * gain;
  const threshold = 1 - drive * 0.7;

  // Fold signal back when it exceeds threshold
  while (Math.abs(amplified) > threshold) {
    if (amplified > threshold) {
      amplified = 2 * threshold - amplified;
    } else if (amplified < -threshold) {
      amplified = -2 * threshold - amplified;
    }
  }

  return amplified;
}

// Full-wave rectification distortion
function rectifyClip(x: number, drive: number): number {
  const gain = 1 + drive * 10;
  const amplified = x * gain;

  // Mix of original and rectified
  const rectified = Math.abs(amplified);
  const blend = drive;

  return (1 - blend) * Math.tanh(amplified) + blend * Math.tanh(rectified - 0.5);
}

// Get clipper function by algorithm name
function getClipper(algorithm: string): (x: number, drive: number) => number {
  switch (algorithm) {
    case 'soft': return softClip;
    case 'hard': return hardClip;
    case 'asymmetric': return asymmetricClip;
    case 'tube': return tubeClip;
    case 'foldback': return foldbackClip;
    case 'rectify': return rectifyClip;
    default: return softClip;
  }
}

// One-pole lowpass filter
function createLowpass(cutoffHz: number, sampleRate: number): (x: number) => number {
  const w0 = 2 * Math.PI * cutoffHz / sampleRate;
  const coeff = Math.exp(-w0);
  let state = 0;

  return (x: number) => {
    state = x * (1 - coeff) + state * coeff;
    return state;
  };
}

// One-pole highpass filter
function createHighpass(cutoffHz: number, sampleRate: number): (x: number) => number {
  const w0 = 2 * Math.PI * cutoffHz / sampleRate;
  const coeff = Math.exp(-w0);
  let state = 0;
  let lastInput = 0;

  return (x: number) => {
    state = coeff * (state + x - lastInput);
    lastInput = x;
    return state;
  };
}

// Overdrive effect
function overdrive(
  signal: number[],
  sampleRate: number,
  drive: number,
  tone: number,
  mix: number,
  outputLevel: number
): { output: number[]; analysis: object } {
  // Pre-filter (reduce bass before clipping to prevent mud)
  const preFilter = createHighpass(100 + tone * 400, sampleRate);

  // Post-filter (tone control)
  const postFilter = createLowpass(2000 + tone * 10000, sampleRate);

  const output: number[] = new Array(signal.length);
  const outputGain = Math.pow(10, outputLevel / 20);

  for (let i = 0; i < signal.length; i++) {
    // Pre-filter
    let processed = preFilter(signal[i]);

    // Soft clip
    processed = softClip(processed, drive);

    // Post-filter (tone)
    processed = postFilter(processed);

    // Mix and output level
    output[i] = (signal[i] * (1 - mix) + processed * mix) * outputGain;
  }

  return {
    output,
    analysis: {
      type: 'Overdrive',
      algorithm: 'Soft clipping (tanh)',
      drive: (drive * 100).toFixed(0) + '%',
      tone: (tone * 100).toFixed(0) + '%',
      mix: (mix * 100).toFixed(0) + '%',
      outputLevel: outputLevel + ' dB',
      character: drive < 0.3 ? 'Clean boost' : drive < 0.6 ? 'Warm crunch' : 'Saturated'
    }
  };
}

// Heavy distortion
function distortion(
  signal: number[],
  sampleRate: number,
  drive: number,
  tone: number,
  mix: number,
  outputLevel: number,
  algorithm: string
): { output: number[]; analysis: object } {
  const clipper = getClipper(algorithm);

  // More aggressive pre-filtering
  const preFilter = createHighpass(80 + drive * 200, sampleRate);
  const postFilter = createLowpass(3000 + tone * 12000, sampleRate);

  const output: number[] = new Array(signal.length);
  const outputGain = Math.pow(10, outputLevel / 20);

  for (let i = 0; i < signal.length; i++) {
    let processed = preFilter(signal[i]);
    processed = clipper(processed, drive);
    processed = postFilter(processed);
    output[i] = (signal[i] * (1 - mix) + processed * mix) * outputGain;
  }

  return {
    output,
    analysis: {
      type: 'Distortion',
      algorithm,
      drive: (drive * 100).toFixed(0) + '%',
      tone: (tone * 100).toFixed(0) + '%',
      mix: (mix * 100).toFixed(0) + '%',
      harmonics: algorithm === 'asymmetric' ? 'Odd + even (rich)' :
                 algorithm === 'tube' ? 'Even-dominant (warm)' :
                 algorithm === 'foldback' ? 'Complex (metallic)' : 'Odd-dominant (aggressive)'
    }
  };
}

// Fuzz effect
function fuzz(
  signal: number[],
  sampleRate: number,
  drive: number,
  tone: number,
  mix: number,
  outputLevel: number
): { output: number[]; analysis: object } {
  // Extreme pre-gain
  const preGain = 10 + drive * 90;

  // Gate threshold (cuts out very quiet signals like real fuzz)
  const gateThreshold = 0.01;

  const postFilter = createLowpass(1500 + tone * 8000, sampleRate);

  const output: number[] = new Array(signal.length);
  const outputGain = Math.pow(10, outputLevel / 20);

  for (let i = 0; i < signal.length; i++) {
    let processed = signal[i];

    // Gate
    if (Math.abs(processed) < gateThreshold) {
      processed = 0;
    } else {
      // Extreme amplification
      processed *= preGain;

      // Square wave clipping (very harsh)
      processed = processed > 0 ? 1 : -1;

      // Octave-up effect at high drives (rectification)
      if (drive > 0.7) {
        processed = processed * (0.5 + 0.5 * Math.abs(signal[i] * preGain));
      }
    }

    processed = postFilter(processed);
    output[i] = (signal[i] * (1 - mix) + processed * mix) * outputGain;
  }

  return {
    output,
    analysis: {
      type: 'Fuzz',
      character: 'Square wave clipping',
      drive: (drive * 100).toFixed(0) + '%',
      tone: (tone * 100).toFixed(0) + '%',
      octaveUp: drive > 0.7 ? 'Active' : 'Inactive',
      sustainType: 'Infinite (gated)'
    }
  };
}

// Bitcrusher
function bitcrush(
  signal: number[],
  sampleRate: number,
  bitDepth: number,
  downsampleFactor: number,
  mix: number
): { output: number[]; analysis: object } {
  const levels = Math.pow(2, bitDepth);
  const quantStep = 2 / levels;

  const output: number[] = new Array(signal.length);
  let holdSample = 0;

  for (let i = 0; i < signal.length; i++) {
    // Sample rate reduction
    if (i % downsampleFactor === 0) {
      // Bit depth reduction
      holdSample = Math.round(signal[i] / quantStep) * quantStep;
    }

    output[i] = signal[i] * (1 - mix) + holdSample * mix;
  }

  const effectiveSampleRate = sampleRate / downsampleFactor;

  return {
    output,
    analysis: {
      type: 'Bitcrusher',
      bitDepth,
      quantizationLevels: levels,
      downsampleFactor,
      effectiveSampleRate: effectiveSampleRate.toFixed(0) + ' Hz',
      nyquistFrequency: (effectiveSampleRate / 2).toFixed(0) + ' Hz',
      character: bitDepth <= 4 ? 'Lo-fi/chiptune' : bitDepth <= 8 ? 'Retro digital' : 'Subtle degradation'
    }
  };
}

// Custom waveshaping
function waveshape(
  signal: number[],
  sampleRate: number,
  transferCurve: number[],
  mix: number
): { output: number[]; analysis: object } {
  const output: number[] = new Array(signal.length);
  const curveSize = transferCurve.length;

  for (let i = 0; i < signal.length; i++) {
    // Map input [-1, 1] to curve index [0, curveSize-1]
    const normalizedInput = (signal[i] + 1) / 2; // 0 to 1
    const curveIndex = normalizedInput * (curveSize - 1);

    // Linear interpolation in transfer curve
    const idx1 = Math.floor(curveIndex);
    const idx2 = Math.min(idx1 + 1, curveSize - 1);
    const frac = curveIndex - idx1;

    const shaped = transferCurve[idx1] * (1 - frac) + transferCurve[idx2] * frac;

    output[i] = signal[i] * (1 - mix) + shaped * mix;
  }

  return {
    output,
    analysis: {
      type: 'Custom Waveshaper',
      curveSize,
      curvePreview: transferCurve.slice(0, 10).map(v => v.toFixed(3))
    }
  };
}

// Analyze distortion characteristics
function analyzeDistortion(
  algorithm: string,
  drive: number
): object {
  // Generate test signal (single cycle sine)
  const testSize = 256;
  const testSignal: number[] = [];
  for (let i = 0; i < testSize; i++) {
    testSignal.push(Math.sin(2 * Math.PI * i / testSize));
  }

  // Apply distortion
  const clipper = getClipper(algorithm);
  const distorted = testSignal.map(s => clipper(s, drive));

  // Simple harmonic analysis (DFT of first few harmonics)
  const harmonics: { harmonic: number; level: number }[] = [];

  for (let h = 1; h <= 8; h++) {
    let real = 0, imag = 0;
    for (let i = 0; i < testSize; i++) {
      const angle = 2 * Math.PI * h * i / testSize;
      real += distorted[i] * Math.cos(angle);
      imag += distorted[i] * Math.sin(angle);
    }
    const magnitude = Math.sqrt(real * real + imag * imag) / testSize * 2;
    harmonics.push({ harmonic: h, level: magnitude });
  }

  // Normalize to fundamental
  const fundamental = harmonics[0].level || 1;
  const normalizedHarmonics = harmonics.map(h => ({
    harmonic: h.harmonic,
    levelDb: (20 * Math.log10(h.level / fundamental)).toFixed(1)
  }));

  // Calculate THD
  const harmonicSum = harmonics.slice(1).reduce((sum, h) => sum + h.level * h.level, 0);
  const thd = Math.sqrt(harmonicSum) / fundamental * 100;

  return {
    algorithm,
    drive: (drive * 100).toFixed(0) + '%',
    harmonicContent: normalizedHarmonics,
    THD: thd.toFixed(2) + '%',
    character: {
      soft: 'Warm, musical compression',
      hard: 'Aggressive, squared edges',
      asymmetric: 'Rich harmonics, tube-like warmth',
      tube: 'Even harmonics, classic tube saturation',
      foldback: 'Complex overtones, metallic edge',
      rectify: 'Octave-up effect, synth-like'
    }[algorithm] || 'Unknown'
  };
}

export async function executedistortion(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation,
      signal = [],
      sampleRate = 44100,
      drive = 0.5,
      tone = 0.5,
      mix = 1.0,
      outputLevel = 0,
      algorithm = 'soft',
      bitDepth = 8,
      downsample = 1
    } = args;

    let result: object;

    switch (operation) {
      case 'info':
        result = {
          tool: 'distortion',
          description: 'Distortion and overdrive effects with multiple algorithms',
          modes: {
            overdrive: 'Soft, warm saturation (amp-like)',
            distortion: 'Harder clipping with algorithm selection',
            fuzz: 'Extreme square-wave clipping',
            bitcrush: 'Lo-fi digital degradation',
            waveshape: 'Custom transfer function',
            tube: 'Tube amplifier emulation'
          },
          algorithms: {
            soft: 'Tanh soft clipping (smooth)',
            hard: 'Hard clipping (aggressive)',
            asymmetric: 'Different pos/neg clipping (rich)',
            tube: 'Polynomial tube emulation (warm)',
            foldback: 'Folds back at threshold (metallic)',
            rectify: 'Full-wave rectification (synthy)'
          },
          parameters: {
            drive: 'Amount of gain/saturation (0-1)',
            tone: 'Brightness control (0-1)',
            mix: 'Wet/dry blend',
            outputLevel: 'Output gain in dB'
          }
        };
        break;

      case 'examples':
        result = {
          warmOverdrive: {
            description: 'Subtle tube-like warmth',
            parameters: {
              operation: 'overdrive',
              drive: 0.3,
              tone: 0.6
            }
          },
          heavyDistortion: {
            description: 'Heavy rock distortion',
            parameters: {
              operation: 'distortion',
              drive: 0.8,
              tone: 0.4,
              algorithm: 'hard'
            }
          },
          retroBitcrush: {
            description: '8-bit chiptune effect',
            parameters: {
              operation: 'bitcrush',
              bitDepth: 4,
              downsample: 8
            }
          }
        };
        break;

      case 'demo':
        const demoSignal: number[] = [];
        for (let i = 0; i < 2000; i++) {
          demoSignal.push(Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.7);
        }

        const demoResult = overdrive(demoSignal, sampleRate, 0.6, 0.5, 1.0, 0);

        result = {
          demo: 'Overdrive on 440Hz sine wave',
          inputSignal: {
            type: '440Hz sine wave',
            amplitude: 0.7
          },
          settings: {
            drive: '60%',
            tone: '50%'
          },
          outputPreview: demoResult.output.slice(0, 50).map(v => v.toFixed(4)),
          analysis: demoResult.analysis
        };
        break;

      case 'overdrive':
        if (signal.length === 0) {
          throw new Error('Signal array is required');
        }

        const odResult = overdrive(signal, sampleRate, drive, tone, mix, outputLevel);

        result = {
          operation: 'overdrive',
          inputLength: signal.length,
          output: odResult.output.slice(0, 100),
          analysis: odResult.analysis
        };
        break;

      case 'distortion':
        if (signal.length === 0) {
          throw new Error('Signal array is required');
        }

        const distResult = distortion(signal, sampleRate, drive, tone, mix, outputLevel, algorithm);

        result = {
          operation: 'distortion',
          inputLength: signal.length,
          output: distResult.output.slice(0, 100),
          analysis: distResult.analysis
        };
        break;

      case 'fuzz':
        if (signal.length === 0) {
          throw new Error('Signal array is required');
        }

        const fuzzResult = fuzz(signal, sampleRate, drive, tone, mix, outputLevel);

        result = {
          operation: 'fuzz',
          inputLength: signal.length,
          output: fuzzResult.output.slice(0, 100),
          analysis: fuzzResult.analysis
        };
        break;

      case 'bitcrush':
        if (signal.length === 0) {
          throw new Error('Signal array is required');
        }

        const bcResult = bitcrush(
          signal,
          sampleRate,
          Math.max(1, Math.min(16, bitDepth)),
          Math.max(1, downsample),
          mix
        );

        result = {
          operation: 'bitcrush',
          inputLength: signal.length,
          output: bcResult.output.slice(0, 100),
          analysis: bcResult.analysis
        };
        break;

      case 'waveshape':
        if (signal.length === 0) {
          throw new Error('Signal array is required');
        }

        // Generate default sigmoid-like curve if none provided
        const defaultCurve: number[] = [];
        for (let i = 0; i < 256; i++) {
          const x = (i / 255) * 2 - 1; // -1 to 1
          defaultCurve.push(Math.tanh(x * (1 + drive * 10)));
        }

        const wsResult = waveshape(signal, sampleRate, args.transferCurve || defaultCurve, mix);

        result = {
          operation: 'waveshape',
          inputLength: signal.length,
          output: wsResult.output.slice(0, 100),
          analysis: wsResult.analysis
        };
        break;

      case 'tube':
        if (signal.length === 0) {
          throw new Error('Signal array is required');
        }

        const tubeResult = distortion(signal, sampleRate, drive, tone, mix, outputLevel, 'tube');

        result = {
          operation: 'tube',
          inputLength: signal.length,
          output: tubeResult.output.slice(0, 100),
          analysis: {
            ...tubeResult.analysis,
            type: 'Tube Emulation',
            description: 'Polynomial approximation of triode saturation'
          }
        };
        break;

      case 'analyze':
        result = {
          operation: 'analyze',
          analysis: analyzeDistortion(algorithm, drive)
        };
        break;

      default:
        result = {
          error: `Unknown operation: ${operation}`,
          availableOperations: ['info', 'examples', 'demo', 'overdrive', 'distortion', 'fuzz', 'bitcrush', 'waveshape', 'tube', 'analyze']
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

export function isdistortionAvailable(): boolean {
  return true;
}
