/**
 * USE CODE LAB MEMORY HOOK
 *
 * Manages the CLAUDE.md memory file for project context.
 * Provides Claude Code parity for persistent memory.
 */

import { useState, useCallback } from 'react';
import { logger } from '@/lib/logger';

const log = logger('CodeLabMemory');

export interface MemoryFile {
  path: string;
  content: string;
  exists: boolean;
  lastModified?: Date;
}

export interface UseCodeLabMemoryOptions {
  sessionId: string | null;
  onToast?: (type: 'success' | 'error', title: string, message: string) => void;
}

export interface UseCodeLabMemoryReturn {
  // State
  memoryFile: MemoryFile | undefined;
  memoryLoading: boolean;

  // Actions
  loadMemoryFile: () => Promise<void>;
  saveMemoryFile: (content: string) => Promise<void>;
  setMemoryFile: React.Dispatch<React.SetStateAction<MemoryFile | undefined>>;
}

export function useCodeLabMemory(options: UseCodeLabMemoryOptions): UseCodeLabMemoryReturn {
  const { sessionId, onToast } = options;

  const [memoryFile, setMemoryFile] = useState<MemoryFile | undefined>(undefined);
  const [memoryLoading, setMemoryLoading] = useState(false);

  const loadMemoryFile = useCallback(async () => {
    if (!sessionId) return;

    setMemoryLoading(true);
    try {
      const response = await fetch(`/api/code-lab/memory?sessionId=${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setMemoryFile({
          path: data.path || '/workspace/CLAUDE.md',
          content: data.content || '',
          exists: data.exists || false,
          lastModified: data.lastModified ? new Date(data.lastModified) : undefined,
        });
      }
    } catch (err) {
      log.error('Failed to load memory file', err as Error);
    } finally {
      setMemoryLoading(false);
    }
  }, [sessionId]);

  const saveMemoryFile = useCallback(
    async (content: string) => {
      if (!sessionId) return;

      try {
        const response = await fetch('/api/code-lab/memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            content,
          }),
        });

        if (response.ok) {
          setMemoryFile((prev) => ({
            path: prev?.path || '/workspace/CLAUDE.md',
            content,
            exists: true,
            lastModified: new Date(),
          }));
          onToast?.('success', 'Memory Saved', 'CLAUDE.md has been updated');
        } else {
          onToast?.('error', 'Save Failed', 'Could not save memory file');
        }
      } catch (err) {
        log.error('Failed to save memory file', err as Error);
        onToast?.('error', 'Save Failed', 'Could not save memory file');
      }
    },
    [sessionId, onToast]
  );

  return {
    memoryFile,
    memoryLoading,
    loadMemoryFile,
    saveMemoryFile,
    setMemoryFile,
  };
}
