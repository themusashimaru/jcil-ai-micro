/**
 * WORKSPACE GIT API
 *
 * Full git workflow in the workspace container
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ContainerManager } from '@/lib/workspace/container';

export const runtime = 'nodejs';
export const maxDuration = 120; // Git operations can be slow

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

    const container = new ContainerManager();

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
        const count = url.searchParams.get('count') || '10';
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
        if (file) cmd += ` -- "${file}"`;

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
    console.error('Git operation failed:', error);
    return NextResponse.json(
      { error: 'Git operation failed', details: error instanceof Error ? error.message : 'Unknown error' },
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

    const body = await request.json();
    const { action, ...options } = body;

    const container = new ContainerManager();

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
        const filesStr = Array.isArray(files) ? files.join(' ') : files;
        const result = await container.executeCommand(workspaceId, `git add ${filesStr}`);
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

        const escapedMessage = message.replace(/"/g, '\\"');
        const result = await container.executeCommand(
          workspaceId,
          `git commit -m "${escapedMessage}"`
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

        // Get current branch if not specified
        let targetBranch = branch;
        if (!targetBranch) {
          const branchResult = await container.executeCommand(workspaceId, 'git branch --show-current');
          targetBranch = branchResult.stdout.trim();
        }

        const forceFlag = force ? ' -f' : '';
        const result = await container.executeCommand(
          workspaceId,
          `git push${forceFlag} ${remote} ${targetBranch}`,
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

        let targetBranch = branch;
        if (!targetBranch) {
          const branchResult = await container.executeCommand(workspaceId, 'git branch --show-current');
          targetBranch = branchResult.stdout.trim();
        }

        const result = await container.executeCommand(
          workspaceId,
          `git pull ${remote} ${targetBranch}`,
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

        const createFlag = create ? ' -b' : '';
        const result = await container.executeCommand(
          workspaceId,
          `git checkout${createFlag} ${branch}`
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

        const result = await container.executeCommand(workspaceId, `git merge ${branch}`);

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
          cmd = `git stash -m "${message}"`;
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
        const result = await container.executeCommand(
          workspaceId,
          `git reset --${mode} ${commit}`
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

        const result = await container.executeCommand(
          workspaceId,
          `git remote add ${name} ${url}`
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

        const result = await container.executeCommand(
          workspaceId,
          `git config ${key} "${value}"`
        );
        return NextResponse.json({ success: result.exitCode === 0 });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Git operation failed:', error);
    return NextResponse.json(
      { error: 'Git operation failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
