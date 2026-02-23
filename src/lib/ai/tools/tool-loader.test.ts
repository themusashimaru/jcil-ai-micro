/**
 * LAZY TOOL LOADER TESTS
 *
 * Tests for the registry-driven lazy tool loading system.
 * Verifies tool discovery, lazy execution, and caching.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getRegisteredToolNames, hasToolLoader, clearToolModuleCache } from './tool-loader';
import { TOOL_REGISTRY } from './registry';

describe('Tool Loader', () => {
  beforeEach(() => {
    clearToolModuleCache();
  });

  describe('getRegisteredToolNames', () => {
    it('should return all registered tool names', () => {
      const names = getRegisteredToolNames();
      expect(names.length).toBeGreaterThan(0);
    });

    it('should include core tools', () => {
      const names = getRegisteredToolNames();
      expect(names).toContain('web_search');
      expect(names).toContain('fetch_url');
      expect(names).toContain('run_code');
    });

    it('should include beta tools', () => {
      const names = getRegisteredToolNames();
      expect(names).toContain('ml_model_serving');
    });
  });

  describe('hasToolLoader', () => {
    it('should return true for registered tools', () => {
      expect(hasToolLoader('web_search')).toBe(true);
      expect(hasToolLoader('create_chart')).toBe(true);
    });

    it('should return false for unregistered tools', () => {
      expect(hasToolLoader('fake_tool')).toBe(false);
      expect(hasToolLoader('')).toBe(false);
    });

    it('should return false for MCP tools', () => {
      expect(hasToolLoader('mcp_server_tool')).toBe(false);
    });
  });

  describe('Registry Coverage', () => {
    it('should have a loader entry for every active/beta tool in the registry', () => {
      const activeAndBeta = TOOL_REGISTRY.filter(
        (t) => t.status === 'active' || t.status === 'beta'
      );

      const missingLoaders: string[] = [];
      for (const tool of activeAndBeta) {
        if (!hasToolLoader(tool.name)) {
          missingLoaders.push(tool.name);
        }
      }

      expect(missingLoaders).toEqual([]);
    });

    it('should not have loader entries for tools not in the registry', () => {
      const registeredNames = new Set(TOOL_REGISTRY.map((t) => t.name));
      const loaderNames = getRegisteredToolNames();

      const extraLoaders: string[] = [];
      for (const name of loaderNames) {
        if (!registeredNames.has(name)) {
          extraLoaders.push(name);
        }
      }

      expect(extraLoaders).toEqual([]);
    });
  });
});
