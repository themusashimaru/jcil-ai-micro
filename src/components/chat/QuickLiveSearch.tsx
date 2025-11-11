/**
 * QUICK LIVE SEARCH
 * Simple selection button for live web search mode
 */

'use client';

interface QuickLiveSearchProps {
  onSearchComplete: (response: string, query: string) => void;
  isSearching?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

export function QuickLiveSearch({ isSearching = false, isSelected = false, onSelect }: QuickLiveSearchProps) {
  return (
    <button
      onClick={onSelect}
      className={`rounded-lg px-3 py-2 text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed border whitespace-nowrap ${
        isSelected
          ? 'bg-white text-black border-white'
          : 'bg-black text-white border-white/20 hover:bg-gray-800'
      }`}
      disabled={isSearching}
      aria-label="Live search mode"
      title={isSelected ? "Search mode active - type your search query" : "Select live search mode"}
    >
      {isSelected ? '✓ Search' : 'Search'}
    </button>
  );
}
