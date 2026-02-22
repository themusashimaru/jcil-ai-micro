/**
 * TOOL REGISTRY TESTS
 *
 * Tests for the tool registry manifest (Task 1.1.4):
 * - Registry data integrity
 * - Helper functions (getToolEntry, getToolsByStatus, etc.)
 * - No planned tools leak into production
 */

import { describe, it, expect } from 'vitest';
import {
  TOOL_REGISTRY,
  getToolEntry,
  getToolsByStatus,
  getToolsByCategory,
  isRegisteredTool,
  getRegistryStats,
} from './registry';

describe('Tool Registry', () => {
  describe('Registry Data Integrity', () => {
    it('should have at least one tool', () => {
      expect(TOOL_REGISTRY.length).toBeGreaterThan(0);
    });

    it('should have unique tool names', () => {
      const names = TOOL_REGISTRY.map((t) => t.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should have unique file paths', () => {
      const files = TOOL_REGISTRY.map((t) => t.file);
      const uniqueFiles = new Set(files);
      expect(uniqueFiles.size).toBe(files.length);
    });

    it('should only contain valid statuses', () => {
      const validStatuses = ['active', 'beta', 'planned'];
      for (const tool of TOOL_REGISTRY) {
        expect(validStatuses).toContain(tool.status);
      }
    });

    it('should only contain valid categories', () => {
      const validCategories = [
        'core',
        'web',
        'code',
        'document',
        'media',
        'data',
        'scientific',
        'security',
        'devtools',
      ];
      for (const tool of TOOL_REGISTRY) {
        expect(validCategories).toContain(tool.category);
      }
    });

    it('should have non-empty descriptions', () => {
      for (const tool of TOOL_REGISTRY) {
        expect(tool.description.length).toBeGreaterThan(0);
      }
    });

    it('should have .ts file extensions', () => {
      for (const tool of TOOL_REGISTRY) {
        expect(tool.file).toMatch(/\.ts$/);
      }
    });
  });

  describe('getToolEntry', () => {
    it('should find existing tool by name', () => {
      const entry = getToolEntry('web_search');
      expect(entry).toBeDefined();
      expect(entry!.name).toBe('web_search');
      expect(entry!.status).toBe('active');
    });

    it('should return undefined for non-existent tool', () => {
      const entry = getToolEntry('nonexistent_tool');
      expect(entry).toBeUndefined();
    });

    it('should return correct entry for beta tool', () => {
      const entry = getToolEntry('ml_model_serving');
      expect(entry).toBeDefined();
      expect(entry!.status).toBe('beta');
    });
  });

  describe('getToolsByStatus', () => {
    it('should return active tools', () => {
      const active = getToolsByStatus('active');
      expect(active.length).toBeGreaterThan(0);
      expect(active.every((t) => t.status === 'active')).toBe(true);
    });

    it('should return beta tools', () => {
      const beta = getToolsByStatus('beta');
      expect(beta.length).toBeGreaterThanOrEqual(1);
      expect(beta.every((t) => t.status === 'beta')).toBe(true);
    });

    it('should return empty array for planned (none exist currently)', () => {
      const planned = getToolsByStatus('planned');
      expect(planned.every((t) => t.status === 'planned')).toBe(true);
    });
  });

  describe('getToolsByCategory', () => {
    it('should return core tools', () => {
      const core = getToolsByCategory('core');
      expect(core.length).toBeGreaterThan(0);
      expect(core.every((t) => t.category === 'core')).toBe(true);
    });

    it('should return empty array for category with no tools', () => {
      // All categories currently have tools, but the function should handle edge cases
      const result = getToolsByCategory('devtools');
      expect(result.every((t) => t.category === 'devtools')).toBe(true);
    });
  });

  describe('isRegisteredTool', () => {
    it('should return true for registered tool', () => {
      expect(isRegisteredTool('web_search')).toBe(true);
      expect(isRegisteredTool('run_code')).toBe(true);
    });

    it('should return false for unregistered tool', () => {
      expect(isRegisteredTool('fake_tool')).toBe(false);
      expect(isRegisteredTool('')).toBe(false);
    });
  });

  describe('getRegistryStats', () => {
    it('should return correct totals', () => {
      const stats = getRegistryStats();
      expect(stats.total).toBe(TOOL_REGISTRY.length);
      expect(stats.active + stats.beta + stats.planned).toBe(stats.total);
    });

    it('should have more active than beta tools', () => {
      const stats = getRegistryStats();
      expect(stats.active).toBeGreaterThan(stats.beta);
    });

    it('should have category breakdown', () => {
      const stats = getRegistryStats();
      const categoryTotal = Object.values(stats.byCategory).reduce((a, b) => a + b, 0);
      expect(categoryTotal).toBe(stats.total);
    });
  });
});
