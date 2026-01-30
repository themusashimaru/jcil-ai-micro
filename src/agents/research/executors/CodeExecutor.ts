/**
 * CODE EXECUTOR FOR RESEARCH AGENT
 *
 * Executes Python/JavaScript code in E2B sandbox for research.
 * Enables the Research Agent to perform calculations, data analysis,
 * and verify information through code execution.
 *
 * Key Features:
 * - Python execution (pandas, numpy, requests pre-installed)
 * - JavaScript execution (Node.js)
 * - Data processing and analysis
 * - Code verification and testing
 * - Safety rails from main chat tools
 */

import { GeneratedQuery, SearchResult } from '../../core/types';
import { logger } from '@/lib/logger';

const log = logger('CodeExecutor');

// Track E2B availability (lazy import)
let e2bAvailable: boolean | null = null;
let Sandbox: typeof import('@e2b/code-interpreter').Sandbox | null = null;

// Sandbox management
let sharedSandbox: InstanceType<typeof import('@e2b/code-interpreter').Sandbox> | null = null;
let sandboxLastUsed = 0;
const SANDBOX_TIMEOUT_MS = 300000; // 5 minutes
const SANDBOX_IDLE_CLEANUP_MS = 120000; // 2 min idle cleanup
const CODE_TIMEOUT_MS = 30000; // 30 seconds per execution
const MAX_CODE_LENGTH = 50000;
const MAX_OUTPUT_LENGTH = 100000;

// Code execution input
export interface CodeInput {
  code: string;
  language: 'python' | 'javascript';
  query?: GeneratedQuery;
  purpose?: string;
}

// Code execution result
export interface CodeExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime?: number;
}

export class CodeExecutor {
  /**
   * Initialize E2B
   */
  private async initE2B(): Promise<boolean> {
    if (e2bAvailable !== null) {
      return e2bAvailable;
    }

    try {
      if (!process.env.E2B_API_KEY) {
        log.warn('E2B_API_KEY not configured - code execution disabled');
        e2bAvailable = false;
        return false;
      }

      const e2bModule = await import('@e2b/code-interpreter');
      Sandbox = e2bModule.Sandbox;
      e2bAvailable = true;
      log.info('E2B code execution available for Research Agent');
      return true;
    } catch (error) {
      log.error('Failed to initialize E2B', { error: (error as Error).message });
      e2bAvailable = false;
      return false;
    }
  }

  /**
   * Get or create shared sandbox
   */
  private async getSandbox(): Promise<
    InstanceType<typeof import('@e2b/code-interpreter').Sandbox>
  > {
    if (!Sandbox) {
      throw new Error('E2B not initialized');
    }

    const now = Date.now();

    // Clean up idle sandbox
    if (sharedSandbox && now - sandboxLastUsed > SANDBOX_IDLE_CLEANUP_MS) {
      try {
        await sharedSandbox.kill();
      } catch {
        // Ignore cleanup errors
      }
      sharedSandbox = null;
    }

    // Create new sandbox if needed
    if (!sharedSandbox) {
      log.info('Creating new E2B sandbox for Research Agent');
      sharedSandbox = await Sandbox.create({
        timeoutMs: SANDBOX_TIMEOUT_MS,
      });

      // Pre-install common packages
      sharedSandbox.commands
        .run('pip install pandas numpy requests beautifulsoup4 lxml matplotlib', {
          timeoutMs: 180000,
        })
        .catch((err) => {
          log.warn('Package installation failed (non-fatal)', { error: (err as Error).message });
        });

      log.info('Research Agent sandbox ready');
    }

    sandboxLastUsed = now;
    return sharedSandbox;
  }

  /**
   * Check if code execution is available
   */
  async isAvailable(): Promise<boolean> {
    return this.initE2B();
  }

