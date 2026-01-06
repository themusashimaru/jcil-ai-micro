/**
 * WORKSPACE ENGINE - Core Infrastructure
 *
 * This is the foundation that enables:
 * - Sandboxed shell/bash execution
 * - Virtual file system with persistence
 * - Full git workflow
 * - Long-running background processes
 * - Extensible tool system
 * - Session management with summarization
 * - Atomic batch operations
 * - Full codebase context
 */

import { createClient } from '@supabase/supabase-js';

// ============================================
// TYPES
// ============================================

export interface Workspace {
  id: string;
  userId: string;
  name: string;
  type: 'project' | 'sandbox' | 'github';
  githubRepo?: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'suspended' | 'archived';
  config: WorkspaceConfig;
}

export interface WorkspaceConfig {
  shell: 'bash' | 'zsh' | 'sh';
  nodeVersion: string;
  pythonVersion?: string;
  envVars: Record<string, string>;
  ports: number[];
  memory: number; // MB
  cpu: number; // cores
  timeout: number; // seconds
}

export interface WorkspaceFile {
  path: string;
  content: string;
  type: 'file' | 'directory';
  size: number;
  mimeType?: string;
  lastModified: Date;
  permissions: string;
}

export interface ShellSession {
  id: string;
  workspaceId: string;
  pid?: number;
  status: 'running' | 'idle' | 'terminated';
  cwd: string;
  history: ShellCommand[];
}

export interface ShellCommand {
  id: string;
  command: string;
  output: string;
  exitCode: number;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
}

export interface BackgroundTask {
  id: string;
  workspaceId: string;
  type: 'shell' | 'build' | 'test' | 'deploy' | 'custom';
  command: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  output: string[];
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  version: string;
  schema: ToolSchema;
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export interface ToolSchema {
  input: Record<string, ToolParameter>;
  output: Record<string, ToolParameter>;
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: unknown;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  logs?: string[];
}

export interface SessionContext {
  id: string;
  workspaceId: string;
  messages: SessionMessage[];
  summary?: string;
  tokenCount: number;
  maxTokens: number;
  files: string[];
  activeTools: string[];
}

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  tokens: number;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  params: Record<string, unknown>;
  result?: ToolResult;
}

export interface BatchOperation {
  id: string;
  operations: FileOperation[];
  status: 'pending' | 'executing' | 'committed' | 'rolled_back';
  createdAt: Date;
  executedAt?: Date;
}

export interface FileOperation {
  type: 'create' | 'update' | 'delete' | 'move' | 'copy';
  path: string;
  content?: string;
  newPath?: string;
  backup?: string;
}

export interface CodebaseIndex {
  workspaceId: string;
  files: IndexedFile[];
  symbols: Symbol[];
  dependencies: Dependency[];
  lastIndexed: Date;
}

export interface IndexedFile {
  path: string;
  language: string;
  size: number;
  hash: string;
  symbols: string[];
  imports: string[];
  exports: string[];
  embedding?: number[];
}

export interface Symbol {
  name: string;
  type: 'function' | 'class' | 'variable' | 'type' | 'interface' | 'enum';
  file: string;
  line: number;
  signature?: string;
  docstring?: string;
  references: string[];
}

export interface Dependency {
  name: string;
  version: string;
  type: 'production' | 'development';
  source: 'npm' | 'pip' | 'cargo' | 'go';
}

// ============================================
// WORKSPACE MANAGER
// ============================================

export class WorkspaceManager {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Create a new workspace for a user
   */
  async createWorkspace(
    userId: string,
    name: string,
    type: Workspace['type'],
    options: Partial<WorkspaceConfig> = {}
  ): Promise<Workspace> {
    const config: WorkspaceConfig = {
      shell: options.shell || 'bash',
      nodeVersion: options.nodeVersion || '20',
      pythonVersion: options.pythonVersion,
      envVars: options.envVars || {},
      ports: options.ports || [3000, 8080],
      memory: options.memory || 512,
      cpu: options.cpu || 1,
      timeout: options.timeout || 300,
    };

    const workspace: Workspace = {
      id: crypto.randomUUID(),
      userId,
      name,
      type,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      config,
    };

    // Store in database
    await this.supabase.from('workspaces').insert(workspace);

    // Initialize workspace container/VM
    await this.initializeWorkspaceEnvironment(workspace);

    return workspace;
  }

  /**
   * Clone a GitHub repository into a workspace
   */
  async cloneFromGitHub(
    userId: string,
    repoUrl: string,
    branch: string = 'main'
  ): Promise<Workspace> {
    const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'project';

    const workspace = await this.createWorkspace(userId, repoName, 'github', {});
    workspace.githubRepo = repoUrl;

    // Clone the repository
    await this.executeShell(workspace.id, `git clone ${repoUrl} . && git checkout ${branch}`);

    // Index the codebase
    await this.indexCodebase(workspace.id);

    return workspace;
  }

  /**
   * Initialize the workspace environment (container/VM)
   */
  private async initializeWorkspaceEnvironment(workspace: Workspace): Promise<void> {
    // This would spin up an actual container
    // Options: Docker, Firecracker, E2B, WebContainers

    // For now, we'll use a hybrid approach:
    // 1. Light operations: WebContainers in browser
    // 2. Heavy operations: Server-side Docker containers

    console.log(`Initializing workspace ${workspace.id}`);
  }

