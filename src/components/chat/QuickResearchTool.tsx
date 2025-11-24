/**
 * QUICK RESEARCH TOOL
 *
 * PURPOSE:
 * - Conduct comprehensive research on any topic
 * - Use web search for current information
 * - Deliver detailed, well-organized research reports
 */

'use client';

import { useState } from 'react';

interface QuickResearchToolProps {
  onResearchComplete?: (report: string, topic: string) => void;
}

export function QuickResearchTool({ onResearchComplete }: QuickResearchToolProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [focus, setFocus] = useState('');
  const [depth, setDepth] = useState<'overview' | 'detailed' | 'comprehensive'>('detailed');
  const [isResearching, setIsResearching] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleResearch = async () => {
    if (!topic.trim()) {
      setError('Please enter a research topic');
      return;
    }

    setIsResearching(true);
    setError(null);
    setReport(null);

    try {
      const depthInstructions = {
        overview: '3-4 concise paragraphs covering main points (300-400 words)',
        detailed: '5-7 comprehensive sections with in-depth analysis (600-800 words)',
        comprehensive: '8-10 thorough sections with extensive detail and examples (1000-1200 words)',
      };

      const researchPrompt = `You are an expert researcher with access to current information. Conduct ${depth} research on this topic:

**Topic:** ${topic}
${focus ? `**Specific Focus:** ${focus}` : ''}

**Research Requirements:**
1. Use web search to find current, accurate information
2. Organize findings into clear sections with headers
3. Include:
   - Introduction and context
   - Key findings and main points
   - Supporting evidence and examples
   - Current trends or developments
   - Practical applications or implications
   - Summary and conclusions
4. Length: ${depthInstructions[depth]}
5. Cite sources naturally within the text
6. Use professional, academic tone
7. Format with markdown headers (##) and bullet points where appropriate
8. Ensure information is accurate, balanced, and up-to-date
9. Provide actionable insights and takeaways

**Make this research report detailed, well-structured, and immediately useful. Include specific facts, statistics, and examples.**`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: researchPrompt,
            },
          ],
          tool: 'research',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to conduct research');
      }

      const data = await res.json();
      const researchReport = data.content;

      setReport(researchReport);

      if (onResearchComplete) {
        onResearchComplete(researchReport, topic);
      }
    } catch (err) {
      console.error('Research error:', err);
      setError(err instanceof Error ? err.message : 'Failed to conduct research');
    }

    setIsResearching(false);
  };

  const handleCopy = () => {
    if (report) {
      navigator.clipboard.writeText(report);
    }
  };

  const handleSendEmail = () => {
    if (!report) return;

    const subject = `Research Report: ${topic}`;
    const body = `${report}`;

    const mailto = `mailto:${recipientEmail || ''}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    // Use anchor element to prevent auth session disruption
    const link = document.createElement('a');
    link.href = mailto;
    link.click();
  };

  const handleReset = () => {
    setReport(null);
    setError(null);
  };

  const handleClose = () => {
    setIsOpen(false);
    setTopic('');
    setRecipientEmail('');
    setFocus('');
    setDepth('detailed');
    setReport(null);
    setError(null);
  };

  return (
    <>
      {/* Research Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg bg-black px-3 py-2 text-xs font-medium text-white transition hover:bg-gray-800 border border-white/20"
        title="Research any topic with AI"
      >
        <span className="flex items-center gap-1.5">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <span>Research</span>
        </span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-4 md:py-10">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl mx-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-white">🔍 Research Tool</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Comprehensive research with current information
                </p>
              </div>
              <button
                onClick={handleClose}
                className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white transition"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {!report ? (
                <>
                  {/* Topic */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Research Topic <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g., Artificial Intelligence in Healthcare, Climate Change Solutions"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-400 focus:border-white/20 focus:outline-none"
                    />
                  </div>

                  {/* Recipient Email */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Recipient Email (Optional)
                    </label>
                    <input
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      placeholder="e.g., colleague@company.com"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-400 focus:border-white/20 focus:outline-none"
                    />
                    <p className="text-xs text-gray-500">
                      Required only if you want to use the &quot;Send Email&quot; button
                    </p>
                  </div>

                  {/* Specific Focus */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Specific Focus (Optional)
                    </label>
                    <input
                      type="text"
                      value={focus}
                      onChange={(e) => setFocus(e.target.value)}
                      placeholder="e.g., Recent developments, Cost analysis, Ethical considerations"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-400 focus:border-white/20 focus:outline-none"
                    />
                  </div>

                  {/* Research Depth */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">
                      Research Depth
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['overview', 'detailed', 'comprehensive'] as const).map((d) => (
                        <button
                          key={d}
                          onClick={() => setDepth(d)}
                          className={`rounded-lg px-2 py-2 text-xs font-medium transition ${
                            depth === d
                              ? 'bg-blue-500 text-white'
                              : 'bg-white/5 text-gray-400 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs">{d.charAt(0).toUpperCase() + d.slice(1)}</span>
                            <span className="text-[10px] opacity-75">
                              {d === 'overview' && '~400 words'}
                              {d === 'detailed' && '~700 words'}
                              {d === 'comprehensive' && '~1100 words'}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4">
                    <div className="flex gap-3">
                      <svg
                        className="h-5 w-5 text-blue-400 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p className="text-xs text-blue-200">
                        This tool uses web search to provide current, accurate information. Research reports include sources, analysis, and actionable insights.
                      </p>
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                      {error}
                    </div>
                  )}

                  {/* Research Button */}
                  <button
                    onClick={handleResearch}
                    disabled={!topic.trim() || isResearching}
                    className="w-full rounded-xl bg-blue-500 px-4 py-3 font-semibold text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {isResearching ? 'Researching...' : 'Start Research'}
                  </button>
                </>
              ) : (
                <>
                  {/* Research Report */}
                  <div className="space-y-4">
                    <div className="rounded-xl bg-white/5 p-6 border border-white/10">
                      <div className="prose prose-invert max-w-none">
                        <div className="text-sm leading-relaxed text-gray-200 whitespace-pre-wrap">
                          {report}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-3">
                      <button
                        onClick={handleCopy}
                        className="flex-1 rounded-xl bg-white/10 px-4 py-3 font-semibold text-white hover:bg-white/20 transition flex items-center justify-center gap-2"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        Copy Report
                      </button>
                      <button
                        onClick={handleReset}
                        className="flex-1 rounded-xl bg-white/10 px-4 py-3 font-semibold text-white hover:bg-white/20 transition"
                      >
                        New Research
                      </button>
                    </div>

                    {/* Send Email Button */}
                    <button
                      onClick={handleSendEmail}
                      className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-3 font-semibold text-white hover:from-blue-600 hover:to-purple-600 transition flex items-center justify-center gap-2"
                      title={!recipientEmail ? 'Enter recipient email to enable' : 'Open in your default email client'}
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                      {recipientEmail ? 'Send Email' : 'Send Email (Add Recipient Email)'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
