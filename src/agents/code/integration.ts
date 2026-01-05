/**
 * CODE AGENT INTEGRATION
 *
 * Connects the Code Agent to the chat route.
 * Provides streaming output compatible with Next.js Response.
 */

import { codeAgent, CodeAgentInput } from './CodeAgent';
import { codeIntentAnalyzer } from './brain/IntentAnalyzer';
import { sandboxExecutor } from './executors/SandboxExecutor';
import { githubExecutor } from './executors/GitHubExecutor';
import { AgentContext, AgentStreamEvent, CodeAgentOutput, GeneratedFile } from '../core/types';

/**
 * Check if a request should use the Code Agent
 */
export function shouldUseCodeAgent(request: string): boolean {
  return codeIntentAnalyzer.constructor.prototype.constructor.isCodeRequest
    ? (codeIntentAnalyzer.constructor as typeof import('./brain/IntentAnalyzer').CodeIntentAnalyzer).isCodeRequest(request)
    : isCodeRequest(request);
}

/**
 * Fallback code request detection
 */
function isCodeRequest(message: string): boolean {
  const lower = message.toLowerCase();

  // Strong coding indicators
  const codePatterns = [
    /\b(build|create|make|develop|code|implement|write)\b.*\b(app|api|website|script|tool|bot|server|cli|function|class|component|project)/i,
    /\b(can you|please|help me)\b.*\b(build|create|code|develop|make)/i,
    /\b(generate|scaffold|bootstrap)\b.*\b(project|app|code)/i,
    /\b(fix|debug|refactor|optimize)\b.*\b(code|function|bug|error)/i,
    /\b(add|implement)\b.*\b(feature|functionality|endpoint)/i,
    /\bpush.*(to|github)/i,
    /\bgithub\b.*\b(repo|repository|push|create)/i,
  ];

  if (codePatterns.some(p => p.test(message))) {
    return true;
  }

  // Keyword density check
  const codeKeywords = [
    'code', 'build', 'create', 'app', 'api', 'function', 'class',
    'typescript', 'javascript', 'python', 'react', 'node', 'express',
    'github', 'npm', 'package', 'deploy', 'database', 'endpoint',
    'project', 'scaffold', 'generate', 'implement'
  ];

  const matchCount = codeKeywords.filter(k => lower.includes(k)).length;
  return matchCount >= 2;
}

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
  } = {}
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        // Initialize executors
        if (options.oidcToken) {
          sandboxExecutor.initialize(options.oidcToken);
        }

        if (options.githubToken) {
          await githubExecutor.initialize(options.githubToken);
        }

        // Build context
        const context: AgentContext = {
          userId: options.userId || 'anonymous',
          conversationId: options.conversationId,
          previousMessages: options.previousMessages,
        };

        // Build input
        const input: CodeAgentInput = {
          request,
          options: {
            pushToGitHub: options.pushToGitHub,
            repoName: options.repoName,
            privateRepo: options.privateRepo,
          },
        };

        // Stream professional header
        controller.enqueue(encoder.encode(`# Code Agent\n\n`));
        controller.enqueue(encoder.encode(`**Request:** ${request.substring(0, 150)}${request.length > 150 ? '...' : ''}\n\n`));
        controller.enqueue(encoder.encode(`---\n\n`));
        controller.enqueue(encoder.encode(`### Building Pipeline\n\n`));

        // Execute with streaming progress
        const result = await codeAgent.execute(
          input,
          context,
          (event: AgentStreamEvent) => {
            const progressLine = formatProgressEvent(event);
            if (progressLine) {
              controller.enqueue(encoder.encode(progressLine));
            }
          }
        );

        if (result.success && result.data) {
          // Stream the final report
          controller.enqueue(encoder.encode('\n---\n\n'));
          const markdown = formatCodeOutput(result.data);
          controller.enqueue(encoder.encode(markdown));
        } else {
          controller.enqueue(encoder.encode(`\n\n**Build Failed**\n\n${result.error || 'Unknown error'}\n`));
        }

        controller.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[CodeAgent Integration] Error:', errorMessage);
        controller.enqueue(encoder.encode(`\n\n**Error**\n\n${errorMessage}\n`));
        controller.close();
      }
    },
  });
}

