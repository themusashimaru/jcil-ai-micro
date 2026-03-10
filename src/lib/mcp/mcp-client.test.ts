import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock child_process to prevent actual process spawning
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  const { EventEmitter } = await import('events');
  return {
    ...actual,
    spawn: vi.fn(() => {
      const proc = new EventEmitter();
      (proc as unknown as Record<string, unknown>).stdin = {
        writable: true,
        write: vi.fn(),
        end: vi.fn(),
      };
      (proc as unknown as Record<string, unknown>).stdout = new EventEmitter();
      (proc as unknown as Record<string, unknown>).stderr = new EventEmitter();
      (proc as unknown as Record<string, unknown>).kill = vi.fn();
      (proc as unknown as Record<string, unknown>).pid = 12345;
      return proc;
    }),
  };
});

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/lib/workspace/container', () => ({
  ContainerManager: vi.fn(),
  getContainerManager: vi.fn(() => ({
    executeCommand: vi.fn(),
  })),
}));

import {
  MCPClient,
  MCPClientManager,
  getMCPManager,
  type MCPServerConfig,
  type MCPTool,
  type MCPResource,
  type MCPPrompt,
  type MCPCapabilities,
  type MCPServerInfo,
} from './mcp-client';

afterEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// TYPE EXPORT VALIDATION
// ============================================================================

describe('MCP Client type exports', () => {
  it('should export MCPServerConfig interface', () => {
    const config: MCPServerConfig = {
      id: 'test-server',
      name: 'Test MCP Server',
      command: 'echo',
      enabled: true,
    };
    expect(config.id).toBe('test-server');
    expect(config.name).toBe('Test MCP Server');
    expect(config.command).toBe('echo');
    expect(config.enabled).toBe(true);
  });

  it('should support optional MCPServerConfig fields', () => {
    const config: MCPServerConfig = {
      id: 'full',
      name: 'Full Config',
      description: 'A fully configured server',
      command: 'node',
      args: ['server.js'],
      env: { API_KEY: 'test' },
      enabled: true,
      timeout: 5000,
      workspaceId: 'ws-1',
      containerCwd: '/workspace/src',
    };
    expect(config.description).toBe('A fully configured server');
    expect(config.args).toEqual(['server.js']);
    expect(config.env).toEqual({ API_KEY: 'test' });
    expect(config.timeout).toBe(5000);
    expect(config.workspaceId).toBe('ws-1');
    expect(config.containerCwd).toBe('/workspace/src');
  });

  it('should export MCPTool interface', () => {
    const tool: MCPTool = {
      name: 'read_file',
      description: 'Read a file',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    };
    expect(tool.name).toBe('read_file');
    expect(tool.inputSchema.type).toBe('object');
  });

  it('should export MCPResource interface', () => {
    const resource: MCPResource = {
      uri: 'file:///test.txt',
      name: 'test.txt',
      description: 'A test file',
      mimeType: 'text/plain',
    };
    expect(resource.uri).toBe('file:///test.txt');
    expect(resource.mimeType).toBe('text/plain');
  });

  it('should export MCPPrompt interface', () => {
    const prompt: MCPPrompt = {
      name: 'summarize',
      description: 'Summarize text',
      arguments: [{ name: 'text', description: 'Text to summarize', required: true }],
    };
    expect(prompt.name).toBe('summarize');
    expect(prompt.arguments).toHaveLength(1);
  });

  it('should export MCPCapabilities interface', () => {
    const caps: MCPCapabilities = {
      tools: { listChanged: true },
      resources: { subscribe: true, listChanged: false },
      prompts: { listChanged: true },
      logging: {},
    };
    expect(caps.tools?.listChanged).toBe(true);
    expect(caps.resources?.subscribe).toBe(true);
  });

  it('should export MCPServerInfo interface', () => {
    const info: MCPServerInfo = {
      name: 'test-server',
      version: '1.0.0',
      protocolVersion: '2024-11-05',
    };
    expect(info.name).toBe('test-server');
    expect(info.version).toBe('1.0.0');
    expect(info.protocolVersion).toBe('2024-11-05');
  });
});

// ============================================================================
// MCPClient CLASS
// ============================================================================

