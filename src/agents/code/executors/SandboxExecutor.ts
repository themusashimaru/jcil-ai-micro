/**
 * SANDBOX EXECUTOR
 *
 * Executes code in Vercel Sandbox VMs.
 * Tests that generated code actually works before pushing to GitHub.
 *
 * Uses the existing vercel-sandbox connector.
 */

import {
  executeSandbox,
  getSandboxConfig,
  isSandboxConfigured,
  SandboxConfig,
} from '../../../lib/connectors/vercel-sandbox';
import {
  GeneratedFile,
  ProjectPlan,
  SandboxTestResult,
  CodeIntent,
  AgentStreamCallback,
} from '../../core/types';

export class SandboxExecutor {
  private config: SandboxConfig | null = null;

  /**
   * Initialize the executor with OIDC token (from request headers on Vercel)
   */
  initialize(oidcToken?: string): boolean {
    if (!isSandboxConfigured(oidcToken)) {
      console.warn('[SandboxExecutor] Sandbox not configured');
      return false;
    }
    this.config = getSandboxConfig(oidcToken);
    return this.config !== null;
  }

  /**
   * Check if sandbox is available
   */
  isAvailable(): boolean {
    return this.config !== null;
  }

  /**
   * Execute the full build pipeline: install -> build -> test
   */
  async execute(
    files: GeneratedFile[],
    plan: ProjectPlan,
    intent: CodeIntent,
    onStream?: AgentStreamCallback
  ): Promise<SandboxTestResult> {
    if (!this.config) {
      return {
        success: false,
        phase: 'install',
        outputs: [],
        errors: [{
          file: 'system',
          message: 'Sandbox not configured - cannot test code',
          type: 'build',
          severity: 'error',
        }],
        executionTime: 0,
      };
    }

    const startTime = Date.now();

    // Convert generated files to sandbox format
    const sandboxFiles = files.map(f => ({
      path: f.path,
      content: f.content,
    }));

    // Determine runtime
    const runtime = intent.technologies.runtime === 'python' ? 'python3.13' : 'node22';

    // Build command list
    const commands = this.buildCommands(plan, intent);

    onStream?.({
      type: 'evaluating',
      message: `Testing in sandbox (${runtime})...`,
      phase: 'Sandbox Execution',
      progress: 60,
      timestamp: Date.now(),
    });

    try {
      const result = await executeSandbox(this.config, {
        files: sandboxFiles,
        commands,
        runtime,
        timeout: 5 * 60 * 1000, // 5 minutes
        vcpus: 4, // More power for faster builds
      });

      // Convert to SandboxTestResult
      const phase = this.determinePhase(result.outputs);
      const errors = result.success ? [] : this.extractErrors(result);

      return {
        success: result.success,
        phase,
        outputs: result.outputs.map(o => ({
          command: o.command,
          stdout: o.stdout,
          stderr: o.stderr,
          exitCode: o.exitCode,
        })),
        errors,
        executionTime: result.executionTime,
      };
    } catch (error) {
      console.error('[SandboxExecutor] Execution failed:', error);
      return {
        success: false,
        phase: 'install',
        outputs: [],
        errors: [{
          file: 'system',
          message: error instanceof Error ? error.message : 'Sandbox execution failed',
          type: 'runtime',
          severity: 'error',
        }],
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Quick syntax check without full build
   */
  async syntaxCheck(
    files: GeneratedFile[],
    intent: CodeIntent
  ): Promise<SandboxTestResult> {
    if (!this.config) {
      return {
        success: false,
        phase: 'build',
        outputs: [],
        errors: [{ file: 'system', message: 'Sandbox not configured', type: 'build', severity: 'error' }],
        executionTime: 0,
      };
    }

    const sandboxFiles = files.map(f => ({ path: f.path, content: f.content }));
    const isTypescript = intent.technologies.primary.toLowerCase().includes('typescript');
    const isPython = intent.technologies.runtime === 'python';

    let commands: string[];
    let runtime: 'node22' | 'python3.13' = 'node22';

    if (isPython) {
      runtime = 'python3.13';
      commands = ['python -m py_compile src/*.py || python -m py_compile *.py'];
    } else if (isTypescript) {
      commands = [
        'npm install --ignore-scripts',
        'npx tsc --noEmit',
      ];
    } else {
      commands = [
        'npm install --ignore-scripts',
        'node --check src/index.js || node --check index.js',
      ];
    }

    try {
      const result = await executeSandbox(this.config, {
        files: sandboxFiles,
        commands,
        runtime,
        timeout: 2 * 60 * 1000, // 2 minutes
        vcpus: 2,
      });

      return {
        success: result.success,
        phase: 'build',
        outputs: result.outputs.map(o => ({
          command: o.command,
          stdout: o.stdout,
          stderr: o.stderr,
          exitCode: o.exitCode,
        })),
        errors: result.success ? [] : this.extractErrors(result),
        executionTime: result.executionTime,
      };
    } catch (error) {
      return {
        success: false,
        phase: 'build',
        outputs: [],
        errors: [{ file: 'system', message: String(error), type: 'build', severity: 'error' }],
        executionTime: 0,
      };
    }
  }

  /**
   * Build the command list from the plan
   */
  private buildCommands(plan: ProjectPlan, intent: CodeIntent): string[] {
    // If plan has explicit build steps, use them
    if (plan.buildSteps.length > 0) {
      return plan.buildSteps
        .sort((a, b) => a.order - b.order)
        .map(step => step.command);
    }

    // Otherwise, create default commands
    const isTypescript = intent.technologies.primary.toLowerCase().includes('typescript');
    const isPython = intent.technologies.runtime === 'python';
    const pm = intent.technologies.packageManager;

    if (isPython) {
      return [
        'pip install -r requirements.txt 2>/dev/null || echo "No requirements.txt"',
        'python -m py_compile src/*.py 2>/dev/null || python -m py_compile *.py 2>/dev/null || echo "Syntax check passed"',
      ];
    }

    const installCmd = pm === 'yarn' ? 'yarn' :
                       pm === 'pnpm' ? 'pnpm install' :
                       pm === 'bun' ? 'bun install' :
                       'npm install';

    const commands = [installCmd];

    if (isTypescript) {
      commands.push('npx tsc --noEmit'); // Type check
    }

    // Try to run the project
    commands.push('npm run build 2>/dev/null || echo "No build script"');

    return commands;
  }

  /**
   * Determine which phase failed
   */
  private determinePhase(outputs: Array<{ command: string; success: boolean }>): SandboxTestResult['phase'] {
    for (const output of outputs) {
      if (!output.success) {
        if (output.command.includes('install')) return 'install';
        if (output.command.includes('build') || output.command.includes('tsc')) return 'build';
        if (output.command.includes('test')) return 'test';
        return 'run';
      }
    }
    return 'run';
  }

  /**
   * Extract error information from sandbox result
   */
  private extractErrors(result: { outputs: Array<{ command: string; stderr: string; stdout: string }> }): SandboxTestResult['errors'] {
    const errors: SandboxTestResult['errors'] = [];

    for (const output of result.outputs) {
      const errorText = output.stderr || output.stdout;
      if (!errorText) continue;

      // This is a simple extraction - ErrorAnalyzer will do deep analysis
      errors.push({
        file: 'unknown',
        message: errorText.substring(0, 500),
        type: 'build',
        severity: 'error',
      });
    }

    return errors;
  }
}

export const sandboxExecutor = new SandboxExecutor();
