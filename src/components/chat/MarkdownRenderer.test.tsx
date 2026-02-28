// @ts-nocheck - Test file with extensive mocking
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

// Ensure React is globally available for JSX transform (jsx: "preserve" + esbuild classic mode)
globalThis.React = React;

import { render, screen } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hoisted mocks (used inside vi.mock factories)
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  useCodeExecutionOptional: vi.fn(),
  parseActionPreview: vi.fn(),
  ReactMarkdownCapture: { components: null as unknown, lastChildren: '' as string },
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/contexts/CodeExecutionContext', () => ({
  useCodeExecutionOptional: mocks.useCodeExecutionOptional,
}));

vi.mock('./CodeBlockWithActions', () => ({
  CodeBlockWithActions: ({ code, language }: { code: string; language: string }) =>
    React.createElement(
      'div',
      { 'data-testid': 'code-block-with-actions', 'data-language': language },
      code
    ),
  default: ({ code, language }: { code: string; language: string }) =>
    React.createElement(
      'div',
      { 'data-testid': 'code-block-with-actions', 'data-language': language },
      code
    ),
}));

vi.mock('./TerminalOutput', () => ({
  TerminalOutput: ({
    output,
    success,
    title,
  }: {
    output: string;
    success: boolean;
    title: string;
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'terminal-output', 'data-success': String(success), 'data-title': title },
      output
    ),
  default: ({ output, success, title }: { output: string; success: boolean; title: string }) =>
    React.createElement(
      'div',
      { 'data-testid': 'terminal-output', 'data-success': String(success), 'data-title': title },
      output
    ),
}));

vi.mock('./ActionPreviewCard', () => ({
  parseActionPreview: mocks.parseActionPreview,
  default: ({ preview }: { preview: { platform: string } }) =>
    React.createElement('div', { 'data-testid': 'action-preview-card' }, preview.platform),
}));

