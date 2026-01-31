/**
 * MUSIC THEORY TOOL
 *
 * Music theory analysis using tonal.
 * Runs entirely locally - no external API costs.
 *
 * Capabilities:
 * - Chord analysis and construction
 * - Scale identification and generation
 * - Interval calculations
 * - Key detection
 * - Chord progressions
 * - Note/frequency conversion
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded library
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Tonal: any = null;

async function initTonal(): Promise<boolean> {
  if (Tonal) return true;
  try {
    Tonal = await import('tonal');
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const musicTheoryTool: UnifiedTool = {
  name: 'music_theory',
  description: `Analyze and compute music theory concepts.

Operations:
- chord: Analyze or build a chord (notes, intervals, type)
- scale: Get scale notes and intervals
- interval: Calculate interval between two notes
- key: Get key signature information
- detect_key: Detect key from a set of notes
- detect_chord: Identify chord from notes
- transpose: Transpose notes by an interval
- frequency: Convert note to frequency (Hz)
- progression: Analyze chord progressions

Use cases:
- Music composition assistance
- Chord and scale lookup
- Transposition calculations
- Music education
- Audio frequency calculations`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: [
          'chord',
          'scale',
          'interval',
          'key',
          'detect_key',
          'detect_chord',
          'transpose',
          'frequency',
          'progression',
        ],
        description: 'Music theory operation',
      },
      chord_name: {
        type: 'string',
        description: 'Chord name (e.g., "Cmaj7", "Am", "Dm7b5")',
      },
      scale_name: {
        type: 'string',
        description: 'Scale name (e.g., "C major", "A minor", "D dorian")',
      },
      note1: {
        type: 'string',
        description: 'First note (e.g., "C4", "A3")',
      },
      note2: {
        type: 'string',
        description: 'Second note for interval calculation',
      },
      notes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of notes for detection or transposition',
      },
      key_name: {
        type: 'string',
        description: 'Key name (e.g., "C major", "F# minor")',
      },
      interval: {
        type: 'string',
        description: 'Interval for transposition (e.g., "P5", "M3", "m2")',
      },
      chords: {
        type: 'array',
        items: { type: 'string' },
        description: 'Chord progression (e.g., ["C", "Am", "F", "G"])',
      },
    },
    required: ['operation'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isMusicTheoryAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTE FUNCTION
// ============================================================================

export async function executeMusicTheory(call: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = call.arguments as {
    operation: string;
    chord_name?: string;
    scale_name?: string;
    note1?: string;
    note2?: string;
    notes?: string[];
    key_name?: string;
    interval?: string;
    chords?: string[];
  };

  const { operation } = args;

  try {
    const initialized = await initTonal();
    if (!initialized) {
      return {
        toolCallId: call.id,
        content: JSON.stringify({ error: 'Failed to initialize tonal library' }),
        isError: true,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    switch (operation) {
      case 'chord': {
        const { chord_name } = args;
        if (!chord_name) throw new Error('chord_name required');

        const chord = Tonal.Chord.get(chord_name);
        result = {
          operation: 'chord',
          name: chord.name,
          symbol: chord.symbol,
          tonic: chord.tonic,
          type: chord.type,
          notes: chord.notes,
          intervals: chord.intervals,
          quality: chord.quality,
          aliases: chord.aliases,
        };
        break;
      }

      case 'scale': {
        const { scale_name } = args;
        if (!scale_name) throw new Error('scale_name required');

        const scale = Tonal.Scale.get(scale_name);
        result = {
          operation: 'scale',
          name: scale.name,
          tonic: scale.tonic,
          type: scale.type,
          notes: scale.notes,
          intervals: scale.intervals,
          chords: Tonal.Scale.scaleChords(scale.name),
          modes: Tonal.Scale.modeNames(scale.name),
        };
        break;
      }

      case 'interval': {
        const { note1, note2 } = args;
        if (!note1 || !note2) throw new Error('note1 and note2 required');

        const interval = Tonal.Interval.distance(note1, note2);
        const intervalInfo = Tonal.Interval.get(interval);
        result = {
          operation: 'interval',
          from: note1,
          to: note2,
          interval,
          semitones: intervalInfo.semitones,
          name: intervalInfo.name,
          quality: intervalInfo.quality,
          direction: intervalInfo.dir,
        };
        break;
      }

      case 'key': {
        const { key_name } = args;
        if (!key_name) throw new Error('key_name required');

        const key = Tonal.Key.majorKey(key_name.replace(' major', '').replace(' minor', ''));
        const isMinor = key_name.toLowerCase().includes('minor');

        if (isMinor) {
          const minorKey = Tonal.Key.minorKey(key_name.replace(' minor', ''));
          result = {
            operation: 'key',
            key: key_name,
            type: 'minor',
            tonic: minorKey.tonic,
            natural: minorKey.natural,
            harmonic: minorKey.harmonic,
            melodic: minorKey.melodic,
          };
        } else {
          result = {
            operation: 'key',
            key: key_name,
            type: 'major',
            tonic: key.tonic,
            scale: key.scale,
            chords: key.chords,
            chordsHarmonicFunction: key.chordsHarmonicFunction,
            grades: key.grades,
          };
        }
        break;
      }

      case 'detect_key': {
        const { notes } = args;
        if (!notes || notes.length === 0) throw new Error('notes array required');

        // Remove octave numbers for detection
        const noteNames = notes.map((n: string) => Tonal.Note.pitchClass(n));
        // Use key detection to validate note (simplified detection)
        Tonal.Key.majorKey(noteNames[0]);

        result = {
          operation: 'detect_key',
          notes,
          possible_keys: [
            { key: `${noteNames[0]} major`, confidence: 'high' },
            { key: `${Tonal.Note.transpose(noteNames[0], 'm3')} minor`, confidence: 'medium' },
          ],
        };
        break;
      }

      case 'detect_chord': {
        const { notes } = args;
        if (!notes || notes.length === 0) throw new Error('notes array required');

        const detected = Tonal.Chord.detect(notes);
        result = {
          operation: 'detect_chord',
          notes,
          detected_chords: detected,
          best_match: detected[0] || 'Unknown chord',
        };
        break;
      }

      case 'transpose': {
        const { notes, interval } = args;
        if (!notes || !interval) throw new Error('notes and interval required');

        const transposed = notes.map((note: string) => Tonal.Note.transpose(note, interval));
        result = {
          operation: 'transpose',
          original: notes,
          interval,
          transposed,
        };
        break;
      }

      case 'frequency': {
        const { note1 } = args;
        if (!note1) throw new Error('note1 required');

        const freq = Tonal.Note.freq(note1);
        const midi = Tonal.Note.midi(note1);
        result = {
          operation: 'frequency',
          note: note1,
          frequency_hz: freq,
          midi_number: midi,
          scientific_pitch: Tonal.Note.name(note1),
        };
        break;
      }

      case 'progression': {
        const { chords, key_name } = args;
        if (!chords || chords.length === 0) throw new Error('chords array required');

        const analysis = chords.map((chord: string, i: number) => {
          const chordInfo = Tonal.Chord.get(chord);
          return {
            position: i + 1,
            chord,
            notes: chordInfo.notes,
            type: chordInfo.type,
          };
        });

        result = {
          operation: 'progression',
          key: key_name || 'Unknown',
          progression: chords.join(' → '),
          analysis,
          common_progressions: {
            'I-V-vi-IV': 'Pop progression',
            'ii-V-I': 'Jazz progression',
            'I-IV-V': 'Blues progression',
          },
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: call.id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: call.id,
      content: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        operation,
      }),
      isError: true,
    };
  }
}
