// @ts-nocheck
import React from 'react';
globalThis.React = React;
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// ============================================================================
// MOCKS
// ============================================================================

const mockLogger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => mockLogger,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import { CodeLabEditor } from './CodeLabEditor';
import CodeLabEditorDefault from './CodeLabEditor';

// ============================================================================
// HELPERS
// ============================================================================

function makeFile(overrides = {}) {
  return {
    id: 'file-1',
    path: 'src/utils/helpers.ts',
    name: 'helpers.ts',
    content: 'const x = 1;\nconst y = 2;\nconst z = 3;\n',
    language: 'typescript',
    isDirty: false,
    isNew: false,
    ...overrides,
  };
}

function makeFile2(overrides = {}) {
  return {
    id: 'file-2',
    path: 'src/components/App.tsx',
    name: 'App.tsx',
    content: 'export default function App() {\n  return <div>Hello</div>;\n}\n',
    language: 'typescript',
    isDirty: true,
    isNew: false,
    ...overrides,
  };
}

function makeHunk(overrides = {}) {
  return {
    id: 'hunk-1',
    startLine: 1,
    endLine: 3,
    oldContent: 'const x = 1;',
    newContent: 'const x = 2;',
    status: 'pending' as const,
    ...overrides,
  };
}

function defaultProps(overrides = {}) {
  return {
    files: [makeFile()],
    activeFileId: 'file-1',
    onFileSelect: vi.fn(),
    onFileClose: vi.fn(),
    onFileSave: vi.fn(),
    onFileCreate: vi.fn(),
    onAcceptChange: vi.fn(),
    onRejectChange: vi.fn(),
    onAcceptAllChanges: vi.fn(),
    onRejectAllChanges: vi.fn(),
    ...overrides,
  };
}

function renderEditor(overrides = {}) {
  const props = defaultProps(overrides);
  const result = render(<CodeLabEditor {...props} />);
  return { ...result, props };
}

// ============================================================================
// TESTS
// ============================================================================