  /**
   * Determine if a query should use code execution
   */
  shouldUseCode(query: GeneratedQuery): boolean {
    const lower = query.query.toLowerCase();

    // Patterns that suggest code execution is needed
    const codePatterns = [
      /calculate/i,
      /compute/i,
      /analyze.*data/i,
      /process.*numbers/i,
      /statistical/i,
      /average|mean|median|sum/i,
      /parse.*json/i,
      /convert.*format/i,
      /sort.*data/i,
      /filter.*results/i,
      /aggregate/i,
      /validate.*code/i,
      /test.*function/i,
      /run.*script/i,
      /benchmark/i,
      /compare.*values/i,
    ];

    return codePatterns.some((p) => p.test(lower));
  }

  /**
   * Validate code for safety
   */
  private validateCode(code: string, language: string): { valid: boolean; error?: string } {
    if (code.length > MAX_CODE_LENGTH) {
      return { valid: false, error: `Code too long (${code.length} > ${MAX_CODE_LENGTH} chars)` };
    }

    if (!code.trim()) {
      return { valid: false, error: 'Code cannot be empty' };
    }

    // Dangerous patterns
    const dangerousPatterns = [
      /os\.system\s*\(/i,
      /subprocess\.(run|call|Popen)\s*\(/i,
      /os\.remove/i,
      /os\.unlink/i,
      /shutil\.rmtree/i,
      /socket\.bind/i,
      /\.listen\s*\(/i,
      /stratum\+tcp/i,
      /cryptonight/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return { valid: false, error: 'Code contains restricted patterns' };
      }
    }

    // Language-specific checks
    if (language === 'python') {
      const dangerousImports = [/import\s+ctypes/i, /from\s+ctypes/i];
      for (const pattern of dangerousImports) {
        if (pattern.test(code)) {
          return { valid: false, error: 'Code imports restricted modules' };
        }
      }
    }

    if (language === 'javascript') {
      const jsPatterns = [
        /require\s*\(\s*['"]child_process['"]\s*\)/i,
        /process\.exit/i,
        /process\.kill/i,
      ];
      for (const pattern of jsPatterns) {
        if (pattern.test(code)) {
          return { valid: false, error: 'Code contains restricted Node.js patterns' };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Execute code in sandbox
   */
  async execute(input: CodeInput): Promise<SearchResult> {
    const startTime = Date.now();

    try {
      if (!(await this.isAvailable())) {
        return this.createErrorResult(
          input.query,
          'Code execution not available (E2B not configured)'
        );
      }

      // Validate code
      const validation = this.validateCode(input.code, input.language);
      if (!validation.valid) {
        return this.createErrorResult(input.query, `Code validation failed: ${validation.error}`);
      }

      log.info('Executing code for research', {
        language: input.language,
        codeLength: input.code.length,
        purpose: input.purpose,
      });

      const sandbox = await this.getSandbox();
      const result = await this.executeInSandbox(sandbox, input.code, input.language);
      const executionTime = Date.now() - startTime;

      if (!result.success) {
        return {
          id: `code_error_${Date.now()}`,
          query: input.query?.query || 'Code execution',
          source: 'brave',
          content: `Code execution failed:\n\`\`\`\n${result.error}\n\`\`\`${result.output ? `\n\nPartial output:\n\`\`\`\n${result.output}\n\`\`\`` : ''}`,
          timestamp: Date.now(),
          relevanceScore: 0.3, // Still some value in error output
          metadata: {
            executionTime,
            hasRichData: false,
          },
        };
      }

      return {
        id: `code_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        query: input.query?.query || 'Code execution',
        source: 'brave',
        content: this.formatCodeResult(input, result.output || '(No output)'),
        title: `Code Execution: ${input.language} (${input.purpose || 'research'})`,
        timestamp: Date.now(),
        relevanceScore: 0.9, // Code results are highly reliable
        metadata: {
          executionTime,
          hasRichData: true,
          richDataType: `code_${input.language}`,
        },
      };
    } catch (error) {
      log.error('Code execution failed', { error: (error as Error).message });
      return this.createErrorResult(input.query, `Code error: ${(error as Error).message}`);
    }
  }

  /**
   * Execute code in sandbox
   */
  private async executeInSandbox(
    sandbox: InstanceType<typeof import('@e2b/code-interpreter').Sandbox>,
    code: string,
    language: 'python' | 'javascript'
  ): Promise<CodeExecutionResult> {
    const startTime = Date.now();

    try {
      if (language === 'python') {
        const result = await sandbox.runCode(code);

        const stdout = result.logs.stdout.join('\n');
        const stderrOutput = result.logs.stderr.join('\n');

        if (result.error) {
          return {
            success: false,
            output: stdout || stderrOutput,
            error: `${result.error.name}: ${result.error.value}`,
            executionTime: Date.now() - startTime,
          };
        }

        let output = '';
        if (stdout) output += stdout;
        if (result.results && result.results.length > 0) {
          const resultText = result.results
            .map((r) => r.text || (r.data ? JSON.stringify(r.data) : ''))
            .filter(Boolean)
            .join('\n');
          if (resultText) {
            output += (output ? '\n' : '') + resultText;
          }
        }

        return {
          success: true,
          output: output.slice(0, MAX_OUTPUT_LENGTH) || '(No output)',
          executionTime: Date.now() - startTime,
        };
      } else {
        // JavaScript via Node
        const tempFile = `/tmp/research_code_${Date.now()}.js`;

        await sandbox.files.write(tempFile, code);

        const result = await sandbox.commands.run(`node ${tempFile}`, {
          timeoutMs: CODE_TIMEOUT_MS,
        });

        // Clean up
        await sandbox.files.remove(tempFile).catch(() => {});

        const output = result.stdout || result.stderr;

        return {
          success: result.exitCode === 0,
          output: output.slice(0, MAX_OUTPUT_LENGTH) || '(No output)',
          error:
            result.exitCode !== 0 ? `Exit code: ${result.exitCode}\n${result.stderr}` : undefined,
          executionTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute multiple code snippets
   */
  async executeMany(inputs: CodeInput[]): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];

      // Brief delay between executions
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      const result = await this.execute(input);
      results.push(result);
    }

    return results;
  }

  /**
   * Generate code for a research query
   * Uses AI to generate appropriate code for data analysis
   */
  async generateAndExecute(query: GeneratedQuery, _dataContext?: string): Promise<SearchResult> {
    // For now, we don't auto-generate code
    // This method could be enhanced to use AI to generate appropriate code
    return this.createErrorResult(
      query,
      'Code generation requires explicit code input. Use execute() with specific code.'
    );
  }

  /**
   * Format code execution result for research output
   */
  private formatCodeResult(input: CodeInput, output: string): string {
    const parts: string[] = [];

    parts.push(`## Code Execution Result`);
    parts.push(`**Language:** ${input.language}`);

    if (input.purpose) {
      parts.push(`**Purpose:** ${input.purpose}`);
    }

    parts.push('\n**Output:**');
    parts.push('```');
    parts.push(output);
    parts.push('```');

    return parts.join('\n');
  }

  /**
   * Create error result
   */
  private createErrorResult(query: GeneratedQuery | undefined, error: string): SearchResult {
    return {
      id: `code_error_${Date.now()}`,
      query: query?.query || 'Code execution',
      source: 'brave',
      content: error,
      timestamp: Date.now(),
      relevanceScore: 0,
    };
  }

  /**
   * Cleanup sandbox
   */
  async cleanup(): Promise<void> {
    if (sharedSandbox) {
      try {
        await sharedSandbox.kill();
        sharedSandbox = null;
        log.info('Research Agent code sandbox cleaned up');
      } catch (error) {
        log.warn('Error cleaning up sandbox', { error: (error as Error).message });
      }
    }
  }
}

// Singleton instance
export const codeExecutor = new CodeExecutor();
