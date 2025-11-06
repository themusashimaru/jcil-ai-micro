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
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={() => router.push('/')}
              className="text-slate-300 hover:text-white hover:bg-slate-800"
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
                className="text-slate-300 hover:text-white hover:bg-slate-800"
                title="Refresh News"
              >
                <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleShare}
                disabled={isLoading}
                className="text-slate-300 hover:text-white hover:bg-slate-800"
                title="Share"
              >
                <Share2 className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Newspaper Header */}
          <div className="border-b-4 border-red-600 pb-4 mb-6 bg-slate-800 rounded-t-lg px-6 pt-6">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-bold text-white text-center mb-2">
              THE JCIL REPORT
            </h1>
            <p className="text-center text-red-500 text-sm sm:text-base font-bold tracking-wider">
              CONSERVATIVE CHRISTIAN ANALYSIS
            </p>
            {timestamp && (
              <p className="text-center text-slate-400 text-xs sm:text-sm mt-2">
                {formatTimestamp(timestamp)}
              </p>
            )}
          </div>
        </div>

        {/* Content */}
        <Card className="shadow-2xl border-slate-700 bg-slate-800">
          <CardContent className="p-6 sm:p-8 md:p-12">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="h-12 w-12 text-red-500 animate-spin mb-4" />
                <p className="text-slate-200 text-lg font-semibold">Analyzing Global Developments...</p>
                <p className="text-slate-400 text-sm mt-2">PhD-Level Intelligence Report in Progress</p>
              </div>
            ) : (
              <div className="prose prose-invert prose-slate max-w-none
                prose-headings:font-serif prose-headings:text-red-500
                prose-h1:text-4xl prose-h1:font-bold prose-h1:border-b-2 prose-h1:border-red-600 prose-h1:pb-3 prose-h1:mb-6
                prose-h2:text-3xl prose-h2:font-bold prose-h2:border-b prose-h2:border-slate-600 prose-h2:pb-2 prose-h2:mb-4 prose-h2:mt-10 first:prose-h2:mt-0
                prose-h3:text-xl prose-h3:font-semibold prose-h3:text-slate-300 prose-h3:mb-3 prose-h3:mt-6
                prose-p:text-slate-200 prose-p:leading-relaxed prose-p:text-base prose-p:mb-4
                prose-strong:text-white prose-strong:font-bold
                prose-ul:my-4 prose-li:text-slate-200 prose-li:my-2
                prose-a:text-red-400 prose-a:no-underline hover:prose-a:text-red-300
                prose-blockquote:border-l-4 prose-blockquote:border-red-600 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-slate-300
                prose-code:text-red-400 prose-code:bg-slate-900 prose-code:px-1 prose-code:rounded">
                <ReactMarkdown>{summary}</ReactMarkdown>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer Note */}
        <div className="mt-6 text-center text-xs text-slate-400">
          <p className="font-semibold">Intelligence Report • Updated Every 30 Minutes • Powered by Claude Sonnet 4.5</p>
          <p className="mt-1">Sources: Fox News, Newsmax, WSJ, Bloomberg, Reuters, AP, The Epoch Times, Zero Hedge, National Review, Christian Post, and verified independent analysts</p>
          <p className="mt-2 text-red-500 font-bold">🔥 TRUTH. ANALYSIS. CONVICTION. 🔥</p>
        </div>
      </div>
    </div>
  );
}
