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
import { Search, Globe, Camera, Shield, Zap, Terminal, Eye, RefreshCw, Lock } from 'lucide-react';
import type { StrategyStreamEvent } from '@/agents/strategy';

interface BrowserPreviewWindowProps {
  events: StrategyStreamEvent[];
  isComplete: boolean;
}

interface ActivityItem {
  id: string;
  type: 'search' | 'visit' | 'screenshot' | 'code';
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

  const getTypeColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'search':
        return { bg: 'bg-yellow-500', text: 'text-yellow-400', glow: 'shadow-yellow-500/50' };
      case 'visit':
        return { bg: 'bg-cyan-500', text: 'text-cyan-400', glow: 'shadow-cyan-500/50' };
      case 'screenshot':
        return { bg: 'bg-pink-500', text: 'text-pink-400', glow: 'shadow-pink-500/50' };
      case 'code':
        return { bg: 'bg-emerald-500', text: 'text-emerald-400', glow: 'shadow-emerald-500/50' };
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
    }
  };

  const total = counts.search + counts.visit + counts.screenshot + counts.code;

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

        {/* Current activity display - big and prominent */}
        {currentActivity && (
          <div
            className={`absolute inset-4 flex flex-col justify-center items-center transition-all duration-300 ${
              flashEffect ? 'scale-105' : 'scale-100'
            }`}
          >
            {/* Type indicator with glow */}
            <div
              className={`
              p-3 rounded-xl mb-3 transition-all duration-300
              ${getTypeColor(currentActivity.type).bg}/20
              ${flashEffect ? `shadow-lg ${getTypeColor(currentActivity.type).glow}` : ''}
            `}
            >
              {(() => {
                const Icon = getTypeIcon(currentActivity.type);
                return <Icon className={`w-8 h-8 ${getTypeColor(currentActivity.type).text}`} />;
              })()}
            </div>

            {/* Content */}
            <p
              className={`text-center text-sm font-medium max-w-full px-4 truncate transition-colors ${
                flashEffect ? 'text-white' : 'text-gray-300'
              }`}
            >
              {currentActivity.type === 'search' && `"${currentActivity.content}"`}
              {currentActivity.type === 'visit' && currentActivity.content}
              {currentActivity.type === 'screenshot' && `Capturing: ${currentActivity.content}`}
              {currentActivity.type === 'code' && `Running ${currentActivity.content}`}
            </p>

            {/* Agent name */}
            {currentActivity.agentName && (
              <p className="text-xs text-gray-500 mt-1">{currentActivity.agentName}</p>
            )}
          </div>
        )}

        {/* Activity stream on the side */}
        <div className="absolute right-2 top-2 bottom-2 w-32 overflow-hidden">
          <div className="space-y-1">
            {recentActivities.slice(1, 5).map((activity, index) => {
              const Icon = getTypeIcon(activity.type);
              return (
                <div
                  key={activity.id}
                  className={`
                    flex items-center gap-1.5 px-2 py-1 rounded text-xs
                    bg-gray-800/50 border border-gray-700/50
                    transition-opacity duration-300
                  `}
                  style={{ opacity: 1 - index * 0.2 }}
                >
                  <Icon className={`w-3 h-3 ${getTypeColor(activity.type).text} flex-shrink-0`} />
                  <span className="text-gray-400 truncate">{activity.content.slice(0, 15)}</span>
                </div>
              );
            })}
          </div>
        </div>
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
