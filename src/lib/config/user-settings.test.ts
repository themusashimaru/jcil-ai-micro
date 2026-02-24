import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  type ThemeSettings,
  type ModelSettings,
  type PermissionRule,
  type PermissionSettings,
  type PromptSettings,
  type ToolSettings,
  type UserSettings,
  DEFAULT_SETTINGS,
  SettingsLoader,
  getSettingsTools,
  executeSettingsTool,
  isSettingsTool,
  getSettingsLoader,
  clearSettingsLoader,
} from './user-settings';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

describe('UserSettings type exports', () => {
  it('should export ThemeSettings interface', () => {
    const t: ThemeSettings = { mode: 'dark', fontSize: 14, vimMode: true };
    expect(t.mode).toBe('dark');
  });

  it('should export ModelSettings interface', () => {
    const m: ModelSettings = { default: 'sonnet', quick: 'haiku', temperature: 0.7 };
    expect(m.default).toBe('sonnet');
  });

  it('should export PermissionRule interface', () => {
    const r: PermissionRule = { pattern: '*.ts', action: 'allow', reason: 'TypeScript files' };
    expect(r.action).toBe('allow');
  });

  it('should export PermissionSettings interface', () => {
    const p: PermissionSettings = { autoApproveReads: true, rules: [] };
    expect(p.autoApproveReads).toBe(true);
  });

  it('should export PromptSettings interface', () => {
    const p: PromptSettings = { language: 'en', personality: 'helpful' };
    expect(p.language).toBe('en');
  });

  it('should export ToolSettings interface', () => {
    const t: ToolSettings = { disabled: ['tool1'], config: { tool1: { key: 'val' } } };
    expect(t.disabled).toContain('tool1');
  });

  it('should export UserSettings interface', () => {
    const s: UserSettings = DEFAULT_SETTINGS;
    expect(s.version).toBe(1);
  });
});

// ============================================================================
// DEFAULT_SETTINGS
// ============================================================================

describe('DEFAULT_SETTINGS', () => {
  it('should have version 1', () => {
    expect(DEFAULT_SETTINGS.version).toBe(1);
  });

  it('should have system theme mode', () => {
    expect(DEFAULT_SETTINGS.theme.mode).toBe('system');
  });

  it('should default to sonnet model', () => {
    expect(DEFAULT_SETTINGS.model.default).toBe('sonnet');
  });

  it('should auto-approve reads by default', () => {
    expect(DEFAULT_SETTINGS.permissions.autoApproveReads).toBe(true);
  });

  it('should deny .env files by default', () => {
    expect(DEFAULT_SETTINGS.permissions.deniedPaths).toContain('.env');
  });

  it('should have empty disabled tools', () => {
    expect(DEFAULT_SETTINGS.tools.disabled).toEqual([]);
  });
});

// ============================================================================
// SettingsLoader
// ============================================================================

