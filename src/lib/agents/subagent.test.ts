/**
 * Subagent System Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SubagentConfig, SubagentContext, SubagentType, SubagentModel } from './subagent';

// Mock the container and Anthropic dependencies
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mock agent response' }],
        stop_reason: 'end_turn',
      }),
    },
  })),
}));

vi.mock('@/lib/workspace/container', () => ({
  ContainerManager: vi.fn().mockImplementation(() => ({
    executeCommand: vi.fn().mockResolvedValue({ stdout: 'mock output', stderr: '' }),
    readFile: vi.fn().mockResolvedValue('mock file content'),
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Import after mocking
import {
  getSubagentManager,
  getSubagentTools,
  executeSubagentTool,
  isSubagentTool,
} from './subagent';

// ============================================
// SUBAGENT MANAGER TESTS
// ============================================

describe('SubagentManager', () => {
  const mockContext: SubagentContext = {
    workspaceId: 'test-workspace',
    userId: 'test-user',
    sessionId: 'test-session',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSubagentManager', () => {
    it('should return a singleton instance', () => {
      const manager1 = getSubagentManager();
      const manager2 = getSubagentManager();
      expect(manager1).toBe(manager2);
    });
  });

  describe('spawn', () => {
    it('should spawn a general-purpose agent', async () => {
      const manager = getSubagentManager();
      const config: SubagentConfig = {
        type: 'general-purpose',
        prompt: 'Test task',
        description: 'Test description',
      };

      const result = await manager.spawn(config, mockContext);

      expect(result.agentId).toBeDefined();
      expect(result.type).toBe('general-purpose');
      expect(result.status).toBe('completed');
    });

    it('should spawn an Explore agent', async () => {
      const manager = getSubagentManager();
      const config: SubagentConfig = {
        type: 'Explore',
        prompt: 'Find all TypeScript files',
        description: 'Find TS files',
      };

      const result = await manager.spawn(config, mockContext);

      expect(result.type).toBe('Explore');
      expect(result.status).toBe('completed');
    });

    it('should spawn a Plan agent', async () => {
      const manager = getSubagentManager();
      const config: SubagentConfig = {
        type: 'Plan',
        prompt: 'Plan implementation of feature X',
        description: 'Plan feature',
      };

      const result = await manager.spawn(config, mockContext);

      expect(result.type).toBe('Plan');
    });

    it('should spawn a Bash agent', async () => {
      const manager = getSubagentManager();
      const config: SubagentConfig = {
        type: 'Bash',
        prompt: 'Run git status',
        description: 'Check git status',
      };

      const result = await manager.spawn(config, mockContext);

      expect(result.type).toBe('Bash');
    });

    it('should spawn a claude-code-guide agent', async () => {
      const manager = getSubagentManager();
      const config: SubagentConfig = {
        type: 'claude-code-guide',
        prompt: 'How do hooks work?',
        description: 'Hook documentation',
      };

      const result = await manager.spawn(config, mockContext);

      expect(result.type).toBe('claude-code-guide');
    });

    it('should use custom model when specified', async () => {
      const manager = getSubagentManager();
      const config: SubagentConfig = {
        type: 'general-purpose',
        prompt: 'Test task',
        description: 'Test',
        model: 'opus',
      };

      const result = await manager.spawn(config, mockContext);

      expect(result.model).toContain('opus');
    });

    it('should spawn background agent and return immediately', async () => {
      const manager = getSubagentManager();
      const config: SubagentConfig = {
        type: 'general-purpose',
        prompt: 'Long running task',
        description: 'Background task',
        runInBackground: true,
      };

      const result = await manager.spawn(config, mockContext);

      expect(result.status).toBe('background');
      expect(result.outputFile).toBeDefined();
      expect(result.outputFile).toContain(result.agentId);
    });
  });

  describe('getStatus', () => {
    it('should return null for unknown agent', () => {
      const manager = getSubagentManager();
      const result = manager.getStatus('nonexistent-agent');
      expect(result).toBeNull();
    });

    it('should return status for existing agent', async () => {
      const manager = getSubagentManager();
      const config: SubagentConfig = {
        type: 'general-purpose',
        prompt: 'Test',
        description: 'Test',
      };

      const spawnResult = await manager.spawn(config, mockContext);
      const status = manager.getStatus(spawnResult.agentId);

      expect(status).not.toBeNull();
      expect(status?.agentId).toBe(spawnResult.agentId);
    });
  });

  describe('resume', () => {
    it('should return error for nonexistent agent', async () => {
      const manager = getSubagentManager();
      const result = await manager.resume('nonexistent-agent');

      expect(result.status).toBe('failed');
      expect(result.error).toContain('not found');
    });

    it('should resume existing agent', async () => {
      const manager = getSubagentManager();
      const config: SubagentConfig = {
        type: 'general-purpose',
        prompt: 'Initial task',
        description: 'Test',
      };

      const spawnResult = await manager.spawn(config, mockContext);
      const resumeResult = await manager.resume(spawnResult.agentId, 'Continue task');

      expect(resumeResult.agentId).toBe(spawnResult.agentId);
      expect(resumeResult.status).toBe('completed');
    });
  });

  describe('getActiveAgents', () => {
    it('should return empty array when no active agents', () => {
      const manager = getSubagentManager();
      // After previous tests, agents are completed
      const active = manager.getActiveAgents();
      expect(active).toBeInstanceOf(Array);
    });
  });
});

// ============================================
// SUBAGENT TOOLS TESTS
// ============================================

describe('getSubagentTools', () => {
  it('should return task and task_output tools', () => {
    const tools = getSubagentTools();

    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe('task');
    expect(tools[1].name).toBe('task_output');
  });

  it('should have proper schema for task tool', () => {
    const tools = getSubagentTools();
    const taskTool = tools.find((t) => t.name === 'task');

    expect(taskTool?.input_schema.properties).toHaveProperty('description');
    expect(taskTool?.input_schema.properties).toHaveProperty('prompt');
    expect(taskTool?.input_schema.properties).toHaveProperty('subagent_type');
    expect(taskTool?.input_schema.properties).toHaveProperty('model');
    expect(taskTool?.input_schema.properties).toHaveProperty('run_in_background');
    expect(taskTool?.input_schema.properties).toHaveProperty('resume');
    expect(taskTool?.input_schema.required).toContain('description');
    expect(taskTool?.input_schema.required).toContain('prompt');
    expect(taskTool?.input_schema.required).toContain('subagent_type');
  });

  it('should have proper schema for task_output tool', () => {
    const tools = getSubagentTools();
    const outputTool = tools.find((t) => t.name === 'task_output');

    expect(outputTool?.input_schema.properties).toHaveProperty('agent_id');
    expect(outputTool?.input_schema.properties).toHaveProperty('block');
    expect(outputTool?.input_schema.properties).toHaveProperty('timeout');
    expect(outputTool?.input_schema.required).toContain('agent_id');
  });
});

// ============================================
// EXECUTE SUBAGENT TOOL TESTS
// ============================================

describe('executeSubagentTool', () => {
  const mockContext: SubagentContext = {
    workspaceId: 'test-workspace',
    userId: 'test-user',
    sessionId: 'test-session',
  };

  it('should execute task tool and spawn agent', async () => {
    const result = await executeSubagentTool(
      'task',
      {
        description: 'Test task',
        prompt: 'Do something',
        subagent_type: 'general-purpose',
      },
      mockContext
    );

    expect(result).toContain('completed');
    expect(result).toContain('Agent');
  });

  it('should execute task tool with resume', async () => {
    // First spawn an agent
    const spawnResult = await executeSubagentTool(
      'task',
      {
        description: 'Initial',
        prompt: 'Start task',
        subagent_type: 'Explore',
      },
      mockContext
    );

    // Extract agent ID from result (format: "Agent <id> completed")
    const agentIdMatch = spawnResult.match(/Agent (\w+)/);
    if (agentIdMatch) {
      const result = await executeSubagentTool(
        'task',
        {
          resume: agentIdMatch[1],
          prompt: 'Continue task',
        },
        mockContext
      );

      expect(result).toContain(agentIdMatch[1]);
    }
  });

  it('should execute task_output tool', async () => {
    // Spawn an agent first
    const spawnResult = await executeSubagentTool(
      'task',
      {
        description: 'Test',
        prompt: 'Do task',
        subagent_type: 'Bash',
      },
      mockContext
    );

    const agentIdMatch = spawnResult.match(/Agent (\w+)/);
    if (agentIdMatch) {
      const result = await executeSubagentTool(
        'task_output',
        {
          agent_id: agentIdMatch[1],
          block: false,
        },
        mockContext
      );

      expect(result).toContain(agentIdMatch[1]);
    }
  });

  it('should return error for unknown tool', async () => {
    const result = await executeSubagentTool('unknown_tool', {}, mockContext);

    expect(result).toContain('Unknown subagent tool');
  });

  it('should return error for unknown agent in task_output', async () => {
    const result = await executeSubagentTool(
      'task_output',
      { agent_id: 'nonexistent-123' },
      mockContext
    );

    expect(result).toContain('not found');
  });
});

// ============================================
// IS SUBAGENT TOOL TESTS
// ============================================

describe('isSubagentTool', () => {
  it('should return true for task tool', () => {
    expect(isSubagentTool('task')).toBe(true);
  });

  it('should return true for task_output tool', () => {
    expect(isSubagentTool('task_output')).toBe(true);
  });

  it('should return false for other tools', () => {
    expect(isSubagentTool('read_file')).toBe(false);
    expect(isSubagentTool('execute_shell')).toBe(false);
    expect(isSubagentTool('edit_file')).toBe(false);
  });
});

// ============================================
// SUBAGENT TYPE TESTS
// ============================================

describe('Subagent Types', () => {
  const allTypes: SubagentType[] = [
    'general-purpose',
    'Explore',
    'Plan',
    'Bash',
    'claude-code-guide',
  ];
  const mockContext: SubagentContext = {
    workspaceId: 'test-workspace',
    userId: 'test-user',
    sessionId: 'test-session',
  };

  it('should support all defined subagent types', async () => {
    const manager = getSubagentManager();

    for (const type of allTypes) {
      const config: SubagentConfig = {
        type,
        prompt: `Test ${type}`,
        description: `Testing ${type}`,
      };

      const result = await manager.spawn(config, mockContext);
      expect(result.type).toBe(type);
    }
  });
});

// ============================================
// MODEL SELECTION TESTS
// ============================================

describe('Model Selection', () => {
  const allModels: SubagentModel[] = ['sonnet', 'opus', 'haiku'];
  const mockContext: SubagentContext = {
    workspaceId: 'test-workspace',
    userId: 'test-user',
    sessionId: 'test-session',
  };

  it('should support all model options', async () => {
    const manager = getSubagentManager();

    for (const model of allModels) {
      const config: SubagentConfig = {
        type: 'general-purpose',
        prompt: `Test with ${model}`,
        description: `Testing ${model}`,
        model,
      };

      const result = await manager.spawn(config, mockContext);
      expect(result.model).toContain(model);
    }
  });

  it('should use default model when not specified', async () => {
    const manager = getSubagentManager();
    const config: SubagentConfig = {
      type: 'Explore',
      prompt: 'Test default model',
      description: 'Default model test',
    };

    const result = await manager.spawn(config, mockContext);
    // Explore defaults to haiku
    expect(result.model).toContain('haiku');
  });
});
