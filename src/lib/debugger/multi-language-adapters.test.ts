import { describe, it, expect, vi } from 'vitest';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('./cdp-client', () => ({
  CDPClient: vi.fn(),
}));

vi.mock('./dap-client', () => ({
  DAPClient: vi.fn(),
}));

import { LANGUAGE_CONFIGS, type DebugLanguage } from './multi-language-adapters';

// -------------------------------------------------------------------
// LANGUAGE_CONFIGS
// -------------------------------------------------------------------
describe('LANGUAGE_CONFIGS', () => {
  it('should be a non-empty record', () => {
    const keys = Object.keys(LANGUAGE_CONFIGS);
    expect(keys.length).toBeGreaterThanOrEqual(20);
  });

  describe('common languages', () => {
    const expectedLanguages: DebugLanguage[] = [
      'node',
      'python',
      'go',
      'rust',
      'java',
      'kotlin',
      'c',
      'cpp',
      'ruby',
      'php',
      'csharp',
      'swift',
      'bash',
    ];

    for (const lang of expectedLanguages) {
      it(`should include ${lang} configuration`, () => {
        const config = LANGUAGE_CONFIGS[lang];
        expect(config).toBeDefined();
        expect(config.language).toBe(lang);
        expect(config.name).toBeTruthy();
      });
    }
  });

  describe('Node.js config', () => {
    it('should use CDP protocol', () => {
      expect(LANGUAGE_CONFIGS.node.protocol).toBe('cdp');
    });

    it('should have default port 9229', () => {
      expect(LANGUAGE_CONFIGS.node.defaultPort).toBe(9229);
    });

    it('should support common JS/TS file extensions', () => {
      const exts = LANGUAGE_CONFIGS.node.fileExtensions;
      expect(exts).toContain('.js');
      expect(exts).toContain('.ts');
      expect(exts).toContain('.tsx');
      expect(exts).toContain('.jsx');
    });

    it('should support breakpoints', () => {
      expect(LANGUAGE_CONFIGS.node.supportsBreakpoints).toBe(true);
    });

    it('should support conditional breakpoints', () => {
      expect(LANGUAGE_CONFIGS.node.supportsConditionalBreakpoints).toBe(true);
    });

    it('should support exception breakpoints', () => {
      expect(LANGUAGE_CONFIGS.node.supportsExceptionBreakpoints).toBe(true);
    });

    it('should have a debugCommand function', () => {
      expect(typeof LANGUAGE_CONFIGS.node.debugCommand).toBe('function');
    });

    it('should generate correct debug command', () => {
      const cmd = LANGUAGE_CONFIGS.node.debugCommand({
        program: 'app.js',
        port: 9229,
      } as never);
      expect(cmd).toContain('node');
      expect(cmd).toContain('--inspect-brk');
      expect(cmd).toContain('9229');
      expect(cmd).toContain('app.js');
    });
  });

  describe('Python config', () => {
    it('should use DAP protocol', () => {
      expect(LANGUAGE_CONFIGS.python.protocol).toBe('dap');
    });

    it('should have .py extension', () => {
      expect(LANGUAGE_CONFIGS.python.fileExtensions).toContain('.py');
    });

    it('should support breakpoints', () => {
      expect(LANGUAGE_CONFIGS.python.supportsBreakpoints).toBe(true);
    });
  });

  describe('Go config', () => {
    it('should use DAP protocol', () => {
      expect(LANGUAGE_CONFIGS.go.protocol).toBe('dap');
    });

    it('should have .go extension', () => {
      expect(LANGUAGE_CONFIGS.go.fileExtensions).toContain('.go');
    });
  });

  describe('Java config', () => {
    it('should use JDWP protocol', () => {
      expect(LANGUAGE_CONFIGS.java.protocol).toBe('jdwp');
    });

    it('should have .java extension', () => {
      expect(LANGUAGE_CONFIGS.java.fileExtensions).toContain('.java');
    });
  });

  describe('Rust config', () => {
    it('should have .rs extension', () => {
      expect(LANGUAGE_CONFIGS.rust.fileExtensions).toContain('.rs');
    });

    it('should require compilation', () => {
      expect(LANGUAGE_CONFIGS.rust.requiresCompilation).toBe(true);
    });
  });

  describe('all configs validation', () => {
    const allLanguages = Object.keys(LANGUAGE_CONFIGS) as DebugLanguage[];

    for (const lang of allLanguages) {
      it(`${lang} should have required fields`, () => {
        const config = LANGUAGE_CONFIGS[lang];
        expect(config.language).toBe(lang);
        expect(config.name).toBeTruthy();
        expect(['cdp', 'dap', 'jdwp', 'custom']).toContain(config.protocol);
        expect(config.defaultPort).toBeGreaterThan(0);
        expect(config.fileExtensions.length).toBeGreaterThan(0);
        expect(typeof config.debugCommand).toBe('function');
        expect(typeof config.supportsBreakpoints).toBe('boolean');
      });
    }
  });
});

// -------------------------------------------------------------------
// DebugLanguage type
// -------------------------------------------------------------------
describe('DebugLanguage type', () => {
  it('should be a valid key of LANGUAGE_CONFIGS', () => {
    const lang: DebugLanguage = 'node';
    expect(LANGUAGE_CONFIGS[lang]).toBeDefined();
  });
});
