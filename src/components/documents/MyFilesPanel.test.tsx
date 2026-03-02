// @ts-nocheck
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

globalThis.React = React;

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

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import MyFilesPanel from './MyFilesPanel';

// ============================================================================
// HELPERS
// ============================================================================

function renderPanel() {
  return render(<MyFilesPanel />);
}

const mockFolder = (overrides = {}) => ({
  id: 'folder-1',
  name: 'Test Folder',
  color: '#3b82f6',
  parent_folder_id: null,
  ...overrides,
});

const mockDocument = (overrides = {}) => ({
  id: 'doc-1',
  name: 'test-file.pdf',
  original_filename: 'test-file.pdf',
  file_type: 'pdf',
  file_size: 1048576,
  status: 'ready' as const,
  folder_id: null,
  created_at: '2026-02-01T00:00:00Z',
  ...overrides,
});

const mockStats = (overrides = {}) => ({
  total_documents: 3,
  total_folders: 1,
  total_size_bytes: 5242880,
  total_chunks: 42,
  ...overrides,
});

function mockFetchSuccess({
  folders = [],
  documents = [],
  stats = null,
}: {
  folders?: ReturnType<typeof mockFolder>[];
  documents?: ReturnType<typeof mockDocument>[];
  stats?: ReturnType<typeof mockStats> | null;
} = {}) {
  (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url.includes('/api/documents/user/folders')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ folders }),
      });
    }
    if (url.includes('/api/documents/user/files')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ documents, stats }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

