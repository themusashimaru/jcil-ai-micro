'use client';

/**
 * BROWSER PREVIEW WINDOW
 *
 * A futuristic miniature browser that shows:
 * - Real screenshots flashing by
 * - URLs in address bar
 * - Search queries animating
 * - Website visits with visual feedback
 *
 * Creates the "AI at work" experience that makes users feel the value.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Globe,
  Camera,
  Shield,
  Zap,
  Terminal,
  Eye,
  RefreshCw,
  Lock,
  Sparkles,
  Table2,
  FormInput,
  Layers,
  ScrollText,
  FileText,
  GitCompare,
} from 'lucide-react';
import type { StrategyStreamEvent } from '@/agents/strategy';

interface BrowserPreviewWindowProps {
  events: StrategyStreamEvent[];
  isComplete: boolean;
}

interface ActivityItem {
  id: string;
  type:
    | 'search'
    | 'visit'
    | 'screenshot'
    | 'code'
    | 'vision'
    | 'table'
    | 'form'
    | 'paginate'
    | 'scroll'
    | 'pdf'
    | 'compare';
  content: string;
  timestamp: number;
  url?: string;
  agentName?: string;
}

export function BrowserPreviewWindow({ events, isComplete }: BrowserPreviewWindowProps) {
  const [currentActivity, setCurrentActivity] = useState<ActivityItem | null>(null);
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [flashEffect, setFlashEffect] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract activities from events
  const allActivities = useMemo(() => {
    const activities: ActivityItem[] = [];

    for (const event of events) {
      if (event.type === 'search_executing' && event.data?.searchQuery) {
        activities.push({
          id: `search_${event.timestamp}_${Math.random()}`,
          type: 'search',
          content: String(event.data.searchQuery),
          timestamp: event.timestamp,
          agentName: event.data?.agentName as string | undefined,
        });
      }

      if (event.type === 'browser_visiting' && event.data?.url) {
        const url = String(event.data.url);
        activities.push({
          id: `visit_${event.timestamp}_${Math.random()}`,
          type: 'visit',
          content: extractDomain(url),
          timestamp: event.timestamp,
          url,
          agentName: event.data?.agentName as string | undefined,
        });
      }

      if (event.type === 'screenshot_captured' && event.data?.url) {
        const url = String(event.data.url);
        activities.push({
          id: `screenshot_${event.timestamp}_${Math.random()}`,
          type: 'screenshot',
          content: extractDomain(url),
          timestamp: event.timestamp,
          url,
          agentName: event.data?.agentName as string | undefined,
        });
      }

      if (event.type === 'code_executing') {
        activities.push({
          id: `code_${event.timestamp}_${Math.random()}`,
          type: 'code',
          content: `${event.data?.language || 'python'} analysis`,
          timestamp: event.timestamp,
          agentName: event.data?.agentName as string | undefined,
        });
      }

      // New tool events
      if (event.type === 'vision_analyzing' && event.data?.url) {
        const url = String(event.data.url);
        activities.push({
          id: `vision_${event.timestamp}_${Math.random()}`,
          type: 'vision',
          content: extractDomain(url),
          timestamp: event.timestamp,
          url,
          agentName: event.data?.agentName as string | undefined,
        });
      }

      if (event.type === 'table_extracting' && event.data?.url) {
        const url = String(event.data.url);
        activities.push({
          id: `table_${event.timestamp}_${Math.random()}`,
          type: 'table',
          content: extractDomain(url),
          timestamp: event.timestamp,
          url,
          agentName: event.data?.agentName as string | undefined,
        });
      }

      if (event.type === 'form_filling' && event.data?.url) {
        const url = String(event.data.url);
        activities.push({
          id: `form_${event.timestamp}_${Math.random()}`,
          type: 'form',
          content: extractDomain(url),
          timestamp: event.timestamp,
          url,
          agentName: event.data?.agentName as string | undefined,
        });
      }

      if (event.type === 'paginating' && event.data?.url) {
        const url = String(event.data.url);
        activities.push({
          id: `paginate_${event.timestamp}_${Math.random()}`,
          type: 'paginate',
          content: extractDomain(url),
          timestamp: event.timestamp,
          url,
          agentName: event.data?.agentName as string | undefined,
        });
      }

      if (event.type === 'scrolling' && event.data?.url) {
        const url = String(event.data.url);
        activities.push({
          id: `scroll_${event.timestamp}_${Math.random()}`,
          type: 'scroll',
          content: extractDomain(url),
          timestamp: event.timestamp,
          url,
          agentName: event.data?.agentName as string | undefined,
        });
      }

      if (event.type === 'pdf_extracting' && event.data?.url) {
        const url = String(event.data.url);
        activities.push({
          id: `pdf_${event.timestamp}_${Math.random()}`,
          type: 'pdf',
          content: extractDomain(url),
          timestamp: event.timestamp,
          url,
          agentName: event.data?.agentName as string | undefined,
        });
      }

      if (event.type === 'comparing') {
        activities.push({
          id: `compare_${event.timestamp}_${Math.random()}`,
          type: 'compare',
          content: `Comparing ${event.data?.urlCount || 2} pages`,
          timestamp: event.timestamp,
          agentName: event.data?.agentName as string | undefined,
        });
      }
    }

    return activities.sort((a, b) => b.timestamp - a.timestamp);
  }, [events]);

  // Count activities
  const counts = useMemo(
    () => ({
      search: allActivities.filter((a) => a.type === 'search').length,
      visit: allActivities.filter((a) => a.type === 'visit').length,
      screenshot: allActivities.filter((a) => a.type === 'screenshot').length,
      code: allActivities.filter((a) => a.type === 'code').length,
      // New tools - grouped for display
      vision: allActivities.filter(
        (a) => a.type === 'vision' || a.type === 'table' || a.type === 'compare'
      ).length,
      interactive: allActivities.filter(
        (a) => a.type === 'form' || a.type === 'paginate' || a.type === 'scroll'
      ).length,
      pdf: allActivities.filter((a) => a.type === 'pdf').length,
    }),
    [allActivities]
  );

  // Update current activity and trigger flash
  useEffect(() => {
    if (allActivities.length > 0) {
      const newest = allActivities[0];
      if (!currentActivity || newest.id !== currentActivity.id) {
        setCurrentActivity(newest);
        setFlashEffect(true);
        setTimeout(() => setFlashEffect(false), 300);
      }
      setRecentActivities(allActivities.slice(0, 6));
    }
  }, [allActivities, currentActivity]);

  if (allActivities.length === 0) {
    return null;
  }

  const getTypeColor = (type: ActivityItem['type']): { bg: string; text: string; glow: string } => {
    switch (type) {
      case 'search':
        return { bg: 'bg-yellow-500', text: 'text-yellow-400', glow: 'shadow-yellow-500/50' };
      case 'visit':
        return { bg: 'bg-cyan-500', text: 'text-cyan-400', glow: 'shadow-cyan-500/50' };
      case 'screenshot':
        return { bg: 'bg-pink-500', text: 'text-pink-400', glow: 'shadow-pink-500/50' };
      case 'code':
        return { bg: 'bg-emerald-500', text: 'text-emerald-400', glow: 'shadow-emerald-500/50' };
      // New tool colors
      case 'vision':
        return { bg: 'bg-purple-500', text: 'text-purple-400', glow: 'shadow-purple-500/50' };
      case 'table':
        return { bg: 'bg-indigo-500', text: 'text-indigo-400', glow: 'shadow-indigo-500/50' };
      case 'form':
        return { bg: 'bg-orange-500', text: 'text-orange-400', glow: 'shadow-orange-500/50' };
      case 'paginate':
        return { bg: 'bg-blue-500', text: 'text-blue-400', glow: 'shadow-blue-500/50' };
      case 'scroll':
        return { bg: 'bg-teal-500', text: 'text-teal-400', glow: 'shadow-teal-500/50' };
      case 'pdf':
        return { bg: 'bg-red-500', text: 'text-red-400', glow: 'shadow-red-500/50' };
      case 'compare':
        return { bg: 'bg-violet-500', text: 'text-violet-400', glow: 'shadow-violet-500/50' };
      default:
        return { bg: 'bg-gray-500', text: 'text-gray-400', glow: 'shadow-gray-500/50' };
    }
  };

  const getTypeIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'search':
        return Search;
      case 'visit':
        return Globe;
      case 'screenshot':
        return Camera;
      case 'code':
        return Terminal;
      // New tool icons
      case 'vision':
        return Sparkles;
      case 'table':
        return Table2;
      case 'form':
        return FormInput;
      case 'paginate':
        return Layers;
      case 'scroll':
        return ScrollText;
      case 'pdf':
        return FileText;
      case 'compare':
        return GitCompare;
      default:
        return Globe;
    }
  };

  const total =
    counts.search +
    counts.visit +
    counts.screenshot +
    counts.code +
    counts.vision +
    counts.interactive +
    counts.pdf;

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-700 bg-gray-950 shadow-2xl">
      {/* Ambient glow effect */}
      <div
        className={`absolute inset-0 opacity-20 blur-3xl transition-opacity duration-500 ${
          flashEffect ? 'opacity-40' : 'opacity-20'
        }`}
      >
        <div className="absolute top-0 left-1/4 w-32 h-32 bg-purple-500 rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-24 h-24 bg-cyan-500 rounded-full" />
      </div>

      {/* Browser Chrome - macOS style */}
      <div className="relative bg-gray-800/90 backdrop-blur border-b border-gray-700 px-3 py-2">
        <div className="flex items-center gap-3">
          {/* Traffic lights */}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 cursor-pointer" />
            <div className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-400 cursor-pointer" />
            <div className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-400 cursor-pointer" />
          </div>

          {/* Address bar */}
          <div className="flex-1 flex items-center gap-2 bg-gray-900/80 rounded-lg px-3 py-1.5 border border-gray-700">
            <Lock className="w-3 h-3 text-green-400" />
            <span
              className={`text-xs font-mono truncate transition-all duration-300 ${
                flashEffect ? 'text-white' : 'text-gray-400'
              }`}
            >
              {currentActivity?.url || currentActivity?.content || 'jcil.ai/strategy'}
            </span>
            {!isComplete && <RefreshCw className="w-3 h-3 text-gray-500 animate-spin ml-auto" />}
          </div>

          {/* Live indicator */}
          {!isComplete && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/20 rounded-lg border border-green-500/30">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-xs font-medium text-green-400">LIVE</span>
            </div>
          )}
        </div>
      </div>

      {/* Main content area - the "screen" */}
      <div
        ref={containerRef}
        className="relative h-48 bg-gradient-to-b from-gray-900 to-gray-950 overflow-hidden"
      >
        {/* Scanlines effect */}
        <div className="absolute inset-0 pointer-events-none opacity-5">
          <div
            className="h-full w-full"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)',
            }}
          />
        </div>

        {/* Current activity display - favicon + domain prominent */}
        {currentActivity && (
          <div
            className={`absolute inset-0 flex transition-all duration-300 ${
              flashEffect ? 'scale-[1.02]' : 'scale-100'
            }`}
          >
            {/* Main preview area - left side */}
            <div className="flex-1 flex flex-col justify-center items-center px-4">
              {/* Favicon or icon - big and glowing */}
              <div
                className={`
                  relative mb-3 transition-all duration-300
                  ${flashEffect ? 'scale-110' : 'scale-100'}
                `}
              >
                {/* Glow ring behind favicon */}
                <div
                  className={`
                    absolute -inset-2 rounded-2xl blur-md transition-opacity duration-500
                    ${getTypeColor(currentActivity.type).bg}/30
                    ${flashEffect ? 'opacity-80' : 'opacity-30'}
                  `}
                />

                {currentActivity.url ? (
                  /* Real favicon from Google */
                  <div
                    className={`
                    relative w-14 h-14 rounded-xl flex items-center justify-center
                    bg-gray-800/80 border border-gray-600/50
                    ${flashEffect ? `shadow-lg ${getTypeColor(currentActivity.type).glow}` : ''}
                  `}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${extractDomain(currentActivity.url)}&sz=64`}
                      alt={extractDomain(currentActivity.url)}
                      className="w-8 h-8 rounded"
                      onError={(e) => {
                        // Fallback to type icon on error
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove(
                          'hidden'
                        );
                      }}
                    />
                    {/* Fallback icon (hidden by default) */}
                    {(() => {
                      const Icon = getTypeIcon(currentActivity.type);
                      return (
                        <Icon
                          className={`w-8 h-8 ${getTypeColor(currentActivity.type).text} hidden`}
                        />
                      );
                    })()}
                  </div>
                ) : (
                  /* No URL - show type icon */
                  <div
                    className={`
                    relative w-14 h-14 rounded-xl flex items-center justify-center
                    ${getTypeColor(currentActivity.type).bg}/20
                    ${flashEffect ? `shadow-lg ${getTypeColor(currentActivity.type).glow}` : ''}
                  `}
                  >
                    {(() => {
                      const Icon = getTypeIcon(currentActivity.type);
                      return (
                        <Icon className={`w-8 h-8 ${getTypeColor(currentActivity.type).text}`} />
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Domain name - large */}
              <p
                className={`text-center text-sm font-semibold max-w-full px-2 truncate transition-colors duration-200 ${
                  flashEffect ? 'text-white' : 'text-gray-200'
                }`}
              >
                {currentActivity.url
                  ? extractDomain(currentActivity.url)
                  : currentActivity.type === 'search'
                    ? `"${currentActivity.content}"`
                    : currentActivity.content}
              </p>

              {/* Action label */}
              <p className={`text-xs mt-1 font-medium ${getTypeColor(currentActivity.type).text}`}>
                {currentActivity.type === 'search' && 'Searching'}
                {currentActivity.type === 'visit' && 'Visiting'}
                {currentActivity.type === 'screenshot' && 'Capturing'}
                {currentActivity.type === 'code' && 'Executing'}
                {currentActivity.type === 'vision' && 'Analyzing'}
                {currentActivity.type === 'table' && 'Extracting Table'}
                {currentActivity.type === 'form' && 'Filling Form'}
                {currentActivity.type === 'paginate' && 'Paginating'}
                {currentActivity.type === 'scroll' && 'Scrolling'}
                {currentActivity.type === 'pdf' && 'Extracting PDF'}
                {currentActivity.type === 'compare' && 'Comparing'}
              </p>

              {/* Agent name */}
              {currentActivity.agentName && (
                <p className="text-[10px] text-gray-500 mt-1">{currentActivity.agentName}</p>
              )}
            </div>

            {/* Recent sites sidebar - favicon strip */}
            <div className="w-28 border-l border-gray-800/50 py-2 px-2 overflow-hidden flex flex-col gap-1.5">
              {recentActivities.slice(1, 6).map((activity, index) => {
                const Icon = getTypeIcon(activity.type);
                const domain = activity.url ? extractDomain(activity.url) : null;
                return (
                  <div
                    key={activity.id}
                    className="flex items-center gap-2 px-1.5 py-1 rounded-md bg-gray-800/40 border border-gray-700/30 transition-opacity duration-300"
                    style={{ opacity: 1 - index * 0.15 }}
                  >
                    {domain ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                        alt={domain}
                        className="w-4 h-4 rounded-sm flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Icon
                        className={`w-3.5 h-3.5 ${getTypeColor(activity.type).text} flex-shrink-0`}
                      />
                    )}
                    <span className="text-[10px] text-gray-400 truncate">
                      {domain || activity.content.slice(0, 12)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Stats bar - futuristic dashboard */}
      <div className="relative bg-gray-800/50 backdrop-blur border-t border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Activity counts */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-yellow-400 font-mono font-bold">{counts.search}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-cyan-400 font-mono font-bold">{counts.visit}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-pink-400" />
              <span className="text-pink-400 font-mono font-bold">{counts.screenshot}</span>
            </div>
            {counts.code > 0 && (
              <div className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-mono font-bold">{counts.code}</span>
              </div>
            )}
            {counts.vision > 0 && (
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-purple-400 font-mono font-bold">{counts.vision}</span>
              </div>
            )}
            {counts.interactive > 0 && (
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-blue-400 font-mono font-bold">{counts.interactive}</span>
              </div>
            )}
            {counts.pdf > 0 && (
              <div className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-red-400" />
                <span className="text-red-400 font-mono font-bold">{counts.pdf}</span>
              </div>
            )}
          </div>

          {/* Total and status */}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-500">
              <Zap className="w-3 h-3 inline mr-1" />
              {total} actions
            </span>
            {!isComplete ? (
              <span className="flex items-center gap-1 text-purple-400">
                <Eye className="w-3 h-3 animate-pulse" />
                Researching
              </span>
            ) : (
              <span className="flex items-center gap-1 text-green-400">
                <Shield className="w-3 h-3" />
                Complete
              </span>
            )}
          </div>
        </div>

        {/* Progress bar animation */}
        {!isComplete && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-700 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 via-cyan-500 to-purple-500 animate-shimmer"
              style={{
                width: '200%',
                animation: 'shimmer 2s linear infinite',
              }}
            />
          </div>
        )}
      </div>

      {/* CSS for shimmer animation */}
      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-50%);
          }
          100% {
            transform: translateX(0%);
          }
        }
      `}</style>
    </div>
  );
}

// Helper to extract domain from URL safely
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.slice(0, 30);
  }
}

export default BrowserPreviewWindow;
