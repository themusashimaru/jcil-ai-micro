/**
 * PROCESS MANAGER
 *
 * Manages long-running processes with kill/abort support.
 * Features:
 * - Track running processes
 * - Kill individual processes
 * - Kill all processes
 * - Process timeouts
 * - Output streaming
 * - Resource cleanup
 */

export interface ManagedProcess {
  id: string;
  command: string;
  status: 'running' | 'completed' | 'killed' | 'failed' | 'timeout';
  startTime: Date;
  endTime?: Date;
  pid?: number;
  exitCode?: number;
  output: string;
  error: string;
  abortController?: AbortController;
}

export interface ProcessResult {
  success: boolean;
  output: string;
  error: string;
  exitCode: number;
  killed: boolean;
  timedOut: boolean;
  duration: number;
}

type ProcessCallback = (chunk: string, isError: boolean) => void;

export class ProcessManager {
  private processes: Map<string, ManagedProcess> = new Map();
  private maxConcurrent: number;
  private defaultTimeout: number;

  constructor(options: { maxConcurrent?: number; defaultTimeout?: number } = {}) {
    this.maxConcurrent = options.maxConcurrent || 10;
    this.defaultTimeout = options.defaultTimeout || 120000; // 2 minutes
  }

  /**
   * Execute a command with full process management
   */
  async execute(
    command: string,
    executeShell: (
      cmd: string,
      signal?: AbortSignal
    ) => Promise<{ stdout: string; stderr: string; exitCode: number }>,
    options: {
      timeout?: number;
      onOutput?: ProcessCallback;
      workingDir?: string;
    } = {}
  ): Promise<{ processId: string; result: Promise<ProcessResult> }> {
    // Check concurrent process limit
    const runningCount = this.getRunning().length;
    if (runningCount >= this.maxConcurrent) {
      throw new Error(`Maximum concurrent processes (${this.maxConcurrent}) reached`);
    }

    const processId = this.generateId();
    const abortController = new AbortController();
    const timeout = options.timeout || this.defaultTimeout;

    // Create process record
    const process: ManagedProcess = {
      id: processId,
      command,
      status: 'running',
      startTime: new Date(),
      output: '',
      error: '',
      abortController,
    };

    this.processes.set(processId, process);

    // Execute with timeout
    const result = new Promise<ProcessResult>(async (resolve) => {
      const timeoutId = setTimeout(() => {
        abortController.abort();
        process.status = 'timeout';
      }, timeout);

      try {
        const fullCommand = options.workingDir
          ? `cd ${options.workingDir} && ${command}`
          : command;

        const execResult = await executeShell(fullCommand, abortController.signal);

        clearTimeout(timeoutId);

        process.output = execResult.stdout;
        process.error = execResult.stderr;
        process.exitCode = execResult.exitCode;
        process.endTime = new Date();

        if (process.status === 'running') {
          process.status = execResult.exitCode === 0 ? 'completed' : 'failed';
        }

        // Call output callback
        if (options.onOutput) {
          if (execResult.stdout) options.onOutput(execResult.stdout, false);
          if (execResult.stderr) options.onOutput(execResult.stderr, true);
        }

        resolve({
          success: execResult.exitCode === 0,
          output: execResult.stdout,
          error: execResult.stderr,
          exitCode: execResult.exitCode,
          killed: process.status === 'killed',
          timedOut: process.status === 'timeout',
          duration: (process.endTime.getTime() - process.startTime.getTime()),
        });
      } catch (error) {
        clearTimeout(timeoutId);
        process.endTime = new Date();

        const isAborted = error instanceof Error && error.name === 'AbortError';

        if (process.status === 'running') {
          process.status = isAborted ? 'killed' : 'failed';
        }

        process.error = String(error);

        resolve({
          success: false,
          output: process.output,
          error: process.error,
          exitCode: -1,
          killed: process.status === 'killed',
          timedOut: process.status === 'timeout',
          duration: (process.endTime.getTime() - process.startTime.getTime()),
        });
      }
    });

    return { processId, result };
  }

  /**
   * Kill a specific process
   */
  kill(processId: string): boolean {
    const process = this.processes.get(processId);
    if (!process || process.status !== 'running') {
      return false;
    }

    process.abortController?.abort();
    process.status = 'killed';
    process.endTime = new Date();

    return true;
  }

  /**
   * Kill all running processes
   */
  killAll(): number {
    let killed = 0;

    for (const [id, process] of this.processes) {
      if (process.status === 'running') {
        if (this.kill(id)) {
          killed++;
        }
      }
    }

    return killed;
  }

  /**
   * Get process by ID
   */
  get(processId: string): ManagedProcess | undefined {
    return this.processes.get(processId);
  }

  /**
   * Get all processes
   */
  getAll(): ManagedProcess[] {
    return Array.from(this.processes.values());
  }

  /**
   * Get running processes
   */
  getRunning(): ManagedProcess[] {
    return this.getAll().filter(p => p.status === 'running');
  }

  /**
   * Check if process is running
   */
  isRunning(processId: string): boolean {
    const process = this.processes.get(processId);
    return process?.status === 'running';
  }

  /**
   * Clear completed processes
   */
  clearCompleted(): number {
    let cleared = 0;

    for (const [id, process] of this.processes) {
      if (process.status !== 'running') {
        this.processes.delete(id);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Get process statistics
   */
  getStats(): {
    total: number;
    running: number;
    completed: number;
    failed: number;
    killed: number;
    timedOut: number;
  } {
    const processes = this.getAll();

    return {
      total: processes.length,
      running: processes.filter(p => p.status === 'running').length,
      completed: processes.filter(p => p.status === 'completed').length,
      failed: processes.filter(p => p.status === 'failed').length,
      killed: processes.filter(p => p.status === 'killed').length,
      timedOut: processes.filter(p => p.status === 'timeout').length,
    };
  }

  /**
   * Wait for a process to complete
   */
  async waitFor(processId: string, timeoutMs?: number): Promise<ManagedProcess | null> {
    const process = this.processes.get(processId);
    if (!process) return null;
    if (process.status !== 'running') return process;

    const timeout = timeoutMs || this.defaultTimeout;
    const startTime = Date.now();

    return new Promise((resolve) => {
      const check = () => {
        const current = this.processes.get(processId);
        if (!current || current.status !== 'running') {
          resolve(current || null);
          return;
        }

        if (Date.now() - startTime > timeout) {
          this.kill(processId);
          resolve(this.processes.get(processId) || null);
          return;
        }

        setTimeout(check, 100);
      };

      check();
    });
  }

  // Helper: Generate unique process ID
  private generateId(): string {
    return `proc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Singleton instance
let processManagerInstance: ProcessManager | null = null;

export function getProcessManager(): ProcessManager {
  if (!processManagerInstance) {
    processManagerInstance = new ProcessManager();
  }
  return processManagerInstance;
}

/**
 * Quick helper for one-off commands with timeout
 */
export async function runWithTimeout(
  command: string,
  executeShell: (cmd: string, signal?: AbortSignal) => Promise<{ stdout: string; stderr: string; exitCode: number }>,
  timeoutMs: number = 30000
): Promise<ProcessResult> {
  const manager = getProcessManager();
  const { result } = await manager.execute(command, executeShell, { timeout: timeoutMs });
  return result;
}
