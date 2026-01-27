'use client';

/**
 * RESEARCH ACTIVITY FEED
 *
 * Real-time visual feed showing research activity as it happens:
 * - Search queries flashing by
 * - Screenshots being captured
 * - Websites being visited
 *
 * Creates a futuristic "AI at work" visual that no one else has.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Globe, Camera, Code, Zap, ExternalLink } from 'lucide-react';
import type { StrategyStreamEvent } from '@/agents/strategy';

interface ResearchActivityFeedProps {
  events: StrategyStreamEvent[];
  isComplete: boolean;
  maxVisible?: number;
}

interface ActivityItem {
  id: string;
  type: 'search' | 'visit' | 'screenshot' | 'code';
  content: string;
  timestamp: number;
  agentName?: string;
  url?: string;
}

export function ResearchActivityFeed({
  events,
  isComplete,
  maxVisible = 8,
}: ResearchActivityFeedProps) {
  const [visibleItems, setVisibleItems] = useState<ActivityItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract activity items from events
  const allActivities = useMemo(() => {
    const activities: ActivityItem[] = [];

    for (const event of events) {
      // Search activity
      if (event.type === 'search_executing' && event.data?.searchQuery) {
        activities.push({
          id: `search_${event.timestamp}_${Math.random()}`,
          type: 'search',
          content: String(event.data.searchQuery),
          timestamp: event.timestamp,
          agentName: event.data?.agentName as string | undefined,
        });
      }

      // Browser visit activity
      if (event.type === 'browser_visiting' && event.data?.url) {
        activities.push({
          id: `visit_${event.timestamp}_${Math.random()}`,
          type: 'visit',
          content: new URL(String(event.data.url)).hostname,
          timestamp: event.timestamp,
          url: String(event.data.url),
          agentName: event.data?.agentName as string | undefined,
        });
      }

      // Screenshot activity
      if (event.type === 'screenshot_captured' && event.data?.url) {
        activities.push({
          id: `screenshot_${event.timestamp}_${Math.random()}`,
          type: 'screenshot',
          content: new URL(String(event.data.url)).hostname,
          timestamp: event.timestamp,
          url: String(event.data.url),
          agentName: event.data?.agentName as string | undefined,
        });
      }

      // Code execution activity
      if (event.type === 'code_executing') {
        activities.push({
          id: `code_${event.timestamp}_${Math.random()}`,
          type: 'code',
          content: 'Running analysis...',
          timestamp: event.timestamp,
          agentName: event.data?.agentName as string | undefined,
        });
      }
    }

    return activities.sort((a, b) => b.timestamp - a.timestamp);
  }, [events]);

  // Animate items appearing
  useEffect(() => {
    const latestItems = allActivities.slice(0, maxVisible);
    setVisibleItems(latestItems);
  }, [allActivities, maxVisible]);

  // Get icon and color for activity type
  const getActivityStyle = (type: ActivityItem['type']) => {
    switch (type) {
      case 'search':
        return {
          Icon: Search,
          bgColor: 'bg-yellow-500/20',
          textColor: 'text-yellow-400',
          borderColor: 'border-yellow-500/30',
        };
      case 'visit':
        return {
          Icon: Globe,
          bgColor: 'bg-cyan-500/20',
          textColor: 'text-cyan-400',
          borderColor: 'border-cyan-500/30',
        };
      case 'screenshot':
        return {
          Icon: Camera,
          bgColor: 'bg-pink-500/20',
          textColor: 'text-pink-400',
          borderColor: 'border-pink-500/30',
        };
      case 'code':
        return {
          Icon: Code,
          bgColor: 'bg-emerald-500/20',
          textColor: 'text-emerald-400',
          borderColor: 'border-emerald-500/30',
        };
    }
  };

  // Count activities by type
  const counts = useMemo(() => {
    return {
      search: allActivities.filter((a) => a.type === 'search').length,
      visit: allActivities.filter((a) => a.type === 'visit').length,
      screenshot: allActivities.filter((a) => a.type === 'screenshot').length,
      code: allActivities.filter((a) => a.type === 'code').length,
    };
  }, [allActivities]);

  if (allActivities.length === 0) {
    return null;
  }

  return (
    <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-900/80">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-white">Live Research Activity</span>
          {!isComplete && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {counts.search > 0 && (
            <span className="flex items-center gap-1">
              <Search className="w-3 h-3 text-yellow-400" />
              {counts.search}
            </span>
          )}
          {counts.visit > 0 && (
            <span className="flex items-center gap-1">
              <Globe className="w-3 h-3 text-cyan-400" />
              {counts.visit}
            </span>
          )}
          {counts.screenshot > 0 && (
            <span className="flex items-center gap-1">
              <Camera className="w-3 h-3 text-pink-400" />
              {counts.screenshot}
            </span>
          )}
        </div>
      </div>

      {/* Activity Feed */}
      <div ref={containerRef} className="max-h-64 overflow-y-auto">
        <div className="p-2 space-y-1.5">
          {visibleItems.map((item, index) => {
            const style = getActivityStyle(item.type);
            const isNewest = index === 0 && !isComplete;

            return (
              <div
                key={item.id}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-300
                  ${style.bgColor} ${style.borderColor}
                  ${isNewest ? 'animate-pulse ring-1 ring-white/20' : 'opacity-80'}
                `}
              >
                <style.Icon className={`w-3.5 h-3.5 ${style.textColor} flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs font-medium truncate ${isNewest ? 'text-white' : 'text-gray-300'}`}
                  >
                    {item.content}
                  </p>
                  {item.agentName && (
                    <p className="text-[10px] text-gray-500 truncate">{item.agentName}</p>
                  )}
                </div>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 text-gray-500 hover:text-white transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer - total count */}
      {allActivities.length > maxVisible && (
        <div className="px-4 py-2 border-t border-gray-800 bg-gray-900/80">
          <p className="text-xs text-gray-500 text-center">
            {allActivities.length} total activities
          </p>
        </div>
      )}
    </div>
  );
}

export default ResearchActivityFeed;
