'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ArrowLeft, Loader2, Share2, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function DevotionalPage() {
  const router = useRouter();
  const [devotional, setDevotional] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const fetchDevotional = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/devotional');
      const data = await response.json();

      if (data.ok) {
        setDevotional(data.devotional);
        setDate(data.date);
      } else {
        setError(data.error || 'Failed to load devotional');
      }
    } catch (err) {
      console.error('Error fetching devotional:', err);
      setError('Failed to load devotional. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDevotional();
  }, []);

  const handleShare = async () => {
    const shareText = `Daily Devotional from Slingshot\n\n${devotional.substring(0, 200)}...\n\nRead more at ${window.location.origin}/devotional`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Daily Devotional - Slingshot',
          text: shareText,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share cancelled or failed:', err);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareText);
      alert('Devotional link copied to clipboard!');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => router.push('/')}
              className="text-slate-700 hover:bg-slate-100"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back to Chat
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchDevotional}
                disabled={isLoading}
                className="text-slate-700 hover:bg-slate-100"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleShare}
                className="text-slate-700 hover:bg-slate-100"
                title="Share"
              >
                <Share2 className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Card className="shadow-lg border-slate-200">
          <CardHeader className="bg-gradient-to-r from-blue-900 to-blue-800 text-white rounded-t-lg">
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-2">Daily Devotional</h1>
              <p className="text-blue-100 text-sm">
                {date
                  ? new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : 'Loading...'}
              </p>
            </div>
          </CardHeader>

          <CardContent className="p-6 sm:p-8">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-12 h-12 text-blue-900 animate-spin mb-4" />
                <p className="text-slate-600">Loading today's devotional...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-600 mb-4">{error}</p>
                <Button onClick={fetchDevotional} className="bg-blue-900 hover:bg-blue-950">
                  Try Again
                </Button>
              </div>
            ) : (
              <div className="prose prose-slate max-w-none">
                <ReactMarkdown
                  components={{
                    h1: ({ node, ...props }) => (
                      <h1 className="text-3xl font-bold text-blue-900 mb-4" {...props} />
                    ),
                    h2: ({ node, ...props }) => (
                      <h2 className="text-2xl font-semibold text-slate-800 mt-6 mb-3" {...props} />
                    ),
                    p: ({ node, ...props }) => (
                      <p className="text-slate-700 leading-relaxed mb-4" {...props} />
                    ),
                    strong: ({ node, ...props }) => (
                      <strong className="text-blue-900 font-semibold" {...props} />
                    ),
                    blockquote: ({ node, ...props }) => (
                      <blockquote
                        className="border-l-4 border-blue-900 pl-4 italic text-slate-600 my-4"
                        {...props}
                      />
                    ),
                  }}
                >
                  {devotional}
                </ReactMarkdown>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Community Note */}
        {!isLoading && !error && (
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              🙏 This devotional is shared with the entire Slingshot community today.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
