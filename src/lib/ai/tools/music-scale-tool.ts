/**
 * MUSIC SCALE TOOL
 * Scales, modes, intervals, and music theory calculations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const ENHARMONIC: Record<string, string> = { 'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb' };

const SCALES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
  melodic_minor: [0, 2, 3, 5, 7, 9, 11],
  pentatonic_major: [0, 2, 4, 7, 9],
  pentatonic_minor: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  whole_tone: [0, 2, 4, 6, 8, 10],
  diminished: [0, 2, 3, 5, 6, 8, 9, 11],
  augmented: [0, 3, 4, 7, 8, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  hungarian_minor: [0, 2, 3, 6, 7, 8, 11],
  japanese: [0, 1, 5, 7, 8],
  arabic: [0, 1, 4, 5, 7, 8, 11]
};

const INTERVALS: Record<string, number> = {
  'unison': 0, 'minor_second': 1, 'major_second': 2, 'minor_third': 3,
  'major_third': 4, 'perfect_fourth': 5, 'tritone': 6, 'perfect_fifth': 7,
  'minor_sixth': 8, 'major_sixth': 9, 'minor_seventh': 10, 'major_seventh': 11, 'octave': 12
};
void INTERVALS; // Used for reference data

const INTERVAL_NAMES: Record<number, string> = {
  0: 'Unison', 1: 'Minor 2nd', 2: 'Major 2nd', 3: 'Minor 3rd',
  4: 'Major 3rd', 5: 'Perfect 4th', 6: 'Tritone', 7: 'Perfect 5th',
  8: 'Minor 6th', 9: 'Major 6th', 10: 'Minor 7th', 11: 'Major 7th', 12: 'Octave'
};

function getNoteIndex(note: string): number {
  const normalized = note.charAt(0).toUpperCase() + note.slice(1);
  let idx = NOTES.indexOf(normalized);
  if (idx === -1) {
    for (const [sharp, flat] of Object.entries(ENHARMONIC)) {
      if (flat === normalized) idx = NOTES.indexOf(sharp);
    }
  }
  return idx;
}

function getNote(index: number, preferFlat: boolean = false): string {
  const note = NOTES[((index % 12) + 12) % 12];
  if (preferFlat && ENHARMONIC[note]) return ENHARMONIC[note];
  return note;
}

function getScale(root: string, scaleName: string): string[] {
  const rootIdx = getNoteIndex(root);
  if (rootIdx === -1) return [];

  const intervals = SCALES[scaleName] || SCALES.major;
  return intervals.map(interval => getNote(rootIdx + interval));
}

function getRelativeMinor(majorRoot: string): string {
  const rootIdx = getNoteIndex(majorRoot);
  return getNote(rootIdx - 3);
}

function getRelativeMajor(minorRoot: string): string {
  const rootIdx = getNoteIndex(minorRoot);
  return getNote(rootIdx + 3);
}
void getRelativeMajor; // Available for future use

function getParallelScale(root: string, fromScale: string): Record<string, unknown> {
  const parallel = fromScale === 'major' ? 'minor' : 'major';
  return {
    original: { root, scale: fromScale, notes: getScale(root, fromScale) },
    parallel: { root, scale: parallel, notes: getScale(root, parallel) }
  };
}

function getCircleOfFifths(): Record<string, unknown> {
  const circle: string[] = [];
  let current = 0; // Start at C

  for (let i = 0; i < 12; i++) {
    circle.push(NOTES[current]);
    current = (current + 7) % 12;
  }

  return {
    major: circle,
    minor: circle.map(note => getNote(getNoteIndex(note) - 3)),
    relationships: circle.map((note, i) => ({
      key: note,
      relativeMinor: getRelativeMinor(note),
      dominant: circle[(i + 1) % 12],
      subdominant: circle[(i + 11) % 12]
    }))
  };
}

function analyzeInterval(note1: string, note2: string): Record<string, unknown> {
  const idx1 = getNoteIndex(note1);
  const idx2 = getNoteIndex(note2);
  const semitones = ((idx2 - idx1) % 12 + 12) % 12;

  return {
    note1,
    note2,
    semitones,
    intervalName: INTERVAL_NAMES[semitones] || `${semitones} semitones`,
    consonance: [0, 3, 4, 5, 7, 8, 9, 12].includes(semitones) ? 'consonant' : 'dissonant'
  };
}

function findScalesContaining(notes: string[]): string[] {
  const noteIndices = notes.map(n => getNoteIndex(n)).filter(i => i !== -1);
  const matchingScales: string[] = [];

  for (const root of NOTES) {
    const rootIdx = getNoteIndex(root);
    for (const [scaleName, intervals] of Object.entries(SCALES)) {
      const scaleNotes = intervals.map(i => (rootIdx + i) % 12);
      const containsAll = noteIndices.every(n => scaleNotes.includes(n % 12));
      if (containsAll) {
        matchingScales.push(`${root} ${scaleName}`);
      }
    }
  }

  return matchingScales;
}

function generateMelody(root: string, scaleName: string, length: number = 8): string[] {
  const scale = getScale(root, scaleName);
  const melody: string[] = [];
  let currentIdx = Math.floor(scale.length / 2);

  for (let i = 0; i < length; i++) {
    melody.push(scale[currentIdx]);
    const direction = Math.random() > 0.5 ? 1 : -1;
    const step = Math.floor(Math.random() * 3) + 1;
    currentIdx = Math.max(0, Math.min(scale.length - 1, currentIdx + direction * step));
  }

  return melody;
}

function getScaleDegrees(root: string, scaleName: string): Array<Record<string, unknown>> {
  const scale = getScale(root, scaleName);
  const degreeNames = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  const intervals = SCALES[scaleName] || SCALES.major;

  return scale.map((note, idx) => ({
    degree: degreeNames[idx] || (idx + 1).toString(),
    note,
    interval: INTERVAL_NAMES[intervals[idx]] || `${intervals[idx]} semitones`,
    function: idx === 0 ? 'Tonic' : idx === 4 ? 'Dominant' : idx === 3 ? 'Subdominant' : 'Other'
  }));
}

export const musicScaleTool: UnifiedTool = {
  name: 'music_scale',
  description: 'Music Scale: scale, modes, interval, circle_of_fifths, find_scales, melody, degrees',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['scale', 'modes', 'interval', 'circle_of_fifths', 'relative', 'parallel', 'find_scales', 'melody', 'degrees', 'scales_list'] },
      root: { type: 'string' },
      scaleName: { type: 'string' },
      note1: { type: 'string' },
      note2: { type: 'string' },
      notes: { type: 'array' },
      length: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeMusicScale(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    const root = args.root || 'C';
    const scaleName = args.scaleName || 'major';

    switch (args.operation) {
      case 'scale':
        const notes = getScale(root, scaleName);
        result = { root, scale: scaleName, notes, noteCount: notes.length };
        break;
      case 'modes':
        result = {
          modes: ['dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'].map(mode => ({
            name: mode,
            root,
            notes: getScale(root, mode)
          }))
        };
        break;
      case 'interval':
        result = analyzeInterval(args.note1 || 'C', args.note2 || 'G');
        break;
      case 'circle_of_fifths':
        result = getCircleOfFifths();
        break;
      case 'relative':
        result = {
          major: { root, notes: getScale(root, 'major') },
          relativeMinor: { root: getRelativeMinor(root), notes: getScale(getRelativeMinor(root), 'minor') }
        };
        break;
      case 'parallel':
        result = getParallelScale(root, scaleName);
        break;
      case 'find_scales':
        const inputNotes = args.notes || ['C', 'E', 'G'];
        result = { notes: inputNotes, matchingScales: findScalesContaining(inputNotes) };
        break;
      case 'melody':
        result = { root, scale: scaleName, melody: generateMelody(root, scaleName, args.length || 8) };
        break;
      case 'degrees':
        result = { root, scale: scaleName, degrees: getScaleDegrees(root, scaleName) };
        break;
      case 'scales_list':
        result = {
          scales: Object.entries(SCALES).map(([name, intervals]) => ({
            name,
            intervals,
            noteCount: intervals.length,
            example: getScale('C', name)
          }))
        };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isMusicScaleAvailable(): boolean { return true; }
