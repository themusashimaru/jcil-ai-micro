/**
 * SKIP NAVIGATION LINKS - LOW-009 FIX
 *
 * Accessibility component that allows keyboard users to:
 * - Skip repetitive navigation
 * - Jump directly to main content
 * - Navigate between major landmarks
 *
 * WCAG 2.1 Level A: 2.4.1 Bypass Blocks
 */

'use client';

import { useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface SkipLink {
  /** Target element ID (without #) */
  id: string;
  /** Display label for the link */
  label: string;
}

interface SkipLinksProps {
  /** Custom links to show (defaults to main content only) */
  links?: SkipLink[];
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// DEFAULT LINKS
// ============================================================================

const DEFAULT_LINKS: SkipLink[] = [{ id: 'main-content', label: 'Skip to main content' }];

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Skip Links Component
 *
 * Renders visually hidden skip links that become visible on focus.
 * These links allow keyboard users to bypass navigation.
 *
 * @example
 * ```tsx
 * // In your layout component
 * export default function Layout({ children }) {
 *   return (
 *     <>
 *       <SkipLinks />
 *       <nav>...</nav>
 *       <main id="main-content">
 *         {children}
 *       </main>
 *     </>
 *   );
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With custom links
 * <SkipLinks
 *   links={[
 *     { id: 'main-content', label: 'Skip to main content' },
 *     { id: 'sidebar', label: 'Skip to sidebar' },
 *     { id: 'search', label: 'Skip to search' },
 *   ]}
 * />
 * ```
 */
export function SkipLinks({ links = DEFAULT_LINKS, className = '' }: SkipLinksProps) {
  const [focusedLink, setFocusedLink] = useState<string | null>(null);

  const handleClick = (targetId: string) => {
    const target = document.getElementById(targetId);
    if (target) {
      // Make target focusable if it isn't already
      if (!target.hasAttribute('tabindex')) {
        target.setAttribute('tabindex', '-1');
      }
      target.focus({ preventScroll: false });
      // Scroll to target with offset for any fixed headers
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <nav aria-label="Skip links" className={`skip-links ${className}`}>
      {links.map((link) => (
        <a
          key={link.id}
          href={`#${link.id}`}
          className={`skip-link ${focusedLink === link.id ? 'skip-link--focused' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            handleClick(link.id);
          }}
          onFocus={() => setFocusedLink(link.id)}
          onBlur={() => setFocusedLink(null)}
        >
          {link.label}
        </a>
      ))}
      <style jsx>{`
        .skip-links {
          position: fixed;
          top: 0;
          left: 0;
          z-index: 9999;
          display: flex;
          gap: 0.5rem;
          padding: 0.5rem;
        }

        .skip-link {
          position: absolute;
          left: -9999px;
          top: 0.5rem;
          padding: 0.75rem 1rem;
          background: var(--primary, #6366f1);
          color: white;
          font-size: 0.875rem;
          font-weight: 500;
          text-decoration: none;
          border-radius: 0.375rem;
          box-shadow:
            0 4px 6px -1px rgba(0, 0, 0, 0.1),
            0 2px 4px -1px rgba(0, 0, 0, 0.06);
          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease;
        }

        .skip-link:focus {
          position: relative;
          left: auto;
          outline: none;
          box-shadow:
            0 0 0 3px rgba(99, 102, 241, 0.4),
            0 4px 6px -1px rgba(0, 0, 0, 0.1),
            0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }

        .skip-link:hover {
          transform: translateY(-1px);
        }

        .skip-link:active {
          transform: translateY(0);
        }

        /* High contrast mode support */
        @media (forced-colors: active) {
          .skip-link:focus {
            outline: 3px solid CanvasText;
          }
        }
      `}</style>
    </nav>
  );
}

// ============================================================================
// SKIP LINK TARGET COMPONENT
// ============================================================================

interface SkipLinkTargetProps {
  /** Target ID that matches a skip link */
  id: string;
  /** Children to render */
  children?: React.ReactNode;
  /** Element type (default: div) */
  as?: keyof JSX.IntrinsicElements;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Skip Link Target
 *
 * Marks an element as a skip link destination.
 * Automatically handles focus and tabindex attributes.
 *
 * @example
 * ```tsx
 * <SkipLinkTarget id="main-content" as="main">
 *   {children}
 * </SkipLinkTarget>
 * ```
 */
export function SkipLinkTarget({
  id,
  children,
  as: Component = 'div',
  className = '',
}: SkipLinkTargetProps) {
  const Element = Component as React.ElementType;
  return (
    <Element id={id} tabIndex={-1} className={`skip-link-target ${className}`}>
      {children}
      <style jsx>{`
        .skip-link-target:focus {
          outline: none;
        }
        .skip-link-target:focus-visible {
          outline: 2px solid var(--primary, #6366f1);
          outline-offset: 2px;
        }
      `}</style>
    </Element>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default SkipLinks;
