/**
 * CONTAINER ORCHESTRATION ENGINE
 *
 * This is the REAL sandboxed execution layer.
 * Uses E2B (same tech as OpenAI Code Interpreter) for secure code execution.
 *
 * E2B provides:
 * - Fully isolated sandboxes (microVMs)
 * - File system access
 * - Shell command execution
 * - Network access
 * - Persistent storage
 * - Real-time output streaming
 */

// Real E2B SDK - requires E2B_API_KEY in environment
import { Sandbox } from '@e2b/code-interpreter';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { escapeShellArg, sanitizeCommitMessage } from '@/lib/security/shell-escape';

const log = logger('ContainerManager');

// Validate E2B API key at module load
const E2B_API_KEY = process.env.E2B_API_KEY;
if (!E2B_API_KEY && process.env.NODE_ENV === 'production') {
  log.warn('E2B_API_KEY not set - workspace execution will fail');
}

// ============================================
// TYPES
// ============================================

export interface ContainerConfig {
  template: 'base' | 'nodejs' | 'python' | 'go' | 'rust' | 'custom';
  timeout: number; // seconds
  memory: number; // MB
  cpu: number; // cores
  envVars: Record<string, string>;
  persistentDirs?: string[];
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
  error?: string;
}

export interface FileInfo {
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: Date;
}

export interface StreamHandler {
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  onExit?: (code: number) => void;
}

// ============================================
// CONTAINER MANAGER
// ============================================