describe('MCPClient', () => {
  const baseConfig: MCPServerConfig = {
    id: 'test-server',
    name: 'Test Server',
    command: 'echo',
    enabled: true,
  };

  describe('constructor', () => {
    it('should create an instance', () => {
      const client = new MCPClient(baseConfig);
      expect(client).toBeInstanceOf(MCPClient);
    });

    it('should initialize with null serverInfo', () => {
      const client = new MCPClient(baseConfig);
      expect(client.serverInfo).toBeNull();
    });

    it('should initialize with null capabilities', () => {
      const client = new MCPClient(baseConfig);
      expect(client.capabilities).toBeNull();
    });

    it('should initialize with empty tools array', () => {
      const client = new MCPClient(baseConfig);
      expect(client.tools).toEqual([]);
    });

    it('should initialize with empty resources array', () => {
      const client = new MCPClient(baseConfig);
      expect(client.resources).toEqual([]);
    });

    it('should initialize with empty prompts array', () => {
      const client = new MCPClient(baseConfig);
      expect(client.prompts).toEqual([]);
    });

    it('should be an EventEmitter', () => {
      const client = new MCPClient(baseConfig);
      expect(typeof client.on).toBe('function');
      expect(typeof client.emit).toBe('function');
      expect(typeof client.removeListener).toBe('function');
    });
  });

  describe('methods', () => {
    it('should have connect method', () => {
      const client = new MCPClient(baseConfig);
      expect(typeof client.connect).toBe('function');
    });

    it('should have disconnect method', () => {
      const client = new MCPClient(baseConfig);
      expect(typeof client.disconnect).toBe('function');
    });

    it('should have callTool method', () => {
      const client = new MCPClient(baseConfig);
      expect(typeof client.callTool).toBe('function');
    });

    it('should have healthCheck method', () => {
      const client = new MCPClient(baseConfig);
      expect(typeof client.healthCheck).toBe('function');
    });

    it('should have reconnect method', () => {
      const client = new MCPClient(baseConfig);
      expect(typeof client.reconnect).toBe('function');
    });

    it('should have getStatus method', () => {
      const client = new MCPClient(baseConfig);
      expect(typeof client.getStatus).toBe('function');
    });
  });

  describe('getStatus', () => {
    it('should return a string status', () => {
      const client = new MCPClient(baseConfig);
      const status = client.getStatus();
      expect(typeof status).toBe('string');
    });

    it('should return stopped when not connected', () => {
      const client = new MCPClient(baseConfig);
      expect(client.getStatus()).toBe('stopped');
    });

    it('should be one of running, stopped, or error', () => {
      const client = new MCPClient(baseConfig);
      expect(['running', 'stopped', 'error']).toContain(client.getStatus());
    });
  });
});

// ============================================================================
// MCPClientManager CLASS
// ============================================================================

describe('MCPClientManager', () => {
  let manager: MCPClientManager;

  afterEach(() => {
    if (manager) {
      manager.stopHealthMonitor();
    }
  });

  it('should create an instance', () => {
    manager = new MCPClientManager();
    expect(manager).toBeInstanceOf(MCPClientManager);
  });

  it('should have addServer method', () => {
    manager = new MCPClientManager();
    expect(typeof manager.addServer).toBe('function');
  });

  it('should have removeServer method', () => {
    manager = new MCPClientManager();
    expect(typeof manager.removeServer).toBe('function');
  });

  it('should have getClient method', () => {
    manager = new MCPClientManager();
    expect(typeof manager.getClient).toBe('function');
  });

  it('should have stopHealthMonitor method', () => {
    manager = new MCPClientManager();
    expect(typeof manager.stopHealthMonitor).toBe('function');
  });

  it('should have setAutoRestart method', () => {
    manager = new MCPClientManager();
    expect(typeof manager.setAutoRestart).toBe('function');
  });

  it('should return undefined for unknown client', () => {
    manager = new MCPClientManager();
    expect(manager.getClient('nonexistent')).toBeUndefined();
  });

  it('should disable auto-restart without error', () => {
    manager = new MCPClientManager();
    expect(() => manager.setAutoRestart(false)).not.toThrow();
  });
});

// ============================================================================
// getMCPManager SINGLETON
// ============================================================================

describe('getMCPManager', () => {
  it('should return an MCPClientManager', () => {
    const mgr = getMCPManager();
    expect(mgr).toBeInstanceOf(MCPClientManager);
    mgr.stopHealthMonitor();
  });

  it('should return same instance on multiple calls', () => {
    const mgr1 = getMCPManager();
    const mgr2 = getMCPManager();
    expect(mgr1).toBe(mgr2);
    mgr1.stopHealthMonitor();
  });
});
