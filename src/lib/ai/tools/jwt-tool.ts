/**
 * JWT TOOL
 * JSON Web Token utilities
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function decodeJwt(token: string): { header: unknown; payload: unknown; signature: string } {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  return {
    header: JSON.parse(Buffer.from(parts[0], 'base64url').toString()),
    payload: JSON.parse(Buffer.from(parts[1], 'base64url').toString()),
    signature: parts[2]
  };
}

function analyzeJwt(token: string): { algorithm: string; issuer?: string; expiration?: Date; claims: string[] } {
  const decoded = decodeJwt(token);
  const header = decoded.header as Record<string, unknown>;
  const payload = decoded.payload as Record<string, unknown>;
  return {
    algorithm: header.alg as string || 'unknown',
    issuer: payload.iss as string,
    expiration: payload.exp ? new Date((payload.exp as number) * 1000) : undefined,
    claims: Object.keys(payload)
  };
}

function isExpired(token: string): boolean {
  const decoded = decodeJwt(token);
  const payload = decoded.payload as Record<string, unknown>;
  if (!payload.exp) return false;
  return Date.now() > (payload.exp as number) * 1000;
}

export const jwtTool: UnifiedTool = {
  name: 'jwt',
  description: 'JWT: decode, analyze, check_expiration',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['decode', 'analyze', 'expired'] }, token: { type: 'string' } }, required: ['operation', 'token'] },
};

export async function executeJwt(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'decode': result = decodeJwt(args.token); break;
      case 'analyze': result = analyzeJwt(args.token); break;
      case 'expired': result = { expired: isExpired(args.token) }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isJwtAvailable(): boolean { return true; }
