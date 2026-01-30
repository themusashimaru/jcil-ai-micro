/**
 * CODE INTENT ANALYZER
 *
 * The first stage of the Code Agent brain.
 * Deeply analyzes user requests to understand:
 * - What they want to build
 * - What technologies to use
 * - Project complexity
 * - Hidden requirements
 *
 * PROACTIVE SENIOR ENGINEER BEHAVIOR:
 * - Asks clarifying questions when request is ambiguous
 * - Foresees potential issues and advises preemptively
 * - Suggests improvements and best practices
 * - Thinks critically like Claude Code
 *
 * MULTI-PROVIDER SUPPORT:
 * - Works with any configured AI provider (Claude, OpenAI, xAI, DeepSeek)
 * - User picks provider → same capabilities
 */

import { agentChat, ProviderId } from '@/lib/ai/providers';
import { CodeIntent, ProjectType, TechnologyStack, AgentContext } from '../../core/types';
import { logger } from '@/lib/logger';

const log = logger('CodeIntentAnalyzer');

/**
 * Result of clarification check
 */
export interface ClarificationResult {
  needsClarification: boolean;
  clarityScore: number; // 0-100, below 60 needs clarification
  questions: ClarifyingQuestion[];
  assumptions: string[];
  potentialIssues: string[];
  suggestions: string[];
}

/**
 * A clarifying question with context
 */
export interface ClarifyingQuestion {
  question: string;
  reason: string;
  options?: string[]; // Suggested answers
  priority: 'critical' | 'important' | 'nice-to-have';
}

export class CodeIntentAnalyzer {
  // Provider to use (can be changed by user)
  private provider: ProviderId = 'claude';

  /**
   * Set the AI provider to use
   */
  setProvider(provider: ProviderId): void {
    this.provider = provider;
  }

