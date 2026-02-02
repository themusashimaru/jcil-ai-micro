/**
 * REVERB TOOL
 * Comprehensive reverb effect processor with multiple algorithms
 * Implements Schroeder, Freeverb, and convolution reverb models
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const reverbTool: UnifiedTool = {
  name: 'reverb',
  description: 'Reverb effect processor with Schroeder, Freeverb, and convolution algorithms',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['info', 'examples', 'demo', 'schroeder', 'freeverb', 'convolution', 'impulse_response', 'room_simulation', 'analyze'],
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
      roomSize: {
        type: 'number',
        description: 'Room size factor (0.0-1.0, default: 0.5)'
      },
      damping: {
        type: 'number',
        description: 'High frequency damping (0.0-1.0, default: 0.5)'
      },
      wetLevel: {
        type: 'number',
        description: 'Wet signal level (0.0-1.0, default: 0.33)'
      },
      dryLevel: {
        type: 'number',
        description: 'Dry signal level (0.0-1.0, default: 0.4)'
      },
      width: {
        type: 'number',
        description: 'Stereo width (0.0-1.0, default: 1.0)'
      },
      reverbTime: {
        type: 'number',
        description: 'Reverb time T60 in seconds (default: 2.0)'
      },
      preDelay: {
        type: 'number',
        description: 'Pre-delay in milliseconds (default: 20)'
      },
      roomDimensions: {
        type: 'object',
        properties: {
          length: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' }
        },
        description: 'Room dimensions for simulation'
      },
      impulseResponse: {
        type: 'array',
        items: { type: 'number' },
        description: 'Impulse response for convolution reverb'
      }
    },
    required: ['operation']
  }
};

// Comb filter for Schroeder reverb
interface CombFilter {
  buffer: number[];
  bufferIndex: number;
  feedback: number;
  filterStore: number;
  damp1: number;
  damp2: number;
}

// Allpass filter for Schroeder reverb
interface AllpassFilter {
  buffer: number[];
  bufferIndex: number;
  feedback: number;
}

// Create comb filter
function createCombFilter(bufferSize: number, feedback: number, damp: number): CombFilter {
  return {
    buffer: new Array(bufferSize).fill(0),
    bufferIndex: 0,
    feedback,
    filterStore: 0,
    damp1: damp,
    damp2: 1 - damp
  };
}

// Process sample through comb filter
function processCombFilter(filter: CombFilter, input: number): number {
  const output = filter.buffer[filter.bufferIndex];

  // Low-pass filter for damping
  filter.filterStore = output * filter.damp2 + filter.filterStore * filter.damp1;

  // Feed back into buffer
  filter.buffer[filter.bufferIndex] = input + filter.filterStore * filter.feedback;

  // Advance buffer index
  filter.bufferIndex = (filter.bufferIndex + 1) % filter.buffer.length;

  return output;
}

// Create allpass filter
function createAllpassFilter(bufferSize: number, feedback: number = 0.5): AllpassFilter {
  return {
    buffer: new Array(bufferSize).fill(0),
    bufferIndex: 0,
    feedback
  };
}

// Process sample through allpass filter
function processAllpassFilter(filter: AllpassFilter, input: number): number {
  const bufOut = filter.buffer[filter.bufferIndex];
  const output = -input + bufOut;

  filter.buffer[filter.bufferIndex] = input + bufOut * filter.feedback;
  filter.bufferIndex = (filter.bufferIndex + 1) % filter.buffer.length;

  return output;
}

// Schroeder reverb algorithm
function schroederReverb(
  signal: number[],
  sampleRate: number,
  reverbTime: number,
  roomSize: number,
  damping: number,
  wetLevel: number,
  dryLevel: number
): { output: number[]; analysis: object } {
  // Calculate comb filter delays (in samples) based on room size
  const baseDelays = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116];
  const scaledDelays = baseDelays.map(d => Math.floor(d * roomSize + 200));

  // Calculate feedback based on reverb time
  // g = 10^(-3 * delay / (T60 * sampleRate))
  const combFeedbacks = scaledDelays.map(delay =>
    Math.pow(10, -3 * delay / (reverbTime * sampleRate))
  );

  // Create 8 parallel comb filters
  const combFilters = scaledDelays.map((delay, i) =>
    createCombFilter(delay, combFeedbacks[i], damping)
  );

  // Create 4 series allpass filters
  const allpassDelays = [225, 556, 441, 341].map(d => Math.floor(d * roomSize + 50));
  const allpassFilters = allpassDelays.map(delay =>
    createAllpassFilter(delay, 0.5)
  );

  // Process signal
  const output: number[] = new Array(signal.length).fill(0);

  for (let i = 0; i < signal.length; i++) {
    const input = signal[i];

    // Sum parallel comb filter outputs
    let combSum = 0;
    for (const comb of combFilters) {
      combSum += processCombFilter(comb, input);
    }
    combSum /= combFilters.length;

    // Series allpass filters
    let allpassOut = combSum;
    for (const allpass of allpassFilters) {
      allpassOut = processAllpassFilter(allpass, allpassOut);
    }

    // Mix wet and dry
    output[i] = input * dryLevel + allpassOut * wetLevel;
  }

  return {
    output,
    analysis: {
      algorithm: 'Schroeder',
      combFilterCount: combFilters.length,
      allpassFilterCount: allpassFilters.length,
      combDelays: scaledDelays,
      combFeedbacks: combFeedbacks.map(f => f.toFixed(4)),
      allpassDelays,
      effectiveReverbTime: reverbTime,
      dampingFactor: damping
    }
  };
}

// Freeverb algorithm (Jezar's implementation)
function freeverbReverb(
  signal: number[],
  sampleRate: number,
  roomSize: number,
  damping: number,
  wetLevel: number,
  dryLevel: number,
  width: number
): { output: number[]; outputRight?: number[]; analysis: object } {
  // Freeverb uses fixed delay times tuned for 44.1kHz
  const stereospread = 23;

  // Left channel comb delays
  const combTuningsL = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const combTuningsR = combTuningsL.map(t => t + stereospread);

  // Allpass delays
  const allpassTuningsL = [556, 441, 341, 225];
  const allpassTuningsR = allpassTuningsL.map(t => t + stereospread);

  // Scale delays for sample rate
  const scaleFactor = sampleRate / 44100;
  const scaledCombL = combTuningsL.map(t => Math.floor(t * scaleFactor));
  const scaledCombR = combTuningsR.map(t => Math.floor(t * scaleFactor));
  const scaledAllpassL = allpassTuningsL.map(t => Math.floor(t * scaleFactor));
  const scaledAllpassR = allpassTuningsR.map(t => Math.floor(t * scaleFactor));

  // Feedback amount
  const feedback = roomSize * 0.28 + 0.7;

  // Create filters
  const combFiltersL = scaledCombL.map(delay =>
    createCombFilter(delay, feedback, damping)
  );
  const combFiltersR = scaledCombR.map(delay =>
    createCombFilter(delay, feedback, damping)
  );
  const allpassFiltersL = scaledAllpassL.map(delay =>
    createAllpassFilter(delay, 0.5)
  );
  const allpassFiltersR = scaledAllpassR.map(delay =>
    createAllpassFilter(delay, 0.5)
  );

  // Process
  const outputL: number[] = new Array(signal.length).fill(0);
  const outputR: number[] = new Array(signal.length).fill(0);

  const wet1 = wetLevel * (width / 2 + 0.5);
  const wet2 = wetLevel * ((1 - width) / 2);

  for (let i = 0; i < signal.length; i++) {
    const input = signal[i];

    // Left channel
    let outL = 0;
    for (const comb of combFiltersL) {
      outL += processCombFilter(comb, input);
    }
    for (const allpass of allpassFiltersL) {
      outL = processAllpassFilter(allpass, outL);
    }

    // Right channel
    let outR = 0;
    for (const comb of combFiltersR) {
      outR += processCombFilter(comb, input);
    }
    for (const allpass of allpassFiltersR) {
      outR = processAllpassFilter(allpass, outR);
    }

    // Mix with stereo width
    outputL[i] = outL * wet1 + outR * wet2 + input * dryLevel;
    outputR[i] = outR * wet1 + outL * wet2 + input * dryLevel;
  }

  return {
    output: outputL,
    outputRight: outputR,
    analysis: {
      algorithm: 'Freeverb',
      stereo: true,
      combFiltersPerChannel: 8,
      allpassFiltersPerChannel: 4,
      roomSizeParam: roomSize,
      effectiveFeedback: feedback.toFixed(4),
      dampingParam: damping,
      stereoWidth: width,
      wetMix: { wet1: wet1.toFixed(4), wet2: wet2.toFixed(4) }
    }
  };
}

// Convolution reverb
function convolutionReverb(
  signal: number[],
  impulseResponse: number[],
  wetLevel: number,
  dryLevel: number
): { output: number[]; analysis: object } {
  const signalLen = signal.length;
  const irLen = impulseResponse.length;
  const outputLen = signalLen + irLen - 1;

  // Direct convolution (for demonstration - FFT would be faster for long IRs)
  const wet: number[] = new Array(outputLen).fill(0);

  // Use overlap-add for efficiency
  const blockSize = 512;
  const numBlocks = Math.ceil(signalLen / blockSize);

  for (let block = 0; block < numBlocks; block++) {
    const blockStart = block * blockSize;
    const blockEnd = Math.min(blockStart + blockSize, signalLen);

    for (let i = blockStart; i < blockEnd; i++) {
      for (let j = 0; j < Math.min(irLen, outputLen - i); j++) {
        wet[i + j] += signal[i] * impulseResponse[j];
      }
    }
  }

  // Normalize wet signal
  const maxWet = Math.max(...wet.map(Math.abs));
  if (maxWet > 0) {
    for (let i = 0; i < wet.length; i++) {
      wet[i] /= maxWet;
    }
  }

  // Mix
  const output: number[] = new Array(signalLen).fill(0);
  for (let i = 0; i < signalLen; i++) {
    output[i] = signal[i] * dryLevel + wet[i] * wetLevel;
  }

  return {
    output,
    analysis: {
      algorithm: 'Convolution',
      signalLength: signalLen,
      impulseResponseLength: irLen,
      outputLength: outputLen,
      method: 'Direct convolution with block processing',
      blockSize,
      numBlocks
    }
  };
}

// Generate synthetic impulse response
function generateImpulseResponse(
  sampleRate: number,
  reverbTime: number,
  roomDimensions?: { length: number; width: number; height: number }
): { ir: number[]; analysis: object } {
  const length = Math.floor(sampleRate * reverbTime);
  const ir: number[] = new Array(length).fill(0);

  // Initial impulse
  ir[0] = 1.0;

  // Early reflections based on room dimensions
  const earlyReflections: { time: number; amplitude: number }[] = [];

  if (roomDimensions) {
    const { length: L, width: W, height: H } = roomDimensions;
    const speedOfSound = 343; // m/s

    // First order reflections
    const surfaces = [
      { dist: L, name: 'front' },
      { dist: L, name: 'back' },
      { dist: W, name: 'left' },
      { dist: W, name: 'right' },
      { dist: H, name: 'floor' },
      { dist: H, name: 'ceiling' }
    ];

    for (const surface of surfaces) {
      const time = 2 * surface.dist / speedOfSound;
      const amplitude = 0.7 / (1 + time * 2); // Distance attenuation
      earlyReflections.push({ time, amplitude });
    }

    // Add early reflections to IR
    for (const ref of earlyReflections) {
      const sampleIndex = Math.floor(ref.time * sampleRate);
      if (sampleIndex < length) {
        ir[sampleIndex] += ref.amplitude * (Math.random() * 0.2 + 0.9);
      }
    }
  }

  // Exponential decay for late reverb
  const decayRate = -6.91 / (reverbTime * sampleRate); // -60dB decay

  // Dense late reflections
  const lateStart = Math.floor(sampleRate * 0.08); // Start after 80ms
  for (let i = lateStart; i < length; i++) {
    const envelope = Math.exp(decayRate * i);
    const noise = (Math.random() * 2 - 1);
    ir[i] += noise * envelope * 0.1;
  }

  // Normalize
  const maxVal = Math.max(...ir.map(Math.abs));
  if (maxVal > 0) {
    for (let i = 0; i < length; i++) {
      ir[i] /= maxVal;
    }
  }

  return {
    ir,
    analysis: {
      sampleRate,
      reverbTimeT60: reverbTime,
      lengthSamples: length,
      lengthSeconds: reverbTime,
      earlyReflectionCount: earlyReflections.length,
      earlyReflections: earlyReflections.map(r => ({
        timeMs: (r.time * 1000).toFixed(2),
        amplitude: r.amplitude.toFixed(4)
      })),
      roomDimensions
    }
  };
}

// Room acoustic simulation
function simulateRoom(
  roomDimensions: { length: number; width: number; height: number },
  absorptionCoefficients: { walls: number; floor: number; ceiling: number },
  sourcePosition: { x: number; y: number; z: number },
  listenerPosition: { x: number; y: number; z: number }
): object {
  const { length: L, width: W, height: H } = roomDimensions;
  const { walls: aWalls, floor: aFloor, ceiling: aCeiling } = absorptionCoefficients;

  // Calculate room volume and surface area
  const volume = L * W * H;
  const surfaceArea = 2 * (L * W + L * H + W * H);

  // Average absorption coefficient
  const wallArea = 2 * H * (L + W);
  const floorArea = L * W;
  const ceilingArea = L * W;
  const avgAbsorption = (wallArea * aWalls + floorArea * aFloor + ceilingArea * aCeiling) / surfaceArea;

  // Sabine's equation for reverberation time
  const absorptionArea = surfaceArea * avgAbsorption;
  const RT60_Sabine = 0.161 * volume / absorptionArea;

  // Eyring's equation (more accurate for higher absorption)
  const RT60_Eyring = 0.161 * volume / (-surfaceArea * Math.log(1 - avgAbsorption));

  // Direct path distance
  const dx = listenerPosition.x - sourcePosition.x;
  const dy = listenerPosition.y - sourcePosition.y;
  const dz = listenerPosition.z - sourcePosition.z;
  const directDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Critical distance (where direct and reverberant are equal)
  const criticalDistance = 0.057 * Math.sqrt(volume / RT60_Sabine);

  // Direct-to-reverberant ratio at listener
  const DRR = 20 * Math.log10(criticalDistance / directDistance);

  // Room modes (resonant frequencies)
  const speedOfSound = 343;
  const modes: { freq: number; type: string }[] = [];

  // Axial modes
  for (let n = 1; n <= 3; n++) {
    modes.push({ freq: n * speedOfSound / (2 * L), type: `Axial-L (${n},0,0)` });
    modes.push({ freq: n * speedOfSound / (2 * W), type: `Axial-W (0,${n},0)` });
    modes.push({ freq: n * speedOfSound / (2 * H), type: `Axial-H (0,0,${n})` });
  }

  // Sort by frequency
  modes.sort((a, b) => a.freq - b.freq);

  return {
    roomProperties: {
      dimensions: roomDimensions,
      volume: volume.toFixed(2),
      surfaceArea: surfaceArea.toFixed(2),
      averageAbsorption: avgAbsorption.toFixed(4)
    },
    reverberationTime: {
      RT60_Sabine: RT60_Sabine.toFixed(3),
      RT60_Eyring: RT60_Eyring.toFixed(3),
      unit: 'seconds'
    },
    spatialAnalysis: {
      directDistance: directDistance.toFixed(3),
      criticalDistance: criticalDistance.toFixed(3),
      directToReverberantRatio: DRR.toFixed(2) + ' dB',
      listenerInNearField: directDistance < criticalDistance
    },
    roomModes: modes.slice(0, 10).map(m => ({
      frequency: m.freq.toFixed(2) + ' Hz',
      type: m.type
    })),
    recommendations: {
      needsAcousticTreatment: RT60_Sabine > 1.0,
      suggestedRT60: volume < 50 ? '0.3-0.5s' : volume < 200 ? '0.5-0.8s' : '0.8-1.2s'
    }
  };
}

// Analyze reverb characteristics of a signal
function analyzeReverb(signal: number[], sampleRate: number): object {
  // Find peak
  let peakIndex = 0;
  let peakValue = 0;
  for (let i = 0; i < signal.length; i++) {
    if (Math.abs(signal[i]) > peakValue) {
      peakValue = Math.abs(signal[i]);
      peakIndex = i;
    }
  }

  // Calculate energy decay curve
  const windowSize = Math.floor(sampleRate / 100); // 10ms windows
  const energyCurve: number[] = [];

  for (let i = peakIndex; i < signal.length - windowSize; i += windowSize) {
    let energy = 0;
    for (let j = 0; j < windowSize; j++) {
      energy += signal[i + j] * signal[i + j];
    }
    energyCurve.push(energy);
  }

  // Convert to dB
  const maxEnergy = Math.max(...energyCurve);
  const energyDb = energyCurve.map(e => e > 0 ? 10 * Math.log10(e / maxEnergy) : -120);

  // Estimate T60 by finding -60dB point
  let t60Index = energyDb.length - 1;
  for (let i = 0; i < energyDb.length; i++) {
    if (energyDb[i] < -60) {
      t60Index = i;
      break;
    }
  }
  const t60 = (t60Index * windowSize / sampleRate);

  // Early decay time (first 10dB of decay)
  let edtIndex = 0;
  for (let i = 0; i < energyDb.length; i++) {
    if (energyDb[i] < -10) {
      edtIndex = i;
      break;
    }
  }
  const edt = (edtIndex * windowSize / sampleRate) * 6; // Scale to match T60

  return {
    signalAnalysis: {
      lengthSamples: signal.length,
      lengthSeconds: (signal.length / sampleRate).toFixed(3),
      peakPosition: (peakIndex / sampleRate * 1000).toFixed(2) + ' ms'
    },
    reverbTime: {
      T60: t60.toFixed(3) + ' s',
      EDT: edt.toFixed(3) + ' s',
      ratio: (t60 / edt).toFixed(2)
    },
    energyDecay: {
      windowSizeMs: (windowSize / sampleRate * 1000).toFixed(1),
      decayCurvePoints: energyDb.slice(0, 20).map((db, i) => ({
        timeMs: (i * windowSize / sampleRate * 1000).toFixed(0),
        levelDb: db.toFixed(1)
      }))
    }
  };
}

export async function executereverb(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation,
      signal = [],
      sampleRate = 44100,
      roomSize = 0.5,
      damping = 0.5,
      wetLevel = 0.33,
      dryLevel = 0.4,
      width = 1.0,
      reverbTime = 2.0,
      preDelay = 20,
      roomDimensions,
      impulseResponse
    } = args;

    let result: object;

    switch (operation) {
      case 'info':
        result = {
          tool: 'reverb',
          description: 'Comprehensive reverb effect processor with multiple algorithms',
          algorithms: {
            schroeder: 'Classic Schroeder reverb with parallel comb and series allpass filters',
            freeverb: 'Jezar\'s Freeverb with stereo processing and tuned filter networks',
            convolution: 'Convolution reverb using impulse responses for realistic spaces'
          },
          parameters: {
            roomSize: 'Controls delay line lengths and reverb density (0.0-1.0)',
            damping: 'High frequency absorption, simulates air and surface absorption (0.0-1.0)',
            wetLevel: 'Amount of processed reverb signal (0.0-1.0)',
            dryLevel: 'Amount of original dry signal (0.0-1.0)',
            width: 'Stereo width for Freeverb (0.0-1.0)',
            reverbTime: 'Decay time T60 in seconds',
            preDelay: 'Initial delay before reverb starts (milliseconds)'
          },
          operations: [
            'schroeder - Classic reverb algorithm',
            'freeverb - Stereo Freeverb algorithm',
            'convolution - Convolution reverb with IR',
            'impulse_response - Generate synthetic IR',
            'room_simulation - Calculate room acoustics',
            'analyze - Analyze reverb characteristics'
          ]
        };
        break;

      case 'examples':
        result = {
          schroeder: {
            description: 'Apply Schroeder reverb to a signal',
            parameters: {
              operation: 'schroeder',
              signal: [0.5, 0.3, 0.1, -0.2, -0.4],
              sampleRate: 44100,
              reverbTime: 1.5,
              roomSize: 0.6,
              damping: 0.4
            }
          },
          freeverb: {
            description: 'Apply stereo Freeverb',
            parameters: {
              operation: 'freeverb',
              signal: [0.8, 0.6, 0.4, 0.2, 0],
              roomSize: 0.75,
              damping: 0.3,
              width: 1.0
            }
          },
          roomSimulation: {
            description: 'Simulate room acoustics',
            parameters: {
              operation: 'room_simulation',
              roomDimensions: { length: 10, width: 8, height: 3 }
            }
          }
        };
        break;

      case 'demo':
        // Generate test impulse
        const demoSignal = new Array(4410).fill(0);
        demoSignal[0] = 1.0; // Impulse

        const demoResult = schroederReverb(
          demoSignal.slice(0, 1000),
          sampleRate,
          1.0,
          0.5,
          0.5,
          0.5,
          0.3
        );

        result = {
          demo: 'Schroeder reverb on impulse signal',
          inputSignal: {
            type: 'Impulse',
            length: 1000,
            peak: 1.0
          },
          parameters: {
            reverbTime: '1.0s',
            roomSize: 0.5,
            damping: 0.5
          },
          outputPreview: demoResult.output.slice(0, 50).map(v => v.toFixed(4)),
          analysis: demoResult.analysis
        };
        break;

      case 'schroeder':
        if (signal.length === 0) {
          throw new Error('Signal array is required for schroeder operation');
        }

        // Apply pre-delay
        const preDelaySamples = Math.floor(preDelay * sampleRate / 1000);
        const delayedSignal = new Array(preDelaySamples).fill(0).concat(signal);

        const schroederResult = schroederReverb(
          delayedSignal,
          sampleRate,
          reverbTime,
          roomSize,
          damping,
          wetLevel,
          dryLevel
        );

        result = {
          operation: 'schroeder',
          inputLength: signal.length,
          outputLength: schroederResult.output.length,
          preDelaySamples,
          output: schroederResult.output.slice(0, 100),
          analysis: schroederResult.analysis
        };
        break;

      case 'freeverb':
        if (signal.length === 0) {
          throw new Error('Signal array is required for freeverb operation');
        }

        const freeverbResult = freeverbReverb(
          signal,
          sampleRate,
          roomSize,
          damping,
          wetLevel,
          dryLevel,
          width
        );

        result = {
          operation: 'freeverb',
          inputLength: signal.length,
          outputLeft: freeverbResult.output.slice(0, 100),
          outputRight: freeverbResult.outputRight?.slice(0, 100),
          analysis: freeverbResult.analysis
        };
        break;

      case 'convolution':
        if (signal.length === 0) {
          throw new Error('Signal array is required for convolution operation');
        }

        // Use provided IR or generate synthetic one
        let ir: number[];
        if (impulseResponse && impulseResponse.length > 0) {
          ir = impulseResponse;
        } else {
          const irResult = generateImpulseResponse(sampleRate, reverbTime, roomDimensions);
          ir = irResult.ir.slice(0, Math.min(irResult.ir.length, sampleRate)); // Limit IR length
        }

        const convResult = convolutionReverb(signal, ir, wetLevel, dryLevel);

        result = {
          operation: 'convolution',
          inputLength: signal.length,
          irLength: ir.length,
          output: convResult.output.slice(0, 100),
          analysis: convResult.analysis
        };
        break;

      case 'impulse_response':
        const irGenResult = generateImpulseResponse(sampleRate, reverbTime, roomDimensions);

        result = {
          operation: 'impulse_response',
          irPreview: irGenResult.ir.slice(0, 100).map(v => v.toFixed(6)),
          analysis: irGenResult.analysis
        };
        break;

      case 'room_simulation':
        const defaultDimensions = roomDimensions || { length: 8, width: 6, height: 3 };
        const defaultAbsorption = { walls: 0.1, floor: 0.2, ceiling: 0.15 };
        const defaultSource = { x: 2, y: 3, z: 1.5 };
        const defaultListener = { x: 6, y: 3, z: 1.2 };

        result = {
          operation: 'room_simulation',
          simulation: simulateRoom(
            defaultDimensions,
            defaultAbsorption,
            defaultSource,
            defaultListener
          )
        };
        break;

      case 'analyze':
        if (signal.length === 0) {
          throw new Error('Signal array is required for analyze operation');
        }

        result = {
          operation: 'analyze',
          analysis: analyzeReverb(signal, sampleRate)
        };
        break;

      default:
        result = {
          error: `Unknown operation: ${operation}`,
          availableOperations: ['info', 'examples', 'demo', 'schroeder', 'freeverb', 'convolution', 'impulse_response', 'room_simulation', 'analyze']
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

export function isreverbAvailable(): boolean {
  return true;
}
