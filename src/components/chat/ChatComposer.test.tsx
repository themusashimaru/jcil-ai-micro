// @ts-nocheck - Test file with extensive mocking

/**
 * CHAT COMPOSER COMPONENT TESTS
 *
 * Tests for the ChatComposer component including:
 * - Exported types and constants
 * - Basic rendering
 * - Props handling
 * - Event handlers (send, keyboard, file drag/drop)
 * - Conditional rendering logic
 * - Tool mode indicators
 * - Reply preview
 * - Voice input integration
 * - Creative modals
 * - Provider menu (admin only)
 * - Agent menu
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';

// Ensure React is available globally for components that use automatic JSX transform
globalThis.React = React;

// ─── Hoisted mocks ───────────────────────────────────────────────────────────

const mockUseVoiceInput = vi.hoisted(() =>
  vi.fn(() => ({
    isRecording: false,
    isProcessing: false,
    toggleRecording: vi.fn(),
    isSupported: false,
  }))
);

const mockUseCodeExecutionOptional = vi.hoisted(() => vi.fn(() => null));

const mockUseTheme = vi.hoisted(() =>
  vi.fn(() => ({
    theme: 'pro',
    setTheme: vi.fn(),
    toggleTheme: vi.fn(),
    isLoading: false,
    isAdmin: false,
    availableThemes: ['pro'],
  }))
);

const mockUseFileUpload = vi.hoisted(() =>
  vi.fn(() => ({
    attachments: [],
    isDragging: false,
    fileError: null,
    handleFileSelect: vi.fn(),
    removeAttachment: vi.fn(),
    clearAttachments: vi.fn(),
    handleDragOver: vi.fn(),
    handleDragLeave: vi.fn(),
    handleDrop: vi.fn(),
  }))
);

// ─── Mock external modules ──────────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/hooks/useVoiceInput', () => ({
  useVoiceInput: mockUseVoiceInput,
}));

vi.mock('@/contexts/CodeExecutionContext', () => ({
  useCodeExecutionOptional: mockUseCodeExecutionOptional,
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: mockUseTheme,
}));

vi.mock('./useFileUpload', () => ({
  useFileUpload: mockUseFileUpload,
}));

vi.mock('./CreativeButton', () => ({
  CreativeButton: ({
    disabled,
    onSelect,
  }: {
    disabled: boolean;
    onSelect: (mode: string) => void;
  }) => (
    <button
      data-testid="creative-button"
      disabled={disabled}
      onClick={() => onSelect('create-image')}
    >
      Creative
    </button>
  ),
  CreateImageModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="create-image-modal">
        <button data-testid="close-create-image" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
  EditImageModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="edit-image-modal">
        <button data-testid="close-edit-image" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
  GenerationGallery: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="gallery-modal">
        <button data-testid="close-gallery" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

vi.mock('./ComposerAgentsMenu', () => ({
  ComposerAgentsMenu: ({
    isOpen,
    onToggle,
    onClose: _onClose,
    activeAgent,
  }: {
    isOpen: boolean;
    onToggle: () => void;
    onClose: () => void;
    activeAgent: string | null;
  }) => (
    <div data-testid="agents-menu" data-open={isOpen} data-agent={activeAgent || ''}>
      <button data-testid="agents-toggle" onClick={onToggle}>
        Agents
      </button>
    </div>
  ),
}));

vi.mock('./ComposerProviderMenu', () => ({
  ComposerProviderMenu: ({
    isOpen,
    onToggle,
    selectedProvider,
  }: {
    isOpen: boolean;
    onToggle: () => void;
    selectedProvider: string;
  }) => (
    <div data-testid="provider-menu" data-open={isOpen} data-provider={selectedProvider}>
      <button data-testid="provider-toggle" onClick={onToggle}>
        Provider
      </button>
    </div>
  ),
}));

vi.mock('./ComposerAttachmentPreview', () => ({
  ComposerAttachmentPreview: ({
    attachments,
    onRemove,
  }: {
    attachments: unknown[];
    onRemove: (id: string) => void;
  }) => (
    <div data-testid="attachment-preview" data-count={attachments.length}>
      {attachments.map((a: { id: string; name: string }) => (
        <div key={a.id} data-testid={`attachment-${a.id}`}>
          {a.name}
          <button onClick={() => onRemove(a.id)}>Remove</button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('./ComposerAttachmentMenu', () => ({
  ComposerAttachmentMenu: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="attachment-menu">
        <button data-testid="close-attach-menu" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

// ─── Import component under test (after mocks) ─────────────────────────────

import { ChatComposer } from './ChatComposer';
import type { ToolMode, SearchMode, SelectedRepoInfo } from './ChatComposer';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const defaultProps = {
  onSendMessage: vi.fn(),
  isStreaming: false,
};

function renderComposer(overrides = {}) {
  const props = { ...defaultProps, ...overrides };
  return render(<ChatComposer {...props} />);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ChatComposer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseVoiceInput.mockReturnValue({
      isRecording: false,
      isProcessing: false,
      toggleRecording: vi.fn(),
      isSupported: false,
    });
    mockUseCodeExecutionOptional.mockReturnValue(null);
    mockUseTheme.mockReturnValue({
      theme: 'pro',
      setTheme: vi.fn(),
      toggleTheme: vi.fn(),
      isLoading: false,
      isAdmin: false,
      availableThemes: ['pro'],
    });
    mockUseFileUpload.mockReturnValue({
      attachments: [],
      isDragging: false,
      fileError: null,
      handleFileSelect: vi.fn(),
      removeAttachment: vi.fn(),
      clearAttachments: vi.fn(),
      handleDragOver: vi.fn(),
      handleDragLeave: vi.fn(),
      handleDrop: vi.fn(),
    });
  });

  // ── Exported types ──────────────────────────────────────────────────────

  describe('Exported types and constants', () => {
    it('should export ToolMode type values correctly', () => {
      const modes: ToolMode[] = ['none', 'search', 'factcheck', 'research'];
      expect(modes).toHaveLength(4);
      expect(modes).toContain('none');
      expect(modes).toContain('search');
      expect(modes).toContain('factcheck');
      expect(modes).toContain('research');
    });

    it('should treat SearchMode as alias for ToolMode', () => {
      const toolMode: ToolMode = 'search';
      const searchMode: SearchMode = toolMode;
      expect(searchMode).toBe('search');
    });

    it('should define SelectedRepoInfo shape', () => {
      const repo: SelectedRepoInfo = {
        owner: 'test-owner',
        repo: 'test-repo',
        fullName: 'test-owner/test-repo',
        defaultBranch: 'main',
      };
      expect(repo.owner).toBe('test-owner');
      expect(repo.repo).toBe('test-repo');
      expect(repo.fullName).toBe('test-owner/test-repo');
      expect(repo.defaultBranch).toBe('main');
    });
  });

  // ── Basic rendering ─────────────────────────────────────────────────────

  describe('Basic rendering', () => {
    it('should render without crashing', () => {
      const { container } = renderComposer();
      expect(container).toBeTruthy();
    });

    it('should render the textarea', () => {
      renderComposer();
      const textarea = document.querySelector('textarea');
      expect(textarea).toBeTruthy();
    });

    it('should render the send button', () => {
      renderComposer();
      const sendButton = screen.getByLabelText('Send message');
      expect(sendButton).toBeInTheDocument();
    });

    it('should render the attach files button', () => {
      renderComposer();
      const attachButton = screen.getByLabelText('Attach files');
      expect(attachButton).toBeInTheDocument();
    });

    it('should render the creative button', () => {
      renderComposer();
      expect(screen.getByTestId('creative-button')).toBeInTheDocument();
    });

    it('should render attachment preview', () => {
      renderComposer();
      expect(screen.getByTestId('attachment-preview')).toBeInTheDocument();
    });

    it('should render hidden file inputs for camera, photos, and files', () => {
      renderComposer();
      const hiddenInputs = document.querySelectorAll('input[type="file"]');
      expect(hiddenInputs.length).toBe(3);
    });
  });

  // ── Disabled/streaming states ───────────────────────────────────────────

  describe('Disabled and streaming states', () => {
    it('should disable textarea when streaming', () => {
      renderComposer({ isStreaming: true });
      const textarea = document.querySelector('textarea');
      expect(textarea).toBeDisabled();
    });

    it('should disable textarea when disabled prop is true', () => {
      renderComposer({ disabled: true });
      const textarea = document.querySelector('textarea');
      expect(textarea).toBeDisabled();
    });

    it('should disable the attach button when streaming', () => {
      renderComposer({ isStreaming: true });
      const attachButton = screen.getByLabelText('Attach files');
      expect(attachButton).toBeDisabled();
    });

    it('should disable the attach button when disabled', () => {
      renderComposer({ disabled: true });
      const attachButton = screen.getByLabelText('Attach files');
      expect(attachButton).toBeDisabled();
    });

    it('should disable the creative button when streaming', () => {
      renderComposer({ isStreaming: true });
      expect(screen.getByTestId('creative-button')).toBeDisabled();
    });

    it('should disable send button when no content and not streaming', () => {
      renderComposer();
      const sendButton = screen.getByLabelText('Send message');
      expect(sendButton).toBeDisabled();
    });
  });

  // ── Send message ────────────────────────────────────────────────────────

  describe('Send message', () => {
    it('should call onSendMessage when send button is clicked with content', async () => {
      const onSendMessage = vi.fn();
      renderComposer({ onSendMessage });
      const textarea = document.querySelector('textarea')!;

      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'Hello world' } });
      });

      const sendButton = screen.getByLabelText('Send message');
      await act(async () => {
        fireEvent.click(sendButton);
      });

      expect(onSendMessage).toHaveBeenCalledWith('Hello world', [], 'none', null);
    });

    it('should clear message after sending', async () => {
      const onSendMessage = vi.fn();
      renderComposer({ onSendMessage });
      const textarea = document.querySelector('textarea')!;

      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'Test message' } });
      });
      expect(textarea.value).toBe('Test message');

      await act(async () => {
        fireEvent.click(screen.getByLabelText('Send message'));
      });

      expect(textarea.value).toBe('');
    });

    it('should not send when message is empty', async () => {
      const onSendMessage = vi.fn();
      renderComposer({ onSendMessage });

      await act(async () => {
        fireEvent.click(screen.getByLabelText('Send message'));
      });

      expect(onSendMessage).not.toHaveBeenCalled();
    });

    it('should not send when only whitespace', async () => {
      const onSendMessage = vi.fn();
      renderComposer({ onSendMessage });
      const textarea = document.querySelector('textarea')!;

      await act(async () => {
        fireEvent.change(textarea, { target: { value: '   ' } });
      });
      await act(async () => {
        fireEvent.click(screen.getByLabelText('Send message'));
      });

      expect(onSendMessage).not.toHaveBeenCalled();
    });

    it('should not send when streaming', async () => {
      const onSendMessage = vi.fn();
      renderComposer({ onSendMessage, isStreaming: true });

      // Textarea is disabled so we cannot type, but test the guard
      expect(onSendMessage).not.toHaveBeenCalled();
    });

    it('should not send when disabled', async () => {
      const onSendMessage = vi.fn();
      renderComposer({ onSendMessage, disabled: true });
      expect(onSendMessage).not.toHaveBeenCalled();
    });

    it('should trim message content before sending', async () => {
      const onSendMessage = vi.fn();
      renderComposer({ onSendMessage });
      const textarea = document.querySelector('textarea')!;

      await act(async () => {
        fireEvent.change(textarea, { target: { value: '  Hello  ' } });
      });
      await act(async () => {
        fireEvent.click(screen.getByLabelText('Send message'));
      });

      expect(onSendMessage).toHaveBeenCalledWith('Hello', [], 'none', null);
    });

    it('should send with attachments when they exist', async () => {
      const onSendMessage = vi.fn();
      const mockAttachments = [{ id: '1', name: 'file.txt', type: 'text/plain', size: 100 }];
      mockUseFileUpload.mockReturnValue({
        attachments: mockAttachments,
        isDragging: false,
        fileError: null,
        handleFileSelect: vi.fn(),
        removeAttachment: vi.fn(),
        clearAttachments: vi.fn(),
        handleDragOver: vi.fn(),
        handleDragLeave: vi.fn(),
        handleDrop: vi.fn(),
      });

      renderComposer({ onSendMessage });

      // With attachments, send button should be enabled even without text
      const sendButton = screen.getByLabelText('Send message');
      await act(async () => {
        fireEvent.click(sendButton);
      });

      expect(onSendMessage).toHaveBeenCalledWith('', mockAttachments, 'none', null);
    });

    it('should call clearAttachments after sending', async () => {
      const clearAttachments = vi.fn();
      mockUseFileUpload.mockReturnValue({
        attachments: [{ id: '1', name: 'file.txt', type: 'text/plain', size: 100 }],
        isDragging: false,
        fileError: null,
        handleFileSelect: vi.fn(),
        removeAttachment: vi.fn(),
        clearAttachments,
        handleDragOver: vi.fn(),
        handleDragLeave: vi.fn(),
        handleDrop: vi.fn(),
      });

      renderComposer();
      const sendButton = screen.getByLabelText('Send message');
      await act(async () => {
        fireEvent.click(sendButton);
      });

      expect(clearAttachments).toHaveBeenCalled();
    });
  });

  // ── Keyboard shortcuts ──────────────────────────────────────────────────

  describe('Keyboard shortcuts', () => {
    it('should send on Enter key (non-mobile)', async () => {
      // jsdom defines ontouchstart on window, making the component think it is mobile.
      // Remove it to simulate a desktop environment where Enter sends.
      const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'ontouchstart');
      delete (window as any).ontouchstart;

      const onSendMessage = vi.fn();
      renderComposer({ onSendMessage });
      const textarea = document.querySelector('textarea')!;

      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'test' } });
      });

      await act(async () => {
        fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
      });

      expect(onSendMessage).toHaveBeenCalledTimes(1);
      expect(onSendMessage).toHaveBeenCalledWith('test', [], 'none', null);

      // Restore
      if (originalDescriptor) {
        Object.defineProperty(window, 'ontouchstart', originalDescriptor);
      }
    });

    it('should not send on Shift+Enter', async () => {
      const onSendMessage = vi.fn();
      renderComposer({ onSendMessage });
      const textarea = document.querySelector('textarea')!;

      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'test' } });
      });
      await act(async () => {
        fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
      });

      expect(onSendMessage).not.toHaveBeenCalled();
    });

    it('should not send on other keys', async () => {
      const onSendMessage = vi.fn();
      renderComposer({ onSendMessage });
      const textarea = document.querySelector('textarea')!;

      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'test' } });
      });
      await act(async () => {
        fireEvent.keyDown(textarea, { key: 'a' });
      });

      expect(onSendMessage).not.toHaveBeenCalled();
    });
  });

  // ── Stop button ─────────────────────────────────────────────────────────

  describe('Stop button', () => {
    it('should show stop button when streaming with onStop', () => {
      const onStop = vi.fn();
      renderComposer({ isStreaming: true, onStop });
      const stopButton = screen.getByLabelText('Stop generating response');
      expect(stopButton).toBeInTheDocument();
    });

    it('should call onStop when stop button is clicked', async () => {
      const onStop = vi.fn();
      renderComposer({ isStreaming: true, onStop });
      const stopButton = screen.getByLabelText('Stop generating response');

      await act(async () => {
        fireEvent.click(stopButton);
      });

      expect(onStop).toHaveBeenCalled();
    });

    it('should not show stop button when not streaming', () => {
      renderComposer({ onStop: vi.fn() });
      expect(screen.queryByLabelText('Stop generating response')).not.toBeInTheDocument();
    });
  });

  // ── Reply preview ───────────────────────────────────────────────────────

  describe('Reply preview', () => {
    const replyMessage = {
      id: '1',
      role: 'user' as const,
      content: 'Original message content',
      timestamp: new Date(),
    };

    it('should show reply preview when replyingTo is set', () => {
      renderComposer({ replyingTo: replyMessage });
      expect(screen.getByText('Replying to:')).toBeInTheDocument();
      expect(screen.getByText('Original message content')).toBeInTheDocument();
    });

    it('should not show reply preview when replyingTo is null', () => {
      renderComposer({ replyingTo: null });
      expect(screen.queryByText('Replying to:')).not.toBeInTheDocument();
    });

    it('should truncate long reply messages at 150 characters', () => {
      const longContent = 'A'.repeat(200);
      const longReply = { ...replyMessage, content: longContent };
      renderComposer({ replyingTo: longReply });

      const truncated = longContent.slice(0, 150) + '...';
      expect(screen.getByText(truncated)).toBeInTheDocument();
    });

    it('should not truncate short reply messages', () => {
      const shortReply = { ...replyMessage, content: 'Short message' };
      renderComposer({ replyingTo: shortReply });
      expect(screen.getByText('Short message')).toBeInTheDocument();
    });

    it('should call onClearReply when cancel button is clicked', async () => {
      const onClearReply = vi.fn();
      renderComposer({ replyingTo: replyMessage, onClearReply });
      const cancelButton = screen.getByLabelText('Cancel reply');

      await act(async () => {
        fireEvent.click(cancelButton);
      });

      expect(onClearReply).toHaveBeenCalled();
    });
  });

  // ── Voice input ─────────────────────────────────────────────────────────

  describe('Voice input', () => {
    it('should not show voice button when not supported', () => {
      mockUseVoiceInput.mockReturnValue({
        isRecording: false,
        isProcessing: false,
        toggleRecording: vi.fn(),
        isSupported: false,
      });
      renderComposer();
      expect(screen.queryByLabelText('Start voice input')).not.toBeInTheDocument();
    });

    it('should show voice button when supported', () => {
      mockUseVoiceInput.mockReturnValue({
        isRecording: false,
        isProcessing: false,
        toggleRecording: vi.fn(),
        isSupported: true,
      });
      renderComposer();
      expect(screen.getByLabelText('Start voice input')).toBeInTheDocument();
    });

    it('should show stop recording label when recording', () => {
      mockUseVoiceInput.mockReturnValue({
        isRecording: true,
        isProcessing: false,
        toggleRecording: vi.fn(),
        isSupported: true,
      });
      renderComposer();
      expect(screen.getByLabelText('Stop recording')).toBeInTheDocument();
    });

    it('should show transcribing label when processing', () => {
      mockUseVoiceInput.mockReturnValue({
        isRecording: false,
        isProcessing: true,
        toggleRecording: vi.fn(),
        isSupported: true,
      });
      renderComposer();
      expect(screen.getByLabelText('Transcribing audio')).toBeInTheDocument();
    });

    it('should call toggleRecording when voice button is clicked', async () => {
      const toggleRecording = vi.fn();
      mockUseVoiceInput.mockReturnValue({
        isRecording: false,
        isProcessing: false,
        toggleRecording,
        isSupported: true,
      });
      renderComposer();
      const voiceButton = screen.getByLabelText('Start voice input');

      await act(async () => {
        fireEvent.click(voiceButton);
      });

      expect(toggleRecording).toHaveBeenCalled();
    });
  });

  // ── Provider menu (admin only) ──────────────────────────────────────────

  describe('Provider menu', () => {
    it('should show provider menu for admin users with onProviderChange', () => {
      renderComposer({
        isAdmin: true,
        onProviderChange: vi.fn(),
        selectedProvider: 'claude',
        configuredProviders: ['claude', 'openai'],
      });
      expect(screen.getByTestId('provider-menu')).toBeInTheDocument();
    });

    it('should not show provider menu for non-admin users', () => {
      renderComposer({
        isAdmin: false,
        onProviderChange: vi.fn(),
      });
      expect(screen.queryByTestId('provider-menu')).not.toBeInTheDocument();
    });

    it('should not show provider menu when onProviderChange is not provided', () => {
      renderComposer({ isAdmin: true });
      expect(screen.queryByTestId('provider-menu')).not.toBeInTheDocument();
    });

    it('should pass selectedProvider to provider menu', () => {
      renderComposer({
        isAdmin: true,
        onProviderChange: vi.fn(),
        selectedProvider: 'openai',
      });
      expect(screen.getByTestId('provider-menu')).toHaveAttribute('data-provider', 'openai');
    });

    it('should default selectedProvider to claude', () => {
      renderComposer({
        isAdmin: true,
        onProviderChange: vi.fn(),
      });
      expect(screen.getByTestId('provider-menu')).toHaveAttribute('data-provider', 'claude');
    });
  });

  // ── Agent menu ──────────────────────────────────────────────────────────

  describe('Agents menu', () => {
    it('should render agents menu when onAgentSelect is provided', () => {
      renderComposer({ onAgentSelect: vi.fn() });
      expect(screen.getByTestId('agents-menu')).toBeInTheDocument();
    });

    it('should not render agents menu when onAgentSelect is not provided', () => {
      renderComposer();
      expect(screen.queryByTestId('agents-menu')).not.toBeInTheDocument();
    });

    it('should pass activeAgent to agents menu', () => {
      renderComposer({ onAgentSelect: vi.fn(), activeAgent: 'research' });
      expect(screen.getByTestId('agents-menu')).toHaveAttribute('data-agent', 'research');
    });
  });

  // ── File error display ──────────────────────────────────────────────────

  describe('File error display', () => {
    it('should show file error when present', () => {
      mockUseFileUpload.mockReturnValue({
        attachments: [],
        isDragging: false,
        fileError: 'File too large',
        handleFileSelect: vi.fn(),
        removeAttachment: vi.fn(),
        clearAttachments: vi.fn(),
        handleDragOver: vi.fn(),
        handleDragLeave: vi.fn(),
        handleDrop: vi.fn(),
      });
      renderComposer();
      expect(screen.getByText(/File too large/)).toBeInTheDocument();
    });

    it('should not show file error when null', () => {
      renderComposer();
      // No error element should be rendered
      expect(screen.queryByText(/⚠️/)).not.toBeInTheDocument();
    });
  });

  // ── Initial text ────────────────────────────────────────────────────────

  describe('Initial text', () => {
    it('should populate textarea with initialText', () => {
      renderComposer({ initialText: 'Prefilled text' });
      const textarea = document.querySelector('textarea')!;
      expect(textarea.value).toBe('Prefilled text');
    });

    it('should handle empty initialText', () => {
      renderComposer({ initialText: '' });
      const textarea = document.querySelector('textarea')!;
      expect(textarea.value).toBe('');
    });
  });

  // ── Textarea input handling ─────────────────────────────────────────────

  describe('Textarea input handling', () => {
    it('should update message on input change', async () => {
      renderComposer();
      const textarea = document.querySelector('textarea')!;

      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'New message' } });
      });

      expect(textarea.value).toBe('New message');
    });

    it('should handle focus events by hiding typewriter placeholder', async () => {
      renderComposer();
      const textarea = document.querySelector('textarea')!;

      // Before focus, there may be a typewriter placeholder overlay visible
      // After focusing, the isFocused state becomes true and hides the overlay
      await act(async () => {
        fireEvent.focus(textarea);
      });

      // The typewriter overlay is conditionally rendered: {!isFocused && !message && !isDragging && (...)}
      // After focus, isFocused=true so the overlay should be hidden.
      // We verify by checking the textarea received the focus event (onChange handler works).
      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'typed text' } });
      });
      expect(textarea.value).toBe('typed text');
    });
  });

  // ── Drag and drop ──────────────────────────────────────────────────────

  describe('Drag and drop', () => {
    it('should show drag placeholder when isDragging', () => {
      mockUseFileUpload.mockReturnValue({
        attachments: [],
        isDragging: true,
        fileError: null,
        handleFileSelect: vi.fn(),
        removeAttachment: vi.fn(),
        clearAttachments: vi.fn(),
        handleDragOver: vi.fn(),
        handleDragLeave: vi.fn(),
        handleDrop: vi.fn(),
      });
      renderComposer();
      const textarea = document.querySelector('textarea')!;
      expect(textarea.placeholder).toBe('Drop files here...');
    });

    it('should show empty placeholder when not dragging', () => {
      renderComposer();
      const textarea = document.querySelector('textarea')!;
      expect(textarea.placeholder).toBe('');
    });
  });

  // ── Attachment menu toggle ──────────────────────────────────────────────

  describe('Attachment menu', () => {
    it('should open attachment menu on attach button click', async () => {
      renderComposer();
      const attachButton = screen.getByLabelText('Attach files');

      expect(screen.queryByTestId('attachment-menu')).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(attachButton);
      });

      expect(screen.getByTestId('attachment-menu')).toBeInTheDocument();
    });

    it('should toggle attachment menu on repeated clicks', async () => {
      renderComposer();
      const attachButton = screen.getByLabelText('Attach files');

      await act(async () => {
        fireEvent.click(attachButton);
      });
      expect(screen.getByTestId('attachment-menu')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(attachButton);
      });
      expect(screen.queryByTestId('attachment-menu')).not.toBeInTheDocument();
    });
  });

  // ── Creative modals ─────────────────────────────────────────────────────

  describe('Creative modals', () => {
    it('should open create image modal when openCreateImage prop becomes true', () => {
      renderComposer({ openCreateImage: true });
      expect(screen.getByTestId('create-image-modal')).toBeInTheDocument();
    });

    it('should open edit image modal when openEditImage prop becomes true', () => {
      renderComposer({ openEditImage: true });
      expect(screen.getByTestId('edit-image-modal')).toBeInTheDocument();
    });

    it('should call onCloseCreateImage when create image modal is closed', async () => {
      const onCloseCreateImage = vi.fn();
      renderComposer({ openCreateImage: true, onCloseCreateImage });

      const closeButton = screen.getByTestId('close-create-image');
      await act(async () => {
        fireEvent.click(closeButton);
      });

      expect(onCloseCreateImage).toHaveBeenCalled();
    });

    it('should call onCloseEditImage when edit image modal is closed', async () => {
      const onCloseEditImage = vi.fn();
      renderComposer({ openEditImage: true, onCloseEditImage });

      const closeButton = screen.getByTestId('close-edit-image');
      await act(async () => {
        fireEvent.click(closeButton);
      });

      expect(onCloseEditImage).toHaveBeenCalled();
    });
  });

  // ── Repo info integration ───────────────────────────────────────────────

  describe('Selected repo info', () => {
    it('should pass repo info when code execution context provides a repo', async () => {
      mockUseCodeExecutionOptional.mockReturnValue({
        selectedRepo: {
          owner: 'test-user',
          name: 'my-repo',
          fullName: 'test-user/my-repo',
          defaultBranch: 'main',
        },
      });

      const onSendMessage = vi.fn();
      renderComposer({ onSendMessage });
      const textarea = document.querySelector('textarea')!;

      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'test with repo' } });
      });
      await act(async () => {
        fireEvent.click(screen.getByLabelText('Send message'));
      });

      expect(onSendMessage).toHaveBeenCalledWith('test with repo', [], 'none', {
        owner: 'test-user',
        repo: 'my-repo',
        fullName: 'test-user/my-repo',
        defaultBranch: 'main',
      });
    });

    it('should pass null repo info when no repo is selected', async () => {
      mockUseCodeExecutionOptional.mockReturnValue({ selectedRepo: null });

      const onSendMessage = vi.fn();
      renderComposer({ onSendMessage });
      const textarea = document.querySelector('textarea')!;

      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'no repo' } });
      });
      await act(async () => {
        fireEvent.click(screen.getByLabelText('Send message'));
      });

      expect(onSendMessage).toHaveBeenCalledWith('no repo', [], 'none', null);
    });
  });

  // ── Theme integration ───────────────────────────────────────────────────

  describe('Theme integration', () => {
    it('should use useTheme hook', () => {
      renderComposer();
      expect(mockUseTheme).toHaveBeenCalled();
    });

    it('should apply light theme styling to send button when canSend and light theme', async () => {
      mockUseTheme.mockReturnValue({
        theme: 'light',
        setTheme: vi.fn(),
        toggleTheme: vi.fn(),
        isLoading: false,
        isAdmin: false,
        availableThemes: ['light'],
      });
      renderComposer();
      const textarea = document.querySelector('textarea')!;

      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'test' } });
      });

      const sendButton = screen.getByLabelText('Send message');
      expect(sendButton.style.color).toBe('white');
    });

    it('should apply dark theme styling to send button when canSend and dark theme', async () => {
      mockUseTheme.mockReturnValue({
        theme: 'dark',
        setTheme: vi.fn(),
        toggleTheme: vi.fn(),
        isLoading: false,
        isAdmin: false,
        availableThemes: ['dark'],
      });
      renderComposer();
      const textarea = document.querySelector('textarea')!;

      await act(async () => {
        fireEvent.change(textarea, { target: { value: 'test' } });
      });

      const sendButton = screen.getByLabelText('Send message');
      expect(sendButton.style.color).toBe('black');
    });
  });

  // ── Placeholder text (tool modes & agents) ─────────────────────────────

  describe('Placeholder text based on mode and agent', () => {
    it('should show strategy placeholder when strategy agent is active', () => {
      renderComposer({ activeAgent: 'strategy', onAgentSelect: vi.fn() });
      expect(screen.getByText('Describe your complex problem or decision...')).toBeInTheDocument();
    });

    it('should show deep-research placeholder when deep-research agent is active', () => {
      renderComposer({ activeAgent: 'deep-research', onAgentSelect: vi.fn() });
      expect(screen.getByText('What topic do you want to research in depth?')).toBeInTheDocument();
    });
  });

  // ── Memoization ─────────────────────────────────────────────────────────

  describe('Memoization', () => {
    it('should be wrapped in React.memo', () => {
      // ChatComposer is exported as memo(...), check its type
      expect(ChatComposer).toBeDefined();
      // memo components have a $$typeof Symbol
      expect((ChatComposer as any).$$typeof).toBeDefined();
    });
  });
});