  /**
   * PROACTIVE CHECK: Determine if request needs clarification
   * A senior engineer would ask questions before diving in
   */
  async checkClarification(request: string, context: AgentContext): Promise<ClarificationResult> {
    const conversationContext =
      context.previousMessages
        ?.slice(-5)
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n') || '';

    const prompt = `You are a senior software engineer receiving a project request. Before building anything, assess if you need more information.

USER REQUEST:
"${request}"

${conversationContext ? `CONVERSATION CONTEXT:\n${conversationContext}\n` : ''}

Evaluate this request as a senior engineer would. Consider:
1. Is it SPECIFIC enough to build correctly on the first try?
2. Are there MULTIPLE VALID approaches that need decision?
3. Could missing details lead to WASTED WORK?
4. Are there RISKS or issues the user might not have considered?

Respond with a JSON object:
{
  "clarityScore": number (0-100, where 100 is crystal clear),
  "needsClarification": boolean (true if score < 60 OR critical questions exist),
  "questions": [
    {
      "question": "The clarifying question to ask",
      "reason": "Why this matters for the project",
      "options": ["Option 1", "Option 2", "Option 3"] (optional suggested answers),
      "priority": "critical" | "important" | "nice-to-have"
    }
  ],
  "assumptions": ["What we'll assume if they don't clarify"],
  "potentialIssues": ["Things that could go wrong if we proceed without clarity"],
  "suggestions": ["Proactive advice a senior engineer would give"]
}

WHEN TO ASK QUESTIONS (be a proactive senior engineer):
- Authentication: "Will this need user login?" (don't assume)
- Data persistence: "Should data persist? Database or file?"
- Scale: "Expected users/load? This affects architecture"
- Deployment: "Where will this run? Local, Vercel, AWS?"
- Error handling: "How should errors be reported to users?"
- Testing: "What level of test coverage do you need?"

WHEN TO PROCEED WITHOUT QUESTIONS:
- Simple scripts with clear purpose
- Request explicitly states all requirements
- User says "just build it" or similar
- Request is already highly detailed

BE HELPFUL, NOT ANNOYING:
- Only ask 1-3 critical questions max
- Don't ask if the answer is obvious from context
- Offer defaults: "I'll use X unless you prefer Y?"

OUTPUT ONLY THE JSON OBJECT.`;

    try {
      const response = await agentChat([{ role: 'user', content: prompt }], {
        provider: this.provider,
        maxTokens: 2000,
      });

      const text = response.text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.createDefaultClarificationResult();
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        needsClarification: Boolean(parsed.needsClarification),
        clarityScore: Number(parsed.clarityScore) || 50,
        questions: (parsed.questions || []).map((q: Record<string, unknown>) => ({
          question: String(q.question || ''),
          reason: String(q.reason || ''),
          options: Array.isArray(q.options) ? q.options.map(String) : undefined,
          priority: ['critical', 'important', 'nice-to-have'].includes(String(q.priority))
            ? (q.priority as ClarifyingQuestion['priority'])
            : 'important',
        })),
        assumptions: (parsed.assumptions || []).map(String),
        potentialIssues: (parsed.potentialIssues || []).map(String),
        suggestions: (parsed.suggestions || []).map(String),
      };
    } catch (error) {
      log.error('Error checking clarification', { error: (error as Error).message });
      return this.createDefaultClarificationResult();
    }
  }

  /**
   * Create default result when clarification check fails
   */
  private createDefaultClarificationResult(): ClarificationResult {
    return {
      needsClarification: false,
      clarityScore: 70,
      questions: [],
      assumptions: ['Proceeding with reasonable defaults'],
      potentialIssues: [],
      suggestions: [],
    };
  }

  /**
   * Analyze user request to understand exactly what they want to build
   */
  async analyze(request: string, context: AgentContext): Promise<CodeIntent> {
    // Build context from previous messages
    const conversationContext =
      context.previousMessages
        ?.slice(-5)
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n') || '';

    const prompt = `You are a senior software architect with deep expertise in all programming languages and frameworks. Analyze this user request to understand EXACTLY what they want to build.

USER REQUEST:
"${request}"

${conversationContext ? `CONVERSATION CONTEXT:\n${conversationContext}\n` : ''}

Analyze this request like a senior engineer would:
1. What EXACTLY does the user want? (Not what they said, what they NEED)
2. What technologies would be BEST for this? (Consider modern best practices)
3. What are the HIDDEN requirements? (Error handling, security, edge cases)
4. What is the COMPLEXITY level? (How much code is this really?)
5. What COULD GO WRONG? (Anticipate issues)

Respond with a JSON object:
{
  "refinedDescription": "Clear, technical description of what to build",
  "projectType": "web_app" | "api" | "cli" | "library" | "script" | "full_stack" | "mobile" | "extension" | "automation" | "data" | "unknown",
  "requirements": {
    "functional": ["List of WHAT it should do - be specific"],
    "technical": ["Technologies/frameworks to use with reasons"],
    "constraints": ["Any limitations or must-haves"]
  },
  "complexity": "simple" | "moderate" | "complex" | "enterprise",
  "estimatedFiles": number,
  "technologies": {
    "primary": "Main language/framework (e.g., 'TypeScript with Express')",
    "secondary": ["Additional libraries needed"],
    "runtime": "node" | "python" | "both",
    "packageManager": "npm" | "yarn" | "pnpm" | "bun" | "pip",
    "buildTool": "Optional build tool if needed",
    "testFramework": "Test framework to use"
  },
  "contextClues": {
    "hasExistingCode": boolean,
    "targetPlatform": "Where this runs (browser, server, CLI)",
    "integrations": ["External services/APIs to integrate"]
  },
  "criticalThinking": {
    "assumptions": ["What we're assuming"],
    "risks": ["What could go wrong"],
    "questions": ["Questions we'd ask if we could"]
  }
}

ANALYSIS RULES:
1. Default to TypeScript for anything Node.js - it's 2024
2. Choose MODERN frameworks (Next.js over plain React, Hono over Express for APIs)
3. Estimate files REALISTICALLY (a "simple" API is still 5-10 files)
4. Include test files in estimates
5. Be SPECIFIC - "Build an API" is too vague
6. Think about what SENIOR engineers would want

OUTPUT ONLY THE JSON OBJECT.`;

    try {
      const response = await agentChat([{ role: 'user', content: prompt }], {
        provider: this.provider,
        maxTokens: 4000,
      });

      const text = response.text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Build the intent with proper typing
      const intent: CodeIntent = {
        originalRequest: request,
        refinedDescription: String(parsed.refinedDescription || request),
        projectType: this.validateProjectType(parsed.projectType),
        requirements: {
          functional: (parsed.requirements?.functional as string[]) || [],
          technical: (parsed.requirements?.technical as string[]) || [],
          constraints: (parsed.requirements?.constraints as string[]) || [],
        },
        complexity: this.validateComplexity(parsed.complexity),
        estimatedFiles: Number(parsed.estimatedFiles) || 5,
        technologies: this.validateTechStack(parsed.technologies),
        contextClues: {
          hasExistingCode: Boolean(parsed.contextClues?.hasExistingCode),
          targetPlatform: parsed.contextClues?.targetPlatform as string,
          integrations: (parsed.contextClues?.integrations as string[]) || [],
        },
      };

      return intent;
    } catch (error) {
      log.error('Error analyzing intent', { error: (error as Error).message });
      return this.createFallbackIntent(request);
    }
  }

  /**
   * Validate project type
   */
  private validateProjectType(type: unknown): ProjectType {
    const valid: ProjectType[] = [
      'web_app',
      'api',
      'cli',
      'library',
      'script',
      'full_stack',
      'mobile',
      'extension',
      'automation',
      'data',
    ];
    return valid.includes(type as ProjectType) ? (type as ProjectType) : 'unknown';
  }

  /**
   * Validate complexity level
   */
  private validateComplexity(complexity: unknown): CodeIntent['complexity'] {
    const valid = ['simple', 'moderate', 'complex', 'enterprise'];
    return valid.includes(String(complexity))
      ? (complexity as CodeIntent['complexity'])
      : 'moderate';
  }

  /**
   * Validate and build technology stack
   */
  private validateTechStack(tech: unknown): TechnologyStack {
    const t = (tech as Record<string, unknown>) || {};
    return {
      primary: String(t.primary || 'TypeScript'),
      secondary: (t.secondary as string[]) || [],
      runtime: ['node', 'python', 'both'].includes(String(t.runtime))
        ? (t.runtime as 'node' | 'python' | 'both')
        : 'node',
      packageManager: ['npm', 'yarn', 'pnpm', 'bun', 'pip'].includes(String(t.packageManager))
        ? (t.packageManager as TechnologyStack['packageManager'])
        : 'npm',
      buildTool: t.buildTool ? String(t.buildTool) : undefined,
      testFramework: t.testFramework ? String(t.testFramework) : undefined,
    };
  }

  /**
   * Create fallback intent if analysis fails
   */
  private createFallbackIntent(request: string): CodeIntent {
    // Basic heuristics for fallback
    const lower = request.toLowerCase();
    const isApi = lower.includes('api') || lower.includes('backend') || lower.includes('server');
    const isCli =
      lower.includes('cli') || lower.includes('command line') || lower.includes('terminal');
    const isScript = lower.includes('script') || lower.includes('automate') || request.length < 100;
    const isPython = lower.includes('python');

    let projectType: ProjectType = 'script';
    if (isApi) projectType = 'api';
    else if (isCli) projectType = 'cli';
    else if (lower.includes('website') || lower.includes('frontend')) projectType = 'web_app';

    return {
      originalRequest: request,
      refinedDescription: `Build: ${request}`,
      projectType,
      requirements: {
        functional: [request],
        technical: [],
        constraints: [],
      },
      complexity: isScript ? 'simple' : 'moderate',
      estimatedFiles: isScript ? 3 : 8,
      technologies: {
        primary: isPython ? 'Python' : 'TypeScript',
        secondary: [],
        runtime: isPython ? 'python' : 'node',
        packageManager: isPython ? 'pip' : 'npm',
      },
      contextClues: {},
    };
  }

  /**
   * Quick check if a message looks like a coding request
   */
  static isCodeRequest(message: string): boolean {
    const lower = message.toLowerCase();

    // Strong coding indicators
    const codePatterns = [
      /\b(build|create|make|develop|code|implement|write)\b.*\b(app|api|website|script|tool|bot|server|cli|function|class|component)/i,
      /\b(can you|please|help me)\b.*\b(build|create|code|develop|make)/i,
      /\b(generate|scaffold|bootstrap)\b.*\b(project|app|code)/i,
      /\b(fix|debug|refactor|optimize)\b.*\b(code|function|bug|error)/i,
      /\b(add|implement)\b.*\b(feature|functionality|endpoint)/i,
    ];

    // Check patterns
    if (codePatterns.some((p) => p.test(message))) {
      return true;
    }

    // Keyword density check
    const codeKeywords = [
      'code',
      'build',
      'create',
      'app',
      'api',
      'function',
      'class',
      'typescript',
      'javascript',
      'python',
      'react',
      'node',
      'express',
      'github',
      'npm',
      'package',
      'deploy',
      'database',
      'endpoint',
    ];

    const matchCount = codeKeywords.filter((k) => lower.includes(k)).length;
    return matchCount >= 2;
  }
}

export const codeIntentAnalyzer = new CodeIntentAnalyzer();
