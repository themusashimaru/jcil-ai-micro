import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ExtendedThinkingManager,
  DEFAULT_THINKING_CONFIG,
  getExtendedThinkingManager,
  getExtendedThinkingTools,
  executeExtendedThinkingTool,
  isExtendedThinkingTool,
  formatThinkingForDisplay,
} from './extended-thinking';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

let manager: ExtendedThinkingManager;

beforeEach(() => {
  manager = new ExtendedThinkingManager();
});

// -------------------------------------------------------------------
// DEFAULT_THINKING_CONFIG
// -------------------------------------------------------------------
describe('DEFAULT_THINKING_CONFIG', () => {
  it('should have disabled by default', () => {
    expect(DEFAULT_THINKING_CONFIG.enabled).toBe(false);
  });

  it('should have a budget', () => {
    expect(DEFAULT_THINKING_CONFIG.budgetTokens).toBe(10000);
  });

  it('should show and stream thinking by default', () => {
    expect(DEFAULT_THINKING_CONFIG.showThinking).toBe(true);
    expect(DEFAULT_THINKING_CONFIG.streamThinking).toBe(true);
  });
});

// -------------------------------------------------------------------
// ExtendedThinkingManager
// -------------------------------------------------------------------
describe('ExtendedThinkingManager', () => {
  describe('getConfig', () => {
    it('should return defaults for new session', () => {
      const config = manager.getConfig('new-session');
      expect(config.enabled).toBe(false);
      expect(config.budgetTokens).toBe(10000);
    });

    it('should return stored config', () => {
      manager.setConfig('s1', { enabled: true });
      expect(manager.getConfig('s1').enabled).toBe(true);
    });
  });

  describe('setConfig', () => {
    it('should merge partial config', () => {
      manager.setConfig('s1', { enabled: true });
      const config = manager.getConfig('s1');
      expect(config.enabled).toBe(true);
      expect(config.budgetTokens).toBe(10000); // default preserved
    });
  });

  describe('enable/disable/toggle', () => {
    it('should enable thinking', () => {
      manager.enable('s1');
      expect(manager.getConfig('s1').enabled).toBe(true);
    });

    it('should enable with custom budget', () => {
      manager.enable('s1', 20000);
      const config = manager.getConfig('s1');
      expect(config.enabled).toBe(true);
      expect(config.budgetTokens).toBe(20000);
    });

    it('should disable thinking', () => {
      manager.enable('s1');
      manager.disable('s1');
      expect(manager.getConfig('s1').enabled).toBe(false);
    });

    it('should toggle thinking', () => {
      expect(manager.toggle('s1')).toBe(true);
      expect(manager.toggle('s1')).toBe(false);
      expect(manager.toggle('s1')).toBe(true);
    });
  });

  describe('setBudget', () => {
    it('should set budget within bounds', () => {
      manager.setBudget('s1', 25000);
      expect(manager.getConfig('s1').budgetTokens).toBe(25000);
    });

    it('should clamp budget to minimum 1000', () => {
      manager.setBudget('s1', 100);
      expect(manager.getConfig('s1').budgetTokens).toBe(1000);
    });

    it('should clamp budget to maximum 50000', () => {
      manager.setBudget('s1', 100000);
      expect(manager.getConfig('s1').budgetTokens).toBe(50000);
    });
  });

  describe('recordThinking', () => {
    it('should record thinking output', () => {
      const output = manager.recordThinking('s1', 'Let me think about this...', 500);
      expect(output.content).toBe('Let me think about this...');
      expect(output.tokensUsed).toBe(500);
      expect(output.id).toMatch(/^think_/);
    });

    it('should accumulate thinking outputs', () => {
      manager.recordThinking('s1', 'First thought');
      manager.recordThinking('s1', 'Second thought');
      expect(manager.getThinkingOutputs('s1')).toHaveLength(2);
    });
  });

  describe('getThinkingOutputs', () => {
    it('should return empty array for new session', () => {
      expect(manager.getThinkingOutputs('new')).toEqual([]);
    });
  });

  describe('getLatestThinking', () => {
    it('should return undefined for new session', () => {
      expect(manager.getLatestThinking('new')).toBeUndefined();
    });

    it('should return latest output', () => {
      manager.recordThinking('s1', 'First');
      manager.recordThinking('s1', 'Second');
      expect(manager.getLatestThinking('s1')?.content).toBe('Second');
    });
  });

  describe('clearThinking', () => {
    it('should clear thinking outputs', () => {
      manager.recordThinking('s1', 'Thought');
      manager.clearThinking('s1');
      expect(manager.getThinkingOutputs('s1')).toHaveLength(0);
    });
  });

  describe('clearSession', () => {
    it('should clear both config and outputs', () => {
      manager.enable('s1');
      manager.recordThinking('s1', 'Thought');
      manager.clearSession('s1');
      expect(manager.getConfig('s1').enabled).toBe(false);
      expect(manager.getThinkingOutputs('s1')).toHaveLength(0);
    });
  });

  describe('buildAPIParams', () => {
    it('should return empty when disabled', () => {
      const params = manager.buildAPIParams('s1');
      expect(params).toEqual({});
    });

    it('should return thinking params when enabled', () => {
      manager.enable('s1', 15000);
      const params = manager.buildAPIParams('s1');
      expect(params.thinking).toEqual({
        type: 'enabled',
        budget_tokens: 15000,
      });
    });
  });
});

