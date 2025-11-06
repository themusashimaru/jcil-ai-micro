'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ArrowLeft, RefreshCw, Share2, Loader2, List, ChevronDown } from 'lucide-react';

export default function NewsPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<string>('');
  const [timestamp, setTimestamp] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showTOC, setShowTOC] = useState(false);

  const fetchNewsSummary = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/news-summary');
      const data = await response.json();

      if (data.ok) {
        setSummary(data.summary.summary || '');
        setTimestamp(data.timestamp);
      } else {
        console.error('Failed to fetch news:', data.error);
      }
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNewsSummary();
  }, []);

  const handleShare = async () => {
    const shareText = `JCIL.AI News Summary - Conservative Christian Perspective\n\nGenerated: ${formatTimestamp(timestamp)}\n\n${summary.substring(0, 200)}...\n\nRead more at ${window.location.href}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'JCIL.AI News Summary',
          text: shareText,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareText);
      alert('News summary link copied to clipboard!');
    }
  };

  const formatTimestamp = (ts: string) => {
    if (!ts) return '';
    // Format: YYYY-MM-DD-HH-MM -> readable format
    const [year, month, day, hour, minute] = ts.split('-');
    const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute)));
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  // Extract section headings for Table of Contents
  const sections = useMemo(() => {
    if (!summary) return [];

    // Match ## headings (h2 in markdown)
    const headingRegex = /^##\s+(.+)$/gm;
    const matches = [...summary.matchAll(headingRegex)];

    return matches.map((match, index) => ({
      id: `section-${index}`,
      title: match[1].trim(),
    }));
  }, [summary]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setShowTOC(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={() => router.push('/')}
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-200"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Chat
            </Button>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchNewsSummary}
                disabled={isRefreshing}
                className="text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                title="Refresh News"
              >
                <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleShare}
                disabled={isLoading}
                className="text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                title="Share"
              >
                <Share2 className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Navigate to Topics Button - Prominent */}
          {!isLoading && sections.length > 0 && (
            <div className="relative mb-4">
              <Button
                onClick={() => setShowTOC(!showTOC)}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-4 text-base shadow-lg"
              >
                <List className="h-5 w-5 mr-2" />
                {showTOC ? 'Hide Topics' : 'Navigate to Topics'}
                <ChevronDown className={`h-5 w-5 ml-2 transition-transform ${showTOC ? 'rotate-180' : 'animate-bounce'}`} />
              </Button>
              {!showTOC && (
                <div className="absolute -top-8 right-4 flex items-center gap-1 text-red-600 font-bold text-sm animate-pulse">
                  <span>Click Here!</span>
                  <ChevronDown className="h-4 w-4" />
                </div>
              )}
            </div>
          )}

          {/* Newspaper Header */}
          <div className="border-b-4 border-blue-900 pb-4 mb-6 bg-white rounded-t-lg px-6 pt-6 shadow-md">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-bold text-blue-900 text-center mb-2">
              THE SLINGSHOT REPORT
            </h1>
            <p className="text-center text-red-600 text-sm sm:text-base font-bold tracking-wider">
              Conservative Intelligence
            </p>
            {timestamp && (
              <p className="text-center text-slate-600 text-xs sm:text-sm mt-2">
                {formatTimestamp(timestamp)}
              </p>
            )}
            <p className="text-center text-blue-700 text-xs mt-1 font-semibold">
              ⚡ Updated Every 30 Minutes • Live Breaking News Analysis
            </p>
          </div>

          {/* Table of Contents */}
          {showTOC && sections.length > 0 && (
            <Card className="mb-6 shadow-lg border-blue-200 bg-blue-50">
              <CardContent className="p-4 sm:p-6">
                <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
                  <List className="h-5 w-5" />
                  Jump to Section
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className="text-left px-4 py-2 bg-white hover:bg-blue-100 rounded-lg text-sm font-medium text-slate-700 hover:text-blue-900 transition-colors border border-blue-200 hover:border-blue-400"
                    >
                      {section.title}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Content */}
        <Card className="shadow-lg border-slate-200 bg-white">
          <CardContent className="p-6 sm:p-8 md:p-10">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-12 w-12 text-blue-900 animate-spin mb-4" />
                <p className="text-slate-700 text-lg font-semibold">Fetching Breaking News...</p>
                <p className="text-slate-500 text-sm mt-2">PhD-Level Intelligence Report in Progress</p>
              </div>
            ) : (
              <div className="text-slate-900">
                <ReactMarkdown
                  components={{
                    h2: ({ node, children, ...props }) => {
                      const text = String(children);
                      const index = sections.findIndex((s) => s.title === text);
                      const id = index !== -1 ? sections[index].id : undefined;
                      return (
                        <h2 id={id} className="text-2xl font-extrabold text-blue-900 bg-blue-50 px-4 py-3 mt-10 mb-6 first:mt-0 rounded-lg border-b-4 border-blue-700" {...props}>
                          {children}
                        </h2>
                      );
                    },
                    h3: ({ node, children, ...props }) => (
                      <h3 className="text-xl font-bold text-slate-900 mt-6 mb-4" {...props}>
                        {children}
                      </h3>
                    ),
                    p: ({ node, children, ...props }) => (
                      <p className="text-base text-slate-900 leading-loose mb-5" {...props}>
                        {children}
                      </p>
                    ),
                    strong: ({ node, children, ...props }) => (
                      <strong className="font-extrabold text-slate-950" {...props}>
                        {children}
                      </strong>
                    ),
                    a: ({ node, children, ...props }) => (
                      <a className="text-blue-700 underline hover:text-blue-900" {...props}>
                        {children}
                      </a>
                    ),
                    ul: ({ node, children, ...props }) => (
                      <ul className="my-4 list-disc list-inside text-slate-900" {...props}>
                        {children}
                      </ul>
                    ),
                    li: ({ node, children, ...props }) => (
                      <li className="my-2 text-slate-900" {...props}>
                        {children}
                      </li>
                    ),
                    blockquote: ({ node, children, ...props }) => (
                      <blockquote className="border-l-4 border-blue-900 pl-4 py-2 my-4 italic text-slate-800 bg-blue-50" {...props}>
                        {children}
                      </blockquote>
                    ),
                  }}
                >
                  {summary}
                </ReactMarkdown>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer Note */}
        <div className="mt-6 text-center text-xs text-slate-600 bg-white rounded-lg py-4 px-6 shadow-sm">
          <p className="font-semibold text-blue-900 text-sm">📰 Intelligence Report • Updated Every 30 Minutes • Powered by Claude Sonnet 4.5</p>
          <p className="mt-2 text-slate-600 leading-relaxed">
            <span className="font-semibold text-slate-700">Sources:</span> NewsAPI (Live Breaking News), Fox News, Newsmax, WSJ, Bloomberg, Reuters, AP, The Epoch Times, Zero Hedge, National Review, Christian Post, and verified independent analysts
          </p>
          <p className="mt-3 text-red-600 font-bold text-sm">🔥 TRUTH. ANALYSIS. CONVICTION. 🔥</p>
        </div>
      </div>
    </div>
  );
}
