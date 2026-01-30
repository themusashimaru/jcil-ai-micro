/**
 * CODE AGENT INTEGRATION
 *
 * Connects the Code Agent to the chat route.
 * Provides streaming output compatible with Next.js Response.
 *
 * Handles:
 * - Code GENERATION (building new projects)
 * - Code REVIEW detection (redirects to proper flow)
 */

import { codeAgent, CodeAgentInput } from './CodeAgent';
import { codeIntentAnalyzer, ClarificationResult } from './brain/IntentAnalyzer';
import { sandboxExecutor } from './executors/SandboxExecutor';
import { githubExecutor } from './executors/GitHubExecutor';
import { logger } from '@/lib/logger';

const log = logger('CodeAgentIntegration');
import { AgentContext, AgentStreamEvent, CodeAgentOutput, GeneratedFile } from '../core/types';

// ============================================================================
// REQUEST TYPE DETECTION
// ============================================================================

/**
 * Detect if request is for CODE REVIEW (needs existing repo)
 */
export function isCodeReviewRequest(message: string): boolean {
  const reviewPatterns = [
    /\b(review|inspect|analyze|check|look at|examine)\b.*\b(my |the |this )?(code|repo|repository|codebase|project)/i,
    /\b(take a look|have a look)\b.*\b(at|my|the)/i,
    /\b(what.*(wrong|issue|problem|bug))\b.*\b(with|in)\b.*\b(code|repo|my)/i,
    /\b(find|identify|spot)\b.*\b(bug|issue|problem|error)/i,
    /\b(code|security|performance)\s*(audit|review|analysis)/i,
    /\b(pr|pull request)\s*(review)/i,
    /\bcan you\b.*\b(review|check|look)/i,
  ];

  return reviewPatterns.some((p) => p.test(message));
}

/**
 * Check if a request should use the Code Agent (GENERATION only)
 * Code review requests need a selected repo and use different flow
 */
export function shouldUseCodeAgent(request: string): boolean {
  // If it's a code REVIEW request, don't use Code Agent
  // (Code review uses the GitHub tools flow instead)
  if (isCodeReviewRequest(request)) {
    return false;
  }

  return codeIntentAnalyzer.constructor.prototype.constructor.isCodeRequest
    ? (
        codeIntentAnalyzer.constructor as typeof import('./brain/IntentAnalyzer').CodeIntentAnalyzer
      ).isCodeRequest(request)
    : isCodeRequest(request);
}

/**
 * Fallback code request detection (GENERATION patterns only)
 */
function isCodeRequest(message: string): boolean {
  const lower = message.toLowerCase();

  // Strong code GENERATION indicators
  const codePatterns = [
    /\b(build|create|make|develop|code|implement|write)\b.*\b(app|api|website|script|tool|bot|server|cli|function|class|component|project)/i,
    /\b(can you|please|help me)\b.*\b(build|create|code|develop|make)/i,
    /\b(generate|scaffold|bootstrap)\b.*\b(project|app|code)/i,
    /\b(add|implement)\b.*\b(feature|functionality|endpoint)/i,
    /\bpush.*(to|github)/i,
    /\bgithub\b.*\b(repo|repository|push|create)/i,
    /\b(start|init|initialize)\b.*\b(new|a)\b.*\b(project|app|repo)/i,
  ];

  if (codePatterns.some((p) => p.test(message))) {
    return true;
  }

  // Keyword density check for generation
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
    'npm',
    'package',
    'deploy',
    'database',
    'endpoint',
    'project',
    'scaffold',
    'generate',
    'implement',
  ];

  const matchCount = codeKeywords.filter((k) => lower.includes(k)).length;
  return matchCount >= 2;
}

// ============================================================================
// PROFESSIONAL NO-REPO RESPONSE
// ============================================================================

/**
 * Generate professional response when user asks for code review but no repo selected
 */
