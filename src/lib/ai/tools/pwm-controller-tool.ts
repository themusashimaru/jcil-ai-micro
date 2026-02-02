// ============================================================================
// PWM CONTROLLER TOOL - COMPREHENSIVE PWM SIGNAL GENERATOR AND CONTROLLER
// ============================================================================
// Full PWM signal generation and control simulation with:
// - Frequency configuration (Hz to MHz range)
// - Duty cycle control (0-100% with resolution)
// - Phase control for multi-channel synchronization
// - Center-aligned vs edge-aligned PWM modes
// - Complementary output generation with dead-time
// - PWM capture mode (measure external signals)
// - Soft start/stop ramps
// - SPWM modulation for motor control
// - Servo motor control profiles
// - LED dimming curves (linear, logarithmic)
// - Motor speed control simulation
// Pure TypeScript implementation - no external dependencies.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

interface PWMChannel {
  id: string;
  frequency: number; // Hz
  dutyCycle: number; // 0-100%
  phase: number; // 0-360 degrees
  mode: 'edge_aligned' | 'center_aligned';
  polarity: 'active_high' | 'active_low';
  enabled: boolean;
  resolution: number; // bits
  complementaryEnabled: boolean;
  deadTimeNs: number; // nanoseconds
  softStartEnabled: boolean;
  softStartRampMs: number;
  currentDutyCycle: number; // for soft start tracking
}

interface PWMWaveform {
  samples: number[];
  timePoints: number[];
  period: number;
  frequency: number;
  dutyCycle: number;
  riseTime: number;
  fallTime: number;
  highTime: number;
  lowTime: number;
}

interface CaptureResult {
  frequency: number;
  period: number;
  dutyCycle: number;
  pulseWidth: number;
  highTime: number;
  lowTime: number;
  riseTime: number;
  fallTime: number;
}

interface SPWMParameters {
  carrierFrequency: number;
  modulationFrequency: number;
  modulationIndex: number;
  outputSamples: number[];
  fundamentalAmplitude: number;
  thd: number; // Total Harmonic Distortion
}

interface ServoPosition {
  angle: number; // degrees
  pulseWidth: number; // microseconds
  frequency: number; // Hz (typically 50Hz)
  dutyCycle: number;
}

interface LEDDimming {
  brightness: number; // 0-100%
  dutyCycle: number;
  frequency: number;
  perceiveBrightness: number; // human-perceived brightness
  curve: 'linear' | 'logarithmic' | 'cie1931';
}

interface MotorControl {
  speed: number; // 0-100%
  direction: 'forward' | 'reverse' | 'brake' | 'coast';
  dutyCycle: number;
  frequency: number;
  currentEstimate: number; // estimated motor current
  pwmMode: 'sign_magnitude' | 'locked_antiphase' | 'unipolar';
}

// ============================================================================
// PWM CHANNEL MANAGEMENT
// ============================================================================

const channels: Map<string, PWMChannel> = new Map();

function createChannel(
  id: string,
  frequency: number = 1000,
  resolution: number = 10
): PWMChannel {
  const channel: PWMChannel = {
    id,
    frequency: Math.max(1, Math.min(frequency, 100000000)), // 1Hz to 100MHz
    dutyCycle: 50,
    phase: 0,
    mode: 'edge_aligned',
    polarity: 'active_high',
    enabled: false,
    resolution: Math.max(8, Math.min(resolution, 16)),
    complementaryEnabled: false,
    deadTimeNs: 100,
    softStartEnabled: false,
    softStartRampMs: 100,
    currentDutyCycle: 0,
  };

  channels.set(id, channel);
  return channel;
}

function getChannel(id: string): PWMChannel | undefined {
  return channels.get(id);
}

// ============================================================================
// PWM CALCULATIONS
// ============================================================================

function calculatePeriod(frequency: number): number {
  return 1 / frequency;
}

function calculateHighTime(period: number, dutyCycle: number): number {
  return period * (dutyCycle / 100);
}

function calculateLowTime(period: number, dutyCycle: number): number {
  return period * (1 - dutyCycle / 100);
}

// Exported utility functions for external use
export function calculateFrequencyFromPeriod(period: number): number {
  return 1 / period;
}

