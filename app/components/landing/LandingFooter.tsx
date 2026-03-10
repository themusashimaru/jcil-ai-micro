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
      { label: 'Pricing', href: '/#pricing' },
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
              <Link href="/" className="inline-flex items-center gap-2.5">
                <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-500">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5 text-zinc-900"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  >
                    <line x1="12" y1="4" x2="12" y2="20" />
                    <line x1="6" y1="10" x2="18" y2="10" />
                  </svg>
                </div>
                <span className="text-lg font-bold tracking-tight text-white">
                  JCIL<span className="text-amber-400">.AI</span>
                </span>
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