describe('SettingsLoader', () => {
  let loader: SettingsLoader;
  let mockReadFile: ReturnType<typeof vi.fn>;
  let mockWriteFile: ReturnType<typeof vi.fn>;
  let mockFileExists: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockReadFile = vi.fn().mockResolvedValue('{}');
    mockWriteFile = vi.fn().mockResolvedValue(undefined);
    mockFileExists = vi.fn().mockResolvedValue(false);
    loader = new SettingsLoader(mockReadFile, mockWriteFile, mockFileExists);
  });

  describe('getSettings', () => {
    it('should return default settings initially', () => {
      const settings = loader.getSettings();
      expect(settings.version).toBe(1);
      expect(settings.theme.mode).toBe('system');
    });
  });

  describe('loadSettings', () => {
    it('should load from workspace root', async () => {
      mockFileExists.mockResolvedValue(true);
      mockReadFile.mockResolvedValue(JSON.stringify({ theme: { mode: 'dark' } }));

      const settings = await loader.loadSettings('/workspace');
      expect(settings.theme.mode).toBe('dark');
    });

    it('should fallback to defaults if no file found', async () => {
      mockFileExists.mockResolvedValue(false);

      const settings = await loader.loadSettings('/workspace');
      expect(settings.theme.mode).toBe('system');
    });

    it('should handle JSON parse errors gracefully', async () => {
      mockFileExists.mockResolvedValue(true);
      mockReadFile.mockResolvedValue('invalid json');

      const settings = await loader.loadSettings('/workspace');
      expect(settings.version).toBe(1); // Falls back to defaults
    });
  });

  describe('getSetting', () => {
    it('should get nested settings by path', () => {
      expect(loader.getSetting<string>('theme.mode')).toBe('system');
    });

    it('should get deep nested settings', () => {
      expect(loader.getSetting<number>('model.temperature')).toBe(0.7);
    });

    it('should return undefined for non-existent paths', () => {
      expect(loader.getSetting('nonexistent.path')).toBeUndefined();
    });
  });

  describe('updateSettings', () => {
    it('should merge theme settings', async () => {
      await loader.updateSettings({ theme: { mode: 'dark' } as ThemeSettings }, '/workspace');
      expect(loader.getSettings().theme.mode).toBe('dark');
      // Other theme settings should be preserved
      expect(loader.getSettings().theme.fontSize).toBe(14);
    });

    it('should merge model settings', async () => {
      await loader.updateSettings({ model: { default: 'opus' } as ModelSettings }, '/workspace');
      expect(loader.getSettings().model.default).toBe('opus');
    });

    it('should write to file', async () => {
      await loader.updateSettings({ theme: { mode: 'dark' } as ThemeSettings }, '/workspace');
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
    });

    it('should append to permission arrays', async () => {
      await loader.updateSettings({ permissions: { allowedPaths: ['/src'] } }, '/workspace');
      expect(loader.getSettings().permissions.allowedPaths).toContain('/src');
    });

    it('should append to disabled tools', async () => {
      await loader.updateSettings({ tools: { disabled: ['tool-x'] } }, '/workspace');
      expect(loader.getSettings().tools.disabled).toContain('tool-x');
    });

    it('should merge custom settings', async () => {
      await loader.updateSettings({ custom: { key1: 'value1' } }, '/workspace');
      expect(loader.getSettings().custom?.key1).toBe('value1');
    });
  });

  describe('isPathAllowed', () => {
    it('should deny .env files', () => {
      expect(loader.isPathAllowed('.env')).toBe('deny');
    });

    it('should deny .env.* files', () => {
      expect(loader.isPathAllowed('.env.local')).toBe('deny');
    });

    it('should return ask for unknown paths', () => {
      expect(loader.isPathAllowed('src/app.ts')).toBe('ask');
    });

    it('should match allowed paths', async () => {
      await loader.updateSettings({ permissions: { allowedPaths: ['src/*'] } }, '/workspace');
      expect(loader.isPathAllowed('src/app.ts')).toBe('allow');
    });

    it('should check custom rules', async () => {
      await loader.updateSettings(
        {
          permissions: {
            rules: [{ pattern: '*.test.ts', action: 'allow' }],
          },
        },
        '/workspace'
      );
      expect(loader.isPathAllowed('app.test.ts')).toBe('allow');
    });

    it('should prioritize deny over allow', () => {
      // .env is in deniedPaths by default
      expect(loader.isPathAllowed('.env')).toBe('deny');
    });
  });

  describe('isToolDisabled', () => {
    it('should return false for enabled tools', () => {
      expect(loader.isToolDisabled('some-tool')).toBe(false);
    });

    it('should return true for disabled tools', async () => {
      await loader.updateSettings({ tools: { disabled: ['my-tool'] } }, '/workspace');
      expect(loader.isToolDisabled('my-tool')).toBe(true);
    });
  });

  describe('getToolConfig', () => {
    it('should return undefined for unconfigured tools', () => {
      expect(loader.getToolConfig('unknown-tool')).toBeUndefined();
    });

    it('should return config for configured tools', async () => {
      await loader.updateSettings(
        { tools: { config: { 'my-tool': { apiKey: 'test' } } } },
        '/workspace'
      );
      expect(loader.getToolConfig('my-tool')).toEqual({ apiKey: 'test' });
    });
  });
});

// ============================================================================
// SETTINGS TOOLS
// ============================================================================