export function calculateDutyCycleFromTimes(highTime: number, period: number): number {
  return (highTime / period) * 100;
}

function calculateResolutionSteps(resolution: number): number {
  return Math.pow(2, resolution);
}

function calculateMinDutyCycleStep(resolution: number): number {
  return 100 / calculateResolutionSteps(resolution);
}

function quantizeDutyCycle(dutyCycle: number, resolution: number): number {
  const steps = calculateResolutionSteps(resolution);
  const quantized = Math.round((dutyCycle / 100) * steps) / steps * 100;
  return Math.max(0, Math.min(100, quantized));
}

// ============================================================================
// WAVEFORM GENERATION
// ============================================================================

function generateEdgeAlignedWaveform(
  channel: PWMChannel,
  numSamples: number = 100
): PWMWaveform {
  const period = calculatePeriod(channel.frequency);
  const highTime = calculateHighTime(period, channel.dutyCycle);
  const phaseOffset = (channel.phase / 360) * period;

  const samples: number[] = [];
  const timePoints: number[] = [];
  const dt = period / numSamples;

  for (let i = 0; i < numSamples; i++) {
    const t = i * dt;
    const adjustedT = (t + phaseOffset) % period;

    let value: number;
    if (channel.polarity === 'active_high') {
      value = adjustedT < highTime ? 1 : 0;
    } else {
      value = adjustedT < highTime ? 0 : 1;
    }

    samples.push(value);
    timePoints.push(t);
  }

  // Estimate rise/fall times (simplified model)
  const riseTime = period * 0.01; // 1% of period
  const fallTime = period * 0.01;

  return {
    samples,
    timePoints,
    period,
    frequency: channel.frequency,
    dutyCycle: channel.dutyCycle,
    riseTime,
    fallTime,
    highTime,
    lowTime: period - highTime,
  };
}

function generateCenterAlignedWaveform(
  channel: PWMChannel,
  numSamples: number = 100
): PWMWaveform {
  const period = calculatePeriod(channel.frequency);
  const highTime = calculateHighTime(period, channel.dutyCycle);
  const halfHigh = highTime / 2;
  const centerPoint = period / 2;
  const phaseOffset = (channel.phase / 360) * period;

  const samples: number[] = [];
  const timePoints: number[] = [];
  const dt = period / numSamples;

  for (let i = 0; i < numSamples; i++) {
    const t = i * dt;
    const adjustedT = (t + phaseOffset) % period;

    // Center-aligned: pulse is centered in the period
    const distFromCenter = Math.abs(adjustedT - centerPoint);

    let value: number;
    if (channel.polarity === 'active_high') {
      value = distFromCenter < halfHigh ? 1 : 0;
    } else {
      value = distFromCenter < halfHigh ? 0 : 1;
    }

    samples.push(value);
    timePoints.push(t);
  }

  const riseTime = period * 0.01;
  const fallTime = period * 0.01;

  return {
    samples,
    timePoints,
    period,
    frequency: channel.frequency,
    dutyCycle: channel.dutyCycle,
    riseTime,
    fallTime,
    highTime,
    lowTime: period - highTime,
  };
}

function generateComplementaryWaveform(
  channel: PWMChannel,
  numSamples: number = 100
): { primary: PWMWaveform; complementary: PWMWaveform } {
  const primary = channel.mode === 'center_aligned'
    ? generateCenterAlignedWaveform(channel, numSamples)
    : generateEdgeAlignedWaveform(channel, numSamples);

  // Calculate dead time in samples
  const period = calculatePeriod(channel.frequency);
  const deadTimeRatio = (channel.deadTimeNs * 1e-9) / period;
  const deadTimeSamples = Math.ceil(deadTimeRatio * numSamples);

  // Generate complementary with dead time
  const compSamples = primary.samples.map((v, i) => {
    // Invert the signal
    const inverted = 1 - v;

    // Check if we're in a dead time zone (transition region)
    const prevIdx = (i - deadTimeSamples + numSamples) % numSamples;
    const nextIdx = (i + deadTimeSamples) % numSamples;

    // If primary had a transition nearby, insert dead time (both low)
    if (primary.samples[prevIdx] !== primary.samples[i] ||
        primary.samples[i] !== primary.samples[nextIdx]) {
      // During dead time, both outputs should be low (or based on polarity)
      return channel.polarity === 'active_high' ? 0 : 1;
    }

    return inverted;
  });

  const complementary: PWMWaveform = {
    ...primary,
    samples: compSamples,
    dutyCycle: 100 - channel.dutyCycle - (deadTimeRatio * 200), // Account for dead time
  };

  return { primary, complementary };
}

