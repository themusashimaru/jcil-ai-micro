import { describe, it, expect } from 'vitest';
import { executeSignal, isSignalAvailable, signalTool } from './signal-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'signal_process', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executeSignal(makeCall(args));
  return JSON.parse(res.content);
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('signalTool metadata', () => {
  it('should have correct name', () => {
    expect(signalTool.name).toBe('signal_process');
  });

  it('should require operation', () => {
    expect(signalTool.parameters.required).toContain('operation');
  });
});

describe('isSignalAvailable', () => {
  it('should return true', () => {
    expect(isSignalAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// generate operation
// -------------------------------------------------------------------
describe('executeSignal - generate', () => {
  it('should generate a sine wave', async () => {
    const result = await getResult({
      operation: 'generate',
      wave_type: 'sine',
      frequency: 440,
      duration: 0.01,
      sample_rate: 44100,
    });
    expect(result.operation).toBe('generate');
    expect(result.waveType).toBe('sine');
    expect(result.numSamples).toBeGreaterThan(0);
    expect(result.min).toBeGreaterThanOrEqual(-1);
    expect(result.max).toBeLessThanOrEqual(1);
  });

  it('should generate a square wave', async () => {
    const result = await getResult({
      operation: 'generate',
      wave_type: 'square',
      frequency: 100,
      duration: 0.01,
    });
    expect(result.waveType).toBe('square');
    // Square wave should have values near -1 and 1
    expect(result.min).toBeCloseTo(-1, 0);
    expect(result.max).toBeCloseTo(1, 0);
  });

  it('should respect amplitude', async () => {
    const result = await getResult({
      operation: 'generate',
      wave_type: 'sine',
      frequency: 100,
      duration: 0.01,
      amplitude: 0.5,
    });
    expect(result.max).toBeLessThanOrEqual(0.6);
    expect(result.min).toBeGreaterThanOrEqual(-0.6);
  });

  it('should generate sawtooth wave', async () => {
    const result = await getResult({
      operation: 'generate',
      wave_type: 'sawtooth',
      frequency: 100,
      duration: 0.02,
    });
    expect(result.waveType).toBe('sawtooth');
  });

  it('should generate triangle wave', async () => {
    const result = await getResult({
      operation: 'generate',
      wave_type: 'triangle',
      frequency: 100,
      duration: 0.02,
    });
    expect(result.waveType).toBe('triangle');
  });
});

// -------------------------------------------------------------------
// fft operation
// -------------------------------------------------------------------
describe('executeSignal - fft', () => {
  it('should compute FFT of simple signal', async () => {
    // 8-sample signal (power of 2)
    const signal = [1, 0, -1, 0, 1, 0, -1, 0];
    const result = await getResult({
      operation: 'fft',
      signal,
    });
    expect(result.operation).toBe('fft');
    expect(result.fftLength).toBe(8);
    expect(result.wasPadded).toBe(false);
    expect(result.magnitudes).toBeDefined();
    expect(result.magnitudes.length).toBe(4); // n/2 positive frequencies
  });

  it('should pad signal to power of 2', async () => {
    const signal = [1, 0, -1, 0, 1]; // 5 samples, not power of 2
    const result = await getResult({
      operation: 'fft',
      signal,
    });
    expect(result.wasPadded).toBe(true);
    expect(result.fftLength).toBe(8); // next power of 2
  });

  it('should error without signal', async () => {
    const res = await executeSignal(makeCall({ operation: 'fft' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// spectrum operation
// -------------------------------------------------------------------
describe('executeSignal - spectrum', () => {
  it('should compute frequency spectrum', async () => {
    // Generate 128 samples of a 440Hz sine wave at 44100Hz
    const signal = [];
    for (let i = 0; i < 128; i++) {
      signal.push(Math.sin((2 * Math.PI * 440 * i) / 44100));
    }

    const result = await getResult({
      operation: 'spectrum',
      signal,
      sample_rate: 44100,
    });
    expect(result.operation).toBe('spectrum');
    expect(result.sampleRate).toBe(44100);
    expect(result.nyquistFrequency).toBe(22050);
    expect(result.dominantFrequencies).toBeDefined();
    expect(result.totalPower).toBeDefined();
  });
});

// -------------------------------------------------------------------
// analyze operation
// -------------------------------------------------------------------
describe('executeSignal - analyze', () => {
  it('should analyze signal', async () => {
    const signal = [];
    for (let i = 0; i < 256; i++) {
      signal.push(Math.sin((2 * Math.PI * 440 * i) / 44100));
    }

    const result = await getResult({
      operation: 'analyze',
      signal,
      sample_rate: 44100,
    });
    expect(result.operation).toBe('analyze');
    expect(result.timeDomain).toBeDefined();
    expect(result.timeDomain.length).toBe(256);
    expect(result.timeDomain.zeroCrossings).toBeGreaterThan(0);
    expect(result.frequencyDomain).toBeDefined();
    expect(result.frequencyDomain.peakFrequency).toBeDefined();
  });

  it('should error without signal', async () => {
    const res = await executeSignal(makeCall({ operation: 'analyze' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeSignal - errors', () => {
  it('should return error for unknown operation', async () => {
    const res = await executeSignal(makeCall({ operation: 'unknown' }));
    expect(res.isError).toBe(true);
  });

  it('should return toolCallId', async () => {
    const res = await executeSignal({
      id: 'my-id',
      name: 'signal_process',
      arguments: { operation: 'generate', wave_type: 'sine', frequency: 440, duration: 0.01 },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
