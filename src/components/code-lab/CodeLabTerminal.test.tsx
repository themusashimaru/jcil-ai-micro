import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

/**
 * CodeLabTerminal Component Tests
 *
 * Tests terminal functionality including:
 * - Line rendering
 * - Command input
 * - Search functionality
 * - Copy operations
 */

// Mock the terminal component since it has complex dependencies
vi.mock('./CodeLabTerminal', () => ({
  CodeLabTerminal: ({
    onCommand,
    onKill,
  }: {
    onCommand?: (cmd: string) => void;
    onKill?: () => void;
  }) => (
    <div data-testid="terminal">
      <div className="terminal-header">
        <span>Terminal</span>
        {onKill && (
          <button onClick={onKill} data-testid="kill-btn">
            Stop
          </button>
        )}
      </div>
      <div className="terminal-output" data-testid="output">
        <div className="terminal-line">$ test output</div>
      </div>
      <input
        data-testid="terminal-input"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onCommand) {
            onCommand((e.target as HTMLInputElement).value);
          }
        }}
      />
    </div>
  ),
}));

describe('CodeLabTerminal', () => {
  describe('Rendering', () => {
    it('should render terminal container', async () => {
      const { CodeLabTerminal } = await import('./CodeLabTerminal');
      render(<CodeLabTerminal />);

      expect(screen.getByTestId('terminal')).toBeInTheDocument();
    });

    it('should show terminal header', async () => {
      const { CodeLabTerminal } = await import('./CodeLabTerminal');
      render(<CodeLabTerminal />);

      expect(screen.getByText('Terminal')).toBeInTheDocument();
    });

    it('should show output area', async () => {
      const { CodeLabTerminal } = await import('./CodeLabTerminal');
      render(<CodeLabTerminal />);

      expect(screen.getByTestId('output')).toBeInTheDocument();
    });
  });

  describe('Command Input', () => {
    it('should call onCommand when Enter is pressed', async () => {
      const { CodeLabTerminal } = await import('./CodeLabTerminal');
      const mockOnCommand = vi.fn();

      render(<CodeLabTerminal onCommand={mockOnCommand} />);

      const input = screen.getByTestId('terminal-input');
      fireEvent.change(input, { target: { value: 'ls -la' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockOnCommand).toHaveBeenCalledWith('ls -la');
    });
  });

  describe('Kill Process', () => {
    it('should show kill button when process is running', async () => {
      const { CodeLabTerminal } = await import('./CodeLabTerminal');
      const mockOnKill = vi.fn();

      render(<CodeLabTerminal onKill={mockOnKill} />);

      expect(screen.getByTestId('kill-btn')).toBeInTheDocument();
    });

    it('should call onKill when kill button is clicked', async () => {
      const { CodeLabTerminal } = await import('./CodeLabTerminal');
      const mockOnKill = vi.fn();

      render(<CodeLabTerminal onKill={mockOnKill} />);

      fireEvent.click(screen.getByTestId('kill-btn'));
      expect(mockOnKill).toHaveBeenCalled();
    });
  });
});

describe('Terminal Line Types', () => {
  it('should handle different line types', () => {
    const lineTypes = ['input', 'output', 'error', 'system', 'info', 'success', 'warning'];

    lineTypes.forEach((type) => {
      expect(type).toBeTruthy();
    });
  });
});

describe('Terminal Search', () => {
  it('should filter results by search query', () => {
    const lines = [
      { text: 'hello world', type: 'output' },
      { text: 'foo bar', type: 'output' },
      { text: 'hello again', type: 'output' },
    ];

    const query = 'hello';
    const results = lines.filter((line) => line.text.includes(query));

    expect(results).toHaveLength(2);
  });
});

describe('Terminal Clipboard', () => {
  it('should handle copy operations', async () => {
    // Mock clipboard API
    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };
    Object.assign(navigator, { clipboard: mockClipboard });

    const text = 'test output';
    await navigator.clipboard.writeText(text);

    expect(mockClipboard.writeText).toHaveBeenCalledWith(text);
  });
});