// -------------------------------------------------------------------
// getExtendedThinkingManager (singleton)
// -------------------------------------------------------------------
describe('getExtendedThinkingManager', () => {
  it('should return same instance', () => {
    const m1 = getExtendedThinkingManager();
    const m2 = getExtendedThinkingManager();
    expect(m1).toBe(m2);
  });
});

// -------------------------------------------------------------------
// getExtendedThinkingTools
// -------------------------------------------------------------------
describe('getExtendedThinkingTools', () => {
  it('should return 3 tools', () => {
    const tools = getExtendedThinkingTools();
    expect(tools).toHaveLength(3);
    expect(tools.map((t) => t.name)).toEqual([
      'thinking_enable',
      'thinking_disable',
      'thinking_status',
    ]);
  });
});

// -------------------------------------------------------------------
// executeExtendedThinkingTool
// -------------------------------------------------------------------
describe('executeExtendedThinkingTool', () => {
  it('should enable thinking', () => {
    const result = executeExtendedThinkingTool('thinking_enable', {}, 'test-session');
    expect(result).toContain('enabled');
  });

  it('should enable with custom budget', () => {
    const result = executeExtendedThinkingTool(
      'thinking_enable',
      { budget: 20000 },
      'test-session'
    );
    expect(result).toContain('enabled');
    expect(result).toContain('20,000');
  });

  it('should disable thinking', () => {
    const result = executeExtendedThinkingTool('thinking_disable', {}, 'test-session');
    expect(result).toContain('disabled');
  });

  it('should show status', () => {
    const result = executeExtendedThinkingTool('thinking_status', {}, 'test-session');
    expect(result).toContain('Extended Thinking Status');
    expect(result).toContain('Budget');
  });

  it('should handle unknown tool', () => {
    const result = executeExtendedThinkingTool('thinking_unknown', {}, 'test-session');
    expect(result).toContain('Unknown');
  });
});

// -------------------------------------------------------------------
// isExtendedThinkingTool
// -------------------------------------------------------------------
describe('isExtendedThinkingTool', () => {
  it('should return true for thinking tools', () => {
    expect(isExtendedThinkingTool('thinking_enable')).toBe(true);
    expect(isExtendedThinkingTool('thinking_disable')).toBe(true);
    expect(isExtendedThinkingTool('thinking_status')).toBe(true);
  });

  it('should return false for other tools', () => {
    expect(isExtendedThinkingTool('other_tool')).toBe(false);
  });
});

// -------------------------------------------------------------------
// formatThinkingForDisplay
// -------------------------------------------------------------------
describe('formatThinkingForDisplay', () => {
  it('should format as HTML details element', () => {
    const output = {
      id: 'think_1',
      content: 'Deep reasoning here',
      timestamp: Date.now(),
    };
    const result = formatThinkingForDisplay(output);
    expect(result).toContain('<details>');
    expect(result).toContain('</details>');
    expect(result).toContain('Deep reasoning here');
    expect(result).toContain('Thinking');
  });

  it('should include token count when available', () => {
    const output = {
      id: 'think_1',
      content: 'Reasoning',
      timestamp: Date.now(),
      tokensUsed: 1500,
    };
    const result = formatThinkingForDisplay(output);
    expect(result).toContain('1,500 tokens');
  });
});