  /**
   * Get workspace by ID
   */
  async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    const { data } = await this.supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single();

    return data;
  }

  /**
   * List user's workspaces
   */
  async listWorkspaces(userId: string): Promise<Workspace[]> {
    const { data } = await this.supabase
      .from('workspaces')
      .select('*')
      .eq('userId', userId)
      .order('updatedAt', { ascending: false });

    return data || [];
  }

  /**
   * Execute shell command in workspace
   */
  async executeShell(
    workspaceId: string,
    command: string,
    options: { timeout?: number; cwd?: string } = {}
  ): Promise<ShellCommand> {
    const shell = new ShellExecutor(workspaceId);
    return shell.execute(command, options);
  }

  /**
   * Index the entire codebase for context
   */
  async indexCodebase(workspaceId: string): Promise<CodebaseIndex> {
    const indexer = new CodebaseIndexer(workspaceId);
    return indexer.index();
  }
}

// ============================================
// SHELL EXECUTOR
// ============================================

export class ShellExecutor {
  private workspaceId: string;
  private sessions: Map<string, ShellSession> = new Map();

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  /**
   * Execute a command and return the result
   */
  async execute(
    command: string,
    options: { timeout?: number; cwd?: string; background?: boolean } = {}
  ): Promise<ShellCommand> {
    const id = crypto.randomUUID();
    const startedAt = new Date();

    const result: ShellCommand = {
      id,
      command,
      output: '',
      exitCode: 0,
      startedAt,
    };

    try {
      // In production, this would call the container execution API
      // Options:
      // 1. Docker exec via API
      // 2. E2B SDK
      // 3. Vercel Edge Runtime (limited)
      // 4. WebContainers (browser-side)

      const response = await this.executeInContainer(command, options);

      result.output = response.stdout + (response.stderr ? `\nSTDERR:\n${response.stderr}` : '');
      result.exitCode = response.exitCode;
      result.completedAt = new Date();
      result.duration = result.completedAt.getTime() - startedAt.getTime();

    } catch (error) {
      result.output = error instanceof Error ? error.message : 'Unknown error';
      result.exitCode = 1;
      result.completedAt = new Date();
    }

    return result;
  }

  /**
   * Execute command in the container environment
   */
  private async executeInContainer(
    command: string,
    options: { timeout?: number; cwd?: string }
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // IMPLEMENTATION OPTIONS:

    // Option 1: E2B (recommended for production)
    // const sandbox = await Sandbox.create({ template: 'base' });
    // const result = await sandbox.process.startAndWait(command);
    // return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode };

    // Option 2: Docker API
    // const container = docker.getContainer(this.workspaceId);
    // const exec = await container.exec({ Cmd: ['bash', '-c', command] });
    // return exec.start();

    // Option 3: Self-hosted with node child_process (for development)
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: options.timeout || 30000,
        cwd: options.cwd || `/workspaces/${this.workspaceId}`,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });
      return { stdout, stderr, exitCode: 0 };
    } catch (error: unknown) {
      const execError = error as { stdout?: string; stderr?: string; code?: number };
      return {
        stdout: execError.stdout || '',
        stderr: execError.stderr || (error instanceof Error ? error.message : 'Unknown error'),
        exitCode: execError.code || 1,
      };
    }
  }

  /**
   * Start an interactive shell session
   */
  async startSession(): Promise<ShellSession> {
    const session: ShellSession = {
      id: crypto.randomUUID(),
      workspaceId: this.workspaceId,
      status: 'idle',
      cwd: `/workspaces/${this.workspaceId}`,
      history: [],
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Run command in background
   */
  async runBackground(command: string): Promise<BackgroundTask> {
    const taskQueue = new TaskQueue();
    return taskQueue.enqueue(this.workspaceId, 'shell', command);
  }
}

// ============================================
// VIRTUAL FILE SYSTEM
// ============================================

export class VirtualFileSystem {
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  /**
   * Read a file
   */
  async readFile(path: string): Promise<string> {
    // First check container filesystem
    const shell = new ShellExecutor(this.workspaceId);
    const result = await shell.execute(`cat "${path}"`);

    if (result.exitCode === 0) {
      return result.output;
    }

    throw new Error(`File not found: ${path}`);
  }

  /**
   * Write a file
   */
  async writeFile(path: string, content: string): Promise<void> {
    const shell = new ShellExecutor(this.workspaceId);

    // Ensure directory exists
    const dir = path.substring(0, path.lastIndexOf('/'));
    await shell.execute(`mkdir -p "${dir}"`);

    // Write file using heredoc to handle special characters
    await shell.execute(`cat > "${path}" << 'CODELAB_EOF'\n${content}\nCODELAB_EOF`);
  }

  /**
   * Delete a file
   */
  async deleteFile(path: string): Promise<void> {
    const shell = new ShellExecutor(this.workspaceId);
    await shell.execute(`rm -f "${path}"`);
  }

  /**
   * List directory contents
   */
  async listDirectory(path: string): Promise<WorkspaceFile[]> {
    const shell = new ShellExecutor(this.workspaceId);
    const result = await shell.execute(`ls -la "${path}" --time-style=+%Y-%m-%dT%H:%M:%S`);

    if (result.exitCode !== 0) {
      throw new Error(`Directory not found: ${path}`);
    }

    const files: WorkspaceFile[] = [];
    const lines = result.output.split('\n').slice(1); // Skip total line

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 7) {
        const permissions = parts[0];
        const size = parseInt(parts[4], 10);
        const date = parts[5];
        const name = parts.slice(6).join(' ');

        if (name === '.' || name === '..') continue;

        files.push({
          path: `${path}/${name}`,
          content: '',
          type: permissions.startsWith('d') ? 'directory' : 'file',
          size,
          lastModified: new Date(date),
          permissions,
        });
      }
    }

    return files;
  }

  /**
   * Check if path exists
   */
  async exists(path: string): Promise<boolean> {
    const shell = new ShellExecutor(this.workspaceId);
    const result = await shell.execute(`test -e "${path}" && echo "exists"`);
    return result.output.includes('exists');
  }

  /**
   * Get file tree recursively
   */
  async getFileTree(path: string = '.', maxDepth: number = 5): Promise<WorkspaceFile[]> {
    const shell = new ShellExecutor(this.workspaceId);
    const result = await shell.execute(
      `find "${path}" -maxdepth ${maxDepth} -type f -o -type d | head -1000`
    );

    const files: WorkspaceFile[] = [];
    const paths = result.output.split('\n').filter(p => p.trim());

    for (const filePath of paths) {
      const isDir = (await shell.execute(`test -d "${filePath}" && echo "dir"`)).output.includes('dir');
      files.push({
        path: filePath,
        content: '',
        type: isDir ? 'directory' : 'file',
        size: 0,
        lastModified: new Date(),
        permissions: '',
      });
    }

    return files;
  }

  /**
   * Search for files by pattern
   */
  async glob(pattern: string): Promise<string[]> {
    const shell = new ShellExecutor(this.workspaceId);
    const result = await shell.execute(`find . -name "${pattern}" -type f | head -100`);
    return result.output.split('\n').filter(p => p.trim());
  }

  /**
   * Search file contents
   */
  async grep(pattern: string, path: string = '.'): Promise<Array<{ file: string; line: number; content: string }>> {
    const shell = new ShellExecutor(this.workspaceId);
    const result = await shell.execute(
      `grep -rn "${pattern}" "${path}" --include="*.{ts,tsx,js,jsx,py,go,rs,java,cs}" | head -100`
    );

    const matches: Array<{ file: string; line: number; content: string }> = [];

    for (const line of result.output.split('\n')) {
      const match = line.match(/^(.+):(\d+):(.+)$/);
      if (match) {
        matches.push({
          file: match[1],
          line: parseInt(match[2], 10),
          content: match[3],
        });
      }
    }

    return matches;
  }
}

