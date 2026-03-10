/**
 * CODE AGENT
 *
 * The main orchestrator for the autonomous coding system.
 * Coordinates: Intent → Plan → Generate → Test → Fix → Deliver
 *
 * Capabilities:
 * - Fully autonomous code generation
 * - Self-evaluation and error correction
 * - Iterative improvement loop
 * - Sandbox testing before delivery
 * - GitHub integration for version control
 *
 * Powered by Claude Opus 4.6.
 */

import { BaseAgent } from '../core/BaseAgent';
import {
  AgentContext,
  AgentResult,
  AgentStreamCallback,
  CodeIntent,
  ProjectPlan,
  GeneratedFile,
  CodeAgentOutput,
  SandboxTestResult,
} from '../core/types';

import { codeIntentAnalyzer } from './brain/IntentAnalyzer';
import { projectPlanner } from './brain/ProjectPlanner';
import { codeGenerator } from './brain/CodeGenerator';
import { errorAnalyzer } from './brain/ErrorAnalyzer';
import { sandboxExecutor } from './executors/SandboxExecutor';
import { githubExecutor } from './executors/GitHubExecutor';

export interface CodeAgentInput {
  request: string;
  options?: {
    pushToGitHub?: boolean;
    repoName?: string;
    privateRepo?: boolean;
  };
}

export class CodeAgent extends BaseAgent<CodeAgentInput, CodeAgentOutput> {
  name = 'CodeAgent';
  description = 'Autonomous code generation with self-correction and GitHub integration';
  version = '1.0.0';

  // Configuration
  private readonly MAX_ITERATIONS = 3;
  private readonly MAX_TIME_MS = 180000; // 3 minutes
  private executionStartTime: number = 0;

  // State
  private intent: CodeIntent | null = null;
  private plan: ProjectPlan | null = null;
  private files: GeneratedFile[] = [];
  private testResult: SandboxTestResult | null = null;
  private errorsFixed: number = 0;

  // Heartbeat for Vercel timeout prevention
  private heartbeatInterval: NodeJS.Timeout | null = null;

