import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock user-messages module
vi.mock('@/lib/errors/user-messages', () => ({
  OPERATION_MESSAGES: {
    loadFailed: {
      message: 'Failed to load content',
      suggestion: 'Please try refreshing',
      action: 'Retry',
    },
  },
}));

import { ErrorBoundary, MessageErrorBoundary, AsyncErrorBoundary } from './ErrorBoundary';

// Suppress console.error in error boundary tests
const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

function ThrowingChild({ error }: { error?: Error }) {
  if (error) throw error;
  return <div>Child rendered</div>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    consoleSpy.mockClear();
  });

  it('should render children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Hello</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Hello')).toBeDefined();
  });

  it('should render fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild error={new Error('test crash')} />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Failed to load content')).toBeDefined();
  });

  it('should render custom fallback element', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <ThrowingChild error={new Error('crash')} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom error UI')).toBeDefined();
  });

  it('should render custom fallback function with error and reset', () => {
    render(
      <ErrorBoundary
        fallback={({ error, reset }) => (
          <div>
            <span>Error: {error.message}</span>
            <button onClick={reset}>Reset</button>
          </div>
        )}
      >
        <ThrowingChild error={new Error('custom crash')} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Error: custom crash')).toBeDefined();
    expect(screen.getByText('Reset')).toBeDefined();
  });

  it('should show retry button by default', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild error={new Error('crash')} />
      </ErrorBoundary>
    );
    expect(screen.getByRole('button', { name: /retry/i })).toBeDefined();
  });

  it('should hide retry button when showRetry=false', () => {
    render(
      <ErrorBoundary showRetry={false}>
        <ThrowingChild error={new Error('crash')} />
      </ErrorBoundary>
    );
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });

  it('should call onError when error occurs', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowingChild error={new Error('reported crash')} />
      </ErrorBoundary>
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'reported crash' }),
      expect.objectContaining({ componentStack: expect.any(String) })
    );
  });

  it('should reset and re-render children when retry is clicked', () => {
    let shouldThrow = true;
    function ConditionalThrower() {
      if (shouldThrow) throw new Error('conditional');
      return <div>Recovered</div>;
    }

    render(
      <ErrorBoundary>
        <ConditionalThrower />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeDefined();

    // Fix the error and retry
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(screen.getByText('Recovered')).toBeDefined();
  });

  it('should show max retries message after 3 retries', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild error={new Error('persistent')} />
      </ErrorBoundary>
    );

    // Click retry 3 times
    for (let i = 0; i < 3; i++) {
      const retryButton = screen.queryByRole('button', { name: /retry/i });
      if (retryButton) fireEvent.click(retryButton);
    }

    expect(screen.getByText(/maximum retries reached/i)).toBeDefined();
  });

  it('should have ARIA attributes for accessibility', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild error={new Error('crash')} />
      </ErrorBoundary>
    );
    const alert = screen.getByRole('alert');
    expect(alert.getAttribute('aria-live')).toBe('assertive');
  });
});

describe('MessageErrorBoundary', () => {
  beforeEach(() => {
    consoleSpy.mockClear();
  });

  it('should render children when no error', () => {
    render(
      <MessageErrorBoundary>
        <div>Message content</div>
      </MessageErrorBoundary>
    );
    expect(screen.getByText('Message content')).toBeDefined();
  });

  it('should show inline error for failed messages', () => {
    render(
      <MessageErrorBoundary>
        <ThrowingChild error={new Error('bad message')} />
      </MessageErrorBoundary>
    );
    expect(screen.getByText('Unable to display this message')).toBeDefined();
    expect(screen.getByRole('alert')).toBeDefined();
  });

  it('should allow retry for message errors', () => {
    let shouldThrow = true;
    function Thrower() {
      if (shouldThrow) throw new Error('msg error');
      return <div>Fixed message</div>;
    }

    render(
      <MessageErrorBoundary>
        <Thrower />
      </MessageErrorBoundary>
    );

    expect(screen.getByText('Unable to display this message')).toBeDefined();

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(screen.getByText('Fixed message')).toBeDefined();
  });

  it('should limit retries to 2', () => {
    render(
      <MessageErrorBoundary>
        <ThrowingChild error={new Error('persistent')} />
      </MessageErrorBoundary>
    );

    // After 2 retries, button should disappear
    for (let i = 0; i < 2; i++) {
      const retryButton = screen.queryByRole('button', { name: /retry/i });
      if (retryButton) fireEvent.click(retryButton);
    }

    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
  });

  it('should call onError handler', () => {
    const onError = vi.fn();
    render(
      <MessageErrorBoundary onError={onError}>
        <ThrowingChild error={new Error('err')} />
      </MessageErrorBoundary>
    );
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe('AsyncErrorBoundary', () => {
  beforeEach(() => {
    consoleSpy.mockClear();
  });

  it('should render children when no error', () => {
    render(
      <AsyncErrorBoundary>
        <div>Async content</div>
      </AsyncErrorBoundary>
    );
    expect(screen.getByText('Async content')).toBeDefined();
  });

  it('should show error UI on failure', () => {
    render(
      <AsyncErrorBoundary>
        <ThrowingChild error={new Error('async fail')} />
      </AsyncErrorBoundary>
    );
    expect(screen.getByText('Failed to load content')).toBeDefined();
    expect(screen.getByRole('alert')).toBeDefined();
  });

  it('should have polite aria-live (less intrusive than main boundary)', () => {
    render(
      <AsyncErrorBoundary>
        <ThrowingChild error={new Error('async fail')} />
      </AsyncErrorBoundary>
    );
    expect(screen.getByRole('alert').getAttribute('aria-live')).toBe('polite');
  });

  it('should support Try Again button', () => {
    let shouldThrow = true;
    function Thrower() {
      if (shouldThrow) throw new Error('async');
      return <div>Async recovered</div>;
    }

    render(
      <AsyncErrorBoundary>
        <Thrower />
      </AsyncErrorBoundary>
    );

    shouldThrow = false;
    fireEvent.click(screen.getByText('Try Again'));
    expect(screen.getByText('Async recovered')).toBeDefined();
  });
});