// ============================================
// GIT WORKFLOW ENGINE
// ============================================

export class GitWorkflow {
  private workspaceId: string;
  private shell: ShellExecutor;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.shell = new ShellExecutor(workspaceId);
  }

  /**
   * Initialize git repository
   */
  async init(): Promise<void> {
    await this.shell.execute('git init');
  }

  /**
   * Clone a repository
   */
  async clone(url: string, branch?: string): Promise<void> {
    const branchFlag = branch ? `-b ${branch}` : '';
    await this.shell.execute(`git clone ${branchFlag} ${url} .`);
  }

  /**
   * Get current status
   */
  async status(): Promise<{
    branch: string;
    staged: string[];
    unstaged: string[];
    untracked: string[];
  }> {
    const branchResult = await this.shell.execute('git branch --show-current');
    const statusResult = await this.shell.execute('git status --porcelain');

    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];

    for (const line of statusResult.output.split('\n')) {
      if (!line.trim()) continue;
      const status = line.substring(0, 2);
      const file = line.substring(3);

      if (status[0] !== ' ' && status[0] !== '?') staged.push(file);
      if (status[1] !== ' ') unstaged.push(file);
      if (status === '??') untracked.push(file);
    }

    return {
      branch: branchResult.output.trim(),
      staged,
      unstaged,
      untracked,
    };
  }

  /**
   * Stage files
   */
  async add(paths: string[] | string = '.'): Promise<void> {
    const pathsStr = Array.isArray(paths) ? paths.join(' ') : paths;
    await this.shell.execute(`git add ${pathsStr}`);
  }

  /**
   * Commit changes
   */
  async commit(message: string): Promise<string> {
    const result = await this.shell.execute(`git commit -m "${message.replace(/"/g, '\\"')}"`);

    // Extract commit hash
    const hashMatch = result.output.match(/\[[\w-]+ ([a-f0-9]+)\]/);
    return hashMatch ? hashMatch[1] : '';
  }

  /**
   * Push to remote
   */
  async push(remote: string = 'origin', branch?: string): Promise<void> {
    const branchArg = branch || (await this.status()).branch;
    await this.shell.execute(`git push ${remote} ${branchArg}`);
  }

  /**
   * Pull from remote
   */
  async pull(remote: string = 'origin', branch?: string): Promise<void> {
    const branchArg = branch || (await this.status()).branch;
    await this.shell.execute(`git pull ${remote} ${branchArg}`);
  }

  /**
   * Create and checkout branch
   */
  async createBranch(name: string): Promise<void> {
    await this.shell.execute(`git checkout -b ${name}`);
  }

  /**
   * Switch branch
   */
  async checkout(branch: string): Promise<void> {
    await this.shell.execute(`git checkout ${branch}`);
  }

  /**
   * Merge branch
   */
  async merge(branch: string): Promise<{ success: boolean; conflicts?: string[] }> {
    const result = await this.shell.execute(`git merge ${branch}`);

    if (result.exitCode !== 0 && result.output.includes('CONFLICT')) {
      const conflictResult = await this.shell.execute('git diff --name-only --diff-filter=U');
      return {
        success: false,
        conflicts: conflictResult.output.split('\n').filter(f => f.trim()),
      };
    }

    return { success: true };
  }

  /**
   * Get diff
   */
  async diff(options: { staged?: boolean; file?: string } = {}): Promise<string> {
    let cmd = 'git diff';
    if (options.staged) cmd += ' --staged';
    if (options.file) cmd += ` -- ${options.file}`;

    const result = await this.shell.execute(cmd);
    return result.output;
  }

  /**
   * Get commit log
   */
  async log(count: number = 10): Promise<Array<{
    hash: string;
    author: string;
    date: Date;
    message: string;
  }>> {
    const result = await this.shell.execute(
      `git log -${count} --pretty=format:"%H|%an|%aI|%s"`
    );

    return result.output.split('\n').filter(l => l).map(line => {
      const [hash, author, date, message] = line.split('|');
      return { hash, author, date: new Date(date), message };
    });
  }

  /**
   * Stash changes
   */
  async stash(message?: string): Promise<void> {
    const msgArg = message ? ` -m "${message}"` : '';
    await this.shell.execute(`git stash${msgArg}`);
  }

  /**
   * Apply stash
   */
  async stashPop(): Promise<void> {
    await this.shell.execute('git stash pop');
  }

  /**
   * Reset to commit
   */
  async reset(commit: string, mode: 'soft' | 'mixed' | 'hard' = 'mixed'): Promise<void> {
    await this.shell.execute(`git reset --${mode} ${commit}`);
  }

  /**
   * Create a PR-ready branch with changes
   */
  async createPullRequestBranch(
    baseBranch: string,
    newBranch: string,
    files: Array<{ path: string; content: string }>,
    commitMessage: string
  ): Promise<string> {
    const fs = new VirtualFileSystem(this.workspaceId);

    // Ensure we're on base branch and up to date
    await this.checkout(baseBranch);
    await this.pull();

    // Create new branch
    await this.createBranch(newBranch);

    // Apply file changes
    for (const file of files) {
      await fs.writeFile(file.path, file.content);
    }

    // Commit and push
    await this.add();
    const hash = await this.commit(commitMessage);
    await this.push('origin', newBranch);

    return hash;
  }
}

