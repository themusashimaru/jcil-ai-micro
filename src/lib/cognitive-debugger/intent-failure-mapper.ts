/**
 * INTENT-TO-FAILURE MAPPER
 *
 * This is the "senior engineer empathy" module.
 * It understands what the user is trying to accomplish and maps
 * that intent to all the ways it could fail.
 *
 * "Tell me what you want to do, and I'll tell you what will break."
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';
import {
  UserIntent,
  IntentFailureMap,
  FailurePoint,
  CriticalPath,
  AssumptionRisk,
  EdgeCase,
  Mitigation,
  PredictedIssue,
  ExecutionPath,
  DebugLanguage,
  Severity,
} from './types';

const log = logger('IntentFailureMapper');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// COMMON FAILURE PATTERNS BY INTENT CATEGORY
// ============================================================================

interface IntentCategory {
  keywords: string[];
  commonFailures: Omit<FailurePoint, 'id'>[];
  riskAreas: string[];
}

const INTENT_CATEGORIES: Record<string, IntentCategory> = {
  'data-processing': {
    keywords: ['parse', 'transform', 'convert', 'process', 'filter', 'map', 'reduce', 'aggregate'],
    commonFailures: [
      {
        description: 'Malformed input data',
        triggerConditions: ["Input doesn't match expected format", 'Missing required fields'],
        impact: 'Processing fails or produces incorrect results',
        severity: 'high',
        likelihood: 0.4,
        mitigations: [
          {
            strategy: 'Input validation',
            implementation: 'Validate schema before processing',
            effectiveness: 'high',
            cost: 'minor',
          },
          {
            strategy: 'Default values',
            implementation: 'Provide sensible defaults for missing fields',
            effectiveness: 'medium',
            cost: 'trivial',
          },
        ],
      },
      {
        description: 'Empty or null input',
        triggerConditions: ['Input is null', 'Input is empty array/object'],
        impact: 'Null reference errors or unexpected empty results',
        severity: 'medium',
        likelihood: 0.3,
        mitigations: [
          {
            strategy: 'Null checks',
            implementation: 'Check for null/empty before processing',
            effectiveness: 'high',
            cost: 'trivial',
          },
        ],
      },
      {
        description: 'Large data volume',
        triggerConditions: ['Input exceeds memory', 'Processing takes too long'],
        impact: 'Out of memory or timeout',
        severity: 'high',
        likelihood: 0.2,
        mitigations: [
          {
            strategy: 'Streaming',
            implementation: 'Process data in chunks',
            effectiveness: 'high',
            cost: 'moderate',
          },
          {
            strategy: 'Pagination',
            implementation: 'Limit batch size',
            effectiveness: 'medium',
            cost: 'minor',
          },
        ],
      },
    ],
    riskAreas: ['Memory management', 'Error handling', 'Edge cases'],
  },

  'api-integration': {
    keywords: ['api', 'fetch', 'request', 'endpoint', 'http', 'rest', 'graphql', 'webhook'],
    commonFailures: [
      {
        description: 'Network failure',
        triggerConditions: ['Server unreachable', 'DNS resolution fails', 'Connection timeout'],
        impact: 'Request fails, data not received',
        severity: 'high',
        likelihood: 0.3,
        mitigations: [
          {
            strategy: 'Retry logic',
            implementation: 'Exponential backoff with max retries',
            effectiveness: 'high',
            cost: 'minor',
          },
          {
            strategy: 'Circuit breaker',
            implementation: 'Stop requests if failure rate is high',
            effectiveness: 'high',
            cost: 'moderate',
          },
        ],
      },
      {
        description: 'API rate limiting',
        triggerConditions: ['Too many requests', 'Quota exceeded'],
        impact: 'Requests rejected, service degraded',
        severity: 'medium',
        likelihood: 0.4,
        mitigations: [
          {
            strategy: 'Rate limiting client-side',
            implementation: 'Throttle outgoing requests',
            effectiveness: 'high',
            cost: 'minor',
          },
          {
            strategy: 'Caching',
            implementation: 'Cache responses to reduce API calls',
            effectiveness: 'high',
            cost: 'moderate',
          },
        ],
      },
      {
        description: 'Unexpected response format',
        triggerConditions: ['API version changed', 'Server returns error in different format'],
        impact: 'Parsing fails, undefined behavior',
        severity: 'high',
        likelihood: 0.3,
        mitigations: [
          {
            strategy: 'Response validation',
            implementation: 'Validate response against schema',
            effectiveness: 'high',
            cost: 'minor',
          },
          {
            strategy: 'Defensive parsing',
            implementation: 'Handle unexpected fields gracefully',
            effectiveness: 'medium',
            cost: 'minor',
          },
        ],
      },
      {
        description: 'Authentication failure',
        triggerConditions: ['Token expired', 'Invalid credentials', 'Permission denied'],
        impact: 'Unauthorized access, request rejected',
        severity: 'high',
        likelihood: 0.3,
        mitigations: [
          {
            strategy: 'Token refresh',
            implementation: 'Automatically refresh expired tokens',
            effectiveness: 'high',
            cost: 'minor',
          },
          {
            strategy: 'Proper error handling',
            implementation: 'Detect 401/403 and handle appropriately',
            effectiveness: 'high',
            cost: 'trivial',
          },
        ],
      },
    ],
    riskAreas: ['Network reliability', 'Authentication', 'Data validation', 'Error handling'],
  },

  'user-authentication': {
    keywords: ['login', 'signup', 'auth', 'password', 'session', 'token', 'oauth', 'jwt'],
    commonFailures: [
      {
        description: 'Credential stuffing attack',
        triggerConditions: ['No rate limiting', 'No CAPTCHA'],
        impact: 'Account takeover',
        severity: 'critical',
        likelihood: 0.4,
        mitigations: [
          {
            strategy: 'Rate limiting',
            implementation: 'Limit login attempts per IP/account',
            effectiveness: 'high',
            cost: 'minor',
          },
          {
            strategy: 'CAPTCHA',
            implementation: 'Add CAPTCHA after failed attempts',
            effectiveness: 'medium',
            cost: 'minor',
          },
        ],
      },
      {
        description: 'Session hijacking',
        triggerConditions: ['Insecure session storage', 'No HTTPS', 'XSS vulnerability'],
        impact: 'Unauthorized account access',
        severity: 'critical',
        likelihood: 0.3,
        mitigations: [
          {
            strategy: 'Secure cookies',
            implementation: 'HttpOnly, Secure, SameSite flags',
            effectiveness: 'high',
            cost: 'trivial',
          },
          {
            strategy: 'Session rotation',
            implementation: 'Rotate session ID on login',
            effectiveness: 'high',
            cost: 'trivial',
          },
        ],
      },
      {
        description: 'Weak password acceptance',
        triggerConditions: ['No password requirements', 'Common passwords allowed'],
        impact: 'Easily guessable passwords',
        severity: 'high',
        likelihood: 0.5,
        mitigations: [
          {
            strategy: 'Password policy',
            implementation: 'Enforce length, complexity requirements',
            effectiveness: 'medium',
            cost: 'trivial',
          },
          {
            strategy: 'Breached password check',
            implementation: 'Check against known breached passwords',
            effectiveness: 'high',
            cost: 'minor',
          },
        ],
      },
    ],
    riskAreas: ['Security', 'Session management', 'Password storage'],
  },

  'database-operations': {
    keywords: ['database', 'query', 'sql', 'insert', 'update', 'delete', 'select', 'orm', 'mongo'],
    commonFailures: [
      {
        description: 'SQL injection',
        triggerConditions: ['User input concatenated into query', 'No parameterization'],
        impact: 'Data breach, data loss, unauthorized access',
        severity: 'critical',
        likelihood: 0.4,
        mitigations: [
          {
            strategy: 'Parameterized queries',
            implementation: 'Use prepared statements',
            effectiveness: 'high',
            cost: 'trivial',
          },
          {
            strategy: 'ORM',
            implementation: 'Use ORM that handles escaping',
            effectiveness: 'high',
            cost: 'minor',
          },
        ],
      },
      {
        description: 'N+1 query problem',
        triggerConditions: ['Looping over results with additional queries', 'No eager loading'],
        impact: 'Poor performance, database overload',
        severity: 'medium',
        likelihood: 0.5,
        mitigations: [
          {
            strategy: 'Eager loading',
            implementation: 'Use JOINs or include related data',
            effectiveness: 'high',
            cost: 'minor',
          },
          {
            strategy: 'Query batching',
            implementation: 'Batch multiple IDs in single query',
            effectiveness: 'high',
            cost: 'minor',
          },
        ],
      },
      {
        description: 'Deadlock',
        triggerConditions: ['Multiple transactions accessing same rows', 'Inconsistent lock order'],
        impact: 'Transactions hang, application freezes',
        severity: 'high',
        likelihood: 0.2,
        mitigations: [
          {
            strategy: 'Consistent lock ordering',
            implementation: 'Always lock resources in same order',
            effectiveness: 'high',
            cost: 'minor',
          },
          {
            strategy: 'Deadlock detection',
            implementation: 'Set query timeout, retry on deadlock',
            effectiveness: 'medium',
            cost: 'minor',
          },
        ],
      },
    ],
    riskAreas: ['Security', 'Performance', 'Concurrency'],
  },

  'file-operations': {
    keywords: ['file', 'read', 'write', 'upload', 'download', 'fs', 'path', 'stream'],
    commonFailures: [
      {
        description: 'Path traversal attack',
        triggerConditions: ['User-controlled path', 'No path sanitization'],
        impact: 'Unauthorized file access',
        severity: 'critical',
        likelihood: 0.4,
        mitigations: [
          {
            strategy: 'Path sanitization',
            implementation: 'Normalize and validate paths',
            effectiveness: 'high',
            cost: 'trivial',
          },
          {
            strategy: 'Chroot/sandbox',
            implementation: 'Restrict to specific directory',
            effectiveness: 'high',
            cost: 'minor',
          },
        ],
      },
      {
        description: 'File not found',
        triggerConditions: ['File deleted', 'Wrong path', 'Permission denied'],
        impact: 'Operation fails',
        severity: 'medium',
        likelihood: 0.4,
        mitigations: [
          {
            strategy: 'Existence check',
            implementation: 'Check file exists before operation',
            effectiveness: 'medium',
            cost: 'trivial',
          },
          {
            strategy: 'Error handling',
            implementation: 'Gracefully handle ENOENT',
            effectiveness: 'high',
            cost: 'trivial',
          },
        ],
      },
      {
        description: 'Disk space exhaustion',
        triggerConditions: ['Large file upload', 'No size limit'],
        impact: 'Write fails, system instability',
        severity: 'high',
        likelihood: 0.2,
        mitigations: [
          {
            strategy: 'File size limits',
            implementation: 'Enforce maximum file size',
            effectiveness: 'high',
            cost: 'trivial',
          },
          {
            strategy: 'Disk space check',
            implementation: 'Check available space before large writes',
            effectiveness: 'medium',
            cost: 'trivial',
          },
        ],
      },
    ],
    riskAreas: ['Security', 'Resource management', 'Error handling'],
  },

  'concurrent-processing': {
    keywords: ['async', 'await', 'promise', 'parallel', 'concurrent', 'thread', 'worker', 'queue'],
    commonFailures: [
      {
        description: 'Race condition',
        triggerConditions: ['Shared mutable state', 'Non-atomic operations'],
        impact: 'Data corruption, inconsistent state',
        severity: 'high',
        likelihood: 0.4,
        mitigations: [
          {
            strategy: 'Locks/Mutex',
            implementation: 'Protect shared state with locks',
            effectiveness: 'high',
            cost: 'moderate',
          },
          {
            strategy: 'Immutable data',
            implementation: 'Avoid shared mutable state',
            effectiveness: 'high',
            cost: 'moderate',
          },
        ],
      },
      {
        description: 'Unhandled promise rejection',
        triggerConditions: ['Missing .catch()', 'No try-catch around await'],
        impact: 'Silent failure, unfinished operations',
        severity: 'medium',
        likelihood: 0.5,
        mitigations: [
          {
            strategy: 'Global handler',
            implementation: 'Add unhandledRejection listener',
            effectiveness: 'medium',
            cost: 'trivial',
          },
          {
            strategy: 'Proper error handling',
            implementation: 'Always catch promise errors',
            effectiveness: 'high',
            cost: 'trivial',
          },
        ],
      },
      {
        description: 'Callback hell / Promise chain breakage',
        triggerConditions: ['Deep nesting', 'Missing return in promise chain'],
        impact: "Logic doesn't execute as expected",
        severity: 'medium',
        likelihood: 0.4,
        mitigations: [
          {
            strategy: 'async/await',
            implementation: 'Use async/await instead of callbacks',
            effectiveness: 'high',
            cost: 'minor',
          },
          {
            strategy: 'Flat promise chains',
            implementation: 'Always return promises in .then()',
            effectiveness: 'high',
            cost: 'trivial',
          },
        ],
      },
    ],
    riskAreas: ['Concurrency', 'Error handling', 'State management'],
  },
};

// ============================================================================
// INTENT FAILURE MAPPER
// ============================================================================

export class IntentFailureMapper {
  /**
   * Map user intent to potential failures
   */
  async mapIntentToFailures(
    intent: UserIntent,
    code: string,
    language: DebugLanguage,
    context?: {
      predictions?: PredictedIssue[];
      executionPaths?: ExecutionPath[];
    }
  ): Promise<IntentFailureMap> {
    log.info('Mapping intent to failures', {
      intentId: intent.id,
      goals: intent.goals.length,
    });

    // Step 1: Categorize the intent
    const categories = this.categorizeIntent(intent);

    // Step 2: Get common failures for these categories
    const categoryFailures = this.getFailuresForCategories(categories);

    // Step 3: Use AI to analyze specific failures for this code
    const specificFailures = await this.analyzeSpecificFailures(intent, code, language);

    // Step 4: Identify critical paths
    const criticalPaths = await this.identifyCriticalPaths(intent, code, language);

    // Step 5: Identify assumptions and their risks
    const assumptionRisks = await this.identifyAssumptionRisks(intent, code);

    // Step 6: Generate edge cases
    const edgeCases = await this.generateEdgeCases(intent, code, language);

    // Step 7: Merge with prediction results if available
    const mergedFailures = this.mergeWithPredictions(
      [...categoryFailures, ...specificFailures],
      context?.predictions || []
    );

    // Calculate success probability
    const successProbability = this.calculateSuccessProbability(mergedFailures, assumptionRisks);

    return {
      intent,
      possibleFailures: mergedFailures,
      criticalPaths,
      assumptionRisks,
      edgeCases,
      successProbability,
    };
  }

  /**
   * Categorize intent based on keywords
   */
  private categorizeIntent(intent: UserIntent): string[] {
    const categories: string[] = [];
    const text = `${intent.description} ${intent.goals.join(' ')}`.toLowerCase();

    for (const [category, config] of Object.entries(INTENT_CATEGORIES)) {
      if (config.keywords.some((kw) => text.includes(kw))) {
        categories.push(category);
      }
    }

    return categories.length > 0 ? categories : ['general'];
  }

  /**
   * Get common failures for intent categories
   */
  private getFailuresForCategories(categories: string[]): FailurePoint[] {
    const failures: FailurePoint[] = [];
    let idCounter = 1;

    for (const category of categories) {
      const config = INTENT_CATEGORIES[category];
      if (config) {
        for (const failure of config.commonFailures) {
          failures.push({
            ...failure,
            id: `cat_${category}_${idCounter++}`,
          });
        }
      }
    }

    return failures;
  }

  /**
   * Analyze specific failures for this code
   */
  private async analyzeSpecificFailures(
    intent: UserIntent,
    code: string,
    language: DebugLanguage
  ): Promise<FailurePoint[]> {
    const prompt = `As a senior engineer, analyze how this code might fail to achieve the user's intent.

USER INTENT:
- Description: ${intent.description}
- Goals: ${intent.goals.join(', ')}
- Expected Behavior: ${intent.expectedBehavior.join(', ')}
- Constraints: ${intent.constraints.join(', ')}

CODE:
\`\`\`${language}
${code}
\`\`\`

Identify SPECIFIC ways this code could fail to meet the intent. For each failure:
1. What specifically would fail?
2. Under what conditions?
3. What's the impact?
4. How to mitigate?

Return JSON array:
[{
  "id": "unique_id",
  "description": "specific failure description",
  "triggerConditions": ["condition1", "condition2"],
  "impact": "what goes wrong",
  "severity": "critical" | "high" | "medium" | "low",
  "likelihood": 0.0-1.0,
  "mitigations": [{
    "strategy": "name",
    "implementation": "how to implement",
    "effectiveness": "high" | "medium" | "low",
    "cost": "trivial" | "minor" | "moderate" | "significant"
  }]
}]

Focus on failures specific to the code and intent, not generic issues.`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) return [];

      return parsed.map((item: Record<string, unknown>) => ({
        id: String(item.id || `specific_${Math.random().toString(36).slice(2)}`),
        description: String(item.description || ''),
        triggerConditions: Array.isArray(item.triggerConditions)
          ? item.triggerConditions.map(String)
          : [],
        impact: String(item.impact || ''),
        severity: (item.severity as Severity) || 'medium',
        likelihood: Number(item.likelihood) || 0.5,
        mitigations: Array.isArray(item.mitigations)
          ? item.mitigations.map((m: Record<string, unknown>) => ({
              strategy: String(m.strategy || ''),
              implementation: String(m.implementation || ''),
              effectiveness: (m.effectiveness as Mitigation['effectiveness']) || 'medium',
              cost: (m.cost as Mitigation['cost']) || 'minor',
            }))
          : [],
      }));
    } catch (error) {
      log.warn('Failed to analyze specific failures', { error });
      return [];
    }
  }

  /**
   * Identify critical paths through the code
   */
  private async identifyCriticalPaths(
    intent: UserIntent,
    code: string,
    language: DebugLanguage
  ): Promise<CriticalPath[]> {
    const prompt = `Identify the CRITICAL PATHS through this code that must succeed for the user's intent to be achieved.

INTENT: ${intent.description}
GOALS: ${intent.goals.join(', ')}

CODE:
\`\`\`${language}
${code}
\`\`\`

A critical path is a sequence of operations that MUST all succeed.
For each critical path, identify:
1. The sequence of steps
2. The failure probability
3. Bottlenecks (points most likely to fail)

Return JSON:
[{
  "steps": [{
    "description": "what happens",
    "line": line_number_or_null,
    "riskLevel": "critical" | "high" | "medium" | "low",
    "dependencies": ["what this step depends on"]
  }],
  "failureProbability": 0.0-1.0,
  "bottleneckLines": [line_numbers]
}]`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) return [];

      return parsed.map((item: Record<string, unknown>) => ({
        steps: Array.isArray(item.steps)
          ? item.steps.map((s: Record<string, unknown>) => ({
              description: String(s.description || ''),
              location: s.line ? { file: 'current', line: Number(s.line) } : undefined,
              riskLevel: (s.riskLevel as Severity) || 'medium',
              dependencies: Array.isArray(s.dependencies) ? s.dependencies.map(String) : [],
            }))
          : [],
        failureProbability: Number(item.failureProbability) || 0.5,
        bottlenecks: Array.isArray(item.bottleneckLines)
          ? item.bottleneckLines.map((l: unknown) => ({ file: 'current', line: Number(l) }))
          : [],
      }));
    } catch (error) {
      log.warn('Failed to identify critical paths', { error });
      return [];
    }
  }

  /**
   * Identify assumptions in the code and their risks
   */
  private async identifyAssumptionRisks(
    intent: UserIntent,
    code: string
  ): Promise<AssumptionRisk[]> {
    const prompt = `Identify HIDDEN ASSUMPTIONS in this code that might not hold.

INTENT: ${intent.description}

CODE:
\`\`\`
${code}
\`\`\`

For each assumption:
1. What is being assumed?
2. Is it valid, questionable, or invalid?
3. What happens if the assumption is wrong?
4. How to verify it?

Return JSON:
[{
  "assumption": "what is assumed",
  "validity": "valid" | "questionable" | "invalid" | "untested",
  "consequence": "what happens if wrong",
  "verification": "how to test the assumption"
}]`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) return [];

      return parsed.map((item: Record<string, unknown>) => ({
        assumption: String(item.assumption || ''),
        validity: (item.validity as AssumptionRisk['validity']) || 'untested',
        consequence: String(item.consequence || ''),
        verification: item.verification ? String(item.verification) : undefined,
      }));
    } catch (error) {
      log.warn('Failed to identify assumption risks', { error });
      return [];
    }
  }

  /**
   * Generate edge cases that should be tested
   */
  private async generateEdgeCases(
    intent: UserIntent,
    code: string,
    language: DebugLanguage
  ): Promise<EdgeCase[]> {
    const prompt = `Generate EDGE CASES for this code based on the user's intent.

INTENT: ${intent.description}
EXPECTED BEHAVIOR: ${intent.expectedBehavior.join(', ')}

CODE:
\`\`\`${language}
${code}
\`\`\`

Generate edge cases that:
1. Are likely to reveal bugs
2. Test boundary conditions
3. Test unexpected inputs
4. Test error conditions

Return JSON:
[{
  "description": "edge case description",
  "inputs": { "param1": value, "param2": value },
  "expectedBehavior": "what should happen",
  "handled": true/false (whether code handles this)
}]`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) return [];

      return parsed.map((item: Record<string, unknown>) => ({
        description: String(item.description || ''),
        inputs: (item.inputs as Record<string, unknown>) || {},
        expectedBehavior: String(item.expectedBehavior || ''),
        handled: Boolean(item.handled),
      }));
    } catch (error) {
      log.warn('Failed to generate edge cases', { error });
      return [];
    }
  }

  /**
   * Merge category failures with predictions
   */
  private mergeWithPredictions(
    failures: FailurePoint[],
    predictions: PredictedIssue[]
  ): FailurePoint[] {
    // Add predicted issues as failure points
    for (const prediction of predictions) {
      const existing = failures.find(
        (f) =>
          f.description.toLowerCase().includes(prediction.type) ||
          prediction.description.toLowerCase().includes(f.description.toLowerCase().split(' ')[0])
      );

      if (!existing) {
        failures.push({
          id: `pred_${prediction.id}`,
          description: prediction.description,
          triggerConditions: prediction.conditions,
          impact: `${prediction.type} error`,
          severity: prediction.severity,
          likelihood: prediction.probability,
          location: prediction.location,
          mitigations: prediction.preventionStrategy
            ? [
                {
                  strategy: 'Prevention',
                  implementation: prediction.preventionStrategy,
                  effectiveness: 'high',
                  cost: 'minor',
                },
              ]
            : [],
        });
      }
    }

    return failures;
  }

  /**
   * Calculate probability of achieving intent successfully
   */
  private calculateSuccessProbability(
    failures: FailurePoint[],
    assumptions: AssumptionRisk[]
  ): number {
    if (failures.length === 0) return 0.95;

    // Start with base probability
    let probability = 1.0;

    // Reduce by each failure's likelihood
    for (const failure of failures) {
      const severityWeight = {
        critical: 1.0,
        high: 0.8,
        medium: 0.5,
        low: 0.2,
        info: 0.1,
      }[failure.severity];

      // P(success) = P(success) * (1 - P(this failure) * severity_weight)
      probability *= 1 - failure.likelihood * severityWeight;
    }

    // Reduce by questionable assumptions
    const questionableAssumptions = assumptions.filter(
      (a) => a.validity === 'questionable' || a.validity === 'invalid'
    );
    probability *= Math.pow(0.9, questionableAssumptions.length);

    return Math.max(0.05, Math.min(0.95, probability));
  }

  /**
   * Quick intent analysis from natural language
   */
  async parseIntent(description: string): Promise<UserIntent> {
    const prompt = `Parse this user intent into structured form:

"${description}"

Return JSON:
{
  "id": "generated_id",
  "description": "refined description",
  "goals": ["goal1", "goal2"],
  "constraints": ["constraint1"],
  "expectedBehavior": ["behavior1", "behavior2"]
}`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        id: parsed.id || `intent_${Date.now()}`,
        description: parsed.description || description,
        goals: parsed.goals || [],
        constraints: parsed.constraints || [],
        expectedBehavior: parsed.expectedBehavior || [],
      };
    } catch (error) {
      log.warn('Failed to parse intent, using defaults', { error });
      return {
        id: `intent_${Date.now()}`,
        description,
        goals: [description],
        constraints: [],
        expectedBehavior: [],
      };
    }
  }
}
