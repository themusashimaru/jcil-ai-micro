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
 * This is where we think critically like Claude Code.
 */

import Anthropic from '@anthropic-ai/sdk';
import { CodeIntent, ProjectType, TechnologyStack, AgentContext } from '../../core/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export class CodeIntentAnalyzer {
  // Opus 4.5 for maximum understanding - crush Manus
  private model = 'claude-opus-4-5-20251101';

  /**
   * Analyze user request to understand exactly what they want to build
   */
  async analyze(request: string, context: AgentContext): Promise<CodeIntent> {
    // Build context from previous messages
    const conversationContext = context.previousMessages
      ?.slice(-5)
      .map(m => `${m.role}: ${m.content}`)
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
      const response = await anthropic.messages.create({
        model: this.model,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
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
      console.error('[CodeIntentAnalyzer] Error analyzing intent:', error);
      return this.createFallbackIntent(request);
    }
  }

  /**
   * Validate project type
   */
  private validateProjectType(type: unknown): ProjectType {
    const valid: ProjectType[] = [
      'web_app', 'api', 'cli', 'library', 'script',
      'full_stack', 'mobile', 'extension', 'automation', 'data'
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
    const t = tech as Record<string, unknown> || {};
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
    const isCli = lower.includes('cli') || lower.includes('command line') || lower.includes('terminal');
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
    if (codePatterns.some(p => p.test(message))) {
      return true;
    }

    // Keyword density check
    const codeKeywords = [
      'code', 'build', 'create', 'app', 'api', 'function', 'class',
      'typescript', 'javascript', 'python', 'react', 'node', 'express',
      'github', 'npm', 'package', 'deploy', 'database', 'endpoint'
    ];

    const matchCount = codeKeywords.filter(k => lower.includes(k)).length;
    return matchCount >= 2;
  }
}

export const codeIntentAnalyzer = new CodeIntentAnalyzer();
