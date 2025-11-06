'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ArrowLeft, RefreshCw, Share2, Loader2 } from 'lucide-react';

export default function NewsPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<string>('');
  const [timestamp, setTimestamp] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

          {/* Newspaper Header */}
          <div className="border-b-4 border-blue-900 pb-4 mb-6 bg-white rounded-t-lg px-6 pt-6 shadow-md">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-bold text-blue-900 text-center mb-2">
              THE SLINGSHOT REPORT
            </h1>
            <p className="text-center text-red-600 text-sm sm:text-base font-bold tracking-wider">
              CONSERVATIVE CHRISTIAN INTELLIGENCE
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
              <div className="prose prose-slate max-w-none
                prose-headings:font-serif prose-headings:text-blue-900
                prose-h1:text-3xl prose-h1:font-bold prose-h1:border-b-2 prose-h1:border-blue-900 prose-h1:pb-3 prose-h1:mb-6 prose-h1:mt-8 first:prose-h1:mt-0
                prose-h2:text-2xl prose-h2:font-bold prose-h2:border-b-2 prose-h2:border-slate-300 prose-h2:pb-3 prose-h2:mb-5 prose-h2:mt-10 first:prose-h2:mt-0 prose-h2:text-blue-800
                prose-h3:text-lg prose-h3:font-semibold prose-h3:text-slate-700 prose-h3:mb-3 prose-h3:mt-5
                prose-p:text-slate-700 prose-p:leading-loose prose-p:text-base prose-p:mb-5
                prose-strong:text-slate-900 prose-strong:font-bold
                prose-ul:my-4 prose-li:text-slate-700 prose-li:my-2
                prose-a:text-blue-600 prose-a:underline hover:prose-a:text-blue-800
                prose-blockquote:border-l-4 prose-blockquote:border-blue-900 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-slate-600 prose-blockquote:bg-blue-50 prose-blockquote:py-2
                prose-code:text-blue-700 prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm">
                <ReactMarkdown>{summary}</ReactMarkdown>
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
