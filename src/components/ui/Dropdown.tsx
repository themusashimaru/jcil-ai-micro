'use client';

/**
 * DESIGN SYSTEM: Dropdown
 *
 * Accessible dropdown menu with keyboard navigation.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface DropdownItem {
  label: string;
  value: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  onSelect: (value: string) => void;
  align?: 'left' | 'right';
  className?: string;
}

export function Dropdown({
  trigger,
  items,
  onSelect,
  align = 'left',
  className = '',
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const enabledItems = items.filter((item) => !item.disabled);

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, close]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
        setActiveIndex(0);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => {
          const next = prev + 1;
          return next >= enabledItems.length ? 0 : next;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => {
          const next = prev - 1;
          return next < 0 ? enabledItems.length - 1 : next;
        });
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < enabledItems.length) {
          onSelect(enabledItems[activeIndex].value);
          close();
        }
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(enabledItems.length - 1);
        break;
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (!open || activeIndex < 0 || !menuRef.current) return;
    const activeEl = menuRef.current.children[activeIndex] as HTMLElement | undefined;
    activeEl?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${className}`}
      onKeyDown={handleKeyDown}
    >
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) setActiveIndex(0);
        }}
      >
        {trigger}
      </div>

      {open && (
        <ul
          ref={menuRef}
          role="listbox"
          className={[
            'absolute z-50 mt-1 min-w-[160px] max-h-60 overflow-auto',
            'rounded-lg border border-white/10 bg-gray-900/95 backdrop-blur-lg shadow-xl',
            'py-1',
            align === 'right' ? 'right-0' : 'left-0',
          ].join(' ')}
        >
          {items.map((item) => {
            const enabledIdx = enabledItems.indexOf(item);
            const isActive = enabledIdx === activeIndex;

            return (
              <li
                key={item.value}
                role="option"
                aria-selected={isActive}
                aria-disabled={item.disabled}
                className={[
                  'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors',
                  item.disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : isActive
                      ? 'bg-white/10 text-white'
                      : 'text-gray-300 hover:bg-white/5',
                  item.danger && !item.disabled ? 'text-red-400 hover:text-red-300' : '',
                ].join(' ')}
                onClick={() => {
                  if (item.disabled) return;
                  onSelect(item.value);
                  close();
                }}
                onMouseEnter={() => {
                  if (!item.disabled) setActiveIndex(enabledIdx);
                }}
              >
                {item.icon && <span className="shrink-0">{item.icon}</span>}
                {item.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default Dropdown;
