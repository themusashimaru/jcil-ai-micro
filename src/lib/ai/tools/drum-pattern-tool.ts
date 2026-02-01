/**
 * DRUM PATTERN TOOL
 * Generate drum patterns for various genres and time signatures
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface DrumHit { instrument: string; velocity: number; }
interface DrumStep { step: number; hits: DrumHit[]; }
interface DrumPattern { name: string; genre: string; bpm: number; timeSignature: string; steps: DrumStep[]; instruments: string[]; }

const INSTRUMENTS = ['kick', 'snare', 'hihat_closed', 'hihat_open', 'ride', 'crash', 'tom_high', 'tom_mid', 'tom_low', 'clap', 'rim', 'shaker'];

const GENRE_PATTERNS: Record<string, Record<string, number[]>> = {
  rock: {
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hihat_closed: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
  },
  hiphop: {
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    hihat_closed: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  house: {
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hihat_closed: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]
  },
  techno: {
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    hihat_closed: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ride: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]
  },
  dnb: {
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
    hihat_closed: [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0]
  },
  jazz: {
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    ride: [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1]
  },
  latin: {
    kick: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],
    rim: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    shaker: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  },
  reggae: {
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    rim: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]
  }
};

const DEFAULT_BPM: Record<string, number> = {
  rock: 120, hiphop: 90, house: 128, techno: 140, dnb: 174, jazz: 140, latin: 100, reggae: 80
};

function generatePattern(genre: string, steps: number = 16): DrumPattern {
  const basePattern = GENRE_PATTERNS[genre] || GENRE_PATTERNS.rock;
  const bpm = DEFAULT_BPM[genre] || 120;

  const drumSteps: DrumStep[] = [];

  for (let i = 0; i < steps; i++) {
    const hits: DrumHit[] = [];

    for (const [instrument, pattern] of Object.entries(basePattern)) {
      if (pattern[i % pattern.length] === 1) {
        const velocity = 0.7 + Math.random() * 0.3; // Humanize velocity
        hits.push({ instrument, velocity: Math.round(velocity * 100) / 100 });
      }
    }

    drumSteps.push({ step: i + 1, hits });
  }

  return {
    name: `${genre.charAt(0).toUpperCase() + genre.slice(1)} Beat`,
    genre,
    bpm,
    timeSignature: '4/4',
    steps: drumSteps,
    instruments: Object.keys(basePattern)
  };
}

function randomizePattern(pattern: DrumPattern, variation: number = 0.2): DrumPattern {
  const newSteps = pattern.steps.map(step => {
    const newHits = step.hits.filter(() => Math.random() > variation);

    // Maybe add ghost notes
    if (Math.random() < variation) {
      const ghostInstrument = pattern.instruments[Math.floor(Math.random() * pattern.instruments.length)];
      newHits.push({ instrument: ghostInstrument, velocity: 0.3 + Math.random() * 0.2 });
    }

    return { step: step.step, hits: newHits };
  });

  return { ...pattern, name: `${pattern.name} (Variation)`, steps: newSteps };
}

function patternToAscii(pattern: DrumPattern): string {
  const instrumentOrder = ['kick', 'snare', 'hihat_closed', 'hihat_open', 'ride', 'crash', 'clap', 'rim', 'tom_high', 'tom_mid', 'tom_low', 'shaker'];
  const usedInstruments = instrumentOrder.filter(i => pattern.instruments.includes(i));

  let output = `${pattern.name} (${pattern.bpm} BPM, ${pattern.timeSignature})\n\n`;

  for (const instrument of usedInstruments) {
    const abbrev = instrument.slice(0, 4).toUpperCase().padEnd(5);
    const line = pattern.steps.map(step => {
      const hit = step.hits.find(h => h.instrument === instrument);
      if (hit) {
        if (hit.velocity > 0.8) return 'X';
        if (hit.velocity > 0.5) return 'x';
        return 'o';
      }
      return '-';
    }).join('');
    output += `${abbrev}|${line}|\n`;
  }

  output += '      ';
  for (let i = 1; i <= pattern.steps.length; i++) {
    output += (i % 4 === 1) ? '|' : ' ';
  }

  return output;
}

function generateFill(length: number = 4): DrumStep[] {
  const fill: DrumStep[] = [];
  const fillInstruments = ['tom_high', 'tom_mid', 'tom_low', 'snare', 'crash'];

  for (let i = 0; i < length; i++) {
    const hits: DrumHit[] = [];
    const density = (i + 1) / length; // Increasing density

    for (const instrument of fillInstruments) {
      if (Math.random() < density * 0.5) {
        hits.push({ instrument, velocity: 0.7 + Math.random() * 0.3 });
      }
    }

    if (i === length - 1) {
      hits.push({ instrument: 'crash', velocity: 1.0 });
    }

    fill.push({ step: i + 1, hits });
  }

  return fill;
}

function createCustomPattern(instruments: Record<string, number[]>): DrumPattern {
  const steps = Math.max(...Object.values(instruments).map(p => p.length));
  const drumSteps: DrumStep[] = [];

  for (let i = 0; i < steps; i++) {
    const hits: DrumHit[] = [];
    for (const [instrument, pattern] of Object.entries(instruments)) {
      if (pattern[i] === 1) {
        hits.push({ instrument, velocity: 0.85 });
      }
    }
    drumSteps.push({ step: i + 1, hits });
  }

  return {
    name: 'Custom Pattern',
    genre: 'custom',
    bpm: 120,
    timeSignature: '4/4',
    steps: drumSteps,
    instruments: Object.keys(instruments)
  };
}

function analyzePattern(pattern: DrumPattern): Record<string, unknown> {
  const hitCounts: Record<string, number> = {};
  let totalHits = 0;
  let totalVelocity = 0;

  for (const step of pattern.steps) {
    for (const hit of step.hits) {
      hitCounts[hit.instrument] = (hitCounts[hit.instrument] || 0) + 1;
      totalHits++;
      totalVelocity += hit.velocity;
    }
  }

  const density = totalHits / pattern.steps.length;
  const avgVelocity = totalVelocity / totalHits;

  return {
    name: pattern.name,
    genre: pattern.genre,
    bpm: pattern.bpm,
    stepCount: pattern.steps.length,
    totalHits,
    hitDensity: density.toFixed(2),
    avgVelocity: avgVelocity.toFixed(2),
    instrumentUsage: hitCounts,
    dominantInstrument: Object.entries(hitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none'
  };
}

export const drumPatternTool: UnifiedTool = {
  name: 'drum_pattern',
  description: 'Drum Pattern: generate, randomize, ascii, fill, custom, analyze, genres',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['generate', 'randomize', 'ascii', 'fill', 'custom', 'analyze', 'genres'] },
      genre: { type: 'string' },
      steps: { type: 'number' },
      variation: { type: 'number' },
      pattern: { type: 'object' },
      instruments: { type: 'object' },
      length: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeDrumPattern(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'generate':
        const pattern = generatePattern(args.genre || 'rock', args.steps || 16);
        result = { pattern, ascii: patternToAscii(pattern) };
        break;
      case 'randomize':
        const basePattern = args.pattern || generatePattern(args.genre || 'rock');
        const randomized = randomizePattern(basePattern, args.variation || 0.2);
        result = { pattern: randomized, ascii: patternToAscii(randomized) };
        break;
      case 'ascii':
        const asciiPattern = args.pattern || generatePattern(args.genre || 'rock');
        result = { ascii: patternToAscii(asciiPattern) };
        break;
      case 'fill':
        result = { fill: generateFill(args.length || 4) };
        break;
      case 'custom':
        if (!args.instruments) throw new Error('Instruments pattern required');
        const customPattern = createCustomPattern(args.instruments);
        result = { pattern: customPattern, ascii: patternToAscii(customPattern) };
        break;
      case 'analyze':
        const analyzePattern2 = args.pattern || generatePattern(args.genre || 'rock');
        result = analyzePattern(analyzePattern2);
        break;
      case 'genres':
        result = {
          genres: Object.keys(GENRE_PATTERNS),
          instruments: INSTRUMENTS,
          bpmRanges: DEFAULT_BPM
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

export function isDrumPatternAvailable(): boolean { return true; }
