/**
 * WORKSPACE GIT API
 *
 * Full git workflow in the workspace container
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ContainerManager, getContainerManager } from '@/lib/workspace/container';
import { validateCSRF } from '@/lib/security/csrf';
import { validatePositiveInt, safeParseJSON } from '@/lib/security/validation';
import { logger } from '@/lib/logger';

const log = logger('GitAPI');

export const runtime = 'nodejs';
export const maxDuration = 120; // Git operations can be slow

/**
 * Shell-escape a string to prevent command injection
 * This function ensures user input cannot break out of quoted strings
 */
function shellEscape(str: string): string {
  // Single quotes are the safest - they prevent all shell expansion
  // To include a single quote inside single quotes, we need to end the string,
  // add an escaped single quote, and start a new single-quoted string
  return "'" + str.replace(/'/g, "'\\''") + "'";
}

/**
 * Validate a git branch/remote/ref name to prevent injection
 * Git refs can contain many characters, but we restrict to safe ones
 */
function isValidGitRef(ref: string): boolean {
  // Allow alphanumeric, hyphens, underscores, slashes, periods
  // Disallow: spaces, semicolons, pipes, backticks, $, etc.
  return /^[a-zA-Z0-9._\-\/]+$/.test(ref) && !ref.includes('..');
}

/**
 * GET - Get git status, log, or diff
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify workspace ownership
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'status';

    const container = getContainerManager();

    switch (action) {
      case 'status': {
        const result = await container.executeCommand(workspaceId, 'git status --porcelain');
        const branchResult = await container.executeCommand(workspaceId, 'git branch --show-current');

        const staged: string[] = [];
        const unstaged: string[] = [];
        const untracked: string[] = [];

        for (const line of result.stdout.split('\n')) {
          if (!line.trim()) continue;
          const status = line.substring(0, 2);
          const file = line.substring(3);

          if (status[0] !== ' ' && status[0] !== '?') staged.push(file);
          if (status[1] !== ' ' && status[1] !== '?') unstaged.push(file);
          if (status === '??') untracked.push(file);
        }

        return NextResponse.json({
          branch: branchResult.stdout.trim(),
          staged,
          unstaged,
          untracked,
          clean: staged.length === 0 && unstaged.length === 0 && untracked.length === 0,
        });
      }

      case 'log': {
        // SECURITY: Validate count parameter to prevent command injection
        const countValidation = validatePositiveInt(url.searchParams.get('count'), {
          name: 'count',
          default: 10,
          max: 100,
        });
        if (!countValidation.valid) {
          return NextResponse.json({ error: countValidation.error }, { status: 400 });
        }
        const count = countValidation.value;

        const result = await container.executeCommand(
          workspaceId,
          `git log -${count} --pretty=format:"%H|%an|%ae|%aI|%s"`
        );

        const commits = result.stdout.split('\n').filter(l => l).map(line => {
          const [hash, author, email, date, message] = line.split('|');
          return { hash, author, email, date, message };
        });

        return NextResponse.json({ commits });
      }

      case 'diff': {
        const staged = url.searchParams.get('staged') === 'true';
        const file = url.searchParams.get('file');

        let cmd = 'git diff';
        if (staged) cmd += ' --staged';
        if (file) cmd += ` -- ${shellEscape(file)}`;

        const result = await container.executeCommand(workspaceId, cmd);
        return NextResponse.json({ diff: result.stdout });
      }

      case 'branches': {
        const result = await container.executeCommand(workspaceId, 'git branch -a');
        const branches = result.stdout.split('\n')
          .map(b => b.trim().replace('* ', ''))
          .filter(b => b);

        const currentResult = await container.executeCommand(workspaceId, 'git branch --show-current');

        return NextResponse.json({
          branches,
          current: currentResult.stdout.trim(),
        });
      }

      case 'remotes': {
        const result = await container.executeCommand(workspaceId, 'git remote -v');
        const remotes: Record<string, { fetch?: string; push?: string }> = {};

        for (const line of result.stdout.split('\n')) {
          const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
          if (match) {
            const [, name, url, type] = match;
            if (!remotes[name]) remotes[name] = {};
            remotes[name][type as 'fetch' | 'push'] = url;
          }
        }

        return NextResponse.json({ remotes });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    log.error('Git operation failed', error as Error);
    return NextResponse.json(
      { error: 'Git operation failed' },
      { status: 500 }
    );
  }
}

/**
 * POST - Execute git operations (commit, push, pull, etc.)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const { id: workspaceId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify workspace ownership
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    interface GitRequestBody {
      action?: string;
      url?: string;
      branch?: string;
      files?: string | string[];
      message?: string;
      stageAll?: boolean;
      remote?: string;
      force?: boolean;
      create?: boolean;
      pop?: boolean;
      commit?: string;
      mode?: string;
      name?: string;
      key?: string;
      value?: string;
    }
    const jsonResult = await safeParseJSON<GitRequestBody>(request);
    if (!jsonResult.success) {
      return NextResponse.json({ error: jsonResult.error }, { status: 400 });
    }
    const { action, ...options } = jsonResult.data;

    const container = getContainerManager();

    switch (action) {
      case 'init': {
        const result = await container.executeCommand(workspaceId, 'git init');
        return NextResponse.json({ success: result.exitCode === 0, output: result.stdout });
      }

      case 'clone': {
        const { url, branch } = options;
        if (!url) {
          return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }
        const result = await container.cloneRepository(workspaceId, url, branch);
        return NextResponse.json({
          success: result.exitCode === 0,
          output: result.stdout,
          error: result.stderr,
        });
      }

      case 'add': {
        const { files = '.' } = options;
        // Escape each file path to prevent command injection
        const escapedFiles = Array.isArray(files)
          ? files.map(f => shellEscape(f)).join(' ')
          : shellEscape(files);
        const result = await container.executeCommand(workspaceId, `git add ${escapedFiles}`);
        return NextResponse.json({ success: result.exitCode === 0 });
      }

      case 'commit': {
        const { message } = options;
        if (!message) {
          return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        // Stage all changes first if requested
        if (options.stageAll) {
          await container.executeCommand(workspaceId, 'git add .');
        }

        // Use shellEscape for complete protection against injection
        const result = await container.executeCommand(
          workspaceId,
          `git commit -m ${shellEscape(message)}`
        );

        // Extract commit hash
        const hashMatch = result.stdout.match(/\[[\w-]+ ([a-f0-9]+)\]/);

        return NextResponse.json({
          success: result.exitCode === 0,
          hash: hashMatch ? hashMatch[1] : undefined,
          output: result.stdout,
          error: result.stderr,
        });
      }

      case 'push': {
        const { remote = 'origin', branch, force = false } = options;

        // Validate remote name to prevent injection
        if (!isValidGitRef(remote)) {
          return NextResponse.json({ error: 'Invalid remote name' }, { status: 400 });
        }

        // Get current branch if not specified
        let targetBranch = branch;
        if (!targetBranch) {
          const branchResult = await container.executeCommand(workspaceId, 'git branch --show-current');
          targetBranch = branchResult.stdout.trim();
        }

        // Validate branch name
        if (!isValidGitRef(targetBranch)) {
          return NextResponse.json({ error: 'Invalid branch name' }, { status: 400 });
        }

        const forceFlag = force ? ' -f' : '';
        const result = await container.executeCommand(
          workspaceId,
          `git push${forceFlag} ${shellEscape(remote)} ${shellEscape(targetBranch)}`,
          { timeout: 60000 }
        );

        return NextResponse.json({
          success: result.exitCode === 0,
          output: result.stdout,
          error: result.stderr,
        });
      }

      case 'pull': {
        const { remote = 'origin', branch } = options;

        // Validate remote name
        if (!isValidGitRef(remote)) {
          return NextResponse.json({ error: 'Invalid remote name' }, { status: 400 });
        }

        let targetBranch = branch;
        if (!targetBranch) {
          const branchResult = await container.executeCommand(workspaceId, 'git branch --show-current');
          targetBranch = branchResult.stdout.trim();
        }

        // Validate branch name
        if (!isValidGitRef(targetBranch)) {
          return NextResponse.json({ error: 'Invalid branch name' }, { status: 400 });
        }

        const result = await container.executeCommand(
          workspaceId,
          `git pull ${shellEscape(remote)} ${shellEscape(targetBranch)}`,
          { timeout: 60000 }
        );

        return NextResponse.json({
          success: result.exitCode === 0,
          output: result.stdout,
          error: result.stderr,
        });
      }

      case 'checkout': {
        const { branch, create = false } = options;
        if (!branch) {
          return NextResponse.json({ error: 'Branch is required' }, { status: 400 });
        }

        // Validate branch name to prevent injection
        if (!isValidGitRef(branch)) {
          return NextResponse.json({ error: 'Invalid branch name' }, { status: 400 });
        }

        const createFlag = create ? ' -b' : '';
        const result = await container.executeCommand(
          workspaceId,
          `git checkout${createFlag} ${shellEscape(branch)}`
        );

        return NextResponse.json({
          success: result.exitCode === 0,
          output: result.stdout,
          error: result.stderr,
        });
      }

      case 'merge': {
        const { branch } = options;
        if (!branch) {
          return NextResponse.json({ error: 'Branch is required' }, { status: 400 });
        }

        // Validate branch name to prevent injection
        if (!isValidGitRef(branch)) {
          return NextResponse.json({ error: 'Invalid branch name' }, { status: 400 });
        }

        const result = await container.executeCommand(workspaceId, `git merge ${shellEscape(branch)}`);

        // Check for conflicts
        let conflicts: string[] = [];
        if (result.exitCode !== 0 && result.stdout.includes('CONFLICT')) {
          const conflictResult = await container.executeCommand(
            workspaceId,
            'git diff --name-only --diff-filter=U'
          );
          conflicts = conflictResult.stdout.split('\n').filter(f => f.trim());
        }

        return NextResponse.json({
          success: result.exitCode === 0,
          conflicts,
          output: result.stdout,
          error: result.stderr,
        });
      }

      case 'stash': {
        const { message, pop = false } = options;

        let cmd = 'git stash';
        if (pop) {
          cmd = 'git stash pop';
        } else if (message) {
          // Use shellEscape to prevent injection via message
          cmd = `git stash -m ${shellEscape(message)}`;
        }

        const result = await container.executeCommand(workspaceId, cmd);
        return NextResponse.json({
          success: result.exitCode === 0,
          output: result.stdout,
          error: result.stderr,
        });
      }

      case 'reset': {
        const { commit = 'HEAD', mode = 'mixed' } = options;

        // Validate mode to prevent injection (only allow known values)
        const validModes = ['soft', 'mixed', 'hard'];
        if (!validModes.includes(mode)) {
          return NextResponse.json({ error: 'Invalid reset mode' }, { status: 400 });
        }

        // Validate commit ref
        if (!isValidGitRef(commit)) {
          return NextResponse.json({ error: 'Invalid commit reference' }, { status: 400 });
        }

        const result = await container.executeCommand(
          workspaceId,
          `git reset --${mode} ${shellEscape(commit)}`
        );
        return NextResponse.json({
          success: result.exitCode === 0,
          output: result.stdout,
          error: result.stderr,
        });
      }

      case 'remote-add': {
        const { name, url } = options;
        if (!name || !url) {
          return NextResponse.json({ error: 'Name and URL are required' }, { status: 400 });
        }

        // Validate remote name
        if (!isValidGitRef(name)) {
          return NextResponse.json({ error: 'Invalid remote name' }, { status: 400 });
        }

        const result = await container.executeCommand(
          workspaceId,
          `git remote add ${shellEscape(name)} ${shellEscape(url)}`
        );
        return NextResponse.json({
          success: result.exitCode === 0,
          error: result.stderr,
        });
      }

      case 'config': {
        const { key, value } = options;
        if (!key || !value) {
          return NextResponse.json({ error: 'Key and value are required' }, { status: 400 });
        }

        // Validate config key format (e.g., user.name, user.email)
        if (!/^[a-zA-Z][a-zA-Z0-9._-]*\.[a-zA-Z][a-zA-Z0-9._-]*$/.test(key)) {
          return NextResponse.json({ error: 'Invalid config key format' }, { status: 400 });
        }

        const result = await container.executeCommand(
          workspaceId,
          `git config ${shellEscape(key)} ${shellEscape(value)}`
        );
        return NextResponse.json({ success: result.exitCode === 0 });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    log.error('Git operation failed', error as Error);
    return NextResponse.json(
      { error: 'Git operation failed' },
      { status: 500 }
    );
  }
}
