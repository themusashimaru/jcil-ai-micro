/**
 * CHORUS-EFFECT TOOL
 * Comprehensive chorus modulation effect processor
 * Implements classic chorus, ensemble, and flanger modes
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const choruseffectTool: UnifiedTool = {
  name: 'chorus_effect',
  description: 'Chorus modulation effect with ensemble, flanger, and vibrato modes',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'examples', 'demo', 'chorus', 'ensemble', 'flanger', 'vibrato', 'analyze'],
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
      rate: {
        type: 'number',
        description: 'LFO rate in Hz (default: 1.0)'
      },
      depth: {
        type: 'number',
        description: 'Modulation depth in ms (default: 3)'
      },
      delay: {
        type: 'number',
        description: 'Base delay in ms (default: 7)'
      },
      feedback: {
        type: 'number',
        description: 'Feedback amount -1.0 to 1.0 (default: 0)'
      },
      wetLevel: {
        type: 'number',
        description: 'Wet signal level 0.0-1.0 (default: 0.5)'
      },
      dryLevel: {
        type: 'number',
        description: 'Dry signal level 0.0-1.0 (default: 1.0)'
      },
      voices: {
        type: 'number',
        description: 'Number of chorus voices (default: 2)'
      },
      spread: {
        type: 'number',
        description: 'Stereo spread 0.0-1.0 (default: 0.5)'
      }
    },
    required: ['operation']
  }
};

// Delay line with interpolation
class ModulatedDelayLine {
  private buffer: number[];
  private writeIndex: number;
  private maxDelay: number;

  constructor(maxDelaySamples: number) {
    this.maxDelay = maxDelaySamples;
    this.buffer = new Array(maxDelaySamples).fill(0);
    this.writeIndex = 0;
  }

  write(sample: number): void {
    this.buffer[this.writeIndex] = sample;
    this.writeIndex = (this.writeIndex + 1) % this.maxDelay;
  }

  // Cubic interpolation for smoother modulation
  readCubic(delaySamples: number): number {
    const intDelay = Math.floor(delaySamples);
    const frac = delaySamples - intDelay;

    const idx0 = (this.writeIndex - intDelay - 1 + this.maxDelay) % this.maxDelay;
    const idx1 = (this.writeIndex - intDelay + this.maxDelay) % this.maxDelay;
    const idx2 = (this.writeIndex - intDelay + 1 + this.maxDelay) % this.maxDelay;
    const idx3 = (this.writeIndex - intDelay + 2 + this.maxDelay) % this.maxDelay;

    const y0 = this.buffer[idx0];
    const y1 = this.buffer[idx1];
    const y2 = this.buffer[idx2];
    const y3 = this.buffer[idx3];

    // Cubic Hermite interpolation
    const c0 = y1;
    const c1 = 0.5 * (y2 - y0);
    const c2 = y0 - 2.5 * y1 + 2 * y2 - 0.5 * y3;
    const c3 = 0.5 * (y3 - y0) + 1.5 * (y1 - y2);

    return ((c3 * frac + c2) * frac + c1) * frac + c0;
  }
}

// LFO types
type LFOShape = 'sine' | 'triangle' | 'random';

function generateLFO(phase: number, shape: LFOShape, lastRandom: number): { value: number; newRandom: number } {
  let value: number;
  let newRandom = lastRandom;

  switch (shape) {
    case 'sine':
      value = Math.sin(phase);
      break;
    case 'triangle':
      const normalized = (phase / (2 * Math.PI)) % 1;
      value = normalized < 0.5 ? 4 * normalized - 1 : 3 - 4 * normalized;
      break;
    case 'random':
      // Smoothed random (sample & hold with interpolation)
      if (phase % (2 * Math.PI) < 0.01) {
        newRandom = Math.random() * 2 - 1;
      }
      value = newRandom;
      break;
    default:
      value = Math.sin(phase);
  }

  return { value, newRandom };
}

// Single voice chorus
function singleVoiceChorus(
  signal: number[],
  sampleRate: number,
  rateHz: number,
  depthMs: number,
  baseDelayMs: number,
  feedback: number,
  wetLevel: number,
  dryLevel: number,
  lfoShape: LFOShape = 'sine',
  startPhase: number = 0
): { output: number[]; analysis: object } {
  const baseDelaySamples = baseDelayMs * sampleRate / 1000;
  const depthSamples = depthMs * sampleRate / 1000;
  const maxDelay = Math.floor(baseDelaySamples + depthSamples) + 100;

  const delayLine = new ModulatedDelayLine(maxDelay);

  const output: number[] = new Array(signal.length);
  const lfoIncrement = 2 * Math.PI * rateHz / sampleRate;
  let lfoPhase = startPhase;
  let lastRandom = 0;

  const clampedFeedback = Math.max(-0.95, Math.min(0.95, feedback));

  for (let i = 0; i < signal.length; i++) {
    // Calculate modulated delay
    const lfoResult = generateLFO(lfoPhase, lfoShape, lastRandom);
    lastRandom = lfoResult.newRandom;

    const currentDelay = baseDelaySamples + lfoResult.value * depthSamples;

    // Read delayed sample
    const delayed = delayLine.readCubic(Math.max(1, currentDelay));

    // Write to delay line with feedback
    delayLine.write(signal[i] + delayed * clampedFeedback);

    // Mix
    output[i] = signal[i] * dryLevel + delayed * wetLevel;

    // Update LFO
    lfoPhase += lfoIncrement;
    if (lfoPhase > 2 * Math.PI) lfoPhase -= 2 * Math.PI;
  }

  return {
    output,
    analysis: {
      type: 'Single Voice Chorus',
      rate: rateHz + ' Hz',
      depth: depthMs + ' ms',
      baseDelay: baseDelayMs + ' ms',
      delayRange: `${(baseDelayMs - depthMs).toFixed(1)} - ${(baseDelayMs + depthMs).toFixed(1)} ms`,
      feedback: (feedback * 100).toFixed(0) + '%',
      lfoShape
    }
  };
}

// Multi-voice ensemble chorus
function ensembleChorus(
  signal: number[],
  sampleRate: number,
  voices: number,
  rateHz: number,
  depthMs: number,
  baseDelayMs: number,
  spread: number,
  wetLevel: number,
  dryLevel: number
): { outputLeft: number[]; outputRight: number[]; analysis: object } {
  const baseDelaySamples = baseDelayMs * sampleRate / 1000;
  const depthSamples = depthMs * sampleRate / 1000;
  const maxDelay = Math.floor(baseDelaySamples + depthSamples) + 100;

  // Create delay lines for each voice
  const delayLines: ModulatedDelayLine[] = [];
  const lfoPhases: number[] = [];
  const voicePans: number[] = [];

  for (let v = 0; v < voices; v++) {
    delayLines.push(new ModulatedDelayLine(maxDelay));
    // Spread LFO phases evenly
    lfoPhases.push((2 * Math.PI * v) / voices);
    // Spread panning
    voicePans.push((v / (voices - 1 || 1)) * 2 - 1); // -1 to 1
  }

  const outputLeft: number[] = new Array(signal.length).fill(0);
  const outputRight: number[] = new Array(signal.length).fill(0);

  const lfoIncrement = 2 * Math.PI * rateHz / sampleRate;

  // Slightly different rates for each voice (adds richness)
  const rateVariation = 0.1;

  for (let i = 0; i < signal.length; i++) {
    let wetLeft = 0;
    let wetRight = 0;

    for (let v = 0; v < voices; v++) {
      // Calculate modulated delay for this voice
      const voicePhase = lfoPhases[v];
      const voiceRate = 1 + (v / voices - 0.5) * rateVariation;
      const lfoValue = Math.sin(voicePhase);

      // Slightly different depth per voice
      const voiceDepth = depthSamples * (0.9 + 0.2 * (v / voices));
      const currentDelay = baseDelaySamples + lfoValue * voiceDepth;

      // Read delayed sample
      const delayed = delayLines[v].readCubic(Math.max(1, currentDelay));

      // Write to delay line
      delayLines[v].write(signal[i]);

      // Pan this voice
      const pan = voicePans[v] * spread;
      const leftGain = Math.cos((pan + 1) * Math.PI / 4);
      const rightGain = Math.sin((pan + 1) * Math.PI / 4);

      wetLeft += delayed * leftGain;
      wetRight += delayed * rightGain;

      // Update this voice's LFO
      lfoPhases[v] += lfoIncrement * voiceRate;
      if (lfoPhases[v] > 2 * Math.PI) lfoPhases[v] -= 2 * Math.PI;
    }

    // Normalize by voice count and mix
    const voiceNorm = 1 / Math.sqrt(voices);
    outputLeft[i] = signal[i] * dryLevel + wetLeft * voiceNorm * wetLevel;
    outputRight[i] = signal[i] * dryLevel + wetRight * voiceNorm * wetLevel;
  }

  return {
    outputLeft,
    outputRight,
    analysis: {
      type: 'Ensemble Chorus',
      voices,
      rate: rateHz + ' Hz',
      depth: depthMs + ' ms',
      baseDelay: baseDelayMs + ' ms',
      stereoSpread: (spread * 100).toFixed(0) + '%',
      wetLevel: (wetLevel * 100).toFixed(0) + '%'
    }
  };
}

// Flanger effect (short delay, high feedback, often inverted)
function flangerEffect(
  signal: number[],
  sampleRate: number,
  rateHz: number,
  depthMs: number,
  feedback: number,
  wetLevel: number,
  dryLevel: number
): { output: number[]; analysis: object } {
  // Flanger uses very short delays (0.1 - 5ms typically)
  const baseDelayMs = 2;
  const actualDepth = Math.min(depthMs, 5);

  const result = singleVoiceChorus(
    signal,
    sampleRate,
    rateHz,
    actualDepth,
    baseDelayMs,
    feedback,
    wetLevel,
    dryLevel,
    'triangle'
  );

  return {
    output: result.output,
    analysis: {
      type: 'Flanger',
      rate: rateHz + ' Hz',
      depth: actualDepth + ' ms',
      feedback: (feedback * 100).toFixed(0) + '%',
      comb_filtering: feedback < 0 ? 'Inverted (hollow sound)' : 'Normal (jet-like)',
      minDelay: (baseDelayMs - actualDepth).toFixed(2) + ' ms',
      maxDelay: (baseDelayMs + actualDepth).toFixed(2) + ' ms'
    }
  };
}

// Vibrato effect (pitch modulation only, no dry signal)
function vibratoEffect(
  signal: number[],
  sampleRate: number,
  rateHz: number,
  depthMs: number
): { output: number[]; analysis: object } {
  const baseDelayMs = depthMs + 1; // Center delay
  const depthSamples = depthMs * sampleRate / 1000;
  const baseDelaySamples = baseDelayMs * sampleRate / 1000;
  const maxDelay = Math.floor(baseDelaySamples + depthSamples) + 100;

  const delayLine = new ModulatedDelayLine(maxDelay);
  const output: number[] = new Array(signal.length);

  const lfoIncrement = 2 * Math.PI * rateHz / sampleRate;
  let lfoPhase = 0;

  for (let i = 0; i < signal.length; i++) {
    const lfoValue = Math.sin(lfoPhase);
    const currentDelay = baseDelaySamples + lfoValue * depthSamples;

    delayLine.write(signal[i]);
    output[i] = delayLine.readCubic(Math.max(1, currentDelay));

    lfoPhase += lfoIncrement;
    if (lfoPhase > 2 * Math.PI) lfoPhase -= 2 * Math.PI;
  }

  // Calculate pitch deviation
  const maxPitchCents = (depthMs / baseDelayMs) * 1200 * rateHz / 1000;

  return {
    output,
    analysis: {
      type: 'Vibrato',
      rate: rateHz + ' Hz',
      depth: depthMs + ' ms',
      pitchDeviation: `±${maxPitchCents.toFixed(1)} cents (approx)`,
      description: 'Pure pitch modulation without dry signal'
    }
  };
}

export async function executechoruseffect(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation,
      signal = [],
      sampleRate = 44100,
      rate = 1.0,
      depth = 3,
      delay = 7,
      feedback = 0,
      wetLevel = 0.5,
      dryLevel = 1.0,
      voices = 2,
      spread = 0.5
    } = args;

    let result: object;

    switch (operation) {
      case 'info':
        result = {
          tool: 'chorus_effect',
          description: 'Chorus and related modulation effects',
          modes: {
            chorus: 'Classic single-voice chorus with optional feedback',
            ensemble: 'Multi-voice chorus with stereo spread',
            flanger: 'Short-delay modulation with feedback for comb filtering',
            vibrato: 'Pure pitch modulation'
          },
          parameters: {
            rate: 'LFO speed in Hz (0.1 - 10 typical)',
            depth: 'Modulation depth in milliseconds',
            delay: 'Base delay time (chorus: 7-20ms, flanger: 1-5ms)',
            feedback: 'Feedback amount (-1 to 1, negative = inverted)',
            voices: 'Number of chorus voices (ensemble mode)',
            spread: 'Stereo width for multi-voice modes'
          },
          operations: [
            'chorus - Single voice chorus',
            'ensemble - Multi-voice stereo chorus',
            'flanger - Flanging effect',
            'vibrato - Pitch modulation only',
            'analyze - Analyze modulation characteristics'
          ]
        };
        break;

      case 'examples':
        result = {
          subtleChorus: {
            description: 'Gentle chorus for vocals/guitar',
            parameters: {
              operation: 'chorus',
              rate: 0.8,
              depth: 2,
              delay: 10,
              wetLevel: 0.4
            }
          },
          richEnsemble: {
            description: 'Thick ensemble for pads',
            parameters: {
              operation: 'ensemble',
              voices: 4,
              rate: 0.5,
              depth: 5,
              spread: 0.8
            }
          },
          jetFlanger: {
            description: 'Classic jet-plane flanger',
            parameters: {
              operation: 'flanger',
              rate: 0.2,
              depth: 3,
              feedback: 0.7
            }
          }
        };
        break;

      case 'demo':
        // Generate test tone
        const demoSignal: number[] = [];
        for (let i = 0; i < sampleRate; i++) {
          demoSignal.push(Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.5);
        }

        const demoResult = ensembleChorus(
          demoSignal.slice(0, 4410),
          sampleRate,
          3,
          1.0,
          3,
          10,
          0.7,
          0.5,
          1.0
        );

        result = {
          demo: 'Ensemble chorus on 440Hz tone',
          inputSignal: {
            type: '440Hz sine wave',
            length: 4410
          },
          settings: {
            voices: 3,
            rate: '1.0 Hz',
            depth: '3 ms'
          },
          outputLeftPreview: demoResult.outputLeft.slice(0, 50).map(v => v.toFixed(4)),
          outputRightPreview: demoResult.outputRight.slice(0, 50).map(v => v.toFixed(4)),
          analysis: demoResult.analysis
        };
        break;

      case 'chorus':
        if (signal.length === 0) {
          throw new Error('Signal array is required');
        }

        const chorusResult = singleVoiceChorus(
          signal,
          sampleRate,
          rate,
          depth,
          delay,
          feedback,
          wetLevel,
          dryLevel
        );

        result = {
          operation: 'chorus',
          inputLength: signal.length,
          output: chorusResult.output.slice(0, 100),
          analysis: chorusResult.analysis
        };
        break;

      case 'ensemble':
        if (signal.length === 0) {
          throw new Error('Signal array is required');
        }

        const ensembleResult = ensembleChorus(
          signal,
          sampleRate,
          Math.max(2, Math.min(8, voices)),
          rate,
          depth,
          delay,
          spread,
          wetLevel,
          dryLevel
        );

        result = {
          operation: 'ensemble',
          inputLength: signal.length,
          outputLeft: ensembleResult.outputLeft.slice(0, 100),
          outputRight: ensembleResult.outputRight.slice(0, 100),
          analysis: ensembleResult.analysis
        };
        break;

      case 'flanger':
        if (signal.length === 0) {
          throw new Error('Signal array is required');
        }

        const flangerResult = flangerEffect(
          signal,
          sampleRate,
          rate,
          Math.min(depth, 5),
          feedback,
          wetLevel,
          dryLevel
        );

        result = {
          operation: 'flanger',
          inputLength: signal.length,
          output: flangerResult.output.slice(0, 100),
          analysis: flangerResult.analysis
        };
        break;

      case 'vibrato':
        if (signal.length === 0) {
          throw new Error('Signal array is required');
        }

        const vibratoResult = vibratoEffect(
          signal,
          sampleRate,
          rate,
          depth
        );

        result = {
          operation: 'vibrato',
          inputLength: signal.length,
          output: vibratoResult.output.slice(0, 100),
          analysis: vibratoResult.analysis
        };
        break;

      case 'analyze':
        // Calculate modulation characteristics
        const cycleDurationMs = 1000 / rate;
        const pitchDeviation = depth * rate / 10; // Approximate

        result = {
          operation: 'analyze',
          modulationAnalysis: {
            rate: rate + ' Hz',
            cycleDuration: cycleDurationMs.toFixed(1) + ' ms',
            depth: depth + ' ms',
            baseDelay: delay + ' ms',
            delayRange: {
              min: (delay - depth).toFixed(2) + ' ms',
              max: (delay + depth).toFixed(2) + ' ms'
            }
          },
          psychoacoustic: {
            perceived: depth > 5 ? 'Strong modulation' : depth > 2 ? 'Moderate modulation' : 'Subtle modulation',
            character: rate > 3 ? 'Fast/nervous' : rate > 1 ? 'Medium/natural' : 'Slow/dreamy',
            pitchVariation: `Approximately ±${pitchDeviation.toFixed(1)} cents`
          },
          recommendations: {
            forVocals: { rate: '0.5-1.5 Hz', depth: '2-4 ms', delay: '10-20 ms' },
            forGuitar: { rate: '0.8-2 Hz', depth: '3-6 ms', delay: '7-15 ms' },
            forSynth: { rate: '0.3-1 Hz', depth: '4-8 ms', delay: '15-30 ms' }
          }
        };
        break;

      default:
        result = {
          error: `Unknown operation: ${operation}`,
          availableOperations: ['info', 'examples', 'demo', 'chorus', 'ensemble', 'flanger', 'vibrato', 'analyze']
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

export function ischoruseffectAvailable(): boolean {
  return true;
}
