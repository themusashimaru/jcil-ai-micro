'use client';

/**
 * CODE LAB EDITOR
 *
 * CodeMirror 6-based code editor with syntax highlighting,
 * multi-file tabs, search, and keyboard shortcuts.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
} from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { indentOnInput, bracketMatching, foldGutter, foldKeymap } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { sql } from '@codemirror/lang-sql';
import { rust } from '@codemirror/lang-rust';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { php } from '@codemirror/lang-php';
import { CodeLabEditorProps, _getLanguageFromPath } from './CodeLabEditor.utils';
import {
  EditorTabs,
  EditorBreadcrumbs,
  DiffActionsBar,
  EditorSearchBar,
  EditorStatusBar,
  EditorEmptyState,
} from './CodeLabEditorParts';

export type { EditorFile, DiffHunk, EditorChange, CodeLabEditorProps } from './CodeLabEditor.utils';

function getLanguageExtension(language: string) {
  switch (language) {
    case 'javascript':
    case 'typescript':
      return javascript({ jsx: true, typescript: language === 'typescript' });
    case 'python':
      return python();
    case 'html':
      return html();
    case 'css':
    case 'scss':
    case 'less':
      return css();
    case 'json':
      return json();
    case 'markdown':
      return markdown();
    case 'sql':
      return sql();
    case 'rust':
      return rust();
    case 'java':
    case 'kotlin':
    case 'scala':
      return java();
    case 'c':
    case 'cpp':
    case 'csharp':
      return cpp();
    case 'php':
      return php();
    default:
      return javascript(); // fallback
  }
}

export function CodeLabEditor({
  files,
  activeFileId,
  onFileSelect,
  onFileClose,
  onFileSave,
  onFileCreate,
  onAcceptChange: _onAcceptChange,
  onRejectChange: _onRejectChange,
  onAcceptAllChanges,
  onRejectAllChanges,
  pendingChanges = [],
  readOnly = false,
  theme = 'dark',
}: CodeLabEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageCompartment = useRef(new Compartment());
  const readOnlyCompartment = useRef(new Compartment());
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);

  const activeFile = useMemo(() => files.find((f) => f.id === activeFileId), [files, activeFileId]);
  const activeFileChanges = useMemo(
    () => pendingChanges.find((c) => c.path === activeFile?.path),
    [pendingChanges, activeFile]
  );

  // Stable save callback
  const onFileSaveRef = useRef(onFileSave);
  onFileSaveRef.current = onFileSave;
  const activeFileRef = useRef(activeFile);
  activeFileRef.current = activeFile;

  // Initialize CodeMirror
  useEffect(() => {
    if (!containerRef.current) return;

    const lang = activeFile ? _getLanguageFromPath(activeFile.path) : 'javascript';

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && activeFileRef.current) {
        onFileSaveRef.current(activeFileRef.current.id, update.state.doc.toString());
      }
      if (update.selectionSet) {
        const pos = update.state.selection.main.head;
        const line = update.state.doc.lineAt(pos);
        setCursorPosition({ line: line.number, column: pos - line.from + 1 });
      }
    });

    const state = EditorState.create({
      doc: activeFile?.content || '',
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        foldGutter(),
        highlightSelectionMatches(),
        history(),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...closeBracketsKeymap,
          ...foldKeymap,
          indentWithTab,
        ]),
        languageCompartment.current.of(getLanguageExtension(lang)),
        readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly)),
        theme === 'dark' ? oneDark : [],
        EditorView.theme({
          '&': { height: '100%', fontSize: '13px' },
          '.cm-scroller': {
            overflow: 'auto',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          },
          '.cm-content': { padding: '8px 0' },
          '.cm-gutters': { borderRight: '1px solid rgba(255,255,255,0.1)' },
        }),
        updateListener,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only recreate on file switch, not content changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFileId, theme]);

  // Update readOnly when it changes
  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: readOnlyCompartment.current.reconfigure(EditorState.readOnly.of(readOnly)),
      });
    }
  }, [readOnly]);

  // Handle Cmd+F for search
  const handleSearchToggle = useCallback(() => {
    setSearchOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        handleSearchToggle();
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen, handleSearchToggle]);

  // Basic search (for the search bar UI)
  useEffect(() => {
    if (!searchQuery || !activeFile) {
      setSearchResults([]);
      return;
    }
    const content = activeFile.content.toLowerCase();
    const query = searchQuery.toLowerCase();
    const results: number[] = [];
    let index = content.indexOf(query);
    while (index !== -1) {
      results.push(index);
      index = content.indexOf(query, index + 1);
    }
    setSearchResults(results);
    setCurrentSearchIndex(0);
  }, [searchQuery, activeFile]);

  if (files.length === 0) {
    return <EditorEmptyState theme={theme} onFileCreate={onFileCreate} />;
  }

  return (
    <div className="code-lab-editor dark flex flex-col h-full">
      <EditorTabs
        files={files}
        activeFileId={activeFileId}
        onFileSelect={onFileSelect}
        onFileClose={onFileClose}
      />
      <EditorBreadcrumbs activeFile={activeFile} />
      <DiffActionsBar
        activeFileChanges={activeFileChanges}
        activeFileId={activeFile?.id ?? ''}
        onAcceptAllChanges={onAcceptAllChanges}
        onRejectAllChanges={onRejectAllChanges}
      />
      <EditorSearchBar
        searchOpen={searchOpen}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchResults={searchResults}
        currentSearchIndex={currentSearchIndex}
        setCurrentSearchIndex={setCurrentSearchIndex}
        setSearchOpen={setSearchOpen}
      />

      <div ref={containerRef} className="flex-1 overflow-hidden" />

      <EditorStatusBar activeFile={activeFile} cursorPosition={cursorPosition} />
    </div>
  );
}

export default CodeLabEditor;
