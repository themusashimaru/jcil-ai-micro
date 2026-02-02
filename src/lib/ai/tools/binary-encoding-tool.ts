/**
 * BINARY ENCODING TOOL
 * Base64, hex, binary, ASCII conversions
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function textToBytes(text: string): number[] {
  return text.split('').map(c => c.charCodeAt(0));
}

function bytesToText(bytes: number[]): string {
  return bytes.map(b => String.fromCharCode(b)).join('');
}

function textToBinary(text: string): string {
  return textToBytes(text).map(b => b.toString(2).padStart(8, '0')).join(' ');
}

function binaryToText(binary: string): string {
  const bytes = binary.replace(/\s/g, '').match(/.{1,8}/g) || [];
  return bytes.map(b => String.fromCharCode(parseInt(b, 2))).join('');
}

function textToHex(text: string): string {
  return textToBytes(text).map(b => b.toString(16).padStart(2, '0')).join(' ');
}

function hexToText(hex: string): string {
  const bytes = hex.replace(/\s/g, '').match(/.{1,2}/g) || [];
  return bytes.map(b => String.fromCharCode(parseInt(b, 16))).join('');
}

function base64Encode(text: string): string {
  const bytes = textToBytes(text);
  let result = '';
  let i = 0;

  while (i < bytes.length) {
    const b1 = bytes[i++] || 0;
    const b2 = bytes[i++];
    const b3 = bytes[i++];

    result += BASE64_CHARS[b1 >> 2];
    result += BASE64_CHARS[((b1 & 3) << 4) | ((b2 ?? 0) >> 4)];
    result += b2 !== undefined ? BASE64_CHARS[((b2 & 15) << 2) | ((b3 ?? 0) >> 6)] : '=';
    result += b3 !== undefined ? BASE64_CHARS[b3 & 63] : '=';
  }

  return result;
}

function base64Decode(encoded: string): string {
  const chars = encoded.replace(/=/g, '');
  const bytes: number[] = [];

  for (let i = 0; i < chars.length; i += 4) {
    const b1 = BASE64_CHARS.indexOf(chars[i]);
    const b2 = BASE64_CHARS.indexOf(chars[i + 1]);
    const b3 = BASE64_CHARS.indexOf(chars[i + 2]);
    const b4 = BASE64_CHARS.indexOf(chars[i + 3]);

    bytes.push((b1 << 2) | (b2 >> 4));
    if (b3 !== -1) bytes.push(((b2 & 15) << 4) | (b3 >> 2));
    if (b4 !== -1) bytes.push(((b3 & 3) << 6) | b4);
  }

  return bytesToText(bytes);
}

function urlEncode(text: string): string {
  return encodeURIComponent(text);
}

function urlDecode(encoded: string): string {
  return decodeURIComponent(encoded);
}

function rot13(text: string): string {
  return text.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

function caesarCipher(text: string, shift: number): string {
  return text.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + shift + 26) % 26) + base);
  });
}

function asciiTable(start: number = 32, end: number = 126): Array<Record<string, unknown>> {
  const table: Array<Record<string, unknown>> = [];
  for (let i = start; i <= end; i++) {
    table.push({
      decimal: i,
      hex: i.toString(16).padStart(2, '0'),
      binary: i.toString(2).padStart(8, '0'),
      char: String.fromCharCode(i)
    });
  }
  return table;
}

function morseEncode(text: string): string {
  const morse: Record<string, string> = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
    'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
    'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
    'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
    'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---',
    '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
    '8': '---..', '9': '----.', ' ': '/'
  };
  return text.toUpperCase().split('').map(c => morse[c] || '').join(' ');
}

function morseDecode(morse: string): string {
  const decode: Record<string, string> = {
    '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E', '..-.': 'F',
    '--.': 'G', '....': 'H', '..': 'I', '.---': 'J', '-.-': 'K', '.-..': 'L',
    '--': 'M', '-.': 'N', '---': 'O', '.--.': 'P', '--.-': 'Q', '.-.': 'R',
    '...': 'S', '-': 'T', '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X',
    '-.--': 'Y', '--..': 'Z', '-----': '0', '.----': '1', '..---': '2',
    '...--': '3', '....-': '4', '.....': '5', '-....': '6', '--...': '7',
    '---..': '8', '----.': '9', '/': ' '
  };
  return morse.split(' ').map(m => decode[m] || '').join('');
}

function numberToBase(num: number, base: number): string {
  if (base < 2 || base > 36) throw new Error('Base must be between 2 and 36');
  return num.toString(base);
}

function baseToNumber(str: string, base: number): number {
  if (base < 2 || base > 36) throw new Error('Base must be between 2 and 36');
  return parseInt(str, base);
}

export const binaryEncodingTool: UnifiedTool = {
  name: 'binary_encoding',
  description: 'Binary Encoding: base64, hex, binary, url, rot13, caesar, morse, ascii, base_convert',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['base64_encode', 'base64_decode', 'hex_encode', 'hex_decode', 'binary_encode', 'binary_decode', 'url_encode', 'url_decode', 'rot13', 'caesar', 'morse_encode', 'morse_decode', 'ascii_table', 'base_convert'] },
      input: { type: 'string' },
      shift: { type: 'number' },
      number: { type: 'number' },
      fromBase: { type: 'number' },
      toBase: { type: 'number' },
      start: { type: 'number' },
      end: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeBinaryEncoding(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    const input = args.input || 'Hello, World!';

    switch (args.operation) {
      case 'base64_encode':
        result = { input, encoded: base64Encode(input) };
        break;
      case 'base64_decode':
        result = { input, decoded: base64Decode(input) };
        break;
      case 'hex_encode':
        result = { input, hex: textToHex(input) };
        break;
      case 'hex_decode':
        result = { input, decoded: hexToText(input.replace(/\s/g, '')) };
        break;
      case 'binary_encode':
        result = { input, binary: textToBinary(input) };
        break;
      case 'binary_decode':
        result = { input, decoded: binaryToText(input) };
        break;
      case 'url_encode':
        result = { input, encoded: urlEncode(input) };
        break;
      case 'url_decode':
        result = { input, decoded: urlDecode(input) };
        break;
      case 'rot13':
        result = { input, encoded: rot13(input) };
        break;
      case 'caesar':
        const shift = args.shift || 3;
        result = { input, shift, encoded: caesarCipher(input, shift), decoded: caesarCipher(input, -shift) };
        break;
      case 'morse_encode':
        result = { input, morse: morseEncode(input) };
        break;
      case 'morse_decode':
        result = { input, decoded: morseDecode(input) };
        break;
      case 'ascii_table':
        result = { table: asciiTable(args.start || 32, args.end || 126) };
        break;
      case 'base_convert':
        const num = args.number || 255;
        const fromBase = args.fromBase || 10;
        const toBase = args.toBase || 16;
        const decimalValue = typeof num === 'string' ? baseToNumber(num, fromBase) : num;
        result = {
          input: num,
          fromBase,
          toBase,
          result: numberToBase(decimalValue, toBase),
          decimal: decimalValue
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

export function isBinaryEncodingAvailable(): boolean { return true; }
