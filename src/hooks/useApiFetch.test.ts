import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the retry module
vi.mock('@/lib/api/retry', () => ({
  fetchWithRetry: vi.fn(),
  fetchJsonWithRetry: vi.fn(),
}));

import { useApiFetch } from './useApiFetch';
import { fetchWithRetry, fetchJsonWithRetry } from '@/lib/api/retry';

const mockFetchWithRetry = vi.mocked(fetchWithRetry);
const mockFetchJsonWithRetry = vi.mocked(fetchJsonWithRetry);

describe('useApiFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('apiFetch', () => {
    it('should return a successful response', async () => {
      const mockResponse = new Response('ok', { status: 200 });
      mockFetchWithRetry.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useApiFetch());

      let response: Response | null = null;
      await act(async () => {
        response = await result.current.apiFetch('/api/test');
      });

      expect(response).toBe(mockResponse);
      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({ maxRetries: 3, initialDelay: 1000 })
      );
    });

    it('should return null on network error', async () => {
      mockFetchWithRetry.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useApiFetch());

      let response: Response | null = null;
      await act(async () => {
        response = await result.current.apiFetch('/api/test');
      });

      expect(response).toBeNull();
    });

    it('should show toast on non-ok response', async () => {
      const mockResponse = new Response('', { status: 500 });
      Object.defineProperty(mockResponse, 'ok', { value: false });
      mockFetchWithRetry.mockResolvedValue(mockResponse);

      const toastError = vi.fn();
      const { result } = renderHook(() => useApiFetch({ toast: { error: toastError } }));

      await act(async () => {
        await result.current.apiFetch('/api/test');
      });

      expect(toastError).toHaveBeenCalledWith('Request Failed', expect.stringContaining('500'));
    });

    it('should show toast on network error', async () => {
      mockFetchWithRetry.mockRejectedValue(new Error('fetch failed'));

      const toastError = vi.fn();
      const { result } = renderHook(() => useApiFetch({ toast: { error: toastError } }));

      await act(async () => {
        await result.current.apiFetch('/api/test');
      });

      expect(toastError).toHaveBeenCalledWith('Connection Error', 'fetch failed');
    });

    it('should not show toast when silent=true', async () => {
      mockFetchWithRetry.mockRejectedValue(new Error('Network error'));

      const toastError = vi.fn();
      const { result } = renderHook(() => useApiFetch({ toast: { error: toastError } }));

      await act(async () => {
        await result.current.apiFetch('/api/test', { silent: true });
      });

      expect(toastError).not.toHaveBeenCalled();
    });

    it('should not show toast for non-ok response when silent=true', async () => {
      const mockResponse = new Response('', { status: 403 });
      Object.defineProperty(mockResponse, 'ok', { value: false });
      mockFetchWithRetry.mockResolvedValue(mockResponse);

      const toastError = vi.fn();
      const { result } = renderHook(() => useApiFetch({ toast: { error: toastError } }));

      await act(async () => {
        await result.current.apiFetch('/api/test', { silent: true });
      });

      expect(toastError).not.toHaveBeenCalled();
    });

    it('should pass through fetch options to fetchWithRetry', async () => {
      mockFetchWithRetry.mockResolvedValue(new Response('ok'));

      const { result } = renderHook(() => useApiFetch());

      await act(async () => {
        await result.current.apiFetch('/api/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      });

      expect(mockFetchWithRetry).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should handle non-Error exceptions gracefully', async () => {
      mockFetchWithRetry.mockRejectedValue('string error');

      const toastError = vi.fn();
      const { result } = renderHook(() => useApiFetch({ toast: { error: toastError } }));

      await act(async () => {
        await result.current.apiFetch('/api/test');
      });

      expect(toastError).toHaveBeenCalledWith('Connection Error', 'Network error');
    });
  });

  describe('apiFetchJson', () => {
    it('should return parsed JSON data', async () => {
      mockFetchJsonWithRetry.mockResolvedValue({ name: 'test' });

      const { result } = renderHook(() => useApiFetch());

      let data: unknown = null;
      await act(async () => {
        data = await result.current.apiFetchJson('/api/data');
      });

      expect(data).toEqual({ name: 'test' });
    });

    it('should return null on error', async () => {
      mockFetchJsonWithRetry.mockRejectedValue(new Error('Parse error'));

      const { result } = renderHook(() => useApiFetch());

      let data: unknown = 'initial';
      await act(async () => {
        data = await result.current.apiFetchJson('/api/data');
      });

      expect(data).toBeNull();
    });

    it('should show toast on error', async () => {
      mockFetchJsonWithRetry.mockRejectedValue(new Error('Request failed'));

      const toastError = vi.fn();
      const { result } = renderHook(() => useApiFetch({ toast: { error: toastError } }));

      await act(async () => {
        await result.current.apiFetchJson('/api/data');
      });

      expect(toastError).toHaveBeenCalledWith('Request Failed', 'Request failed');
    });

    it('should not show toast when silent=true', async () => {
      mockFetchJsonWithRetry.mockRejectedValue(new Error('fail'));

      const toastError = vi.fn();
      const { result } = renderHook(() => useApiFetch({ toast: { error: toastError } }));

      await act(async () => {
        await result.current.apiFetchJson('/api/data', { silent: true });
      });

      expect(toastError).not.toHaveBeenCalled();
    });

    it('should pass options through to fetchJsonWithRetry', async () => {
      mockFetchJsonWithRetry.mockResolvedValue([]);

      const { result } = renderHook(() => useApiFetch());

      await act(async () => {
        await result.current.apiFetchJson('/api/list', {
          method: 'GET',
          maxRetries: 5,
        });
      });

      expect(mockFetchJsonWithRetry).toHaveBeenCalledWith(
        '/api/list',
        expect.objectContaining({ method: 'GET', maxRetries: 5 })
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockFetchJsonWithRetry.mockRejectedValue(42);

      const toastError = vi.fn();
      const { result } = renderHook(() => useApiFetch({ toast: { error: toastError } }));

      await act(async () => {
        await result.current.apiFetchJson('/api/data');
      });

      expect(toastError).toHaveBeenCalledWith('Request Failed', 'Request failed');
    });
  });

  describe('hook behavior', () => {
    it('should return stable function references', () => {
      const { result, rerender } = renderHook(() => useApiFetch());

      const firstApiFetch = result.current.apiFetch;
      const firstApiFetchJson = result.current.apiFetchJson;

      rerender();

      expect(result.current.apiFetch).toBe(firstApiFetch);
      expect(result.current.apiFetchJson).toBe(firstApiFetchJson);
    });

    it('should work without toast option', async () => {
      mockFetchWithRetry.mockRejectedValue(new Error('fail'));

      const { result } = renderHook(() => useApiFetch());

      // Should not throw even without toast
      await act(async () => {
        const response = await result.current.apiFetch('/api/test');
        expect(response).toBeNull();
      });
    });
  });
});