describe('getSettingsTools', () => {
  it('should return 3 tools', () => {
    const tools = getSettingsTools();
    expect(tools).toHaveLength(3);
  });

  it('should include settings_get', () => {
    const tools = getSettingsTools();
    expect(tools.find((t) => t.name === 'settings_get')).toBeDefined();
  });

  it('should include settings_update', () => {
    const tools = getSettingsTools();
    expect(tools.find((t) => t.name === 'settings_update')).toBeDefined();
  });

  it('should include settings_reset', () => {
    const tools = getSettingsTools();
    expect(tools.find((t) => t.name === 'settings_reset')).toBeDefined();
  });
});

describe('executeSettingsTool', () => {
  let loader: SettingsLoader;

  beforeEach(() => {
    loader = new SettingsLoader(
      vi.fn().mockResolvedValue('{}'),
      vi.fn().mockResolvedValue(undefined),
      vi.fn().mockResolvedValue(false)
    );
  });

  it('should get all settings', async () => {
    const result = await executeSettingsTool('settings_get', {}, loader);
    const parsed = JSON.parse(result);
    expect(parsed.version).toBe(1);
  });

  it('should get setting by path', async () => {
    const result = await executeSettingsTool('settings_get', { path: 'theme.mode' }, loader);
    expect(result).toContain('system');
  });

  it('should return not found for invalid path', async () => {
    const result = await executeSettingsTool('settings_get', { path: 'invalid.path' }, loader);
    expect(result).toContain('not found');
  });

  it('should update settings', async () => {
    const result = await executeSettingsTool(
      'settings_update',
      { theme: { mode: 'dark' } },
      loader
    );
    expect(result).toContain('updated');
    expect(result).toContain('theme');
  });

  it('should handle empty update', async () => {
    const result = await executeSettingsTool('settings_update', {}, loader);
    expect(result).toContain('No settings to update');
  });

  it('should reset all settings', async () => {
    const result = await executeSettingsTool('settings_reset', { category: 'all' }, loader);
    expect(result).toContain('reset to defaults');
  });

  it('should reset specific category', async () => {
    const result = await executeSettingsTool('settings_reset', { category: 'theme' }, loader);
    expect(result).toContain('theme');
    expect(result).toContain('reset to defaults');
  });

  it('should handle unknown category', async () => {
    const result = await executeSettingsTool('settings_reset', { category: 'invalid' }, loader);
    expect(result).toContain('Unknown category');
  });

  it('should handle unknown tool name', async () => {
    const result = await executeSettingsTool('settings_unknown', {}, loader);
    expect(result).toContain('Unknown settings tool');
  });
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

describe('isSettingsTool', () => {
  it('should return true for settings tools', () => {
    expect(isSettingsTool('settings_get')).toBe(true);
    expect(isSettingsTool('settings_update')).toBe(true);
    expect(isSettingsTool('settings_reset')).toBe(true);
  });

  it('should return false for non-settings tools', () => {
    expect(isSettingsTool('other_tool')).toBe(false);
    expect(isSettingsTool('get_settings')).toBe(false);
  });
});

describe('getSettingsLoader', () => {
  beforeEach(() => {
    clearSettingsLoader();
  });

  it('should return a SettingsLoader instance', () => {
    const loader = getSettingsLoader(vi.fn(), vi.fn(), vi.fn());
    expect(loader).toBeInstanceOf(SettingsLoader);
  });

  it('should return same instance on subsequent calls', () => {
    const readFile = vi.fn();
    const writeFile = vi.fn();
    const fileExists = vi.fn();
    const loader1 = getSettingsLoader(readFile, writeFile, fileExists);
    const loader2 = getSettingsLoader(vi.fn(), vi.fn(), vi.fn());
    expect(loader1).toBe(loader2);
  });
});

describe('clearSettingsLoader', () => {
  it('should clear the singleton instance', () => {
    const loader1 = getSettingsLoader(vi.fn(), vi.fn(), vi.fn());
    clearSettingsLoader();
    const loader2 = getSettingsLoader(vi.fn(), vi.fn(), vi.fn());
    expect(loader1).not.toBe(loader2);
  });
});
