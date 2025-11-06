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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={() => router.push('/')}
              className="hover:bg-slate-100"
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
                className="hover:bg-slate-100"
                title="Refresh News"
              >
                <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleShare}
                disabled={isLoading}
                className="hover:bg-slate-100"
                title="Share"
              >
                <Share2 className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Newspaper Header */}
          <div className="border-b-4 border-blue-900 pb-4 mb-6">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-bold text-blue-900 text-center mb-2">
              JCIL.AI News
            </h1>
            <p className="text-center text-slate-600 text-sm sm:text-base font-semibold">
              Conservative Christian Perspective
            </p>
            {timestamp && (
              <p className="text-center text-slate-500 text-xs sm:text-sm mt-2">
                {formatTimestamp(timestamp)}
              </p>
            )}
          </div>
        </div>

        {/* Content */}
        <Card className="shadow-xl border-slate-200">
          <CardContent className="p-6 sm:p-8 md:p-10">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-12 w-12 text-blue-900 animate-spin mb-4" />
                <p className="text-slate-600 text-lg">Generating today's news summary...</p>
                <p className="text-slate-500 text-sm mt-2">Analyzing verified sources with AI</p>
              </div>
            ) : (
              <div className="prose prose-slate max-w-none prose-headings:font-serif prose-headings:text-blue-900 prose-h2:text-2xl prose-h2:font-bold prose-h2:border-b-2 prose-h2:border-slate-200 prose-h2:pb-2 prose-h2:mb-4 prose-h2:mt-8 first:prose-h2:mt-0 prose-p:text-slate-700 prose-p:leading-relaxed prose-li:text-slate-700 prose-strong:text-slate-900 prose-strong:font-bold prose-ul:my-4 prose-li:my-2">
                <ReactMarkdown>{summary}</ReactMarkdown>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer Note */}
        <div className="mt-6 text-center text-xs text-slate-500">
          <p>News summaries are updated every 30 minutes and generated by Claude Sonnet 4.5</p>
          <p className="mt-1">Sources: Fox News, WSJ, AP, Reuters, Christian Post, National Review, and other verified outlets</p>
          <p className="mt-2">🙏 Stay informed. Stay grounded in Truth.</p>
        </div>
      </div>
    </div>
  );
}