// ============================================================================
// CAPTURE MODE
// ============================================================================

function simulateCapture(
  inputSignal: number[],
  sampleRate: number
): CaptureResult {
  // Find rising edges
  const risingEdges: number[] = [];
  const fallingEdges: number[] = [];

  for (let i = 1; i < inputSignal.length; i++) {
    if (inputSignal[i] > 0.5 && inputSignal[i - 1] <= 0.5) {
      risingEdges.push(i);
    }
    if (inputSignal[i] <= 0.5 && inputSignal[i - 1] > 0.5) {
      fallingEdges.push(i);
    }
  }

  if (risingEdges.length < 2) {
    throw new Error('Insufficient edges to measure period');
  }

  // Calculate period from consecutive rising edges
  const periodSamples = risingEdges[1] - risingEdges[0];
  const period = periodSamples / sampleRate;
  const frequency = 1 / period;

  // Calculate high time
  let highTimeSamples = 0;
  if (fallingEdges.length > 0 && fallingEdges[0] > risingEdges[0]) {
    highTimeSamples = fallingEdges[0] - risingEdges[0];
  }

  const highTime = highTimeSamples / sampleRate;
  const lowTime = period - highTime;
  const dutyCycle = (highTime / period) * 100;
  const pulseWidth = highTime * 1e6; // in microseconds

  // Estimate rise/fall times (simplified)
  const riseTime = period * 0.02;
  const fallTime = period * 0.02;

  return {
    frequency,
    period,
    dutyCycle,
    pulseWidth,
    highTime,
    lowTime,
    riseTime,
    fallTime,
  };
}

// ============================================================================
// SPWM (Sinusoidal PWM) FOR MOTOR CONTROL
// ============================================================================

function generateSPWM(
  carrierFrequency: number,
  modulationFrequency: number,
  modulationIndex: number,
  numSamples: number = 1000
): SPWMParameters {
  const samples: number[] = [];

  for (let i = 0; i < numSamples; i++) {
    const t = i / numSamples;

    // Carrier (triangle wave)
    const carrierPhase = (t * carrierFrequency) % 1;
    const carrier = carrierPhase < 0.5
      ? 4 * carrierPhase - 1
      : 3 - 4 * carrierPhase;

    // Modulating signal (sine wave)
    const modulating = modulationIndex * Math.sin(2 * Math.PI * modulationFrequency * t);

    // PWM comparison
    const pwmValue = modulating > carrier ? 1 : 0;
    samples.push(pwmValue);
  }

  // Calculate fundamental amplitude and THD
  const fundamentalAmplitude = modulationIndex * 0.612; // V_peak for SPWM

  // Simplified THD calculation
  let sumSquaredHarmonics = 0;
  for (let h = 2; h <= 10; h++) {
    const harmonicAmplitude = (4 / (Math.PI * h)) * Math.sin(h * Math.PI / 2) * (1 / h);
    sumSquaredHarmonics += harmonicAmplitude * harmonicAmplitude;
  }
  const thd = Math.sqrt(sumSquaredHarmonics) / fundamentalAmplitude * 100;

  return {
    carrierFrequency,
    modulationFrequency,
    modulationIndex,
    outputSamples: samples,
    fundamentalAmplitude,
    thd,
  };
}

// ============================================================================
// SERVO MOTOR CONTROL
// ============================================================================

