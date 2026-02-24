import { describe, it, expect, vi } from 'vitest';
import {
  ModelConfigManager,
  AVAILABLE_MODELS,
  DEFAULT_PREFERENCES,
  getModelConfigManager,
  getModelConfigTools,
  executeModelConfigTool,
  isModelConfigTool,
} from './model-config';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// -------------------------------------------------------------------
// AVAILABLE_MODELS
// -------------------------------------------------------------------
describe('AVAILABLE_MODELS', () => {
  it('should have 3 models', () => {
    expect(AVAILABLE_MODELS).toHaveLength(3);
  });

  it('should include sonnet, opus, haiku types', () => {
    const types = AVAILABLE_MODELS.map((m) => m.type);
    expect(types).toContain('sonnet');
    expect(types).toContain('opus');
    expect(types).toContain('haiku');
  });

  it('should have sonnet as recommended', () => {
    const sonnet = AVAILABLE_MODELS.find((m) => m.type === 'sonnet');
    expect(sonnet?.recommended).toBe(true);
  });

  it('should all support vision', () => {
    AVAILABLE_MODELS.forEach((m) => expect(m.supportsVision).toBe(true));
  });

  it('should all have 200K context window', () => {
    AVAILABLE_MODELS.forEach((m) => expect(m.contextWindow).toBe(200000));
  });
});

// -------------------------------------------------------------------
// DEFAULT_PREFERENCES
// -------------------------------------------------------------------
describe('DEFAULT_PREFERENCES', () => {
  it('should default to sonnet', () => {
    expect(DEFAULT_PREFERENCES.defaultModel).toBe('claude-sonnet-4-6');
  });

  it('should have extended thinking disabled', () => {
    expect(DEFAULT_PREFERENCES.extendedThinking).toBe(false);
  });
});

// -------------------------------------------------------------------
// ModelConfigManager
// -------------------------------------------------------------------
describe('ModelConfigManager', () => {
  const mgr = new ModelConfigManager();

  describe('getAvailableModels', () => {
    it('should return all models', () => {
      expect(mgr.getAvailableModels()).toEqual(AVAILABLE_MODELS);
    });
  });

  describe('getModel', () => {
    it('should find model by ID', () => {
      const model = mgr.getModel('claude-sonnet-4-6');
      expect(model?.name).toBe('Claude Sonnet 4.6');
    });

    it('should return undefined for unknown model', () => {
      expect(mgr.getModel('unknown')).toBeUndefined();
    });
  });

  describe('getModelByType', () => {
    it('should find model by type', () => {
      expect(mgr.getModelByType('opus').id).toBe('claude-opus-4-6');
    });

    it('should default to sonnet for unknown type', () => {
      expect(mgr.getModelByType('unknown' as 'sonnet').id).toBe('claude-sonnet-4-6');
    });
  });

  describe('getCurrentModel', () => {
    it('should return sonnet by default', () => {
      const model = mgr.getCurrentModel();
      expect(model.type).toBe('sonnet');
    });

    it('should return session-specific model', () => {
      const m = new ModelConfigManager();
      m.setSessionModel('s1', 'claude-opus-4-6');
      expect(m.getCurrentModel('s1').type).toBe('opus');
    });
  });

  describe('setSessionModel', () => {
    it('should set valid model', () => {
      const m = new ModelConfigManager();
      expect(m.setSessionModel('s1', 'claude-opus-4-6')).toBe(true);
      expect(m.getCurrentModel('s1').type).toBe('opus');
    });

    it('should reject invalid model ID', () => {
      const m = new ModelConfigManager();
      expect(m.setSessionModel('s1', 'invalid-model')).toBe(false);
    });
  });

  describe('getSessionPreferences', () => {
    it('should return defaults for new session', () => {
      const m = new ModelConfigManager();
      const prefs = m.getSessionPreferences('new-session');
      expect(prefs.defaultModel).toBe(DEFAULT_PREFERENCES.defaultModel);
    });
  });

  describe('updateSessionPreferences', () => {
    it('should merge partial preferences', () => {
      const m = new ModelConfigManager();
      m.updateSessionPreferences('s1', { temperature: 0.3 });
      const prefs = m.getSessionPreferences('s1');
      expect(prefs.temperature).toBe(0.3);
      expect(prefs.maxTokens).toBe(DEFAULT_PREFERENCES.maxTokens);
    });
  });

  describe('setExtendedThinking', () => {
    it('should enable extended thinking', () => {
      const m = new ModelConfigManager();
      m.setExtendedThinking('s1', true, 20000);
      const prefs = m.getSessionPreferences('s1');
      expect(prefs.extendedThinking).toBe(true);
      expect(prefs.thinkingBudget).toBe(20000);
    });

    it('should disable extended thinking', () => {
      const m = new ModelConfigManager();
      m.setExtendedThinking('s1', true);
      m.setExtendedThinking('s1', false);
      expect(m.getSessionPreferences('s1').extendedThinking).toBe(false);
    });
  });

  describe('clearSessionPreferences', () => {
    it('should clear session preferences', () => {
      const m = new ModelConfigManager();
      m.updateSessionPreferences('s1', { temperature: 0.1 });
      m.clearSessionPreferences('s1');
      expect(m.getSessionPreferences('s1').temperature).toBe(DEFAULT_PREFERENCES.temperature);
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost for sonnet', () => {
      const m = new ModelConfigManager();
      const cost = m.calculateCost('claude-sonnet-4-6', 1000, 1000);
      expect(cost.inputCost).toBe(0.3);
      expect(cost.outputCost).toBe(1.5);
      expect(cost.totalCost).toBe(1.8);
    });

    it('should return zero for unknown model', () => {
      const m = new ModelConfigManager();
      const cost = m.calculateCost('unknown', 1000, 1000);
      expect(cost.totalCost).toBe(0);
    });
  });

  describe('getModelOptions', () => {
    it('should return options with badges', () => {
      const m = new ModelConfigManager();
      const options = m.getModelOptions();
      const opus = options.find((o) => o.type === 'opus');
      const haiku = options.find((o) => o.type === 'haiku');
      expect(opus?.badge).toBe('Most Capable');
      expect(haiku?.badge).toBe('Fastest');
    });

    it('should mark sonnet as recommended', () => {
      const m = new ModelConfigManager();
      const options = m.getModelOptions();
      const sonnet = options.find((o) => o.type === 'sonnet');
      expect(sonnet?.recommended).toBe(true);
    });
  });
});

