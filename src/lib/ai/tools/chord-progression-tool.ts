/**
 * CHORD PROGRESSION TOOL
 * Music theory: chord progressions, scales, harmonization
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const SCALES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
  melodic_minor: [0, 2, 3, 5, 7, 9, 11],
  pentatonic_major: [0, 2, 4, 7, 9],
  pentatonic_minor: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};

const CHORD_TYPES: Record<string, { intervals: number[]; symbol: string }> = {
  major: { intervals: [0, 4, 7], symbol: '' },
  minor: { intervals: [0, 3, 7], symbol: 'm' },
  diminished: { intervals: [0, 3, 6], symbol: 'dim' },
  augmented: { intervals: [0, 4, 8], symbol: 'aug' },
  major7: { intervals: [0, 4, 7, 11], symbol: 'maj7' },
  minor7: { intervals: [0, 3, 7, 10], symbol: 'm7' },
  dominant7: { intervals: [0, 4, 7, 10], symbol: '7' },
  diminished7: { intervals: [0, 3, 6, 9], symbol: 'dim7' },
  half_diminished: { intervals: [0, 3, 6, 10], symbol: 'm7b5' },
  sus2: { intervals: [0, 2, 7], symbol: 'sus2' },
  sus4: { intervals: [0, 5, 7], symbol: 'sus4' },
  add9: { intervals: [0, 4, 7, 14], symbol: 'add9' },
  major9: { intervals: [0, 4, 7, 11, 14], symbol: 'maj9' },
  minor9: { intervals: [0, 3, 7, 10, 14], symbol: 'm9' }
};

// Common progressions in roman numerals
const PROGRESSIONS: Record<string, string[]> = {
  'pop': ['I', 'V', 'vi', 'IV'],
  'jazz_251': ['ii', 'V', 'I'],
  'blues': ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'],
  'andalusian': ['i', 'VII', 'VI', 'V'],
  'pachelbel': ['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V'],
  'sad': ['vi', 'IV', 'I', 'V'],
  'rock': ['I', 'IV', 'V', 'I'],
  'fifties': ['I', 'vi', 'IV', 'V'],
  'royal_road': ['IV', 'V', 'iii', 'vi'],
  'circle_of_fifths': ['I', 'IV', 'vii°', 'iii', 'vi', 'ii', 'V', 'I']
};

function getNoteIndex(note: string): number {
  const idx = NOTES.indexOf(note.replace('b', '#'));
  if (idx >= 0) return idx;
  const flatIdx = FLAT_NOTES.indexOf(note);
  return flatIdx >= 0 ? flatIdx : 0;
}

function getNote(rootIndex: number, interval: number): string {
  return NOTES[(rootIndex + interval) % 12];
}

function getScale(root: string, scaleName: string): string[] {
  const rootIdx = getNoteIndex(root);
  const intervals = SCALES[scaleName] || SCALES.major;
  return intervals.map(i => getNote(rootIdx, i));
}

function getChord(root: string, chordType: string): { notes: string[]; symbol: string } {
  const rootIdx = getNoteIndex(root);
  const chord = CHORD_TYPES[chordType] || CHORD_TYPES.major;
  return {
    notes: chord.intervals.map(i => getNote(rootIdx, i)),
    symbol: root + chord.symbol
  };
}

function romanToChord(roman: string, key: string, mode: string = 'major'): { notes: string[]; symbol: string; roman: string } {
  const scale = getScale(key, mode);
  const degreeMap: Record<string, number> = { 'i': 0, 'ii': 1, 'iii': 2, 'iv': 3, 'v': 4, 'vi': 5, 'vii': 6 };

  const isMinor = roman === roman.toLowerCase();
  const isDiminished = roman.includes('°') || roman.includes('dim');
  const isAugmented = roman.includes('+') || roman.includes('aug');
  const isSeventh = roman.includes('7');

  const cleanRoman = roman.toLowerCase().replace(/[°+dim7aug]/g, '');
  const degree = degreeMap[cleanRoman] || 0;
  const root = scale[degree];

  let chordType = isMinor ? 'minor' : 'major';
  if (isDiminished) chordType = isSeventh ? 'diminished7' : 'diminished';
  else if (isAugmented) chordType = 'augmented';
  else if (isSeventh) chordType = isMinor ? 'minor7' : (degree === 4 ? 'dominant7' : 'major7');

  const chord = getChord(root, chordType);
  return { ...chord, roman };
}

function generateProgression(key: string, progressionName: string, mode: string = 'major'): Array<{ notes: string[]; symbol: string; roman: string }> {
  const progression = PROGRESSIONS[progressionName] || PROGRESSIONS.pop;
  return progression.map(roman => romanToChord(roman, key, mode));
}

function suggestNextChord(currentChord: string, _key: string): string[] {
  // Common chord movement rules
  const movements: Record<string, string[]> = {
    'I': ['IV', 'V', 'vi', 'ii', 'iii'],
    'ii': ['V', 'vii°', 'IV'],
    'iii': ['vi', 'IV', 'ii'],
    'IV': ['V', 'I', 'ii', 'vii°'],
    'V': ['I', 'vi', 'IV'],
    'vi': ['IV', 'ii', 'V', 'I'],
    'vii°': ['I', 'iii']
  };
  return movements[currentChord] || ['I', 'IV', 'V'];
}

function harmonize(melody: string[], key: string): Array<{ melody: string; chord: { notes: string[]; symbol: string } }> {
  const scale = getScale(key, 'major');
  return melody.map(note => {
    const noteIdx = scale.indexOf(note);
    let chordRoot: string;
    let chordType: string;

    if (noteIdx === 0 || noteIdx === 4) { chordRoot = scale[0]; chordType = 'major'; }
    else if (noteIdx === 2 || noteIdx === 6) { chordRoot = scale[3]; chordType = 'major'; }
    else if (noteIdx === 1 || noteIdx === 3) { chordRoot = scale[4]; chordType = 'major'; }
    else if (noteIdx === 5) { chordRoot = scale[5]; chordType = 'minor'; }
    else { chordRoot = scale[0]; chordType = 'major'; }

    return { melody: note, chord: getChord(chordRoot, chordType) };
  });
}

export const chordProgressionTool: UnifiedTool = {
  name: 'chord_progression',
  description: 'Chord Progression: generate, scale, chord, harmonize, suggest, analyze, progressions',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['generate', 'scale', 'chord', 'harmonize', 'suggest', 'analyze', 'progressions', 'all_chords'] },
      key: { type: 'string' },
      progression: { type: 'string' },
      scale: { type: 'string' },
      chordType: { type: 'string' },
      melody: { type: 'array' },
      currentChord: { type: 'string' }
    },
    required: ['operation']
  }
};

export async function executeChordProgression(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const key = args.key || 'C';
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'generate':
        result = { key, progression: args.progression || 'pop', chords: generateProgression(key, args.progression || 'pop') };
        break;
      case 'scale':
        const scaleName = args.scale || 'major';
        result = { key, scale: scaleName, notes: getScale(key, scaleName), intervals: SCALES[scaleName] };
        break;
      case 'chord':
        result = getChord(key, args.chordType || 'major');
        break;
      case 'harmonize':
        const melody = args.melody || ['C', 'D', 'E', 'F', 'G'];
        result = { key, harmonization: harmonize(melody, key) };
        break;
      case 'suggest':
        result = { currentChord: args.currentChord || 'I', suggestions: suggestNextChord(args.currentChord || 'I', key) };
        break;
      case 'analyze':
        const chords = generateProgression(key, args.progression || 'pop');
        result = {
          key,
          progression: args.progression || 'pop',
          chords,
          analysis: {
            tonic: chords.filter(c => c.roman === 'I' || c.roman === 'i').length,
            subdominant: chords.filter(c => ['II', 'ii', 'IV', 'iv'].includes(c.roman)).length,
            dominant: chords.filter(c => ['V', 'v', 'VII', 'vii°'].includes(c.roman)).length
          }
        };
        break;
      case 'progressions':
        result = { progressions: Object.keys(PROGRESSIONS), examples: PROGRESSIONS };
        break;
      case 'all_chords':
        result = { chordTypes: Object.keys(CHORD_TYPES), scales: Object.keys(SCALES) };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isChordProgressionAvailable(): boolean { return true; }
