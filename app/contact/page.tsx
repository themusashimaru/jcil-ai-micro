import Link from 'next/link';
import ContactForm from '@/components/contact-form';

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-sm bg-background/80 border-b border-border/30">
        <div className="max-w-5xl mx-auto px-6 md:px-12 py-4">
          <nav className="flex items-center justify-between">
            <Link href="/" className="font-bebas text-2xl tracking-tight">
              <span className="text-accent">JCIL</span>
              <span className="text-muted-foreground">.AI</span>
            </Link>
            <Link href="/" className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest">
              &larr; Back to Home
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-6 md:px-12 py-16">
        {/* Hero */}
        <div className="mb-16">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Connect</span>
          <h1 className="mt-4 font-bebas text-5xl md:text-7xl tracking-tight">CONTACT</h1>
          <p className="mt-4 max-w-xl font-mono text-sm text-muted-foreground leading-relaxed">
            Questions, feedback, or partnership inquiries.
          </p>
        </div>

        {/* Contact Form */}
        <div className="max-w-2xl">
          <div className="border border-border/40 bg-card/50 backdrop-blur-sm p-8">
            <ContactForm />
          </div>

          {/* Quick Links */}
          <div className="mt-8 border border-border/40 bg-card/50 backdrop-blur-sm p-6">
            <h3 className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-center">Quick Links</h3>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/faq"
                className="border border-border/40 px-4 py-2 font-mono text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all"
              >
                FAQ
              </Link>
              <Link
                href="/privacy"
                className="border border-border/40 px-4 py-2 font-mono text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="border border-border/40 px-4 py-2 font-mono text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/30 py-8">
        <div className="max-w-5xl mx-auto px-6 md:px-12 text-center">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
            &copy; {new Date().getFullYear()} JCIL.AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
