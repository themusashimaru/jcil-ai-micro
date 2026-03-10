/**
 * SHELL MODULE INDEX TESTS
 *
 * Verifies that the barrel export re-exports all expected
 * symbols from session-manager.ts.
 */

import { describe, it, expect, vi } from 'vitest';

// ============================================================================
// MOCKS — All defined INSIDE factories (hoisting-safe)
// ============================================================================

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn() })),
      insert: vi.fn(),
      update: vi.fn(),
    })),
  })),
}));

vi.mock('@/lib/workspace/container', () => ({
  ContainerManager: vi.fn(),
  getContainerManager: vi.fn(() => ({
    executeCommand: vi.fn(),
  })),
  ExecutionResult: {},
}));

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// ============================================================================
// TESTS
// ============================================================================

describe('shell/index barrel exports', () => {
  it('should export ShellSessionManager class', async () => {
    const mod = await import('./index');
    expect(mod.ShellSessionManager).toBeDefined();
    expect(typeof mod.ShellSessionManager).toBe('function');
  });

  it('should export getShellSessionManager function', async () => {
    const mod = await import('./index');
    expect(mod.getShellSessionManager).toBeDefined();
    expect(typeof mod.getShellSessionManager).toBe('function');
  });

  it('should allow constructing ShellSessionManager through index', async () => {
    const mod = await import('./index');
    const manager = new mod.ShellSessionManager();
    expect(manager).toBeDefined();
  });

  it('exports should match session-manager module exports', async () => {
    const indexMod = await import('./index');
    const directMod = await import('./session-manager');
    expect(indexMod.ShellSessionManager).toBe(directMod.ShellSessionManager);
    expect(indexMod.getShellSessionManager).toBe(directMod.getShellSessionManager);
  });
});
