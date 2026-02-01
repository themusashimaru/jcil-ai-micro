/**
 * MELODY GENERATOR TOOL
 * Generate melodies using various algorithms and musical rules
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Note { pitch: string; octave: number; duration: string; velocity: number; }
interface Melody { notes: Note[]; key: string; scale: string; tempo: number; timeSignature: string; }

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const DURATIONS = ['whole', 'half', 'quarter', 'eighth', 'sixteenth'];
const DURATION_VALUES: Record<string, number> = { whole: 4, half: 2, quarter: 1, eighth: 0.5, sixteenth: 0.25 };

const SCALES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10]
};

function getScaleNotes(root: string, scaleName: string, octave: number): string[] {
  const rootIdx = NOTES.indexOf(root);
  const intervals = SCALES[scaleName] || SCALES.major;
  return intervals.map(i => {
    const noteIdx = (rootIdx + i) % 12;
    const octaveAdjust = Math.floor((rootIdx + i) / 12);
    return `${NOTES[noteIdx]}${octave + octaveAdjust}`;
  });
}

function randomMelody(key: string, scale: string, length: number, octave: number = 4): Melody {
  const scaleNotes = getScaleNotes(key, scale, octave);
  const notes: Note[] = [];
  let currentIdx = Math.floor(scaleNotes.length / 2);

  for (let i = 0; i < length; i++) {
    const direction = Math.random() > 0.5 ? 1 : -1;
    const step = Math.floor(Math.random() * 3) + 1;
    currentIdx = Math.max(0, Math.min(scaleNotes.length - 1, currentIdx + direction * step));

    const note = scaleNotes[currentIdx];
    const pitch = note.slice(0, -1);
    const noteOctave = parseInt(note.slice(-1));

    const duration = DURATIONS[Math.floor(Math.random() * 4) + 1]; // Prefer shorter notes
    const velocity = 0.6 + Math.random() * 0.4;

    notes.push({ pitch, octave: noteOctave, duration, velocity: Math.round(velocity * 100) / 100 });
  }

  return { notes, key, scale, tempo: 120, timeSignature: '4/4' };
}

function markovMelody(key: string, scale: string, length: number, seedNotes?: string[]): Melody {
  const scaleNotes = getScaleNotes(key, scale, 4);
  const transitions: Record<number, number[]> = {};

  // Build simple transition matrix
  for (let i = 0; i < scaleNotes.length; i++) {
    transitions[i] = [];
    if (i > 0) transitions[i].push(i - 1);
    transitions[i].push(i);
    if (i < scaleNotes.length - 1) transitions[i].push(i + 1);
    if (i > 1) transitions[i].push(i - 2);
    if (i < scaleNotes.length - 2) transitions[i].push(i + 2);
  }

  const notes: Note[] = [];
  let currentIdx = seedNotes ? scaleNotes.indexOf(seedNotes[0] + '4') : Math.floor(scaleNotes.length / 2);
  if (currentIdx === -1) currentIdx = Math.floor(scaleNotes.length / 2);

  for (let i = 0; i < length; i++) {
    const note = scaleNotes[currentIdx];
    const pitch = note.slice(0, -1);
    const octave = parseInt(note.slice(-1));

    notes.push({
      pitch,
      octave,
      duration: DURATIONS[Math.floor(Math.random() * 3) + 2],
      velocity: 0.7 + Math.random() * 0.3
    });

    const nextOptions = transitions[currentIdx] || [currentIdx];
    currentIdx = nextOptions[Math.floor(Math.random() * nextOptions.length)];
  }

  return { notes, key, scale, tempo: 120, timeSignature: '4/4' };
}

function contourMelody(key: string, scale: string, contour: string): Melody {
  const scaleNotes = getScaleNotes(key, scale, 4);
  const notes: Note[] = [];
  let currentIdx = Math.floor(scaleNotes.length / 2);

  for (const c of contour) {
    let step = 0;
    switch (c) {
      case 'u': step = 1; break;
      case 'U': step = 2; break;
      case 'd': step = -1; break;
      case 'D': step = -2; break;
      case 's': step = 0; break;
      case 'j': step = 3; break; // jump up
      case 'J': step = -3; break; // jump down
    }

    currentIdx = Math.max(0, Math.min(scaleNotes.length - 1, currentIdx + step));
    const note = scaleNotes[currentIdx];

    notes.push({
      pitch: note.slice(0, -1),
      octave: parseInt(note.slice(-1)),
      duration: 'quarter',
      velocity: 0.8
    });
  }

  return { notes, key, scale, tempo: 120, timeSignature: '4/4' };
}

function arpeggioMelody(key: string, chord: string, pattern: string, octave: number = 4): Melody {
  const rootIdx = NOTES.indexOf(key);
  const chordIntervals: Record<string, number[]> = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    dim: [0, 3, 6],
    aug: [0, 4, 8],
    maj7: [0, 4, 7, 11],
    min7: [0, 3, 7, 10],
    dom7: [0, 4, 7, 10]
  };

  const intervals = chordIntervals[chord] || chordIntervals.major;
  const chordNotes = intervals.map(i => {
    const noteIdx = (rootIdx + i) % 12;
    const octaveAdjust = Math.floor((rootIdx + i) / 12);
    return { pitch: NOTES[noteIdx], octave: octave + octaveAdjust };
  });

  const notes: Note[] = [];
  const patternArr = pattern.split('').map(Number);

  for (const p of patternArr) {
    const idx = (p - 1) % chordNotes.length;
    const { pitch, octave: noteOctave } = chordNotes[idx];
    notes.push({ pitch, octave: noteOctave, duration: 'eighth', velocity: 0.75 });
  }

  return { notes, key, scale: chord, tempo: 120, timeSignature: '4/4' };
}

function melodyToMidi(melody: Melody): Array<Record<string, unknown>> {
  let time = 0;
  const events: Array<Record<string, unknown>> = [];

  for (const note of melody.notes) {
    const midiNote = NOTES.indexOf(note.pitch) + (note.octave + 1) * 12;
    const duration = DURATION_VALUES[note.duration] || 1;

    events.push({
      type: 'note',
      pitch: midiNote,
      time,
      duration,
      velocity: Math.floor(note.velocity * 127)
    });

    time += duration;
  }

  return events;
}

function melodyToAscii(melody: Melody): string {
  const allNotes = NOTES.flatMap((n) => [3, 4, 5, 6].map(o => `${n}${o}`)).reverse();
  const usedNotes = melody.notes.map(n => `${n.pitch}${n.octave}`);
  const uniqueNotes = [...new Set(usedNotes)].sort((a, b) => {
    const aIdx = allNotes.indexOf(a);
    const bIdx = allNotes.indexOf(b);
    return aIdx - bIdx;
  });

  let output = `Key: ${melody.key} ${melody.scale} | Tempo: ${melody.tempo} BPM\n\n`;

  for (const noteStr of uniqueNotes) {
    const label = noteStr.padStart(4);
    const line = melody.notes.map(n => {
      const nStr = `${n.pitch}${n.octave}`;
      return nStr === noteStr ? '●' : '·';
    }).join('');
    output += `${label} |${line}|\n`;
  }

  return output;
}

function analyzeMelody(melody: Melody): Record<string, unknown> {
  const pitches = melody.notes.map(n => NOTES.indexOf(n.pitch) + n.octave * 12);
  const intervals: number[] = [];

  for (let i = 1; i < pitches.length; i++) {
    intervals.push(pitches[i] - pitches[i - 1]);
  }

  const range = Math.max(...pitches) - Math.min(...pitches);
  const avgInterval = intervals.reduce((a, b) => a + Math.abs(b), 0) / intervals.length;
  const leaps = intervals.filter(i => Math.abs(i) > 2).length;
  const steps = intervals.filter(i => Math.abs(i) <= 2).length;

  return {
    key: melody.key,
    scale: melody.scale,
    noteCount: melody.notes.length,
    range: `${range} semitones`,
    avgInterval: avgInterval.toFixed(2),
    leapCount: leaps,
    stepCount: steps,
    leapToStepRatio: (leaps / (steps || 1)).toFixed(2),
    durationDistribution: melody.notes.reduce((acc, n) => {
      acc[n.duration] = (acc[n.duration] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };
}

export const melodyGeneratorTool: UnifiedTool = {
  name: 'melody_generator',
  description: 'Melody Generator: random, markov, contour, arpeggio, midi, ascii, analyze',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['random', 'markov', 'contour', 'arpeggio', 'midi', 'ascii', 'analyze', 'scales'] },
      key: { type: 'string' },
      scale: { type: 'string' },
      length: { type: 'number' },
      octave: { type: 'number' },
      contour: { type: 'string' },
      chord: { type: 'string' },
      pattern: { type: 'string' },
      melody: { type: 'object' }
    },
    required: ['operation']
  }
};

export async function executeMelodyGenerator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    const key = args.key || 'C';
    const scale = args.scale || 'major';
    const length = args.length || 16;

    switch (args.operation) {
      case 'random':
        const randomMel = randomMelody(key, scale, length, args.octave || 4);
        result = { melody: randomMel, ascii: melodyToAscii(randomMel) };
        break;
      case 'markov':
        const markovMel = markovMelody(key, scale, length);
        result = { melody: markovMel, ascii: melodyToAscii(markovMel) };
        break;
      case 'contour':
        const contourStr = args.contour || 'uuudddssuuddss';
        const contourMel = contourMelody(key, scale, contourStr);
        result = { melody: contourMel, contour: contourStr, ascii: melodyToAscii(contourMel) };
        break;
      case 'arpeggio':
        const arpMel = arpeggioMelody(key, args.chord || 'major', args.pattern || '13531', args.octave || 4);
        result = { melody: arpMel, ascii: melodyToAscii(arpMel) };
        break;
      case 'midi':
        const midiMel = args.melody || randomMelody(key, scale, length);
        result = { events: melodyToMidi(midiMel) };
        break;
      case 'ascii':
        const asciiMel = args.melody || randomMelody(key, scale, length);
        result = { ascii: melodyToAscii(asciiMel) };
        break;
      case 'analyze':
        const analyzeMel = args.melody || randomMelody(key, scale, length);
        result = analyzeMelody(analyzeMel);
        break;
      case 'scales':
        result = {
          scales: Object.entries(SCALES).map(([name, intervals]) => ({
            name,
            intervals,
            example: getScaleNotes('C', name, 4)
          })),
          durations: DURATIONS,
          contourSymbols: {
            u: 'step up', U: 'leap up', d: 'step down', D: 'leap down',
            s: 'same', j: 'jump up', J: 'jump down'
          }
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

export function isMelodyGeneratorAvailable(): boolean { return true; }