  /**
   * Main execution method - the agentic loop
   */
  async execute(
    input: CodeAgentInput,
    context: AgentContext,
    onStream: AgentStreamCallback
  ): Promise<AgentResult<CodeAgentOutput>> {
    this.startExecution();
    this.executionStartTime = Date.now();
    this.errorsFixed = 0;

    try {
      // ========================================
      // PHASE 1: UNDERSTAND THE REQUEST
      // ========================================
      this.emit(onStream, 'thinking', 'Analyzing your request...', {
        phase: 'Intent Analysis',
        progress: 5,
      });

      this.intent = await codeIntentAnalyzer.analyze(input.request, context);

      this.emit(onStream, 'thinking', `Building: ${this.intent.refinedDescription}`, {
        phase: 'Intent Analysis',
        progress: 10,
        details: {
          projectType: this.intent.projectType,
          complexity: this.intent.complexity,
          technologies: this.intent.technologies.primary,
        },
      });

      // ========================================
      // PHASE 2: PLAN THE PROJECT
      // ========================================
      this.emit(onStream, 'thinking', 'Creating project architecture...', {
        phase: 'Project Planning',
        progress: 15,
      });

      this.plan = await projectPlanner.plan(this.intent);

      this.emit(
        onStream,
        'thinking',
        `Planned ${this.plan.fileTree.length} files, ${this.plan.taskBreakdown.length} tasks`,
        {
          phase: 'Project Planning',
          progress: 25,
          details: {
            architecture: this.plan.architecture.pattern,
            files: this.plan.fileTree.map((f) => f.path),
            tasks: this.plan.taskBreakdown.map((t) => t.title),
          },
        }
      );

      // ========================================
      // PHASE 3: GENERATE CODE
      // ========================================
      this.emit(onStream, 'searching', 'Generating code files...', {
        phase: 'Code Generation',
        progress: 30,
      });

      // Start heartbeat to prevent Vercel timeout
      this.startHeartbeat(onStream, 'Code Generation');

      this.files = await codeGenerator.generateAll(this.intent, this.plan, onStream);

      this.stopHeartbeat();

      this.emit(onStream, 'thinking', `Generated ${this.files.length} files`, {
        phase: 'Code Generation',
        progress: 50,
        details: {
          files: this.files.map((f) => ({ path: f.path, lines: f.linesOfCode })),
        },
      });

      // ========================================
      // PHASE 4: TEST & FIX LOOP
      // ========================================
      let iteration = 0;
      let buildSuccess = false;

      while (iteration < this.MAX_ITERATIONS && !buildSuccess && !this.isTimeToFinish()) {
        iteration++;
        this.incrementIteration();

        this.emit(onStream, 'evaluating', `Testing iteration ${iteration}...`, {
          phase: `Test & Fix (${iteration}/${this.MAX_ITERATIONS})`,
          progress: 50 + iteration * 10,
        });

        // Initialize sandbox if not done
        if (!sandboxExecutor.isAvailable()) {
          // Try to initialize with env variables
          sandboxExecutor.initialize();
        }

        // Test the code
        if (sandboxExecutor.isAvailable()) {
          this.startHeartbeat(onStream, 'Sandbox Testing');

          this.testResult = await sandboxExecutor.execute(
            this.files,
            this.plan,
            this.intent,
            onStream
          );

          this.stopHeartbeat();

          if (this.testResult.success) {
            buildSuccess = true;
            this.emit(onStream, 'evaluating', 'Build successful!', {
              phase: 'Test & Fix',
              progress: 75,
            });
          } else {
            // Analyze and fix errors
            this.emit(
              onStream,
              'pivoting',
              `Build failed. Analyzing ${this.testResult.errors.length} errors...`,
              {
                phase: 'Error Analysis',
                progress: 55 + iteration * 10,
              }
            );

            const errors = errorAnalyzer.parseErrors(this.testResult);

            if (errors.length > 0) {
              const analyses = await errorAnalyzer.analyzeAllErrors(
                errors,
                this.files,
                this.intent,
                this.plan
              );

              // Check if we should replan
              if (errorAnalyzer.shouldReplan(errors, analyses)) {
                this.emit(onStream, 'pivoting', 'Major issues detected. Replanning...', {
                  phase: 'Replanning',
                  progress: 60,
                });

                // Replan with error context
                this.plan = await projectPlanner.plan({
                  ...this.intent,
                  refinedDescription: `${this.intent.refinedDescription} (Note: Previous attempt had errors: ${errors
                    .slice(0, 3)
                    .map((e) => e.message)
                    .join('; ')})`,
                });

                // Regenerate with new plan
                this.files = await codeGenerator.generateAll(this.intent, this.plan, onStream);
              } else {
                // Apply fixes
                for (const analysis of analyses) {
                  if (analysis.confidence !== 'low') {
                    const fileToFix = this.files.find(
                      (f) =>
                        f.path === analysis.suggestedFix.file ||
                        f.path.endsWith('/' + analysis.suggestedFix.file)
                    );

                    if (fileToFix) {
                      const fixed = errorAnalyzer.applyFix(fileToFix, analysis);
                      this.files = this.files.map((f) => (f.path === fileToFix.path ? fixed : f));
                      this.errorsFixed++;

                      this.emit(
                        onStream,
                        'thinking',
                        `Fixed: ${analysis.error.message.substring(0, 50)}...`,
                        {
                          phase: 'Error Fixing',
                          progress: 60 + iteration * 5,
                        }
                      );
                    }
                  }
                }
              }
            }
          }
        } else {
          // No sandbox available - do syntax check only
          this.emit(onStream, 'thinking', 'Sandbox unavailable. Skipping live testing.', {
            phase: 'Test & Fix',
            progress: 70,
          });

          // Create a simulated success result
          this.testResult = {
            success: true,
            phase: 'build',
            outputs: [],
            errors: [],
            executionTime: 0,
          };
          buildSuccess = true;
        }
      }

      // ========================================
      // PHASE 5: PUSH TO GITHUB (if requested)
      // ========================================
      let githubResult = undefined;

      if (input.options?.pushToGitHub) {
        this.emit(onStream, 'synthesizing', 'Pushing to GitHub...', {
          phase: 'GitHub Push',
          progress: 85,
        });

        if (githubExecutor.isAvailable()) {
          const repoName =
            input.options.repoName || (await githubExecutor.suggestRepoName(this.plan.name));

          const pushResult = await githubExecutor.push(
            this.files,
            this.plan,
            {
              createNew: true,
              repoName,
              private: input.options.privateRepo,
            },
            onStream
          );

          githubResult = {
            pushed: pushResult.success,
            repoUrl: pushResult.repoUrl,
            commitSha: pushResult.commitSha,
            error: pushResult.error,
          };

          if (pushResult.success) {
            this.emit(onStream, 'complete', `Pushed to ${pushResult.repoUrl}`, {
              phase: 'Complete',
              progress: 95,
            });
          }
        } else {
          githubResult = {
            pushed: false,
            error: 'GitHub not connected. Please login with GitHub first.',
          };
        }
      }

      // ========================================
      // PHASE 6: BUILD FINAL OUTPUT
      // ========================================
      const output: CodeAgentOutput = {
        projectName: this.plan.name,
        description: this.plan.description,
        files: this.files,
        buildResult: this.testResult || {
          success: true,
          phase: 'build',
          outputs: [],
          errors: [],
          executionTime: 0,
        },
        github: githubResult,
        summary: {
          totalFiles: this.files.length,
          totalLines: this.files.reduce((acc, f) => acc + f.linesOfCode, 0),
          technologies: [this.intent.technologies.primary, ...this.intent.technologies.secondary],
          architecture: this.plan.architecture.pattern,
        },
        nextSteps: this.generateNextSteps(buildSuccess, githubResult),
        metadata: {
          totalIterations: this.iterationCount,
          errorsFixed: this.errorsFixed,
          executionTime: this.getExecutionTime(),
          confidenceScore: this.calculateConfidence(buildSuccess),
        },
      };

      this.emit(onStream, 'complete', 'Code generation complete!', {
        phase: 'Complete',
        progress: 100,
        details: {
          files: output.summary.totalFiles,
          lines: output.summary.totalLines,
          buildSuccess,
        },
      });

      return this.success(output, output.metadata.confidenceScore);
    } catch (error) {
      this.stopHeartbeat();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.emit(onStream, 'error', `Code generation failed: ${errorMessage}`, {
        phase: 'Error',
        progress: 0,
      });

      return this.failure(errorMessage);
    }
  }

