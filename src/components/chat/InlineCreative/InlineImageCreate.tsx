/**
 * INLINE IMAGE CREATE
 *
 * Inline form for creating images within the chat flow.
 * Replaces modal approach - everything stays in the chat.
 */

'use client';

import { useState, useCallback } from 'react';
import { X, ImagePlus, Loader2, Sparkles } from 'lucide-react';
import type { GeneratedImage } from '@/app/chat/types';

interface InlineImageCreateProps {
  onClose: () => void;
  onImageGenerated: (image: GeneratedImage) => void;
  conversationId?: string;
}

const ASPECT_RATIOS = [
  { id: '1:1', label: 'Square', width: 1024, height: 1024 },
  { id: '16:9', label: 'Wide', width: 1280, height: 720 },
  { id: '9:16', label: 'Portrait', width: 720, height: 1280 },
  { id: '4:3', label: 'Standard', width: 1024, height: 768 },
];

export function InlineImageCreate({
  onClose,
  onImageGenerated,
  conversationId,
}: InlineImageCreateProps) {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      const selectedRatio = ASPECT_RATIOS.find((r) => r.id === aspectRatio) || ASPECT_RATIOS[0];

      const response = await fetch('/api/create/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          aspectRatio,
          width: selectedRatio.width,
          height: selectedRatio.height,
          conversationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Generation failed');
      }

      // Success - pass image to parent
      onImageGenerated({
        id: data.id,
        type: 'create',
        imageUrl: data.imageUrl,
        prompt: data.prompt,
        enhancedPrompt: data.enhancedPrompt,
        dimensions: data.dimensions,
        model: data.model,
        seed: data.seed,
        verification: data.verification,
      });

      // Close the inline form
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, aspectRatio, conversationId, onImageGenerated, onClose, isGenerating]);

  return (
    <div className="w-full max-w-lg mx-auto mb-4">
      <div className="bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-2xl p-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center">
              <ImagePlus className="w-4 h-4 text-pink-400" />
            </div>
            <h3 className="text-sm font-medium text-white">Create Image</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Prompt Input */}
        <div className="mb-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the image you want to create..."
            className="w-full h-24 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20"
            disabled={isGenerating}
          />
        </div>

        {/* Aspect Ratio Selection */}
        <div className="mb-4">
          <p className="text-xs text-gray-400 mb-2">Aspect Ratio</p>
          <div className="flex gap-2 flex-wrap">
            {ASPECT_RATIOS.map((ratio) => (
              <button
                key={ratio.id}
                onClick={() => setAspectRatio(ratio.id)}
                disabled={isGenerating}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  aspectRatio === ratio.id
                    ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                    : 'bg-gray-800/50 text-gray-400 border border-gray-700 hover:bg-gray-800'
                }`}
              >
                {ratio.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-pink-600 hover:bg-pink-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
