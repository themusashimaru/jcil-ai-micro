import { describe, it, expect, vi } from 'vitest';

// Mock all heavy dependencies
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: vi.fn() };
  },
}));

vi.mock('./container', () => ({
  ContainerManager: vi.fn(),
  getContainerManager: vi.fn(() => ({
    execute: vi.fn(),
    listDirectory: vi.fn(),
    runBuild: vi.fn(),
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('./security', () => ({
  sanitizeShellArg: vi.fn((s: string) => s),
  sanitizeCommitMessage: vi.fn((s: string) => s),
  sanitizeFilePath: vi.fn((s: string) => s),
  sanitizeGlobPattern: vi.fn((s: string) => s),
  sanitizeSearchPattern: vi.fn((s: string) => s),
}));

vi.mock('./plan-mode', () => ({
  getPlanTools: vi.fn(() => []),
  executePlanTool: vi.fn(),
  isPlanTool: vi.fn(() => false),
  getPlanManager: vi.fn(() => ({})),
}));

vi.mock('./mcp', () => ({
  getMCPConfigTools: vi.fn(() => []),
  getMCPManager: vi.fn(() => ({})),
}));

vi.mock('./hooks', () => ({
  getHooksTools: vi.fn(() => []),
  getHooksManager: vi.fn(() => ({})),
  HookConfig: vi.fn(),
}));

vi.mock('./memory-files', () => ({
  getClaudeMemoryTools: vi.fn(() => []),
  executeMemoryTool: vi.fn(),
  isClaudeMemoryTool: vi.fn(() => false),
  getCachedMemoryContext: vi.fn(),
}));

vi.mock('./background-tasks', () => ({
  getBackgroundTaskTools: vi.fn(() => []),
  getBackgroundTaskManager: vi.fn(() => ({})),
}));

vi.mock('./debug-tools', () => ({
  getDebugTools: vi.fn(() => []),
  executeDebugTool: vi.fn(),
  isDebugTool: vi.fn(() => false),
}));

vi.mock('./lsp-tools', () => ({
  getLSPTools: vi.fn(() => []),
  executeLSPTool: vi.fn(),
  isLSPTool: vi.fn(() => false),
}));

vi.mock('@/lib/agents/subagent', () => ({
  getSubagentTools: vi.fn(() => []),
  executeSubagentTool: vi.fn(),
  isSubagentTool: vi.fn(() => false),
}));

vi.mock('./permissions', () => ({
  getPermissionTools: vi.fn(() => []),
  executePermissionTool: vi.fn(),
  isPermissionTool: vi.fn(() => false),
}));

vi.mock('./model-config', () => ({
  getModelConfigTools: vi.fn(() => []),
  executeModelConfigTool: vi.fn(),
  isModelConfigTool: vi.fn(() => false),
  getModelConfigManager: vi.fn(() => ({
    getCurrentModel: vi.fn(() => ({ id: 'claude-sonnet-4-6' })),
    getSessionPreferences: vi.fn(() => ({ maxTokens: 8192 })),
  })),
}));

vi.mock('./token-tracker', () => ({
  getTokenTrackingTools: vi.fn(() => []),
  executeTokenTrackingTool: vi.fn(),
  isTokenTrackingTool: vi.fn(() => false),
  getTokenTracker: vi.fn(() => ({ recordUsage: vi.fn() })),
}));

vi.mock('./extended-thinking', () => ({
  getExtendedThinkingTools: vi.fn(() => []),
  executeExtendedThinkingTool: vi.fn(),
  isExtendedThinkingTool: vi.fn(() => false),
}));

vi.mock('./context-compaction', () => ({
  getContextCompactionTools: vi.fn(() => []),
  isContextCompactionTool: vi.fn(() => false),
  getContextCompactionManager: vi.fn(() => ({})),
}));

vi.mock('./checkpoint', () => ({
  getCheckpointTools: vi.fn(() => []),
  isCheckpointTool: vi.fn(() => false),
  executeCheckpointTool: vi.fn(),
}));

vi.mock('./custom-commands', () => ({
  getCustomCommandTools: vi.fn(() => []),
  isCustomCommandTool: vi.fn(() => false),
  executeCustomCommandTool: vi.fn(),
}));

vi.mock('./mcp-scopes', () => ({
  getMCPScopeTools: vi.fn(() => []),
  isMCPScopeTool: vi.fn(() => false),
  executeMCPScopeTool: vi.fn(),
}));

import {
  shouldUseWorkspaceAgent,
  WorkspaceAgent,
  type WorkspaceAgentConfig,
  type ToolUpdate,
  type ToolUpdateCallback,
} from './chat-integration';

// -------------------------------------------------------------------
// shouldUseWorkspaceAgent
// -------------------------------------------------------------------
describe('shouldUseWorkspaceAgent', () => {
  describe('file operations', () => {
    it('should return true for edit file requests', () => {
      expect(shouldUseWorkspaceAgent('edit the file src/index.ts')).toBe(true);
    });

    it('should return true for modify code requests', () => {
      expect(shouldUseWorkspaceAgent('modify the function to handle errors')).toBe(true);
    });

    it('should return true for create file requests', () => {
      expect(shouldUseWorkspaceAgent('create a new file called utils.ts')).toBe(true);
    });

    it('should return true for delete file requests', () => {
      expect(shouldUseWorkspaceAgent('delete the old test file')).toBe(true);
    });

    it('should return true for read file requests', () => {
      expect(shouldUseWorkspaceAgent('show me the file contents')).toBe(true);
    });
  });

  describe('shell/command operations', () => {
    it('should return true for run command', () => {
      expect(shouldUseWorkspaceAgent('run the test suite')).toBe(true);
    });

    it('should return true for npm commands', () => {
      expect(shouldUseWorkspaceAgent('npm install lodash')).toBe(true);
    });

    it('should return true for yarn commands', () => {
      expect(shouldUseWorkspaceAgent('yarn add react')).toBe(true);
    });

    it('should return true for build requests', () => {
      expect(shouldUseWorkspaceAgent('build the project')).toBe(true);
    });

    it('should return true for terminal mentions', () => {
      expect(shouldUseWorkspaceAgent('open a terminal and install deps')).toBe(true);
    });
  });

  describe('git operations', () => {
    it('should return true for git commit', () => {
      expect(shouldUseWorkspaceAgent('commit the changes')).toBe(true);
    });

    it('should return true for git push', () => {
      expect(shouldUseWorkspaceAgent('push to remote')).toBe(true);
    });

    it('should return true for branch operations', () => {
      expect(shouldUseWorkspaceAgent('create a new branch for the feature')).toBe(true);
    });

    it('should return true for git keyword', () => {
      expect(shouldUseWorkspaceAgent('check git status')).toBe(true);
    });
  });

  describe('debugging', () => {
    it('should return true for fix bug requests', () => {
      expect(shouldUseWorkspaceAgent('fix the bug in the login function')).toBe(true);
    });

    it('should return true for debug error requests', () => {
      expect(shouldUseWorkspaceAgent('debug the error in the API route')).toBe(true);
    });

    it('should return true for "why is it not working"', () => {
      expect(shouldUseWorkspaceAgent('why is the server not working')).toBe(true);
    });
  });

  describe('exploration', () => {
    it('should return true for search in codebase', () => {
      expect(shouldUseWorkspaceAgent('find all usages of useState in the codebase')).toBe(true);
    });

    it('should return true for where is X defined', () => {
      expect(shouldUseWorkspaceAgent('where is the UserProfile component defined')).toBe(true);
    });

    it('should return true for grep requests', () => {
      expect(shouldUseWorkspaceAgent('grep for TODO in code files')).toBe(true);
    });
  });

  describe('keyword density', () => {
    it('should return true for multiple agentic keywords', () => {
      expect(shouldUseWorkspaceAgent('deploy the test to production')).toBe(true);
    });

    it('should return false for general chat', () => {
      expect(shouldUseWorkspaceAgent('what is recursion?')).toBe(false);
    });

    it('should return false for simple greetings', () => {
      expect(shouldUseWorkspaceAgent('hello, how are you?')).toBe(false);
    });

    it('should return false for general questions', () => {
      expect(shouldUseWorkspaceAgent('explain closures in JavaScript')).toBe(false);
    });
  });
});

// -------------------------------------------------------------------
// WorkspaceAgent construction
// -------------------------------------------------------------------
describe('WorkspaceAgent', () => {
  it('should construct with required config', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    const agent = new WorkspaceAgent({
      workspaceId: 'ws-1',
      userId: 'u-1',
      sessionId: 'sess-1',
    });
    expect(agent).toBeDefined();
  });

  it('should accept optional model and maxIterations', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    const agent = new WorkspaceAgent({
      workspaceId: 'ws-1',
      userId: 'u-1',
      sessionId: 'sess-1',
      model: 'claude-opus-4-6',
      maxIterations: 50,
    });
    expect(agent).toBeDefined();
  });
});

// -------------------------------------------------------------------
// Type exports
// -------------------------------------------------------------------
describe('Type exports', () => {
  it('should export WorkspaceAgentConfig interface', () => {
    const config: WorkspaceAgentConfig = {
      workspaceId: 'ws-1',
      userId: 'u-1',
      sessionId: 'sess-1',
    };
    expect(config.workspaceId).toBe('ws-1');
  });

  it('should export ToolUpdate interface', () => {
    const update: ToolUpdate = {
      type: 'tool_start',
      tool: 'execute_shell',
      input: { command: 'ls' },
    };
    expect(update.type).toBe('tool_start');
  });

  it('should export ToolUpdateCallback type', () => {
    const cb: ToolUpdateCallback = vi.fn();
    cb({ type: 'text', text: 'hello' });
    expect(cb).toHaveBeenCalled();
  });
});
