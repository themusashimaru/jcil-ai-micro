/**
 * MUSIC THEORY TOOL
 *
 * Comprehensive music theory calculations, chord progressions,
 * scale analysis, and melody generation.
 *
 * Part of TIER SOUND & MUSIC - Ultimate Tool Arsenal
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const SCALE_PATTERNS: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  natural_minor: [0, 2, 3, 5, 7, 8, 10],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
  melodic_minor: [0, 2, 3, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  pentatonic_major: [0, 2, 4, 7, 9],
  pentatonic_minor: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  whole_tone: [0, 2, 4, 6, 8, 10],
};

const CHORD_PATTERNS: Record<string, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  augmented: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  major7: [0, 4, 7, 11],
  minor7: [0, 3, 7, 10],
  dominant7: [0, 4, 7, 10],
  diminished7: [0, 3, 6, 9],
  major9: [0, 4, 7, 11, 14],
  minor9: [0, 3, 7, 10, 14],
  dominant9: [0, 4, 7, 10, 14],
  power: [0, 7],
};

const CHORD_PROGRESSIONS: Record<string, { numerals: string[]; chords: number[] }> = {
  'I-IV-V-I': { numerals: ['I', 'IV', 'V', 'I'], chords: [0, 5, 7, 0] },
  'I-V-vi-IV': { numerals: ['I', 'V', 'vi', 'IV'], chords: [0, 7, 9, 5] },
  'ii-V-I': { numerals: ['ii', 'V', 'I'], chords: [2, 7, 0] },
  'I-vi-IV-V': { numerals: ['I', 'vi', 'IV', 'V'], chords: [0, 9, 5, 7] },
  '12-bar-blues': { numerals: ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'], chords: [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7] },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function noteToMidi(noteName: string): number {
  const match = noteName.match(/^([A-G][#b]?)(\d)?$/i);
  if (!match) return 60;
  const note = match[1].toUpperCase();
  const octave = match[2] ? parseInt(match[2]) : 4;
  let noteIndex = NOTE_NAMES.indexOf(note);
  if (noteIndex < 0) noteIndex = NOTE_NAMES_FLAT.indexOf(note);
  if (noteIndex < 0) return 60;
  return noteIndex + (octave + 1) * 12;
}

function midiToNote(midi: number, useFlats: boolean = false): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  const names = useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES;
  return `${names[noteIndex]}${octave}`;
}

function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function frequencyToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

function getScaleNotes(root: string, scaleType: string): string[] {
  const pattern = SCALE_PATTERNS[scaleType];
  if (!pattern) return [];
  let rootIndex = NOTE_NAMES.indexOf(root.replace(/\d/, ''));
  if (rootIndex < 0) rootIndex = NOTE_NAMES_FLAT.indexOf(root.replace(/\d/, ''));
  if (rootIndex < 0) return [];
  return pattern.map(interval => NOTE_NAMES[(rootIndex + interval) % 12]);
}

function getChordNotes(root: string, chordType: string): string[] {
  const pattern = CHORD_PATTERNS[chordType];
  if (!pattern) return [];
  let rootIndex = NOTE_NAMES.indexOf(root.replace(/\d/, ''));
  if (rootIndex < 0) rootIndex = NOTE_NAMES_FLAT.indexOf(root.replace(/\d/, ''));
  if (rootIndex < 0) return [];
  return pattern.map(interval => NOTE_NAMES[(rootIndex + interval) % 12]);
}

function analyzeInterval(note1: string, note2: string): { semitones: number; name: string } {
  const midi1 = noteToMidi(note1);
  const midi2 = noteToMidi(note2);
  const semitones = Math.abs(midi2 - midi1) % 12;
  const names = ['Unison', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Perfect 4th', 'Tritone', 'Perfect 5th', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th'];
  return { semitones, name: names[semitones] };
}

function visualizeScale(notes: string[]): string {
  const whiteKeys = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  let line1 = '│';
  let line2 = '│';
  for (const k of whiteKeys) {
    const inScale = notes.includes(k);
    line1 += inScale ? '██│' : '  │';
    line2 += ` ${k} │`;
  }
  return line1 + '\n' + line2;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const musicTheoryTool: UnifiedTool = {
  name: 'music_theory',
  description: `Music theory calculations: scales, chords, progressions, intervals.

Operations:
- scale: Get notes in a scale
- chord: Get notes in a chord  
- progression: Get chord progression in key
- interval: Analyze interval between notes
- transpose: Transpose notes
- frequency: Note/MIDI/frequency conversion
- list_scales: Available scales
- list_chords: Available chord types`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['scale', 'chord', 'progression', 'interval', 'transpose', 'frequency', 'list_scales', 'list_chords'],
        description: 'Music theory operation',
      },
      root: { type: 'string', description: 'Root note (C, F#, Bb)' },
      key: { type: 'string', description: 'Key for progressions' },
      scale_type: { type: 'string', description: 'Scale type' },
      chord_type: { type: 'string', description: 'Chord type' },
      progression_name: { type: 'string', description: 'Progression name' },
      note1: { type: 'string', description: 'First note' },
      note2: { type: 'string', description: 'Second note' },
      notes: { type: 'string', description: 'Comma-separated notes' },
      semitones: { type: 'number', description: 'Transposition semitones' },
      midi: { type: 'number', description: 'MIDI note' },
      frequency: { type: 'number', description: 'Frequency Hz' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeMusicTheory(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let result: Record<string, unknown>;

    switch (operation) {
      case 'scale': {
        const { root = 'C', scale_type = 'major' } = args;
        const notes = getScaleNotes(root, scale_type);
        if (!notes.length) throw new Error(`Unknown scale: ${scale_type}`);
        result = {
          operation: 'scale',
          root,
          type: scale_type,
          notes,
          visualization: visualizeScale(notes),
        };
        break;
      }

      case 'chord': {
        const { root = 'C', chord_type = 'major' } = args;
        const notes = getChordNotes(root, chord_type);
        if (!notes.length) throw new Error(`Unknown chord: ${chord_type}`);
        result = { operation: 'chord', name: `${root} ${chord_type}`, notes };
        break;
      }

      case 'progression': {
        const { key = 'C', progression_name = 'I-V-vi-IV' } = args;
        const prog = CHORD_PROGRESSIONS[progression_name];
        if (!prog) throw new Error(`Unknown progression: ${progression_name}`);
        const keyIndex = NOTE_NAMES.indexOf(key);
        const chords = prog.chords.map((interval, i) => ({
          numeral: prog.numerals[i],
          root: NOTE_NAMES[(keyIndex + interval) % 12],
        }));
        result = { operation: 'progression', key, name: progression_name, chords };
        break;
      }

      case 'interval': {
        const { note1 = 'C4', note2 = 'G4' } = args;
        result = { operation: 'interval', note1, note2, ...analyzeInterval(note1, note2) };
        break;
      }

      case 'transpose': {
        const { notes: notesStr = 'C4,E4,G4', semitones: semi = 2 } = args;
        const notes = notesStr.split(',').map((n: string) => n.trim());
        const transposed = notes.map((n: string) => midiToNote(noteToMidi(n) + semi));
        result = { operation: 'transpose', original: notes, semitones: semi, transposed };
        break;
      }

      case 'frequency': {
        const { root, midi, frequency } = args;
        if (root) {
          const m = noteToMidi(root);
          result = { note: root, midi: m, frequency: Math.round(midiToFrequency(m) * 100) / 100 };
        } else if (midi !== undefined) {
          result = { note: midiToNote(midi), midi, frequency: Math.round(midiToFrequency(midi) * 100) / 100 };
        } else if (frequency) {
          const m = Math.round(frequencyToMidi(frequency));
          result = { note: midiToNote(m), midi: m, frequency };
        } else {
          result = { reference: 'A4 = 440 Hz = MIDI 69' };
        }
        break;
      }

      case 'list_scales': {
        result = { scales: Object.keys(SCALE_PATTERNS) };
        break;
      }

      case 'list_chords': {
        result = { chords: Object.keys(CHORD_PATTERNS) };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (error) {
    return { toolCallId: id, content: `Music Theory Error: ${error instanceof Error ? error.message : 'Unknown'}`, isError: true };
  }
}

export function isMusicTheoryAvailable(): boolean {
  return true;
}
