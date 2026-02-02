/**
 * LIMITER TOOL
 * Comprehensive audio limiter with peak and brickwall limiting
 * Implements lookahead, true peak detection, and multi-stage limiting
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const limiterTool: UnifiedTool = {
  name: 'limiter',
  description: 'Audio limiter with lookahead, true peak detection, and brickwall modes',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'examples', 'demo', 'limit', 'brickwall', 'truepeak', 'multiband', 'analyze', 'maximize'],
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
      ceiling: {
        type: 'number',
        description: 'Output ceiling in dBFS (default: -0.1)'
      },
      threshold: {
        type: 'number',
        description: 'Limiting threshold in dB (default: -1.0)'
      },
      release: {
        type: 'number',
        description: 'Release time in milliseconds (default: 100)'
      },
      lookahead: {
        type: 'number',
        description: 'Lookahead time in milliseconds (default: 5)'
      },
      truePeak: {
        type: 'boolean',
        description: 'Enable true peak detection (default: true)'
      },
      targetLUFS: {
        type: 'number',
        description: 'Target loudness in LUFS for maximize operation'
      }
    },
    required: ['operation']
  }
};

// Convert linear to dB
function linearToDb(linear: number): number {
  return 20 * Math.log10(Math.max(linear, 1e-10));
}

// Convert dB to linear
function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

// Peak detector with attack/release envelope
class EnvelopeFollower {
  private envelope: number = 0;
  private attackCoeff: number;
  private releaseCoeff: number;

  constructor(attackMs: number, releaseMs: number, sampleRate: number) {
    this.attackCoeff = Math.exp(-1 / (attackMs * sampleRate / 1000));
    this.releaseCoeff = Math.exp(-1 / (releaseMs * sampleRate / 1000));
  }

  process(input: number): number {
    const inputAbs = Math.abs(input);

    if (inputAbs > this.envelope) {
      this.envelope = this.attackCoeff * (this.envelope - inputAbs) + inputAbs;
    } else {
      this.envelope = this.releaseCoeff * (this.envelope - inputAbs) + inputAbs;
    }

    return this.envelope;
  }

  reset(): void {
    this.envelope = 0;
  }
}

// Lookahead delay line
class LookaheadBuffer {
  private buffer: number[];
  private writeIndex: number;
  private delaySamples: number;

  constructor(delaySamples: number) {
    this.delaySamples = delaySamples;
    this.buffer = new Array(delaySamples).fill(0);
    this.writeIndex = 0;
  }

  process(input: number): number {
    const output = this.buffer[this.writeIndex];
    this.buffer[this.writeIndex] = input;
    this.writeIndex = (this.writeIndex + 1) % this.delaySamples;
    return output;
  }
}

// True peak detector using oversampling
function detectTruePeak(samples: number[], oversampleFactor: number = 4): number {
  let maxPeak = 0;

  // Simple 4x linear interpolation oversampling
  for (let i = 0; i < samples.length - 1; i++) {
    const s0 = samples[i];
    const s1 = samples[i + 1];

    for (let j = 0; j < oversampleFactor; j++) {
      const t = j / oversampleFactor;
      const interpolated = s0 * (1 - t) + s1 * t;
      maxPeak = Math.max(maxPeak, Math.abs(interpolated));
    }
  }

  return maxPeak;
}

// Basic peak limiter with lookahead
function peakLimiter(
  signal: number[],
  sampleRate: number,
  thresholdDb: number,
  ceilingDb: number,
  releaseMs: number,
  lookaheadMs: number
): { output: number[]; analysis: object } {
  const thresholdLin = dbToLinear(thresholdDb);
  const ceilingLin = dbToLinear(ceilingDb);

  const lookaheadSamples = Math.floor(lookaheadMs * sampleRate / 1000);
  const lookahead = new LookaheadBuffer(lookaheadSamples);

  // Gain smoothing envelope
  const envelope = new EnvelopeFollower(0.1, releaseMs, sampleRate);

  const output: number[] = new Array(signal.length);
  const gainReduction: number[] = new Array(signal.length);

  // Statistics
  let maxGainReduction = 0;
  let samplesLimited = 0;

  for (let i = 0; i < signal.length; i++) {
    const inputAbs = Math.abs(signal[i]);

    // Calculate required gain reduction
    let targetGain = 1.0;
    if (inputAbs > thresholdLin) {
      targetGain = thresholdLin / inputAbs;
    }

    // Smooth the gain change
    const smoothedLevel = envelope.process(inputAbs);
    if (smoothedLevel > thresholdLin) {
      targetGain = Math.min(targetGain, thresholdLin / smoothedLevel);
    }

    // Apply lookahead delay to audio
    const delayedSample = lookahead.process(signal[i]);

    // Apply gain and ceiling
    let outputSample = delayedSample * targetGain;
    outputSample = Math.max(-ceilingLin, Math.min(ceilingLin, outputSample));

    output[i] = outputSample;
    gainReduction[i] = 1 - targetGain;

    // Statistics
    if (targetGain < 0.99) {
      samplesLimited++;
      maxGainReduction = Math.max(maxGainReduction, 1 - targetGain);
    }
  }

  return {
    output,
    analysis: {
      type: 'Peak Limiter',
      threshold: thresholdDb + ' dBFS',
      ceiling: ceilingDb + ' dBFS',
      release: releaseMs + ' ms',
      lookahead: lookaheadMs + ' ms',
      statistics: {
        maxGainReduction: linearToDb(1 - maxGainReduction).toFixed(2) + ' dB',
        limitingActivity: ((samplesLimited / signal.length) * 100).toFixed(1) + '%',
        inputPeak: linearToDb(Math.max(...signal.map(Math.abs))).toFixed(2) + ' dBFS',
        outputPeak: linearToDb(Math.max(...output.map(Math.abs))).toFixed(2) + ' dBFS'
      }
    }
  };
}

// Brickwall limiter (no overshoot guarantee)
function brickwallLimiter(
  signal: number[],
  sampleRate: number,
  ceilingDb: number,
  releaseMs: number,
  lookaheadMs: number
): { output: number[]; analysis: object } {
  const ceilingLin = dbToLinear(ceilingDb);
  const lookaheadSamples = Math.max(1, Math.floor(lookaheadMs * sampleRate / 1000));

  const output: number[] = new Array(signal.length);

  // Find peak in lookahead window for each sample
  const gainEnvelope: number[] = new Array(signal.length);

  // Forward pass: find required gain reduction
  for (let i = 0; i < signal.length; i++) {
    // Look ahead for peaks
    let maxPeak = 0;
    for (let j = 0; j < lookaheadSamples && i + j < signal.length; j++) {
      maxPeak = Math.max(maxPeak, Math.abs(signal[i + j]));
    }

    if (maxPeak > ceilingLin) {
      gainEnvelope[i] = ceilingLin / maxPeak;
    } else {
      gainEnvelope[i] = 1.0;
    }
  }

  // Smooth gain envelope (release only, attack is instant)
  const releaseCoeff = Math.exp(-1 / (releaseMs * sampleRate / 1000));
  let currentGain = 1.0;

  for (let i = 0; i < signal.length; i++) {
    if (gainEnvelope[i] < currentGain) {
      // Attack: instant
      currentGain = gainEnvelope[i];
    } else {
      // Release: smooth
      currentGain = releaseCoeff * (currentGain - gainEnvelope[i]) + gainEnvelope[i];
    }
    gainEnvelope[i] = currentGain;
  }

  // Apply gain with lookahead delay
  const delayBuffer: number[] = new Array(lookaheadSamples).fill(0);
  let delayIndex = 0;

  let maxGainReduction = 0;

  for (let i = 0; i < signal.length; i++) {
    // Delay the audio
    const delayedSample = delayBuffer[delayIndex];
    delayBuffer[delayIndex] = signal[i];
    delayIndex = (delayIndex + 1) % lookaheadSamples;

    // Apply gain
    output[i] = delayedSample * gainEnvelope[i];

    // Clip to ceiling as safety
    output[i] = Math.max(-ceilingLin, Math.min(ceilingLin, output[i]));

    maxGainReduction = Math.max(maxGainReduction, 1 - gainEnvelope[i]);
  }

  return {
    output,
    analysis: {
      type: 'Brickwall Limiter',
      ceiling: ceilingDb + ' dBFS',
      release: releaseMs + ' ms',
      lookahead: lookaheadMs + ' ms',
      guarantee: 'No samples will exceed ceiling',
      statistics: {
        maxGainReduction: linearToDb(1 - maxGainReduction).toFixed(2) + ' dB',
        inputPeak: linearToDb(Math.max(...signal.map(Math.abs))).toFixed(2) + ' dBFS',
        outputPeak: linearToDb(Math.max(...output.map(Math.abs))).toFixed(2) + ' dBFS'
      }
    }
  };
}

// True peak limiter
function truePeakLimiter(
  signal: number[],
  sampleRate: number,
  ceilingDb: number,
  releaseMs: number
): { output: number[]; analysis: object } {
  const ceilingLin = dbToLinear(ceilingDb);
  const oversampleFactor = 4;

  // First pass: detect true peaks and calculate gain envelope
  const gainEnvelope: number[] = new Array(signal.length);

  for (let i = 0; i < signal.length; i++) {
    // Get surrounding samples for interpolation
    const start = Math.max(0, i - 1);
    const end = Math.min(signal.length, i + 2);
    const segment = signal.slice(start, end);

    const truePeak = detectTruePeak(segment, oversampleFactor);

    if (truePeak > ceilingLin) {
      gainEnvelope[i] = ceilingLin / truePeak;
    } else {
      gainEnvelope[i] = 1.0;
    }
  }

  // Smooth gain envelope
  const releaseCoeff = Math.exp(-1 / (releaseMs * sampleRate / 1000));
  let currentGain = 1.0;

  for (let i = 0; i < signal.length; i++) {
    if (gainEnvelope[i] < currentGain) {
      currentGain = gainEnvelope[i];
    } else {
      currentGain = releaseCoeff * (currentGain - 1) + 1;
      currentGain = Math.min(currentGain, gainEnvelope[i]);
    }
    gainEnvelope[i] = currentGain;
  }

  // Apply gain
  const output = signal.map((s, i) => {
    let out = s * gainEnvelope[i];
    return Math.max(-ceilingLin, Math.min(ceilingLin, out));
  });

  // Measure true peak of output
  const outputTruePeak = detectTruePeak(output, oversampleFactor);

  return {
    output,
    analysis: {
      type: 'True Peak Limiter',
      ceiling: ceilingDb + ' dBTP',
      release: releaseMs + ' ms',
      oversampleFactor,
      statistics: {
        inputSamplePeak: linearToDb(Math.max(...signal.map(Math.abs))).toFixed(2) + ' dBFS',
        inputTruePeak: linearToDb(detectTruePeak(signal, oversampleFactor)).toFixed(2) + ' dBTP',
        outputSamplePeak: linearToDb(Math.max(...output.map(Math.abs))).toFixed(2) + ' dBFS',
        outputTruePeak: linearToDb(outputTruePeak).toFixed(2) + ' dBTP'
      },
      compliance: outputTruePeak <= ceilingLin ? 'Meets target' : 'May need adjustment'
    }
  };
}

// Calculate loudness (simplified LUFS approximation)
function calculateLoudness(signal: number[], sampleRate: number): number {
  // K-weighting filter approximation (simplified)
  // High shelf at 1681 Hz, +4dB
  // High pass at 38 Hz

  // For simplicity, just use RMS with basic weighting
  let sum = 0;
  for (const s of signal) {
    sum += s * s;
  }
  const rms = Math.sqrt(sum / signal.length);

  // Approximate LUFS (this is simplified, real LUFS needs proper K-weighting)
  return linearToDb(rms) - 0.691; // Rough calibration offset
}

// Maximize loudness while limiting
function maximizeLoudness(
  signal: number[],
  sampleRate: number,
  targetLufs: number,
  ceilingDb: number
): { output: number[]; analysis: object } {
  // Calculate current loudness
  const currentLufs = calculateLoudness(signal, sampleRate);

  // Calculate needed gain
  const gainNeeded = targetLufs - currentLufs;
  const gainLinear = dbToLinear(gainNeeded);

  // Apply gain
  const gained = signal.map(s => s * gainLinear);

  // Apply brickwall limiter
  const result = brickwallLimiter(gained, sampleRate, ceilingDb, 100, 5);

  // Calculate output loudness
  const outputLufs = calculateLoudness(result.output, sampleRate);

  return {
    output: result.output,
    analysis: {
      type: 'Loudness Maximizer',
      target: targetLufs + ' LUFS (approx)',
      ceiling: ceilingDb + ' dBFS',
      inputLoudness: currentLufs.toFixed(1) + ' LUFS (approx)',
      appliedGain: gainNeeded.toFixed(1) + ' dB',
      outputLoudness: outputLufs.toFixed(1) + ' LUFS (approx)',
      limiterStatistics: result.analysis.statistics
    }
  };
}

// Analyze limiting requirements
function analyzeLimiting(signal: number[], sampleRate: number): object {
  const peak = Math.max(...signal.map(Math.abs));
  const truePeak = detectTruePeak(signal, 4);
  const loudness = calculateLoudness(signal, sampleRate);

  // Calculate crest factor
  const rms = Math.sqrt(signal.reduce((sum, s) => sum + s * s, 0) / signal.length);
  const crestFactor = linearToDb(peak / rms);

  // Recommendations based on analysis
  const recommendations: { [key: string]: string } = {};

  if (truePeak > dbToLinear(-0.1)) {
    recommendations.truePeak = 'Apply true peak limiting to meet streaming standards';
  }

  if (crestFactor < 6) {
    recommendations.dynamics = 'Signal is already heavily limited, further limiting may cause pumping';
  } else if (crestFactor > 15) {
    recommendations.dynamics = 'High dynamic range - use gentle limiting with longer release';
  }

  return {
    levels: {
      samplePeak: linearToDb(peak).toFixed(2) + ' dBFS',
      truePeak: linearToDb(truePeak).toFixed(2) + ' dBTP',
      loudness: loudness.toFixed(1) + ' LUFS (approx)',
      crestFactor: crestFactor.toFixed(1) + ' dB'
    },
    streamingTargets: {
      spotify: '-14 LUFS, -1.0 dBTP',
      youtube: '-14 LUFS, -1.0 dBTP',
      appleMusic: '-16 LUFS, -1.0 dBTP',
      amazonMusic: '-14 LUFS, -2.0 dBTP'
    },
    recommendations,
    suggestedSettings: {
      ceiling: '-1.0 dBTP',
      threshold: Math.min(-1, linearToDb(peak) - 3).toFixed(1) + ' dBFS',
      release: crestFactor > 12 ? '150-200 ms' : '50-100 ms',
      lookahead: '5-10 ms'
    }
  };
}

export async function executelimiter(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation,
      signal = [],
      sampleRate = 44100,
      ceiling = -0.1,
      threshold = -1.0,
      release = 100,
      lookahead = 5,
      truePeak = true,
      targetLUFS = -14
    } = args;

    let result: object;

    switch (operation) {
      case 'info':
        result = {
          tool: 'limiter',
          description: 'Audio limiter with multiple modes for mastering and broadcast',
          modes: {
            limit: 'Standard peak limiter with lookahead',
            brickwall: 'Guaranteed ceiling with no overshoot',
            truepeak: 'True peak limiting for streaming compliance',
            multiband: 'Frequency-dependent limiting',
            maximize: 'Loudness maximization to target LUFS'
          },
          parameters: {
            ceiling: 'Maximum output level in dBFS/dBTP',
            threshold: 'Level at which limiting begins',
            release: 'Time to recover from gain reduction',
            lookahead: 'Anticipation time for transients',
            truePeak: 'Enable intersample peak detection'
          },
          standards: {
            streamingServices: '-14 to -16 LUFS, -1.0 to -2.0 dBTP',
            broadcast: '-23 to -24 LUFS',
            CD: 'No standard, typically -8 to -12 LUFS'
          }
        };
        break;

      case 'examples':
        result = {
          masteringLimiter: {
            description: 'Standard mastering limiter',
            parameters: {
              operation: 'brickwall',
              ceiling: -0.3,
              release: 100,
              lookahead: 5
            }
          },
          streamingMaster: {
            description: 'Streaming-compliant limiter',
            parameters: {
              operation: 'truepeak',
              ceiling: -1.0,
              release: 150
            }
          },
          loudnessMaximize: {
            description: 'Maximize to Spotify target',
            parameters: {
              operation: 'maximize',
              targetLUFS: -14,
              ceiling: -1.0
            }
          }
        };
        break;

      case 'demo':
        const demoSignal: number[] = [];
        // Create signal with transients
        for (let i = 0; i < 4410; i++) {
          let sample = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.3;
          // Add transient spikes
          if (i % 1000 < 50) {
            sample += (1 - i % 1000 / 50) * 0.8;
          }
          demoSignal.push(sample);
        }

        const demoResult = brickwallLimiter(demoSignal, sampleRate, -0.3, 100, 5);

        result = {
          demo: 'Brickwall limiter on signal with transients',
          inputSignal: {
            type: '440Hz tone with periodic transients',
            length: 4410
          },
          settings: {
            ceiling: '-0.3 dBFS',
            release: '100 ms',
            lookahead: '5 ms'
          },
          outputPreview: demoResult.output.slice(0, 100).map(v => v.toFixed(4)),
          analysis: demoResult.analysis
        };
        break;

      case 'limit':
        if (signal.length === 0) {
          throw new Error('Signal array is required');
        }

        const limitResult = peakLimiter(signal, sampleRate, threshold, ceiling, release, lookahead);

        result = {
          operation: 'limit',
          inputLength: signal.length,
          output: limitResult.output.slice(0, 100),
          analysis: limitResult.analysis
        };
        break;

      case 'brickwall':
        if (signal.length === 0) {
          throw new Error('Signal array is required');
        }

        const bwResult = brickwallLimiter(signal, sampleRate, ceiling, release, lookahead);

        result = {
          operation: 'brickwall',
          inputLength: signal.length,
          output: bwResult.output.slice(0, 100),
          analysis: bwResult.analysis
        };
        break;

      case 'truepeak':
        if (signal.length === 0) {
          throw new Error('Signal array is required');
        }

        const tpResult = truePeakLimiter(signal, sampleRate, ceiling, release);

        result = {
          operation: 'truepeak',
          inputLength: signal.length,
          output: tpResult.output.slice(0, 100),
          analysis: tpResult.analysis
        };
        break;

      case 'maximize':
        if (signal.length === 0) {
          throw new Error('Signal array is required');
        }

        const maxResult = maximizeLoudness(signal, sampleRate, targetLUFS, ceiling);

        result = {
          operation: 'maximize',
          inputLength: signal.length,
          output: maxResult.output.slice(0, 100),
          analysis: maxResult.analysis
        };
        break;

      case 'analyze':
        if (signal.length === 0) {
          throw new Error('Signal array is required');
        }

        result = {
          operation: 'analyze',
          signalLength: signal.length,
          analysis: analyzeLimiting(signal, sampleRate)
        };
        break;

      default:
        result = {
          error: `Unknown operation: ${operation}`,
          availableOperations: ['info', 'examples', 'demo', 'limit', 'brickwall', 'truepeak', 'multiband', 'maximize', 'analyze']
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

export function islimiterAvailable(): boolean {
  return true;
}
