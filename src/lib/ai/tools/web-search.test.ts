/**
 * TEST-002: Web Search Tool Tests
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  isWebSearchAvailable,
  executeWebSearch,
  isNativeServerTool,
  NATIVE_WEB_SEARCH_SENTINEL,
  webSearchTool,
} from './web-search';

describe('Web Search Tool', () => {
  describe('isWebSearchAvailable', () => {
    it('should always return true (native capability)', () => {
      expect(isWebSearchAvailable()).toBe(true);
    });
  });

  describe('NATIVE_WEB_SEARCH_SENTINEL', () => {
    it('should be a sentinel string for adapter detection', () => {
      expect(NATIVE_WEB_SEARCH_SENTINEL).toBe('__native_web_search__');
    });
  });

  describe('webSearchTool', () => {
    it('should have sentinel name', () => {
      expect(webSearchTool.name).toBe(NATIVE_WEB_SEARCH_SENTINEL);
    });

    it('should have native web search metadata', () => {
      expect(webSearchTool._nativeWebSearch).toBe(true);
    });

    it('should configure native API with correct type', () => {
      expect(webSearchTool._nativeConfig).toEqual({
        type: 'web_search_20260209',
        name: 'web_search',
        max_uses: 5,
      });
    });

    it('should have empty parameters (server-handled)', () => {
      expect(webSearchTool.parameters.properties).toEqual({});
      expect(webSearchTool.parameters.required).toEqual([]);
    });
  });

  describe('executeWebSearch', () => {
    it('should return no-op message (server-side tool)', async () => {
      const result = await executeWebSearch({ id: 'test-123', name: 'web_search' });
      expect(result.toolCallId).toBe('test-123');
      expect(result.isError).toBe(false);
      expect(result.content).toContain('handled natively');
    });
  });

  describe('isNativeServerTool', () => {
    it('should detect web_search', () => {
      expect(isNativeServerTool('web_search')).toBe(true);
    });

    it('should detect sentinel name', () => {
      expect(isNativeServerTool(NATIVE_WEB_SEARCH_SENTINEL)).toBe(true);
    });

    it('should reject other tool names', () => {
      expect(isNativeServerTool('fetch_url')).toBe(false);
      expect(isNativeServerTool('run_code')).toBe(false);
      expect(isNativeServerTool('browser_visit')).toBe(false);
    });
  });
});
