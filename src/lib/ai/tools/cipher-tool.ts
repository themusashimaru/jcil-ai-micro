/**
 * CIPHER TOOL
 * Classical cipher utilities (educational)
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function caesarCipher(text: string, shift: number, decrypt: boolean = false): string {
  const s = decrypt ? (26 - (shift % 26)) : (shift % 26);
  return text.replace(/[a-zA-Z]/g, c => {
    const base = c < 'a' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + s) % 26) + base);
  });
}

function vigenereCipher(text: string, key: string, decrypt: boolean = false): string {
  const k = key.toLowerCase().replace(/[^a-z]/g, '');
  if (!k) return text;
  let j = 0;
  return text.replace(/[a-zA-Z]/g, c => {
    const base = c < 'a' ? 65 : 97;
    const shift = k.charCodeAt(j % k.length) - 97;
    j++;
    const s = decrypt ? (26 - shift) : shift;
    return String.fromCharCode(((c.charCodeAt(0) - base + s) % 26) + base);
  });
}

function atbashCipher(text: string): string {
  return text.replace(/[a-zA-Z]/g, c => {
    const base = c < 'a' ? 65 : 97;
    return String.fromCharCode(base + 25 - (c.charCodeAt(0) - base));
  });
}

function xorCipher(text: string, key: string): string {
  return text.split('').map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ key.charCodeAt(i % key.length))).join('');
}

function frequencyAnalysis(text: string): Record<string, number> {
  const freq: Record<string, number> = {};
  const letters = text.toLowerCase().replace(/[^a-z]/g, '');
  for (const c of letters) freq[c] = (freq[c] || 0) + 1;
  const total = letters.length;
  for (const c in freq) freq[c] = Math.round(freq[c] / total * 10000) / 100;
  return freq;
}

export const cipherTool: UnifiedTool = {
  name: 'cipher',
  description: 'Classical ciphers: caesar, vigenere, atbash, xor, frequency_analysis (educational)',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['caesar', 'vigenere', 'atbash', 'xor', 'frequency'] }, text: { type: 'string' }, shift: { type: 'number' }, key: { type: 'string' }, decrypt: { type: 'boolean' } }, required: ['operation', 'text'] },
};

export async function executeCipher(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'caesar': result = { output: caesarCipher(args.text, args.shift || 3, args.decrypt) }; break;
      case 'vigenere': result = { output: vigenereCipher(args.text, args.key || 'KEY', args.decrypt) }; break;
      case 'atbash': result = { output: atbashCipher(args.text) }; break;
      case 'xor': result = { output: xorCipher(args.text, args.key || 'K') }; break;
      case 'frequency': result = { frequencies: frequencyAnalysis(args.text) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isCipherAvailable(): boolean { return true; }