export function generateNoRepoSelectedResponse(): string {
  return `\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│                     CODE REVIEW REQUEST                         │
├─────────────────────────────────────────────────────────────────┤
│  ⚠  No Repository Selected                                     │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

## To review your code, I need access to a repository

### Quick Setup (2 steps):

**Step 1: Connect GitHub** (if not already connected)
\`\`\`
Settings → Connectors → Connect GitHub → Authorize
\`\`\`

**Step 2: Select a Repository**
\`\`\`
Click the GitHub icon (🐙) in the chat header → Select your repo
\`\`\`

---

### What I can do once connected:

| Capability | Description |
|------------|-------------|
| \`Code Review\` | Analyze architecture, find bugs, security issues |
| \`Performance Audit\` | Identify bottlenecks, optimization opportunities |
| \`Security Scan\` | Check for OWASP Top 10 vulnerabilities |
| \`Best Practices\` | Verify framework conventions, patterns |
| \`Refactoring\` | Suggest improvements, clean code |
| \`Documentation\` | Generate docs, explain complex code |

---

**Or, if you want me to BUILD something new:**
> Just say "Build me a [project type]" and I'll generate a complete project from scratch!
`;
}

// ============================================================================
// PROACTIVE CLARIFICATION (Senior Engineer Behavior)
// ============================================================================

/**
 * Check if request should trigger clarification questions
 * Skip if user explicitly says "just build", "proceed", etc.
 */
function shouldSkipClarification(request: string): boolean {
  const skipPatterns = [
    /\b(just\s+)?(build|do|make|create)\s*(it|this|that)?\b/i,
    /\bproceed\b/i,
    /\bgo\s*(ahead|for\s*it)\b/i,
    /\bdon'?t\s*ask\b/i,
    /\b(use\s+)?default(s)?\b/i,
    /\byour?\s*(choice|pick|decision)\b/i,
  ];
  return skipPatterns.some((p) => p.test(request));
}

/**
 * Format professional clarification response (like a senior engineer asking smart questions)
 */
function formatClarificationResponse(result: ClarificationResult, request: string): string {
  const truncatedRequest = request.length > 60 ? request.substring(0, 57) + '...' : request;

  let md = `\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│                   JCIL CODE AGENT                               │
│              Before I build, a few questions...                 │
├─────────────────────────────────────────────────────────────────┤
│  Request: ${truncatedRequest.padEnd(52)}│
│  Clarity: ${('█'.repeat(Math.round(result.clarityScore / 5)) + '░'.repeat(20 - Math.round(result.clarityScore / 5))).padEnd(52)}│
└─────────────────────────────────────────────────────────────────┘
\`\`\`

`;

  // Questions section
  if (result.questions.length > 0) {
    md += `## Quick Questions\n\n`;
    md += `> As a senior engineer, I want to make sure I build exactly what you need.\n\n`;

    result.questions.forEach((q, i) => {
      const priority = q.priority === 'critical' ? '**' : '';
      md += `### ${i + 1}. ${priority}${q.question}${priority}\n`;
      md += `*${q.reason}*\n\n`;

      if (q.options && q.options.length > 0) {
        md += `| Options |\n`;
        md += `|---------|\n`;
        q.options.forEach((opt) => {
          md += `| \`${opt}\` |\n`;
        });
        md += `\n`;
      }
    });
  }

  // Assumptions section
  if (result.assumptions.length > 0) {
    md += `## If you want me to proceed anyway, I'll assume:\n\n`;
    result.assumptions.forEach((assumption) => {
      md += `- ${assumption}\n`;
    });
    md += `\n`;
  }

  // Potential issues
  if (result.potentialIssues.length > 0) {
    md += `## Heads up (potential issues):\n\n`;
    result.potentialIssues.forEach((issue) => {
      md += `- ⚠️ ${issue}\n`;
    });
    md += `\n`;
  }

  // Suggestions
  if (result.suggestions.length > 0) {
    md += `## My suggestions:\n\n`;
    result.suggestions.forEach((suggestion) => {
      md += `- 💡 ${suggestion}\n`;
    });
    md += `\n`;
  }

  // Call to action
  md += `---\n\n`;
  md += `**Reply with:**\n`;
  md += `- Answers to my questions, OR\n`;
  md += `- \`"Just build it"\` to proceed with my assumptions\n`;

  return md;
}

