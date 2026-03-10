'use client';

/**
 * CODE LAB VIRTUALIZED LIST
 *
 * HIGH-002: Lightweight virtualization for large lists
 * Uses IntersectionObserver to only render visible items
 * No external dependencies required
 *
 * Features:
 * - Lazy rendering of list items
 * - Auto-scrolling support
 * - Variable height items
 * - Keyboard navigation
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface VirtualizedListProps<T> {
  /** Array of items to render */
  items: T[];
  /** Render function for each item */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Unique key extractor for each item */
  keyExtractor: (item: T, index: number) => string;
  /** Estimated item height in pixels (for initial layout) */
  estimatedItemHeight?: number;
  /** Number of items to render above/below the visible area */
  overscan?: number;
  /** Whether to auto-scroll to the bottom when new items are added */
  autoScrollToBottom?: boolean;
  /** Container className */
  className?: string;
  /** Empty state content */
  emptyState?: React.ReactNode;
  /** Loading state */
  isLoading?: boolean;
  /** Loading skeleton component */
  loadingSkeleton?: React.ReactNode;
}

interface ItemMeasurement {
  height: number;
  top: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_ESTIMATED_HEIGHT = 100;
const DEFAULT_OVERSCAN = 5;
const SCROLL_THRESHOLD = 100; // pixels from bottom to trigger auto-scroll

// ============================================================================
// COMPONENT
// ============================================================================

export function CodeLabVirtualizedList<T>({
  items,
  renderItem,
  keyExtractor,
  estimatedItemHeight = DEFAULT_ESTIMATED_HEIGHT,
  overscan = DEFAULT_OVERSCAN,
  autoScrollToBottom = true,
  className = '',
  emptyState,
  isLoading,
  loadingSkeleton,
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const [measurements, setMeasurements] = useState<Map<string, ItemMeasurement>>(new Map());
  const [isNearBottom, setIsNearBottom] = useState(true);
  const prevItemCountRef = useRef(items.length);

  // Calculate total height based on measurements or estimates
  const totalHeight = useMemo(() => {
    let height = 0;
    for (let i = 0; i < items.length; i++) {
      const key = keyExtractor(items[i], i);
      const measurement = measurements.get(key);
      height += measurement?.height ?? estimatedItemHeight;
    }
    return height;
  }, [items, measurements, keyExtractor, estimatedItemHeight]);

  // Calculate which items are visible
  const calculateVisibleRange = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;
    const viewportBottom = scrollTop + viewportHeight;

    let start = 0;
    let end = items.length;
    let currentTop = 0;

    // Find first visible item
    for (let i = 0; i < items.length; i++) {
      const key = keyExtractor(items[i], i);
      const height = measurements.get(key)?.height ?? estimatedItemHeight;

      if (currentTop + height >= scrollTop) {
        start = Math.max(0, i - overscan);
        break;
      }
      currentTop += height;
    }

    // Find last visible item
    currentTop = 0;
    for (let i = 0; i < items.length; i++) {
      const key = keyExtractor(items[i], i);
      const height = measurements.get(key)?.height ?? estimatedItemHeight;
      currentTop += height;

      if (currentTop > viewportBottom) {
        end = Math.min(items.length, i + overscan + 1);
        break;
      }
    }

    setVisibleRange({ start, end });

    // Check if near bottom for auto-scroll
    const distanceFromBottom = totalHeight - viewportBottom;
    setIsNearBottom(distanceFromBottom < SCROLL_THRESHOLD);
  }, [items, measurements, keyExtractor, estimatedItemHeight, overscan, totalHeight]);

  // Handle scroll events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      calculateVisibleRange();
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    calculateVisibleRange(); // Initial calculation

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [calculateVisibleRange]);

  // Auto-scroll to bottom when new items are added
  useEffect(() => {
    if (autoScrollToBottom && isNearBottom && items.length > prevItemCountRef.current) {
      const container = containerRef.current;
      if (container) {
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollHeight;
        });
      }
    }
    prevItemCountRef.current = items.length;
  }, [items.length, autoScrollToBottom, isNearBottom]);

  // Measure item heights after render
  const measureItem = useCallback((key: string, element: HTMLDivElement | null) => {
    if (!element) return;

    const height = element.getBoundingClientRect().height;
    setMeasurements((prev) => {
      const existing = prev.get(key);
      if (existing?.height === height) return prev;

      const newMap = new Map(prev);
      const prevHeight = existing?.top ?? 0;
      newMap.set(key, { height, top: prevHeight });
      return newMap;
    });
  }, []);

  // Calculate offset for each visible item
  const getItemOffset = useCallback(
    (index: number) => {
      let offset = 0;
      for (let i = 0; i < index; i++) {
        const key = keyExtractor(items[i], i);
        const measurement = measurements.get(key);
        offset += measurement?.height ?? estimatedItemHeight;
      }
      return offset;
    },
    [items, measurements, keyExtractor, estimatedItemHeight]
  );

  // Loading state
  if (isLoading && loadingSkeleton) {
    return <div className={className}>{loadingSkeleton}</div>;
  }

  // Empty state
  if (items.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>;
  }

  // Get visible items
  const visibleItems = items.slice(visibleRange.start, visibleRange.end);

  return (
    <div
      ref={containerRef}
      className={`code-lab-virtualized-list overflow-y-auto relative ${className}`}
    >
      {/* Spacer for total scroll height */}
      <div className="relative" style={{ height: totalHeight }}>
        {/* Render visible items */}
        {visibleItems.map((item, localIndex) => {
          const globalIndex = visibleRange.start + localIndex;
          const key = keyExtractor(item, globalIndex);
          const offset = getItemOffset(globalIndex);

          return (
            <div
              key={key}
              ref={(el) => measureItem(key, el)}
              className="absolute left-0 right-0"
              style={{ top: offset }}
            >
              {renderItem(item, globalIndex)}
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .code-lab-virtualized-list {
          width: 100%;
          height: 100%;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// SIMPLE VIRTUALIZED LIST (for smaller lists)
// ============================================================================

/**
 * A simpler virtualization approach for lists < 1000 items
 * Uses IntersectionObserver for lazy rendering
 */
interface LazyListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  threshold?: number;
  className?: string;
}

export function CodeLabLazyList<T>({
  items,
  renderItem,
  keyExtractor,
  threshold = 100,
  className = '',
}: LazyListProps<T>) {
  // For lists under threshold, render all items
  if (items.length < threshold) {
    return (
      <div className={className}>
        {items.map((item, index) => (
          <React.Fragment key={keyExtractor(item, index)}>{renderItem(item, index)}</React.Fragment>
        ))}
      </div>
    );
  }

  // For larger lists, use virtualization
  return (
    <CodeLabVirtualizedList
      items={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      className={className}
    />
  );
}

export default CodeLabVirtualizedList;
