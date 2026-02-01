/**
 * AUDIO WAVEFORM TOOL
 * Generate and analyze audio waveforms, synthesizer basics
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

type WaveType = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise';

function generateWave(type: WaveType, frequency: number, sampleRate: number, duration: number): number[] {
  const samples = Math.floor(sampleRate * duration);
  const wave: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const phase = frequency * t * 2 * Math.PI;
    let value: number;
    switch (type) {
      case 'sine': value = Math.sin(phase); break;
      case 'square': value = Math.sin(phase) >= 0 ? 1 : -1; break;
      case 'sawtooth': value = 2 * ((frequency * t) % 1) - 1; break;
      case 'triangle': value = 2 * Math.abs(2 * ((frequency * t) % 1) - 1) - 1; break;
      case 'noise': value = Math.random() * 2 - 1; break;
    }
    wave.push(value);
  }
  return wave;
}

function generateADSR(attack: number, decay: number, sustain: number, release: number, sampleRate: number, duration: number): number[] {
  const samples = Math.floor(sampleRate * duration);
  const envelope: number[] = [];
  const attackSamples = Math.floor(attack * sampleRate);
  const decaySamples = Math.floor(decay * sampleRate);
  const releaseSamples = Math.floor(release * sampleRate);
  const sustainSamples = samples - attackSamples - decaySamples - releaseSamples;
  for (let i = 0; i < attackSamples; i++) envelope.push(i / attackSamples);
  for (let i = 0; i < decaySamples; i++) envelope.push(1 - (1 - sustain) * (i / decaySamples));
  for (let i = 0; i < sustainSamples; i++) envelope.push(sustain);
  for (let i = 0; i < releaseSamples; i++) envelope.push(sustain * (1 - i / releaseSamples));
  return envelope;
}

function applyEnvelope(wave: number[], envelope: number[]): number[] {
  return wave.map((v, i) => v * (envelope[i] || 0));
}
void applyEnvelope; // Available for advanced synthesis

function mixWaves(waves: number[][]): number[] {
  const maxLen = Math.max(...waves.map(w => w.length));
  const mixed: number[] = [];
  for (let i = 0; i < maxLen; i++) {
    let sum = 0;
    for (const wave of waves) sum += wave[i] || 0;
    mixed.push(sum / waves.length);
  }
  return mixed;
}

function analyzeWave(wave: number[]): Record<string, unknown> {
  const min = Math.min(...wave);
  const max = Math.max(...wave);
  const avg = wave.reduce((a, b) => a + b, 0) / wave.length;
  const rms = Math.sqrt(wave.reduce((a, b) => a + b * b, 0) / wave.length);
  let zeroCrossings = 0;
  for (let i = 1; i < wave.length; i++) {
    if ((wave[i - 1] >= 0 && wave[i] < 0) || (wave[i - 1] < 0 && wave[i] >= 0)) zeroCrossings++;
  }
  return { samples: wave.length, min, max, average: avg, rms, zeroCrossings, peakToPeak: max - min };
}

function waveToAscii(wave: number[], width: number = 60, height: number = 10): string {
  const step = Math.max(1, Math.floor(wave.length / width));
  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));
  for (let x = 0; x < width && x * step < wave.length; x++) {
    const value = wave[x * step];
    const y = Math.floor((1 - (value + 1) / 2) * (height - 1));
    if (y >= 0 && y < height) grid[y][x] = '*';
  }
  return grid.map(row => row.join('')).join('\n');
}

function frequencyToNote(freq: number): string {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const A4 = 440;
  const semitones = Math.round(12 * Math.log2(freq / A4));
  const noteIndex = (semitones + 9 + 120) % 12;
  const octave = Math.floor((semitones + 9 + 120) / 12) - 10 + 4;
  return `${notes[noteIndex]}${octave}`;
}

function noteToFrequency(note: string): number {
  const notes: Record<string, number> = { 'C': -9, 'C#': -8, 'Db': -8, 'D': -7, 'D#': -6, 'Eb': -6, 'E': -5, 'F': -4, 'F#': -3, 'Gb': -3, 'G': -2, 'G#': -1, 'Ab': -1, 'A': 0, 'A#': 1, 'Bb': 1, 'B': 2 };
  const match = note.match(/^([A-Ga-g]#?b?)(\d+)$/);
  if (!match) return 440;
  const noteName = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  const octave = parseInt(match[2]);
  const semitones = notes[noteName] + (octave - 4) * 12;
  return 440 * Math.pow(2, semitones / 12);
}

function generateChord(notes: string[], waveType: WaveType, sampleRate: number, duration: number): number[] {
  const waves = notes.map(note => {
    const freq = noteToFrequency(note);
    return generateWave(waveType, freq, sampleRate, duration);
  });
  return mixWaves(waves);
}

export const audioWaveformTool: UnifiedTool = {
  name: 'audio_waveform',
  description: 'Audio Waveform: generate, envelope, mix, analyze, note_to_freq, chord',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['generate', 'envelope', 'mix', 'analyze', 'note_to_freq', 'freq_to_note', 'chord', 'ascii'] },
      waveType: { type: 'string' },
      frequency: { type: 'number' },
      duration: { type: 'number' },
      note: { type: 'string' },
      notes: { type: 'array' },
      attack: { type: 'number' },
      decay: { type: 'number' },
      sustain: { type: 'number' },
      release: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeAudioWaveform(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const sampleRate = 1000;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'generate':
        const wave = generateWave(args.waveType || 'sine', args.frequency || 440, sampleRate, args.duration || 0.1);
        result = { waveType: args.waveType || 'sine', frequency: args.frequency || 440, samples: wave.length, analysis: analyzeWave(wave), ascii: waveToAscii(wave) };
        break;
      case 'envelope':
        const env = generateADSR(args.attack || 0.01, args.decay || 0.1, args.sustain || 0.7, args.release || 0.2, sampleRate, args.duration || 0.5);
        result = { adsr: { attack: args.attack || 0.01, decay: args.decay || 0.1, sustain: args.sustain || 0.7, release: args.release || 0.2 }, samples: env.length, ascii: waveToAscii(env) };
        break;
      case 'mix':
        const wave1 = generateWave('sine', 440, sampleRate, 0.1);
        const wave2 = generateWave('sine', 554.37, sampleRate, 0.1);
        const wave3 = generateWave('sine', 659.25, sampleRate, 0.1);
        const mixed = mixWaves([wave1, wave2, wave3]);
        result = { description: 'Mixed A Major chord (A4, C#5, E5)', analysis: analyzeWave(mixed), ascii: waveToAscii(mixed) };
        break;
      case 'analyze':
        const analyzeWv = generateWave(args.waveType || 'sine', args.frequency || 440, sampleRate, args.duration || 0.1);
        result = analyzeWave(analyzeWv);
        break;
      case 'note_to_freq':
        const freq = noteToFrequency(args.note || 'A4');
        result = { note: args.note || 'A4', frequency: freq };
        break;
      case 'freq_to_note':
        const note = frequencyToNote(args.frequency || 440);
        result = { frequency: args.frequency || 440, note };
        break;
      case 'chord':
        const chordNotes = args.notes || ['C4', 'E4', 'G4'];
        const chordWave = generateChord(chordNotes, args.waveType || 'sine', sampleRate, args.duration || 0.1);
        result = { notes: chordNotes, analysis: analyzeWave(chordWave), ascii: waveToAscii(chordWave) };
        break;
      case 'ascii':
        const asciiWave = generateWave(args.waveType || 'sine', args.frequency || 440, sampleRate, args.duration || 0.1);
        result = { ascii: waveToAscii(asciiWave, 70, 12) };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isAudioWaveformAvailable(): boolean { return true; }
