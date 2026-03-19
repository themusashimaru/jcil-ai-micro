/**
 * LANDING FOOTER
 *
 * Clean footer with navigation columns.
 * Composio-inspired unified styling.
 */

import Link from 'next/link';

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

interface FooterSection {
  title: string;
  links: FooterLink[];
}

const footerLinks: Record<string, FooterSection> = {
  products: {
    title: 'Products',
    links: [
      { label: 'Chat', href: '/chat' },
      { label: 'Code Lab', href: '/code-lab/about' },
      { label: 'Pricing', href: '/signup' },
    ],
  },
  resources: {
    title: 'Resources',
    links: [
      { label: 'Documentation', href: '/docs' },
      { label: 'About', href: '/about' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  legal: {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Cookie Policy', href: '/cookies' },
    ],
  },
};

export default function LandingFooter() {
  return (
    <footer className="border-t border-white/[0.04]" role="contentinfo">
      <div className="mx-auto max-w-6xl px-6">
        <div className="py-12 lg:py-16">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:grid-cols-4">
            {/* Brand */}
            <div className="col-span-2 sm:col-span-4 lg:col-span-1 lg:pr-8">
              <Link href="/" className="inline-block">
                <span className="text-xl font-bold text-white">JCIL.AI</span>
              </Link>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-400">
                Enterprise AI built for Christians. Real tools, real intelligence, grounded in
                Scripture.
              </p>
              <p className="mt-4 max-w-xs text-xs italic text-zinc-500">
                &ldquo;Whatever you do, work at it with all your heart, as working for the
                Lord.&rdquo;
                <span className="mt-1 block not-italic text-zinc-500">(Colossians 3:23)</span>
              </p>
            </div>

            {/* Link Columns */}
            {Object.values(footerLinks).map((section) => (
              <div key={section.title}>
                <h3 className="text-sm font-semibold text-white">{section.title}</h3>
                <ul className="mt-4 space-y-3">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      {link.external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-white"
                        >
                          {link.label}
                          <svg
                            className="h-3 w-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="text-sm text-zinc-400 transition-colors hover:text-white"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-white/[0.04] py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-500">
              &copy; {new Date().getFullYear()} JCIL.AI. All rights reserved.
            </p>
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              All systems operational
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
