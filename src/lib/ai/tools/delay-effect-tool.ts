/**
 * DELAY-EFFECT TOOL
 * Comprehensive delay and echo effect processor
 * Implements simple delay, multitap, ping-pong, and modulated delay
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const delayeffectTool: UnifiedTool = {
  name: 'delay_effect',
  description: 'Delay and echo effect with multitap, ping-pong, and modulation modes',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'examples', 'demo', 'simple', 'multitap', 'pingpong', 'modulated', 'tempo_sync', 'analyze'],
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
      delayTime: {
        type: 'number',
        description: 'Delay time in milliseconds (default: 250)'
      },
      feedback: {
        type: 'number',
        description: 'Feedback amount 0.0-0.95 (default: 0.5)'
      },
      wetLevel: {
        type: 'number',
        description: 'Wet signal level 0.0-1.0 (default: 0.5)'
      },
      dryLevel: {
        type: 'number',
        description: 'Dry signal level 0.0-1.0 (default: 1.0)'
      },
      taps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            time: { type: 'number' },
            level: { type: 'number' },
            pan: { type: 'number' }
          }
        },
        description: 'Multitap delay taps'
      },
      modRate: {
        type: 'number',
        description: 'Modulation rate in Hz (default: 0.5)'
      },
      modDepth: {
        type: 'number',
        description: 'Modulation depth in ms (default: 5)'
      },
      tempo: {
        type: 'number',
        description: 'Tempo in BPM for sync (default: 120)'
      },
      noteValue: {
        type: 'string',
        enum: ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/4T', '1/8T', '1/16T', '1/4D', '1/8D'],
        description: 'Note value for tempo sync'
      },
      filterFreq: {
        type: 'number',
        description: 'Feedback filter frequency in Hz'
      },
      filterType: {
        type: 'string',
        enum: ['lowpass', 'highpass'],
        description: 'Feedback filter type'
      }
    },
    required: ['operation']
  }
};

// Circular buffer delay line
class DelayLine {
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

  read(delaySamples: number): number {
    const readIndex = (this.writeIndex - Math.floor(delaySamples) + this.maxDelay) % this.maxDelay;
    return this.buffer[readIndex];
  }

  // Linear interpolation for fractional delays
  readInterpolated(delaySamples: number): number {
    const intDelay = Math.floor(delaySamples);
    const frac = delaySamples - intDelay;

    const idx1 = (this.writeIndex - intDelay + this.maxDelay) % this.maxDelay;
    const idx2 = (this.writeIndex - intDelay - 1 + this.maxDelay) % this.maxDelay;

    return this.buffer[idx1] * (1 - frac) + this.buffer[idx2] * frac;
  }
}

// Simple one-pole filter for feedback path
function createOnePoleFilter(cutoff: number, sampleRate: number, type: 'lowpass' | 'highpass'): (sample: number) => number {
  const w0 = 2 * Math.PI * cutoff / sampleRate;
  const coeff = Math.exp(-w0);
  let state = 0;

  if (type === 'lowpass') {
    return (sample: number) => {
      state = sample * (1 - coeff) + state * coeff;
      return state;
    };
  } else {
    return (sample: number) => {
      state = sample * (1 - coeff) + state * coeff;
      return sample - state;
    };
  }
}

// Simple delay
function simpleDelay(
  signal: number[],
  sampleRate: number,
  delayTimeMs: number,
  feedback: number,
  wetLevel: number,
  dryLevel: number,
  filterFreq?: number,
  filterType?: 'lowpass' | 'highpass'
): { output: number[]; analysis: object } {
  const delaySamples = Math.floor(delayTimeMs * sampleRate / 1000);
  const maxDelay = delaySamples + 1000;

  const delayLine = new DelayLine(maxDelay);

  // Optional feedback filter
  let filter: ((s: number) => number) | null = null;
  if (filterFreq && filterType) {
    filter = createOnePoleFilter(filterFreq, sampleRate, filterType);
  }

  const output: number[] = new Array(signal.length);
  const clampedFeedback = Math.min(0.95, Math.max(0, feedback));

  for (let i = 0; i < signal.length; i++) {
    const delayed = delayLine.read(delaySamples);

    // Apply filter to feedback path
    let feedbackSample = delayed;
    if (filter) {
      feedbackSample = filter(feedbackSample);
    }

    // Write input + feedback to delay line
    delayLine.write(signal[i] + feedbackSample * clampedFeedback);

    // Mix dry and wet
    output[i] = signal[i] * dryLevel + delayed * wetLevel;
  }

  return {
    output,
    analysis: {
      type: 'Simple Delay',
      delayTime: delayTimeMs + ' ms',
      delaySamples,
      feedback: (feedback * 100).toFixed(0) + '%',
      wetLevel: (wetLevel * 100).toFixed(0) + '%',
      dryLevel: (dryLevel * 100).toFixed(0) + '%',
      filter: filter ? { type: filterType, frequency: filterFreq + ' Hz' } : 'None'
    }
  };
}

// Multitap delay
function multitapDelay(
  signal: number[],
  sampleRate: number,
  taps: { time: number; level: number; pan?: number }[],
  feedback: number,
  wetLevel: number,
  dryLevel: number
): { outputLeft: number[]; outputRight: number[]; analysis: object } {
  // Find max delay for buffer sizing
  const maxDelayMs = Math.max(...taps.map(t => t.time));
  const maxDelaySamples = Math.floor(maxDelayMs * sampleRate / 1000) + 1000;

  const delayLine = new DelayLine(maxDelaySamples);

  const outputLeft: number[] = new Array(signal.length).fill(0);
  const outputRight: number[] = new Array(signal.length).fill(0);

  const clampedFeedback = Math.min(0.95, Math.max(0, feedback));

  // Convert taps to samples
  const tapSamples = taps.map(tap => ({
    delaySamples: Math.floor(tap.time * sampleRate / 1000),
    level: tap.level,
    panLeft: tap.pan !== undefined ? Math.cos((tap.pan + 1) * Math.PI / 4) : 0.707,
    panRight: tap.pan !== undefined ? Math.sin((tap.pan + 1) * Math.PI / 4) : 0.707
  }));

  // Use last tap for feedback
  const feedbackTap = tapSamples[tapSamples.length - 1];

  for (let i = 0; i < signal.length; i++) {
    // Read all taps and sum
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let tapSum = 0;
    let leftSum = 0;
    let rightSum = 0;

    for (const tap of tapSamples) {
      const delayed = delayLine.read(tap.delaySamples) * tap.level;
      tapSum += delayed;
      leftSum += delayed * tap.panLeft;
      rightSum += delayed * tap.panRight;
    }

    // Feedback from last tap
    const feedbackSample = delayLine.read(feedbackTap.delaySamples);

    // Write input + feedback
    delayLine.write(signal[i] + feedbackSample * clampedFeedback);

    // Mix
    outputLeft[i] = signal[i] * dryLevel + leftSum * wetLevel;
    outputRight[i] = signal[i] * dryLevel + rightSum * wetLevel;
  }

  return {
    outputLeft,
    outputRight,
    analysis: {
      type: 'Multitap Delay',
      tapCount: taps.length,
      taps: taps.map(t => ({
        time: t.time + ' ms',
        level: (t.level * 100).toFixed(0) + '%',
        pan: t.pan !== undefined ? t.pan.toFixed(2) : 'center'
      })),
      feedback: (feedback * 100).toFixed(0) + '%'
    }
  };
}

// Ping-pong delay
function pingPongDelay(
  signal: number[],
  sampleRate: number,
  delayTimeMs: number,
  feedback: number,
  wetLevel: number,
  dryLevel: number
): { outputLeft: number[]; outputRight: number[]; analysis: object } {
  const delaySamples = Math.floor(delayTimeMs * sampleRate / 1000);
  const maxDelay = delaySamples * 2 + 1000;

  const delayLineLeft = new DelayLine(maxDelay);
  const delayLineRight = new DelayLine(maxDelay);

  const outputLeft: number[] = new Array(signal.length);
  const outputRight: number[] = new Array(signal.length);

  const clampedFeedback = Math.min(0.95, Math.max(0, feedback));

  for (let i = 0; i < signal.length; i++) {
    const delayedLeft = delayLineLeft.read(delaySamples);
    const delayedRight = delayLineRight.read(delaySamples);

    // Ping-pong: left feeds right, right feeds left
    delayLineLeft.write(signal[i] + delayedRight * clampedFeedback);
    delayLineRight.write(delayedLeft * clampedFeedback);

    // Mix
    outputLeft[i] = signal[i] * dryLevel + delayedLeft * wetLevel;
    outputRight[i] = signal[i] * dryLevel + delayedRight * wetLevel;
  }

  return {
    outputLeft,
    outputRight,
    analysis: {
      type: 'Ping-Pong Delay',
      delayTime: delayTimeMs + ' ms',
      delaySamples,
      feedback: (feedback * 100).toFixed(0) + '%',
      stereoPattern: 'L -> R -> L -> R...'
    }
  };
}

// Modulated delay (chorus-like)
function modulatedDelay(
  signal: number[],
  sampleRate: number,
  delayTimeMs: number,
  feedback: number,
  modRateHz: number,
  modDepthMs: number,
  wetLevel: number,
  dryLevel: number
): { output: number[]; analysis: object } {
  const baseDelaySamples = delayTimeMs * sampleRate / 1000;
  const modDepthSamples = modDepthMs * sampleRate / 1000;
  const maxDelay = Math.floor(baseDelaySamples + modDepthSamples) + 1000;

  const delayLine = new DelayLine(maxDelay);

  const output: number[] = new Array(signal.length);
  const clampedFeedback = Math.min(0.95, Math.max(0, feedback));

  // LFO phase
  const lfoIncrement = 2 * Math.PI * modRateHz / sampleRate;
  let lfoPhase = 0;

  for (let i = 0; i < signal.length; i++) {
    // Calculate modulated delay time
    const modulation = Math.sin(lfoPhase) * modDepthSamples;
    const currentDelay = baseDelaySamples + modulation;

    // Read with interpolation for smooth modulation
    const delayed = delayLine.readInterpolated(currentDelay);

    // Write input + feedback
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
      type: 'Modulated Delay',
      baseDelay: delayTimeMs + ' ms',
      modulation: {
        rate: modRateHz + ' Hz',
        depth: modDepthMs + ' ms'
      },
      delayRange: `${(delayTimeMs - modDepthMs).toFixed(1)} - ${(delayTimeMs + modDepthMs).toFixed(1)} ms`,
      feedback: (feedback * 100).toFixed(0) + '%'
    }
  };
}

// Calculate delay time from tempo and note value
function tempoSyncDelay(tempo: number, noteValue: string): number {
  const msPerBeat = 60000 / tempo;

  const noteMultipliers: { [key: string]: number } = {
    '1/1': 4,
    '1/2': 2,
    '1/4': 1,
    '1/8': 0.5,
    '1/16': 0.25,
    '1/32': 0.125,
    '1/4T': 2/3,      // Triplet
    '1/8T': 1/3,
    '1/16T': 1/6,
    '1/4D': 1.5,      // Dotted
    '1/8D': 0.75,
  };

  const multiplier = noteMultipliers[noteValue] || 1;
  return msPerBeat * multiplier;
}

// Analyze delay characteristics
function analyzeDelayCharacteristics(
  delayTimeMs: number,
  feedback: number,
  sampleRate: number
): object {
  // Calculate decay time (time to reach -60dB)
  const feedbackDb = 20 * Math.log10(Math.max(feedback, 0.001));
  const repeatsTo60dB = feedback > 0 ? Math.ceil(-60 / feedbackDb) : 1;
  const decayTimeMs = delayTimeMs * repeatsTo60dB;

  // Calculate echo density
  const echosPerSecond = feedback > 0 ? 1000 / delayTimeMs : 0;

  // Frequency of delay (for tempo matching)
  const delayFreqHz = 1000 / delayTimeMs;

  // Corresponding BPM
  const bpm = delayFreqHz * 60;

  return {
    timing: {
      delayTime: delayTimeMs + ' ms',
      delayFrequency: delayFreqHz.toFixed(2) + ' Hz',
      equivalentBPM: bpm.toFixed(1)
    },
    decay: {
      feedbackGain: feedbackDb.toFixed(1) + ' dB per repeat',
      repeatsTo60dB,
      totalDecayTime: (decayTimeMs / 1000).toFixed(2) + ' s'
    },
    density: {
      echosPerSecond: echosPerSecond.toFixed(1)
    },
    memoryRequired: Math.ceil(delayTimeMs * sampleRate / 1000 * 4) + ' bytes (32-bit float)'
  };
}

export async function executedelayeffect(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation,
      signal = [],
      sampleRate = 44100,
      delayTime = 250,
      feedback = 0.5,
      wetLevel = 0.5,
      dryLevel = 1.0,
      taps = [],
      modRate = 0.5,
      modDepth = 5,
      tempo = 120,
      noteValue = '1/8',
      filterFreq,
      filterType
    } = args;

    let result: object;

    switch (operation) {
      case 'info':
        result = {
          tool: 'delay_effect',
          description: 'Comprehensive delay and echo effect processor',
          modes: {
            simple: 'Basic feedback delay',
            multitap: 'Multiple independent delay taps with panning',
            pingpong: 'Stereo bouncing delay',
            modulated: 'Delay with LFO modulation (chorus-like)'
          },
          parameters: {
            delayTime: 'Delay time in milliseconds',
            feedback: 'Amount of output fed back (0.0-0.95)',
            wetLevel: 'Delayed signal level',
            dryLevel: 'Original signal level',
            modRate: 'LFO rate for modulated delay',
            modDepth: 'LFO depth in milliseconds'
          },
          operations: [
            'simple - Basic delay',
            'multitap - Multiple delay taps',
            'pingpong - Stereo ping-pong',
            'modulated - LFO modulated delay',
            'tempo_sync - Calculate tempo-synced delay time',
            'analyze - Analyze delay characteristics'
          ]
        };
        break;

      case 'examples':
        result = {
          simpleDelay: {
            description: 'Quarter-note delay at 120 BPM',
            parameters: {
              operation: 'simple',
              signal: [0.5, 0.3, 0.1, 0],
              delayTime: 500,
              feedback: 0.4
            }
          },
          multitap: {
            description: 'Three-tap rhythmic delay',
            parameters: {
              operation: 'multitap',
              signal: [0.5, 0.3, 0.1, 0],
              taps: [
                { time: 125, level: 0.7, pan: -0.5 },
                { time: 250, level: 0.5, pan: 0.5 },
                { time: 375, level: 0.3, pan: 0 }
              ]
            }
          },
          tempoSync: {
            description: 'Calculate delay for 1/8 note at 140 BPM',
            parameters: {
              operation: 'tempo_sync',
              tempo: 140,
              noteValue: '1/8'
            }
          }
        };
        break;

      case 'demo':
        // Generate impulse for demo
        const demoSignal = new Array(sampleRate).fill(0);
        demoSignal[0] = 1.0;

        const demoResult = simpleDelay(
          demoSignal.slice(0, 4410),
          sampleRate,
          200,
          0.5,
          0.7,
          1.0
        );

        result = {
          demo: 'Simple delay on impulse signal',
          inputSignal: {
            type: 'Impulse',
            length: 4410
          },
          settings: {
            delayTime: '200 ms',
            feedback: '50%',
            wetLevel: '70%'
          },
          outputPreview: demoResult.output.slice(0, 100).map(v => v.toFixed(4)),
          analysis: demoResult.analysis
        };
        break;

      case 'simple':
        if (signal.length === 0) {
          throw new Error('Signal array is required');
        }

        const simpleResult = simpleDelay(
          signal,
          sampleRate,
          delayTime,
          feedback,
          wetLevel,
          dryLevel,
          filterFreq,
          filterType as 'lowpass' | 'highpass' | undefined
        );

        result = {
          operation: 'simple',
          inputLength: signal.length,
          output: simpleResult.output.slice(0, 100),
          analysis: simpleResult.analysis
        };
        break;

      case 'multitap':
        if (signal.length === 0) {
          throw new Error('Signal array is required');
        }

        const defaultTaps = taps.length > 0 ? taps : [
          { time: 100, level: 0.8, pan: -0.7 },
          { time: 200, level: 0.6, pan: 0.7 },
          { time: 300, level: 0.4, pan: -0.3 },
          { time: 400, level: 0.2, pan: 0.3 }
        ];

        const mtResult = multitapDelay(
          signal,
          sampleRate,
          defaultTaps,
          feedback,
          wetLevel,
          dryLevel
        );

        result = {
          operation: 'multitap',
          inputLength: signal.length,
          outputLeft: mtResult.outputLeft.slice(0, 100),
          outputRight: mtResult.outputRight.slice(0, 100),
          analysis: mtResult.analysis
        };
        break;

      case 'pingpong':
        if (signal.length === 0) {
          throw new Error('Signal array is required');
        }

        const ppResult = pingPongDelay(
          signal,
          sampleRate,
          delayTime,
          feedback,
          wetLevel,
          dryLevel
        );

        result = {
          operation: 'pingpong',
          inputLength: signal.length,
          outputLeft: ppResult.outputLeft.slice(0, 100),
          outputRight: ppResult.outputRight.slice(0, 100),
          analysis: ppResult.analysis
        };
        break;

      case 'modulated':
        if (signal.length === 0) {
          throw new Error('Signal array is required');
        }

        const modResult = modulatedDelay(
          signal,
          sampleRate,
          delayTime,
          feedback,
          modRate,
          modDepth,
          wetLevel,
          dryLevel
        );

        result = {
          operation: 'modulated',
          inputLength: signal.length,
          output: modResult.output.slice(0, 100),
          analysis: modResult.analysis
        };
        break;

      case 'tempo_sync':
        const syncedTime = tempoSyncDelay(tempo, noteValue);

        result = {
          operation: 'tempo_sync',
          tempo: tempo + ' BPM',
          noteValue,
          delayTime: syncedTime.toFixed(2) + ' ms',
          noteValues: {
            '1/1': tempoSyncDelay(tempo, '1/1').toFixed(2) + ' ms',
            '1/2': tempoSyncDelay(tempo, '1/2').toFixed(2) + ' ms',
            '1/4': tempoSyncDelay(tempo, '1/4').toFixed(2) + ' ms',
            '1/8': tempoSyncDelay(tempo, '1/8').toFixed(2) + ' ms',
            '1/16': tempoSyncDelay(tempo, '1/16').toFixed(2) + ' ms',
            '1/4T': tempoSyncDelay(tempo, '1/4T').toFixed(2) + ' ms (triplet)',
            '1/8T': tempoSyncDelay(tempo, '1/8T').toFixed(2) + ' ms (triplet)',
            '1/8D': tempoSyncDelay(tempo, '1/8D').toFixed(2) + ' ms (dotted)'
          }
        };
        break;

      case 'analyze':
        result = {
          operation: 'analyze',
          analysis: analyzeDelayCharacteristics(delayTime, feedback, sampleRate)
        };
        break;

      default:
        result = {
          error: `Unknown operation: ${operation}`,
          availableOperations: ['info', 'examples', 'demo', 'simple', 'multitap', 'pingpong', 'modulated', 'tempo_sync', 'analyze']
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

export function isdelayeffectAvailable(): boolean {
  return true;
}