// Mock react-markdown: capture the components and children, then render children as text
vi.mock('react-markdown', () => ({
  default: ({ children, components }: { children: string; components: unknown }) => {
    // Store for inspection by tests
    mocks.ReactMarkdownCapture.components = components;
    mocks.ReactMarkdownCapture.lastChildren = children;
    // Render children as plain text inside a wrapper
    return React.createElement('div', { 'data-testid': 'react-markdown' }, children);
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { MarkdownRenderer } from './MarkdownRenderer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();
  mocks.useCodeExecutionOptional.mockReturnValue(null);
  mocks.parseActionPreview.mockReturnValue(null);
  mocks.ReactMarkdownCapture.components = null;
  mocks.ReactMarkdownCapture.lastChildren = '';
});

/**
 * Helper: render the MarkdownRenderer and return the components object
 * that was passed to ReactMarkdown.
 */
function renderAndGetComponents(content: string, props = {}) {
  const result = render(React.createElement(MarkdownRenderer, { content, ...props }));
  return { ...result, components: mocks.ReactMarkdownCapture.components };
}

// ===========================================================================
// Test Suite
// ===========================================================================

describe('MarkdownRenderer', () => {
  // -----------------------------------------------------------------------
  // Basic rendering
  // -----------------------------------------------------------------------
  describe('basic rendering', () => {
    it('renders plain text content', () => {
      render(React.createElement(MarkdownRenderer, { content: 'Hello world' }));
      expect(screen.getByText('Hello world')).toBeDefined();
    });

    it('renders empty content without crashing', () => {
      const { container } = render(React.createElement(MarkdownRenderer, { content: '' }));
      expect(container.querySelector('.markdown-content')).not.toBeNull();
    });

    it('wraps output in a div with markdown-content class', () => {
      const { container } = render(React.createElement(MarkdownRenderer, { content: 'test' }));
      const wrapper = container.querySelector('.markdown-content');
      expect(wrapper).not.toBeNull();
    });

    it('passes processed content to ReactMarkdown', () => {
      render(React.createElement(MarkdownRenderer, { content: 'Sample text' }));
      expect(mocks.ReactMarkdownCapture.lastChildren).toBe('Sample text');
    });

    it('passes a components object to ReactMarkdown', () => {
      renderAndGetComponents('test');
      expect(mocks.ReactMarkdownCapture.components).not.toBeNull();
      expect(typeof mocks.ReactMarkdownCapture.components).toBe('object');
    });
  });

  // -----------------------------------------------------------------------
  // autoLinkifyUrls preprocessing
  // -----------------------------------------------------------------------
  describe('autoLinkifyUrls preprocessing', () => {
    it('converts a plain https URL to markdown link format', () => {
      render(React.createElement(MarkdownRenderer, { content: 'Visit https://example.com today' }));
      const processed = mocks.ReactMarkdownCapture.lastChildren;
      expect(processed).toContain('[example.com](https://example.com)');
    });

    it('converts a plain http URL to markdown link format', () => {
      render(React.createElement(MarkdownRenderer, { content: 'Go to http://test.org now' }));
      const processed = mocks.ReactMarkdownCapture.lastChildren;
      expect(processed).toContain('[test.org](http://test.org)');
    });

    it('strips www. from the display text', () => {
      render(
        React.createElement(MarkdownRenderer, { content: 'See https://www.example.com/page' })
      );
      const processed = mocks.ReactMarkdownCapture.lastChildren;
      expect(processed).toContain('[example.com]');
      expect(processed).not.toContain('[www.example.com]');
    });

    it('does not double-wrap URLs already in markdown link format', () => {
      const md = '[Example](https://example.com)';
      render(React.createElement(MarkdownRenderer, { content: md }));
      const processed = mocks.ReactMarkdownCapture.lastChildren;
      // Should still contain the original link, not be double-wrapped
      expect(processed).toContain('[Example](https://example.com)');
    });

    it('converts multiple URLs in the same content', () => {
      const content = 'Check https://a.com and https://b.com';
      render(React.createElement(MarkdownRenderer, { content }));
      const processed = mocks.ReactMarkdownCapture.lastChildren;
      expect(processed).toContain('[a.com](https://a.com)');
      expect(processed).toContain('[b.com](https://b.com)');
    });

    it('handles URLs with paths', () => {
      render(
        React.createElement(MarkdownRenderer, { content: 'See https://example.com/path/to/page' })
      );
      const processed = mocks.ReactMarkdownCapture.lastChildren;
      expect(processed).toContain('(https://example.com/path/to/page)');
    });

    it('handles content with no URLs unchanged', () => {
      const content = 'No links here at all';
      render(React.createElement(MarkdownRenderer, { content }));
      expect(mocks.ReactMarkdownCapture.lastChildren).toBe(content);
    });
  });

  // -----------------------------------------------------------------------
  // filterInternalMarkers preprocessing
  // -----------------------------------------------------------------------
  describe('filterInternalMarkers preprocessing', () => {
    it('removes checkpoint state markers [c:BASE64]', () => {
      render(React.createElement(MarkdownRenderer, { content: 'Hello [c:dGVzdA==] world' }));
      const processed = mocks.ReactMarkdownCapture.lastChildren;
      expect(processed).toBe('Hello  world');
    });

    it('removes multiple checkpoint markers', () => {
      render(
        React.createElement(MarkdownRenderer, { content: '[c:abc123==]Start[c:xyz789+/=]End' })
      );
      const processed = mocks.ReactMarkdownCapture.lastChildren;
      expect(processed).toBe('StartEnd');
    });

    it('preserves content without markers', () => {
      const content = 'Normal text without markers';
      render(React.createElement(MarkdownRenderer, { content }));
      expect(mocks.ReactMarkdownCapture.lastChildren).toBe(content);
    });

    it('handles markers with only alphanumeric base64 chars', () => {
      render(React.createElement(MarkdownRenderer, { content: 'A[c:ABC123]B' }));
      const processed = mocks.ReactMarkdownCapture.lastChildren;
      expect(processed).toBe('AB');
    });

    it('handles markers with plus and slash base64 chars', () => {
      render(React.createElement(MarkdownRenderer, { content: 'X[c:a+b/c=]Y' }));
      const processed = mocks.ReactMarkdownCapture.lastChildren;
      expect(processed).toBe('XY');
    });

    it('does not remove content that does not match marker pattern', () => {
      // [c:] with non-base64 chars should not be removed
      render(React.createElement(MarkdownRenderer, { content: 'Keep [c:hello!world] this' }));
      const processed = mocks.ReactMarkdownCapture.lastChildren;
      // The ! is not base64, so [c:hello] gets stripped but !world] remains
      expect(processed).toContain('!world]');
    });
  });

  // -----------------------------------------------------------------------
  // Custom components passed to ReactMarkdown
  // -----------------------------------------------------------------------
  describe('custom components object', () => {
    it('includes h1 component override', () => {
      const { components } = renderAndGetComponents('test');
      expect(components.h1).toBeDefined();
    });

    it('includes h2 component override', () => {
      const { components } = renderAndGetComponents('test');
      expect(components.h2).toBeDefined();
    });

    it('includes h3 component override', () => {
      const { components } = renderAndGetComponents('test');
      expect(components.h3).toBeDefined();
    });

    it('includes h4 component override', () => {
      const { components } = renderAndGetComponents('test');
      expect(components.h4).toBeDefined();
    });

    it('includes p component override', () => {
      const { components } = renderAndGetComponents('test');
      expect(components.p).toBeDefined();
    });

    it('includes strong component override', () => {
      const { components } = renderAndGetComponents('test');
      expect(components.strong).toBeDefined();
    });

    it('includes em component override', () => {
      const { components } = renderAndGetComponents('test');
      expect(components.em).toBeDefined();
    });

    it('includes ul component override', () => {
      const { components } = renderAndGetComponents('test');
      expect(components.ul).toBeDefined();
    });

    it('includes ol component override', () => {
      const { components } = renderAndGetComponents('test');
      expect(components.ol).toBeDefined();
    });

    it('includes li component override', () => {
      const { components } = renderAndGetComponents('test');
      expect(components.li).toBeDefined();
    });

    it('includes a (link) component override', () => {
      const { components } = renderAndGetComponents('test');
      expect(components.a).toBeDefined();
    });

    it('includes code component override', () => {
      const { components } = renderAndGetComponents('test');
      expect(components.code).toBeDefined();
    });

    it('includes blockquote component override', () => {
      const { components } = renderAndGetComponents('test');
      expect(components.blockquote).toBeDefined();
    });

    it('includes hr component override', () => {
      const { components } = renderAndGetComponents('test');
      expect(components.hr).toBeDefined();
    });

    it('includes table component override', () => {
      const { components } = renderAndGetComponents('test');
      expect(components.table).toBeDefined();
    });

    it('includes thead component override', () => {
      const { components } = renderAndGetComponents('test');
      expect(components.thead).toBeDefined();
    });

    it('includes tbody component override', () => {
      const { components } = renderAndGetComponents('test');
      expect(components.tbody).toBeDefined();
    });

    it('includes tr component override', () => {
      const { components } = renderAndGetComponents('test');
      expect(components.tr).toBeDefined();
    });

    it('includes th component override', () => {
      const { components } = renderAndGetComponents('test');
      expect(components.th).toBeDefined();
    });

    it('includes td component override', () => {
      const { components } = renderAndGetComponents('test');
      expect(components.td).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // Code component behavior
  // -----------------------------------------------------------------------
  describe('code component behavior', () => {
    it('renders inline code when no className is provided', () => {
      const { components } = renderAndGetComponents('test');
      const codeFn = components.code;
      const { container } = render(codeFn({ children: 'inline code' }));
      const code = container.querySelector('code');
      expect(code).not.toBeNull();
      expect(code.className).toContain('font-mono');
      expect(code.textContent).toBe('inline code');
    });

    it('renders block code with language header when className is present', () => {
      const { components } = renderAndGetComponents('test');
      const codeFn = components.code;
      const { container } = render(
        codeFn({ className: 'language-javascript', children: 'const x = 1;\n' })
      );
      // Should have the language header
      expect(container.textContent).toContain('JavaScript');
    });

    it('renders terminal output for bash language when enableCodeActions', () => {
      mocks.useCodeExecutionOptional.mockReturnValue({
        testCode: vi.fn(),
        githubConnected: false,
        selectedRepo: null,
        setShowRepoSelector: vi.fn(),
        pushToGitHub: vi.fn(),
      });
      const { components } = renderAndGetComponents('test', { enableCodeActions: true });
      const codeFn = components.code;
      const { container } = render(codeFn({ className: 'language-bash', children: 'ls -la\n' }));
      expect(container.querySelector('[data-testid="terminal-output"]')).not.toBeNull();
    });

    it('renders terminal output for shell language', () => {
      mocks.useCodeExecutionOptional.mockReturnValue({
        testCode: vi.fn(),
        githubConnected: false,
        selectedRepo: null,
        setShowRepoSelector: vi.fn(),
        pushToGitHub: vi.fn(),
      });
      const { components } = renderAndGetComponents('test', { enableCodeActions: true });
      const codeFn = components.code;
      const { container } = render(codeFn({ className: 'language-shell', children: 'echo hi\n' }));
      expect(container.querySelector('[data-testid="terminal-output"]')).not.toBeNull();
    });

    it('renders terminal output for console language', () => {
      mocks.useCodeExecutionOptional.mockReturnValue({
        testCode: vi.fn(),
        githubConnected: false,
        selectedRepo: null,
        setShowRepoSelector: vi.fn(),
        pushToGitHub: vi.fn(),
      });
      const { components } = renderAndGetComponents('test', { enableCodeActions: true });
      const codeFn = components.code;
      const { container } = render(codeFn({ className: 'language-console', children: '$ npm\n' }));
      expect(container.querySelector('[data-testid="terminal-output"]')).not.toBeNull();
    });

    it('detects error in terminal output and sets success=false', () => {
      mocks.useCodeExecutionOptional.mockReturnValue({
        testCode: vi.fn(),
        githubConnected: false,
        selectedRepo: null,
        setShowRepoSelector: vi.fn(),
        pushToGitHub: vi.fn(),
      });
      const { components } = renderAndGetComponents('test', { enableCodeActions: true });
      const codeFn = components.code;
      const { container } = render(
        codeFn({ className: 'language-bash', children: 'Error: fail\n' })
      );
      const terminal = container.querySelector('[data-testid="terminal-output"]');
      expect(terminal?.getAttribute('data-success')).toBe('false');
    });

    it('renders success terminal output when no error keywords found', () => {
      mocks.useCodeExecutionOptional.mockReturnValue({
        testCode: vi.fn(),
        githubConnected: false,
        selectedRepo: null,
        setShowRepoSelector: vi.fn(),
        pushToGitHub: vi.fn(),
      });
      const { components } = renderAndGetComponents('test', { enableCodeActions: true });
      const codeFn = components.code;
      const { container } = render(codeFn({ className: 'language-bash', children: 'all good\n' }));
      const terminal = container.querySelector('[data-testid="terminal-output"]');
      expect(terminal?.getAttribute('data-success')).toBe('true');
    });

    it('sets title to "Output" for output language', () => {
      mocks.useCodeExecutionOptional.mockReturnValue({
        testCode: vi.fn(),
        githubConnected: false,
        selectedRepo: null,
        setShowRepoSelector: vi.fn(),
        pushToGitHub: vi.fn(),
      });
      const { components } = renderAndGetComponents('test', { enableCodeActions: true });
      const codeFn = components.code;
      const { container } = render(codeFn({ className: 'language-output', children: 'result\n' }));
      const terminal = container.querySelector('[data-testid="terminal-output"]');
      expect(terminal?.getAttribute('data-title')).toBe('Output');
    });

    it('sets title to "Log" for log language', () => {
      mocks.useCodeExecutionOptional.mockReturnValue({
        testCode: vi.fn(),
        githubConnected: false,
        selectedRepo: null,
        setShowRepoSelector: vi.fn(),
        pushToGitHub: vi.fn(),
      });
      const { components } = renderAndGetComponents('test', { enableCodeActions: true });
      const codeFn = components.code;
      const { container } = render(codeFn({ className: 'language-log', children: 'info: ok\n' }));
      const terminal = container.querySelector('[data-testid="terminal-output"]');
      expect(terminal?.getAttribute('data-title')).toBe('Log');
    });

    it('sets title to "Terminal" for bash/sh/terminal languages', () => {
      mocks.useCodeExecutionOptional.mockReturnValue({
        testCode: vi.fn(),
        githubConnected: false,
        selectedRepo: null,
        setShowRepoSelector: vi.fn(),
        pushToGitHub: vi.fn(),
      });
      const { components } = renderAndGetComponents('test', { enableCodeActions: true });
      const codeFn = components.code;
      const { container } = render(codeFn({ className: 'language-terminal', children: 'cmd\n' }));
      const terminal = container.querySelector('[data-testid="terminal-output"]');
      expect(terminal?.getAttribute('data-title')).toBe('Terminal');
    });

    it('renders CodeBlockWithActions when enableCodeActions and codeExecution available', () => {
      mocks.useCodeExecutionOptional.mockReturnValue({
        testCode: vi.fn(),
        githubConnected: true,
        selectedRepo: { name: 'repo' },
        setShowRepoSelector: vi.fn(),
        pushToGitHub: vi.fn(),
      });
      const { components } = renderAndGetComponents('test', { enableCodeActions: true });
      const codeFn = components.code;
      const { container } = render(
        codeFn({ className: 'language-python', children: 'print(1)\n' })
      );
      expect(container.querySelector('[data-testid="code-block-with-actions"]')).not.toBeNull();
    });

    it('renders action-preview via ActionPreviewCard', () => {
      const previewData = {
        platform: 'Twitter',
        action: 'Post',
        content: 'Hello',
        toolName: 'twitter_post',
        toolParams: {},
      };
      mocks.parseActionPreview.mockReturnValue(previewData);
      mocks.useCodeExecutionOptional.mockReturnValue({
        testCode: vi.fn(),
        githubConnected: false,
        selectedRepo: null,
        setShowRepoSelector: vi.fn(),
        pushToGitHub: vi.fn(),
      });
      const { components } = renderAndGetComponents('test', { enableCodeActions: true });
      const codeFn = components.code;
      const { container } = render(
        codeFn({ className: 'language-action-preview', children: '{"platform":"Twitter"}\n' })
      );
      expect(container.querySelector('[data-testid="action-preview-card"]')).not.toBeNull();
    });

    it('does not render ActionPreviewCard when parseActionPreview returns null', () => {
      mocks.parseActionPreview.mockReturnValue(null);
      mocks.useCodeExecutionOptional.mockReturnValue({
        testCode: vi.fn(),
        githubConnected: false,
        selectedRepo: null,
        setShowRepoSelector: vi.fn(),
        pushToGitHub: vi.fn(),
      });
      const { components } = renderAndGetComponents('test', { enableCodeActions: true });
      const codeFn = components.code;
      const { container } = render(
        codeFn({ className: 'language-action-preview', children: 'invalid\n' })
      );
      expect(container.querySelector('[data-testid="action-preview-card"]')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Link component behavior
  // -----------------------------------------------------------------------
  describe('link component behavior', () => {
    it('renders external links with target=_blank', () => {
      const { components } = renderAndGetComponents('test');
      const linkFn = components.a;
      const { container } = render(linkFn({ href: 'https://google.com', children: 'Google' }));
      const link = container.querySelector('a');
      expect(link).not.toBeNull();
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
    });

    it('renders empty href as span (safety check)', () => {
      const { components } = renderAndGetComponents('test');
      const linkFn = components.a;
      const { container } = render(linkFn({ href: '', children: 'text' }));
      const span = container.querySelector('span');
      expect(span).not.toBeNull();
    });

    it('renders # href as span (safety check)', () => {
      const { components } = renderAndGetComponents('test');
      const linkFn = components.a;
      const { container } = render(linkFn({ href: '#', children: 'anchor' }));
      const span = container.querySelector('span');
      expect(span).not.toBeNull();
    });

    it('renders document link with PDF as download button', () => {
      const { components } = renderAndGetComponents('test');
      const linkFn = components.a;
      const { container } = render(
        linkFn({ href: '/api/documents/report.pdf', children: 'Report' })
      );
      const button = container.querySelector('button');
      expect(button).not.toBeNull();
    });

    it('renders document link with DOCX as download button', () => {
      const { components } = renderAndGetComponents('test');
      const linkFn = components.a;
      const { container } = render(
        linkFn({ href: 'https://example.com/file.docx', children: 'Doc' })
      );
      const button = container.querySelector('button');
      expect(button).not.toBeNull();
    });

    it('renders document link with XLSX as download button', () => {
      const { components } = renderAndGetComponents('test');
      const linkFn = components.a;
      const { container } = render(
        linkFn({ href: 'https://example.com/data.xlsx', children: 'Sheet' })
      );
      const button = container.querySelector('button');
      expect(button).not.toBeNull();
    });

    it('renders download button with SVG icon', () => {
      const { components } = renderAndGetComponents('test');
      const linkFn = components.a;
      const { container } = render(linkFn({ href: '/api/documents/test.pdf', children: 'File' }));
      const svg = container.querySelector('svg');
      expect(svg).not.toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Display language mapping (via code component's block rendering)
  // -----------------------------------------------------------------------
  describe('display language names', () => {
    it.each([
      ['javascript', 'JavaScript'],
      ['js', 'JavaScript'],
      ['typescript', 'TypeScript'],
      ['ts', 'TypeScript'],
      ['jsx', 'React JSX'],
      ['tsx', 'React TSX'],
      ['python', 'Python'],
      ['py', 'Python'],
      ['html', 'HTML'],
      ['css', 'CSS'],
      ['json', 'JSON'],
      ['sql', 'SQL'],
    ])('shows language "%s" as "%s" in code block header', (lang, display) => {
      // When no code actions, the code component renders a div with language header
      const { components } = renderAndGetComponents('test');
      const codeFn = components.code;
      const { container } = render(codeFn({ className: `language-${lang}`, children: 'code\n' }));
      expect(container.textContent).toContain(display);
    });

    it('shows unknown language in uppercase', () => {
      const { components } = renderAndGetComponents('test');
      const codeFn = components.code;
      const { container } = render(codeFn({ className: 'language-ruby', children: 'code\n' }));
      expect(container.textContent).toContain('RUBY');
    });
  });

  // -----------------------------------------------------------------------
  // Props and defaults
  // -----------------------------------------------------------------------
  describe('props and defaults', () => {
    it('defaults enableCodeActions to false', () => {
      mocks.useCodeExecutionOptional.mockReturnValue({
        testCode: vi.fn(),
        githubConnected: false,
        selectedRepo: null,
        setShowRepoSelector: vi.fn(),
        pushToGitHub: vi.fn(),
      });
      const { components } = renderAndGetComponents('test');
      const codeFn = components.code;
      const { container } = render(
        codeFn({ className: 'language-python', children: 'print(1)\n' })
      );
      // Without enableCodeActions, should NOT render CodeBlockWithActions
      expect(container.querySelector('[data-testid="code-block-with-actions"]')).toBeNull();
    });

    it('accepts onTestResult callback without crashing', () => {
      const onTestResult = vi.fn();
      render(React.createElement(MarkdownRenderer, { content: 'test', onTestResult }));
      expect(screen.getByText('test')).toBeDefined();
    });

    it('accepts onActionSend callback without crashing', () => {
      render(React.createElement(MarkdownRenderer, { content: 'test', onActionSend: vi.fn() }));
      expect(screen.getByText('test')).toBeDefined();
    });

    it('accepts onActionEdit callback without crashing', () => {
      render(React.createElement(MarkdownRenderer, { content: 'test', onActionEdit: vi.fn() }));
      expect(screen.getByText('test')).toBeDefined();
    });

    it('accepts onActionCancel callback without crashing', () => {
      render(React.createElement(MarkdownRenderer, { content: 'test', onActionCancel: vi.fn() }));
      expect(screen.getByText('test')).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // Memoization
  // -----------------------------------------------------------------------
  describe('memoization', () => {
    it('is a memoized component (React.memo wraps it as an object)', () => {
      expect(MarkdownRenderer).toBeDefined();
      expect(typeof MarkdownRenderer).toBe('object');
    });

    it('has a displayName or type function', () => {
      // React.memo components have a type property pointing to the original function
      expect(MarkdownRenderer.type || MarkdownRenderer.$$typeof).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles content with only whitespace', () => {
      const { container } = render(React.createElement(MarkdownRenderer, { content: '   ' }));
      expect(container.querySelector('.markdown-content')).not.toBeNull();
    });

    it('handles very long content without crashing', () => {
      const longContent = 'A'.repeat(10000);
      render(React.createElement(MarkdownRenderer, { content: longContent }));
      expect(mocks.ReactMarkdownCapture.lastChildren).toHaveLength(10000);
    });

    it('both filters markers and linkifies URLs in a single pass', () => {
      const content = '[c:abc=]Visit https://example.com please';
      render(React.createElement(MarkdownRenderer, { content }));
      const processed = mocks.ReactMarkdownCapture.lastChildren;
      // Marker should be removed
      expect(processed).not.toContain('[c:abc=]');
      // URL should be linkified
      expect(processed).toContain('[example.com](https://example.com)');
    });

    it('handles content with special characters', () => {
      const content = 'Price is $100 & tax is <10%>';
      render(React.createElement(MarkdownRenderer, { content }));
      expect(mocks.ReactMarkdownCapture.lastChildren).toContain('$100');
    });

    it('handles null-ish codeExecution context gracefully', () => {
      mocks.useCodeExecutionOptional.mockReturnValue(null);
      render(React.createElement(MarkdownRenderer, { content: 'test', enableCodeActions: true }));
      expect(screen.getByText('test')).toBeDefined();
    });
  });
});
