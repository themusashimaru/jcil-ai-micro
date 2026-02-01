/**
 * ENCODING TOOL
 * Data encoding and decoding utilities
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function base64Encode(input: string): string { return Buffer.from(input).toString('base64'); }
function base64Decode(input: string): string { return Buffer.from(input, 'base64').toString('utf-8'); }
function hexEncode(input: string): string { return Buffer.from(input).toString('hex'); }
function hexDecode(input: string): string { return Buffer.from(input, 'hex').toString('utf-8'); }
function urlEncode(input: string): string { return encodeURIComponent(input); }
function urlDecode(input: string): string { return decodeURIComponent(input); }
function rot13(input: string): string { return input.replace(/[a-zA-Z]/g, c => String.fromCharCode(c.charCodeAt(0) + (c.toLowerCase() < 'n' ? 13 : -13))); }
function binaryEncode(input: string): string { return input.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' '); }
function binaryDecode(input: string): string { return input.split(' ').map(b => String.fromCharCode(parseInt(b, 2))).join(''); }

export const encodingTool: UnifiedTool = {
  name: 'encoding',
  description: 'Encoding: base64, hex, url, rot13, binary encode/decode',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['base64_encode', 'base64_decode', 'hex_encode', 'hex_decode', 'url_encode', 'url_decode', 'rot13', 'binary_encode', 'binary_decode'] }, input: { type: 'string' } }, required: ['operation', 'input'] },
};

export async function executeEncoding(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'base64_encode': result = { output: base64Encode(args.input) }; break;
      case 'base64_decode': result = { output: base64Decode(args.input) }; break;
      case 'hex_encode': result = { output: hexEncode(args.input) }; break;
      case 'hex_decode': result = { output: hexDecode(args.input) }; break;
      case 'url_encode': result = { output: urlEncode(args.input) }; break;
      case 'url_decode': result = { output: urlDecode(args.input) }; break;
      case 'rot13': result = { output: rot13(args.input) }; break;
      case 'binary_encode': result = { output: binaryEncode(args.input) }; break;
      case 'binary_decode': result = { output: binaryDecode(args.input) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isEncodingAvailable(): boolean { return true; }
