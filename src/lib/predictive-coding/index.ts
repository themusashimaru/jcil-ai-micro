/**
 * PREDICTIVE CODING ENGINE
 *
 * This isn't just autocomplete. This is AI that KNOWS what you're
 * trying to build before you finish typing. It analyzes:
 * - Your coding patterns
 * - The context of your project
 * - Common solutions to similar problems
 * - Your conversation history
 *
 * And proactively generates the code you need.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

const log = logger('PredictiveCoding');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export interface PredictiveContext {
  userId: string;
  sessionId: string;
  conversationHistory: Array<{ role: string; content: string }>;
  currentFile?: string;
  currentCode?: string;
  repo?: {
    owner: string;
    name: string;
    branch: string;
  };
  recentActions: Array<{
    type: 'file_open' | 'file_edit' | 'search' | 'chat' | 'command';
    target: string;
    timestamp: number;
  }>;
}

export interface Prediction {
  id: string;
  type: 'next_file' | 'next_code' | 'next_question' | 'next_task' | 'related_code';
  title: string;
  description: string;
  content?: string;
  action?: {
    type: 'generate' | 'open' | 'search' | 'execute';
    payload: unknown;
  };
  confidence: number;
  reasoning: string;
}

/**
 * Predict what the user needs next
 */
export async function predictNextActions(context: PredictiveContext): Promise<Prediction[]> {
  const predictions: Prediction[] = [];

  // Analyze recent actions to understand intent
  const intent = analyzeIntent(context);

  // Note: RAG-based code search disabled (used Google embeddings)
  // Predictions now rely on conversation history and recent actions
  const relatedCode = '';

  // Generate predictions with Claude
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are a predictive coding assistant. Your job is to anticipate what the developer needs BEFORE they ask.

Analyze the context and predict:
1. What code they'll need next
2. What file they'll want to open
3. What question they'll ask
4. What task they're trying to accomplish

Be specific and actionable. Generate ready-to-use code predictions.`,
    messages: [
      {
        role: 'user',
        content: `Current context:

## Recent Conversation
${context.conversationHistory
  .slice(-5)
  .map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
  .join('\n')}

## Current File: ${context.currentFile || 'None'}
${context.currentCode ? `\`\`\`\n${context.currentCode.slice(0, 1500)}\n\`\`\`` : ''}

## Recent Actions
${context.recentActions
  .slice(-5)
  .map((a) => `- ${a.type}: ${a.target}`)
  .join('\n')}

## Detected Intent: ${intent.primary}
${intent.secondary ? `Secondary: ${intent.secondary}` : ''}

${relatedCode ? `## Related Code from Repository\n${relatedCode}` : ''}

Generate 3-5 predictions as JSON array:
[{
  "id": "unique_id",
  "type": "next_file" | "next_code" | "next_question" | "next_task" | "related_code",
  "title": "Brief title",
  "description": "What this prediction is",
  "content": "Actual code or content if applicable",
  "action": { "type": "generate|open|search|execute", "payload": {} },
  "confidence": 0.0-1.0,
  "reasoning": "Why you predicted this"
}]`,
      },
    ],
  });

  let content = '';
  for (const block of response.content) {
    if (block.type === 'text') content += block.text;
  }

  try {
    const parsed = JSON.parse(content.replace(/```json?\s*/g, '').replace(/```/g, ''));
    if (Array.isArray(parsed)) {
      predictions.push(...parsed.filter((p: Prediction) => p.confidence > 0.6));
    }
  } catch (e) {
    log.error('Parse error', e as Error);
  }

  return predictions.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Analyze user intent from context
 */
function analyzeIntent(context: PredictiveContext): {
  primary: string;
  secondary?: string;
  confidence: number;
} {
  const recentActions = context.recentActions.slice(-10);
  const recentMessages = context.conversationHistory.slice(-5);

  // Pattern detection
  const patterns = {
    building_feature: recentMessages.some((m) =>
      /build|create|add|implement|make/i.test(m.content)
    ),
    debugging:
      recentActions.filter(
        (a) => a.type === 'file_edit' || a.target.includes('log') || a.target.includes('debug')
      ).length > 3,
    exploring: recentActions.filter((a) => a.type === 'file_open').length > 5,
    refactoring: recentMessages.some((m) => /refactor|clean|improve|optimize/i.test(m.content)),
    testing: recentMessages.some((m) => /test|spec|coverage|mock/i.test(m.content)),
  };

  // Determine primary intent
  let primary = 'exploring';
  let confidence = 0.5;

  if (patterns.building_feature) {
    primary = 'building_new_feature';
    confidence = 0.8;
  } else if (patterns.debugging) {
    primary = 'debugging_issue';
    confidence = 0.75;
  } else if (patterns.refactoring) {
    primary = 'refactoring_code';
    confidence = 0.7;
  } else if (patterns.testing) {
    primary = 'writing_tests';
    confidence = 0.7;
  } else if (patterns.exploring) {
    primary = 'exploring_codebase';
    confidence = 0.6;
  }

  // Secondary intent
  let secondary: string | undefined;
  if (patterns.building_feature && patterns.testing) {
    secondary = 'test_driven_development';
  } else if (patterns.debugging && patterns.exploring) {
    secondary = 'investigating_bug';
  }

  return { primary, secondary, confidence };
}

/**
 * Generate proactive suggestions based on code state
 */
export async function generateProactiveSuggestions(
  code: string,
  language: string,
  _context: PredictiveContext
): Promise<
  Array<{
    type: 'optimization' | 'security' | 'best_practice' | 'missing_code';
    title: string;
    description: string;
    suggestedCode?: string;
    priority: 'high' | 'medium' | 'low';
  }>
> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: `Analyze this ${language} code and proactively suggest improvements:

\`\`\`${language}
${code}
\`\`\`

Look for:
1. Performance optimizations
2. Security vulnerabilities
3. Missing error handling
4. Best practice violations
5. Missing code that should exist (like tests, validation, etc.)

Return JSON array of suggestions with priority.`,
      },
    ],
  });

  let content = '';
  for (const block of response.content) {
    if (block.type === 'text') content += block.text;
  }

  try {
    const parsed = JSON.parse(content.replace(/```json?\s*/g, '').replace(/```/g, ''));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Predict the next files user will need
 */
export async function predictNextFiles(
  currentFile: string,
  _recentFiles: string[],
  projectStructure: string[]
): Promise<Array<{ file: string; reason: string; confidence: number }>> {
  // Simple heuristics + AI prediction
  const predictions: Array<{ file: string; reason: string; confidence: number }> = [];

  // If editing a component, predict test file
  if (currentFile.includes('/components/')) {
    const testFile = currentFile.replace('.tsx', '.test.tsx').replace('.ts', '.test.ts');
    if (projectStructure.includes(testFile)) {
      predictions.push({
        file: testFile,
        reason: 'Test file for current component',
        confidence: 0.85,
      });
    }
  }

  // If editing an API route, predict types file
  if (currentFile.includes('/api/')) {
    const typesFile = currentFile.replace('/api/', '/types/').replace('route.ts', 'types.ts');
    predictions.push({
      file: typesFile,
      reason: 'Type definitions for this API',
      confidence: 0.7,
    });
  }

  // If editing a hook, predict the component using it
  if (currentFile.includes('/hooks/')) {
    const hookName = currentFile.split('/').pop()?.replace('.ts', '');
    if (hookName) {
      const usageFiles = projectStructure
        .filter((f) => f.includes('/components/') && !f.includes('.test.'))
        .slice(0, 3);
      usageFiles.forEach((f) => {
        predictions.push({
          file: f,
          reason: `May use ${hookName}`,
          confidence: 0.6,
        });
      });
    }
  }

  return predictions.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

/**
 * Watch for patterns and learn user preferences
 */
export class PredictiveLearner {
  private patterns: Map<string, number> = new Map();
  private preferences: Map<string, string> = new Map();

  recordAction(action: string, context: string) {
    const key = `${action}:${context}`;
    this.patterns.set(key, (this.patterns.get(key) || 0) + 1);
  }

  recordPreference(key: string, value: string) {
    this.preferences.set(key, value);
  }

  getTopPatterns(n: number = 10): Array<{ pattern: string; frequency: number }> {
    return Array.from(this.patterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([pattern, frequency]) => ({ pattern, frequency }));
  }

  getPreference(key: string): string | undefined {
    return this.preferences.get(key);
  }
}
