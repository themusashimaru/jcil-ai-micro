import { describe, it, expect } from 'vitest';
import { executeAudioSynth, isAudioSynthAvailable, audioSynthTool } from './audio-synth-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'audio_synth', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executeAudioSynth(makeCall(args));
  return JSON.parse(res.content);
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('audioSynthTool metadata', () => {
  it('should have correct name', () => {
    expect(audioSynthTool.name).toBe('audio_synth');
  });

  it('should require operation', () => {
    expect(audioSynthTool.parameters.required).toContain('operation');
  });
});

describe('isAudioSynthAvailable', () => {
  it('should return true', () => {
    expect(isAudioSynthAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// tone operation
// -------------------------------------------------------------------
describe('executeAudioSynth - tone', () => {
  it('should generate tone by frequency', async () => {
    const result = await getResult({ operation: 'tone', frequency: 440 });
    expect(result.operation).toBe('tone');
    expect(result.specification.frequency).toBe(440);
    expect(result.specification.waveform).toBe('sine');
    expect(result.specification.duration).toBe(0.5);
    expect(result.playable_code).toContain('AudioContext');
  });

  it('should generate tone by note name', async () => {
    const result = await getResult({ operation: 'tone', note: 'A4' });
    expect(result.specification.frequency).toBeCloseTo(440, 0);
    expect(result.specification.note).toBe('A4');
  });

  it('should generate C4 at ~261.6Hz', async () => {
    const result = await getResult({ operation: 'tone', note: 'C4' });
    expect(result.specification.frequency).toBeCloseTo(261.63, 0);
  });

  it('should accept custom waveform', async () => {
    const result = await getResult({
      operation: 'tone',
      frequency: 440,
      waveform: 'square',
    });
    expect(result.specification.waveform).toBe('square');
  });

  it('should accept custom volume and duration', async () => {
    const result = await getResult({
      operation: 'tone',
      frequency: 440,
      volume: 0.8,
      duration: 2,
    });
    expect(result.specification.volume).toBe(0.8);
    expect(result.specification.duration).toBe(2);
  });

  it('should error without frequency or note', async () => {
    const res = await executeAudioSynth(makeCall({ operation: 'tone' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// chord operation
// -------------------------------------------------------------------
describe('executeAudioSynth - chord', () => {
  it('should generate chord specification', async () => {
    const result = await getResult({
      operation: 'chord',
      notes: ['C4', 'E4', 'G4'],
    });
    expect(result.operation).toBe('chord');
    expect(result.specification.notes).toHaveLength(3);
    expect(result.chord_name).toContain('C');
    expect(result.playable_code).toContain('AudioContext');
  });

  it('should error without notes', async () => {
    const res = await executeAudioSynth(makeCall({ operation: 'chord' }));
    expect(res.isError).toBe(true);
  });

  it('should error with empty notes array', async () => {
    const res = await executeAudioSynth(makeCall({ operation: 'chord', notes: [] }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// sequence operation
// -------------------------------------------------------------------
describe('executeAudioSynth - sequence', () => {
  it('should generate note sequence', async () => {
    const result = await getResult({
      operation: 'sequence',
      notes: ['C4', 'D4', 'E4', 'F4'],
    });
    expect(result.operation).toBe('sequence');
    expect(result.specification.notes).toHaveLength(4);
    expect(result.specification.total_duration).toBeGreaterThan(0);
    expect(result.playable_code).toContain('forEach');
  });

  it('should calculate correct total duration', async () => {
    const result = await getResult({
      operation: 'sequence',
      notes: ['C4', 'D4', 'E4'],
      duration: 0.5,
    });
    expect(result.specification.total_duration).toBe(1.5);
  });

  it('should error without notes', async () => {
    const res = await executeAudioSynth(makeCall({ operation: 'sequence' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// dtmf operation
// -------------------------------------------------------------------
describe('executeAudioSynth - dtmf', () => {
  it('should generate DTMF tones', async () => {
    const result = await getResult({
      operation: 'dtmf',
      dtmf_digits: '123',
    });
    expect(result.operation).toBe('dtmf');
    expect(result.specification.tones).toHaveLength(3);
    expect(result.specification.digits).toBe('123');
  });

  it('should have correct DTMF frequencies for digit 1', async () => {
    const result = await getResult({
      operation: 'dtmf',
      dtmf_digits: '1',
    });
    expect(result.specification.tones[0].frequencies.low).toBe(697);
    expect(result.specification.tones[0].frequencies.high).toBe(1209);
  });

  it('should handle special characters * and #', async () => {
    const result = await getResult({
      operation: 'dtmf',
      dtmf_digits: '*#',
    });
    expect(result.specification.tones).toHaveLength(2);
    expect(result.specification.tones[0].frequencies.low).toBe(941);
    expect(result.specification.tones[1].frequencies.low).toBe(941);
  });

  it('should error without dtmf_digits', async () => {
    const res = await executeAudioSynth(makeCall({ operation: 'dtmf' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// effect operation
// -------------------------------------------------------------------
describe('executeAudioSynth - effect', () => {
  it('should generate beep effect', async () => {
    const result = await getResult({
      operation: 'effect',
      effect_type: 'beep',
    });
    expect(result.operation).toBe('effect');
    expect(result.effect_type).toBe('beep');
    expect(result.specification.waveform).toBe('sine');
  });

  it('should generate alert effect', async () => {
    const result = await getResult({
      operation: 'effect',
      effect_type: 'alert',
    });
    expect(result.specification.pattern).toBe('alternating');
    expect(result.specification.waveform).toBe('square');
  });

  it('should generate success effect', async () => {
    const result = await getResult({
      operation: 'effect',
      effect_type: 'success',
    });
    expect(result.specification.pattern).toBe('ascending');
  });

  it('should generate error effect', async () => {
    const result = await getResult({
      operation: 'effect',
      effect_type: 'error',
    });
    expect(result.specification.pattern).toBe('descending');
    expect(result.specification.waveform).toBe('sawtooth');
  });

  it('should default to beep when no effect_type', async () => {
    const result = await getResult({ operation: 'effect' });
    expect(result.effect_type).toBe('beep');
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeAudioSynth - errors', () => {
  it('should return error for unknown operation', async () => {
    const res = await executeAudioSynth(makeCall({ operation: 'xyz' }));
    expect(res.isError).toBe(true);
  });

  it('should return toolCallId', async () => {
    const res = await executeAudioSynth({
      id: 'my-id',
      name: 'audio_synth',
      arguments: { operation: 'tone', frequency: 440 },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