function calculateServoPosition(
  angle: number,
  minPulseUs: number = 1000,
  maxPulseUs: number = 2000,
  frequency: number = 50
): ServoPosition {
  // Clamp angle to valid range
  const clampedAngle = Math.max(0, Math.min(180, angle));

  // Linear interpolation for pulse width
  const pulseWidth = minPulseUs + (clampedAngle / 180) * (maxPulseUs - minPulseUs);

  // Calculate period and duty cycle
  const period = 1000000 / frequency; // period in microseconds
  const dutyCycle = (pulseWidth / period) * 100;

  return {
    angle: clampedAngle,
    pulseWidth,
    frequency,
    dutyCycle,
  };
}

// Exported utility function for calculating servo angle from pulse width
export function calculateServoAngle(
  pulseWidthUs: number,
  minPulseUs: number = 1000,
  maxPulseUs: number = 2000
): number {
  const clampedPulse = Math.max(minPulseUs, Math.min(maxPulseUs, pulseWidthUs));
  return ((clampedPulse - minPulseUs) / (maxPulseUs - minPulseUs)) * 180;
}

// ============================================================================
// LED DIMMING CURVES
// ============================================================================

function calculateLEDDimming(
  brightness: number,
  curve: 'linear' | 'logarithmic' | 'cie1931' = 'cie1931',
  frequency: number = 1000
): LEDDimming {
  const clampedBrightness = Math.max(0, Math.min(100, brightness));
  let dutyCycle: number;
  let perceiveBrightness: number;

  switch (curve) {
    case 'linear':
      dutyCycle = clampedBrightness;
      // Human perception is logarithmic, so perceived brightness differs
      perceiveBrightness = Math.pow(clampedBrightness / 100, 0.4) * 100;
      break;

    case 'logarithmic':
      // Logarithmic curve for perceived linear dimming
      if (clampedBrightness === 0) {
        dutyCycle = 0;
      } else {
        dutyCycle = Math.pow(clampedBrightness / 100, 2.5) * 100;
      }
      perceiveBrightness = clampedBrightness;
      break;

    case 'cie1931':
      // CIE 1931 lightness curve for perceptually linear dimming
      const L = clampedBrightness / 100;
      if (L <= 0.08) {
        dutyCycle = (L / 9.033) * 100;
      } else {
        dutyCycle = Math.pow((L + 0.16) / 1.16, 3) * 100;
      }
      perceiveBrightness = clampedBrightness;
      break;

    default:
      dutyCycle = clampedBrightness;
      perceiveBrightness = clampedBrightness;
  }

  return {
    brightness: clampedBrightness,
    dutyCycle: Math.max(0, Math.min(100, dutyCycle)),
    frequency,
    perceiveBrightness,
    curve,
  };
}

// ============================================================================
// MOTOR SPEED CONTROL
// ============================================================================

function calculateMotorControl(
  speed: number,
  direction: 'forward' | 'reverse' | 'brake' | 'coast',
  pwmMode: 'sign_magnitude' | 'locked_antiphase' | 'unipolar' = 'sign_magnitude',
  frequency: number = 20000, // 20kHz typical for motor control
  motorResistance: number = 1, // ohms
  supplyVoltage: number = 12 // volts
): MotorControl {
  const clampedSpeed = Math.max(0, Math.min(100, speed));
  let dutyCycle: number;

  switch (pwmMode) {
    case 'sign_magnitude':
      // Duty cycle directly proportional to speed
      dutyCycle = clampedSpeed;
      if (direction === 'brake') {
        dutyCycle = 0; // Both low-side on
      } else if (direction === 'coast') {
        dutyCycle = 0; // All off
      }
      break;

    case 'locked_antiphase':
      // 50% = stopped, 0% = full reverse, 100% = full forward
      if (direction === 'forward') {
        dutyCycle = 50 + (clampedSpeed / 2);
      } else if (direction === 'reverse') {
        dutyCycle = 50 - (clampedSpeed / 2);
      } else {
        dutyCycle = 50; // Brake/coast = centered
      }
      break;

    case 'unipolar':
      // Same as sign_magnitude but with different switching pattern
      dutyCycle = clampedSpeed;
      if (direction === 'brake' || direction === 'coast') {
        dutyCycle = 0;
      }
      break;

    default:
      dutyCycle = clampedSpeed;
  }

  // Estimate motor current (simplified model)
  const effectiveVoltage = supplyVoltage * (dutyCycle / 100);
  const backEMF = effectiveVoltage * (clampedSpeed / 100) * 0.9; // Simplified back-EMF
  const currentEstimate = (effectiveVoltage - backEMF) / motorResistance;

  return {
    speed: clampedSpeed,
    direction,
    dutyCycle,
    frequency,
    currentEstimate: Math.max(0, currentEstimate),
    pwmMode,
  };
}

