import { describe, it, expect, vi } from 'vitest';

// Mock external dependencies
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn(),
    };
  },
}));

vi.mock('./container', () => ({
  ContainerManager: vi.fn(),
  getContainerManager: vi.fn(() => ({
    listDirectory: vi.fn(),
    runBuild: vi.fn(),
  })),
  WorkspaceExecutor: vi.fn(() => ({
    run: vi.fn(),
    read: vi.fn(),
    write: vi.fn(),
    gitStatus: vi.fn(),
  })),
}));

vi.mock('./index', () => ({
  CodebaseIndexer: vi.fn(() => ({
    getContextForQuery: vi.fn(),
  })),
  BatchOperationManager: vi.fn(() => ({
    createBatch: vi.fn(),
    execute: vi.fn(),
  })),
}));

vi.mock('@/lib/security/shell-escape', () => ({
  escapeShellArg: vi.fn((s: string) => `'${s}'`),
  sanitizeCommitMessage: vi.fn((s: string) => s),
}));

import {
  CodingAgent,
  StreamingCodingAgent,
  AutonomousAgent,
  type AgentConfig,
  type AgentMessage,
  type ToolCall,
  type ToolResult,
  type AgentResponse,
  type AgentUpdate,
} from './agent';

// -------------------------------------------------------------------
// Type exports
// -------------------------------------------------------------------
describe('Agent type exports', () => {
  it('should export AgentConfig type', () => {
    const config: AgentConfig = {
      workspaceId: 'ws-1',
      model: 'claude-sonnet-4-6',
      maxIterations: 10,
      autoApprove: false,
    };
    expect(config.workspaceId).toBe('ws-1');
  });

  it('should export AgentMessage type', () => {
    const msg: AgentMessage = {
      role: 'user',
      content: 'hello',
    };
    expect(msg.role).toBe('user');
  });

  it('should export ToolCall type', () => {
    const tc: ToolCall = {
      id: 'tc-1',
      name: 'read_file',
      input: { path: '/workspace/file.ts' },
    };
    expect(tc.name).toBe('read_file');
  });

  it('should export ToolResult type', () => {
    const tr: ToolResult = {
      toolCallId: 'tc-1',
      output: 'file contents',
      isError: false,
    };
    expect(tr.isError).toBe(false);
  });

  it('should export AgentResponse type', () => {
    const res: AgentResponse = {
      message: 'done',
      toolsUsed: ['read_file'],
      filesModified: ['src/index.ts'],
      commandsExecuted: ['npm test'],
      iterations: 3,
    };
    expect(res.iterations).toBe(3);
  });

  it('should export AgentUpdate type', () => {
    const update: AgentUpdate = {
      type: 'tool_start',
      tool: 'execute_shell',
      input: { command: 'npm test' },
    };
    expect(update.type).toBe('tool_start');
  });
});

// -------------------------------------------------------------------
// CodingAgent
// -------------------------------------------------------------------
describe('CodingAgent', () => {
  it('should construct with workspace ID', () => {
    const agent = new CodingAgent({ workspaceId: 'ws-1' });
    expect(agent).toBeDefined();
  });

  it('should accept optional config params', () => {
    const agent = new CodingAgent({
      workspaceId: 'ws-1',
      sessionId: 'sess-1',
      model: 'claude-sonnet-4-6',
      maxIterations: 5,
      autoApprove: true,
    });
    expect(agent).toBeDefined();
  });

  it('should be a class with a run method', () => {
    const agent = new CodingAgent({ workspaceId: 'ws-1' });
    expect(typeof agent.run).toBe('function');
  });
});

// -------------------------------------------------------------------
// StreamingCodingAgent
// -------------------------------------------------------------------
describe('StreamingCodingAgent', () => {
  it('should extend CodingAgent', () => {
    const agent = new StreamingCodingAgent({ workspaceId: 'ws-1' });
    expect(agent).toBeInstanceOf(CodingAgent);
  });

  it('should accept onUpdate callback', () => {
    const onUpdate = vi.fn();
    const agent = new StreamingCodingAgent({ workspaceId: 'ws-1' }, onUpdate);
    expect(agent).toBeDefined();
  });

  it('should have runWithStreaming method', () => {
    const agent = new StreamingCodingAgent({ workspaceId: 'ws-1' });
    expect(typeof agent.runWithStreaming).toBe('function');
  });
});

// -------------------------------------------------------------------
// AutonomousAgent
// -------------------------------------------------------------------
describe('AutonomousAgent', () => {
  it('should extend CodingAgent', () => {
    const agent = new AutonomousAgent({ workspaceId: 'ws-1' });
    expect(agent).toBeInstanceOf(CodingAgent);
  });

  it('should have runAutonomous method', () => {
    const agent = new AutonomousAgent({ workspaceId: 'ws-1' });
    expect(typeof agent.runAutonomous).toBe('function');
  });
});
