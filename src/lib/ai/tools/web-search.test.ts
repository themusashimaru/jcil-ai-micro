/**
 * WEB SEARCH TOOL TESTS
 *
 * Tests for the native Anthropic web search tool configuration.
 * The web search tool is server-side (executed by Anthropic, not locally),
 * so these tests verify:
 * - Tool definition/configuration integrity
 * - Sentinel name detection
 * - Availability check
 * - Fallback executor behavior
 */

import { describe, it, expect, vi } from 'vitest';
import {
  webSearchTool,
  NATIVE_WEB_SEARCH_SENTINEL,
  isWebSearchAvailable,
  executeWebSearch,
  isNativeServerTool,
} from './web-search';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('Web Search Tool', () => {
  describe('Tool Definition', () => {
    it('should export a sentinel name constant', () => {
      expect(NATIVE_WEB_SEARCH_SENTINEL).toBe('__native_web_search__');
    });

    it('should export a valid tool definition', () => {
      expect(webSearchTool).toBeDefined();
      expect(webSearchTool.name).toBe(NATIVE_WEB_SEARCH_SENTINEL);
      expect(webSearchTool.description).toBeTruthy();
    });

    it('should have empty parameters (server-side tool)', () => {
      expect(webSearchTool.parameters.type).toBe('object');
      expect(webSearchTool.parameters.properties).toEqual({});
      expect(webSearchTool.parameters.required).toEqual([]);
    });

    it('should have native web search metadata', () => {
      expect(webSearchTool._nativeWebSearch).toBe(true);
      expect(webSearchTool._nativeConfig).toBeDefined();
      expect(webSearchTool._nativeConfig.type).toBe('web_search_20260209');
      expect(webSearchTool._nativeConfig.name).toBe('web_search');
      expect(webSearchTool._nativeConfig.max_uses).toBe(5);
    });
  });

  describe('isWebSearchAvailable', () => {
    it('should always return true (native Anthropic capability)', () => {
      expect(isWebSearchAvailable()).toBe(true);
    });
  });

  describe('isNativeServerTool', () => {
    it('should return true for "web_search"', () => {
      expect(isNativeServerTool('web_search')).toBe(true);
    });

    it('should return true for the sentinel name', () => {
      expect(isNativeServerTool(NATIVE_WEB_SEARCH_SENTINEL)).toBe(true);
    });

    it('should return false for other tool names', () => {
      expect(isNativeServerTool('run_code')).toBe(false);
      expect(isNativeServerTool('fetch_url')).toBe(false);
      expect(isNativeServerTool('web_search_old')).toBe(false);
      expect(isNativeServerTool('')).toBe(false);
    });
  });

  describe('executeWebSearch (fallback)', () => {
    it('should return a non-error result explaining server-side execution', async () => {
      const result = await executeWebSearch({
        id: 'tool-call-123',
        name: 'web_search',
      });

      expect(result.toolCallId).toBe('tool-call-123');
      expect(result.isError).toBe(false);
      expect(result.content).toContain('natively');
    });

    it('should pass through the tool call ID', async () => {
      const result = await executeWebSearch({
        id: 'unique-id-456',
        name: NATIVE_WEB_SEARCH_SENTINEL,
      });

      expect(result.toolCallId).toBe('unique-id-456');
    });
  });
});
