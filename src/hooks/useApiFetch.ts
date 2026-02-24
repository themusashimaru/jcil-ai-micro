'use client';

/**
 * useApiFetch Hook
 *
 * Combines fetchWithRetry (exponential backoff, max 3 retries)
 * with toast notifications for user-visible error feedback.
 *
 * Usage:
 *   const { apiFetch, apiFetchJson } = useApiFetch();
 *   const data = await apiFetchJson<User[]>('/api/conversations');
 */

import { useCallback, useRef } from 'react';
import { fetchWithRetry, fetchJsonWithRetry } from '@/lib/api/retry';
import type { FetchWithRetryOptions } from '@/lib/api/retry';

interface ToastActions {
  error: (title: string, message?: string) => void;
}

interface UseApiFetchOptions {
  /** Toast actions from useToastActions(). If not provided, errors are only logged. */
  toast?: ToastActions;
}

/**
 * Hook that provides fetch functions with built-in retry and error notifications.
 */
export function useApiFetch(options: UseApiFetchOptions = {}) {
  const toastRef = useRef(options.toast);
  toastRef.current = options.toast;

  /**
   * Fetch with retry + toast on failure.
   * Returns null on failure instead of throwing.
   */
  const apiFetch = useCallback(
    async (
      url: string,
      fetchOptions: FetchWithRetryOptions & { silent?: boolean } = {}
    ): Promise<Response | null> => {
      const { silent, ...retryOptions } = fetchOptions;
      try {
        const response = await fetchWithRetry(url, {
          maxRetries: 3,
          initialDelay: 1000,
          ...retryOptions,
        });

        if (!response.ok && !silent) {
          const message = `Request failed (${response.status})`;
          toastRef.current?.error('Request Failed', message);
        }

        return response;
      } catch (error) {
        if (!silent) {
          const message = error instanceof Error ? error.message : 'Network error';
          toastRef.current?.error('Connection Error', message);
        }
        return null;
      }
    },
    []
  );

  /**
   * Fetch JSON with retry + toast on failure.
   * Returns null on failure instead of throwing.
   */
  const apiFetchJson = useCallback(
    async <T>(
      url: string,
      fetchOptions: FetchWithRetryOptions & { silent?: boolean } = {}
    ): Promise<T | null> => {
      const { silent, ...retryOptions } = fetchOptions;
      try {
        return await fetchJsonWithRetry<T>(url, {
          maxRetries: 3,
          initialDelay: 1000,
          ...retryOptions,
        });
      } catch (error) {
        if (!silent) {
          const message = error instanceof Error ? error.message : 'Request failed';
          toastRef.current?.error('Request Failed', message);
        }
        return null;
      }
    },
    []
  );

  return { apiFetch, apiFetchJson };
}