export class ContainerManager {
  private supabase;
  private activeSandboxes: Map<string, Sandbox> = new Map();

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Create a new sandboxed container
   */
  async createContainer(
    workspaceId: string,
    config: Partial<ContainerConfig> = {}
  ): Promise<string> {
    const fullConfig: ContainerConfig = {
      template: config.template || 'nodejs',
      timeout: config.timeout || 300,
      memory: config.memory || 512,
      cpu: config.cpu || 1,
      envVars: config.envVars || {},
      persistentDirs: config.persistentDirs || ['/workspace'],
    };

    try {
      // Create E2B sandbox with correct API
      const template = this.getE2BTemplate(fullConfig.template);
      const sandbox = await Sandbox.create(template, {
        timeoutMs: fullConfig.timeout * 1000,
        envs: fullConfig.envVars,
      });

      // Store sandbox reference
      this.activeSandboxes.set(workspaceId, sandbox);

      // Update or insert database with sandbox ID
      // Note: workspaceId is actually the session_id in code_lab_workspaces table
      // CRITICAL FIX: Use upsert to handle case where workspace row doesn't exist yet
      // (e.g., user accesses files/git before sending first chat message)
      const { error: upsertError } = await this.supabase.from('code_lab_workspaces').upsert(
        {
          session_id: workspaceId,
          sandbox_id: sandbox.sandboxId,
          status: 'active',
          template: fullConfig.template,
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        },
        {
          onConflict: 'session_id',
          ignoreDuplicates: false,
        }
      );

      if (upsertError) {
        log.warn('Failed to upsert workspace record', { error: upsertError.message });
      }

      // Initialize workspace directory
      await sandbox.files.makeDir('/workspace');

      // Install LSP servers for code intelligence (runs in background)
      this.installLSPServers(sandbox).catch((err) => {
        log.warn('LSP server installation failed (non-critical)', { error: err });
      });

      return sandbox.sandboxId;
    } catch (error) {
      log.error('Failed to create container', error as Error);
      throw new Error(
        `Container creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get E2B template name
   */
  private getE2BTemplate(template: ContainerConfig['template']): string {
    const templates: Record<string, string> = {
      base: 'base',
      nodejs: 'base', // E2B base includes Node.js
      python: 'base', // E2B code-interpreter is Python-focused
      go: 'base',
      rust: 'base',
      custom: 'base',
    };
    return templates[template] || 'base';
  }

  /**
   * Install Language Server Protocol servers for code intelligence
   * This enables features like go-to-definition, find references, hover info
   */
  private async installLSPServers(sandbox: Sandbox): Promise<void> {
    log.info('Installing LSP servers...');

    // Install TypeScript language server (for TS/JS projects)
    const tsInstall = await sandbox.commands.run(
      'npm install -g typescript typescript-language-server 2>/dev/null',
      { timeoutMs: 60000 }
    );
    if (tsInstall.exitCode === 0) {
      log.info('TypeScript LSP installed');
    }

    // Install Python language server
    const pyInstall = await sandbox.commands.run(
      'pip install python-lsp-server 2>/dev/null || pip3 install python-lsp-server 2>/dev/null',
      { timeoutMs: 60000 }
    );
    if (pyInstall.exitCode === 0) {
      log.info('Python LSP installed');
    }

    // Install Go language server if Go is available
    const goCheck = await sandbox.commands.run('which go 2>/dev/null', { timeoutMs: 5000 });
    if (goCheck.exitCode === 0) {
      const goInstall = await sandbox.commands.run(
        'go install golang.org/x/tools/gopls@latest 2>/dev/null',
        { timeoutMs: 120000 }
      );
      if (goInstall.exitCode === 0) {
        log.info('Go LSP installed');
      }
    }

    log.info('LSP server installation complete');
  }

  /**
   * Get or create sandbox for workspace
   */
  async getSandbox(workspaceId: string): Promise<Sandbox> {
    // Check if we have an active sandbox
    // Note: workspaceId is actually the session_id
    let sandbox = this.activeSandboxes.get(workspaceId);

    if (!sandbox) {
      // Try to reconnect to existing sandbox
      // Query code_lab_workspaces using session_id
      const { data: workspace } = await this.supabase
        .from('code_lab_workspaces')
        .select('sandbox_id')
        .eq('session_id', workspaceId)
        .single();

      if (workspace?.sandbox_id) {
        try {
          sandbox = await Sandbox.connect(workspace.sandbox_id);
          this.activeSandboxes.set(workspaceId, sandbox);
        } catch {
          // Sandbox expired, create new one
          await this.createContainer(workspaceId);
          sandbox = this.activeSandboxes.get(workspaceId);
        }
      } else {
        // No container exists, create one
        await this.createContainer(workspaceId);
        sandbox = this.activeSandboxes.get(workspaceId);
      }
    }

    if (!sandbox) {
      throw new Error('Failed to get or create sandbox');
    }

    return sandbox;
  }

  /**
   * Execute a shell command in the container
   */
  async executeCommand(
    workspaceId: string,
    command: string,
    options: {
      cwd?: string;
      timeout?: number;
      stream?: StreamHandler;
    } = {}
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const sandbox = await this.getSandbox(workspaceId);

    try {
      // Use E2B commands.run API
      const result = await sandbox.commands.run(command, {
        cwd: options.cwd || '/workspace',
        timeoutMs: options.timeout || 30000,
        onStdout: (data) => {
          options.stream?.onStdout?.(data);
        },
        onStderr: (data) => {
          options.stream?.onStderr?.(data);
        },
      });

      options.stream?.onExit?.(result.exitCode);

      return {
        stdout: result.stdout.trim(),
        stderr: result.stderr.trim(),
        exitCode: result.exitCode,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown error',
        exitCode: 1,
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute Python code directly
   */
  async executePython(workspaceId: string, code: string): Promise<ExecutionResult> {
    const sandbox = await this.getSandbox(workspaceId);
    const startTime = Date.now();

    try {
      // Use E2B code-interpreter runCode API
      const result = await sandbox.runCode(code);

      return {
        stdout: result.logs.stdout.join('\n'),
        stderr: result.logs.stderr.join('\n'),
        exitCode: result.error ? 1 : 0,
        executionTime: Date.now() - startTime,
        error: result.error?.value,
      };
    } catch (error) {
      return {
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown error',
        exitCode: 1,
        executionTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Read a file from the container
   */
  async readFile(workspaceId: string, path: string): Promise<string> {
    const sandbox = await this.getSandbox(workspaceId);

    try {
      const content = await sandbox.files.read(path);
      return content;
    } catch (error) {
      throw new Error(
        `Failed to read file ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Write a file to the container
   */
  async writeFile(workspaceId: string, path: string, content: string): Promise<void> {
    const sandbox = await this.getSandbox(workspaceId);

    try {
      // E2B files.write auto-creates parent directories
      await sandbox.files.write(path, content);
    } catch (error) {
      throw new Error(
        `Failed to write file ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete a file from the container
   */
  async deleteFile(workspaceId: string, path: string): Promise<void> {
    const sandbox = await this.getSandbox(workspaceId);
    await sandbox.files.remove(path);
  }

  /**
   * List directory contents
   */
  async listDirectory(workspaceId: string, path: string): Promise<FileInfo[]> {
    const sandbox = await this.getSandbox(workspaceId);

    try {
      const entries = await sandbox.files.list(path);

      return entries.map((entry) => ({
        path: `${path}/${entry.name}`,
        isDirectory: entry.type === 'dir',
        size: 0,
        modifiedAt: new Date(),
      }));
    } catch (error) {
      throw new Error(
        `Failed to list directory ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Upload a file to the container
   */
  async uploadFile(workspaceId: string, path: string, content: Buffer | string): Promise<void> {
    const sandbox = await this.getSandbox(workspaceId);

    const contentStr = typeof content === 'string' ? content : content.toString('base64');
    const isBase64 = typeof content !== 'string';

    if (isBase64) {
      // Write base64 content and decode
      await sandbox.files.write(`${path}.b64`, contentStr);
      await this.executeCommand(
        workspaceId,
        `base64 -d "${path}.b64" > "${path}" && rm "${path}.b64"`
      );
    } else {
      await sandbox.files.write(path, contentStr);
    }
  }

  /**
   * Download a file from the container
   */
  async downloadFile(workspaceId: string, path: string): Promise<string> {
    return this.readFile(workspaceId, path);
  }

  /**
   * Clone a git repository
   */
  async cloneRepository(
    workspaceId: string,
    repoUrl: string,
    branch: string = 'main',
    targetDir: string = '/workspace'
  ): Promise<ExecutionResult> {
    // First, ensure git is installed
    await this.executeCommand(workspaceId, 'apt-get update && apt-get install -y git');

    // Clone the repository
    return this.executeCommand(
      workspaceId,
      `git clone --branch ${branch} --single-branch ${repoUrl} ${targetDir}`,
      { timeout: 120000 } // 2 minute timeout for large repos
    );
  }

  /**
   * Install dependencies based on project type
   */
  async installDependencies(
    workspaceId: string,
    cwd: string = '/workspace'
  ): Promise<ExecutionResult> {
    // Check which package manager to use
    const hasPackageJson = await this.fileExists(workspaceId, `${cwd}/package.json`);
    const hasRequirementsTxt = await this.fileExists(workspaceId, `${cwd}/requirements.txt`);
    const hasGoMod = await this.fileExists(workspaceId, `${cwd}/go.mod`);
    const hasCargoToml = await this.fileExists(workspaceId, `${cwd}/Cargo.toml`);

    if (hasPackageJson) {
      // Check for lock files to determine package manager
      const hasYarnLock = await this.fileExists(workspaceId, `${cwd}/yarn.lock`);
      const hasPnpmLock = await this.fileExists(workspaceId, `${cwd}/pnpm-lock.yaml`);

      if (hasPnpmLock) {
        return this.executeCommand(workspaceId, 'pnpm install', { cwd, timeout: 120000 });
      } else if (hasYarnLock) {
        return this.executeCommand(workspaceId, 'yarn install', { cwd, timeout: 120000 });
      } else {
        return this.executeCommand(workspaceId, 'npm install', { cwd, timeout: 120000 });
      }
    }

    if (hasRequirementsTxt) {
      return this.executeCommand(workspaceId, 'pip install -r requirements.txt', {
        cwd,
        timeout: 120000,
      });
    }

    if (hasGoMod) {
      return this.executeCommand(workspaceId, 'go mod download', { cwd, timeout: 120000 });
    }

    if (hasCargoToml) {
      return this.executeCommand(workspaceId, 'cargo build', { cwd, timeout: 180000 });
    }

    return {
      stdout: 'No package manager detected',
      stderr: '',
      exitCode: 0,
      executionTime: 0,
    };
  }

  /**
   * Check if a file exists
   */
  async fileExists(workspaceId: string, path: string): Promise<boolean> {
    const sandbox = await this.getSandbox(workspaceId);
    return sandbox.files.exists(path);
  }

  /**
   * Run tests
   */
  async runTests(workspaceId: string, cwd: string = '/workspace'): Promise<ExecutionResult> {
    const hasPackageJson = await this.fileExists(workspaceId, `${cwd}/package.json`);

    if (hasPackageJson) {
      // Check if test script exists
      const packageJson = await this.readFile(workspaceId, `${cwd}/package.json`);
      const pkg = JSON.parse(packageJson);

      if (pkg.scripts?.test) {
        return this.executeCommand(workspaceId, 'npm test', { cwd, timeout: 300000 });
      }
    }

    // Try pytest for Python
    const hasPytest =
      (await this.fileExists(workspaceId, `${cwd}/pytest.ini`)) ||
      (await this.fileExists(workspaceId, `${cwd}/tests`));

    if (hasPytest) {
      return this.executeCommand(workspaceId, 'pytest', { cwd, timeout: 300000 });
    }

    // Try go test
    const hasGoMod = await this.fileExists(workspaceId, `${cwd}/go.mod`);
    if (hasGoMod) {
      return this.executeCommand(workspaceId, 'go test ./...', { cwd, timeout: 300000 });
    }

    return {
      stdout: 'No test framework detected',
      stderr: '',
      exitCode: 0,
      executionTime: 0,
    };
  }

  /**
   * Run build
   */
  async runBuild(workspaceId: string, cwd: string = '/workspace'): Promise<ExecutionResult> {
    const hasPackageJson = await this.fileExists(workspaceId, `${cwd}/package.json`);

    if (hasPackageJson) {
      const packageJson = await this.readFile(workspaceId, `${cwd}/package.json`);
      const pkg = JSON.parse(packageJson);

      if (pkg.scripts?.build) {
        return this.executeCommand(workspaceId, 'npm run build', { cwd, timeout: 300000 });
      }
    }

    // Try cargo for Rust
    const hasCargoToml = await this.fileExists(workspaceId, `${cwd}/Cargo.toml`);
    if (hasCargoToml) {
      return this.executeCommand(workspaceId, 'cargo build --release', { cwd, timeout: 300000 });
    }

    // Try go build
    const hasGoMod = await this.fileExists(workspaceId, `${cwd}/go.mod`);
    if (hasGoMod) {
      return this.executeCommand(workspaceId, 'go build ./...', { cwd, timeout: 300000 });
    }

    return {
      stdout: 'No build script detected',
      stderr: '',
      exitCode: 0,
      executionTime: 0,
    };
  }

  /**
   * Start a development server
   */
  async startDevServer(
    workspaceId: string,
    cwd: string = '/workspace',
    port: number = 3000
  ): Promise<{ url: string; pid: number }> {
    const sandbox = await this.getSandbox(workspaceId);

    const hasPackageJson = await this.fileExists(workspaceId, `${cwd}/package.json`);

    if (hasPackageJson) {
      const packageJson = await this.readFile(workspaceId, `${cwd}/package.json`);
      const pkg = JSON.parse(packageJson);

      if (pkg.scripts?.dev) {
        // Run in background
        const handle = await sandbox.commands.run('npm run dev', {
          cwd,
          envs: { PORT: port.toString() },
          background: true,
        });

        // Wait a bit for server to start
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Get the public URL
        const url = sandbox.getHost(port);

        return { url, pid: handle.pid };
      }
    }

    throw new Error('No dev script found');
  }

  /**
   * Get file tree recursively
   * Respects .gitignore when available (Claude Code parity)
   */
  async getFileTree(
    workspaceId: string,
    path: string = '/workspace',
    maxDepth: number = 5
  ): Promise<FileInfo[]> {
    // Common directories to always ignore (security + performance)
    const alwaysIgnore = [
      'node_modules',
      '.git',
      '.next',
      'dist',
      'build',
      '.cache',
      '__pycache__',
      '.venv',
      'venv',
      '.tox',
      'coverage',
      '.nyc_output',
    ];

    // Try git ls-files first if in a git repo (respects .gitignore)
    const isGitRepo = await this.executeCommand(
      workspaceId,
      `cd "${path}" && git rev-parse --git-dir 2>/dev/null`
    );

    let result;
    if (isGitRepo.exitCode === 0) {
      // Use git ls-files for tracked files + ls-files -o for untracked (respects .gitignore)
      result = await this.executeCommand(
        workspaceId,
        `cd "${path}" && (git ls-files; git ls-files -o --exclude-standard) | head -500`
      );
    } else {
      // Fall back to find with common exclusions
      const excludeArgs = alwaysIgnore.map((d) => `-path "*/${d}" -prune -o`).join(' ');
      result = await this.executeCommand(
        workspaceId,
        `find "${path}" -maxdepth ${maxDepth} ${excludeArgs} -type f -print -o -type d -print 2>/dev/null | head -500`
      );
    }

    const files: FileInfo[] = [];
    const paths = result.stdout.split('\n').filter((p) => p.trim());

    for (const filePath of paths) {
      // For git ls-files output, prepend the path if relative
      const fullPath = filePath.startsWith('/') ? filePath : `${path}/${filePath}`;

      const isDir = (
        await this.executeCommand(workspaceId, `test -d "${fullPath}" && echo "dir"`)
      ).stdout.includes('dir');

      files.push({
        path: fullPath,
        isDirectory: isDir,
        size: 0,
        modifiedAt: new Date(),
      });
    }

    return files;
  }

  /**
   * Create a snapshot of the workspace
   */
  async createSnapshot(workspaceId: string, name: string): Promise<string> {
    const fileTree = await this.getFileTree(workspaceId);

    // Get git commit if available
    const gitResult = await this.executeCommand(workspaceId, 'git rev-parse HEAD 2>/dev/null');
    const gitCommit = gitResult.exitCode === 0 ? gitResult.stdout.trim() : undefined;

    const snapshotId = crypto.randomUUID();

    await this.supabase.from('workspace_snapshots').insert({
      id: snapshotId,
      workspace_id: workspaceId,
      name,
      file_tree: fileTree,
      git_commit: gitCommit,
      created_at: new Date().toISOString(),
    });

    return snapshotId;
  }

  /**
   * Terminate a container
   */
  async terminateContainer(workspaceId: string): Promise<void> {
    const sandbox = this.activeSandboxes.get(workspaceId);

    if (sandbox) {
      try {
        await sandbox.kill();
      } catch (e) {
        log.error('Failed to kill sandbox', e as Error);
      }
      this.activeSandboxes.delete(workspaceId);
    }

    await this.supabase
      .from('code_lab_workspaces')
      .update({
        sandbox_id: null,
        status: 'suspended',
        updated_at: new Date().toISOString(),
      })
      .eq('session_id', workspaceId);
  }

  /**
   * Keep container alive (extend timeout by recreating)
   */
  async keepAlive(workspaceId: string): Promise<void> {
    // E2B doesn't have setTimeout, so we reconnect to refresh the timeout
    const sandbox = await this.getSandbox(workspaceId);
    // Just accessing the sandbox refreshes its timeout
    await sandbox.files.exists('/workspace');
  }

  /**
   * Get container status
   */
  async getStatus(workspaceId: string): Promise<{
    isRunning: boolean;
    containerId?: string;
    uptime?: number;
  }> {
    const { data: workspace } = await this.supabase
      .from('code_lab_workspaces')
      .select('sandbox_id, status, updated_at')
      .eq('session_id', workspaceId)
      .single();

    if (!workspace?.sandbox_id) {
      return { isRunning: false };
    }

    // Try to check if sandbox is still alive
    try {
      const sandbox = await Sandbox.connect(workspace.sandbox_id);
      this.activeSandboxes.set(workspaceId, sandbox);

      return {
        isRunning: true,
        containerId: workspace.sandbox_id,
        uptime: Date.now() - new Date(workspace.updated_at).getTime(),
      };
    } catch {
      return { isRunning: false, containerId: workspace.sandbox_id };
    }
  }
}

// ============================================
// STREAMING SHELL
// ============================================

export class StreamingShell {
  private container: ContainerManager;
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.container = new ContainerManager();
    this.workspaceId = workspaceId;
  }

  /**
   * Execute command with real-time streaming
   */
  async execute(
    command: string,
    onOutput: (type: 'stdout' | 'stderr', data: string) => void
  ): Promise<number> {
    const result = await this.container.executeCommand(this.workspaceId, command, {
      stream: {
        onStdout: (data) => onOutput('stdout', data),
        onStderr: (data) => onOutput('stderr', data),
      },
    });

    return result.exitCode;
  }

  /**
   * Create async iterator for streaming output
   */
  async *stream(
    command: string
  ): AsyncGenerator<{ type: 'stdout' | 'stderr' | 'exit'; data: string | number }> {
    const outputQueue: Array<{ type: 'stdout' | 'stderr' | 'exit'; data: string | number }> = [];
    let done = false;

    const promise = this.container.executeCommand(this.workspaceId, command, {
      stream: {
        onStdout: (data) => outputQueue.push({ type: 'stdout', data }),
        onStderr: (data) => outputQueue.push({ type: 'stderr', data }),
        onExit: (code) => {
          outputQueue.push({ type: 'exit', data: code });
          done = true;
        },
      },
    });

    while (!done || outputQueue.length > 0) {
      if (outputQueue.length > 0) {
        yield outputQueue.shift()!;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    await promise;
  }
}

// ============================================
// WORKSPACE EXECUTOR (Convenience Class)
// ============================================

export class WorkspaceExecutor {
  private container: ContainerManager;
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.container = new ContainerManager();
    this.workspaceId = workspaceId;
  }

  // Shell commands
  async run(
    command: string,
    options?: { cwd?: string; timeout?: number }
  ): Promise<ExecutionResult> {
    return this.container.executeCommand(this.workspaceId, command, options);
  }

  // File operations
  async read(path: string): Promise<string> {
    return this.container.readFile(this.workspaceId, path);
  }

  async write(path: string, content: string): Promise<void> {
    return this.container.writeFile(this.workspaceId, path, content);
  }

  async delete(path: string): Promise<void> {
    return this.container.deleteFile(this.workspaceId, path);
  }

  async list(path: string): Promise<FileInfo[]> {
    return this.container.listDirectory(this.workspaceId, path);
  }

  async exists(path: string): Promise<boolean> {
    return this.container.fileExists(this.workspaceId, path);
  }

  // Git operations
  async gitClone(url: string, branch?: string): Promise<ExecutionResult> {
    return this.container.cloneRepository(this.workspaceId, url, branch);
  }

  async gitStatus(): Promise<string> {
    const result = await this.run('git status');
    return result.stdout;
  }

  async gitCommit(message: string): Promise<ExecutionResult> {
    // Sanitize and escape the commit message to prevent command injection
    const sanitized = sanitizeCommitMessage(message);
    const escaped = escapeShellArg(sanitized);
    await this.run('git add .');
    return this.run(`git commit -m ${escaped}`);
  }

  async gitPush(): Promise<ExecutionResult> {
    return this.run('git push');
  }

  // Project operations
  async install(): Promise<ExecutionResult> {
    return this.container.installDependencies(this.workspaceId);
  }

  async build(): Promise<ExecutionResult> {
    return this.container.runBuild(this.workspaceId);
  }

  async test(): Promise<ExecutionResult> {
    return this.container.runTests(this.workspaceId);
  }

  // Lifecycle
  async snapshot(name: string): Promise<string> {
    return this.container.createSnapshot(this.workspaceId, name);
  }

  async terminate(): Promise<void> {
    return this.container.terminateContainer(this.workspaceId);
  }
}

// All exports are inline with their class declarations