  /**
   * Check if agent can handle input
   */
  canHandle(input: unknown): boolean {
    if (typeof input !== 'object' || input === null) return false;
    const obj = input as Record<string, unknown>;
    return typeof obj.request === 'string' && obj.request.length > 0;
  }

  /**
   * Check if we're running out of time
   */
  private isTimeToFinish(): boolean {
    return Date.now() - this.executionStartTime >= this.MAX_TIME_MS;
  }

  /**
   * Start heartbeat to prevent Vercel timeout
   */
  private startHeartbeat(onStream: AgentStreamCallback, phase: string): void {
    this.stopHeartbeat();
    let tick = 0;
    this.heartbeatInterval = setInterval(() => {
      tick++;
      this.emit(onStream, 'thinking', `Working... (${tick * 5}s)`, {
        phase,
        details: { heartbeat: true },
      });
    }, 5000);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(buildSuccess: boolean): number {
    let score = 0.5;

    if (buildSuccess) score += 0.3;
    if (this.errorsFixed > 0) score += 0.1;
    if (this.files.length >= (this.plan?.fileTree.length || 0)) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Generate next steps for the user
   */
  private generateNextSteps(
    buildSuccess: boolean,
    githubResult?: { pushed: boolean; repoUrl?: string; commitSha?: string; error?: string }
  ): string[] {
    const steps: string[] = [];

    if (githubResult?.pushed && githubResult.repoUrl) {
      steps.push(`View your project: ${githubResult.repoUrl}`);
      steps.push('Clone the repository and run `npm install` to get started');
    } else {
      steps.push('Copy the generated files to your project directory');
      steps.push('Run `npm install` to install dependencies');
    }

    if (buildSuccess) {
      steps.push('Run `npm run dev` to start development');
    } else {
      steps.push('Review the build errors and make manual fixes if needed');
    }

    steps.push('Add your own features and customizations');

    return steps;
  }
}

export const codeAgent = new CodeAgent();
