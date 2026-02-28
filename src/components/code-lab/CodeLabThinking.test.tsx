// @ts-nocheck - Test file with extensive mocking
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

globalThis.React = React;

// jsdom doesn't have scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

import { CodeLabThinking } from './CodeLabThinking';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStep(overrides = {}) {
  return {
    id: 'step-1',
    type: 'analysis' as const,
    content: 'Analyzing the request',
    confidence: 85,
    timestamp: 1000,
    duration: 200,
    tokens: 150,
    ...overrides,
  };
}

function makeSession(overrides = {}) {
  return {
    id: 'session-1',
    startTime: 1000,
    endTime: 5000,
    totalTokens: 500,
    steps: [makeStep()],
    confidence: 85,
    ...overrides,
  };
}

function renderThinking(props = {}) {
  const defaults = {
    session: null,
    isStreaming: false,
    ...props,
  };
  return render(<CodeLabThinking {...defaults} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CodeLabThinking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // No session (empty state)
  // =========================================================================

  describe('empty state', () => {
    it('should render without crashing when no session', () => {
      const { container } = renderThinking();
      expect(container).toBeTruthy();
    });

    it('should show empty state message', () => {
      renderThinking();
      expect(screen.getByText('Thinking process will appear here')).toBeInTheDocument();
    });

    it('should show brain icon in empty state', () => {
      const { container } = renderThinking();
      const emptyIcon = container.querySelector('.empty-icon');
      expect(emptyIcon?.textContent).toContain('🧠');
    });

    it('should have empty class', () => {
      const { container } = renderThinking();
      expect(container.querySelector('.code-lab-thinking.empty')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Basic rendering with session
  // =========================================================================

  describe('basic rendering', () => {
    it('should render header with title', () => {
      renderThinking({ session: makeSession() });
      expect(screen.getByText("Claude's Thinking")).toBeInTheDocument();
    });

    it('should show brain icon in header', () => {
      const { container } = renderThinking({ session: makeSession() });
      const headerIcon = container.querySelector('.header-icon');
      expect(headerIcon?.textContent).toContain('🧠');
    });

    it('should show streaming badge when streaming', () => {
      renderThinking({ session: makeSession(), isStreaming: true });
      expect(screen.getByText('Live')).toBeInTheDocument();
    });

    it('should not show streaming badge when not streaming', () => {
      renderThinking({ session: makeSession(), isStreaming: false });
      expect(screen.queryByText('Live')).not.toBeInTheDocument();
    });

    it('should render collapse button', () => {
      renderThinking({ session: makeSession() });
      expect(screen.getByLabelText('Collapse thinking panel')).toBeInTheDocument();
    });

    it('should call onToggleCollapse when collapse button clicked', () => {
      const onToggleCollapse = vi.fn();
      renderThinking({ session: makeSession(), onToggleCollapse });
      fireEvent.click(screen.getByLabelText('Collapse thinking panel'));
      expect(onToggleCollapse).toHaveBeenCalledTimes(1);
    });

    it('should show expand label when collapsed', () => {
      renderThinking({ session: makeSession(), collapsed: true });
      expect(screen.getByLabelText('Expand thinking panel')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Stats bar
  // =========================================================================

  describe('stats bar', () => {
    it('should show duration stat', () => {
      renderThinking({ session: makeSession() });
      expect(screen.getByText('Duration')).toBeInTheDocument();
    });

    it('should show steps count', () => {
      renderThinking({ session: makeSession() });
      expect(screen.getByText('Steps')).toBeInTheDocument();
    });

    it('should show tokens stat by default', () => {
      renderThinking({ session: makeSession({ totalTokens: 1234 }) });
      expect(screen.getByText('Tokens')).toBeInTheDocument();
      expect(screen.getByText('1,234')).toBeInTheDocument();
    });

    it('should hide tokens stat when showTokens is false', () => {
      renderThinking({ session: makeSession(), showTokens: false });
      expect(screen.queryByText('Tokens')).not.toBeInTheDocument();
    });

    it('should show confidence stat by default', () => {
      renderThinking({ session: makeSession() });
      expect(screen.getByText('Confidence')).toBeInTheDocument();
    });

    it('should hide confidence stat when showConfidence is false', () => {
      renderThinking({ session: makeSession(), showConfidence: false });
      expect(screen.queryByText('Confidence')).not.toBeInTheDocument();
    });

    it('should not show stats when collapsed', () => {
      renderThinking({ session: makeSession(), collapsed: true });
      expect(screen.queryByText('Duration')).not.toBeInTheDocument();
      expect(screen.queryByText('Steps')).not.toBeInTheDocument();
    });

    it('should calculate duration from start/end time', () => {
      renderThinking({
        session: makeSession({ startTime: 0, endTime: 3000 }),
      });
      expect(screen.getByText('3.0s')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // View mode toggle
  // =========================================================================

  describe('view mode toggle', () => {
    it('should show stream view button', () => {
      renderThinking({ session: makeSession() });
      expect(screen.getByLabelText('Stream view')).toBeInTheDocument();
    });

    it('should show tree view button', () => {
      renderThinking({ session: makeSession() });
      expect(screen.getByLabelText('Tree view')).toBeInTheDocument();
    });

    it('should show timeline view button by default', () => {
      renderThinking({ session: makeSession() });
      expect(screen.getByLabelText('Timeline view')).toBeInTheDocument();
    });

    it('should hide timeline button when showTimeline is false', () => {
      renderThinking({ session: makeSession(), showTimeline: false });
      expect(screen.queryByLabelText('Timeline view')).not.toBeInTheDocument();
    });

    it('should switch to tree view on click', () => {
      const { container } = renderThinking({ session: makeSession() });
      fireEvent.click(screen.getByLabelText('Tree view'));
      expect(container.querySelector('.thinking-tree')).toBeInTheDocument();
    });

    it('should switch to timeline view on click', () => {
      const { container } = renderThinking({ session: makeSession() });
      fireEvent.click(screen.getByLabelText('Timeline view'));
      expect(container.querySelector('.thinking-timeline')).toBeInTheDocument();
    });

    it('should default to stream view', () => {
      const { container } = renderThinking({ session: makeSession() });
      expect(container.querySelector('.thinking-stream')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Stream view
  // =========================================================================

  describe('stream view', () => {
    it('should render steps', () => {
      renderThinking({
        session: makeSession({ steps: [makeStep({ content: 'Analyzing input' })] }),
      });
      expect(screen.getByText('Analyzing input')).toBeInTheDocument();
    });

    it('should render step type label', () => {
      renderThinking({
        session: makeSession({ steps: [makeStep({ type: 'analysis' })] }),
      });
      expect(screen.getByText('Analysis')).toBeInTheDocument();
    });

    it('should render reasoning step type', () => {
      renderThinking({
        session: makeSession({ steps: [makeStep({ type: 'reasoning' })] }),
      });
      expect(screen.getByText('Reasoning')).toBeInTheDocument();
    });

    it('should render decision step type', () => {
      renderThinking({
        session: makeSession({ steps: [makeStep({ type: 'decision' })] }),
      });
      expect(screen.getByText('Decision')).toBeInTheDocument();
    });

    it('should render planning step type', () => {
      renderThinking({
        session: makeSession({ steps: [makeStep({ type: 'planning' })] }),
      });
      expect(screen.getByText('Planning')).toBeInTheDocument();
    });

    it('should render verification step type', () => {
      renderThinking({
        session: makeSession({ steps: [makeStep({ type: 'verification' })] }),
      });
      expect(screen.getByText('Verification')).toBeInTheDocument();
    });

    it('should show step tokens when showTokens is true', () => {
      renderThinking({
        session: makeSession({
          steps: [makeStep({ tokens: 250 })],
        }),
      });
      expect(screen.getByText('250 tokens')).toBeInTheDocument();
    });

    it('should show streaming indicator when streaming', () => {
      renderThinking({ session: makeSession(), isStreaming: true });
      expect(screen.getByText('Thinking...')).toBeInTheDocument();
    });

    it('should not show streaming indicator when not streaming', () => {
      renderThinking({ session: makeSession(), isStreaming: false });
      expect(screen.queryByText('Thinking...')).not.toBeInTheDocument();
    });

    it('should render multiple steps', () => {
      renderThinking({
        session: makeSession({
          steps: [
            makeStep({ id: 's1', content: 'Step one' }),
            makeStep({ id: 's2', content: 'Step two' }),
            makeStep({ id: 's3', content: 'Step three' }),
          ],
        }),
      });
      expect(screen.getByText('Step one')).toBeInTheDocument();
      expect(screen.getByText('Step two')).toBeInTheDocument();
      expect(screen.getByText('Step three')).toBeInTheDocument();
    });

    it('should render confidence indicator', () => {
      const { container } = renderThinking({
        session: makeSession({
          steps: [makeStep({ confidence: 75 })],
        }),
      });
      const confidence = container.querySelector('.confidence-value');
      expect(confidence?.textContent).toBe('75%');
    });
  });

  // =========================================================================
  // Step expansion (children)
  // =========================================================================

  describe('step expansion', () => {
    it('should show expand icon for steps with children', () => {
      const { container } = renderThinking({
        session: makeSession({
          steps: [
            makeStep({
              children: [makeStep({ id: 'child-1', content: 'Child step' })],
            }),
          ],
        }),
      });
      expect(container.querySelector('.step-expand')).toBeInTheDocument();
    });

    it('should not show expand icon for steps without children', () => {
      const { container } = renderThinking({
        session: makeSession({
          steps: [makeStep({ children: undefined })],
        }),
      });
      expect(container.querySelector('.step-expand')).not.toBeInTheDocument();
    });

    it('should show children when step header is clicked', () => {
      const { container } = renderThinking({
        session: makeSession({
          steps: [
            makeStep({
              children: [makeStep({ id: 'child-1', content: 'Child content' })],
            }),
          ],
        }),
      });
      const stepHeader = container.querySelector('.step-header');
      fireEvent.click(stepHeader!);
      expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('should hide children when clicked again', () => {
      const { container } = renderThinking({
        session: makeSession({
          steps: [
            makeStep({
              children: [makeStep({ id: 'child-1', content: 'Child content' })],
            }),
          ],
        }),
      });
      const stepHeader = container.querySelector('.step-header');
      fireEvent.click(stepHeader!);
      expect(screen.getByText('Child content')).toBeInTheDocument();
      fireEvent.click(stepHeader!);
      expect(screen.queryByText('Child content')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Tree view
  // =========================================================================

  describe('tree view', () => {
    it('should render tree nodes', () => {
      const { container } = renderThinking({
        session: makeSession({
          steps: [makeStep({ content: 'Tree node content' })],
        }),
      });
      fireEvent.click(screen.getByLabelText('Tree view'));
      expect(container.querySelector('.tree-node')).toBeInTheDocument();
      expect(screen.getByText('Tree node content')).toBeInTheDocument();
    });

    it('should render connector lines between nodes', () => {
      const { container } = renderThinking({
        session: makeSession({
          steps: [makeStep({ id: 's1' }), makeStep({ id: 's2' })],
        }),
      });
      fireEvent.click(screen.getByLabelText('Tree view'));
      expect(container.querySelector('.connector-line')).toBeInTheDocument();
    });

    it('should show step type icons in tree', () => {
      renderThinking({
        session: makeSession({
          steps: [makeStep({ type: 'analysis' })],
        }),
      });
      fireEvent.click(screen.getByLabelText('Tree view'));
      expect(screen.getByText('Analysis')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Timeline view
  // =========================================================================

  describe('timeline view', () => {
    it('should render timeline bar', () => {
      const { container } = renderThinking({
        session: makeSession(),
      });
      fireEvent.click(screen.getByLabelText('Timeline view'));
      expect(container.querySelector('.timeline-bar')).toBeInTheDocument();
    });

    it('should render timeline segments for each step', () => {
      const { container } = renderThinking({
        session: makeSession({
          steps: [
            makeStep({ id: 's1', timestamp: 1000, duration: 500 }),
            makeStep({ id: 's2', timestamp: 1500, duration: 300 }),
          ],
        }),
      });
      fireEvent.click(screen.getByLabelText('Timeline view'));
      const segments = container.querySelectorAll('.timeline-segment');
      expect(segments.length).toBe(2);
    });

    it('should show time labels', () => {
      renderThinking({
        session: makeSession({ startTime: 0, endTime: 2000 }),
      });
      fireEvent.click(screen.getByLabelText('Timeline view'));
      expect(screen.getByText('0s')).toBeInTheDocument();
    });
  });

  // =========================================================================
  // Summary
  // =========================================================================

  describe('summary', () => {
    it('should show summary when present', () => {
      renderThinking({
        session: makeSession({ summary: 'This is the final summary' }),
      });
      expect(screen.getByText(/This is the final summary/)).toBeInTheDocument();
    });

    it('should show Summary label', () => {
      renderThinking({
        session: makeSession({ summary: 'Done' }),
      });
      expect(screen.getByText('Summary:')).toBeInTheDocument();
    });

    it('should not show summary when not present', () => {
      renderThinking({
        session: makeSession({ summary: undefined }),
      });
      expect(screen.queryByText('Summary:')).not.toBeInTheDocument();
    });

    it('should not show summary when collapsed', () => {
      renderThinking({
        session: makeSession({ summary: 'Final answer' }),
        collapsed: true,
      });
      expect(screen.queryByText('Summary:')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Collapsed state
  // =========================================================================

  describe('collapsed state', () => {
    it('should add collapsed class', () => {
      const { container } = renderThinking({
        session: makeSession(),
        collapsed: true,
      });
      expect(container.querySelector('.collapsed')).toBeInTheDocument();
    });

    it('should still show header when collapsed', () => {
      renderThinking({ session: makeSession(), collapsed: true });
      expect(screen.getByText("Claude's Thinking")).toBeInTheDocument();
    });

    it('should hide content when collapsed', () => {
      const { container } = renderThinking({
        session: makeSession(),
        collapsed: true,
      });
      expect(container.querySelector('.thinking-content')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Confidence colors
  // =========================================================================

  describe('confidence indicator', () => {
    it('should render confidence bar', () => {
      const { container } = renderThinking({
        session: makeSession({
          steps: [makeStep({ confidence: 90 })],
        }),
      });
      const bar = container.querySelector('.confidence-fill');
      expect(bar).toBeInTheDocument();
    });

    it('should show green for high confidence (>=80)', () => {
      const { container } = renderThinking({
        session: makeSession({
          steps: [makeStep({ confidence: 90 })],
        }),
      });
      const fill = container.querySelector('.confidence-fill');
      expect(fill?.style.backgroundColor).toBe('rgb(34, 197, 94)');
    });

    it('should show yellow for medium confidence (50-79)', () => {
      const { container } = renderThinking({
        session: makeSession({
          steps: [makeStep({ confidence: 60 })],
        }),
      });
      const fill = container.querySelector('.confidence-fill');
      expect(fill?.style.backgroundColor).toBe('rgb(245, 158, 11)');
    });

    it('should show red for low confidence (<50)', () => {
      const { container } = renderThinking({
        session: makeSession({
          steps: [makeStep({ confidence: 30 })],
        }),
      });
      const fill = container.querySelector('.confidence-fill');
      expect(fill?.style.backgroundColor).toBe('rgb(239, 68, 68)');
    });

    it('should hide confidence when showConfidence is false', () => {
      const { container } = renderThinking({
        session: makeSession(),
        showConfidence: false,
      });
      expect(container.querySelector('.confidence-indicator')).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe('edge cases', () => {
    it('should handle session with no steps', () => {
      renderThinking({
        session: makeSession({ steps: [] }),
      });
      expect(screen.getByText("Claude's Thinking")).toBeInTheDocument();
    });

    it('should handle step without tokens', () => {
      renderThinking({
        session: makeSession({
          steps: [makeStep({ tokens: undefined })],
        }),
      });
      expect(screen.queryByText(/tokens/)).not.toBeInTheDocument();
    });

    it('should handle step without duration', () => {
      renderThinking({
        session: makeSession({
          steps: [makeStep({ duration: undefined })],
        }),
      });
      expect(screen.getByText('Analysis')).toBeInTheDocument();
    });

    it('should handle session without endTime', () => {
      renderThinking({
        session: makeSession({ endTime: undefined }),
      });
      expect(screen.getByText('Duration')).toBeInTheDocument();
    });
  });
});
