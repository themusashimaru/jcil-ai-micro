// @ts-nocheck - Test file with extensive mocking
/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock('fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
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
  loadHookConfig,
  parseHookConfig,
  getDefaultHooks,
  validateHookConfig,
} from './hook-config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHookDef(overrides = {}) {
  return {
    command: 'echo test',
    onFailure: 'continue',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('hook-config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue('{}');
  });

  // =========================================================================
  // loadHookConfig
  // =========================================================================

  describe('loadHookConfig', () => {
    it('should return empty config when no files exist', () => {
      mockExistsSync.mockReturnValue(false);
      const config = loadHookConfig('/project');
      expect(config).toEqual({});
    });

    it('should load from .claude/hooks.json', () => {
      mockExistsSync.mockImplementation(
        (p: string) => p.endsWith('hooks.json') && p.includes('.claude')
      );
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          PreToolUse: [makeHookDef()],
        })
      );

      const config = loadHookConfig('/project');
      expect(config.PreToolUse).toHaveLength(1);
    });

    it('should load from .claude/settings.json hooks section', () => {
      mockExistsSync.mockImplementation((p: string) => p.endsWith('settings.json'));
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          hooks: {
            SessionStart: [makeHookDef({ command: 'echo start' })],
          },
        })
      );

      const config = loadHookConfig('/project');
      expect(config.SessionStart).toHaveLength(1);
    });

    it('should merge configs from multiple files', () => {
      mockExistsSync.mockReturnValue(true);
      let callCount = 0;
      mockReadFileSync.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return JSON.stringify({
            PreToolUse: [makeHookDef({ id: 'hook1' })],
          });
        }
        if (callCount === 2) {
          return JSON.stringify({
            hooks: {
              PostToolUse: [makeHookDef({ id: 'hook2' })],
            },
          });
        }
        return JSON.stringify({
          SessionEnd: [makeHookDef({ id: 'hook3' })],
        });
      });

      const config = loadHookConfig('/project');
      expect(config.PreToolUse).toBeDefined();
      expect(config.PostToolUse).toBeDefined();
    });

    it('should handle JSON parse errors gracefully', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('not valid json');

      const config = loadHookConfig('/project');
      expect(config).toEqual({});
    });

    it('should handle file read errors gracefully', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const config = loadHookConfig('/project');
      expect(config).toEqual({});
    });
  });

  // =========================================================================
  // parseHookConfig
  // =========================================================================

  describe('parseHookConfig', () => {
    it('should parse valid JSON hook config', () => {
      const json = JSON.stringify({
        PreToolUse: [makeHookDef()],
      });
      const config = parseHookConfig(json);
      expect(config.PreToolUse).toHaveLength(1);
    });

    it('should handle hooks wrapper', () => {
      const json = JSON.stringify({
        hooks: {
          SessionStart: [makeHookDef()],
        },
      });
      const config = parseHookConfig(json);
      expect(config.SessionStart).toHaveLength(1);
    });

    it('should return empty config for invalid JSON', () => {
      const config = parseHookConfig('not json');
      expect(config).toEqual({});
    });

    it('should normalize hook definitions', () => {
      const json = JSON.stringify({
        PreToolUse: [{ command: 'test' }],
      });
      const config = parseHookConfig(json);
      const hook = config.PreToolUse![0];
      expect(hook.onFailure).toBe('continue');
      expect(hook.once).toBe(false);
      expect(hook.timeout).toBe(30000);
      expect(hook.enabled).toBe(true);
    });

    it('should generate IDs for hooks without them', () => {
      const json = JSON.stringify({
        PostToolUse: [{ command: 'prettier' }],
      });
      const config = parseHookConfig(json);
      expect(config.PostToolUse![0].id).toMatch(/^hook_/);
    });

    it('should preserve explicit IDs', () => {
      const json = JSON.stringify({
        PreToolUse: [{ id: 'my-hook', command: 'test' }],
      });
      const config = parseHookConfig(json);
      expect(config.PreToolUse![0].id).toBe('my-hook');
    });

    it('should handle empty JSON object', () => {
      const config = parseHookConfig('{}');
      expect(config).toEqual({});
    });
  });

  // =========================================================================
  // getDefaultHooks
  // =========================================================================

  describe('getDefaultHooks', () => {
    it('should return PreToolUse hooks', () => {
      const defaults = getDefaultHooks();
      expect(defaults.PreToolUse).toBeDefined();
      expect(defaults.PreToolUse!.length).toBeGreaterThan(0);
    });

    it('should return PostToolUse hooks', () => {
      const defaults = getDefaultHooks();
      expect(defaults.PostToolUse).toBeDefined();
    });

    it('should return SessionStart hooks', () => {
      const defaults = getDefaultHooks();
      expect(defaults.SessionStart).toBeDefined();
    });

    it('should have all hooks disabled by default', () => {
      const defaults = getDefaultHooks();
      for (const [, hooks] of Object.entries(defaults)) {
        for (const hook of hooks) {
          expect(hook.enabled).toBe(false);
        }
      }
    });

    it('should have valid IDs on all default hooks', () => {
      const defaults = getDefaultHooks();
      for (const [, hooks] of Object.entries(defaults)) {
        for (const hook of hooks) {
          expect(hook.id).toBeDefined();
          expect(typeof hook.id).toBe('string');
        }
      }
    });

    it('should have descriptions on all default hooks', () => {
      const defaults = getDefaultHooks();
      for (const [, hooks] of Object.entries(defaults)) {
        for (const hook of hooks) {
          expect(hook.description).toBeDefined();
        }
      }
    });
  });

  // =========================================================================
  // validateHookConfig
  // =========================================================================

  describe('validateHookConfig', () => {
    it('should validate empty config as valid', () => {
      const result = validateHookConfig({});
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate config with command hooks as valid', () => {
      const result = validateHookConfig({
        PreToolUse: [makeHookDef()],
      });
      expect(result.valid).toBe(true);
    });

    it('should validate config with prompt hooks as valid', () => {
      const result = validateHookConfig({
        PreToolUse: [{ prompt: 'Is this safe?' }],
      });
      expect(result.valid).toBe(true);
    });

    it('should reject hooks without command or prompt', () => {
      const result = validateHookConfig({
        PreToolUse: [{ description: 'No action' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('command');
    });

    it('should reject invalid onFailure values', () => {
      const result = validateHookConfig({
        PreToolUse: [{ command: 'test', onFailure: 'invalid' }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('onFailure');
    });

    it('should accept valid onFailure values', () => {
      for (const value of ['block', 'warn', 'continue']) {
        const result = validateHookConfig({
          PreToolUse: [{ command: 'test', onFailure: value }],
        });
        expect(result.valid).toBe(true);
      }
    });

    it('should reject negative timeout', () => {
      const result = validateHookConfig({
        PreToolUse: [{ command: 'test', timeout: -1 }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Timeout');
    });

    it('should reject timeout over 600000', () => {
      const result = validateHookConfig({
        PreToolUse: [{ command: 'test', timeout: 700000 }],
      });
      expect(result.valid).toBe(false);
    });

    it('should accept timeout at boundary (0 and 600000)', () => {
      expect(
        validateHookConfig({
          PreToolUse: [{ command: 'test', timeout: 0 }],
        }).valid
      ).toBe(true);

      expect(
        validateHookConfig({
          PreToolUse: [{ command: 'test', timeout: 600000 }],
        }).valid
      ).toBe(true);
    });

    it('should validate multiple event types', () => {
      const result = validateHookConfig({
        PreToolUse: [makeHookDef()],
        PostToolUse: [makeHookDef()],
        SessionStart: [{ description: 'no action' }], // invalid
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('SessionStart');
    });

    it('should report correct index in error prefix', () => {
      const result = validateHookConfig({
        PreToolUse: [
          makeHookDef(),
          { description: 'bad hook' }, // index 1
        ],
      });
      expect(result.errors[0]).toContain('[1]');
    });

    it('should collect multiple errors', () => {
      const result = validateHookConfig({
        PreToolUse: [{ description: 'no action' }],
        PostToolUse: [{ description: 'also no action' }],
      });
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});
