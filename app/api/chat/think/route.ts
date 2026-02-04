/**
 * NEURAL THINKING API
 *
 * PURPOSE:
 * - Analyze user queries with fast AI (Haiku) to generate impressive "thinking" display
 * - Extract entities, classify query type, identify domains
 * - Returns structured analysis for terminal-style visualization
 *
 * PROVIDER: Claude Haiku for ultra-fast analysis (~200ms)
 */

import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';
import { validateCSRF } from '@/lib/security/csrf';
import { checkRequestRateLimit, rateLimits, errors } from '@/lib/api/utils';

const log = logger('NeuralThinkAPI');

// Analysis result structure
interface ThinkingAnalysis {
  tokens: number;
  entities: string[];
  queryType: string;
  confidence: number;
  domains: string[];
  complexity: 'LOW' | 'MEDIUM' | 'HIGH';
  responseStructure: string[];
  memoryPatterns: number;
}

export async function POST(request: NextRequest) {
  try {
    // CSRF Protection
    const csrfCheck = validateCSRF(request);
    if (!csrfCheck.valid) return csrfCheck.response!;

    // Rate limiting - generous since this is a quick call
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const rateLimitResult = await checkRequestRateLimit(`think:${ip}`, rateLimits.standard);
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    // Parse body
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return errors.badRequest('Invalid JSON body');
    }

    const { message } = rawBody as { message?: string };
    if (!message || typeof message !== 'string') {
      return errors.badRequest('Message is required');
    }

    log.debug('[API] Neural thinking request:', { message: message.slice(0, 100) });

    // Initialize Anthropic client
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      log.error('[API] Missing ANTHROPIC_API_KEY');
      return errors.serverError('AI service unavailable');
    }

    const anthropic = new Anthropic({ apiKey });

    // Fast analysis prompt - structured JSON output
    const analysisPrompt = `Analyze this user query and return a JSON object. Be concise and technical.

User Query: "${message}"

Return ONLY valid JSON (no markdown, no explanation):
{
  "entities": ["key", "concepts", "extracted", "max 5"],
  "queryType": "SINGLE_WORD_TYPE like: CODE_HELP, EXPLANATION, RESEARCH, CREATIVE, TASK, QUESTION, DEBUG, COMPARISON, HOW_TO, GENERAL",
  "confidence": 0.85,
  "domains": ["relevant.technical.domains", "like frontend.react", "max 3"],
  "complexity": "LOW or MEDIUM or HIGH",
  "responseStructure": ["planned", "response", "sections", "max 4"]
}`;

    const startTime = Date.now();

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: analysisPrompt }],
    });

    const elapsed = Date.now() - startTime;
    log.debug('[API] Haiku analysis completed', { elapsed });

    // Extract text content
    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI');
    }

    // Parse JSON response
    let analysis: Partial<ThinkingAnalysis>;
    try {
      // Clean potential markdown wrapper
      let jsonText = textContent.text.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '');
      }
      analysis = JSON.parse(jsonText);
    } catch {
      log.warn('[API] Failed to parse AI JSON, using fallback');
      // Fallback analysis
      analysis = {
        entities: extractBasicEntities(message),
        queryType: 'GENERAL',
        confidence: 0.7,
        domains: ['general'],
        complexity: 'MEDIUM',
        responseStructure: ['analysis', 'response'],
      };
    }

    // Build complete analysis with token count
    const tokenCount = message.split(/\s+/).length;
    const fullAnalysis: ThinkingAnalysis = {
      tokens: tokenCount,
      entities: (analysis.entities || []).slice(0, 5),
      queryType: analysis.queryType || 'GENERAL',
      confidence: Math.min(0.99, Math.max(0.5, analysis.confidence || 0.75)),
      domains: (analysis.domains || ['general']).slice(0, 3),
      complexity: analysis.complexity || 'MEDIUM',
      responseStructure: (analysis.responseStructure || ['response']).slice(0, 5),
      memoryPatterns: Math.floor(Math.random() * 5) + 1, // Simulated pattern matches
    };

    return new Response(JSON.stringify(fullAnalysis), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    log.error('[API] Neural thinking error:', error instanceof Error ? error : { error });

    // Return fallback analysis on error - don't break the UX
    const fallback: ThinkingAnalysis = {
      tokens: 10,
      entities: ['query', 'analysis'],
      queryType: 'GENERAL',
      confidence: 0.75,
      domains: ['general'],
      complexity: 'MEDIUM',
      responseStructure: ['analysis', 'response'],
      memoryPatterns: 2,
    };

    return new Response(JSON.stringify(fallback), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Basic entity extraction fallback
 */
function extractBasicEntities(message: string): string[] {
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'can',
    'to',
    'of',
    'in',
    'for',
    'on',
    'with',
    'at',
    'by',
    'from',
    'about',
    'into',
    'through',
    'during',
    'before',
    'after',
    'above',
    'below',
    'between',
    'i',
    'me',
    'my',
    'you',
    'your',
    'it',
    'its',
    'we',
    'they',
    'them',
    'this',
    'that',
    'what',
    'which',
    'who',
    'how',
    'why',
    'when',
    'where',
    'please',
    'help',
    'want',
    'need',
  ]);

  return message
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word))
    .slice(0, 5);
}

export const runtime = 'nodejs';
export const maxDuration = 10;
