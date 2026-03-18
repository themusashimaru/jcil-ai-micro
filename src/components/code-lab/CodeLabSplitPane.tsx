'use client';

/**
 * CODE LAB SPLIT PANE
 *
 * Professional resizable split pane layout:
 * - Smooth drag resizing
 * - Keyboard accessible
 * - Snap to presets
 * - Collapse/expand panels
 * - Persist layout preference
 * - Touch support
 * - Smooth animations
 *
 * Makes Code Lab feel like a real IDE.
 *
 * @version 1.0.0
 */

import { useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import './code-lab-split-pane.css';

type SplitDirection = 'horizontal' | 'vertical';

interface PanelConfig {
  id: string;
  minSize: number; // percentage
  maxSize: number; // percentage
  defaultSize: number; // percentage
  collapsible?: boolean;
  collapsed?: boolean;
}

interface CodeLabSplitPaneProps {
  direction: SplitDirection;
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  leftConfig?: Partial<PanelConfig>;
  rightConfig?: Partial<PanelConfig>;
  onResize?: (leftSize: number, rightSize: number) => void;
  storageKey?: string;
  className?: string;
}

const DEFAULT_CONFIG: PanelConfig = {
  id: 'panel',
  minSize: 20,
  maxSize: 80,
  defaultSize: 50,
  collapsible: true,
  collapsed: false,
};

// Preset sizes for snap points
const SNAP_POINTS = [25, 33, 50, 67, 75];
const SNAP_THRESHOLD = 3; // percentage

export function CodeLabSplitPane({
  direction,
  leftPanel,
  rightPanel,
  leftConfig = {},
  rightConfig = {},
  onResize,
  storageKey,
  className = '',
}: CodeLabSplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startPosRef = useRef(0);
  const startSizeRef = useRef(0);

  // Merge configs with defaults
  const left: PanelConfig = { ...DEFAULT_CONFIG, id: 'left', ...leftConfig };
  const right: PanelConfig = { ...DEFAULT_CONFIG, id: 'right', ...rightConfig };

  // Initialize with default - load from storage in useEffect to avoid hydration mismatch
  const [leftSize, setLeftSize] = useState(left.defaultSize);
  const [leftCollapsed, setLeftCollapsed] = useState(left.collapsed || false);
  const [rightCollapsed, setRightCollapsed] = useState(right.collapsed || false);
  const [isDragging, setIsDragging] = useState(false);

  // Load size from storage after hydration (client-side only)
  useEffect(() => {
    if (storageKey) {
      const stored = localStorage.getItem(`split-pane-${storageKey}`);
      if (stored) {
        const parsed = parseFloat(stored);
        if (!isNaN(parsed) && parsed >= left.minSize && parsed <= left.maxSize) {
          setLeftSize(parsed);
        }
      }
    }
  }, [storageKey, left.minSize, left.maxSize]);

  // Calculate actual sizes accounting for collapsed state
  const actualLeftSize = leftCollapsed ? 0 : rightCollapsed ? 100 : leftSize;
  const actualRightSize = rightCollapsed ? 0 : leftCollapsed ? 100 : 100 - leftSize;

  // Persist size to storage
  useEffect(() => {
    if (storageKey && !leftCollapsed && !rightCollapsed) {
      localStorage.setItem(`split-pane-${storageKey}`, leftSize.toString());
    }
  }, [leftSize, storageKey, leftCollapsed, rightCollapsed]);

  // Notify parent of resize
  useEffect(() => {
    onResize?.(actualLeftSize, actualRightSize);
  }, [actualLeftSize, actualRightSize, onResize]);

  // Snap to nearest preset
  const snapToPreset = (size: number): number => {
    for (const point of SNAP_POINTS) {
      if (Math.abs(size - point) <= SNAP_THRESHOLD) {
        return point;
      }
    }
    return size;
  };

  // Handle drag start
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      setIsDragging(true);

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      startPosRef.current =
        direction === 'horizontal' ? e.clientX - rect.left : e.clientY - rect.top;
      startSizeRef.current = leftSize;

      document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [direction, leftSize]
  );

  // Handle drag move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const containerSize = direction === 'horizontal' ? rect.width : rect.height;
      const currentPos = direction === 'horizontal' ? e.clientX - rect.left : e.clientY - rect.top;

      const delta = ((currentPos - startPosRef.current) / containerSize) * 100;
      let newSize = startSizeRef.current + delta;

      // Clamp to min/max
      newSize = Math.max(left.minSize, Math.min(left.maxSize, newSize));

      // Snap to presets
      newSize = snapToPreset(newSize);

      setLeftSize(newSize);
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [direction, left.minSize, left.maxSize]);

  // Handle touch events
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 1) return;

      isDraggingRef.current = true;
      setIsDragging(true);

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const touch = e.touches[0];
      startPosRef.current =
        direction === 'horizontal' ? touch.clientX - rect.left : touch.clientY - rect.top;
      startSizeRef.current = leftSize;
    },
    [direction, leftSize]
  );

  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || !containerRef.current || e.touches.length !== 1) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const containerSize = direction === 'horizontal' ? rect.width : rect.height;
      const touch = e.touches[0];
      const currentPos =
        direction === 'horizontal' ? touch.clientX - rect.left : touch.clientY - rect.top;

      const delta = ((currentPos - startPosRef.current) / containerSize) * 100;
      let newSize = startSizeRef.current + delta;

      newSize = Math.max(left.minSize, Math.min(left.maxSize, newSize));
      newSize = snapToPreset(newSize);

      setLeftSize(newSize);
    };

    const handleTouchEnd = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
    };

    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [direction, left.minSize, left.maxSize]);

  // Handle keyboard resize
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 10 : 2;

      if (direction === 'horizontal') {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setLeftSize((s) => Math.max(left.minSize, s - step));
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          setLeftSize((s) => Math.min(left.maxSize, s + step));
        }
      } else {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setLeftSize((s) => Math.max(left.minSize, s - step));
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setLeftSize((s) => Math.min(left.maxSize, s + step));
        }
      }

      // Collapse shortcuts
      if (e.key === 'Home') {
        e.preventDefault();
        setLeftCollapsed(true);
      } else if (e.key === 'End') {
        e.preventDefault();
        setRightCollapsed(true);
      }
    },
    [direction, left.minSize, left.maxSize]
  );

  // Double-click to reset
  const handleDoubleClick = () => {
    setLeftSize(left.defaultSize);
    setLeftCollapsed(false);
    setRightCollapsed(false);
  };

  return (
    <div
      ref={containerRef}
      className={`split-pane ${direction} ${className} ${isDragging ? 'dragging' : ''}`}
    >
      {/* Left/Top Panel */}
      <div
        className={`pane left ${leftCollapsed ? 'collapsed' : ''}`}
        style={{
          [direction === 'horizontal' ? 'width' : 'height']: `${actualLeftSize}%`,
        }}
      >
        {!leftCollapsed && leftPanel}
        {left.collapsible && leftCollapsed && (
          <button
            className="expand-btn left"
            onClick={() => setLeftCollapsed(false)}
            aria-label="Expand left panel"
          >
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
            </svg>
          </button>
        )}
      </div>

      {/* Resizer */}
      <div
        className="resizer"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="separator"
        aria-valuenow={leftSize}
        aria-valuemin={left.minSize}
        aria-valuemax={left.maxSize}
        aria-label={`Resize ${direction === 'horizontal' ? 'panels horizontally' : 'panels vertically'}`}
      >
        <div className="resizer-handle">
          <div className="resizer-line" />
          <div className="resizer-grip">
            <span />
            <span />
            <span />
          </div>
          <div className="resizer-line" />
        </div>

        {/* Collapse buttons */}
        {left.collapsible && !leftCollapsed && (
          <button
            className="collapse-btn left"
            onClick={(e) => {
              e.stopPropagation();
              setLeftCollapsed(true);
            }}
            aria-label="Collapse left panel"
          >
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M9.78 12.78a.75.75 0 01-1.06 0L4.47 8.53a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 1.06L6.06 8l3.72 3.72a.75.75 0 010 1.06z" />
            </svg>
          </button>
        )}
        {right.collapsible && !rightCollapsed && (
          <button
            className="collapse-btn right"
            onClick={(e) => {
              e.stopPropagation();
              setRightCollapsed(true);
            }}
            aria-label="Collapse right panel"
          >
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
            </svg>
          </button>
        )}
      </div>

      {/* Right/Bottom Panel */}
      <div
        className={`pane right ${rightCollapsed ? 'collapsed' : ''}`}
        style={{
          [direction === 'horizontal' ? 'width' : 'height']: `${actualRightSize}%`,
        }}
      >
        {!rightCollapsed && rightPanel}
        {right.collapsible && rightCollapsed && (
          <button
            className="expand-btn right"
            onClick={() => setRightCollapsed(false)}
            aria-label="Expand right panel"
          >
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M9.78 12.78a.75.75 0 01-1.06 0L4.47 8.53a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 1.06L6.06 8l3.72 3.72a.75.75 0 010 1.06z" />
            </svg>
          </button>
        )}
      </div>

    </div>
  );
}

export default CodeLabSplitPane;
