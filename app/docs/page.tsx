import Link from 'next/link';

export const metadata = {
  title: 'Documentation | JCIL.AI',
  description: 'Comprehensive documentation for JCIL.AI - Code Lab, API Reference, and more.',
};

const DOC_SECTIONS = [
  {
    title: 'Code Lab',
    tag: 'IDE',
    desc: 'AI Development Environment documentation. Tools, features, and best practices.',
    href: '/docs/code-lab',
    status: 'available' as const,
  },
  {
    title: 'Capabilities',
    tag: '51 Tools',
    desc: 'Complete reference of all 51 production tools with descriptions and use cases.',
    href: '/capabilities',
    status: 'available' as const,
  },
  {
    title: 'API Reference',
    tag: 'REST',
    desc: 'REST API documentation for programmatic access to JCIL.AI capabilities.',
    href: '/docs/api',
    status: 'coming-soon' as const,
  },
  {
    title: 'Chat Features',
    tag: 'AI',
    desc: 'Main chat interface, agentic capabilities, memory system, and BYOK.',
    href: '/docs/chat',
    status: 'coming-soon' as const,
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
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-sm bg-background/80 border-b border-border/30">
        <div className="max-w-5xl mx-auto px-6 md:px-12 py-4">
          <nav className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="font-bebas text-2xl tracking-tight">
                <span className="text-accent">JCIL</span>
                <span className="text-muted-foreground">.AI</span>
              </Link>
              <span className="text-border/60">/</span>
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Docs</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/code-lab" className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest">
                Code Lab
              </Link>
              <Link href="/signup" className="border border-accent bg-accent/10 px-4 py-2 font-mono text-xs uppercase tracking-widest text-accent hover:bg-accent/20 transition-all">
                Get Started
              </Link>
            </div>
          </nav>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-6 md:px-12 py-16">
        {/* Hero */}
        <div className="mb-16">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Reference</span>
          <h1 className="mt-4 font-bebas text-5xl md:text-7xl tracking-tight">DOCUMENTATION</h1>
          <p className="mt-4 max-w-xl font-mono text-sm text-muted-foreground leading-relaxed">
            Everything you need to know about JCIL.AI. Comprehensive guides, tool references, and best practices.
          </p>
        </div>

        {/* Quick Links */}
        <div className="mb-16 border border-border/40 bg-card/50 backdrop-blur-sm p-6">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Quick Links</span>
          <div className="mt-4 flex flex-wrap gap-3">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.title}
                href={link.href}
                className="border border-border/40 px-4 py-2 font-mono text-xs text-foreground/70 hover:text-accent hover:border-accent/30 transition-all"
              >
                {link.title}
              </Link>
            ))}
          </div>
        </div>

        {/* Documentation Sections */}
        <div className="grid gap-4 md:grid-cols-2 mb-16">
          {DOC_SECTIONS.map((section) => (
            <Link
              key={section.title}
              href={section.status === 'available' ? section.href : '#'}
              className={`group border p-6 transition-all ${
                section.status === 'available'
                  ? 'border-border/40 hover:border-accent/40 bg-card/50 backdrop-blur-sm'
                  : 'border-border/20 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-accent">{section.tag}</span>
                {section.status === 'coming-soon' && (
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground border border-border/30 px-2 py-0.5">Soon</span>
                )}
              </div>
              <h2 className={`font-bebas text-2xl tracking-tight mb-2 ${section.status === 'available' ? 'text-foreground group-hover:text-accent' : 'text-muted-foreground'} transition-colors`}>
                {section.title.toUpperCase()}
              </h2>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">{section.desc}</p>
            </Link>
          ))}
        </div>

        {/* Code Lab Featured */}
        <div className="border border-border/40 bg-card/50 backdrop-blur-sm p-8 md:p-12 mb-16">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Featured</span>
          <h2 className="mt-4 font-bebas text-3xl md:text-4xl tracking-tight mb-6">CODE LAB DOCUMENTATION</h2>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: 'Getting Started', desc: 'Set up your first workspace', href: '/docs/code-lab#getting-started' },
              { title: 'File Operations', desc: 'Read, write, edit files', href: '/docs/code-lab#file-operations' },
              { title: 'Git Integration', desc: 'Clone, commit, push', href: '/docs/code-lab#git' },
              { title: 'Planning Mode', desc: 'Structure complex tasks', href: '/docs/code-lab#planning-mode' },
              { title: 'MCP Servers', desc: 'Extend capabilities', href: '/docs/code-lab#mcp' },
              { title: 'Best Practices', desc: 'Tips for productivity', href: '/docs/code-lab#best-practices' },
            ].map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="border border-border/30 p-4 hover:border-accent/30 transition-all group"
              >
                <h3 className="font-mono text-sm text-foreground group-hover:text-accent transition-colors mb-1">{item.title}</h3>
                <p className="font-mono text-[10px] text-muted-foreground">{item.desc}</p>
              </Link>
            ))}
          </div>

          <div className="mt-8">
            <Link href="/docs/code-lab" className="font-mono text-xs text-accent hover:text-accent/80 transition-colors uppercase tracking-widest">
              View full Code Lab documentation &rarr;
            </Link>
          </div>
        </div>

        {/* Copy for AI */}
        <div className="border border-border/40 bg-card/50 backdrop-blur-sm p-6 text-center">
          <h2 className="font-bebas text-xl tracking-tight mb-2">COPY FOR AI</h2>
          <p className="font-mono text-xs text-muted-foreground mb-4">
            Each documentation page has a &quot;Copy Page&quot; button that copies the full content in a clean format for pasting into AI assistants.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/30 py-8 mt-16">
        <div className="max-w-5xl mx-auto px-6 md:px-12 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
            &copy; {new Date().getFullYear()} JCIL.AI. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="/" className="font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest">Home</Link>
            <Link href="/code-lab" className="font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest">Code Lab</Link>
            <Link href="/contact" className="font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