// -------------------------------------------------------------------
// getModelConfigManager (singleton)
// -------------------------------------------------------------------
describe('getModelConfigManager', () => {
  it('should return same instance', () => {
    expect(getModelConfigManager()).toBe(getModelConfigManager());
  });
});

// -------------------------------------------------------------------
// executeModelConfigTool
// -------------------------------------------------------------------
describe('executeModelConfigTool', () => {
  it('should list models', () => {
    const result = executeModelConfigTool('model_list', {}, 'test');
    expect(result).toContain('Available Models');
    expect(result).toContain('Sonnet');
    expect(result).toContain('Opus');
    expect(result).toContain('Haiku');
  });

  it('should select model', () => {
    const result = executeModelConfigTool('model_select', { model: 'opus' }, 'test');
    expect(result).toContain('Opus');
  });

  it('should show current model', () => {
    const result = executeModelConfigTool('model_current', {}, 'test');
    expect(result).toContain('Current Model');
  });

  it('should handle unknown tool', () => {
    const result = executeModelConfigTool('model_unknown', {}, 'test');
    expect(result).toContain('Unknown');
  });
});

// -------------------------------------------------------------------
// isModelConfigTool
// -------------------------------------------------------------------
describe('isModelConfigTool', () => {
  it('should return true for model tools', () => {
    expect(isModelConfigTool('model_list')).toBe(true);
    expect(isModelConfigTool('model_select')).toBe(true);
    expect(isModelConfigTool('model_current')).toBe(true);
  });

  it('should return false for non-model tools', () => {
    expect(isModelConfigTool('other')).toBe(false);
  });
});

// -------------------------------------------------------------------
// getModelConfigTools
// -------------------------------------------------------------------
describe('getModelConfigTools', () => {
  it('should return 3 tools', () => {
    expect(getModelConfigTools()).toHaveLength(3);
  });
});
