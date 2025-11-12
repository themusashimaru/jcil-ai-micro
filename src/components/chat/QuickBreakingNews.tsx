/**
 * QUICK BREAKING NEWS
 * Full-page newspaper view with 11 news categories
 * Updates every 30 minutes with conservative news analysis
 */

'use client';

import { useState } from 'react';

export function QuickBreakingNews() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newsContent, setNewsContent] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchBreakingNews = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const systemPrompt = `SYSTEM ROLE: You are the Breaking News Intelligence Desk for a national and international conservative news and analysis service. Your role is to gather, evaluate, and summarize the most important news events across key global and domestic categories. You provide fact-based, professional, college-level reporting from a traditional conservative worldview: pro-life, pro-family, pro-religious liberty, strong national defense, stable borders, constitutional freedoms, rule of law, responsible fiscal policy. Tone must be composed, calm, factual, and non-sensational.

NEWS SOURCING RULES (NO EXCEPTIONS):
Always pull facts FIRST from major credible wire services, primary documents, and official statements: AP News, Reuters, Bloomberg, Wall Street Journal (NEWS side only), Financial Times, The Economist (news desks), BBC World Service, Nikkei Asia, Al Jazeera English (for Middle East perspective differences, read critically), Defense.gov, CENTCOM, EUCOM, INDOPACOM, Pentagon briefings, State Dept releases, Congressional records.

AFTER factual grounding is established, draw interpretive and worldview framing from reputable conservative sources: National Review, The Dispatch, Washington Examiner, RealClearPolitics, Daily Signal, Christianity Today, The Gospel Coalition, The American Conservative, Wall Street Journal (Opinion side), The Federalist.

NEVER use unverified blogs, rumor networks, anonymous Telegram channels, or activist/conspiracy sites.

RANKED NEWS CATEGORIES (ALWAYS OUTPUT IN THIS ORDER):
1. BREAKING NEWS (urgent developments across all topics)
2. U.S. MAJOR NEWS (federal gov, SCOTUS, DOJ, border, national stability)
3. GLOBAL CONFLICT & CRISIS (wars, escalations, coups, insurgencies)
4. DEPARTMENT OF DEFENSE / WAR (U.S. & allied force posture, deployments, procurement)
5. ECONOMY & MARKETS (indices, commodities, inflation, employment, Fed, corporate movement)
6. WORLD / GEOPOLITICS (diplomacy, alliances, sanctions, elections abroad)
7. POLITICS & ELECTIONS (U.S. + allied democratic processes)
8. TECHNOLOGY & CYBERSECURITY (AI, cyber ops, infrastructure breaches, space domain)
9. HEALTH, SCIENCE & ENVIRONMENT (medical research, outbreaks, disasters)
10. CHRISTIAN PERSECUTION (global religious freedom violations, church attacks, targeted violence)
11. AMERICAN GOOD NEWS (courage, service, charity, recovery, community strength)

WRITING STYLE: College-educated, professional newsroom voice. Clear, structured paragraphs. No slang, hype, sarcasm, or emotional panic. Do NOT editorialize in news sections. If analysis needed, add subsection: "Context & Interpretation (Conservative Viewpoint)." When reporting on Christian persecution: respectful, factual, non-dramatic; dignity forward. When reporting American Good News: uplifting but not cheesy; emphasize courage, resilience, service, and unity.

OUTPUT FORMAT (EVERY RUN):
**BREAKING NEWS UPDATE — [Date & Time, ET]**

**1. BREAKING NEWS**
- 3–7 bullet summaries of the most urgent events.

**2. U.S. MAJOR NEWS**
[2–4 paragraph summary + 1–3 key bullets "Why it matters."]

**3. GLOBAL CONFLICT & CRISIS**
[...]

Continue for all categories in ranked order, ending with:

**11. AMERICAN GOOD NEWS**
- 1–2 stories of acts of service, unity, recovery, or courage.

_Last updated at [Time ET]. Next update in ~30 minutes._

MOBILE UI: Paragraphs ≤ 4 lines on mobile. Use bullet lists. Bold category headers only. No large tables. Include source links at end of each section.

FAILSAFES: If sourcing unclear: say "Developing — awaiting verification." If claims conflict: note "Competing reports — unresolved." Never speculate. Never sensationalize. Never invent.

Now provide the complete breaking news report following this exact format.`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: 'Generate the latest breaking news report across all 11 categories following the exact format specified.' }],
          tool: 'research',
          model: 'grok-4-0709',
        }),
      });

      if (!response.ok) throw new Error('Failed to fetch breaking news');

      const data = await response.json();
      setNewsContent(data.content);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Breaking news error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load breaking news');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!newsContent || !lastUpdated) return;

    const fullReport = `${newsContent}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nBrought to you by JCIL.ai Slingshot 2.0\nVisit: https://jcil.ai`;

    try {
      await navigator.clipboard.writeText(fullReport);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleEmail = () => {
    if (!newsContent || !lastUpdated) return;

    const dateStr = lastUpdated.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const timeStr = lastUpdated.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    const subject = `Breaking News Report - ${dateStr} at ${timeStr}`;

    // Format the email body with proper spacing and alignment
    const body = `Breaking News Report
${dateStr} at ${timeStr}

${newsContent}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Brought to you by JCIL.ai Slingshot 2.0
Visit: https://jcil.ai

Faith-based AI tools for your everyday needs`;

    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
  };

  const handleOpen = () => {
    setIsOpen(true);
    if (!newsContent) {
      fetchBreakingNews();
    }
  };

  return (
    <>
      {/* Breaking News Button */}
      <button
        onClick={handleOpen}
        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 border border-red-500"
        title="Breaking News - Conservative perspective"
      >
        <span className="flex items-center gap-2">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
            />
          </svg>
          <span>Breaking News</span>
        </span>
      </button>

      {/* Full-Page Newspaper Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          {/* Newspaper Header */}
          <div className="border-b border-white/20 bg-zinc-950 px-4 py-3">
            <div className="flex items-center justify-between max-w-6xl mx-auto">
              <div className="flex items-center gap-3">
                <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                  />
                </svg>
                <div>
                  <h1 className="text-xl font-bold text-white">JCIL Breaking News</h1>
                  <p className="text-xs text-gray-400">Conservative Perspective</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {lastUpdated && (
                  <span className="text-xs text-gray-400 hidden md:inline">
                    Updated: {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </span>
                )}
                {/* Copy Button */}
                <button
                  onClick={handleCopy}
                  disabled={!newsContent}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  title="Copy report to clipboard"
                >
                  {copied ? (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="hidden sm:inline">Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                        />
                      </svg>
                      <span className="hidden sm:inline">Copy</span>
                    </>
                  )}
                </button>
                {/* Email Button */}
                <button
                  onClick={handleEmail}
                  disabled={!newsContent}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  title="Email report"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="hidden sm:inline">Email</span>
                </button>
                {/* Refresh Button */}
                <button
                  onClick={fetchBreakingNews}
                  disabled={isLoading}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <span className="hidden sm:inline">{isLoading ? 'Updating...' : 'Refresh'}</span>
                </button>
                {/* Close Button */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white"
                  aria-label="Close"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Newspaper Content */}
          <div className="flex-1 overflow-y-auto bg-zinc-900">
            <div className="max-w-6xl mx-auto px-4 py-6">
              {isLoading && !newsContent && (
                <div className="flex flex-col items-center justify-center py-20">
                  <svg className="h-12 w-12 animate-spin text-red-500" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <p className="mt-4 text-lg text-gray-300">Loading breaking news...</p>
                  <p className="mt-2 text-sm text-gray-500">Gathering reports from credible sources</p>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center">
                  <p className="text-red-300">{error}</p>
                  <button
                    onClick={fetchBreakingNews}
                    className="mt-4 rounded-lg bg-red-500 px-4 py-2 text-white hover:bg-red-600"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {newsContent && (
                <div className="prose prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-gray-200 leading-relaxed">
                    {newsContent}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
