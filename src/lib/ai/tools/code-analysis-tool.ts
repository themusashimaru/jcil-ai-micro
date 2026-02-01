/**
 * CODE ANALYSIS TOOL
 *
 * Analyzes code for:
 * - Security vulnerabilities (OWASP Top 10)
 * - Performance issues
 * - Code quality & best practices
 * - Bug detection
 * - Test coverage suggestions
 *
 * Uses AI-powered analysis.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';
import { agentChat } from '@/lib/ai/providers';
import { logger } from '@/lib/logger';

const log = logger('CodeAnalysisTool');

export const codeAnalysisTool: UnifiedTool = {
  name: 'analyze_code',
  description: `Analyze code for security vulnerabilities, performance issues, bugs, and best practices. Use this when:
- User shares code and asks for review
- User wants security audit of their code
- User asks about potential bugs or issues
- User wants performance optimization suggestions
- User asks for code quality feedback

Provides detailed analysis with specific line references and fix suggestions.`,
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The code to analyze',
      },
      language: {
        type: 'string',
        description: 'Programming language (auto-detected if not specified)',
      },
      focus: {
        type: 'string',
        enum: ['security', 'performance', 'quality', 'bugs', 'all'],
        description: 'What to focus the analysis on',
        default: 'all',
      },
    },
    required: ['code'],
  },
};

const ANALYSIS_PROMPT = `You are a senior software engineer performing a comprehensive code review.

Analyze the following code and provide:

1. **SECURITY ISSUES** (if focus includes security):
   - OWASP Top 10 vulnerabilities
   - Injection risks (SQL, XSS, command injection)
   - Authentication/authorization flaws
   - Secrets exposure
   - Input validation issues

2. **PERFORMANCE ISSUES** (if focus includes performance):
   - O(n²) or worse algorithms
   - Memory leaks
   - Unnecessary re-renders (React)
   - N+1 query problems
   - Missing caching opportunities

3. **CODE QUALITY** (if focus includes quality):
   - Best practice violations
   - Code smells
   - Maintainability issues
   - Missing error handling
   - Type safety issues

4. **BUG DETECTION** (if focus includes bugs):
   - Logic errors
   - Edge cases not handled
   - Race conditions
   - Null/undefined risks

For each issue found:
- Severity: critical/high/medium/low
- Line number (if identifiable)
- Explanation of the problem
- Specific code fix suggestion

Format as JSON:
{
  "language": "detected language",
  "summary": "brief overall assessment",
  "score": 0-100,
  "issues": [
    {
      "severity": "high",
      "category": "security",
      "title": "SQL Injection Risk",
      "line": 15,
      "description": "User input directly concatenated into SQL query",
      "fix": "Use parameterized queries",
      "fixedCode": "db.query('SELECT * FROM users WHERE id = ?', [userId])"
    }
  ],
  "recommendations": ["list of general recommendations"]
}`;

export async function executeCodeAnalysis(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { code, language, focus = 'all' } = args;

    if (!code || code.trim().length === 0) {
      return { toolCallId: id, content: 'No code provided for analysis', isError: true };
    }

    // Truncate very long code
    const truncatedCode = code.length > 50000 ? code.substring(0, 50000) + '\n... (truncated)' : code;

    const prompt = `${ANALYSIS_PROMPT}

FOCUS: ${focus}
${language ? `LANGUAGE: ${language}` : '(auto-detect language)'}

CODE TO ANALYZE:
\`\`\`
${truncatedCode}
\`\`\`

Provide your analysis as JSON.`;

    const response = await agentChat(
      [{ role: 'user', content: prompt }],
      {
        provider: 'claude',
        maxTokens: 4096,
        temperature: 0.1, // Low temperature for consistent analysis
      }
    );

    // Extract JSON from response
    let analysis;
    try {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        analysis = { rawAnalysis: response.text };
      }
    } catch {
      analysis = { rawAnalysis: response.text };
    }

    return {
      toolCallId: id,
      content: JSON.stringify(analysis, null, 2),
    };
  } catch (error) {
    log.error('Code analysis error', { error: (error as Error).message });
    return { toolCallId: id, content: `Analysis error: ${(error as Error).message}`, isError: true };
  }
}

export function isCodeAnalysisAvailable(): boolean {
  return true;
}
