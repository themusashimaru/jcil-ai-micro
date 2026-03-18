import type { Components } from 'react-markdown';
import { InlineScreenshot } from './InlineScreenshot';
import { DocumentDownloadLink } from './DocumentDownloadLink';
import { logger } from '@/lib/logger';

const log = logger('MarkdownRenderer');

/** Base markdown component overrides for theme support */
export const baseMarkdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold mt-4 mb-2 first:mt-0 text-inherit">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-bold mt-3 mb-2 first:mt-0 text-inherit">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold mt-3 mb-1 first:mt-0 text-inherit">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-sm font-semibold mt-2 mb-1 first:mt-0 text-inherit">{children}</h4>
  ),
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-inherit">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-inherit">{children}</strong>,
  em: ({ children }) => <em className="italic text-inherit">{children}</em>,
  ul: ({ children }) => (
    <ul className="list-disc list-inside mb-2 space-y-1 ml-2 text-inherit">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside mb-2 space-y-1 ml-2 text-inherit">{children}</ol>
  ),
  li: ({ children }) => <li className="text-inherit">{children}</li>,

  a: ({ href, children }) => {
    if (!href || href === '' || href === '#') {
      log.warn('Empty or invalid href detected, rendering as text');
      return <span className="text-primary">{children}</span>;
    }

    const isDocumentLink =
      href &&
      (href.includes('/api/documents/') ||
        href.includes('.pdf') ||
        href.includes('.docx') ||
        href.includes('.xlsx'));

    if (isDocumentLink) {
      return <DocumentDownloadLink href={href}>{children}</DocumentDownloadLink>;
    }

    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline break-all cursor-pointer hover:opacity-80 text-primary pointer-events-auto"
      >
        {children}
      </a>
    );
  },

  code: ({ className, children }) => {
    const isInline = !className;
    const language = className?.replace('language-', '') || '';
    const isPython = language === 'python';

    if (isInline) {
      return (
        <code className="px-1.5 py-0.5 rounded text-sm font-mono bg-glass text-primary">
          {children}
        </code>
      );
    }

    if (isPython) {
      return (
        <div className="rounded-lg overflow-hidden my-2 bg-glass">
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium border-b border-theme text-text-muted bg-blue-500/10">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.372 0 5.372 2.664 5.372 5.328v2.332h6.75v.778H3.84C1.72 8.438 0 10.5 0 13.5s1.72 5.062 3.84 5.062h2.16v-2.5c0-2.328 2.016-4.406 4.5-4.406h6.75c2.016 0 3.75-1.664 3.75-3.656V5.328C21 2.664 18.984 0 12 0zm-3.375 3.094a1.219 1.219 0 110 2.437 1.219 1.219 0 010-2.437z" />
              <path d="M18.628 8.438v2.5c0 2.328-2.016 4.406-4.5 4.406H7.378c-2.016 0-3.75 1.664-3.75 3.656v2.672c0 2.664 2.016 5.328 8.372 5.328 6.628 0 6.628-2.664 6.628-5.328v-2.332h-6.75v-.778h9.282c2.12 0 3.84-2.062 3.84-5.062s-1.72-5.062-3.84-5.062h-2.532zm-3.253 10.468a1.219 1.219 0 110 2.437 1.219 1.219 0 010-2.437z" />
            </svg>
            <span>Python</span>
          </div>
          <code className="block p-3 text-sm font-mono overflow-x-auto text-text-primary">
            {children}
          </code>
        </div>
      );
    }

    return (
      <code className="block p-3 rounded-lg text-sm font-mono overflow-x-auto my-2 bg-glass text-text-primary">
        {children}
      </code>
    );
  },

  pre: ({ children }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const childType = (children as any)?.type?.name;
    if (childType === 'code') {
      return <>{children}</>;
    }
    return <pre className="rounded-lg overflow-x-auto my-2 bg-glass">{children}</pre>;
  },

  blockquote: ({ children }) => (
    <blockquote className="border-l-4 pl-4 py-1 my-2 italic rounded-r bg-glass text-inherit border-primary">
      {children}
    </blockquote>
  ),

  hr: () => <hr className="my-4 border-theme" />,

  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-glass">{children}</thead>,
  tbody: ({ children }) => <tbody className="text-inherit">{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-theme">{children}</tr>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left text-sm font-semibold text-inherit">{children}</th>
  ),
  td: ({ children }) => <td className="px-3 py-2 text-sm text-inherit">{children}</td>,

  img: ({ src, alt }) => <InlineScreenshot src={src} alt={alt} />,
};