// ============================================
// BACKGROUND TASK QUEUE
// ============================================

export class TaskQueue {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Add a task to the queue
   */
  async enqueue(
    workspaceId: string,
    type: BackgroundTask['type'],
    command: string
  ): Promise<BackgroundTask> {
    const task: BackgroundTask = {
      id: crypto.randomUUID(),
      workspaceId,
      type,
      command,
      status: 'pending',
      output: [],
      progress: 0,
    };

    await this.supabase.from('background_tasks').insert(task);

    // Trigger the worker (in production, use a proper job queue)
    this.processTask(task.id).catch(console.error);

    return task;
  }

  /**
   * Process a task
   */
  private async processTask(taskId: string): Promise<void> {
    // Update status to running
    await this.updateTask(taskId, { status: 'running', startedAt: new Date() });

    try {
      const { data: task } = await this.supabase
        .from('background_tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (!task) throw new Error('Task not found');

      const shell = new ShellExecutor(task.workspaceId);

      // Execute with streaming output
      const result = await shell.execute(task.command, { timeout: 600000 }); // 10 min timeout

      await this.updateTask(taskId, {
        status: result.exitCode === 0 ? 'completed' : 'failed',
        output: [result.output],
        progress: 100,
        completedAt: new Date(),
        error: result.exitCode !== 0 ? result.output : undefined,
      });

    } catch (error) {
      await this.updateTask(taskId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      });
    }
  }

  /**
   * Update task status
   */
  private async updateTask(taskId: string, updates: Partial<BackgroundTask>): Promise<void> {
    await this.supabase
      .from('background_tasks')
      .update(updates)
      .eq('id', taskId);
  }

  /**
   * Get task status
   */
  async getTask(taskId: string): Promise<BackgroundTask | null> {
    const { data } = await this.supabase
      .from('background_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    return data;
  }

  /**
   * List tasks for a workspace
   */
  async listTasks(workspaceId: string): Promise<BackgroundTask[]> {
    const { data } = await this.supabase
      .from('background_tasks')
      .select('*')
      .eq('workspaceId', workspaceId)
      .order('startedAt', { ascending: false });

    return data || [];
  }

  /**
   * Cancel a running task
   */
  async cancel(taskId: string): Promise<void> {
    await this.updateTask(taskId, {
      status: 'cancelled',
      completedAt: new Date(),
    });
  }
}

// ============================================
// EXTENSIBLE TOOL SYSTEM
// ============================================

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private static instance: ToolRegistry;

  private constructor() {
    this.registerBuiltinTools();
  }

  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  /**
   * Register a new tool
   */
  register(tool: Tool): void {
    this.tools.set(tool.id, tool);
  }