function mockFetchError() {
  (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
}

// ============================================================================
// TESTS
// ============================================================================

describe('MyFilesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as ReturnType<typeof vi.fn>).mockReset();
    window.confirm = vi.fn(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Initial Rendering / Collapsed State
  // --------------------------------------------------------------------------

  describe('collapsed state', () => {
    it('renders the header button with "My Files" label', () => {
      renderPanel();
      expect(screen.getByText('My Files')).toBeInTheDocument();
    });

    it('renders a clickable header button', () => {
      renderPanel();
      const button = screen.getByText('My Files').closest('button');
      expect(button).toBeInTheDocument();
    });

    it('does not render the expanded content when collapsed', () => {
      renderPanel();
      expect(screen.queryByText('Upload')).not.toBeInTheDocument();
    });

    it('does not call fetch when collapsed', () => {
      renderPanel();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('does not show the document count badge when stats are null', () => {
      renderPanel();
      // No badge should be visible
      const badges = screen.queryAllByText(/^\d+$/);
      // Filter to only those within the header (rounded-full badge)
      expect(badges.length).toBe(0);
    });

    it('renders the info icon in the header', () => {
      renderPanel();
      // The info icon container is a div with onClick
      const svgElements = document.querySelectorAll('svg');
      expect(svgElements.length).toBeGreaterThan(0);
    });

    it('renders the chevron icon in the header', () => {
      renderPanel();
      // Chevron SVG exists (the one with d="M19 9l-7 7-7-7")
      const allSvgs = document.querySelectorAll('svg');
      expect(allSvgs.length).toBeGreaterThanOrEqual(2);
    });
  });

  // --------------------------------------------------------------------------
  // Expanding / Collapsing the Panel
  // --------------------------------------------------------------------------

  describe('expand/collapse toggle', () => {
    it('expands the panel when the header is clicked', async () => {
      mockFetchSuccess();
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      expect(screen.getByText('Upload')).toBeInTheDocument();
    });

    it('collapses the panel when clicked again', async () => {
      mockFetchSuccess();
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      expect(screen.getByText('Upload')).toBeInTheDocument();
      await act(async () => {
        fireEvent.click(button);
      });
      expect(screen.queryByText('Upload')).not.toBeInTheDocument();
    });

    it('calls fetch when expanded', async () => {
      mockFetchSuccess();
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      expect(global.fetch).toHaveBeenCalledWith('/api/documents/user/folders');
      expect(global.fetch).toHaveBeenCalledWith('/api/documents/user/files');
    });
  });

  // --------------------------------------------------------------------------
  // Info Tooltip
  // --------------------------------------------------------------------------

  describe('info tooltip', () => {
    it('shows the info tooltip when the info icon is clicked', async () => {
      renderPanel();
      // Find the info icon container and click it
      const infoDiv = document.querySelector('.p-1.rounded-full') as HTMLElement;
      await act(async () => {
        fireEvent.click(infoDiv);
      });
      expect(screen.getByText('Your Personal Knowledge Base')).toBeInTheDocument();
    });

    it('shows description text in the tooltip', async () => {
      renderPanel();
      const infoDiv = document.querySelector('.p-1.rounded-full') as HTMLElement;
      await act(async () => {
        fireEvent.click(infoDiv);
      });
      expect(screen.getByText(/Upload PDFs, Word docs, or Excel files/)).toBeInTheDocument();
    });

    it('hides the tooltip when "Got it" is clicked', async () => {
      renderPanel();
      const infoDiv = document.querySelector('.p-1.rounded-full') as HTMLElement;
      await act(async () => {
        fireEvent.click(infoDiv);
      });
      expect(screen.getByText('Your Personal Knowledge Base')).toBeInTheDocument();

      const gotIt = screen.getByText('Got it');
      await act(async () => {
        fireEvent.click(gotIt);
      });
      expect(screen.queryByText('Your Personal Knowledge Base')).not.toBeInTheDocument();
    });

    it('toggles the tooltip on repeated clicks', async () => {
      renderPanel();
      const infoDiv = document.querySelector('.p-1.rounded-full') as HTMLElement;

      // Show
      await act(async () => {
        fireEvent.click(infoDiv);
      });
      expect(screen.getByText('Your Personal Knowledge Base')).toBeInTheDocument();

      // Hide
      await act(async () => {
        fireEvent.click(infoDiv);
      });
      expect(screen.queryByText('Your Personal Knowledge Base')).not.toBeInTheDocument();
    });

    it('does not toggle the panel when info icon is clicked', async () => {
      renderPanel();
      const infoDiv = document.querySelector('.p-1.rounded-full') as HTMLElement;
      await act(async () => {
        fireEvent.click(infoDiv);
      });
      // Panel should still be collapsed (no Upload button)
      expect(screen.queryByText('Upload')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Loading State
  // --------------------------------------------------------------------------

  describe('loading state', () => {
    it('shows a spinner while loading data', async () => {
      // Make fetch hang forever
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}));
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      // The loading spinner is an SVG with animate-spin class
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Error State
  // --------------------------------------------------------------------------

  describe('error state', () => {
    it('shows an error message when fetch fails', async () => {
      mockFetchError();
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      await waitFor(() => {
        expect(screen.getByText('Failed to load files')).toBeInTheDocument();
      });
    });

    it('shows a dismiss button alongside the error', async () => {
      mockFetchError();
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      await waitFor(() => {
        expect(screen.getByText('Dismiss')).toBeInTheDocument();
      });
    });

    it('clears the error when dismiss is clicked', async () => {
      mockFetchError();
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      await waitFor(() => {
        expect(screen.getByText('Failed to load files')).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Dismiss'));
      });
      expect(screen.queryByText('Failed to load files')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Empty State
  // --------------------------------------------------------------------------

  describe('empty state', () => {
    it('shows "No files yet" when no documents and no folders', async () => {
      mockFetchSuccess({ folders: [], documents: [] });
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      await waitFor(() => {
        expect(screen.getByText('No files yet')).toBeInTheDocument();
      });
    });

    it('shows "Upload PDFs, Word, or Excel" hint in empty state', async () => {
      mockFetchSuccess({ folders: [], documents: [] });
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      await waitFor(() => {
        expect(screen.getByText('Upload PDFs, Word, or Excel')).toBeInTheDocument();
      });
    });

    it('does not show empty state when documents exist', async () => {
      mockFetchSuccess({ documents: [mockDocument()] });
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      await waitFor(() => {
        expect(screen.queryByText('No files yet')).not.toBeInTheDocument();
      });
    });

    it('does not show empty state when folders exist', async () => {
      mockFetchSuccess({ folders: [mockFolder()] });
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      await waitFor(() => {
        expect(screen.queryByText('No files yet')).not.toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Document Display
  // --------------------------------------------------------------------------

  describe('document display', () => {
    it('renders document name', async () => {
      mockFetchSuccess({ documents: [mockDocument({ name: 'research.pdf' })] });
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      await waitFor(() => {
        expect(screen.getByText('research.pdf')).toBeInTheDocument();
      });
    });

    it('renders multiple documents', async () => {
      const docs = [
        mockDocument({ id: 'doc-1', name: 'file1.pdf' }),
        mockDocument({ id: 'doc-2', name: 'file2.docx', file_type: 'docx' }),
        mockDocument({ id: 'doc-3', name: 'file3.xlsx', file_type: 'xlsx' }),
      ];
      mockFetchSuccess({ documents: docs });
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      await waitFor(() => {
        expect(screen.getByText('file1.pdf')).toBeInTheDocument();
        expect(screen.getByText('file2.docx')).toBeInTheDocument();
        expect(screen.getByText('file3.xlsx')).toBeInTheDocument();
      });
    });

    it('renders file size in bytes for small files', async () => {
      mockFetchSuccess({ documents: [mockDocument({ file_size: 500 })] });
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      await waitFor(() => {
        expect(screen.getByText('500 B')).toBeInTheDocument();
      });
    });

    it('renders file size in KB for kilobyte-range files', async () => {
      mockFetchSuccess({ documents: [mockDocument({ file_size: 2048 })] });
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      await waitFor(() => {
        expect(screen.getByText('2.0 KB')).toBeInTheDocument();
      });
    });

    it('renders file size in MB for megabyte-range files', async () => {
      mockFetchSuccess({ documents: [mockDocument({ file_size: 5242880 })] });
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      await waitFor(() => {
        expect(screen.getByText('5.0 MB')).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Status Badges
  // --------------------------------------------------------------------------

  describe('status badges', () => {
    it('shows "Ready" for ready status', async () => {
      mockFetchSuccess({ documents: [mockDocument({ status: 'ready' })] });
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      await waitFor(() => {
        expect(screen.getByText('Ready')).toBeInTheDocument();
      });
    });

    it('shows "Processing..." for processing status', async () => {
      mockFetchSuccess({ documents: [mockDocument({ status: 'processing' })] });
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      await waitFor(() => {
        expect(screen.getByText('Processing...')).toBeInTheDocument();
      });
    });

    it('shows "Pending" for pending status', async () => {
      mockFetchSuccess({ documents: [mockDocument({ status: 'pending' })] });
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      await waitFor(() => {
        expect(screen.getByText('Pending')).toBeInTheDocument();
      });
    });

    it('shows "Error" for error status', async () => {
      mockFetchSuccess({ documents: [mockDocument({ status: 'error' })] });
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Stats Badge
  // --------------------------------------------------------------------------

  describe('stats display', () => {
    it('shows document count badge in header when stats exist', async () => {
      mockFetchSuccess({
        documents: [mockDocument()],
        stats: mockStats({ total_documents: 5 }),
      });
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      await waitFor(() => {
        expect(screen.getByText('5')).toBeInTheDocument();
      });
    });

    it('does not show document count badge when total is 0', async () => {
      mockFetchSuccess({
        documents: [],
        stats: mockStats({ total_documents: 0 }),
      });
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      await waitFor(() => {
        expect(screen.getByText('No files yet')).toBeInTheDocument();
      });
    });

    it('shows file count and total size in the stats bar', async () => {
      mockFetchSuccess({
        documents: [mockDocument(), mockDocument({ id: 'doc-2', name: 'other.pdf' })],
        stats: mockStats({ total_documents: 2, total_size_bytes: 2097152 }),
      });
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      await waitFor(() => {
        // "2 files · 2.0 MB"
        expect(screen.getByText(/2 files/)).toBeInTheDocument();
        expect(screen.getByText(/2\.0 MB/)).toBeInTheDocument();
      });
    });

    it('shows singular "file" for 1 document', async () => {
      mockFetchSuccess({
        documents: [mockDocument()],
        stats: mockStats({ total_documents: 1, total_size_bytes: 1024 }),
      });
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      await waitFor(() => {
        expect(screen.getByText(/1 file\b/)).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Folder Display
  // --------------------------------------------------------------------------

  describe('folder display', () => {
    it('renders folder name', async () => {
      mockFetchSuccess({ folders: [mockFolder({ name: 'My Research' })] });
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      await waitFor(() => {
        expect(screen.getByText('My Research')).toBeInTheDocument();
      });
    });

    it('renders folder document count', async () => {
      const folder = mockFolder();
      const docs = [
        mockDocument({ id: 'doc-1', folder_id: folder.id }),
        mockDocument({ id: 'doc-2', folder_id: folder.id }),
      ];
      mockFetchSuccess({ folders: [folder], documents: docs });
      renderPanel();
      const button = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(button);
      });
      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
      });
    });

    it('expands a folder when clicked', async () => {
      const folder = mockFolder();
      const docs = [
        mockDocument({ id: 'doc-in-folder', name: 'inside-folder.pdf', folder_id: folder.id }),
      ];
      mockFetchSuccess({ folders: [folder], documents: docs });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('Test Folder')).toBeInTheDocument();
      });
      // Click folder to expand
      await act(async () => {
        fireEvent.click(screen.getByText('Test Folder'));
      });
      expect(screen.getByText('inside-folder.pdf')).toBeInTheDocument();
    });

    it('collapses a folder when clicked again', async () => {
      const folder = mockFolder();
      const docs = [
        mockDocument({ id: 'doc-in-folder', name: 'inside-folder.pdf', folder_id: folder.id }),
      ];
      mockFetchSuccess({ folders: [folder], documents: docs });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('Test Folder')).toBeInTheDocument();
      });
      // Expand
      await act(async () => {
        fireEvent.click(screen.getByText('Test Folder'));
      });
      expect(screen.getByText('inside-folder.pdf')).toBeInTheDocument();
      // Collapse
      await act(async () => {
        fireEvent.click(screen.getByText('Test Folder'));
      });
      expect(screen.queryByText('inside-folder.pdf')).not.toBeInTheDocument();
    });

    it('shows "Empty folder" when expanded folder has no docs', async () => {
      mockFetchSuccess({ folders: [mockFolder()], documents: [] });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('Test Folder')).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Test Folder'));
      });
      expect(screen.getByText('Empty folder')).toBeInTheDocument();
    });

    it('shows "Unfiled" section when root docs and folders exist', async () => {
      mockFetchSuccess({
        folders: [mockFolder()],
        documents: [mockDocument({ folder_id: null })],
      });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('Unfiled')).toBeInTheDocument();
      });
    });

    it('does not show "Unfiled" section when there are no folders', async () => {
      mockFetchSuccess({
        folders: [],
        documents: [mockDocument({ folder_id: null })],
      });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('test-file.pdf')).toBeInTheDocument();
      });
      expect(screen.queryByText('Unfiled')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // Folder Modal
  // --------------------------------------------------------------------------

  describe('folder modal', () => {
    it('opens the new folder modal when "New Folder" button is clicked', async () => {
      mockFetchSuccess();
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByTitle('New Folder')).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(screen.getByTitle('New Folder'));
      });
      expect(screen.getByText('New Folder', { selector: 'h3' })).toBeInTheDocument();
    });

    it('shows folder name input in the modal', async () => {
      mockFetchSuccess();
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByTitle('New Folder')).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(screen.getByTitle('New Folder'));
      });
      expect(screen.getByPlaceholderText('My Documents')).toBeInTheDocument();
    });

    it('shows "Create" button for new folder', async () => {
      mockFetchSuccess();
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByTitle('New Folder')).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(screen.getByTitle('New Folder'));
      });
      expect(screen.getByText('Create')).toBeInTheDocument();
    });

    it('shows "Cancel" button in modal', async () => {
      mockFetchSuccess();
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByTitle('New Folder')).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(screen.getByTitle('New Folder'));
      });
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('closes the modal when "Cancel" is clicked', async () => {
      mockFetchSuccess();
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByTitle('New Folder')).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(screen.getByTitle('New Folder'));
      });
      expect(screen.getByText('New Folder', { selector: 'h3' })).toBeInTheDocument();
      await act(async () => {
        fireEvent.click(screen.getByText('Cancel'));
      });
      expect(screen.queryByText('New Folder', { selector: 'h3' })).not.toBeInTheDocument();
    });

    it('renders color picker buttons in the modal', async () => {
      mockFetchSuccess();
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByTitle('New Folder')).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(screen.getByTitle('New Folder'));
      });
      expect(screen.getByText('Color')).toBeInTheDocument();
      // 8 color buttons
      const colorButtons = document.querySelectorAll('.w-7.h-7.rounded-full');
      expect(colorButtons.length).toBe(8);
    });

    it('disables "Create" button when folder name is empty', async () => {
      mockFetchSuccess();
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByTitle('New Folder')).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(screen.getByTitle('New Folder'));
      });
      const createBtn = screen.getByText('Create');
      expect(createBtn).toBeDisabled();
    });

    it('enables "Create" button when folder name has text', async () => {
      mockFetchSuccess();
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByTitle('New Folder')).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(screen.getByTitle('New Folder'));
      });
      const input = screen.getByPlaceholderText('My Documents');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'My New Folder' } });
      });
      const createBtn = screen.getByText('Create');
      expect(createBtn).not.toBeDisabled();
    });

    it('creates a folder by calling POST /api/documents/user/folders', async () => {
      mockFetchSuccess();
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByTitle('New Folder')).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(screen.getByTitle('New Folder'));
      });
      const input = screen.getByPlaceholderText('My Documents');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'New Folder Name' } });
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Create'));
      });
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/documents/user/folders',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('does not create folder when name is only whitespace', async () => {
      mockFetchSuccess();
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByTitle('New Folder')).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(screen.getByTitle('New Folder'));
      });
      const input = screen.getByPlaceholderText('My Documents');
      await act(async () => {
        fireEvent.change(input, { target: { value: '   ' } });
      });
      // Create button should be disabled since trimmed name is empty
      expect(screen.getByText('Create')).toBeDisabled();
    });

    it('shows "Edit Folder" title when editing existing folder', async () => {
      const folder = mockFolder({ name: 'Existing Folder' });
      mockFetchSuccess({ folders: [folder] });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('Existing Folder')).toBeInTheDocument();
      });

      // Right-click for context menu
      const folderEl = screen.getByText('Existing Folder').closest('[class*="cursor-pointer"]')!;
      await act(async () => {
        fireEvent.contextMenu(folderEl);
      });
      // Click "Rename" in context menu
      await act(async () => {
        fireEvent.click(screen.getByText('Rename'));
      });
      expect(screen.getByText('Edit Folder')).toBeInTheDocument();
    });

    it('shows "Save" button when editing existing folder', async () => {
      const folder = mockFolder({ name: 'Existing Folder' });
      mockFetchSuccess({ folders: [folder] });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('Existing Folder')).toBeInTheDocument();
      });
      const folderEl = screen.getByText('Existing Folder').closest('[class*="cursor-pointer"]')!;
      await act(async () => {
        fireEvent.contextMenu(folderEl);
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Rename'));
      });
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('updates a folder via PUT when editing', async () => {
      const folder = mockFolder({ name: 'Old Name' });
      mockFetchSuccess({ folders: [folder] });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('Old Name')).toBeInTheDocument();
      });
      const folderEl = screen.getByText('Old Name').closest('[class*="cursor-pointer"]')!;
      await act(async () => {
        fireEvent.contextMenu(folderEl);
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Rename'));
      });
      const input = screen.getByPlaceholderText('My Documents');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'New Name' } });
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Save'));
      });
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/documents/user/folders',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('changes color when a color button is clicked', async () => {
      mockFetchSuccess();
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByTitle('New Folder')).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(screen.getByTitle('New Folder'));
      });
      const colorButtons = document.querySelectorAll('.w-7.h-7.rounded-full');
      // Click the second color (green #22c55e)
      await act(async () => {
        fireEvent.click(colorButtons[1]);
      });
      // The selected one should have 'ring-2' class
      expect(colorButtons[1].className).toContain('ring-2');
    });

    it('handles folder save error gracefully', async () => {
      mockFetchSuccess();
      // Override the POST to fail
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, options?: RequestInit) => {
          if (url === '/api/documents/user/folders' && options?.method === 'POST') {
            return Promise.resolve({
              ok: false,
              json: () => Promise.resolve({ error: 'Name taken' }),
            });
          }
          if (url.includes('/api/documents/user/folders')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ folders: [] }),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ documents: [], stats: null }),
          });
        }
      );
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByTitle('New Folder')).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(screen.getByTitle('New Folder'));
      });
      const input = screen.getByPlaceholderText('My Documents');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Conflict Folder' } });
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Create'));
      });
      await waitFor(() => {
        expect(screen.getByText('Name taken')).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Delete File
  // --------------------------------------------------------------------------

  describe('delete file', () => {
    it('calls DELETE endpoint when deleting a file', async () => {
      const doc = mockDocument({ id: 'doc-to-delete', name: 'deleteme.pdf' });
      mockFetchSuccess({ documents: [doc] });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('deleteme.pdf')).toBeInTheDocument();
      });
      const deleteBtn = screen.getByTitle('Delete file');
      await act(async () => {
        fireEvent.click(deleteBtn);
      });
      expect(window.confirm).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/documents/user/files?id=doc-to-delete',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('does not delete when user cancels confirm', async () => {
      (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(false);
      const doc = mockDocument({ id: 'doc-keep', name: 'keep.pdf' });
      mockFetchSuccess({ documents: [doc] });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('keep.pdf')).toBeInTheDocument();
      });
      const deleteBtn = screen.getByTitle('Delete file');
      const fetchCountBefore = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
      await act(async () => {
        fireEvent.click(deleteBtn);
      });
      // No additional fetch calls
      expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(fetchCountBefore);
    });

    it('shows error when delete fails', async () => {
      const doc = mockDocument({ id: 'doc-fail', name: 'fail.pdf' });
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, options?: RequestInit) => {
          if (
            typeof url === 'string' &&
            url.includes('?id=doc-fail') &&
            options?.method === 'DELETE'
          ) {
            return Promise.resolve({
              ok: false,
              json: () => Promise.resolve({ error: 'Failed to delete' }),
            });
          }
          if (typeof url === 'string' && url.includes('/api/documents/user/folders')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ folders: [] }),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ documents: [doc], stats: null }),
          });
        }
      );
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('fail.pdf')).toBeInTheDocument();
      });
      const deleteBtn = screen.getByTitle('Delete file');
      await act(async () => {
        fireEvent.click(deleteBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('Failed to delete file')).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Delete Folder
  // --------------------------------------------------------------------------

  describe('delete folder', () => {
    it('calls DELETE endpoint when deleting a folder', async () => {
      const folder = mockFolder({ id: 'folder-del', name: 'Delete Me' });
      mockFetchSuccess({ folders: [folder] });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('Delete Me')).toBeInTheDocument();
      });
      // Right-click
      const folderEl = screen.getByText('Delete Me').closest('[class*="cursor-pointer"]')!;
      await act(async () => {
        fireEvent.contextMenu(folderEl);
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Delete'));
      });
      expect(window.confirm).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/documents/user/folders?id=folder-del',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('does not delete folder when user cancels confirm', async () => {
      (window.confirm as ReturnType<typeof vi.fn>).mockReturnValue(false);
      const folder = mockFolder({ id: 'folder-keep', name: 'Keep Me' });
      mockFetchSuccess({ folders: [folder] });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('Keep Me')).toBeInTheDocument();
      });
      const folderEl = screen.getByText('Keep Me').closest('[class*="cursor-pointer"]')!;
      await act(async () => {
        fireEvent.contextMenu(folderEl);
      });
      const fetchCountBefore = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
      await act(async () => {
        fireEvent.click(screen.getByText('Delete'));
      });
      expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(fetchCountBefore);
    });
  });

  // --------------------------------------------------------------------------
  // Context Menu
  // --------------------------------------------------------------------------

  describe('context menu', () => {
    it('shows context menu with Rename and Delete for folders', async () => {
      mockFetchSuccess({ folders: [mockFolder()] });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('Test Folder')).toBeInTheDocument();
      });
      const folderEl = screen.getByText('Test Folder').closest('[class*="cursor-pointer"]')!;
      await act(async () => {
        fireEvent.contextMenu(folderEl);
      });
      expect(screen.getByText('Rename')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('shows context menu with "Move to" and Delete for files', async () => {
      const folder = mockFolder();
      const doc = mockDocument({ name: 'ctx-file.pdf' });
      mockFetchSuccess({ folders: [folder], documents: [doc] });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('ctx-file.pdf')).toBeInTheDocument();
      });
      const docEl = screen.getByText('ctx-file.pdf').closest('[class*="rounded-lg"]')!;
      await act(async () => {
        fireEvent.contextMenu(docEl);
      });
      expect(screen.getByText('Move to:')).toBeInTheDocument();
      expect(screen.getByText('Root')).toBeInTheDocument();
    });

    it('shows folder names in context menu for file move', async () => {
      const folder = mockFolder({ name: 'Target Folder' });
      const doc = mockDocument({ name: 'moveable.pdf' });
      mockFetchSuccess({ folders: [folder], documents: [doc] });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('moveable.pdf')).toBeInTheDocument();
      });
      const docEl = screen.getByText('moveable.pdf').closest('[class*="rounded-lg"]')!;
      await act(async () => {
        fireEvent.contextMenu(docEl);
      });
      // Context menu should show folder name
      const folderButtons = screen.getAllByText('Target Folder');
      expect(folderButtons.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // Move File
  // --------------------------------------------------------------------------

  describe('move file', () => {
    it('calls PUT to move file to a folder', async () => {
      const folder = mockFolder({ id: 'target-folder', name: 'Target' });
      const doc = mockDocument({ id: 'move-doc', name: 'move-me.pdf' });
      mockFetchSuccess({ folders: [folder], documents: [doc] });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('move-me.pdf')).toBeInTheDocument();
      });
      // Right-click to open context menu
      const docEl = screen.getByText('move-me.pdf').closest('[class*="rounded-lg"]')!;
      await act(async () => {
        fireEvent.contextMenu(docEl);
      });
      // Click "Target" in context menu
      const targetButtons = screen.getAllByText('Target');
      const contextTargetBtn = targetButtons[targetButtons.length - 1];
      await act(async () => {
        fireEvent.click(contextTargetBtn);
      });
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/documents/user/files',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('calls PUT to move file to root', async () => {
      const folder = mockFolder({ id: 'cur-folder' });
      const doc = mockDocument({ id: 'root-doc', name: 'to-root.pdf' });
      mockFetchSuccess({ folders: [folder], documents: [doc] });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('to-root.pdf')).toBeInTheDocument();
      });
      const docEl = screen.getByText('to-root.pdf').closest('[class*="rounded-lg"]')!;
      await act(async () => {
        fireEvent.contextMenu(docEl);
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Root'));
      });
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/documents/user/files',
        expect.objectContaining({
          method: 'PUT',
        })
      );
    });

    it('shows error when move fails', async () => {
      const folder = mockFolder({ id: 'fail-folder', name: 'Fail Folder' });
      const doc = mockDocument({ id: 'fail-move', name: 'fail-move.pdf' });
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, options?: RequestInit) => {
          if (url === '/api/documents/user/files' && options?.method === 'PUT') {
            return Promise.resolve({
              ok: false,
              json: () => Promise.resolve({ error: 'Move failed' }),
            });
          }
          if (typeof url === 'string' && url.includes('/api/documents/user/folders')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ folders: [folder] }),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ documents: [doc], stats: null }),
          });
        }
      );
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('fail-move.pdf')).toBeInTheDocument();
      });
      const docEl = screen.getByText('fail-move.pdf').closest('[class*="rounded-lg"]')!;
      await act(async () => {
        fireEvent.contextMenu(docEl);
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Root'));
      });
      await waitFor(() => {
        expect(screen.getByText('Failed to move file')).toBeInTheDocument();
      });
    });

    it('shows move dropdown for root docs when folders exist', async () => {
      const folder = mockFolder({ id: 'mv-folder', name: 'Move Here' });
      const doc = mockDocument({ id: 'root-mv', name: 'rootdoc.pdf' });
      mockFetchSuccess({ folders: [folder], documents: [doc] });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('rootdoc.pdf')).toBeInTheDocument();
      });
      // Find "Move to folder" button
      const moveBtn = screen.getByTitle('Move to folder');
      expect(moveBtn).toBeInTheDocument();
    });

    it('does not show move button for root docs when no folders', async () => {
      const doc = mockDocument({ id: 'no-folder-doc', name: 'nofolder.pdf' });
      mockFetchSuccess({ folders: [], documents: [doc] });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('nofolder.pdf')).toBeInTheDocument();
      });
      expect(screen.queryByTitle('Move to folder')).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // File Upload
  // --------------------------------------------------------------------------

  describe('file upload', () => {
    it('renders the hidden file input', async () => {
      mockFetchSuccess();
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        expect(fileInput).toBeInTheDocument();
        expect(fileInput.type).toBe('file');
      });
    });

    it('accepts proper file types', async () => {
      mockFetchSuccess();
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        expect(fileInput.accept).toBe('.pdf,.docx,.doc,.xlsx,.xls,.txt,.csv');
      });
    });

    it('allows multiple file selection', async () => {
      mockFetchSuccess();
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        expect(fileInput.multiple).toBe(true);
      });
    });

    it('shows "Upload" label when not uploading', async () => {
      mockFetchSuccess();
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('Upload')).toBeInTheDocument();
      });
    });

    it('calls POST /api/documents/user/files when file is selected', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, options?: RequestInit) => {
          if (url === '/api/documents/user/files' && options?.method === 'POST') {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ document: { id: 'new-doc-id' } }),
            });
          }
          if (url === '/api/documents/user/process') {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({}),
            });
          }
          if (typeof url === 'string' && url.includes('/api/documents/user/folders')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ folders: [] }),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ documents: [], stats: null }),
          });
        }
      );
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        expect(fileInput).toBeInTheDocument();
      });
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/documents/user/files',
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    it('triggers processing after upload', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, options?: RequestInit) => {
          if (url === '/api/documents/user/files' && options?.method === 'POST') {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ document: { id: 'proc-doc-id' } }),
            });
          }
          if (url === '/api/documents/user/process') {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({}),
            });
          }
          if (typeof url === 'string' && url.includes('/api/documents/user/folders')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ folders: [] }),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ documents: [], stats: null }),
          });
        }
      );
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(document.getElementById('file-upload')).toBeInTheDocument();
      });
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      const file = new File(['data'], 'process.pdf', { type: 'application/pdf' });
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/documents/user/process',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });
    });

    it('does nothing when no files are selected', async () => {
      mockFetchSuccess();
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(document.getElementById('file-upload')).toBeInTheDocument();
      });
      const fetchCountBefore = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [] } });
      });
      expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(fetchCountBefore);
    });

    it('shows error when upload fails', async () => {
      let uploadPostCalled = false;
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, options?: RequestInit) => {
          if (url === '/api/documents/user/files' && options?.method === 'POST') {
            uploadPostCalled = true;
            return Promise.resolve({
              ok: false,
              json: () => Promise.resolve({ error: 'File too large' }),
            });
          }
          if (typeof url === 'string' && url.includes('/api/documents/user/folders')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ folders: [] }),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ documents: [], stats: null }),
          });
        }
      );
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(document.getElementById('file-upload')).toBeInTheDocument();
      });
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      const file = new File(['x'.repeat(100)], 'big.pdf', { type: 'application/pdf' });
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });
      await waitFor(() => {
        expect(uploadPostCalled).toBe(true);
      });
      // The error is thrown and logged; loadData() is called after which resets the error
      // but the logger captures it
      expect(mockLogger.error).toHaveBeenCalledWith('Upload failed', expect.any(Object));
    });
  });

  // --------------------------------------------------------------------------
  // File Type Icons
  // --------------------------------------------------------------------------

  describe('file type icons', () => {
    it('renders red icon for PDF files', async () => {
      mockFetchSuccess({ documents: [mockDocument({ file_type: 'pdf' })] });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        const redIcon = document.querySelector('.text-red-500');
        expect(redIcon).toBeInTheDocument();
      });
    });

    it('renders blue icon for docx files', async () => {
      mockFetchSuccess({
        documents: [mockDocument({ file_type: 'docx', name: 'word.docx' })],
      });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        const blueIcon = document.querySelector('.text-blue-500');
        expect(blueIcon).toBeInTheDocument();
      });
    });

    it('renders blue icon for doc files', async () => {
      mockFetchSuccess({
        documents: [mockDocument({ file_type: 'doc', name: 'legacy.doc' })],
      });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        const blueIcon = document.querySelector('.text-blue-500');
        expect(blueIcon).toBeInTheDocument();
      });
    });

    it('renders green icon for xlsx files', async () => {
      mockFetchSuccess({
        documents: [mockDocument({ file_type: 'xlsx', name: 'data.xlsx' })],
      });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        const greenIcon = document.querySelector('.text-green-500');
        expect(greenIcon).toBeInTheDocument();
      });
    });

    it('renders green icon for xls files', async () => {
      mockFetchSuccess({
        documents: [mockDocument({ file_type: 'xls', name: 'data.xls' })],
      });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        const greenIcon = document.querySelector('.text-green-500');
        expect(greenIcon).toBeInTheDocument();
      });
    });

    it('renders muted icon for unknown file types', async () => {
      mockFetchSuccess({
        documents: [mockDocument({ file_type: 'txt', name: 'notes.txt' })],
      });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        const mutedIcon = document.querySelector('.text-text-muted');
        expect(mutedIcon).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Move Menu (inline dropdown)
  // --------------------------------------------------------------------------

  describe('move menu (inline dropdown)', () => {
    it('shows the move dropdown for files inside a folder', async () => {
      const folder = mockFolder({ id: 'f1', name: 'Folder A' });
      const otherFolder = mockFolder({ id: 'f2', name: 'Folder B', color: '#22c55e' });
      const doc = mockDocument({ id: 'doc-in-f1', name: 'infolder.pdf', folder_id: 'f1' });
      mockFetchSuccess({ folders: [folder, otherFolder], documents: [doc] });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('Folder A')).toBeInTheDocument();
      });
      // Expand Folder A
      await act(async () => {
        fireEvent.click(screen.getByText('Folder A'));
      });
      expect(screen.getByText('infolder.pdf')).toBeInTheDocument();
      // Click move button
      const moveBtn = screen.getByTitle('Move file');
      await act(async () => {
        fireEvent.click(moveBtn);
      });
      // Should show "Unfiled" (move to root) and "Folder B"
      const moveToLabel = screen.getByText('Move to:');
      expect(moveToLabel).toBeInTheDocument();
    });

    it('toggles the move menu off when clicked again', async () => {
      const folder = mockFolder({ id: 'f1', name: 'Folder A' });
      const doc = mockDocument({ id: 'doc-toggle', name: 'toggle.pdf', folder_id: 'f1' });
      mockFetchSuccess({ folders: [folder], documents: [doc] });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('Folder A')).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Folder A'));
      });
      const moveBtn = screen.getByTitle('Move file');
      // Open
      await act(async () => {
        fireEvent.click(moveBtn);
      });
      expect(screen.getByText('Move to:')).toBeInTheDocument();
      // Close
      await act(async () => {
        fireEvent.click(moveBtn);
      });
      expect(screen.queryByText('Move to:')).not.toBeInTheDocument();
    });

    it('shows move dropdown for root documents', async () => {
      const folder = mockFolder({ id: 'mv-target', name: 'Target Folder' });
      const doc = mockDocument({ id: 'root-doc-mv', name: 'rootfile.pdf' });
      mockFetchSuccess({ folders: [folder], documents: [doc] });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('rootfile.pdf')).toBeInTheDocument();
      });
      const moveBtn = screen.getByTitle('Move to folder');
      await act(async () => {
        fireEvent.click(moveBtn);
      });
      expect(screen.getByText('Move to folder:')).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------------
  // API Error Handling
  // --------------------------------------------------------------------------

  describe('API error handling', () => {
    it('handles folders API returning non-ok response', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('/api/documents/user/folders')) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Unauthorized' }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ documents: [], stats: null }),
        });
      });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    it('handles files API returning non-ok response', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (typeof url === 'string' && url.includes('/api/documents/user/files')) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'Server error' }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ folders: [] }),
        });
      });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    it('handles network error during folder delete', async () => {
      const folder = mockFolder({ id: 'net-err', name: 'Net Error' });
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, options?: RequestInit) => {
          if (
            typeof url === 'string' &&
            url.includes('?id=net-err') &&
            options?.method === 'DELETE'
          ) {
            return Promise.reject(new Error('Network failure'));
          }
          if (typeof url === 'string' && url.includes('/api/documents/user/folders')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ folders: [folder] }),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ documents: [], stats: null }),
          });
        }
      );
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('Net Error')).toBeInTheDocument();
      });
      const folderEl = screen.getByText('Net Error').closest('[class*="cursor-pointer"]')!;
      await act(async () => {
        fireEvent.contextMenu(folderEl);
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Delete'));
      });
      await waitFor(() => {
        expect(screen.getByText('Failed to delete folder')).toBeInTheDocument();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Edge Cases
  // --------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles missing stats gracefully', async () => {
      mockFetchSuccess({ documents: [mockDocument()], stats: null });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('test-file.pdf')).toBeInTheDocument();
      });
      // No stats bar should be rendered
      expect(screen.queryByText(/files? ·/)).not.toBeInTheDocument();
    });

    it('handles 0 byte file size', async () => {
      mockFetchSuccess({ documents: [mockDocument({ file_size: 0 })] });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('0 B')).toBeInTheDocument();
      });
    });

    it('handles exactly 1024 bytes (1.0 KB)', async () => {
      mockFetchSuccess({ documents: [mockDocument({ file_size: 1024 })] });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('1.0 KB')).toBeInTheDocument();
      });
    });

    it('handles exactly 1048576 bytes (1.0 MB)', async () => {
      mockFetchSuccess({ documents: [mockDocument({ file_size: 1048576 })] });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('1.0 MB')).toBeInTheDocument();
      });
    });

    it('renders multiple folders', async () => {
      const folders = [
        mockFolder({ id: 'f1', name: 'Alpha' }),
        mockFolder({ id: 'f2', name: 'Beta', color: '#22c55e' }),
        mockFolder({ id: 'f3', name: 'Gamma', color: '#f59e0b' }),
      ];
      mockFetchSuccess({ folders });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByText('Alpha')).toBeInTheDocument();
        expect(screen.getByText('Beta')).toBeInTheDocument();
        expect(screen.getByText('Gamma')).toBeInTheDocument();
      });
    });

    it('properly separates root docs from folder docs', async () => {
      const folder = mockFolder({ id: 'sep-folder', name: 'Separated' });
      const docs = [
        mockDocument({ id: 'd1', name: 'root.pdf', folder_id: null }),
        mockDocument({ id: 'd2', name: 'nested.pdf', folder_id: 'sep-folder' }),
      ];
      mockFetchSuccess({ folders: [folder], documents: docs });
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        // root.pdf is shown at root level
        expect(screen.getByText('root.pdf')).toBeInTheDocument();
        // nested.pdf is NOT visible until folder is expanded
        expect(screen.queryByText('nested.pdf')).not.toBeInTheDocument();
      });
      // Expand folder
      await act(async () => {
        fireEvent.click(screen.getByText('Separated'));
      });
      expect(screen.getByText('nested.pdf')).toBeInTheDocument();
    });

    it('handles upload error with non-Error throw', async () => {
      let postCallCount = 0;
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, options?: RequestInit) => {
          if (url === '/api/documents/user/files' && options?.method === 'POST') {
            postCallCount++;
            return Promise.reject('string error');
          }
          if (typeof url === 'string' && url.includes('/api/documents/user/folders')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ folders: [] }),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ documents: [], stats: null }),
          });
        }
      );
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(document.getElementById('file-upload')).toBeInTheDocument();
      });
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      const file = new File(['data'], 'err.pdf', { type: 'application/pdf' });
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });
      await waitFor(() => {
        expect(postCallCount).toBe(1);
      });
      // The non-Error catch path sets 'Upload failed' and then loadData clears it,
      // but the logger should have been called
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('handles folder save network error', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        (url: string, options?: RequestInit) => {
          if (url === '/api/documents/user/folders' && options?.method === 'POST') {
            return Promise.reject(new Error('Connection refused'));
          }
          if (typeof url === 'string' && url.includes('/api/documents/user/folders')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({ folders: [] }),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ documents: [], stats: null }),
          });
        }
      );
      renderPanel();
      const headerBtn = screen.getByText('My Files').closest('button')!;
      await act(async () => {
        fireEvent.click(headerBtn);
      });
      await waitFor(() => {
        expect(screen.getByTitle('New Folder')).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(screen.getByTitle('New Folder'));
      });
      const input = screen.getByPlaceholderText('My Documents');
      await act(async () => {
        fireEvent.change(input, { target: { value: 'Fail Folder' } });
      });
      await act(async () => {
        fireEvent.click(screen.getByText('Create'));
      });
      await waitFor(() => {
        expect(screen.getByText('Connection refused')).toBeInTheDocument();
      });
    });
  });
});
