// @ts-nocheck - Test file with extensive mocking; strict types not needed
/**
 * WORKSPACE ENGINE TESTS
 *
 * Comprehensive tests for the workspace engine including:
 * - WorkspaceManager CRUD operations
 * - ShellExecutor command execution
 * - VirtualFileSystem file operations
 * - GitWorkflow git operations
 * - TaskQueue background task management
 * - ToolRegistry tool registration and execution
 * - SessionManager session and message handling
 * - BatchOperationManager atomic file operations
 * - CodebaseIndexer codebase analysis
 *
 * All external dependencies (Supabase, child_process) are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks – must be declared before importing the module under test
// ---------------------------------------------------------------------------

// Supabase mock builder
const mockSingle = vi.fn().mockResolvedValue({ data: null });
const mockOrder = vi.fn(() => ({ data: [] }));
const mockEq = vi.fn().mockReturnValue({ single: mockSingle, order: mockOrder, data: [] });
const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
const mockUpsert = vi.fn().mockResolvedValue({ data: null });
const mockInsert = vi.fn().mockResolvedValue({ data: null });
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq, order: mockOrder });
const mockFrom = vi.fn().mockReturnValue({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  upsert: mockUpsert,
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/lib/security/shell-escape', () => ({
  escapeShellArg: (arg: string) => `'${arg}'`,
  sanitizeCommitMessage: (msg: string) => msg,
}));

// Mock child_process exec
const mockExecAsync = vi.fn();
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));
vi.mock('util', () => ({
  promisify: () => mockExecAsync,
}));

import {
  WorkspaceManager,
  ShellExecutor,
  VirtualFileSystem,
  GitWorkflow,
  TaskQueue,
  ToolRegistry,
  SessionManager,
  BatchOperationManager,
  CodebaseIndexer,
} from './index';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset all Supabase mock call counts and return values */
function resetSupabaseMocks() {
  mockFrom.mockClear();
  mockSelect.mockClear();
  mockInsert.mockClear();
  mockUpdate.mockClear();
  mockUpsert.mockClear();
  mockEq.mockClear();
  mockSingle.mockClear();
  mockOrder.mockClear();

  // Re-establish the chaining
  mockSingle.mockResolvedValue({ data: null });
  mockOrder.mockReturnValue({ data: [] });
  mockEq.mockReturnValue({ single: mockSingle, order: mockOrder, data: [] });
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder });
  mockFrom.mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    upsert: mockUpsert,
  });
}

/** Configure mockExecAsync to return a successful shell result */
function mockShellSuccess(stdout: string, stderr = '') {
  mockExecAsync.mockResolvedValue({ stdout, stderr });
}

/** Configure mockExecAsync to throw an exec error */
function mockShellError(stdout: string, stderr: string, code = 1) {
  const err = new Error(stderr) as Error & { stdout: string; stderr: string; code: number };
  err.stdout = stdout;
  err.stderr = stderr;
  err.code = code;
  mockExecAsync.mockRejectedValue(err);
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  resetSupabaseMocks();
  mockExecAsync.mockReset();
});

// ===========================================================================
// WorkspaceManager
// ===========================================================================

