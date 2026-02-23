/** usePairProgramming hook — AI code assistant state management */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import type { PairMode, Suggestion, PairSession } from './CodeLabPairProgramming';

// Types for API communication
interface PairProgrammingAPIContext {
  currentFile: string;
  fileContent: string;
  recentEdits: Array<{
    timestamp: number;
    file: string;
    startLine: number;
    endLine: number;
    oldContent: string;
    newContent: string;
    cursorPosition: { line: number; column: number };
  }>;
  cursorLine: number;
  selectedText?: string;
  diagnostics?: Array<{
    line: number;
    message: string;
    severity: 'error' | 'warning' | 'hint';
  }>;
  projectContext?: {
    language: string;
    framework?: string;
    dependencies?: string[];
    recentFiles?: string[];
  };
}

interface PairProgrammingAPIEdit {
  timestamp: number;
  file: string;
  startLine: number;
  endLine: number;
  oldContent: string;
  newContent: string;
  cursorPosition: { line: number; column: number };
}

export function usePairProgramming() {
  const [mode, setMode] = useState<PairMode>('active');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [ghostText, setGhostText] = useState<string | null>(null);
  const [session, setSession] = useState<PairSession>({
    id: `session-${Date.now()}`,
    startTime: new Date(),
    suggestionsShown: 0,
    suggestionsAccepted: 0,
    suggestionsRejected: 0,
    codeWritten: 0,
    bugsDetected: 0,
    bugsPrevented: 0,
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce timer for edit analysis
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null);

  /** Call the pair programming API */
  const callAPI = useCallback(
    async (
      action: 'edit' | 'open' | 'complete' | 'analyze',
      context?: PairProgrammingAPIContext,
      edit?: PairProgrammingAPIEdit
    ) => {
      try {
        const response = await fetch('/api/code-lab/pair-programming', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, context, edit }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'API request failed');
        }

        return await response.json();
      } catch (err) {
        setError((err as Error).message);
        console.error('[PairProgramming] API error:', err);
        return null;
      }
    },
    []
  );

  /** Process a code edit and get real AI suggestions */
  const onCodeEdit = useCallback(
    async (
      file: string,
      content: string,
      oldContent: string,
      cursorLine: number,
      cursorColumn: number,
      language: string = 'typescript'
    ) => {
      if (mode !== 'active') return;

      // Clear existing debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Debounce analysis for 500ms
      debounceRef.current = setTimeout(async () => {
        setIsAnalyzing(true);
        setError(null);

        const edit: PairProgrammingAPIEdit = {
          timestamp: Date.now(),
          file,
          startLine: cursorLine,
          endLine: cursorLine,
          oldContent: oldContent.split('\n')[cursorLine] || '',
          newContent: content.split('\n')[cursorLine] || '',
          cursorPosition: { line: cursorLine, column: cursorColumn },
        };

        const context: PairProgrammingAPIContext = {
          currentFile: file,
          fileContent: content,
          recentEdits: [edit],
          cursorLine,
          projectContext: { language },
        };

        const result = await callAPI('edit', context, edit);

        if (result?.suggestions && Array.isArray(result.suggestions)) {
          const newSuggestions: Suggestion[] = result.suggestions.map(
            (s: Suggestion, i: number) => ({
              ...s,
              id: `suggestion-${Date.now()}-${i}`,
              timestamp: new Date(),
            })
          );

          setSuggestions((prev) => [...prev, ...newSuggestions]);
          setSession((prev) => ({
            ...prev,
            suggestionsShown: prev.suggestionsShown + newSuggestions.length,
            bugsDetected: prev.bugsDetected + newSuggestions.filter((s) => s.type === 'bug').length,
          }));
        }

        setIsAnalyzing(false);
      }, 500);
    },
    [mode, callAPI]
  );

  /** Get suggestions when opening a file */
  const onFileOpen = useCallback(
    async (file: string, content: string, language: string = 'typescript') => {
      if (mode === 'off') return;

      setIsAnalyzing(true);
      setError(null);

      const context: PairProgrammingAPIContext = {
        currentFile: file,
        fileContent: content,
        recentEdits: [],
        cursorLine: 0,
        projectContext: { language },
      };

      const result = await callAPI('open', context);

      if (result?.suggestions && Array.isArray(result.suggestions)) {
        const newSuggestions: Suggestion[] = result.suggestions.map((s: Suggestion, i: number) => ({
          ...s,
          id: `suggestion-${Date.now()}-${i}`,
          timestamp: new Date(),
        }));

        setSuggestions((prev) => [...prev, ...newSuggestions]);
        setSession((prev) => ({
          ...prev,
          suggestionsShown: prev.suggestionsShown + newSuggestions.length,
        }));
      }

      setIsAnalyzing(false);
    },
    [mode, callAPI]
  );

  /** Get inline completion (ghost text) */
  const getCompletion = useCallback(
    async (
      file: string,
      content: string,
      cursorLine: number,
      _cursorColumn: number,
      language: string = 'typescript'
    ): Promise<string | null> => {
      if (mode !== 'active') return null;

      const context: PairProgrammingAPIContext = {
        currentFile: file,
        fileContent: content,
        recentEdits: [],
        cursorLine,
        projectContext: { language },
      };

      const result = await callAPI('complete', context);
      const completion = result?.completion || null;
      setGhostText(completion);
      return completion;
    },
    [mode, callAPI]
  );

  /** Run proactive analysis on current code */
  const analyzeCode = useCallback(
    async (file: string, content: string, language: string = 'typescript') => {
      setIsAnalyzing(true);
      setError(null);

      const context: PairProgrammingAPIContext = {
        currentFile: file,
        fileContent: content,
        recentEdits: [],
        cursorLine: 0,
        projectContext: { language },
      };

      const result = await callAPI('analyze', context);

      if (result?.suggestions && Array.isArray(result.suggestions)) {
        const newSuggestions: Suggestion[] = result.suggestions.map((s: Suggestion, i: number) => ({
          ...s,
          id: `suggestion-${Date.now()}-${i}`,
          timestamp: new Date(),
        }));

        setSuggestions(newSuggestions);
        setSession((prev) => ({
          ...prev,
          suggestionsShown: prev.suggestionsShown + newSuggestions.length,
        }));
      }

      setIsAnalyzing(false);
    },
    [callAPI]
  );

  /** Add a local suggestion (for testing or manual additions) */
  const addSuggestion = useCallback((suggestion: Omit<Suggestion, 'id' | 'timestamp'>) => {
    const newSuggestion: Suggestion = {
      ...suggestion,
      id: `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    setSuggestions((prev) => [...prev, newSuggestion]);
    setSession((prev) => ({ ...prev, suggestionsShown: prev.suggestionsShown + 1 }));
    return newSuggestion.id;
  }, []);

  const acceptSuggestion = useCallback(
    (id: string) => {
      const suggestion = suggestions.find((s) => s.id === id);
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      setSession((prev) => ({
        ...prev,
        suggestionsAccepted: prev.suggestionsAccepted + 1,
        bugsPrevented: prev.bugsPrevented + (suggestion?.type === 'bug' ? 1 : 0),
      }));
    },
    [suggestions]
  );

  const rejectSuggestion = useCallback((id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
    setSession((prev) => ({ ...prev, suggestionsRejected: prev.suggestionsRejected + 1 }));
  }, []);

  const dismissSuggestion = useCallback((id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  const acceptGhostText = useCallback(() => {
    setGhostText(null);
    setSession((prev) => ({ ...prev, codeWritten: prev.codeWritten + 1 }));
  }, []);

  const rejectGhostText = useCallback(() => {
    setGhostText(null);
  }, []);

  const recordBugPrevented = useCallback(() => {
    setSession((prev) => ({ ...prev, bugsPrevented: prev.bugsPrevented + 1 }));
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    mode,
    setMode,
    suggestions,
    session,
    isAnalyzing,
    ghostText,
    error,
    onCodeEdit,
    onFileOpen,
    getCompletion,
    analyzeCode,
    addSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    dismissSuggestion,
    clearSuggestions,
    acceptGhostText,
    rejectGhostText,
    recordBugPrevented,
    setIsAnalyzing,
  };
}
