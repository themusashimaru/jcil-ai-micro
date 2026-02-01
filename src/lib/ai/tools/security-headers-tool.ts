/**
 * SECURITY HEADERS TOOL
 * HTTP security headers analysis
 */
/* eslint-disable @typescript-eslint/no-unused-vars */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const SECURITY_HEADERS = {
  'Content-Security-Policy': { importance: 'Critical', purpose: 'Prevent XSS and injection attacks' },
  'X-Frame-Options': { importance: 'High', purpose: 'Prevent clickjacking attacks' },
  'X-Content-Type-Options': { importance: 'High', purpose: 'Prevent MIME type sniffing' },
  'Strict-Transport-Security': { importance: 'Critical', purpose: 'Force HTTPS connections' },
  'X-XSS-Protection': { importance: 'Medium', purpose: 'XSS filter (deprecated but still useful)' },
  'Referrer-Policy': { importance: 'Medium', purpose: 'Control referrer information' },
  'Permissions-Policy': { importance: 'Medium', purpose: 'Control browser features' }
};

function analyzeHeaders(headers: Record<string, string>): { score: number; missing: string[]; present: string[]; recommendations: string[] } {
  const headerKeys = Object.keys(headers).map(h => h.toLowerCase());
  const missing = Object.keys(SECURITY_HEADERS).filter(h => !headerKeys.includes(h.toLowerCase()));
  const present = Object.keys(SECURITY_HEADERS).filter(h => headerKeys.includes(h.toLowerCase()));
  const score = (present.length / Object.keys(SECURITY_HEADERS).length) * 100;
  const recommendations = missing.map(h => `Add ${h}: ${SECURITY_HEADERS[h as keyof typeof SECURITY_HEADERS].purpose}`);
  return { score: Math.round(score), missing, present, recommendations };
}

function validateCsp(csp: string): { valid: boolean; issues: string[]; directives: string[] } {
  const issues: string[] = [];
  const directives = csp.split(';').map(d => d.trim()).filter(d => d);
  if (!csp.includes('default-src')) issues.push('Missing default-src directive');
  if (csp.includes("'unsafe-inline'")) issues.push('Contains unsafe-inline (XSS risk)');
  if (csp.includes("'unsafe-eval'")) issues.push('Contains unsafe-eval (XSS risk)');
  return { valid: issues.length === 0, issues, directives };
}

function generateCsp(options: { scripts?: string[]; styles?: string[]; images?: string[]; strict?: boolean }): string {
  const base = options.strict ? "'self'" : "'self' 'unsafe-inline'";
  const parts = [`default-src 'self'`, `script-src ${base} ${(options.scripts || []).join(' ')}`.trim(), `style-src ${base} ${(options.styles || []).join(' ')}`.trim(), `img-src 'self' data: ${(options.images || []).join(' ')}`.trim()];
  return parts.join('; ');
}

export const securityHeadersTool: UnifiedTool = {
  name: 'security_headers',
  description: 'Security headers: analyze, validate_csp, generate_csp, list_headers',
  parameters: { type: 'object', properties: { operation: { type: 'string', enum: ['analyze', 'validate_csp', 'generate_csp', 'list_headers'] }, headers: { type: 'object' }, csp: { type: 'string' }, scripts: { type: 'array', items: { type: 'string' } }, styles: { type: 'array', items: { type: 'string' } }, images: { type: 'array', items: { type: 'string' } }, strict: { type: 'boolean' } }, required: ['operation'] },
};

export async function executeSecurityHeaders(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'analyze': result = analyzeHeaders(args.headers || {}); break;
      case 'validate_csp': result = validateCsp(args.csp || ''); break;
      case 'generate_csp': result = { csp: generateCsp({ scripts: args.scripts, styles: args.styles, images: args.images, strict: args.strict }) }; break;
      case 'list_headers': result = { headers: SECURITY_HEADERS }; break;
      default: throw new Error(`Unknown: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) { return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true }; }
}
export function isSecurityHeadersAvailable(): boolean { return true; }
