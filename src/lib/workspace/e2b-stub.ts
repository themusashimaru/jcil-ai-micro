/**
 * E2B STUB
 *
 * Stub implementation for E2B Code Interpreter.
 * This allows the build to pass without requiring the actual E2B package.
 * Replace with actual @e2b/code-interpreter when ready to deploy.
 *
 * To enable real E2B:
 * 1. Run: npm install @e2b/code-interpreter
 * 2. Change import in container.ts from './e2b-stub' to '@e2b/code-interpreter'
 * 3. Add E2B_API_KEY to your environment
 */

export interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface ProcessStartOptions {
  cmd: string;
  cwd?: string;
  timeoutMs?: number;
  envVars?: Record<string, string>;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
}

interface ProcessRunOptions {
  onStdout?: (data: { line: string }) => void;
  onStderr?: (data: { line: string }) => void;
  cwd?: string;
  timeout?: number;
}

/**
 * Sandbox stub - simulates E2B sandbox behavior
 * In production, this would be replaced with actual E2B sandbox
 */
export class Sandbox {
  id: string;
  sandboxId: string;
  private fileStorage: Map<string, string> = new Map();

  constructor() {
    const id = `sandbox-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    this.id = id;
    this.sandboxId = id;
  }

  /**
   * Create a new sandbox instance
   */
  static async create(_options?: {
    template?: string;
    timeout?: number;
    envVars?: Record<string, string>;
  }): Promise<Sandbox> {
    // Simulate sandbox creation delay
    await new Promise((resolve) => setTimeout(resolve, 100));
    return new Sandbox();
  }

  /**
   * Connect to an existing sandbox by ID
   */
  static async connect(sandboxId: string): Promise<Sandbox> {
    const sandbox = new Sandbox();
    sandbox.id = sandboxId;
    sandbox.sandboxId = sandboxId;
    return sandbox;
  }

  /**
   * File system operations
   */
  files = {
    read: async (path: string): Promise<string> => {
      return this.fileStorage.get(path) || '';
    },
    write: async (path: string, content: string): Promise<void> => {
      this.fileStorage.set(path, content);
    },
    list: async (_path: string): Promise<Array<{ name: string; type: 'file' | 'directory'; size: number }>> => {
      return [];
    },
    remove: async (path: string): Promise<void> => {
      this.fileStorage.delete(path);
    },
    makeDir: async (_path: string): Promise<void> => {
      // Stub
    },
  };

  /**
   * File system (legacy interface)
   */
  filesystem = {
    read: async (path: string): Promise<string> => {
      return this.fileStorage.get(path) || '';
    },
    write: async (path: string, content: string): Promise<void> => {
      this.fileStorage.set(path, content);
    },
    list: async (_path: string): Promise<Array<{ name: string; type: 'file' | 'directory'; size: number }>> => {
      return [];
    },
    remove: async (path: string): Promise<void> => {
      this.fileStorage.delete(path);
    },
    makeDir: async (_path: string): Promise<void> => {
      // Stub
    },
  };

  /**
   * Process management
   */
  process = {
    start: async (
      options: ProcessStartOptions
    ): Promise<{
      wait: () => Promise<ProcessResult>;
      sendStdin: (data: string) => Promise<void>;
      kill: () => Promise<void>;
    }> => {
      const result: ProcessResult = {
        stdout: `[E2B Stub] Would execute: ${options.cmd}`,
        stderr: '',
        exitCode: 0,
      };

      if (options.onStdout) {
        options.onStdout(result.stdout);
      }

      return {
        wait: async () => result,
        sendStdin: async (_data: string) => {},
        kill: async () => {},
      };
    },
  };

  /**
   * Command execution
   */
  commands = {
    run: async (
      command: string,
      options?: ProcessRunOptions
    ): Promise<ProcessResult> => {
      const result: ProcessResult = {
        stdout: `[E2B Stub] Would execute: ${command}`,
        stderr: '',
        exitCode: 0,
      };

      if (options?.onStdout) {
        options.onStdout({ line: result.stdout });
      }

      return result;
    },
  };

  /**
   * Run code in the sandbox
   */
  async runCode(code: string): Promise<{
    logs: { stdout: string[]; stderr: string[] };
    error: { message: string } | null;
  }> {
    return {
      logs: {
        stdout: [`[E2B Stub] Would run code: ${code.slice(0, 50)}...`],
        stderr: [],
      },
      error: null,
    };
  }

  /**
   * Get the public URL for a port
   */
  getHost(port: number): string {
    return `https://${this.id}-${port}.stub.localhost`;
  }

  /**
   * Set sandbox timeout
   */
  async setTimeout(_timeout: number): Promise<void> {
    // Stub
  }

  /**
   * Keep sandbox alive
   */
  async keepAlive(_timeout: number): Promise<void> {
    // Stub
  }

  /**
   * Close the sandbox
   */
  async close(): Promise<void> {
    this.fileStorage.clear();
  }

  /**
   * Kill the sandbox
   */
  async kill(): Promise<void> {
    await this.close();
  }
}