// ============================================================================
// EXECUTION
// ============================================================================

/**
 * Execute the Code Agent and return a streaming response
 */
export async function executeCodeAgent(
  request: string,
  options: {
    userId?: string;
    conversationId?: string;
    previousMessages?: Array<{ role: string; content: string }>;
    pushToGitHub?: boolean;
    repoName?: string;
    privateRepo?: boolean;
    githubToken?: string;
    oidcToken?: string;
    selectedRepo?: { owner: string; repo: string; fullName: string };
    skipClarification?: boolean; // Allow bypassing clarification
  } = {}
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        // Check if this is a review request without a selected repo
        if (isCodeReviewRequest(request) && !options.selectedRepo) {
          const response = generateNoRepoSelectedResponse();
          controller.enqueue(encoder.encode(response));
          controller.close();
          return;
        }

        // Build context early for clarification check
        const context: AgentContext = {
          userId: options.userId || 'anonymous',
          conversationId: options.conversationId,
          previousMessages: options.previousMessages,
        };

        // ========================================
        // PROACTIVE SENIOR ENGINEER BEHAVIOR
        // Check if we should ask clarifying questions first
        // ========================================
        if (!options.skipClarification && !shouldSkipClarification(request)) {
          const clarification = await codeIntentAnalyzer.checkClarification(request, context);

          if (clarification.needsClarification && clarification.questions.length > 0) {
            // Stream clarification questions instead of building
            const clarificationResponse = formatClarificationResponse(clarification, request);
            controller.enqueue(encoder.encode(clarificationResponse));
            controller.close();
            return;
          }
        }

        // Initialize executors
        if (options.oidcToken) {
          sandboxExecutor.initialize(options.oidcToken);
        }

        if (options.githubToken) {
          await githubExecutor.initialize(options.githubToken);
        }

        // Build input
        const input: CodeAgentInput = {
          request,
          options: {
            pushToGitHub: options.pushToGitHub,
            repoName: options.repoName,
            privateRepo: options.privateRepo,
          },
        };

        // Stream professional header (terminal-style)
        controller.enqueue(encoder.encode(formatHeader(request)));

        // Execute with streaming progress
        const result = await codeAgent.execute(input, context, (event: AgentStreamEvent) => {
          const progressLine = formatProgressEvent(event);
          if (progressLine) {
            controller.enqueue(encoder.encode(progressLine));
          }
        });

        if (result.success && result.data) {
          // Stream the final report
          controller.enqueue(encoder.encode('\n'));
          const markdown = formatCodeOutput(result.data);
          controller.enqueue(encoder.encode(markdown));
        } else {
          controller.enqueue(encoder.encode(formatError(result.error || 'Unknown error')));
        }

        controller.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        log.error('Code agent execution error', { error: errorMessage });
        controller.enqueue(encoder.encode(formatError(errorMessage)));
        controller.close();
      }
    },
  });
}

// ============================================================================
// PROFESSIONAL FORMATTING (Terminal-Style like Claude Code)
// ============================================================================

/**
 * Format professional header
 */
function formatHeader(request: string): string {
  const truncatedRequest = request.length > 80 ? request.substring(0, 77) + '...' : request;

  return `\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│                      JCIL CODE AGENT                            │
│                   Autonomous Code Generation                    │
├─────────────────────────────────────────────────────────────────┤
│  Request: ${truncatedRequest.padEnd(52)}│
└─────────────────────────────────────────────────────────────────┘
\`\`\`

### Execution Pipeline

`;
}

