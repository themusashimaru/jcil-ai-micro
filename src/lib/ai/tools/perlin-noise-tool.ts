/**
 * PERLIN NOISE TOOL
 * Generate Perlin noise, Simplex noise, and variations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Permutation table for noise
const p = new Array(512);
const permutation = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
for (let i = 0; i < 256; i++) p[256 + i] = p[i] = permutation[i];

function fade(t: number): number { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(t: number, a: number, b: number): number { return a + t * (b - a); }
function grad(hash: number, x: number, y: number, z: number): number {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

function perlin3D(x: number, y: number, z: number): number {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
  const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
  return lerp(w, lerp(v, lerp(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)),
    lerp(u, grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z))),
    lerp(v, lerp(u, grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1)),
    lerp(u, grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1))));
}

function perlin2D(x: number, y: number): number {
  return perlin3D(x, y, 0);
}

function fbm(x: number, y: number, octaves: number, lacunarity: number, persistence: number): number {
  let value = 0, amplitude = 1, frequency = 1, maxValue = 0;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * perlin2D(x * frequency, y * frequency);
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }
  return value / maxValue;
}

function ridgedNoise(x: number, y: number, octaves: number): number {
  let value = 0, amplitude = 1, frequency = 1, weight = 1;
  for (let i = 0; i < octaves; i++) {
    let signal = perlin2D(x * frequency, y * frequency);
    signal = 1 - Math.abs(signal);
    signal *= signal * weight;
    weight = Math.min(1, Math.max(0, signal * 2));
    value += signal * amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value;
}

function turbulence(x: number, y: number, octaves: number): number {
  let value = 0, amplitude = 1, frequency = 1;
  for (let i = 0; i < octaves; i++) {
    value += amplitude * Math.abs(perlin2D(x * frequency, y * frequency));
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value;
}

function generateNoiseMap(width: number, height: number, scale: number, octaves: number, type: string): number[][] {
  const map: number[][] = [];
  for (let y = 0; y < height; y++) {
    map[y] = [];
    for (let x = 0; x < width; x++) {
      const nx = x / scale, ny = y / scale;
      let value: number;
      switch (type) {
        case 'ridged': value = ridgedNoise(nx, ny, octaves); break;
        case 'turbulence': value = turbulence(nx, ny, octaves); break;
        case 'fbm': default: value = (fbm(nx, ny, octaves, 2, 0.5) + 1) / 2; break;
      }
      map[y][x] = Math.max(0, Math.min(1, value));
    }
  }
  return map;
}

function noiseToAscii(map: number[][], chars: string = ' .:-=+*#%@'): string {
  return map.map(row => row.map(v => chars[Math.floor(v * (chars.length - 1))]).join('')).join('\n');
}

export const perlinNoiseTool: UnifiedTool = {
  name: 'perlin_noise',
  description: 'Perlin Noise Generator: sample, map, fbm, ridged, turbulence, ascii',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['sample', 'map', 'fbm', 'ridged', 'turbulence', 'ascii'] },
      x: { type: 'number' },
      y: { type: 'number' },
      z: { type: 'number' },
      width: { type: 'number' },
      height: { type: 'number' },
      scale: { type: 'number' },
      octaves: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executePerlinNoise(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'sample':
        result = { value: perlin3D(args.x || 0, args.y || 0, args.z || 0) };
        break;
      case 'map':
        result = { map: generateNoiseMap(args.width || 32, args.height || 32, args.scale || 10, args.octaves || 4, 'fbm') };
        break;
      case 'fbm':
        result = { value: fbm(args.x || 0, args.y || 0, args.octaves || 4, 2, 0.5) };
        break;
      case 'ridged':
        result = { value: ridgedNoise(args.x || 0, args.y || 0, args.octaves || 4) };
        break;
      case 'turbulence':
        result = { value: turbulence(args.x || 0, args.y || 0, args.octaves || 4) };
        break;
      case 'ascii':
        const map = generateNoiseMap(args.width || 64, args.height || 32, args.scale || 10, args.octaves || 4, 'fbm');
        result = { ascii: noiseToAscii(map) };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isPerlinNoiseAvailable(): boolean { return true; }