describe('WorkspaceManager', () => {
  let wm: WorkspaceManager;

  beforeEach(() => {
    wm = new WorkspaceManager();
  });

  describe('createWorkspace', () => {
    it('should create a workspace with default config values', async () => {
      mockShellSuccess(''); // initializeWorkspaceEnvironment is a no-op but just in case
      const ws = await wm.createWorkspace('user-1', 'My Project', 'project');

      expect(ws.userId).toBe('user-1');
      expect(ws.name).toBe('My Project');
      expect(ws.type).toBe('project');
      expect(ws.status).toBe('active');
      expect(ws.config.shell).toBe('bash');
      expect(ws.config.nodeVersion).toBe('20');
      expect(ws.config.memory).toBe(512);
      expect(ws.config.cpu).toBe(1);
      expect(ws.config.timeout).toBe(300);
      expect(ws.config.ports).toEqual([3000, 8080]);
      expect(ws.config.envVars).toEqual({});
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should apply custom config options', async () => {
      const ws = await wm.createWorkspace('user-2', 'Custom', 'sandbox', {
        shell: 'zsh',
        nodeVersion: '18',
        pythonVersion: '3.11',
        memory: 1024,
        cpu: 2,
        timeout: 600,
        ports: [5000],
        envVars: { NODE_ENV: 'development' },
      });

      expect(ws.config.shell).toBe('zsh');
      expect(ws.config.nodeVersion).toBe('18');
      expect(ws.config.pythonVersion).toBe('3.11');
      expect(ws.config.memory).toBe(1024);
      expect(ws.config.cpu).toBe(2);
      expect(ws.config.timeout).toBe(600);
      expect(ws.config.ports).toEqual([5000]);
      expect(ws.config.envVars).toEqual({ NODE_ENV: 'development' });
    });

    it('should set createdAt and updatedAt to current date', async () => {
      const before = new Date();
      const ws = await wm.createWorkspace('user-1', 'Test', 'project');
      const after = new Date();

      expect(ws.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(ws.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(ws.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('getWorkspace', () => {
    it('should return workspace data from Supabase', async () => {
      const fakeWorkspace = { id: 'ws-1', name: 'Test' };
      mockSingle.mockResolvedValueOnce({ data: fakeWorkspace });

      const result = await wm.getWorkspace('ws-1');
      expect(result).toEqual(fakeWorkspace);
      expect(mockFrom).toHaveBeenCalledWith('workspaces');
    });

    it('should return null when workspace not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null });

      const result = await wm.getWorkspace('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('listWorkspaces', () => {
    it('should return empty array when no workspaces exist', async () => {
      mockOrder.mockReturnValueOnce({ data: null });

      const result = await wm.listWorkspaces('user-1');
      expect(result).toEqual([]);
    });

    it('should return workspaces ordered by updatedAt', async () => {
      const workspaces = [{ id: 'ws-1' }, { id: 'ws-2' }];
      mockOrder.mockReturnValueOnce({ data: workspaces });

      const result = await wm.listWorkspaces('user-1');
      expect(result).toEqual(workspaces);
    });
  });

  describe('cloneFromGitHub', () => {
    it('should extract repo name from URL', async () => {
      mockShellSuccess(''); // for all shell calls
      const ws = await wm.cloneFromGitHub('user-1', 'https://github.com/org/my-repo.git');

      expect(ws.name).toBe('my-repo');
      expect(ws.type).toBe('github');
      expect(ws.githubRepo).toBe('https://github.com/org/my-repo.git');
    });

    it('should handle URL without .git suffix', async () => {
      mockShellSuccess('');
      const ws = await wm.cloneFromGitHub('user-1', 'https://github.com/org/my-repo');

      expect(ws.name).toBe('my-repo');
    });
  });
});

// ===========================================================================
// ShellExecutor
// ===========================================================================

describe('ShellExecutor', () => {
  let shell: ShellExecutor;

  beforeEach(() => {
    shell = new ShellExecutor('ws-test');
  });

  describe('execute', () => {
    it('should return successful command result', async () => {
      mockShellSuccess('hello world', '');

      const result = await shell.execute('echo hello world');
      expect(result.command).toBe('echo hello world');
      expect(result.output).toBe('hello world');
      expect(result.exitCode).toBe(0);
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('should include stderr in output when present', async () => {
      mockShellSuccess('stdout data', 'warning message');

      const result = await shell.execute('some-command');
      expect(result.output).toContain('stdout data');
      expect(result.output).toContain('STDERR:');
      expect(result.output).toContain('warning message');
    });

    it('should handle command failure with exec error', async () => {
      mockShellError('partial output', 'command not found', 127);

      const result = await shell.execute('bad-command');
      expect(result.exitCode).toBe(127);
      expect(result.output).toContain('partial output');
    });

    it('should handle unexpected errors gracefully', async () => {
      mockExecAsync.mockRejectedValue(new Error('Unexpected failure'));

      const result = await shell.execute('crashing-command');
      // executeInContainer catches the error and returns it as stderr
      // execute() then formats it as stdout + \nSTDERR:\n + stderr
      expect(result.exitCode).toBe(1);
      expect(result.output).toContain('Unexpected failure');
    });

    it('should handle non-Error throws', async () => {
      mockExecAsync.mockRejectedValue('string error');

      const result = await shell.execute('bad');
      // executeInContainer catches the non-Error throw and uses 'Unknown error' as stderr
      expect(result.exitCode).toBe(1);
      expect(result.output).toContain('Unknown error');
    });

    it('should pass timeout and cwd options', async () => {
      mockShellSuccess('ok');

      await shell.execute('ls', { timeout: 5000, cwd: '/custom/path' });
      expect(mockExecAsync).toHaveBeenCalledWith('ls', {
        timeout: 5000,
        cwd: '/custom/path',
        maxBuffer: 10 * 1024 * 1024,
      });
    });

    it('should use default cwd based on workspace ID', async () => {
      mockShellSuccess('ok');

      await shell.execute('ls');
      expect(mockExecAsync).toHaveBeenCalledWith(
        'ls',
        expect.objectContaining({
          cwd: '/workspaces/ws-test',
        })
      );
    });
  });

  describe('startSession', () => {
    it('should create a new idle shell session', async () => {
      const session = await shell.startSession();

      expect(session.id).toBeTruthy();
      expect(session.workspaceId).toBe('ws-test');
      expect(session.status).toBe('idle');
      expect(session.cwd).toBe('/workspaces/ws-test');
      expect(session.history).toEqual([]);
    });
  });

  describe('runBackground', () => {
    it('should enqueue a background task', async () => {
      // TaskQueue constructor creates supabase client, enqueue inserts
      mockShellSuccess('task output');
      mockSingle.mockResolvedValue({ data: { workspaceId: 'ws-test', command: 'npm test' } });

      const task = await shell.runBackground('npm test');
      expect(task.type).toBe('shell');
      expect(task.command).toBe('npm test');
      expect(task.status).toBe('pending');
    });
  });
});

// ===========================================================================
// VirtualFileSystem
// ===========================================================================

describe('VirtualFileSystem', () => {
  let vfs: VirtualFileSystem;

  beforeEach(() => {
    vfs = new VirtualFileSystem('ws-vfs');
  });

  describe('readFile', () => {
    it('should return file content on success', async () => {
      mockShellSuccess('file contents here');

      const content = await vfs.readFile('/src/index.ts');
      expect(content).toBe('file contents here');
    });

    it('should throw when file not found', async () => {
      mockShellError('', 'No such file', 1);

      await expect(vfs.readFile('/nonexistent')).rejects.toThrow('File not found: /nonexistent');
    });
  });

  describe('writeFile', () => {
    it('should create directory and write file', async () => {
      mockShellSuccess(''); // mkdir
      mockShellSuccess(''); // cat >

      await vfs.writeFile('/src/new/file.ts', 'content');
      // Two shell commands executed: mkdir and cat
      expect(mockExecAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteFile', () => {
    it('should execute rm -f command', async () => {
      mockShellSuccess('');

      await vfs.deleteFile('/src/old.ts');
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('rm -f'),
        expect.any(Object)
      );
    });
  });

  describe('listDirectory', () => {
    it('should parse ls output into WorkspaceFile array', async () => {
      const lsOutput = `total 4
drwxr-xr-x 2 user user 4096 2024-01-15T10:30:00 src
-rw-r--r-- 1 user user  256 2024-01-15T10:30:00 index.ts`;
      mockShellSuccess(lsOutput);

      const files = await vfs.listDirectory('/workspace');
      expect(files).toHaveLength(2);
      expect(files[0].type).toBe('directory');
      expect(files[0].path).toBe('/workspace/src');
      expect(files[1].type).toBe('file');
      expect(files[1].path).toBe('/workspace/index.ts');
      expect(files[1].size).toBe(256);
    });

    it('should skip . and .. entries', async () => {
      const lsOutput = `total 4
drwxr-xr-x 2 user user 4096 2024-01-15T10:30:00 .
drwxr-xr-x 2 user user 4096 2024-01-15T10:30:00 ..
-rw-r--r-- 1 user user  100 2024-01-15T10:30:00 file.ts`;
      mockShellSuccess(lsOutput);

      const files = await vfs.listDirectory('/workspace');
      expect(files).toHaveLength(1);
      expect(files[0].path).toBe('/workspace/file.ts');
    });

    it('should throw when directory not found', async () => {
      mockShellError('', 'No such directory', 1);

      await expect(vfs.listDirectory('/bad')).rejects.toThrow('Directory not found: /bad');
    });
  });

  describe('exists', () => {
    it('should return true when path exists', async () => {
      mockShellSuccess('exists');

      const result = await vfs.exists('/src/index.ts');
      expect(result).toBe(true);
    });

    it('should return false when path does not exist', async () => {
      mockShellError('', 'test failed', 1);

      const result = await vfs.exists('/nope');
      expect(result).toBe(false);
    });
  });

  describe('glob', () => {
    it('should return matching file paths', async () => {
      mockShellSuccess('./src/a.ts\n./src/b.ts\n');

      const results = await vfs.glob('*.ts');
      expect(results).toEqual(['./src/a.ts', './src/b.ts']);
    });

    it('should filter out empty lines', async () => {
      mockShellSuccess('./file.ts\n\n\n');

      const results = await vfs.glob('*.ts');
      expect(results).toEqual(['./file.ts']);
    });
  });

  describe('grep', () => {
    it('should parse grep output into structured matches', async () => {
      mockShellSuccess('src/index.ts:10:const foo = 42;\nsrc/utils.ts:5:const bar = foo;');

      const matches = await vfs.grep('foo');
      expect(matches).toHaveLength(2);
      expect(matches[0]).toEqual({ file: 'src/index.ts', line: 10, content: 'const foo = 42;' });
      expect(matches[1]).toEqual({ file: 'src/utils.ts', line: 5, content: 'const bar = foo;' });
    });

    it('should return empty array for no matches', async () => {
      mockShellSuccess('');

      const matches = await vfs.grep('nonexistent');
      expect(matches).toEqual([]);
    });
  });

  describe('getFileTree', () => {
    it('should return file tree with correct types', async () => {
      // First call: find command returns paths
      mockExecAsync.mockResolvedValueOnce({ stdout: './src\n./src/index.ts\n', stderr: '' });
      // Second call: test -d for ./src (is a directory)
      mockExecAsync.mockResolvedValueOnce({ stdout: 'dir', stderr: '' });
      // Third call: test -d for ./src/index.ts (is NOT a directory)
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      const tree = await vfs.getFileTree('.', 3);
      expect(tree).toHaveLength(2);
      expect(tree[0].type).toBe('directory');
      expect(tree[1].type).toBe('file');
    });
  });
});

// ===========================================================================
// GitWorkflow
// ===========================================================================

describe('GitWorkflow', () => {
  let git: GitWorkflow;

  beforeEach(() => {
    git = new GitWorkflow('ws-git');
  });

  describe('init', () => {
    it('should execute git init', async () => {
      mockShellSuccess('Initialized empty Git repository');

      await git.init();
      expect(mockExecAsync).toHaveBeenCalledWith('git init', expect.any(Object));
    });
  });

  describe('clone', () => {
    it('should clone with branch flag when branch is provided', async () => {
      mockShellSuccess('Cloning...');

      await git.clone('https://github.com/org/repo.git', 'develop');
      expect(mockExecAsync).toHaveBeenCalledWith(
        'git clone -b develop https://github.com/org/repo.git .',
        expect.any(Object)
      );
    });

    it('should clone without branch flag when not provided', async () => {
      mockShellSuccess('Cloning...');

      await git.clone('https://github.com/org/repo.git');
      expect(mockExecAsync).toHaveBeenCalledWith(
        'git clone  https://github.com/org/repo.git .',
        expect.any(Object)
      );
    });
  });

  describe('status', () => {
    it('should parse git status porcelain output correctly', async () => {
      // First call: git branch --show-current
      mockExecAsync.mockResolvedValueOnce({ stdout: 'main\n', stderr: '' });
      // Second call: git status --porcelain
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'M  src/index.ts\n A src/new.ts\n?? untracked.ts\n',
        stderr: '',
      });

      const status = await git.status();
      expect(status.branch).toBe('main');
      expect(status.staged).toContain('src/index.ts');
      expect(status.unstaged).toContain('src/new.ts');
      expect(status.untracked).toContain('untracked.ts');
    });

    it('should handle clean working directory', async () => {
      mockExecAsync.mockResolvedValueOnce({ stdout: 'main\n', stderr: '' });
      mockExecAsync.mockResolvedValueOnce({ stdout: '', stderr: '' });

      const status = await git.status();
      expect(status.branch).toBe('main');
      expect(status.staged).toEqual([]);
      expect(status.unstaged).toEqual([]);
      expect(status.untracked).toEqual([]);
    });
  });

  describe('add', () => {
    it('should stage all files when path is "."', async () => {
      mockShellSuccess('');

      await git.add('.');
      expect(mockExecAsync).toHaveBeenCalledWith('git add .', expect.any(Object));
    });

    it('should stage specific files with escaping', async () => {
      mockShellSuccess('');

      await git.add(['src/a.ts', 'src/b.ts']);
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining('git add'),
        expect.any(Object)
      );
    });
  });

  describe('commit', () => {
    it('should return commit hash from output', async () => {
      mockShellSuccess('[main abc1234] feat: add feature');

      const hash = await git.commit('feat: add feature');
      expect(hash).toBe('abc1234');
    });

    it('should return empty string when hash not found in output', async () => {
      mockShellSuccess('nothing to commit');

      const hash = await git.commit('empty');
      expect(hash).toBe('');
    });
  });

  describe('merge', () => {
    it('should return success when merge succeeds', async () => {
      mockShellSuccess('Already up to date.');

      const result = await git.merge('feature-branch');
      expect(result.success).toBe(true);
      expect(result.conflicts).toBeUndefined();
    });

    it('should detect conflicts and return conflicting files', async () => {
      // First call: git merge (fails with CONFLICT)
      const mergeErr = new Error('CONFLICT') as Error & {
        stdout: string;
        stderr: string;
        code: number;
      };
      mergeErr.stdout = 'CONFLICT (content): Merge conflict in src/index.ts';
      mergeErr.stderr = '';
      mergeErr.code = 1;
      mockExecAsync.mockRejectedValueOnce(mergeErr);

      // Second call: git diff for conflicting files
      mockExecAsync.mockResolvedValueOnce({
        stdout: 'src/index.ts\nsrc/utils.ts\n',
        stderr: '',
      });

      const result = await git.merge('feature-branch');
      expect(result.success).toBe(false);
      expect(result.conflicts).toContain('src/index.ts');
      expect(result.conflicts).toContain('src/utils.ts');
    });
  });

  describe('diff', () => {
    it('should return plain diff by default', async () => {
      mockShellSuccess('+ added line\n- removed line');

      const diff = await git.diff();
      expect(diff).toContain('+ added line');
    });

    it('should add --staged flag when staged option is true', async () => {
      mockShellSuccess('staged changes');

      await git.diff({ staged: true });
      expect(mockExecAsync).toHaveBeenCalledWith('git diff --staged', expect.any(Object));
    });

    it('should add file filter', async () => {
      mockShellSuccess('');

      await git.diff({ file: 'src/index.ts' });
      expect(mockExecAsync).toHaveBeenCalledWith('git diff -- src/index.ts', expect.any(Object));
    });
  });

  describe('log', () => {
    it('should parse git log output', async () => {
      const logOutput =
        'abc123|John Doe|2024-01-15T10:00:00+00:00|Initial commit\ndef456|Jane|2024-01-14T09:00:00+00:00|Fix bug';
      mockShellSuccess(logOutput);

      const logs = await git.log(2);
      expect(logs).toHaveLength(2);
      expect(logs[0].hash).toBe('abc123');
      expect(logs[0].author).toBe('John Doe');
      expect(logs[0].message).toBe('Initial commit');
      expect(logs[1].hash).toBe('def456');
    });
  });

  describe('stash', () => {
    it('should stash without message', async () => {
      mockShellSuccess('Saved working directory');

      await git.stash();
      expect(mockExecAsync).toHaveBeenCalledWith('git stash', expect.any(Object));
    });

    it('should stash with message', async () => {
      mockShellSuccess('Saved working directory');

      await git.stash('WIP: feature');
      expect(mockExecAsync).toHaveBeenCalledWith('git stash -m "WIP: feature"', expect.any(Object));
    });
  });

  describe('reset', () => {
    it('should reset with default mixed mode', async () => {
      mockShellSuccess('');

      await git.reset('HEAD~1');
      expect(mockExecAsync).toHaveBeenCalledWith('git reset --mixed HEAD~1', expect.any(Object));
    });

    it('should reset with specified mode', async () => {
      mockShellSuccess('');

      await git.reset('abc123', 'hard');
      expect(mockExecAsync).toHaveBeenCalledWith('git reset --hard abc123', expect.any(Object));
    });
  });
});

// ===========================================================================
// TaskQueue
// ===========================================================================

describe('TaskQueue', () => {
  let tq: TaskQueue;

  beforeEach(() => {
    tq = new TaskQueue();
  });

  describe('enqueue', () => {
    it('should create a pending task with correct fields', async () => {
      // processTask runs in background - mock its DB calls
      mockSingle.mockResolvedValue({ data: { workspaceId: 'ws-1', command: 'npm test' } });
      mockShellSuccess('tests passed');

      const task = await tq.enqueue('ws-1', 'test', 'npm test');
      expect(task.workspaceId).toBe('ws-1');
      expect(task.type).toBe('test');
      expect(task.command).toBe('npm test');
      expect(task.status).toBe('pending');
      expect(task.output).toEqual([]);
      expect(task.progress).toBe(0);
      expect(task.id).toBeTruthy();
    });
  });

  describe('getTask', () => {
    it('should return task data from Supabase', async () => {
      const fakeTask = { id: 'task-1', status: 'completed' };
      mockSingle.mockResolvedValueOnce({ data: fakeTask });

      const result = await tq.getTask('task-1');
      expect(result).toEqual(fakeTask);
    });

    it('should return null when task not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null });

      const result = await tq.getTask('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('listTasks', () => {
    it('should return tasks for workspace', async () => {
      const tasks = [{ id: 't1' }, { id: 't2' }];
      mockOrder.mockReturnValueOnce({ data: tasks });

      const result = await tq.listTasks('ws-1');
      expect(result).toEqual(tasks);
    });

    it('should return empty array when no tasks', async () => {
      mockOrder.mockReturnValueOnce({ data: null });

      const result = await tq.listTasks('ws-1');
      expect(result).toEqual([]);
    });
  });

  describe('cancel', () => {
    it('should update task status to cancelled', async () => {
      await tq.cancel('task-1');
      expect(mockUpdate).toHaveBeenCalled();
    });
  });
});

// ===========================================================================
// ToolRegistry (Singleton)
// ===========================================================================

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    // Reset singleton between tests by accessing a fresh instance
    // The singleton pattern means we get the same instance, but that's fine for testing
    registry = ToolRegistry.getInstance();
  });

  describe('getInstance', () => {
    it('should return the same instance on multiple calls', () => {
      const a = ToolRegistry.getInstance();
      const b = ToolRegistry.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('builtin tools registration', () => {
    it('should register shell tool', () => {
      const tool = registry.get('shell');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('Shell');
    });

    it('should register read_file tool', () => {
      const tool = registry.get('read_file');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('Read File');
    });

    it('should register write_file tool', () => {
      const tool = registry.get('write_file');
      expect(tool).toBeDefined();
    });

    it('should register glob tool', () => {
      const tool = registry.get('glob');
      expect(tool).toBeDefined();
    });

    it('should register grep tool', () => {
      const tool = registry.get('grep');
      expect(tool).toBeDefined();
    });

    it('should register git_status tool', () => {
      const tool = registry.get('git_status');
      expect(tool).toBeDefined();
    });

    it('should register git_commit tool', () => {
      const tool = registry.get('git_commit');
      expect(tool).toBeDefined();
    });
  });

  describe('register and get', () => {
    it('should register and retrieve a custom tool', () => {
      const customTool = {
        id: 'custom-tool',
        name: 'Custom',
        description: 'A custom tool',
        version: '1.0.0',
        schema: { input: {}, output: {} },
        execute: async () => ({ success: true }),
      };

      registry.register(customTool);
      expect(registry.get('custom-tool')).toBe(customTool);
    });
  });

  describe('list', () => {
    it('should return all registered tools as an array', () => {
      const tools = registry.list();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThanOrEqual(7); // at least the 7 builtins
    });
  });

  describe('execute', () => {
    it('should return error for nonexistent tool', async () => {
      const result = await registry.execute('nonexistent', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool not found');
    });

    it('should catch errors thrown by tool execute', async () => {
      registry.register({
        id: 'failing-tool',
        name: 'Failing',
        description: 'Fails',
        version: '1.0.0',
        schema: { input: {}, output: {} },
        execute: async () => {
          throw new Error('Tool broke');
        },
      });

      const result = await registry.execute('failing-tool', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe('Tool broke');
    });

    it('should handle non-Error throws in tool execute', async () => {
      registry.register({
        id: 'string-throw-tool',
        name: 'StringThrow',
        description: 'Throws string',
        version: '1.0.0',
        schema: { input: {}, output: {} },
        execute: async () => {
          throw 'string error';
        },
      });

      const result = await registry.execute('string-throw-tool', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });
});

// ===========================================================================
// SessionManager
// ===========================================================================

describe('SessionManager', () => {
  let sm: SessionManager;

  beforeEach(() => {
    sm = new SessionManager();
  });

  describe('createSession', () => {
    it('should create session with initial values', async () => {
      const session = await sm.createSession('ws-1');

      expect(session.id).toBeTruthy();
      expect(session.workspaceId).toBe('ws-1');
      expect(session.messages).toEqual([]);
      expect(session.tokenCount).toBe(0);
      expect(session.maxTokens).toBe(100000);
      expect(session.files).toEqual([]);
      expect(session.activeTools).toEqual([]);
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe('addMessage', () => {
    it('should throw when session not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null });

      await expect(sm.addMessage('bad-id', 'user', 'hello')).rejects.toThrow('Session not found');
    });

    it('should add message and update token count', async () => {
      const existingSession = {
        id: 'sess-1',
        workspaceId: 'ws-1',
        messages: [],
        tokenCount: 0,
        maxTokens: 100000,
        files: [],
        activeTools: [],
      };
      mockSingle.mockResolvedValueOnce({ data: existingSession });

      const result = await sm.addMessage('sess-1', 'user', 'Hello world');
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content).toBe('Hello world');
      expect(result.tokenCount).toBeGreaterThan(0);
    });

    it('should handle toolCalls parameter', async () => {
      const existingSession = {
        id: 'sess-1',
        workspaceId: 'ws-1',
        messages: [],
        tokenCount: 0,
        maxTokens: 100000,
        files: [],
        activeTools: [],
      };
      mockSingle.mockResolvedValueOnce({ data: existingSession });

      const toolCalls = [{ id: 'tc-1', name: 'shell', params: { command: 'ls' } }];
      const result = await sm.addMessage('sess-1', 'tool', 'output', toolCalls);
      expect(result.messages[0].toolCalls).toEqual(toolCalls);
    });
  });

  describe('getContextForAI', () => {
    it('should throw when session not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null });

      await expect(sm.getContextForAI('bad-id')).rejects.toThrow('Session not found');
    });

    it('should return formatted messages', async () => {
      const session = {
        id: 's-1',
        messages: [
          { role: 'user', content: 'Hi', timestamp: new Date(), tokens: 1 },
          { role: 'assistant', content: 'Hello', timestamp: new Date(), tokens: 2 },
        ],
      };
      mockSingle.mockResolvedValueOnce({ data: session });

      const context = await sm.getContextForAI('s-1');
      expect(context).toHaveLength(2);
      expect(context[0]).toEqual({ role: 'user', content: 'Hi' });
      expect(context[1]).toEqual({ role: 'assistant', content: 'Hello' });
    });
  });
});

// ===========================================================================
// BatchOperationManager
// ===========================================================================

describe('BatchOperationManager', () => {
  let bom: BatchOperationManager;

  beforeEach(() => {
    bom = new BatchOperationManager('ws-batch');
  });

  describe('createBatch', () => {
    it('should create batch with pending status', async () => {
      // readFile for backup will fail (no existing file)
      mockShellError('', 'not found', 1);

      const batch = await bom.createBatch([
        { type: 'create', path: '/src/new.ts', content: 'new file' },
      ]);

      expect(batch.status).toBe('pending');
      expect(batch.operations).toHaveLength(1);
      expect(batch.id).toBeTruthy();
    });

    it('should create backups for update operations', async () => {
      // readFile succeeds -> backup is set
      mockShellSuccess('original content');

      const ops = [{ type: 'update' as const, path: '/src/file.ts', content: 'updated' }];
      const batch = await bom.createBatch(ops);
      expect(batch.operations[0].backup).toBe('original content');
    });

    it('should create backups for delete operations', async () => {
      mockShellSuccess('doomed content');

      const ops = [{ type: 'delete' as const, path: '/src/old.ts' }];
      const batch = await bom.createBatch(ops);
      expect(batch.operations[0].backup).toBe('doomed content');
    });
  });

  describe('execute', () => {
    it('should return error when batch not found', async () => {
      mockSingle.mockResolvedValueOnce({ data: null });

      const result = await bom.execute('nonexistent');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Batch not found');
    });

    it('should return error when batch is not pending', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'b-1', status: 'committed', operations: [] },
      });

      const result = await bom.execute('b-1');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Batch already committed');
    });

    it('should execute all operations and return success', async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          id: 'b-1',
          status: 'pending',
          operations: [{ type: 'create', path: '/src/a.ts', content: 'a' }],
        },
      });

      // writeFile calls: mkdir + cat
      mockShellSuccess('');
      mockShellSuccess('');

      const result = await bom.execute('b-1');
      expect(result.success).toBe(true);
    });
  });
});

// ===========================================================================
// CodebaseIndexer
// ===========================================================================

describe('CodebaseIndexer', () => {
  let indexer: CodebaseIndexer;

  beforeEach(() => {
    indexer = new CodebaseIndexer('ws-idx');
  });

  describe('search', () => {
    it('should return empty results when no index exists', async () => {
      mockSingle.mockResolvedValueOnce({ data: null });

      const result = await indexer.search('foo');
      expect(result.files).toEqual([]);
      expect(result.symbols).toEqual([]);
    });

    it('should filter files and symbols by query', async () => {
      const index = {
        workspaceId: 'ws-idx',
        files: [
          { path: 'src/foo.ts', imports: ['bar'], exports: ['baz'] },
          { path: 'src/other.ts', imports: [], exports: [] },
        ],
        symbols: [
          { name: 'fooFunction', signature: 'function fooFunction()' },
          { name: 'barFunction', signature: 'function barFunction()' },
        ],
      };
      mockSingle.mockResolvedValueOnce({ data: index });

      const result = await indexer.search('foo');
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe('src/foo.ts');
      expect(result.symbols).toHaveLength(1);
      expect(result.symbols[0].name).toBe('fooFunction');
    });

    it('should match case-insensitively', async () => {
      const index = {
        workspaceId: 'ws-idx',
        files: [{ path: 'src/FOO.ts', imports: [], exports: [] }],
        symbols: [{ name: 'FooBar', signature: 'const FooBar' }],
      };
      mockSingle.mockResolvedValueOnce({ data: index });

      const result = await indexer.search('foo');
      expect(result.files).toHaveLength(1);
      expect(result.symbols).toHaveLength(1);
    });
  });

  describe('getContextForQuery', () => {
    it('should return empty string when no results', async () => {
      mockSingle.mockResolvedValueOnce({ data: null });

      const context = await indexer.getContextForQuery('anything');
      expect(context).toBe('');
    });

    it('should include symbols and file contents in context', async () => {
      const index = {
        workspaceId: 'ws-idx',
        files: [{ path: 'src/foo.ts', language: 'typescript', imports: [], exports: ['foo'] }],
        symbols: [
          {
            name: 'foo',
            type: 'function',
            file: 'src/foo.ts',
            line: 1,
            signature: 'function foo()',
          },
        ],
      };
      mockSingle.mockResolvedValueOnce({ data: index });

      // readFile for the file contents
      mockShellSuccess('function foo() { return 42; }');

      const context = await indexer.getContextForQuery('foo');
      expect(context).toContain('Relevant Symbols');
      expect(context).toContain('foo');
      expect(context).toContain('Relevant Files');
      expect(context).toContain('function foo()');
    });
  });
});