/**
 * Format a progress event for streaming output
 */
function formatProgressEvent(event: AgentStreamEvent): string {
  const typeConfig: Record<string, { icon: string; prefix: string }> = {
    thinking: { icon: '◉', prefix: 'ANALYZING' },
    searching: { icon: '◎', prefix: 'GENERATING' },
    evaluating: { icon: '◈', prefix: 'TESTING' },
    pivoting: { icon: '◇', prefix: 'FIXING' },
    synthesizing: { icon: '◆', prefix: 'DELIVERING' },
    complete: { icon: '●', prefix: 'COMPLETE' },
    error: { icon: '✕', prefix: 'ERROR' },
  };

  const config = typeConfig[event.type] || { icon: '○', prefix: 'PROCESSING' };

  // Skip heartbeat messages
  const details = event.details as Record<string, unknown> | undefined;
  if (details?.heartbeat) {
    return '';
  }

  // Progress bar
  let progressBar = '';
  if (event.progress !== undefined && event.progress > 0) {
    const filled = Math.round(event.progress / 10);
    progressBar = ` [\u2588${'\u2588'.repeat(filled)}${'\u2591'.repeat(10 - filled)}]`;
  }

  return `${config.icon} **${config.prefix}**${progressBar} ${event.message}\n`;
}

/**
 * Format the final code output as markdown
 */
function formatCodeOutput(output: CodeAgentOutput): string {
  let md = '';

  // Build status
  const statusIcon = output.buildResult.success ? '●' : '○';
  const statusText = output.buildResult.success ? 'BUILD SUCCESSFUL' : 'BUILD NEEDS ATTENTION';

  md += `### ${statusIcon} ${statusText}\n\n`;

  // Summary
  md += `## Project Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| Project | **${output.projectName}** |\n`;
  md += `| Files | ${output.summary.totalFiles} |\n`;
  md += `| Lines of Code | ${output.summary.totalLines} |\n`;
  md += `| Architecture | ${output.summary.architecture} |\n`;
  md += `| Technologies | ${output.summary.technologies.join(', ')} |\n`;
  md += `| Execution Time | ${(output.metadata.executionTime / 1000).toFixed(1)}s |\n`;
  md += `\n`;

  // GitHub status
  if (output.github) {
    if (output.github.pushed && output.github.repoUrl) {
      md += `## GitHub Repository\n\n`;
      md += `**Repository:** [${output.github.repoUrl}](${output.github.repoUrl})\n\n`;
    } else if (output.github.error) {
      md += `## GitHub\n\n`;
      md += `> ⚠️ ${output.github.error}\n\n`;
    }
  }

  // File listing
  md += `## Generated Files\n\n`;
  output.files.forEach(file => {
    md += `<details>\n`;
    md += `<summary><code>${file.path}</code> (${file.linesOfCode} lines)</summary>\n\n`;
    md += `\`\`\`${file.language}\n`;
    md += file.content;
    md += `\n\`\`\`\n`;
    md += `</details>\n\n`;
  });

  // Build output if there are errors
  if (!output.buildResult.success && output.buildResult.errors.length > 0) {
    md += `## Build Issues\n\n`;
    output.buildResult.errors.forEach(error => {
      md += `- **${error.file}**: ${error.message}\n`;
    });
    md += `\n`;
  }

  // Next steps
  md += `## Next Steps\n\n`;
  output.nextSteps.forEach((step, i) => {
    md += `${i + 1}. ${step}\n`;
  });
  md += `\n`;

  // Metadata footer
  md += `---\n\n`;
  md += `**Metadata**\n`;
  md += `- Iterations: ${output.metadata.totalIterations}\n`;
  md += `- Errors Fixed: ${output.metadata.errorsFixed}\n`;
  md += `- Confidence: ${(output.metadata.confidenceScore * 100).toFixed(0)}%\n`;

  return md;
}

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
  // Initialize executors
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