describe('CodeLabEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // MODULE EXPORTS
  // --------------------------------------------------------------------------

  describe('Module Exports', () => {
    it('should export CodeLabEditor as a named export', () => {
      expect(CodeLabEditor).toBeDefined();
      expect(typeof CodeLabEditor).toBe('function');
    });

    it('should export CodeLabEditor as the default export', () => {
      expect(CodeLabEditorDefault).toBeDefined();
      expect(typeof CodeLabEditorDefault).toBe('function');
    });

    it('should have the same reference for named and default exports', () => {
      expect(CodeLabEditor).toBe(CodeLabEditorDefault);
    });
  });

  // --------------------------------------------------------------------------
  // EMPTY STATE
  // --------------------------------------------------------------------------

  describe('Empty State', () => {
    it('should render empty state when files array is empty', () => {
      renderEditor({ files: [] });
      expect(screen.getByText('No files open')).toBeInTheDocument();
    });

    it('should show guidance text in empty state', () => {
      renderEditor({ files: [] });
      expect(
        screen.getByText('Open a file from the sidebar or create a new one')
      ).toBeInTheDocument();
    });

    it('should render Create New File button in empty state', () => {
      renderEditor({ files: [] });
      expect(screen.getByText('Create New File')).toBeInTheDocument();
    });

    it('should call onFileCreate when Create New File button is clicked', () => {
      const { props } = renderEditor({ files: [] });
      fireEvent.click(screen.getByText('Create New File'));
      expect(props.onFileCreate).toHaveBeenCalledWith('untitled.ts', '');
    });

    it('should apply empty class to wrapper when no files', () => {
      const { container } = renderEditor({ files: [] });
      const editor = container.querySelector('.code-lab-editor');
      expect(editor).toHaveClass('empty');
    });

    it('should apply light theme to empty state by default', () => {
      const { container } = renderEditor({ files: [] });
      const editor = container.querySelector('.code-lab-editor');
      expect(editor).toHaveClass('light');
    });

    it('should apply dark theme to empty state when theme is dark', () => {
      const { container } = renderEditor({ files: [], theme: 'dark' });
      const editor = container.querySelector('.code-lab-editor');
      expect(editor).toHaveClass('dark');
    });

    it('should render an SVG icon in empty state', () => {
      const { container } = renderEditor({ files: [] });
      const svg = container.querySelector('.empty-icon');
      expect(svg).toBeInTheDocument();
    });

    it('should render embedded styles in empty state', () => {
      const { container } = renderEditor({ files: [] });
      const styleElements = container.querySelectorAll('style');
      expect(styleElements.length).toBeGreaterThan(0);
    });

    it('should not render tabs in empty state', () => {
      const { container } = renderEditor({ files: [] });
      expect(container.querySelector('.editor-tabs')).not.toBeInTheDocument();
    });

    it('should not render breadcrumbs in empty state', () => {
      const { container } = renderEditor({ files: [] });
      expect(container.querySelector('.editor-breadcrumbs')).not.toBeInTheDocument();
    });

    it('should not render status bar in empty state', () => {
      const { container } = renderEditor({ files: [] });
      expect(container.querySelector('.editor-status-bar')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // BASIC RENDERING (with files)
  // --------------------------------------------------------------------------

  describe('Basic Rendering', () => {
    it('should render without crashing with default props', () => {
      const { container } = renderEditor();
      expect(container.querySelector('.code-lab-editor')).toBeInTheDocument();
    });

    it('should apply light theme class by default', () => {
      const { container } = renderEditor();
      const editor = container.querySelector('.code-lab-editor');
      expect(editor).toHaveClass('light');
    });

    it('should apply dark theme class when theme is dark', () => {
      const { container } = renderEditor({ theme: 'dark' });
      const editor = container.querySelector('.code-lab-editor');
      expect(editor).toHaveClass('dark');
    });

    it('should render embedded styles', () => {
      const { container } = renderEditor();
      const styleElements = container.querySelectorAll('style');
      expect(styleElements.length).toBeGreaterThan(0);
    });

    it('should render the editor container', () => {
      const { container } = renderEditor();
      expect(container.querySelector('.editor-container')).toBeInTheDocument();
    });

    it('should render a textarea for editing', () => {
      renderEditor();
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
    });

    it('should render the minimap', () => {
      const { container } = renderEditor();
      expect(container.querySelector('.editor-minimap')).toBeInTheDocument();
    });

    it('should hide minimap from accessibility tree', () => {
      const { container } = renderEditor();
      const minimap = container.querySelector('.editor-minimap');
      expect(minimap).toHaveAttribute('aria-hidden', 'true');
    });
  });

  // --------------------------------------------------------------------------
  // FILE TABS
  // --------------------------------------------------------------------------

  describe('File Tabs', () => {
    it('should render tabs container', () => {
      const { container } = renderEditor();
      expect(container.querySelector('.editor-tabs')).toBeInTheDocument();
    });

    it('should render one tab per file', () => {
      const { container } = renderEditor({
        files: [makeFile(), makeFile2()],
      });
      const tabs = container.querySelectorAll('.editor-tab');
      expect(tabs.length).toBe(2);
    });

    it('should display file name in each tab', () => {
      const { container } = renderEditor({ files: [makeFile(), makeFile2()] });
      const tabNames = container.querySelectorAll('.tab-name');
      const names = Array.from(tabNames).map((el) => el.textContent);
      expect(names).toContain('helpers.ts');
      expect(names).toContain('App.tsx');
    });

    it('should mark active tab with active class', () => {
      const { container } = renderEditor({
        files: [makeFile(), makeFile2()],
        activeFileId: 'file-1',
      });
      const tabs = container.querySelectorAll('.editor-tab');
      expect(tabs[0]).toHaveClass('active');
      expect(tabs[1]).not.toHaveClass('active');
    });

    it('should mark dirty file tab with dirty class', () => {
      const { container } = renderEditor({
        files: [makeFile({ isDirty: true })],
      });
      const tab = container.querySelector('.editor-tab');
      expect(tab).toHaveClass('dirty');
    });

    it('should show dirty indicator for dirty files', () => {
      const { container } = renderEditor({
        files: [makeFile({ isDirty: true })],
      });
      const indicator = container.querySelector('.tab-dirty-indicator');
      expect(indicator).toBeInTheDocument();
    });

    it('should have aria-label on dirty indicator', () => {
      const { container } = renderEditor({
        files: [makeFile({ isDirty: true })],
      });
      const indicator = container.querySelector('.tab-dirty-indicator');
      expect(indicator).toHaveAttribute('aria-label', 'Unsaved changes');
    });

    it('should not show dirty indicator for clean files', () => {
      const { container } = renderEditor({
        files: [makeFile({ isDirty: false })],
      });
      const indicator = container.querySelector('.tab-dirty-indicator');
      expect(indicator).not.toBeInTheDocument();
    });

    it('should call onFileSelect when a tab is clicked', () => {
      const { props } = renderEditor({
        files: [makeFile(), makeFile2()],
      });
      fireEvent.click(screen.getByText('App.tsx'));
      expect(props.onFileSelect).toHaveBeenCalledWith('file-2');
    });

    it('should render close button for each tab', () => {
      renderEditor({
        files: [makeFile(), makeFile2()],
      });
      const closeButtons = screen.getAllByRole('button', { name: /Close/ });
      expect(closeButtons.length).toBe(2);
    });

    it('should have proper aria-label on close button', () => {
      renderEditor();
      expect(screen.getByLabelText('Close helpers.ts')).toBeInTheDocument();
    });

    it('should call onFileClose when close button is clicked', () => {
      const { props } = renderEditor();
      fireEvent.click(screen.getByLabelText('Close helpers.ts'));
      expect(props.onFileClose).toHaveBeenCalledWith('file-1');
    });

    it('should not trigger onFileSelect when close button is clicked (stopPropagation)', () => {
      const { props } = renderEditor();
      fireEvent.click(screen.getByLabelText('Close helpers.ts'));
      expect(props.onFileSelect).not.toHaveBeenCalled();
    });

    it('should display file icon based on language', () => {
      const { container } = renderEditor({
        files: [makeFile({ language: 'python' })],
      });
      const icon = container.querySelector('.tab-icon');
      expect(icon).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // BREADCRUMBS
  // --------------------------------------------------------------------------

  describe('Breadcrumbs', () => {
    it('should render breadcrumbs for active file', () => {
      const { container } = renderEditor();
      expect(container.querySelector('.editor-breadcrumbs')).toBeInTheDocument();
    });

    it('should have aria-label for breadcrumbs', () => {
      renderEditor();
      expect(screen.getByLabelText('File path')).toBeInTheDocument();
    });

    it('should display path segments', () => {
      const { container } = renderEditor({
        files: [makeFile({ path: 'src/utils/helpers.ts' })],
      });
      const breadcrumbItems = container.querySelectorAll('.breadcrumb-item');
      const texts = Array.from(breadcrumbItems).map((el) =>
        el.textContent?.replace(/\//g, '').trim()
      );
      expect(texts).toContain('src');
      expect(texts).toContain('utils');
      expect(texts).toContain('helpers.ts');
    });

    it('should render separators between breadcrumb items', () => {
      const { container } = renderEditor({
        files: [makeFile({ path: 'src/utils/helpers.ts' })],
      });
      const separators = container.querySelectorAll('.breadcrumb-separator');
      expect(separators.length).toBe(2); // Two separators for three segments
    });

    it('should mark last breadcrumb item as current', () => {
      const { container } = renderEditor({
        files: [makeFile({ path: 'src/utils/helpers.ts' })],
      });
      const currentItem = container.querySelector('.breadcrumb-current');
      expect(currentItem).toBeInTheDocument();
      expect(currentItem).toHaveTextContent('helpers.ts');
    });

    it('should not render breadcrumbs when no active file', () => {
      const { container } = renderEditor({
        files: [makeFile()],
        activeFileId: 'non-existent',
      });
      expect(container.querySelector('.editor-breadcrumbs')).not.toBeInTheDocument();
    });

    it('should handle single-segment paths', () => {
      const { container } = renderEditor({
        files: [makeFile({ path: 'index.ts' })],
      });
      const separators = container.querySelectorAll('.breadcrumb-separator');
      expect(separators.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // LINE NUMBERS
  // --------------------------------------------------------------------------

  describe('Line Numbers', () => {
    it('should render line numbers container', () => {
      const { container } = renderEditor();
      expect(container.querySelector('.line-numbers')).toBeInTheDocument();
    });

    it('should hide line numbers from accessibility tree', () => {
      const { container } = renderEditor();
      const lineNumbers = container.querySelector('.line-numbers');
      expect(lineNumbers).toHaveAttribute('aria-hidden', 'true');
    });

    it('should render correct number of line numbers', () => {
      const content = 'line1\nline2\nline3\nline4\n';
      const { container } = renderEditor({
        files: [makeFile({ content })],
      });
      const lines = container.querySelectorAll('.line-number');
      expect(lines.length).toBe(5); // 4 lines + 1 for trailing newline
    });

    it('should render sequential line numbers starting from 1', () => {
      const content = 'a\nb\nc';
      const { container } = renderEditor({
        files: [makeFile({ content })],
      });
      const lines = container.querySelectorAll('.line-number');
      expect(lines[0]).toHaveTextContent('1');
      expect(lines[1]).toHaveTextContent('2');
      expect(lines[2]).toHaveTextContent('3');
    });

    it('should render 1 line number for single-line content', () => {
      const { container } = renderEditor({
        files: [makeFile({ content: 'single line' })],
      });
      const lines = container.querySelectorAll('.line-number');
      expect(lines.length).toBe(1);
    });

    it('should render 0 line numbers when no active file', () => {
      const { container } = renderEditor({
        files: [makeFile()],
        activeFileId: 'non-existent',
      });
      const lines = container.querySelectorAll('.line-number');
      expect(lines.length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // EDITOR TEXTAREA
  // --------------------------------------------------------------------------

  describe('Editor Textarea', () => {
    it('should display active file content', () => {
      renderEditor({
        files: [makeFile({ content: 'hello world' })],
      });
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('hello world');
    });

    it('should have spellcheck disabled', () => {
      renderEditor();
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('spellcheck', 'false');
    });

    it('should have autocapitalize off', () => {
      renderEditor();
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('autocapitalize', 'off');
    });

    it('should have autocorrect off', () => {
      renderEditor();
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('autocorrect', 'off');
    });

    it('should have aria-label with file name', () => {
      renderEditor({
        files: [makeFile({ name: 'helpers.ts' })],
      });
      expect(screen.getByLabelText('Editing helpers.ts')).toBeInTheDocument();
    });

    it('should show generic aria-label when no active file', () => {
      renderEditor({
        files: [makeFile()],
        activeFileId: 'non-existent',
      });
      expect(screen.getByLabelText('Editing file')).toBeInTheDocument();
    });

    it('should not be readonly by default', () => {
      renderEditor();
      const textarea = screen.getByRole('textbox');
      expect(textarea).not.toHaveAttribute('readonly');
    });

    it('should be readonly when readOnly prop is true', () => {
      renderEditor({ readOnly: true });
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('readonly');
    });

    it('should have aria-readonly when readOnly is true', () => {
      renderEditor({ readOnly: true });
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('aria-readonly', 'true');
    });

    it('should have empty content when no active file matches', () => {
      renderEditor({
        files: [makeFile()],
        activeFileId: 'non-existent',
      });
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('');
    });

    it('should call onFileSave on content change', () => {
      const { props } = renderEditor();
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'new content' } });
      expect(props.onFileSave).toHaveBeenCalledWith('file-1', 'new content');
    });

    it('should not call onFileSave when readOnly', () => {
      const { props } = renderEditor({ readOnly: true });
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'new content' } });
      expect(props.onFileSave).not.toHaveBeenCalled();
    });

    it('should not call onFileSave when no active file', () => {
      const { props } = renderEditor({
        files: [makeFile()],
        activeFileId: 'non-existent',
      });
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'new content' } });
      expect(props.onFileSave).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // KEYBOARD SHORTCUTS
  // --------------------------------------------------------------------------

  describe('Keyboard Shortcuts', () => {
    it('should save file on Ctrl+S', () => {
      const { props } = renderEditor();
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 's', ctrlKey: true });
      expect(props.onFileSave).toHaveBeenCalledWith(
        'file-1',
        'const x = 1;\nconst y = 2;\nconst z = 3;\n'
      );
    });

    it('should save file on Meta+S (Cmd+S)', () => {
      const { props } = renderEditor();
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 's', metaKey: true });
      expect(props.onFileSave).toHaveBeenCalledWith(
        'file-1',
        'const x = 1;\nconst y = 2;\nconst z = 3;\n'
      );
    });

    it('should not save when there is no active file on Ctrl+S', () => {
      const { props } = renderEditor({
        files: [makeFile()],
        activeFileId: 'non-existent',
      });
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 's', ctrlKey: true });
      expect(props.onFileSave).not.toHaveBeenCalled();
    });

    it('should open search on Ctrl+F', () => {
      const { container } = renderEditor();
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'f', ctrlKey: true });
      expect(container.querySelector('.editor-search-bar')).toBeInTheDocument();
    });

    it('should open search on Meta+F (Cmd+F)', () => {
      const { container } = renderEditor();
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'f', metaKey: true });
      expect(container.querySelector('.editor-search-bar')).toBeInTheDocument();
    });

    it('should close search on Escape when search is open', () => {
      const { container } = renderEditor();
      const textarea = screen.getByRole('textbox');
      // Open search first
      fireEvent.keyDown(textarea, { key: 'f', ctrlKey: true });
      expect(container.querySelector('.editor-search-bar')).toBeInTheDocument();
      // Close search
      fireEvent.keyDown(textarea, { key: 'Escape' });
      expect(container.querySelector('.editor-search-bar')).not.toBeInTheDocument();
    });

    it('should insert 2 spaces on Tab key', () => {
      const { props } = renderEditor({
        files: [makeFile({ content: 'hello' })],
      });
      const textarea = screen.getByRole('textbox');
      // Simulate cursor at position 5
      Object.defineProperty(textarea, 'selectionStart', { value: 5, writable: true });
      Object.defineProperty(textarea, 'selectionEnd', { value: 5, writable: true });
      fireEvent.keyDown(textarea, { key: 'Tab' });
      expect(props.onFileSave).toHaveBeenCalledWith('file-1', 'hello  ');
    });

    it('should not insert tab when Shift+Tab is pressed', () => {
      const { props } = renderEditor();
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'Tab', shiftKey: true });
      expect(props.onFileSave).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // SEARCH FUNCTIONALITY
  // --------------------------------------------------------------------------

  describe('Search Functionality', () => {
    it('should not show search bar by default', () => {
      const { container } = renderEditor();
      expect(container.querySelector('.editor-search-bar')).not.toBeInTheDocument();
    });

    it('should render search input when search is open', () => {
      renderEditor();
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'f', ctrlKey: true });
      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    });

    it('should have aria-label on search input', () => {
      renderEditor();
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'f', ctrlKey: true });
      expect(screen.getByLabelText('Search in file')).toBeInTheDocument();
    });

    it('should show "No results" when search query has no matches', () => {
      renderEditor();
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'f', ctrlKey: true });
      const searchInput = screen.getByPlaceholderText('Search...');
      fireEvent.change(searchInput, { target: { value: 'nonexistenttext' } });
      expect(screen.getByText('No results')).toBeInTheDocument();
    });

    it('should show result count when search has matches', () => {
      renderEditor({
        files: [makeFile({ content: 'const x = 1;\nconst y = 2;\nconst z = 3;\n' })],
      });
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'f', ctrlKey: true });
      const searchInput = screen.getByPlaceholderText('Search...');
      fireEvent.change(searchInput, { target: { value: 'const' } });
      expect(screen.getByText('1 of 3')).toBeInTheDocument();
    });

    it('should perform case-insensitive search', () => {
      renderEditor({
        files: [makeFile({ content: 'Hello hello HELLO' })],
      });
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'f', ctrlKey: true });
      const searchInput = screen.getByPlaceholderText('Search...');
      fireEvent.change(searchInput, { target: { value: 'hello' } });
      expect(screen.getByText('1 of 3')).toBeInTheDocument();
    });

    it('should render Previous result button', () => {
      renderEditor();
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'f', ctrlKey: true });
      expect(screen.getByLabelText('Previous result')).toBeInTheDocument();
    });

    it('should render Next result button', () => {
      renderEditor();
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'f', ctrlKey: true });
      expect(screen.getByLabelText('Next result')).toBeInTheDocument();
    });

    it('should render Close search button', () => {
      renderEditor();
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'f', ctrlKey: true });
      expect(screen.getByLabelText('Close search')).toBeInTheDocument();
    });

    it('should close search when Close search button is clicked', () => {
      const { container } = renderEditor();
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'f', ctrlKey: true });
      fireEvent.click(screen.getByLabelText('Close search'));
      expect(container.querySelector('.editor-search-bar')).not.toBeInTheDocument();
    });

    it('should disable navigation buttons when there are no results', () => {
      renderEditor();
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'f', ctrlKey: true });
      expect(screen.getByLabelText('Previous result')).toBeDisabled();
      expect(screen.getByLabelText('Next result')).toBeDisabled();
    });

    it('should enable navigation buttons when there are results', () => {
      renderEditor({
        files: [makeFile({ content: 'const const const' })],
      });
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'f', ctrlKey: true });
      const searchInput = screen.getByPlaceholderText('Search...');
      fireEvent.change(searchInput, { target: { value: 'const' } });
      expect(screen.getByLabelText('Previous result')).not.toBeDisabled();
      expect(screen.getByLabelText('Next result')).not.toBeDisabled();
    });

    it('should navigate to next result when Next button is clicked', () => {
      renderEditor({
        files: [makeFile({ content: 'abc abc abc' })],
      });
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'f', ctrlKey: true });
      const searchInput = screen.getByPlaceholderText('Search...');
      fireEvent.change(searchInput, { target: { value: 'abc' } });
      expect(screen.getByText('1 of 3')).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('Next result'));
      expect(screen.getByText('2 of 3')).toBeInTheDocument();
    });

    it('should navigate to previous result when Previous button is clicked', () => {
      renderEditor({
        files: [makeFile({ content: 'abc abc abc' })],
      });
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'f', ctrlKey: true });
      const searchInput = screen.getByPlaceholderText('Search...');
      fireEvent.change(searchInput, { target: { value: 'abc' } });
      // Navigate forward first
      fireEvent.click(screen.getByLabelText('Next result'));
      expect(screen.getByText('2 of 3')).toBeInTheDocument();
      // Navigate back
      fireEvent.click(screen.getByLabelText('Previous result'));
      expect(screen.getByText('1 of 3')).toBeInTheDocument();
    });

    it('should not go below index 0 when pressing Previous', () => {
      renderEditor({
        files: [makeFile({ content: 'abc abc' })],
      });
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'f', ctrlKey: true });
      const searchInput = screen.getByPlaceholderText('Search...');
      fireEvent.change(searchInput, { target: { value: 'abc' } });
      // Already at index 0, pressing previous should stay at 0
      fireEvent.click(screen.getByLabelText('Previous result'));
      expect(screen.getByText('1 of 2')).toBeInTheDocument();
    });

    it('should not exceed max index when pressing Next', () => {
      renderEditor({
        files: [makeFile({ content: 'abc abc' })],
      });
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'f', ctrlKey: true });
      const searchInput = screen.getByPlaceholderText('Search...');
      fireEvent.change(searchInput, { target: { value: 'abc' } });
      fireEvent.click(screen.getByLabelText('Next result'));
      expect(screen.getByText('2 of 2')).toBeInTheDocument();
      // Pressing next again should stay at max
      fireEvent.click(screen.getByLabelText('Next result'));
      expect(screen.getByText('2 of 2')).toBeInTheDocument();
    });

    it('should reset search results when query is cleared', () => {
      renderEditor({
        files: [makeFile({ content: 'abc abc' })],
      });
      const textarea = screen.getByRole('textbox');
      fireEvent.keyDown(textarea, { key: 'f', ctrlKey: true });
      const searchInput = screen.getByPlaceholderText('Search...');
      fireEvent.change(searchInput, { target: { value: 'abc' } });
      expect(screen.getByText('1 of 2')).toBeInTheDocument();
      fireEvent.change(searchInput, { target: { value: '' } });
      expect(screen.getByText('No results')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // DIFF ACTIONS
  // --------------------------------------------------------------------------

  describe('Diff Actions', () => {
    it('should not render diff actions when no pending changes', () => {
      const { container } = renderEditor();
      expect(container.querySelector('.diff-actions-bar')).not.toBeInTheDocument();
    });

    it('should not render diff actions when pending changes array is empty', () => {
      const { container } = renderEditor({ pendingChanges: [] });
      expect(container.querySelector('.diff-actions-bar')).not.toBeInTheDocument();
    });

    it('should not render diff actions when changes are for a different file', () => {
      const { container } = renderEditor({
        pendingChanges: [
          {
            path: 'other/file.ts',
            hunks: [makeHunk()],
          },
        ],
      });
      expect(container.querySelector('.diff-actions-bar')).not.toBeInTheDocument();
    });

    it('should render diff actions when active file has pending changes', () => {
      const { container } = renderEditor({
        pendingChanges: [
          {
            path: 'src/utils/helpers.ts',
            hunks: [makeHunk()],
          },
        ],
      });
      expect(container.querySelector('.diff-actions-bar')).toBeInTheDocument();
    });

    it('should display pending change count', () => {
      renderEditor({
        pendingChanges: [
          {
            path: 'src/utils/helpers.ts',
            hunks: [makeHunk(), makeHunk({ id: 'hunk-2' })],
          },
        ],
      });
      expect(screen.getByText('2 pending changes')).toBeInTheDocument();
    });

    it('should only count pending hunks (not accepted/rejected)', () => {
      renderEditor({
        pendingChanges: [
          {
            path: 'src/utils/helpers.ts',
            hunks: [
              makeHunk({ id: 'h1', status: 'pending' }),
              makeHunk({ id: 'h2', status: 'accepted' }),
              makeHunk({ id: 'h3', status: 'rejected' }),
            ],
          },
        ],
      });
      expect(screen.getByText('1 pending changes')).toBeInTheDocument();
    });

    it('should render Accept All button', () => {
      renderEditor({
        pendingChanges: [{ path: 'src/utils/helpers.ts', hunks: [makeHunk()] }],
      });
      expect(screen.getByText('Accept All')).toBeInTheDocument();
    });

    it('should render Reject All button', () => {
      renderEditor({
        pendingChanges: [{ path: 'src/utils/helpers.ts', hunks: [makeHunk()] }],
      });
      expect(screen.getByText('Reject All')).toBeInTheDocument();
    });

    it('should call onAcceptAllChanges when Accept All is clicked', () => {
      const { props } = renderEditor({
        pendingChanges: [{ path: 'src/utils/helpers.ts', hunks: [makeHunk()] }],
      });
      fireEvent.click(screen.getByText('Accept All'));
      expect(props.onAcceptAllChanges).toHaveBeenCalledWith('file-1');
    });

    it('should call onRejectAllChanges when Reject All is clicked', () => {
      const { props } = renderEditor({
        pendingChanges: [{ path: 'src/utils/helpers.ts', hunks: [makeHunk()] }],
      });
      fireEvent.click(screen.getByText('Reject All'));
      expect(props.onRejectAllChanges).toHaveBeenCalledWith('file-1');
    });

    it('should disable Accept All button when no pending hunks remain', () => {
      renderEditor({
        pendingChanges: [
          {
            path: 'src/utils/helpers.ts',
            hunks: [makeHunk({ status: 'accepted' })],
          },
        ],
      });
      // 0 pending hunks but the bar still renders since hunks.length > 0
      // The buttons should be disabled
      const acceptBtn = screen.getByText('Accept All').closest('button');
      expect(acceptBtn).toBeDisabled();
    });

    it('should disable Reject All button when no pending hunks remain', () => {
      renderEditor({
        pendingChanges: [
          {
            path: 'src/utils/helpers.ts',
            hunks: [makeHunk({ status: 'accepted' })],
          },
        ],
      });
      const rejectBtn = screen.getByText('Reject All').closest('button');
      expect(rejectBtn).toBeDisabled();
    });

    it('should not render diff actions when hunks array is empty', () => {
      const { container } = renderEditor({
        pendingChanges: [{ path: 'src/utils/helpers.ts', hunks: [] }],
      });
      expect(container.querySelector('.diff-actions-bar')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // STATUS BAR
  // --------------------------------------------------------------------------

  describe('Status Bar', () => {
    it('should render status bar', () => {
      const { container } = renderEditor();
      expect(container.querySelector('.editor-status-bar')).toBeInTheDocument();
    });

    it('should display active file language', () => {
      renderEditor({
        files: [makeFile({ language: 'python' })],
      });
      expect(screen.getByText('python')).toBeInTheDocument();
    });

    it('should display Plain Text when no active file', () => {
      renderEditor({
        files: [makeFile()],
        activeFileId: 'non-existent',
      });
      expect(screen.getByText('Plain Text')).toBeInTheDocument();
    });

    it('should display UTF-8 encoding', () => {
      renderEditor();
      expect(screen.getByText('UTF-8')).toBeInTheDocument();
    });

    it('should display LF line ending', () => {
      renderEditor();
      expect(screen.getByText('LF')).toBeInTheDocument();
    });

    it('should display cursor position', () => {
      renderEditor();
      expect(screen.getByText(/Ln 1, Col 1/)).toBeInTheDocument();
    });

    it('should show Modified indicator when active file is dirty', () => {
      renderEditor({
        files: [makeFile({ isDirty: true })],
      });
      expect(screen.getByText('Modified')).toBeInTheDocument();
    });

    it('should not show Modified indicator when active file is clean', () => {
      renderEditor({
        files: [makeFile({ isDirty: false })],
      });
      expect(screen.queryByText('Modified')).not.toBeInTheDocument();
    });

    it('should have left and right sections', () => {
      const { container } = renderEditor();
      expect(container.querySelector('.status-left')).toBeInTheDocument();
      expect(container.querySelector('.status-right')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // MINIMAP
  // --------------------------------------------------------------------------

  describe('Minimap', () => {
    it('should render minimap container', () => {
      const { container } = renderEditor();
      expect(container.querySelector('.editor-minimap')).toBeInTheDocument();
    });

    it('should render minimap content div', () => {
      const { container } = renderEditor();
      expect(container.querySelector('.minimap-content')).toBeInTheDocument();
    });

    it('should set minimap height based on line count', () => {
      const content = 'a\nb\nc\nd\ne'; // 5 lines
      const { container } = renderEditor({
        files: [makeFile({ content })],
      });
      const minimapContent = container.querySelector('.minimap-content');
      // 5 lines * 2 = 10%, which is < 100%
      expect(minimapContent).toHaveStyle({ height: '10%' });
    });

    it('should cap minimap height at 100%', () => {
      // Create content with many lines (> 50 lines to hit 100% cap)
      const lines = Array.from({ length: 60 }, (_, i) => `line ${i}`).join('\n');
      const { container } = renderEditor({
        files: [makeFile({ content: lines })],
      });
      const minimapContent = container.querySelector('.minimap-content');
      expect(minimapContent).toHaveStyle({ height: '100%' });
    });
  });

  // --------------------------------------------------------------------------
  // CURSOR POSITION TRACKING
  // --------------------------------------------------------------------------

  describe('Cursor Position Tracking', () => {
    it('should update cursor position on selection change', () => {
      renderEditor({
        files: [makeFile({ content: 'first line\nsecond line\nthird line' })],
      });
      const textarea = screen.getByRole('textbox');
      // Simulate cursor at position 15 (second line, column 5)
      Object.defineProperty(textarea, 'selectionStart', {
        value: 15,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(textarea, 'selectionEnd', {
        value: 15,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(textarea, 'value', {
        value: 'first line\nsecond line\nthird line',
        writable: true,
        configurable: true,
      });
      fireEvent.select(textarea);
      expect(screen.getByText('Ln 2, Col 5')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // FILE ICONS
  // --------------------------------------------------------------------------

  describe('File Icons', () => {
    it('should display typescript icon for typescript files', () => {
      const { container } = renderEditor({
        files: [makeFile({ language: 'typescript' })],
      });
      const icon = container.querySelector('.tab-icon');
      expect(icon).toHaveTextContent('\uD83D\uDCD8'); // 📘
    });

    it('should display python icon for python files', () => {
      const { container } = renderEditor({
        files: [makeFile({ language: 'python' })],
      });
      const icon = container.querySelector('.tab-icon');
      expect(icon).toHaveTextContent('\uD83D\uDC0D'); // 🐍
    });

    it('should display default icon for unknown language', () => {
      const { container } = renderEditor({
        files: [makeFile({ language: 'brainfuck' })],
      });
      const icon = container.querySelector('.tab-icon');
      expect(icon).toHaveTextContent('\uD83D\uDCC4'); // 📄
    });

    it('should display javascript icon for javascript files', () => {
      const { container } = renderEditor({
        files: [makeFile({ language: 'javascript' })],
      });
      const icon = container.querySelector('.tab-icon');
      expect(icon).toHaveTextContent('\uD83D\uDCD2'); // 📒
    });

    it('should display html icon for html files', () => {
      const { container } = renderEditor({
        files: [makeFile({ language: 'html' })],
      });
      const icon = container.querySelector('.tab-icon');
      expect(icon).toHaveTextContent('\uD83C\uDF10'); // 🌐
    });

    it('should display css icon for css files', () => {
      const { container } = renderEditor({
        files: [makeFile({ language: 'css' })],
      });
      const icon = container.querySelector('.tab-icon');
      expect(icon).toHaveTextContent('\uD83C\uDFA8'); // 🎨
    });
  });

  // --------------------------------------------------------------------------
  // MULTIPLE FILES
  // --------------------------------------------------------------------------

  describe('Multiple Files', () => {
    it('should render tabs for all files', () => {
      const files = [
        makeFile({ id: 'f1', name: 'file1.ts' }),
        makeFile({ id: 'f2', name: 'file2.ts' }),
        makeFile({ id: 'f3', name: 'file3.ts' }),
      ];
      const { container } = renderEditor({ files, activeFileId: 'f1' });
      const tabs = container.querySelectorAll('.editor-tab');
      expect(tabs.length).toBe(3);
    });

    it('should display content of active file only', () => {
      const files = [
        makeFile({ id: 'f1', name: 'file1.ts', content: 'file1 content' }),
        makeFile({ id: 'f2', name: 'file2.ts', content: 'file2 content' }),
      ];
      renderEditor({ files, activeFileId: 'f2' });
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('file2 content');
    });

    it('should switch displayed content when activeFileId changes', () => {
      const files = [
        makeFile({ id: 'f1', name: 'file1.ts', content: 'content-one' }),
        makeFile({ id: 'f2', name: 'file2.ts', content: 'content-two' }),
      ];
      const { rerender } = render(
        <CodeLabEditor {...defaultProps({ files, activeFileId: 'f1' })} />
      );
      expect(screen.getByRole('textbox')).toHaveValue('content-one');
      rerender(<CodeLabEditor {...defaultProps({ files, activeFileId: 'f2' })} />);
      expect(screen.getByRole('textbox')).toHaveValue('content-two');
    });
  });

  // --------------------------------------------------------------------------
  // THEME VARIATIONS
  // --------------------------------------------------------------------------

  describe('Theme Variations', () => {
    it('should apply light theme class by default', () => {
      const { container } = renderEditor();
      expect(container.querySelector('.code-lab-editor')).toHaveClass('light');
    });

    it('should apply dark theme class when specified', () => {
      const { container } = renderEditor({ theme: 'dark' });
      expect(container.querySelector('.code-lab-editor')).toHaveClass('dark');
    });

    it('should switch theme on rerender', () => {
      const { container, rerender } = render(
        <CodeLabEditor {...defaultProps({ theme: 'light' })} />
      );
      expect(container.querySelector('.code-lab-editor')).toHaveClass('light');
      rerender(<CodeLabEditor {...defaultProps({ theme: 'dark' })} />);
      expect(container.querySelector('.code-lab-editor')).toHaveClass('dark');
    });
  });

  // --------------------------------------------------------------------------
  // EDGE CASES
  // --------------------------------------------------------------------------

  describe('Edge Cases', () => {
    it('should handle null activeFileId', () => {
      const { container } = renderEditor({ activeFileId: null });
      expect(container.querySelector('.code-lab-editor')).toBeInTheDocument();
    });

    it('should handle empty file content', () => {
      renderEditor({
        files: [makeFile({ content: '' })],
      });
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('');
    });

    it('should handle single character content', () => {
      renderEditor({
        files: [makeFile({ content: 'a' })],
      });
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('a');
    });

    it('should handle very long single line content', () => {
      const longContent = 'a'.repeat(10000);
      renderEditor({
        files: [makeFile({ content: longContent })],
      });
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue(longContent);
    });

    it('should handle file path with leading slash', () => {
      const { container } = renderEditor({
        files: [makeFile({ path: '/root/src/file.ts' })],
      });
      // Leading slash produces empty first segment which is filtered out
      const breadcrumbs = container.querySelector('.editor-breadcrumbs');
      expect(breadcrumbs).toBeInTheDocument();
    });

    it('should handle file with special characters in name', () => {
      renderEditor({
        files: [makeFile({ name: 'my-component.test.tsx' })],
      });
      expect(screen.getByText('my-component.test.tsx')).toBeInTheDocument();
    });

    it('should handle multiple pending changes for same file', () => {
      renderEditor({
        pendingChanges: [
          {
            path: 'src/utils/helpers.ts',
            hunks: [makeHunk({ id: 'h1' }), makeHunk({ id: 'h2' }), makeHunk({ id: 'h3' })],
          },
        ],
      });
      expect(screen.getByText('3 pending changes')).toBeInTheDocument();
    });

    it('should handle activeFileId that does not match any file', () => {
      renderEditor({
        files: [makeFile()],
        activeFileId: 'does-not-exist',
      });
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('');
    });

    it('should render correctly with a single file', () => {
      const { container } = renderEditor({
        files: [makeFile()],
      });
      const tabs = container.querySelectorAll('.editor-tab');
      expect(tabs.length).toBe(1);
    });
  });
});
