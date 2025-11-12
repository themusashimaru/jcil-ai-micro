/**
 * QUICK BREAKING NEWS
 * Full-page newspaper view with 11 news categories
 * Updates every 30 minutes with conservative news analysis
 */

'use client';

import { useState } from 'react';

const CATEGORIES = [
  { key: 'breaking', label: 'Breaking News' },
  { key: 'us_major', label: 'U.S. Major News' },
  { key: 'global_conflict', label: 'Global Conflict & Crisis' },
  { key: 'defense_war', label: 'Department of Defense / War' },
  { key: 'economy_markets', label: 'Economy & Markets' },
  { key: 'world_geopolitics', label: 'World / Geopolitics' },
  { key: 'politics_elections', label: 'Politics & Elections' },
  { key: 'tech_cyber', label: 'Technology & Cybersecurity' },
  { key: 'health_science', label: 'Health, Science & Environment' },
  { key: 'christian_persecution', label: 'Christian Persecution' },
  { key: 'american_good_news', label: 'American Good News' },
];

export function QuickBreakingNews() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newsContent, setNewsContent] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const fetchBreakingNews = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/breaking-news', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Failed to fetch breaking news');

      const data = await response.json();
      setNewsContent(data.content);
      setLastUpdated(new Date(data.generatedAt));

      // Auto-select "breaking" category when news loads
      if (!selectedCategory) {
        setSelectedCategory('breaking');
      }
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

    const subject = `Slingshot Conservative News - ${dateStr} at ${timeStr}`;

    // Parse and format the content for email
    let formattedContent = '';

    try {
      // Try to parse as JSON first
      let cleanedContent = newsContent.trim();
      cleanedContent = cleanedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const parsed = JSON.parse(cleanedContent);

      // If we have categories, format each one
      if (parsed.categories) {
        const categoryTitles: Record<string, string> = {
          breaking: '1. BREAKING NEWS',
          us_major: '2. U.S. MAJOR NEWS',
          global_conflict: '3. GLOBAL CONFLICT & CRISIS',
          defense_war: '4. DEPARTMENT OF DEFENSE / WAR',
          economy_markets: '5. ECONOMY & MARKETS',
          world_geopolitics: '6. WORLD / GEOPOLITICS',
          politics_elections: '7. POLITICS & ELECTIONS',
          tech_cyber: '8. TECHNOLOGY & CYBERSECURITY',
          health_science: '9. HEALTH, SCIENCE & ENVIRONMENT',
          christian_persecution: '10. CHRISTIAN PERSECUTION',
          american_good_news: '11. AMERICAN GOOD NEWS',
        };

        Object.entries(categoryTitles).forEach(([key, title]) => {
          if (parsed.categories[key]) {
            formattedContent += `\n\n═══════════════════════════════════════════\n`;
            formattedContent += `${title}\n`;
            formattedContent += `═══════════════════════════════════════════\n\n`;

            // Clean up the content: convert markdown to plain text
            const categoryContent = parsed.categories[key]
              .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold markdown but keep text
              .replace(/\n{3,}/g, '\n\n')  // Replace multiple line breaks with double
              .trim();

            formattedContent += categoryContent + '\n';
          }
        });
      }
    } catch {
      // If JSON parsing fails, use the raw content with basic cleanup
      formattedContent = newsContent
        .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold markdown
        .replace(/\n{3,}/g, '\n\n')  // Clean up excessive line breaks
        .trim();
    }

    // Format the email body with proper spacing and alignment
    const body = `SLINGSHOT CONSERVATIVE NEWS
Breaking News Report
${dateStr} at ${timeStr}

${formattedContent}

═══════════════════════════════════════════

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

  // Get the content for the selected category
  const getSelectedContent = () => {
    if (!newsContent || !selectedCategory) return '';

    // Try to parse as JSON first
    try {
      // Remove any markdown code blocks if present
      let cleanedContent = newsContent.trim();
      cleanedContent = cleanedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      const parsed = JSON.parse(cleanedContent);

      // Check if categories exist in the parsed object
      if (parsed.categories && parsed.categories[selectedCategory]) {
        return parsed.categories[selectedCategory];
      }

      // If direct category access doesn't work, try the key directly
      if (parsed[selectedCategory]) {
        return parsed[selectedCategory];
      }
    } catch {
      // If JSON parsing fails, try to find the category in plain text
      // Look for patterns like "## Breaking News" or "**1. BREAKING NEWS**"
      const categoryLabels: Record<string, string[]> = {
        breaking: ['BREAKING NEWS', 'Breaking News'],
        us_major: ['U.S. MAJOR NEWS', 'U.S. Major News'],
        global_conflict: ['GLOBAL CONFLICT', 'Global Conflict'],
        defense_war: ['DEPARTMENT OF DEFENSE', 'Defense', 'War'],
        economy_markets: ['ECONOMY', 'Markets'],
        world_geopolitics: ['WORLD', 'Geopolitics'],
        politics_elections: ['POLITICS', 'Elections'],
        tech_cyber: ['TECHNOLOGY', 'Cybersecurity'],
        health_science: ['HEALTH', 'Science', 'Environment'],
        christian_persecution: ['CHRISTIAN PERSECUTION', 'Christian Persecution'],
        american_good_news: ['AMERICAN GOOD NEWS', 'American Good News'],
      };

      // Try to extract the section for this category
      const labels = categoryLabels[selectedCategory] || [];
      for (const label of labels) {
        const regex = new RegExp(`\\*\\*.*?${label}.*?\\*\\*([\\s\\S]*?)(?=\\*\\*.*?(?:${Object.values(categoryLabels).flat().join('|')}).*?\\*\\*|$)`, 'i');
        const match = newsContent.match(regex);
        if (match && match[1]) {
          return match[1].trim();
        }
      }
    }

    // If all else fails, return the full content
    return newsContent;
  };

  return (
    <>
      {/* Breaking News Button */}
      <button
        onClick={handleOpen}
        className="rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-900 border border-blue-500"
        title="Breaking News - Conservative perspective"
      >
        <span className="flex items-center gap-1.5">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                <svg className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                  />
                </svg>
                <div>
                  <h1 className="text-xl font-bold text-white">
                    Slingshot <span className="text-xs font-normal text-gray-400">Conservative</span> <span className="text-blue-500">News</span>
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-3 ml-auto">
                {lastUpdated && (
                  <div className="text-xs text-gray-400 hidden md:block">
                    <div>Updated: {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
                    <div className="text-[10px] text-white font-medium">Updated every 30min</div>
                  </div>
                )}
                {/* Copy Button */}
                <button
                  onClick={handleCopy}
                  disabled={!newsContent}
                  className="px-3 py-2 text-sm text-white hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
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
                  className="px-3 py-2 text-sm text-white hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
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
                  className="px-3 py-2 text-sm text-white hover:text-blue-400 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
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
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                  aria-label="Close"
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
            </div>
          </div>

          {/* Category Dropdown */}
          {newsContent && !isLoading && (
            <div className="border-b border-white/10 bg-zinc-950 px-4 py-3">
              <div className="max-w-6xl mx-auto">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full md:w-96 rounded-lg bg-white/10 border border-white/20 text-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" className="bg-zinc-900">Select your topic...</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat.key} value={cat.key} className="bg-zinc-900">
                      {cat.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-500 mt-1">Updated every 30min</p>
              </div>
            </div>
          )}

          {/* Newspaper Content */}
          <div className="flex-1 overflow-y-auto bg-zinc-900">
            <div className="max-w-6xl mx-auto px-4 py-6">
              {isLoading && !newsContent && (
                <div className="flex flex-col items-center justify-center py-20">
                  <svg className="h-12 w-12 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
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
                  <p className="mt-2 text-sm text-gray-500">Conducting live search from credible sources</p>
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

              {newsContent && selectedCategory && (
                <div className="prose prose-invert max-w-none">
                  <div
                    className="whitespace-pre-wrap text-gray-200 leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: getSelectedContent()
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\n/g, '<br />')
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
