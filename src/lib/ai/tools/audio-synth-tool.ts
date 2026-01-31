/**
 * AUDIO SYNTHESIS TOOL
 *
 * Generate audio tones and sounds using Tone.js.
 * Note: This tool generates audio specifications/configurations
 * that can be played on the client side.
 *
 * Capabilities:
 * - Generate tone specifications
 * - Create chord progressions
 * - Generate DTMF tones
 * - Sound effect parameters
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Note: Tone.js requires Web Audio API, so we generate specifications
// that can be played on the client side

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const audioSynthTool: UnifiedTool = {
  name: 'audio_synth',
  description: `Generate audio tone specifications and sound configurations.

Operations:
- tone: Generate a single tone specification
- chord: Generate chord (multiple notes)
- sequence: Generate note sequence/melody
- dtmf: Generate DTMF (phone keypad) tones
- effect: Generate sound effect parameters

Note specifications:
- Frequency in Hz (e.g., 440 for A4)
- Note name (e.g., "C4", "A#5", "Db3")
- Duration in seconds

Waveforms:
- sine: Pure tone
- square: Rich harmonics
- sawtooth: Bright, buzzy
- triangle: Soft, flute-like

This tool returns audio specifications that can be played
using the Web Audio API or Tone.js on the client.`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['tone', 'chord', 'sequence', 'dtmf', 'effect'],
        description: 'Audio operation to perform',
      },
      frequency: {
        type: 'number',
        description: 'For tone: frequency in Hz',
      },
      note: {
        type: 'string',
        description: 'For tone: note name (e.g., "C4", "A#5")',
      },
      notes: {
        type: 'array',
        items: { type: 'string' },
        description: 'For chord/sequence: array of note names',
      },
      duration: {
        type: 'number',
        description: 'Duration in seconds (default: 0.5)',
      },
      waveform: {
        type: 'string',
        enum: ['sine', 'square', 'sawtooth', 'triangle'],
        description: 'Oscillator waveform (default: sine)',
      },
      dtmf_digits: {
        type: 'string',
        description: 'For dtmf: digits to generate (0-9, *, #)',
      },
      effect_type: {
        type: 'string',
        enum: ['beep', 'alert', 'success', 'error', 'notification', 'click'],
        description: 'For effect: type of sound effect',
      },
      volume: {
        type: 'number',
        description: 'Volume/gain (0-1, default: 0.5)',
      },
      attack: {
        type: 'number',
        description: 'Attack time in seconds (default: 0.01)',
      },
      release: {
        type: 'number',
        description: 'Release time in seconds (default: 0.1)',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isAudioSynthAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeAudioSynth(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    operation: string;
    frequency?: number;
    note?: string;
    notes?: string[];
    duration?: number;
    waveform?: string;
    dtmf_digits?: string;
    effect_type?: string;
    volume?: number;
    attack?: number;
    release?: number;
  };

  if (!args.operation) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({ error: 'Operation is required' }),
      isError: true,
    };
  }

  try {
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'tone': {
        let frequency = args.frequency;

        if (args.note) {
          frequency = noteToFrequency(args.note);
        }

        if (!frequency) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Frequency or note required for tone' }),
            isError: true,
          };
        }

        result = {
          operation: 'tone',
          specification: {
            type: 'tone',
            frequency,
            note: args.note || frequencyToNote(frequency),
            duration: args.duration || 0.5,
            waveform: args.waveform || 'sine',
            volume: args.volume ?? 0.5,
            envelope: {
              attack: args.attack ?? 0.01,
              decay: 0.1,
              sustain: 0.8,
              release: args.release ?? 0.1,
            },
          },
          playable_code: generateToneCode(frequency, args),
        };
        break;
      }

      case 'chord': {
        if (!args.notes || args.notes.length === 0) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Notes array required for chord' }),
            isError: true,
          };
        }

        const frequencies = args.notes.map((n) => ({
          note: n,
          frequency: noteToFrequency(n),
        }));

        result = {
          operation: 'chord',
          specification: {
            type: 'chord',
            notes: frequencies,
            duration: args.duration || 1,
            waveform: args.waveform || 'sine',
            volume: args.volume ?? 0.3,
          },
          chord_name: identifyChord(args.notes),
          playable_code: generateChordCode(frequencies, args),
        };
        break;
      }

      case 'sequence': {
        if (!args.notes || args.notes.length === 0) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Notes array required for sequence' }),
            isError: true,
          };
        }

        const noteDuration = args.duration || 0.25;
        const sequence = args.notes.map((n, i) => ({
          note: n,
          frequency: noteToFrequency(n),
          time: i * noteDuration,
          duration: noteDuration * 0.9,
        }));

        result = {
          operation: 'sequence',
          specification: {
            type: 'sequence',
            notes: sequence,
            total_duration: args.notes.length * noteDuration,
            waveform: args.waveform || 'sine',
            volume: args.volume ?? 0.5,
          },
          playable_code: generateSequenceCode(sequence, args),
        };
        break;
      }

      case 'dtmf': {
        if (!args.dtmf_digits) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'DTMF digits required' }),
            isError: true,
          };
        }

        const dtmfTones = args.dtmf_digits.split('').map((digit, i) => {
          const freqs = getDTMFFrequencies(digit);
          return {
            digit,
            frequencies: freqs,
            time: i * 0.2,
            duration: 0.15,
          };
        });

        result = {
          operation: 'dtmf',
          specification: {
            type: 'dtmf',
            digits: args.dtmf_digits,
            tones: dtmfTones,
            total_duration: args.dtmf_digits.length * 0.2,
          },
          playable_code: generateDTMFCode(dtmfTones),
        };
        break;
      }

      case 'effect': {
        const effectType = args.effect_type || 'beep';
        const effectSpec = generateEffectSpec(effectType, args);

        result = {
          operation: 'effect',
          effect_type: effectType,
          specification: effectSpec,
          playable_code: generateEffectCode(effectSpec),
        };
        break;
      }

      default:
        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({ error: `Unknown operation: ${args.operation}` }),
          isError: true,
        };
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify(result),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        error: 'Audio synthesis failed',
        details: error instanceof Error ? error.message : String(error),
      }),
      isError: true,
    };
  }
}

// Convert note name to frequency
function noteToFrequency(note: string): number {
  const noteMap: Record<string, number> = {
    C: 0,
    'C#': 1,
    Db: 1,
    D: 2,
    'D#': 3,
    Eb: 3,
    E: 4,
    F: 5,
    'F#': 6,
    Gb: 6,
    G: 7,
    'G#': 8,
    Ab: 8,
    A: 9,
    'A#': 10,
    Bb: 10,
    B: 11,
  };

  const match = note.match(/^([A-G][#b]?)(\d)$/);
  if (!match) return 440; // Default to A4

  const noteName = match[1];
  const octave = parseInt(match[2]);
  const semitone = noteMap[noteName];

  // A4 = 440Hz, calculate from there
  const semitonesFromA4 = semitone - 9 + (octave - 4) * 12;
  return 440 * Math.pow(2, semitonesFromA4 / 12);
}

// Convert frequency to approximate note name
function frequencyToNote(freq: number): string {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const semitones = Math.round(12 * Math.log2(freq / 440)) + 9;
  const octave = Math.floor(semitones / 12) + 4;
  const noteIndex = ((semitones % 12) + 12) % 12;
  return notes[noteIndex] + octave;
}

// Get DTMF frequencies for a digit
function getDTMFFrequencies(digit: string): { low: number; high: number } {
  const dtmfMap: Record<string, { low: number; high: number }> = {
    '1': { low: 697, high: 1209 },
    '2': { low: 697, high: 1336 },
    '3': { low: 697, high: 1477 },
    '4': { low: 770, high: 1209 },
    '5': { low: 770, high: 1336 },
    '6': { low: 770, high: 1477 },
    '7': { low: 852, high: 1209 },
    '8': { low: 852, high: 1336 },
    '9': { low: 852, high: 1477 },
    '*': { low: 941, high: 1209 },
    '0': { low: 941, high: 1336 },
    '#': { low: 941, high: 1477 },
  };
  return dtmfMap[digit] || { low: 440, high: 880 };
}

// Try to identify chord name
function identifyChord(notes: string[]): string | null {
  if (notes.length < 3) return null;

  // Simple chord identification (could be expanded)
  const root = notes[0].replace(/\d/, '');
  return `${root} chord (${notes.length} notes)`;
}

// Generate effect specification
function generateEffectSpec(
  type: string,
  args: { volume?: number; duration?: number }
): Record<string, unknown> {
  const volume = args.volume ?? 0.5;
  const baseDuration = args.duration || 0.2;

  const effects: Record<string, Record<string, unknown>> = {
    beep: {
      frequencies: [880],
      duration: baseDuration,
      waveform: 'sine',
      volume,
    },
    alert: {
      frequencies: [440, 880],
      pattern: 'alternating',
      duration: baseDuration * 4,
      waveform: 'square',
      volume,
    },
    success: {
      frequencies: [523.25, 659.25, 783.99], // C5, E5, G5
      pattern: 'ascending',
      duration: baseDuration * 3,
      waveform: 'sine',
      volume,
    },
    error: {
      frequencies: [200, 150],
      pattern: 'descending',
      duration: baseDuration * 2,
      waveform: 'sawtooth',
      volume,
    },
    notification: {
      frequencies: [587.33, 880], // D5, A5
      pattern: 'double',
      duration: baseDuration * 2,
      waveform: 'triangle',
      volume,
    },
    click: {
      frequencies: [1000],
      duration: 0.02,
      waveform: 'square',
      volume: volume * 0.3,
    },
  };

  return effects[type] || effects.beep;
}

// Generate playable JavaScript code snippets
function generateToneCode(
  frequency: number,
  args: { duration?: number; waveform?: string; volume?: number }
): string {
  return `// Web Audio API tone
const ctx = new AudioContext();
const osc = ctx.createOscillator();
const gain = ctx.createGain();
osc.type = '${args.waveform || 'sine'}';
osc.frequency.value = ${frequency};
gain.gain.value = ${args.volume ?? 0.5};
osc.connect(gain).connect(ctx.destination);
osc.start();
osc.stop(ctx.currentTime + ${args.duration || 0.5});`;
}

function generateChordCode(
  frequencies: { note: string; frequency: number }[],
  args: { duration?: number; waveform?: string; volume?: number }
): string {
  return `// Web Audio API chord
const ctx = new AudioContext();
${frequencies.map((_, i) => `const osc${i} = ctx.createOscillator();`).join('\n')}
const gain = ctx.createGain();
gain.gain.value = ${(args.volume ?? 0.3) / frequencies.length};
${frequencies.map((f, i) => `osc${i}.type = '${args.waveform || 'sine'}'; osc${i}.frequency.value = ${f.frequency.toFixed(2)};`).join('\n')}
${frequencies.map((_, i) => `osc${i}.connect(gain);`).join('\n')}
gain.connect(ctx.destination);
${frequencies.map((_, i) => `osc${i}.start(); osc${i}.stop(ctx.currentTime + ${args.duration || 1});`).join('\n')}`;
}

function generateSequenceCode(
  sequence: { note: string; frequency: number; time: number; duration: number }[],
  args: { waveform?: string; volume?: number }
): string {
  return `// Web Audio API sequence
const ctx = new AudioContext();
const notes = ${JSON.stringify(sequence.map((n) => ({ f: n.frequency, t: n.time, d: n.duration })))};
notes.forEach(n => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = '${args.waveform || 'sine'}';
  osc.frequency.value = n.f;
  gain.gain.value = ${args.volume ?? 0.5};
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + n.t);
  osc.stop(ctx.currentTime + n.t + n.d);
});`;
}

function generateDTMFCode(
  tones: {
    digit: string;
    frequencies: { low: number; high: number };
    time: number;
    duration: number;
  }[]
): string {
  return `// Web Audio API DTMF
const ctx = new AudioContext();
${JSON.stringify(tones)}.forEach(t => {
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  osc1.frequency.value = t.frequencies.low;
  osc2.frequency.value = t.frequencies.high;
  gain.gain.value = 0.25;
  osc1.connect(gain); osc2.connect(gain);
  gain.connect(ctx.destination);
  osc1.start(ctx.currentTime + t.time); osc2.start(ctx.currentTime + t.time);
  osc1.stop(ctx.currentTime + t.time + t.duration);
  osc2.stop(ctx.currentTime + t.time + t.duration);
});`;
}

function generateEffectCode(spec: Record<string, unknown>): string {
  return `// Web Audio API effect
const ctx = new AudioContext();
// Effect: ${JSON.stringify(spec)}
// Implement based on specification above`;
}