/**
 * Format a progress event for streaming output (terminal-style)
 */
function formatProgressEvent(event: AgentStreamEvent): string {
  // Skip heartbeat messages
  const details = event.details as Record<string, unknown> | undefined;
  if (details?.heartbeat) {
    return '';
  }

  const typeConfig: Record<string, { icon: string; color: string }> = {
    thinking: { icon: '◉', color: 'ANALYZE' },
    searching: { icon: '◎', color: 'GENERATE' },
    evaluating: { icon: '◈', color: 'TEST' },
    pivoting: { icon: '◇', color: 'FIX' },
    synthesizing: { icon: '◆', color: 'BUILD' },
    complete: { icon: '●', color: 'DONE' },
    error: { icon: '✕', color: 'ERROR' },
  };

  const config = typeConfig[event.type] || { icon: '○', color: 'PROC' };

  // Progress bar (terminal-style)
  let progressBar = '';
  if (event.progress !== undefined && event.progress > 0) {
    const width = 20;
    const filled = Math.round((event.progress / 100) * width);
    const empty = width - filled;
    const percentage = event.progress.toString().padStart(3);
    progressBar = ` \`[${'\u2588'.repeat(filled)}${'\u2591'.repeat(empty)}]\` ${percentage}%`;
  }

  return `\`${config.icon}\` **\`${config.color}\`**${progressBar} ${event.message}\n`;
}

/**
 * Format error output
 */
function formatError(error: string): string {
  return `
\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│  ✕  BUILD FAILED                                                │
├─────────────────────────────────────────────────────────────────┤
│  ${error.substring(0, 60).padEnd(60)} │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

**Error Details:**
\`\`\`
${error}
\`\`\`

**Troubleshooting:**
1. Check your request for clarity
2. Try simplifying the project scope
3. Specify technologies explicitly (e.g., "using TypeScript and Express")
`;
}

/**
 * Format the final code output as professional markdown
 */