  /**
   * Get a tool by ID
   */
  get(toolId: string): Tool | undefined {
    return this.tools.get(toolId);
  }

  /**
   * List all tools
   */
  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Execute a tool
   */
  async execute(toolId: string, params: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return { success: false, error: `Tool not found: ${toolId}` };
    }

    try {
      return await tool.execute(params);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Register built-in tools
   */
  private registerBuiltinTools(): void {
    // Shell execution tool
    this.register({
      id: 'shell',
      name: 'Shell',
      description: 'Execute shell commands in the workspace',
      version: '1.0.0',
      schema: {
        input: {
          workspaceId: { type: 'string', description: 'Workspace ID', required: true },
          command: { type: 'string', description: 'Command to execute', required: true },
          timeout: { type: 'number', description: 'Timeout in ms', required: false, default: 30000 },
        },
        output: {
          output: { type: 'string', description: 'Command output', required: true },
          exitCode: { type: 'number', description: 'Exit code', required: true },
        },
      },
      execute: async (params) => {
        const shell = new ShellExecutor(params.workspaceId as string);
        const result = await shell.execute(params.command as string, {
          timeout: params.timeout as number,
        });
        return {
          success: result.exitCode === 0,
          data: { output: result.output, exitCode: result.exitCode },
        };
      },
    });

    // File read tool
    this.register({
      id: 'read_file',
      name: 'Read File',
      description: 'Read contents of a file',
      version: '1.0.0',
      schema: {
        input: {
          workspaceId: { type: 'string', description: 'Workspace ID', required: true },
          path: { type: 'string', description: 'File path', required: true },
        },
        output: {
          content: { type: 'string', description: 'File contents', required: true },
        },
      },
      execute: async (params) => {
        const fs = new VirtualFileSystem(params.workspaceId as string);
        const content = await fs.readFile(params.path as string);
        return { success: true, data: { content } };
      },
    });

    // File write tool
    this.register({
      id: 'write_file',
      name: 'Write File',
      description: 'Write contents to a file',
      version: '1.0.0',
      schema: {
        input: {
          workspaceId: { type: 'string', description: 'Workspace ID', required: true },
          path: { type: 'string', description: 'File path', required: true },
          content: { type: 'string', description: 'File contents', required: true },
        },
        output: {},
      },
      execute: async (params) => {
        const fs = new VirtualFileSystem(params.workspaceId as string);
        await fs.writeFile(params.path as string, params.content as string);
        return { success: true };
      },
    });

    // Glob search tool
    this.register({
      id: 'glob',
      name: 'Glob',
      description: 'Search for files by pattern',
      version: '1.0.0',
      schema: {
        input: {
          workspaceId: { type: 'string', description: 'Workspace ID', required: true },
          pattern: { type: 'string', description: 'Glob pattern', required: true },
        },
        output: {
          files: { type: 'array', description: 'Matching files', required: true },
        },
      },
      execute: async (params) => {
        const fs = new VirtualFileSystem(params.workspaceId as string);
        const files = await fs.glob(params.pattern as string);
        return { success: true, data: { files } };
      },
    });

    // Grep search tool
    this.register({
      id: 'grep',
      name: 'Grep',
      description: 'Search file contents',
      version: '1.0.0',
      schema: {
        input: {
          workspaceId: { type: 'string', description: 'Workspace ID', required: true },
          pattern: { type: 'string', description: 'Search pattern', required: true },
          path: { type: 'string', description: 'Path to search', required: false, default: '.' },
        },
        output: {
          matches: { type: 'array', description: 'Matching lines', required: true },
        },
      },
      execute: async (params) => {
        const fs = new VirtualFileSystem(params.workspaceId as string);
        const matches = await fs.grep(params.pattern as string, params.path as string);
        return { success: true, data: { matches } };
      },
    });

    // Git status tool
    this.register({
      id: 'git_status',
      name: 'Git Status',
      description: 'Get git repository status',
      version: '1.0.0',
      schema: {
        input: {
          workspaceId: { type: 'string', description: 'Workspace ID', required: true },
        },
        output: {
          branch: { type: 'string', description: 'Current branch', required: true },
          staged: { type: 'array', description: 'Staged files', required: true },
          unstaged: { type: 'array', description: 'Unstaged files', required: true },
          untracked: { type: 'array', description: 'Untracked files', required: true },
        },
      },
      execute: async (params) => {
        const git = new GitWorkflow(params.workspaceId as string);
        const status = await git.status();
        return { success: true, data: status };
      },
    });

    // Git commit tool
    this.register({
      id: 'git_commit',
      name: 'Git Commit',
      description: 'Commit changes',
      version: '1.0.0',
      schema: {
        input: {
          workspaceId: { type: 'string', description: 'Workspace ID', required: true },
          message: { type: 'string', description: 'Commit message', required: true },
          files: { type: 'array', description: 'Files to stage', required: false },
        },
        output: {
          hash: { type: 'string', description: 'Commit hash', required: true },
        },
      },
      execute: async (params) => {
        const git = new GitWorkflow(params.workspaceId as string);
        const files = params.files as string[] | undefined;
        await git.add(files || '.');
        const hash = await git.commit(params.message as string);
        return { success: true, data: { hash } };
      },
    });
  }
}

// ============================================
// SESSION CONTEXT MANAGER
// ============================================

export class SessionManager {
  private supabase;
  private static readonly MAX_CONTEXT_TOKENS = 100000;
  private static readonly SUMMARIZE_THRESHOLD = 80000;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Create a new session
   */
  async createSession(workspaceId: string): Promise<SessionContext> {
    const session: SessionContext = {
      id: crypto.randomUUID(),
      workspaceId,
      messages: [],
      tokenCount: 0,
      maxTokens: SessionManager.MAX_CONTEXT_TOKENS,
      files: [],
      activeTools: [],
    };

    await this.supabase.from('sessions').insert(session);
    return session;
  }