// ============================================================================
// SOFT START/STOP
// ============================================================================

// Exported utility function for calculating soft start ramp values
export function calculateSoftStartRamp(
  targetDutyCycle: number,
  currentDutyCycle: number,
  rampTimeMs: number,
  elapsedMs: number
): number {
  if (elapsedMs >= rampTimeMs) {
    return targetDutyCycle;
  }

  const progress = elapsedMs / rampTimeMs;
  // S-curve for smoother start
  const smoothProgress = progress * progress * (3 - 2 * progress);

  return currentDutyCycle + (targetDutyCycle - currentDutyCycle) * smoothProgress;
}

// ============================================================================
// SIGNAL ANALYSIS
// ============================================================================

function analyzeSignal(
  samples: number[],
  sampleRate: number
): {
  frequency: number;
  dutyCycle: number;
  dcOffset: number;
  rmsValue: number;
  peakToPeak: number;
  riseTime: number;
  fallTime: number;
} {
  // Calculate DC offset and RMS
  let sum = 0;
  let sumSquares = 0;
  let min = Infinity;
  let max = -Infinity;

  for (const sample of samples) {
    sum += sample;
    sumSquares += sample * sample;
    min = Math.min(min, sample);
    max = Math.max(max, sample);
  }

  const dcOffset = sum / samples.length;
  const rmsValue = Math.sqrt(sumSquares / samples.length);
  const peakToPeak = max - min;

  // Capture for frequency and duty cycle
  try {
    const capture = simulateCapture(samples, sampleRate);
    return {
      frequency: capture.frequency,
      dutyCycle: capture.dutyCycle,
      dcOffset,
      rmsValue,
      peakToPeak,
      riseTime: capture.riseTime,
      fallTime: capture.fallTime,
    };
  } catch {
    return {
      frequency: 0,
      dutyCycle: dcOffset * 100,
      dcOffset,
      rmsValue,
      peakToPeak,
      riseTime: 0,
      fallTime: 0,
    };
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const pwmcontrollerTool: UnifiedTool = {
  name: 'pwm_controller',
  description: `Comprehensive PWM signal generator and controller simulator.

Supports:
- Frequency configuration (1Hz to 100MHz)
- Duty cycle control (0-100% with configurable resolution)
- Phase control for multi-channel synchronization
- Center-aligned and edge-aligned PWM modes
- Complementary output generation with dead-time insertion
- PWM capture mode for measuring external signals
- Soft start/stop ramps with S-curve profiles
- SPWM (Sinusoidal PWM) for motor control applications
- Servo motor control (1-2ms pulse width, 50Hz)
- LED dimming curves (linear, logarithmic, CIE1931)
- DC motor speed control simulation

Operations:
- configure: Create/configure a PWM channel
- set_duty: Set duty cycle
- set_frequency: Set frequency
- set_phase: Set phase offset
- capture: Capture and measure external PWM signal
- generate_waveform: Generate PWM waveform samples
- motor_control: DC motor speed control
- servo_control: Servo motor position control
- led_control: LED dimming control
- spwm: Generate SPWM for AC motor control
- analyze_signal: Analyze PWM signal characteristics`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'configure',
          'set_duty',
          'set_frequency',
          'set_phase',
          'capture',
          'generate_waveform',
          'motor_control',
          'servo_control',
          'led_control',
          'spwm',
          'analyze_signal',
        ],
        description: 'Operation to perform',
      },
      channel_id: {
        type: 'string',
        description: 'PWM channel identifier',
      },
      frequency: {
        type: 'number',
        description: 'Frequency in Hz',
      },
      duty_cycle: {
        type: 'number',
        description: 'Duty cycle (0-100%)',
      },
      phase: {
        type: 'number',
        description: 'Phase offset (0-360 degrees)',
      },
      mode: {
        type: 'string',
        enum: ['edge_aligned', 'center_aligned'],
        description: 'PWM alignment mode',
      },
      polarity: {
        type: 'string',
        enum: ['active_high', 'active_low'],
        description: 'Output polarity',
      },
      resolution: {
        type: 'number',
        description: 'Resolution in bits (8-16)',
      },
      complementary: {
        type: 'boolean',
        description: 'Enable complementary output',
      },
      dead_time_ns: {
        type: 'number',
        description: 'Dead time in nanoseconds',
      },
      soft_start: {
        type: 'boolean',
        description: 'Enable soft start',
      },
      ramp_time_ms: {
        type: 'number',
        description: 'Soft start ramp time in milliseconds',
      },
      samples: {
        type: 'array',
        items: { type: 'number' },
        description: 'Input signal samples for capture/analysis',
      },
      sample_rate: {
        type: 'number',
        description: 'Sample rate in Hz',
      },
      num_samples: {
        type: 'number',
        description: 'Number of samples to generate',
      },
      speed: {
        type: 'number',
        description: 'Motor speed (0-100%)',
      },
      direction: {
        type: 'string',
        enum: ['forward', 'reverse', 'brake', 'coast'],
        description: 'Motor direction',
      },
      angle: {
        type: 'number',
        description: 'Servo angle (0-180 degrees)',
      },
      brightness: {
        type: 'number',
        description: 'LED brightness (0-100%)',
      },
      dimming_curve: {
        type: 'string',
        enum: ['linear', 'logarithmic', 'cie1931'],
        description: 'LED dimming curve',
      },
      carrier_frequency: {
        type: 'number',
        description: 'SPWM carrier frequency',
      },
      modulation_frequency: {
        type: 'number',
        description: 'SPWM modulation frequency',
      },
      modulation_index: {
        type: 'number',
        description: 'SPWM modulation index (0-1)',
      },
      pwm_mode: {
        type: 'string',
        enum: ['sign_magnitude', 'locked_antiphase', 'unipolar'],
        description: 'Motor PWM control mode',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executepwmcontroller(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'configure': {
        const channelId = args.channel_id || `pwm_${Date.now()}`;
        const frequency = args.frequency || 1000;
        const resolution = args.resolution || 10;

        const channel = createChannel(channelId, frequency, resolution);

        if (args.duty_cycle !== undefined) {
          channel.dutyCycle = quantizeDutyCycle(args.duty_cycle, channel.resolution);
        }
        if (args.phase !== undefined) {
          channel.phase = args.phase % 360;
        }
        if (args.mode) {
          channel.mode = args.mode;
        }
        if (args.polarity) {
          channel.polarity = args.polarity;
        }
        if (args.complementary !== undefined) {
          channel.complementaryEnabled = args.complementary;
        }
        if (args.dead_time_ns !== undefined) {
          channel.deadTimeNs = args.dead_time_ns;
        }
        if (args.soft_start !== undefined) {
          channel.softStartEnabled = args.soft_start;
        }
        if (args.ramp_time_ms !== undefined) {
          channel.softStartRampMs = args.ramp_time_ms;
        }

        channel.enabled = true;

        result = {
          operation: 'configure',
          channel: {
            id: channel.id,
            frequency: channel.frequency,
            dutyCycle: channel.dutyCycle,
            phase: channel.phase,
            mode: channel.mode,
            polarity: channel.polarity,
            resolution: channel.resolution,
            minDutyCycleStep: calculateMinDutyCycleStep(channel.resolution),
            complementaryEnabled: channel.complementaryEnabled,
            deadTimeNs: channel.deadTimeNs,
            softStartEnabled: channel.softStartEnabled,
            enabled: channel.enabled,
          },
          period: calculatePeriod(channel.frequency),
          highTime: calculateHighTime(calculatePeriod(channel.frequency), channel.dutyCycle),
        };
        break;
      }

      case 'set_duty': {
        const channel = getChannel(args.channel_id);
        if (!channel) throw new Error(`Channel not found: ${args.channel_id}`);

        const newDutyCycle = quantizeDutyCycle(args.duty_cycle || 50, channel.resolution);
        channel.dutyCycle = newDutyCycle;

        const period = calculatePeriod(channel.frequency);

        result = {
          operation: 'set_duty',
          channel_id: channel.id,
          dutyCycle: channel.dutyCycle,
          quantizedTo: calculateMinDutyCycleStep(channel.resolution),
          highTime: calculateHighTime(period, channel.dutyCycle),
          lowTime: calculateLowTime(period, channel.dutyCycle),
        };
        break;
      }

      case 'set_frequency': {
        const channel = getChannel(args.channel_id);
        if (!channel) throw new Error(`Channel not found: ${args.channel_id}`);

        channel.frequency = Math.max(1, Math.min(args.frequency || 1000, 100000000));
        const period = calculatePeriod(channel.frequency);

        result = {
          operation: 'set_frequency',
          channel_id: channel.id,
          frequency: channel.frequency,
          period,
          periodUs: period * 1e6,
          highTime: calculateHighTime(period, channel.dutyCycle),
        };
        break;
      }

      case 'set_phase': {
        const channel = getChannel(args.channel_id);
        if (!channel) throw new Error(`Channel not found: ${args.channel_id}`);

        channel.phase = (args.phase || 0) % 360;
        const period = calculatePeriod(channel.frequency);
        const phaseDelay = (channel.phase / 360) * period;

        result = {
          operation: 'set_phase',
          channel_id: channel.id,
          phase: channel.phase,
          phaseDelaySeconds: phaseDelay,
          phaseDelayUs: phaseDelay * 1e6,
        };
        break;
      }

      case 'capture': {
        const samples = args.samples || [];
        const sampleRate = args.sample_rate || 1000000;

        if (samples.length < 10) {
          throw new Error('Insufficient samples for capture (minimum 10)');
        }

        const captureResult = simulateCapture(samples, sampleRate);

        result = {
          operation: 'capture',
          sampleRate,
          numSamples: samples.length,
          measured: {
            frequency: captureResult.frequency,
            frequencyKHz: captureResult.frequency / 1000,
            period: captureResult.period,
            periodUs: captureResult.period * 1e6,
            dutyCycle: captureResult.dutyCycle,
            pulseWidthUs: captureResult.pulseWidth,
            highTime: captureResult.highTime,
            lowTime: captureResult.lowTime,
            riseTime: captureResult.riseTime,
            fallTime: captureResult.fallTime,
          },
        };
        break;
      }

      case 'generate_waveform': {
        const channel = getChannel(args.channel_id);
        if (!channel) throw new Error(`Channel not found: ${args.channel_id}`);

        const numSamples = args.num_samples || 100;

        let waveformResult: { primary: PWMWaveform; complementary?: PWMWaveform };

        if (channel.complementaryEnabled) {
          const { primary, complementary } = generateComplementaryWaveform(channel, numSamples);
          waveformResult = { primary, complementary };
        } else {
          const waveform = channel.mode === 'center_aligned'
            ? generateCenterAlignedWaveform(channel, numSamples)
            : generateEdgeAlignedWaveform(channel, numSamples);
          waveformResult = { primary: waveform };
        }

        result = {
          operation: 'generate_waveform',
          channel_id: channel.id,
          mode: channel.mode,
          waveform: {
            samples: waveformResult.primary.samples.slice(0, 50), // Limit output
            numSamples: waveformResult.primary.samples.length,
            period: waveformResult.primary.period,
            frequency: waveformResult.primary.frequency,
            dutyCycle: waveformResult.primary.dutyCycle,
            highTime: waveformResult.primary.highTime,
            lowTime: waveformResult.primary.lowTime,
          },
          complementary: waveformResult.complementary ? {
            samples: waveformResult.complementary.samples.slice(0, 50),
            dutyCycle: waveformResult.complementary.dutyCycle,
          } : undefined,
        };
        break;
      }

      case 'motor_control': {
        const speed = args.speed || 0;
        const direction = args.direction || 'forward';
        const pwmMode = args.pwm_mode || 'sign_magnitude';
        const frequency = args.frequency || 20000;

        const motorResult = calculateMotorControl(speed, direction, pwmMode, frequency);

        result = {
          operation: 'motor_control',
          input: {
            speed,
            direction,
            pwmMode,
            frequency,
          },
          output: {
            dutyCycle: motorResult.dutyCycle,
            effectiveSpeed: motorResult.speed,
            direction: motorResult.direction,
            estimatedCurrent: motorResult.currentEstimate,
            pwmFrequency: motorResult.frequency,
          },
          notes: {
            sign_magnitude: 'Duty cycle = speed, direction set by H-bridge',
            locked_antiphase: '50% = stopped, 0-50% = reverse, 50-100% = forward',
            unipolar: 'Single quadrant operation',
          },
        };
        break;
      }

      case 'servo_control': {
        const angle = args.angle || 90;
        const frequency = args.frequency || 50;
        const minPulse = args.min_pulse_us || 1000;
        const maxPulse = args.max_pulse_us || 2000;

        const servoResult = calculateServoPosition(angle, minPulse, maxPulse, frequency);

        result = {
          operation: 'servo_control',
          input: {
            angle,
            frequency,
            minPulseUs: minPulse,
            maxPulseUs: maxPulse,
          },
          output: {
            angle: servoResult.angle,
            pulseWidthUs: servoResult.pulseWidth,
            dutyCycle: servoResult.dutyCycle,
            periodMs: 1000 / servoResult.frequency,
          },
          range: {
            minAngle: 0,
            maxAngle: 180,
            minPulseUs: minPulse,
            maxPulseUs: maxPulse,
          },
        };
        break;
      }

      case 'led_control': {
        const brightness = args.brightness || 50;
        const curve = args.dimming_curve || 'cie1931';
        const frequency = args.frequency || 1000;

        const ledResult = calculateLEDDimming(brightness, curve, frequency);

        result = {
          operation: 'led_control',
          input: {
            brightness,
            curve,
            frequency,
          },
          output: {
            dutyCycle: ledResult.dutyCycle,
            perceivedBrightness: ledResult.perceiveBrightness,
            pwmFrequency: ledResult.frequency,
          },
          curves: {
            linear: 'Direct duty cycle = brightness (non-linear perception)',
            logarithmic: 'Compensates for eye response',
            cie1931: 'CIE 1931 lightness formula (most accurate)',
          },
        };
        break;
      }

      case 'spwm': {
        const carrierFreq = args.carrier_frequency || 10000;
        const modFreq = args.modulation_frequency || 50;
        const modIndex = Math.max(0, Math.min(1, args.modulation_index || 0.8));
        const numSamples = args.num_samples || 1000;

        const spwmResult = generateSPWM(carrierFreq, modFreq, modIndex, numSamples);

        result = {
          operation: 'spwm',
          input: {
            carrierFrequency: carrierFreq,
            modulationFrequency: modFreq,
            modulationIndex: modIndex,
          },
          output: {
            samples: spwmResult.outputSamples.slice(0, 100), // Limit output
            totalSamples: spwmResult.outputSamples.length,
            fundamentalAmplitude: spwmResult.fundamentalAmplitude,
            totalHarmonicDistortion: spwmResult.thd,
          },
          frequencyRatio: carrierFreq / modFreq,
          application: 'Variable frequency drive (VFD) for AC motor control',
        };
        break;
      }

      case 'analyze_signal': {
        const samples = args.samples || [];
        const sampleRate = args.sample_rate || 1000000;

        if (samples.length < 10) {
          throw new Error('Insufficient samples for analysis (minimum 10)');
        }

        const analysis = analyzeSignal(samples, sampleRate);

        result = {
          operation: 'analyze_signal',
          sampleRate,
          numSamples: samples.length,
          analysis: {
            frequency: analysis.frequency,
            frequencyKHz: analysis.frequency / 1000,
            dutyCycle: analysis.dutyCycle,
            dcOffset: analysis.dcOffset,
            rmsValue: analysis.rmsValue,
            peakToPeak: analysis.peakToPeak,
            riseTime: analysis.riseTime,
            fallTime: analysis.fallTime,
          },
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

export function ispwmcontrollerAvailable(): boolean {
  return true;
}