function formatCodeOutput(output: CodeAgentOutput): string {
  let md = '';

  // Build status (terminal-style box)
  const statusIcon = output.buildResult.success ? '●' : '○';
  const statusText = output.buildResult.success ? 'BUILD SUCCESSFUL' : 'BUILD NEEDS ATTENTION';

  md += `\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│  ${statusIcon}  ${statusText.padEnd(58)} │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

`;

  // Summary table
  md += `## Project: \`${output.projectName}\`\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| \`Files\` | ${output.summary.totalFiles} |\n`;
  md += `| \`Lines of Code\` | ${output.summary.totalLines.toLocaleString()} |\n`;
  md += `| \`Architecture\` | ${output.summary.architecture} |\n`;
  md += `| \`Stack\` | ${output.summary.technologies.slice(0, 3).join(', ')} |\n`;
  md += `| \`Build Time\` | ${(output.metadata.executionTime / 1000).toFixed(1)}s |\n`;
  md += `| \`Confidence\` | ${(output.metadata.confidenceScore * 100).toFixed(0)}% |\n`;
  md += `\n`;

  // GitHub status
  if (output.github) {
    if (output.github.pushed && output.github.repoUrl) {
      md += `## Repository\n\n`;
      md += `\`\`\`\n`;
      md += `git clone ${output.github.repoUrl}.git\n`;
      md += `cd ${output.projectName}\n`;
      md += `npm install\n`;
      md += `npm run dev\n`;
      md += `\`\`\`\n\n`;
      md += `**[Open on GitHub](${output.github.repoUrl})**\n\n`;
    } else if (output.github.error) {
      md += `> ⚠️ **GitHub:** ${output.github.error}\n\n`;
    }
  }

  // File tree (terminal-style)
  md += `## File Structure\n\n`;
  md += `\`\`\`\n`;
  md += `${output.projectName}/\n`;

  // Group files by directory
  const directories = new Map<string, string[]>();
  output.files.forEach((file) => {
    const parts = file.path.split('/');
    if (parts.length > 1) {
      const dir = parts.slice(0, -1).join('/');
      if (!directories.has(dir)) {
        directories.set(dir, []);
      }
      directories.get(dir)!.push(parts[parts.length - 1]);
    } else {
      if (!directories.has('.')) {
        directories.set('.', []);
      }
      directories.get('.')!.push(file.path);
    }
  });

  // Root files first
  const rootFiles = directories.get('.') || [];
  rootFiles.forEach((file, i) => {
    const isLast = i === rootFiles.length - 1 && directories.size === 1;
    md += `${isLast ? '└──' : '├──'} ${file}\n`;
  });

  // Then directories
  const dirEntries = Array.from(directories.entries()).filter(([k]) => k !== '.');
  dirEntries.forEach(([dir, files], dirIndex) => {
    const isLastDir = dirIndex === dirEntries.length - 1;
    md += `${isLastDir ? '└──' : '├──'} ${dir}/\n`;
    files.forEach((file, fileIndex) => {
      const isLastFile = fileIndex === files.length - 1;
      const prefix = isLastDir ? '    ' : '│   ';
      md += `${prefix}${isLastFile ? '└──' : '├──'} ${file}\n`;
    });
  });

  md += `\`\`\`\n\n`;

  // Generated files (collapsible)
  md += `## Source Code\n\n`;
  output.files.forEach((file) => {
    md += `<details>\n`;
    md += `<summary><code>${file.path}</code> <small>(${file.linesOfCode} lines)</small></summary>\n\n`;
    md += `\`\`\`${file.language}\n`;
    md += file.content;
    if (!file.content.endsWith('\n')) md += '\n';
    md += `\`\`\`\n`;
    md += `</details>\n\n`;
  });

  // Build issues
  if (!output.buildResult.success && output.buildResult.errors.length > 0) {
    md += `## Build Issues\n\n`;
    md += `\`\`\`\n`;
    output.buildResult.errors.slice(0, 5).forEach((error) => {
      md += `[${error.type.toUpperCase()}] ${error.file}${error.line ? `:${error.line}` : ''}\n`;
      md += `  └─ ${error.message}\n`;
    });
    md += `\`\`\`\n\n`;
  }

  // Next steps
  md += `## Next Steps\n\n`;
  output.nextSteps.forEach((step, i) => {
    md += `${i + 1}. ${step}\n`;
  });
  md += `\n`;

  // Footer
  md += `---\n\n`;
  md += `\`Iterations: ${output.metadata.totalIterations}\` · `;
  md += `\`Errors Fixed: ${output.metadata.errorsFixed}\` · `;
  md += `\`Powered by Claude Opus 4.5\`\n`;

  return md;
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

/**
 * Get just the files without streaming (for API use)
 */
export async function generateCodeFiles(
  request: string,
  options: {
    userId?: string;
    previousMessages?: Array<{ role: string; content: string }>;
    oidcToken?: string;
    githubToken?: string;
  } = {}
): Promise<GeneratedFile[]> {
  if (options.oidcToken) {
    sandboxExecutor.initialize(options.oidcToken);
  }

  if (options.githubToken) {
    await githubExecutor.initialize(options.githubToken);
  }

  const context: AgentContext = {
    userId: options.userId || 'anonymous',
    previousMessages: options.previousMessages,
  };

  const input: CodeAgentInput = {
    request,
    options: { pushToGitHub: false },
  };

  const result = await codeAgent.execute(input, context, () => {});

  if (result.success && result.data) {
    return result.data.files;
  }

  throw new Error(result.error || 'Code generation failed');
}

/**
 * Feature flag for Code Agent
 */
export function isCodeAgentEnabled(): boolean {
  return process.env.DISABLE_CODE_AGENT !== 'true';
}