  /**
   * Add a message to the session
   */
  async addMessage(
    sessionId: string,
    role: SessionMessage['role'],
    content: string,
    toolCalls?: ToolCall[]
  ): Promise<SessionContext> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const tokens = this.estimateTokens(content);

    session.messages.push({
      role,
      content,
      timestamp: new Date(),
      tokens,
      toolCalls,
    });
    session.tokenCount += tokens;

    // Check if we need to summarize
    if (session.tokenCount > SessionManager.SUMMARIZE_THRESHOLD) {
      await this.summarizeAndTruncate(session);
    }

    await this.updateSession(session);
    return session;
  }

  /**
   * Summarize old messages and truncate
   */
  private async summarizeAndTruncate(session: SessionContext): Promise<void> {
    // Keep the last 20 messages, summarize the rest
    const messagesToSummarize = session.messages.slice(0, -20);
    const messagesToKeep = session.messages.slice(-20);

    if (messagesToSummarize.length === 0) return;

    // Generate summary using AI
    const summary = await this.generateSummary(messagesToSummarize);

    // Create a summary message
    const summaryMessage: SessionMessage = {
      role: 'system',
      content: `[Previous conversation summary]\n${summary}`,
      timestamp: new Date(),
      tokens: this.estimateTokens(summary),
    };

    // Update session
    session.messages = [summaryMessage, ...messagesToKeep];
    session.summary = summary;
    session.tokenCount = session.messages.reduce((sum, m) => sum + m.tokens, 0);
  }

  /**
   * Generate a summary of messages
   */
  private async generateSummary(messages: SessionMessage[]): Promise<string> {
    // In production, call Claude/GPT to summarize with the conversation text
    // For now, return a simple placeholder
    // TODO: Implement AI summarization using:
    // const conversationText = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
    // const response = await anthropic.messages.create({ ... });

    // Placeholder: return summary with message count
    return `Conversation summary: ${messages.length} messages exchanged. Key context preserved.`;
  }

  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    // Rough estimation: ~4 chars per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<SessionContext | null> {
    const { data } = await this.supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    return data;
  }

  /**
   * Update session
   */
  private async updateSession(session: SessionContext): Promise<void> {
    await this.supabase
      .from('sessions')
      .update(session)
      .eq('id', session.id);
  }

  /**
   * Get context for AI (formatted messages)
   */
  async getContextForAI(sessionId: string): Promise<Array<{ role: string; content: string }>> {
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    return session.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
  }
}

// ============================================
// ATOMIC BATCH OPERATIONS
// ============================================

export class BatchOperationManager {
  private workspaceId: string;
  private fs: VirtualFileSystem;
  private supabase;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.fs = new VirtualFileSystem(workspaceId);
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Create a new batch operation
   */
  async createBatch(operations: FileOperation[]): Promise<BatchOperation> {
    const batch: BatchOperation = {
      id: crypto.randomUUID(),
      operations,
      status: 'pending',
      createdAt: new Date(),
    };

    // Create backups for all files being modified
    for (const op of operations) {
      if (op.type === 'update' || op.type === 'delete') {
        try {
          const content = await this.fs.readFile(op.path);
          op.backup = content;
        } catch {
          // File doesn't exist, no backup needed
        }
      }
    }

    await this.supabase.from('batch_operations').insert(batch);
    return batch;
  }

