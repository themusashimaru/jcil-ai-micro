/**
 * USE LSP HOOK
 *
 * React hook for Language Server Protocol features in the editor.
 * Provides code intelligence capabilities:
 * - Go-to-definition (Cmd/Ctrl+Click)
 * - Hover information
 * - Find references
 * - Completions
 * - Document symbols
 *
 * @version 1.0.0
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';

const log = logger('useLSP');

// ============================================================================
// TYPES
// ============================================================================

export interface Position {
  line: number; // 1-based
  column: number; // 1-based
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Location {
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

export interface HoverInfo {
  content: string;
  language?: string;
  range?: Range;
}

export interface CompletionItem {
  label: string;
  kind: string;
  detail?: string;
  documentation?: string;
  insertText?: string;
}

export interface DocumentSymbol {
  name: string;
  kind: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

export interface LSPStatus {
  connected: boolean;
  language: string | null;
  serverName: string | null;
  error: string | null;
}

export interface UseLSPOptions {
  /** API endpoint for LSP operations */
  apiEndpoint?: string;
  /** Session ID for the workspace */
  sessionId: string;
  /** Current workspace root */
  workspaceRoot?: string;
  /** Enable auto-completions */
  enableCompletions?: boolean;
  /** Enable hover info */
  enableHover?: boolean;
  /** Debounce delay for hover requests (ms) */
  hoverDebounce?: number;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useLSP(options: UseLSPOptions) {
  const {
    apiEndpoint = '/api/code-lab/lsp',
    sessionId,
    workspaceRoot = '/workspace',
    enableCompletions = true,
    enableHover = true,
    hoverDebounce = 200,
  } = options;

  // State
  const [status, setStatus] = useState<LSPStatus>({
    connected: false,
    language: null,
    serverName: null,
    error: null,
  });
  const [loading, setLoading] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [completions, setCompletions] = useState<CompletionItem[]>([]);
  const [definitions, setDefinitions] = useState<Location[]>([]);
  const [references, setReferences] = useState<Location[]>([]);
  const [symbols, setSymbols] = useState<DocumentSymbol[]>([]);

  // Refs for debouncing
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const completionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // API CALLS
  // ============================================================================

  /**
   * Make an LSP API request
   */
  const lspRequest = useCallback(
    async <T>(
      operation: string,
      params: Record<string, unknown>
    ): Promise<{ success: boolean; result?: T; error?: string }> => {
      try {
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId,
            operation,
            workspaceRoot,
            ...params,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return { success: false, error: error.message || `HTTP ${response.status}` };
        }

        const data = await response.json();
        return { success: true, result: data.result as T };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'LSP request failed';
        log.error('LSP request error', { operation, error });
        return { success: false, error: message };
      }
    },
    [apiEndpoint, sessionId, workspaceRoot]
  );

  // ============================================================================
  // LSP OPERATIONS
  // ============================================================================

  /**
   * Go to definition at a position
   */
  const gotoDefinition = useCallback(
    async (file: string, position: Position): Promise<Location[]> => {
      setLoading(true);
      setDefinitions([]);

      try {
        const result = await lspRequest<{ definitions: Location[] }>('goto_definition', {
          file,
          line: position.line,
          column: position.column,
        });

        if (result.success && result.result) {
          setDefinitions(result.result.definitions);
          return result.result.definitions;
        }

        return [];
      } finally {
        setLoading(false);
      }
    },
    [lspRequest]
  );

  /**
   * Find all references at a position
   */
  const findReferences = useCallback(
    async (file: string, position: Position): Promise<Location[]> => {
      setLoading(true);
      setReferences([]);

      try {
        const result = await lspRequest<{ references: Location[]; count: number }>(
          'find_references',
          {
            file,
            line: position.line,
            column: position.column,
          }
        );

        if (result.success && result.result) {
          setReferences(result.result.references);
          return result.result.references;
        }

        return [];
      } finally {
        setLoading(false);
      }
    },
    [lspRequest]
  );

  /**
   * Get hover information at a position (debounced)
   */
  const getHoverInfo = useCallback(
    async (file: string, position: Position): Promise<HoverInfo | null> => {
      if (!enableHover) return null;

      // Clear existing timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }

      return new Promise((resolve) => {
        hoverTimeoutRef.current = setTimeout(async () => {
          const result = await lspRequest<HoverInfo>('hover', {
            file,
            line: position.line,
            column: position.column,
          });

          if (result.success && result.result) {
            setHoverInfo(result.result);
            resolve(result.result);
          } else {
            setHoverInfo(null);
            resolve(null);
          }
        }, hoverDebounce);
      });
    },
    [lspRequest, enableHover, hoverDebounce]
  );

  /**
   * Get completions at a position
   */
  const getCompletions = useCallback(
    async (file: string, position: Position): Promise<CompletionItem[]> => {
      if (!enableCompletions) return [];

      // Clear existing timeout
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
      }

      return new Promise((resolve) => {
        completionTimeoutRef.current = setTimeout(async () => {
          const result = await lspRequest<{ items: CompletionItem[] }>('completions', {
            file,
            line: position.line,
            column: position.column,
          });

          if (result.success && result.result) {
            setCompletions(result.result.items);
            resolve(result.result.items);
          } else {
            setCompletions([]);
            resolve([]);
          }
        }, 100); // Shorter debounce for completions
      });
    },
    [lspRequest, enableCompletions]
  );

  /**
   * Get document symbols
   */
  const getDocumentSymbols = useCallback(
    async (file: string): Promise<DocumentSymbol[]> => {
      setLoading(true);
      setSymbols([]);

      try {
        const result = await lspRequest<{ symbols: DocumentSymbol[] }>('document_symbols', {
          file,
        });

        if (result.success && result.result) {
          setSymbols(result.result.symbols);
          return result.result.symbols;
        }

        return [];
      } finally {
        setLoading(false);
      }
    },
    [lspRequest]
  );

  /**
   * Rename a symbol
   */
  const renameSymbol = useCallback(
    async (
      file: string,
      position: Position,
      newName: string
    ): Promise<
      Array<{
        file: string;
        edits: Array<{
          line: number;
          column: number;
          endLine: number;
          endColumn: number;
          newText: string;
        }>;
      }>
    > => {
      setLoading(true);

      try {
        const result = await lspRequest<{
          changes: Array<{
            file: string;
            edits: Array<{
              line: number;
              column: number;
              endLine: number;
              endColumn: number;
              newText: string;
            }>;
          }>;
        }>('rename', {
          file,
          line: position.line,
          column: position.column,
          newName,
        });

        if (result.success && result.result) {
          return result.result.changes;
        }

        return [];
      } finally {
        setLoading(false);
      }
    },
    [lspRequest]
  );

  /**
   * Clear hover info
   */
  const clearHover = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setHoverInfo(null);
  }, []);

  /**
   * Clear completions
   */
  const clearCompletions = useCallback(() => {
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current);
    }
    setCompletions([]);
  }, []);

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  /**
   * Initialize LSP for a file
   */
  const initializeForFile = useCallback(
    async (file: string, content: string): Promise<boolean> => {
      const result = await lspRequest<{ initialized: boolean; language: string }>('initialize', {
        file,
        content,
      });

      if (result.success && result.result) {
        setStatus((prev) => ({
          ...prev,
          connected: true,
          language: result.result!.language,
          error: null,
        }));
        return true;
      }

      setStatus((prev) => ({
        ...prev,
        connected: false,
        error: result.error || 'Failed to initialize LSP',
      }));
      return false;
    },
    [lspRequest]
  );

  /**
   * Update file content in LSP
   */
  const updateFileContent = useCallback(
    async (file: string, content: string): Promise<void> => {
      await lspRequest('update_document', {
        file,
        content,
      });
    },
    [lspRequest]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      if (completionTimeoutRef.current) {
        clearTimeout(completionTimeoutRef.current);
      }
    };
  }, []);

  // ============================================================================
  // KEYBOARD & MOUSE HANDLERS
  // ============================================================================

  /**
   * Handle Cmd/Ctrl+Click for go-to-definition
   */
  const handleEditorClick = useCallback(
    (
      e: React.MouseEvent,
      file: string,
      getPositionFromOffset: (offset: number) => Position
    ): boolean => {
      // Cmd/Ctrl+Click for go-to-definition
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        const target = e.target as HTMLTextAreaElement;
        if ('selectionStart' in target) {
          const position = getPositionFromOffset(target.selectionStart);
          gotoDefinition(file, position);
          return true;
        }
      }
      return false;
    },
    [gotoDefinition]
  );

  /**
   * Handle keyboard shortcuts
   */
  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent, file: string, position: Position): boolean => {
      // F12 or Cmd/Ctrl+G: Go to definition
      if (e.key === 'F12' || ((e.metaKey || e.ctrlKey) && e.key === 'g')) {
        e.preventDefault();
        gotoDefinition(file, position);
        return true;
      }

      // Shift+F12: Find references
      if (e.shiftKey && e.key === 'F12') {
        e.preventDefault();
        findReferences(file, position);
        return true;
      }

      // F2: Rename
      if (e.key === 'F2') {
        e.preventDefault();
        // This should trigger a rename dialog in the parent component
        return true;
      }

      // Ctrl+Space: Trigger completions
      if (e.ctrlKey && e.key === ' ') {
        e.preventDefault();
        getCompletions(file, position);
        return true;
      }

      return false;
    },
    [gotoDefinition, findReferences, getCompletions]
  );

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // Status
    status,
    loading,

    // Results
    hoverInfo,
    completions,
    definitions,
    references,
    symbols,

    // Operations
    gotoDefinition,
    findReferences,
    getHoverInfo,
    getCompletions,
    getDocumentSymbols,
    renameSymbol,

    // Document management
    initializeForFile,
    updateFileContent,

    // Clearing
    clearHover,
    clearCompletions,

    // Event handlers
    handleEditorClick,
    handleEditorKeyDown,
  };
}

export default useLSP;
