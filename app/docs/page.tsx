/**
 * DOCUMENTATION HUB PAGE
 *
 * Central documentation page with links to all documentation sections
 */

import Link from 'next/link';
import LandingLogo from '../components/LandingLogo';

export const metadata = {
  title: 'Documentation | JCIL.AI',
  description: 'Comprehensive documentation for JCIL.AI - Code Lab, API Reference, and more.',
};

const DOC_SECTIONS = [
  {
    title: 'Code Lab',
    icon: '🔬',
    desc: 'AI Development Environment documentation. Learn about tools, features, and best practices.',
    href: '/docs/code-lab',
    color: 'fuchsia',
    status: 'available',
  },
  {
    title: 'API Reference',
    icon: '🔌',
    desc: 'REST API documentation for programmatic access to JCIL.AI capabilities.',
    href: '/docs/api',
    color: 'blue',
    status: 'coming-soon',
  },
  {
    title: 'Chat Features',
    icon: '💬',
    desc: 'Learn about the main chat interface, agentic capabilities, and memory system.',
    href: '/docs/chat',
    color: 'purple',
    status: 'coming-soon',
  },
  {
    title: 'GitHub Integration',
    icon: '🐙',
    desc: 'Connect your GitHub account, manage repositories, and automate workflows.',
    href: '/docs/github',
    color: 'green',
    status: 'coming-soon',
  },
];

const QUICK_LINKS = [
  { title: 'Getting Started', href: '/docs/code-lab#getting-started' },
  { title: 'Tool Reference', href: '/docs/code-lab#tools' },
  { title: 'Planning Mode', href: '/docs/code-lab#planning-mode' },
  { title: 'MCP Servers', href: '/docs/code-lab#mcp' },
  { title: 'Hooks System', href: '/docs/code-lab#hooks' },
  { title: 'Project Memory', href: '/docs/code-lab#memory' },
];

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <LandingLogo />
              <span className="text-slate-500">/</span>
              <span className="text-slate-400 font-medium">Docs</span>
            </Link>

            <div className="flex items-center space-x-4">
              <Link href="/code-lab" className="text-slate-400 hover:text-white font-medium transition">
                Code Lab
              </Link>
              <Link
                href="/signup"
                className="rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-white font-semibold hover:shadow-lg transition-all duration-300"
              >
                Get Started
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 border-b border-slate-800">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl font-bold mb-6">
              <span className="text-white">Documentation</span>
            </h1>
            <p className="text-xl text-slate-400">
              Everything you need to know about JCIL.AI. Explore our comprehensive guides,
              API references, and best practices.
            </p>
          </div>
        </div>
      </section>

      {/* Quick Links */}
      <section className="py-8 bg-slate-900/50 border-b border-slate-800">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap gap-3">
            <span className="text-slate-500 text-sm py-2">Quick links:</span>
            {QUICK_LINKS.map((link, i) => (
              <Link
                key={i}
                href={link.href}
                className="px-4 py-2 rounded-full bg-slate-800 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition"
              >
                {link.title}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Documentation Sections */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
            {DOC_SECTIONS.map((section, i) => (
              <Link
                key={i}
                href={section.status === 'available' ? section.href : '#'}
                className={`group relative rounded-2xl p-6 border transition-all duration-300 ${
                  section.status === 'available'
                    ? `bg-slate-900/50 border-slate-800 hover:border-${section.color}-500/50 hover:bg-slate-900`
                    : 'bg-slate-900/30 border-slate-800/50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`text-4xl ${section.status !== 'available' ? 'opacity-50' : ''}`}>
                    {section.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className={`text-xl font-bold ${section.status === 'available' ? 'text-white' : 'text-slate-500'}`}>
                        {section.title}
                      </h2>
                      {section.status === 'coming-soon' && (
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-400">Coming Soon</span>
                      )}
                    </div>
                    <p className={section.status === 'available' ? 'text-slate-400' : 'text-slate-600'}>
                      {section.desc}
                    </p>
                  </div>
                </div>
                {section.status === 'available' && (
                  <div className="absolute top-6 right-6 text-slate-500 group-hover:text-white transition">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Code Lab Featured */}
      <section className="py-16 bg-gradient-to-b from-fuchsia-950/30 to-slate-950 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">🔬</span>
              <h2 className="text-2xl font-bold text-white">Code Lab Documentation</h2>
              <span className="px-2 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-300 text-xs">Featured</span>
            </div>
            <p className="text-slate-400 mb-8">
              The most comprehensive documentation for our AI Development Environment.
            </p>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { title: 'Getting Started', desc: 'Set up your first workspace', href: '/docs/code-lab#getting-started' },
                { title: 'File Operations', desc: 'Read, write, edit files', href: '/docs/code-lab#file-operations' },
                { title: 'Git Integration', desc: 'Clone, commit, push', href: '/docs/code-lab#git' },
                { title: 'Planning Mode', desc: 'Structure complex tasks', href: '/docs/code-lab#planning-mode' },
                { title: 'MCP Servers', desc: 'Extend capabilities', href: '/docs/code-lab#mcp' },
                { title: 'Best Practices', desc: 'Tips for productivity', href: '/docs/code-lab#best-practices' },
              ].map((item, i) => (
                <Link
                  key={i}
                  href={item.href}
                  className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-fuchsia-500/30 hover:bg-slate-900 transition-all"
                >
                  <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                  <p className="text-sm text-slate-500">{item.desc}</p>
                </Link>
              ))}
            </div>

            <div className="mt-8">
              <Link
                href="/docs/code-lab"
                className="inline-flex items-center gap-2 text-fuchsia-400 hover:text-fuchsia-300 font-medium transition"
              >
                View full Code Lab documentation
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Copy for AI */}
      <section className="py-16 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-white mb-4">Copy Documentation for AI</h2>
            <p className="text-slate-400 mb-6">
              Need to paste documentation into your AI assistant? Each documentation page has a
              &quot;Copy Page&quot; button that copies the full content in a clean format.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-slate-300">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Look for the Copy Page button on each doc page</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 py-12 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-slate-500 text-sm">
              &copy; {new Date().getFullYear()} JCIL.AI. All rights reserved.
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/" className="text-slate-500 hover:text-white transition">Home</Link>
              <Link href="/code-lab" className="text-slate-500 hover:text-white transition">Code Lab</Link>
              <Link href="/contact" className="text-slate-500 hover:text-white transition">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