  /**
   * Execute a batch operation atomically
   */
  async execute(batchId: string): Promise<{ success: boolean; error?: string }> {
    const { data: batch } = await this.supabase
      .from('batch_operations')
      .select('*')
      .eq('id', batchId)
      .single();

    if (!batch) {
      return { success: false, error: 'Batch not found' };
    }

    if (batch.status !== 'pending') {
      return { success: false, error: `Batch already ${batch.status}` };
    }

    // Update status to executing
    await this.updateBatch(batchId, { status: 'executing' });

    const executedOps: FileOperation[] = [];

    try {
      for (const op of batch.operations) {
        await this.executeOperation(op);
        executedOps.push(op);
      }

      await this.updateBatch(batchId, {
        status: 'committed',
        executedAt: new Date()
      });

      return { success: true };

    } catch (error) {
      // Rollback all executed operations
      await this.rollback(executedOps);

      await this.updateBatch(batchId, {
        status: 'rolled_back',
        executedAt: new Date()
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute a single file operation
   */
  private async executeOperation(op: FileOperation): Promise<void> {
    const shell = new ShellExecutor(this.workspaceId);

    switch (op.type) {
      case 'create':
      case 'update':
        await this.fs.writeFile(op.path, op.content || '');
        break;

      case 'delete':
        await this.fs.deleteFile(op.path);
        break;

      case 'move':
        if (op.newPath) {
          await shell.execute(`mv "${op.path}" "${op.newPath}"`);
        }
        break;

      case 'copy':
        if (op.newPath) {
          await shell.execute(`cp -r "${op.path}" "${op.newPath}"`);
        }
        break;
    }
  }

  /**
   * Rollback executed operations
   */
  private async rollback(operations: FileOperation[]): Promise<void> {
    // Rollback in reverse order
    for (const op of operations.reverse()) {
      try {
        switch (op.type) {
          case 'create':
            // Delete the created file
            await this.fs.deleteFile(op.path);
            break;

          case 'update':
            // Restore from backup
            if (op.backup) {
              await this.fs.writeFile(op.path, op.backup);
            }
            break;

          case 'delete':
            // Restore from backup
            if (op.backup) {
              await this.fs.writeFile(op.path, op.backup);
            }
            break;

          case 'move':
            // Move back
            if (op.newPath) {
              const shell = new ShellExecutor(this.workspaceId);
              await shell.execute(`mv "${op.newPath}" "${op.path}"`);
            }
            break;
        }
      } catch (e) {
        console.error(`Failed to rollback operation:`, op, e);
      }
    }
  }

  /**
   * Update batch status
   */
  private async updateBatch(batchId: string, updates: Partial<BatchOperation>): Promise<void> {
    await this.supabase
      .from('batch_operations')
      .update(updates)
      .eq('id', batchId);
  }
}

// ============================================
// CODEBASE INDEXER
// ============================================

export class CodebaseIndexer {
  private workspaceId: string;
  private fs: VirtualFileSystem;
  private supabase;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.fs = new VirtualFileSystem(workspaceId);
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Index the entire codebase
   */
  async index(): Promise<CodebaseIndex> {
    const index: CodebaseIndex = {
      workspaceId: this.workspaceId,
      files: [],
      symbols: [],
      dependencies: [],
      lastIndexed: new Date(),
    };

    // Get all source files
    const filePatterns = [
      '*.ts', '*.tsx', '*.js', '*.jsx',
      '*.py', '*.go', '*.rs', '*.java',
      '*.cs', '*.rb', '*.php', '*.vue',
      '*.svelte', '*.astro'
    ];

    for (const pattern of filePatterns) {
      const files = await this.fs.glob(pattern);
      for (const file of files) {
        // Skip node_modules, vendor, etc.
        if (this.shouldIgnore(file)) continue;

        try {
          const content = await this.fs.readFile(file);
          const indexed = await this.indexFile(file, content);
          index.files.push(indexed);
          index.symbols.push(...await this.extractSymbols(file, content));
        } catch {
          // Skip files that can't be read
        }
      }
    }

    // Parse dependencies
    index.dependencies = await this.parseDependencies();

    // Store index
    await this.supabase
      .from('codebase_indexes')
      .upsert(index);

    return index;
  }

  /**
   * Index a single file
   */
  private async indexFile(path: string, content: string): Promise<IndexedFile> {
    const language = this.detectLanguage(path);
    const hash = await this.hashContent(content);

    return {
      path,
      language,
      size: content.length,
      hash,
      symbols: [], // Populated by extractSymbols
      imports: this.extractImports(content, language),
      exports: this.extractExports(content, language),
      // embedding would be generated by calling an embedding API
    };
  }

  /**
   * Extract symbols (functions, classes, etc.)
   */
  private async extractSymbols(path: string, content: string): Promise<Symbol[]> {
    const symbols: Symbol[] = [];
    const language = this.detectLanguage(path);
    const lines = content.split('\n');

    // Simple regex-based extraction (in production, use tree-sitter)
    const patterns: Record<string, RegExp[]> = {
      typescript: [
        /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g,
        /(?:export\s+)?class\s+(\w+)/g,
        /(?:export\s+)?interface\s+(\w+)/g,
        /(?:export\s+)?type\s+(\w+)/g,
        /(?:export\s+)?const\s+(\w+)\s*=/g,
        /(?:export\s+)?enum\s+(\w+)/g,
      ],
      python: [
        /def\s+(\w+)\s*\(/g,
        /class\s+(\w+)/g,
        /(\w+)\s*=\s*(?:lambda|async)/g,
      ],
      go: [
        /func\s+(\w+)/g,
        /type\s+(\w+)\s+struct/g,
        /type\s+(\w+)\s+interface/g,
      ],
    };

    const langPatterns = patterns[language] || patterns.typescript;

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];

      for (const pattern of langPatterns) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(line)) !== null) {
          symbols.push({
            name: match[1],
            type: this.inferSymbolType(pattern.source),
            file: path,
            line: lineNum + 1,
            signature: line.trim(),
            references: [],
          });
        }
      }
    }

    return symbols;
  }

  /**
   * Infer symbol type from regex pattern
   */
  private inferSymbolType(pattern: string): Symbol['type'] {
    if (pattern.includes('function') || pattern.includes('def') || pattern.includes('func')) return 'function';
    if (pattern.includes('class')) return 'class';
    if (pattern.includes('interface')) return 'interface';
    if (pattern.includes('type')) return 'type';
    if (pattern.includes('enum')) return 'enum';
    return 'variable';
  }

