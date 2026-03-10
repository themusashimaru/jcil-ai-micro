/**
 * GENERATION GALLERY
 *
 * Modal component to view past image generations.
 * Features:
 * - Grid view of all past generations
 * - Full-size image preview
 * - Prompt details and metadata
 * - Re-use prompt button
 * - Infinite scroll pagination
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Image as ImageIcon,
  Download,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  Wand2,
  Calendar,
  Maximize2,
} from 'lucide-react';

interface Generation {
  id: string;
  type: 'image' | 'edit';
  model: string;
  prompt: string;
  status: 'completed' | 'failed' | 'moderated';
  result_url: string | null;
  dimensions: { width: number; height: number };
  cost_credits: number | null;
  created_at: string;
  completed_at: string | null;
}

interface GenerationGalleryProps {
  isOpen: boolean;
  onClose: () => void;
  onReusePrompt?: (prompt: string) => void;
}

export function GenerationGallery({ isOpen, onClose, onReusePrompt }: GenerationGalleryProps) {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [selectedGeneration, setSelectedGeneration] = useState<Generation | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const LIMIT = 20;

  // Fetch generations
  const fetchGenerations = useCallback(
    async (reset = false) => {
      if (!isOpen) return;

      const currentOffset = reset ? 0 : offset;
      setIsLoading(true);

      try {
        const response = await fetch(
          `/api/create/image?limit=${LIMIT}&offset=${currentOffset}&type=image`
        );
        if (!response.ok) {
          throw new Error('Failed to fetch generations');
        }

        const data = await response.json();
        const newGenerations = data.generations || [];

        if (reset) {
          setGenerations(newGenerations);
          setOffset(LIMIT);
        } else {
          setGenerations((prev) => [...prev, ...newGenerations]);
          setOffset((prev) => prev + LIMIT);
        }

        setHasMore(data.pagination?.hasMore ?? newGenerations.length === LIMIT);
      } catch (error) {
        console.error('Failed to fetch generations:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [isOpen, offset]
  );

  // Initial load
  useEffect(() => {
    if (isOpen) {
      fetchGenerations(true);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Infinite scroll
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || isLoading || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      fetchGenerations();
    }
  }, [fetchGenerations, isLoading, hasMore]);

  // Copy prompt to clipboard
  const handleCopyPrompt = useCallback(async (id: string, prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, []);

  // Download image
  const handleDownload = useCallback(async (generation: Generation) => {
    if (!generation.result_url) return;

    try {
      const response = await fetch(generation.result_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generation-${generation.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  }, []);

  // Navigate preview
  const navigatePreview = useCallback(
    (direction: 'prev' | 'next') => {
      if (!selectedGeneration) return;

      const currentIndex = generations.findIndex((g) => g.id === selectedGeneration.id);
      const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;

      if (newIndex >= 0 && newIndex < generations.length) {
        setSelectedGeneration(generations[newIndex]);
      }
    },
    [selectedGeneration, generations]
  );

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        if (selectedGeneration) {
          setSelectedGeneration(null);
        } else {
          onClose();
        }
      } else if (selectedGeneration) {
        if (e.key === 'ArrowLeft') {
          navigatePreview('prev');
        } else if (e.key === 'ArrowRight') {
          navigatePreview('next');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedGeneration, navigatePreview, onClose]);

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => (selectedGeneration ? setSelectedGeneration(null) : onClose())}
      />

      {/* Preview Modal */}
      {selectedGeneration && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
          {/* Navigation buttons */}
          <button
            onClick={() => navigatePreview('prev')}
            disabled={generations.findIndex((g) => g.id === selectedGeneration.id) === 0}
            className="absolute left-4 z-20 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-6 h-6" aria-hidden="true" />
          </button>

          <button
            onClick={() => navigatePreview('next')}
            disabled={
              generations.findIndex((g) => g.id === selectedGeneration.id) ===
              generations.length - 1
            }
            className="absolute right-4 z-20 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next image"
          >
            <ChevronRight className="w-6 h-6" aria-hidden="true" />
          </button>

          {/* Preview content */}
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col bg-gray-900 rounded-2xl border border-gray-700 overflow-hidden">
            {/* Image */}
            <div className="flex-1 min-h-0 p-4 flex items-center justify-center bg-black/30">
              {selectedGeneration.result_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedGeneration.result_url}
                  alt={selectedGeneration.prompt}
                  className="max-w-full max-h-[60vh] object-contain rounded-lg"
                />
              )}
            </div>

            {/* Details */}
            <div className="p-4 border-t border-gray-700 space-y-3">
              <p className="text-sm text-gray-300 line-clamp-2">{selectedGeneration.prompt}</p>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    {selectedGeneration.type === 'edit' ? (
                      <Wand2 className="w-3 h-3" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    {selectedGeneration.model}
                  </span>
                  <span>
                    {selectedGeneration.dimensions.width} x {selectedGeneration.dimensions.height}
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(selectedGeneration.created_at)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyPrompt(selectedGeneration.id, selectedGeneration.prompt)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-800 hover:bg-gray-700 text-white transition-colors"
                >
                  {copiedId === selectedGeneration.id ? (
                    <>
                      <Check className="w-4 h-4 text-green-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy Prompt
                    </>
                  )}
                </button>
                {onReusePrompt && (
                  <button
                    onClick={() => {
                      onReusePrompt(selectedGeneration.prompt);
                      onClose();
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    Use Again
                  </button>
                )}
                <button
                  onClick={() => handleDownload(selectedGeneration)}
                  className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
                  aria-label="Download image"
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  onClick={() => setSelectedGeneration(null)}
                  className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
                  aria-label="Close image preview"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Gallery Modal */}
      <div className="relative w-full max-w-4xl max-h-[85vh] bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Your Creations</h2>
              <p className="text-sm text-gray-400">
                {generations.length} generation{generations.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            aria-label="Close gallery"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4"
        >
          {generations.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No creations yet</p>
              <p className="text-sm text-gray-500">
                Generate your first image using the Create button
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {generations.map((generation) => (
                <div
                  key={generation.id}
                  onClick={() => setSelectedGeneration(generation)}
                  className="group relative aspect-square rounded-xl overflow-hidden bg-gray-800 cursor-pointer hover:ring-2 hover:ring-violet-500 transition-all"
                >
                  {generation.result_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={generation.result_url}
                      alt={generation.prompt}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-800">
                      <ImageIcon className="w-8 h-8 text-gray-600" />
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-xs text-white line-clamp-2 mb-1">{generation.prompt}</p>
                      <div className="flex items-center justify-between text-[10px] text-gray-400">
                        <span className="flex items-center gap-1">
                          {generation.type === 'edit' ? (
                            <Wand2 className="w-2.5 h-2.5" />
                          ) : (
                            <Sparkles className="w-2.5 h-2.5" />
                          )}
                          {generation.type === 'edit' ? 'Edited' : 'Created'}
                        </span>
                        <span>{formatDate(generation.created_at)}</span>
                      </div>
                    </div>

                    {/* Expand icon */}
                    <div className="absolute top-2 right-2">
                      <Maximize2 className="w-4 h-4 text-white/70" />
                    </div>
                  </div>

                  {/* Type badge */}
                  <div
                    className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      generation.type === 'edit'
                        ? 'bg-amber-500/80 text-amber-100'
                        : 'bg-violet-500/80 text-violet-100'
                    }`}
                  >
                    {generation.type === 'edit' ? 'Edit' : 'Create'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
            </div>
          )}

          {/* End of list */}
          {!hasMore && generations.length > 0 && !isLoading && (
            <p className="text-center text-sm text-gray-500 py-4">No more generations to load</p>
          )}
        </div>
      </div>
    </div>
  );
}
