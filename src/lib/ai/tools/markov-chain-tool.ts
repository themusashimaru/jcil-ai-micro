/**
 * MARKOV CHAIN TOOL
 * Text and sequence generation using Markov chains
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

type MarkovModel = Map<string, Map<string, number>>;

function buildModel(text: string, order: number = 2): MarkovModel {
  const model: MarkovModel = new Map();
  const words = text.split(/\s+/).filter(w => w.length > 0);

  for (let i = 0; i <= words.length - order - 1; i++) {
    const state = words.slice(i, i + order).join(' ');
    const next = words[i + order];

    if (!model.has(state)) model.set(state, new Map());
    const transitions = model.get(state)!;
    transitions.set(next, (transitions.get(next) || 0) + 1);
  }

  return model;
}

function buildCharModel(text: string, order: number = 3): MarkovModel {
  const model: MarkovModel = new Map();

  for (let i = 0; i <= text.length - order - 1; i++) {
    const state = text.slice(i, i + order);
    const next = text[i + order];

    if (!model.has(state)) model.set(state, new Map());
    const transitions = model.get(state)!;
    transitions.set(next, (transitions.get(next) || 0) + 1);
  }

  return model;
}

function generateFromModel(model: MarkovModel, length: number, seed?: string): string {
  const states = [...model.keys()];
  if (states.length === 0) return '';

  let current = seed || states[Math.floor(Math.random() * states.length)];
  const result: string[] = current.split(' ');

  for (let i = 0; i < length; i++) {
    const transitions = model.get(current);
    if (!transitions || transitions.size === 0) {
      current = states[Math.floor(Math.random() * states.length)];
      continue;
    }

    // Weighted random selection
    const total = [...transitions.values()].reduce((a, b) => a + b, 0);
    let rand = Math.random() * total;
    let next = '';

    for (const [word, count] of transitions) {
      rand -= count;
      if (rand <= 0) { next = word; break; }
    }

    result.push(next);
    const words = current.split(' ');
    words.shift();
    words.push(next);
    current = words.join(' ');
  }

  return result.join(' ');
}

function generateChars(model: MarkovModel, length: number, seed?: string): string {
  const states = [...model.keys()];
  if (states.length === 0) return '';

  let current = seed || states[Math.floor(Math.random() * states.length)];
  let result = current;

  for (let i = 0; i < length; i++) {
    const transitions = model.get(current);
    if (!transitions || transitions.size === 0) {
      current = states[Math.floor(Math.random() * states.length)];
      continue;
    }

    const total = [...transitions.values()].reduce((a, b) => a + b, 0);
    let rand = Math.random() * total;
    let next = '';

    for (const [char, count] of transitions) {
      rand -= count;
      if (rand <= 0) { next = char; break; }
    }

    result += next;
    current = current.slice(1) + next;
  }

  return result;
}

// Pre-trained name patterns
const NAME_PATTERNS = {
  fantasy: 'Aldric Balthazar Cedric Darian Elric Finnian Gareth Hadrian Isidore Jareth Kael Lorien Maelis Nerian Orin Paelias Quillan Raven Soren Theron Ulric Varen Wren Xander Yoren Zephyr Aelindra Brielle Celestia Dahlia Elowen Faye Gwendolyn Helena Isolde Jasmine Kira Lyra Maeve Nadia Ophelia Petra Quinn Rosalind Seraphina Thalia Uma Vivienne Willa Xena Yara Zara',
  scifi: 'Zyx Kron Vex Nyx Jax Ryn Kira Nova Zara Aria Lyra Echo Onyx Flux Apex Helix Nexus Axiom Cipher Quantum Nebula Pulsar Quasar Zenith Vertex Photon Proton Neutron Plasma',
  medieval: 'William Henry Richard Robert Thomas Edward John James Charles George Arthur Alfred Edmund Oswald Harold Godwin Leofric Aethelred Margaret Elizabeth Catherine Anne Mary Eleanor Matilda Edith Alditha Gytha Godgifu'
};

function generateName(style: string = 'fantasy', count: number = 5): string[] {
  const text = NAME_PATTERNS[style as keyof typeof NAME_PATTERNS] || NAME_PATTERNS.fantasy;
  const model = buildCharModel(text.toLowerCase(), 2);
  const names: string[] = [];

  for (let i = 0; i < count; i++) {
    let name = generateChars(model, Math.floor(Math.random() * 5) + 4);
    name = name.charAt(0).toUpperCase() + name.slice(1);
    if (name.length >= 3) names.push(name);
  }

  return names;
}

function analyzeProbabilities(model: MarkovModel): Record<string, unknown> {
  let totalTransitions = 0;
  let maxTransitions = 0;
  let mostConnected = '';

  for (const [state, transitions] of model) {
    const count = transitions.size;
    totalTransitions += count;
    if (count > maxTransitions) {
      maxTransitions = count;
      mostConnected = state;
    }
  }

  return {
    states: model.size,
    totalTransitions,
    avgTransitionsPerState: (totalTransitions / model.size).toFixed(2),
    mostConnectedState: mostConnected,
    maxTransitions
  };
}

export const markovChainTool: UnifiedTool = {
  name: 'markov_chain',
  description: 'Markov Chain: train, generate, names, analyze, char_model',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['train', 'generate', 'names', 'analyze', 'char_model'] },
      text: { type: 'string' },
      order: { type: 'number' },
      length: { type: 'number' },
      seed: { type: 'string' },
      style: { type: 'string' },
      count: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeMarkovChain(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    const sampleText = args.text || 'The quick brown fox jumps over the lazy dog. The dog sleeps in the sun. The fox runs through the forest. The forest is dark and deep.';

    switch (args.operation) {
      case 'train':
        const model = buildModel(sampleText, args.order || 2);
        result = { states: model.size, order: args.order || 2, sample: generateFromModel(model, 20) };
        break;
      case 'generate':
        const genModel = buildModel(sampleText, args.order || 2);
        result = { generated: generateFromModel(genModel, args.length || 50, args.seed) };
        break;
      case 'names':
        result = { names: generateName(args.style || 'fantasy', args.count || 10) };
        break;
      case 'analyze':
        const analyzeModel = buildModel(sampleText, args.order || 2);
        result = { analysis: analyzeProbabilities(analyzeModel) };
        break;
      case 'char_model':
        const charModel = buildCharModel(sampleText, args.order || 3);
        result = { generated: generateChars(charModel, args.length || 100), states: charModel.size };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isMarkovChainAvailable(): boolean { return true; }