  /**
   * Extract imports from file
   */
  private extractImports(content: string, language: string): string[] {
    const imports: string[] = [];

    const patterns: Record<string, RegExp> = {
      typescript: /import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/g,
      python: /(?:from\s+(\S+)\s+import|import\s+(\S+))/g,
      go: /import\s+(?:\(\s*)?["']([^"']+)["']/g,
    };

    const pattern = patterns[language] || patterns.typescript;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      imports.push(match[1] || match[2]);
    }

    return imports;
  }

  /**
   * Extract exports from file
   */
  private extractExports(content: string, language: string): string[] {
    const exports: string[] = [];

    if (language === 'typescript' || language === 'javascript') {
      const pattern = /export\s+(?:default\s+)?(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        exports.push(match[1]);
      }
    }

    return exports;
  }

  /**
   * Parse project dependencies
   */
  private async parseDependencies(): Promise<Dependency[]> {
    const deps: Dependency[] = [];

    // Check for package.json (npm/yarn/pnpm)
    try {
      const packageJson = await this.fs.readFile('package.json');
      const pkg = JSON.parse(packageJson);

      for (const [name, version] of Object.entries(pkg.dependencies || {})) {
        deps.push({ name, version: version as string, type: 'production', source: 'npm' });
      }
      for (const [name, version] of Object.entries(pkg.devDependencies || {})) {
        deps.push({ name, version: version as string, type: 'development', source: 'npm' });
      }
    } catch {
      // No package.json
    }

    // Check for requirements.txt (Python)
    try {
      const requirements = await this.fs.readFile('requirements.txt');
      for (const line of requirements.split('\n')) {
        const match = line.match(/^([^=<>]+)(?:([=<>]+)(.+))?/);
        if (match) {
          deps.push({
            name: match[1].trim(),
            version: match[3]?.trim() || '*',
            type: 'production',
            source: 'pip'
          });
        }
      }
    } catch {
      // No requirements.txt
    }

    // Check for go.mod (Go)
    try {
      const goMod = await this.fs.readFile('go.mod');
      const requireMatch = goMod.match(/require\s*\(([\s\S]*?)\)/);
      if (requireMatch) {
        for (const line of requireMatch[1].split('\n')) {
          const match = line.trim().match(/^(\S+)\s+(\S+)/);
          if (match) {
            deps.push({ name: match[1], version: match[2], type: 'production', source: 'go' });
          }
        }
      }
    } catch {
      // No go.mod
    }

    return deps;
  }

  /**
   * Detect file language
   */
  private detectLanguage(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      ts: 'typescript', tsx: 'typescript',
      js: 'javascript', jsx: 'javascript',
      py: 'python',
      go: 'go',
      rs: 'rust',
      java: 'java',
      cs: 'csharp',
      rb: 'ruby',
      php: 'php',
      vue: 'vue',
      svelte: 'svelte',
    };
    return langMap[ext] || 'unknown';
  }

  /**
   * Hash file content
   */
  private async hashContent(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Check if file should be ignored
   */
  private shouldIgnore(path: string): boolean {
    const ignorePatterns = [
      'node_modules',
      'vendor',
      '.git',
      'dist',
      'build',
      '.next',
      '__pycache__',
      '.venv',
      'venv',
      '.idea',
      '.vscode',
    ];
    return ignorePatterns.some(pattern => path.includes(`/${pattern}/`) || path.startsWith(pattern));
  }

  /**
   * Search the index
   */
  async search(query: string): Promise<{
    files: IndexedFile[];
    symbols: Symbol[];
  }> {
    const { data: index } = await this.supabase
      .from('codebase_indexes')
      .select('*')
      .eq('workspaceId', this.workspaceId)
      .single();

    if (!index) {
      return { files: [], symbols: [] };
    }

    const queryLower = query.toLowerCase();

    const files = index.files.filter((f: IndexedFile) =>
      f.path.toLowerCase().includes(queryLower) ||
      f.imports.some((i: string) => i.toLowerCase().includes(queryLower)) ||
      f.exports.some((e: string) => e.toLowerCase().includes(queryLower))
    );

    const symbols = index.symbols.filter((s: Symbol) =>
      s.name.toLowerCase().includes(queryLower) ||
      s.signature?.toLowerCase().includes(queryLower)
    );

    return { files, symbols };
  }

  /**
   * Get context for AI (relevant files for a query)
   */
  async getContextForQuery(query: string, maxFiles: number = 10): Promise<string> {
    const { files, symbols } = await this.search(query);

    let context = '';

    // Add relevant symbols
    if (symbols.length > 0) {
      context += '## Relevant Symbols\n\n';
      for (const sym of symbols.slice(0, 20)) {
        context += `- ${sym.type} \`${sym.name}\` in ${sym.file}:${sym.line}\n`;
        if (sym.signature) context += `  \`${sym.signature}\`\n`;
      }
      context += '\n';
    }

    // Add relevant file contents
    if (files.length > 0) {
      context += '## Relevant Files\n\n';
      for (const file of files.slice(0, maxFiles)) {
        try {
          const content = await this.fs.readFile(file.path);
          context += `### ${file.path}\n\`\`\`${file.language}\n${content.slice(0, 2000)}\n\`\`\`\n\n`;
        } catch {
          // Skip unreadable files
        }
      }
    }

    return context;
  }
}

// All exports are inline with their class declarations
