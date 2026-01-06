/**
 * CODE LAB GIT API
 *
 * Git operations - clone, push, pull, commit, branch management
 * Integrates GitHubSyncBridge with E2B workspace
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ContainerManager } from '@/lib/workspace/container';
import { GitHubSyncBridge } from '@/lib/workspace/github-sync';
import crypto from 'crypto';

type GitOperation = 'clone' | 'push' | 'pull' | 'status' | 'commit' | 'branch' | 'checkout' | 'diff';

// Encryption key for token decryption
function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return crypto.createHash('sha256').update(key).digest();
}

// Decrypt token
function decryptToken(encryptedData: string): string {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted format');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '';
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { sessionId, operation, repo, message, branch } = await request.json() as {
      sessionId: string;
      operation: GitOperation;
      repo?: { owner: string; name: string; branch?: string };
      message?: string;
      branch?: string;
    };

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Get user's GitHub token
    const { data: userData } = await supabase
      .from('users')
      .select('github_token')
      .eq('id', user.id)
      .single();

    const userTokens = userData as { github_token?: string } | null;

    if (!userTokens?.github_token) {
      return NextResponse.json(
        { error: 'GitHub not connected. Please connect your GitHub account.' },
        { status: 400 }
      );
    }

    const githubToken = decryptToken(userTokens.github_token);

    // Initialize container
    const container = new ContainerManager();

    // Create shell executor function for GitHubSyncBridge
    const executeShell = async (cmd: string) => {
      const result = await container.executeCommand(sessionId, cmd);
      return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.exitCode ?? 0,
      };
    };

    // Initialize GitHub sync bridge
    const syncBridge = new GitHubSyncBridge(githubToken, sessionId);

    switch (operation) {
      case 'clone': {
        if (!repo) {
          return NextResponse.json({ error: 'Repository info required' }, { status: 400 });
        }

        // Connect to repo
        await syncBridge.connect(repo.owner, repo.name);

        // Clone into workspace
        const cloneResult = await syncBridge.cloneToWorkspace(executeShell);

        if (!cloneResult.success) {
          return NextResponse.json({ error: cloneResult.error }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          filesChanged: cloneResult.filesChanged,
          commitSha: cloneResult.commitSha,
        });
      }

      case 'push': {
        if (!repo) {
          return NextResponse.json({ error: 'Repository info required' }, { status: 400 });
        }

        await syncBridge.connect(repo.owner, repo.name);

        const pushResult = await syncBridge.pushChanges(
          executeShell,
          message || `Code Lab: Changes from ${new Date().toLocaleString()}`
        );

        if (!pushResult.success) {
          return NextResponse.json({ error: pushResult.error }, { status: 500 });
        }

        // Get diff for UI
        const diffResult = await executeShell(
          'cd /workspace/repo && git diff HEAD~1 --name-status 2>/dev/null || echo ""'
        );

        const diff = parseDiffOutput(diffResult.stdout);

        return NextResponse.json({
          success: true,
          filesChanged: pushResult.filesChanged,
          commitSha: pushResult.commitSha,
          diff,
        });
      }

      case 'pull': {
        if (!repo) {
          return NextResponse.json({ error: 'Repository info required' }, { status: 400 });
        }

        await syncBridge.connect(repo.owner, repo.name);

        const pullResult = await syncBridge.pullChanges(executeShell);

        if (!pullResult.success) {
          return NextResponse.json({ error: pullResult.error }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          filesChanged: pullResult.filesChanged,
          commitSha: pullResult.commitSha,
        });
      }

      case 'status': {
        if (!repo) {
          return NextResponse.json({ error: 'Repository info required' }, { status: 400 });
        }

        await syncBridge.connect(repo.owner, repo.name);

        const status = await syncBridge.getSyncStatus(executeShell);

        return NextResponse.json({ status });
      }

      case 'commit': {
        const commitResult = await executeShell(
          `cd /workspace/repo && git add -A && git commit -m "${(message || 'Update').replace(/"/g, '\\"')}"`
        );

        return NextResponse.json({
          success: commitResult.exitCode === 0,
          output: commitResult.stdout,
          error: commitResult.stderr,
        });
      }

      case 'branch': {
        if (!branch) {
          return NextResponse.json({ error: 'Branch name required' }, { status: 400 });
        }

        if (!repo) {
          return NextResponse.json({ error: 'Repository info required' }, { status: 400 });
        }

        await syncBridge.connect(repo.owner, repo.name);

        const created = await syncBridge.createBranch(branch, executeShell);

        return NextResponse.json({ success: created, branch });
      }

      case 'checkout': {
        if (!branch) {
          return NextResponse.json({ error: 'Branch name required' }, { status: 400 });
        }

        if (!repo) {
          return NextResponse.json({ error: 'Repository info required' }, { status: 400 });
        }

        await syncBridge.connect(repo.owner, repo.name);

        const switched = await syncBridge.switchBranch(branch, executeShell);

        return NextResponse.json({ success: switched, branch });
      }

      case 'diff': {
        const diffResult = await executeShell(
          'cd /workspace/repo && git diff --unified=3 2>/dev/null || echo ""'
        );

        return NextResponse.json({
          diff: diffResult.stdout,
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Git API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Git operation failed' },
      { status: 500 }
    );
  }
}

// Helper: Parse git diff --name-status output
function parseDiffOutput(output: string): { path: string; status: string }[] {
  if (!output.trim()) return [];

  return output
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [status, ...pathParts] = line.split('\t');
      return {
        status: status === 'A' ? 'added' : status === 'D' ? 'deleted' : 'modified',
        path: pathParts.join('\t'),
      };
    });
}
