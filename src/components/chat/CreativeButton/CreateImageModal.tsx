/**
 * CREATE IMAGE MODAL
 *
 * Modal for generating images using FLUX.2 models.
 * Features:
 * - Prompt input with character count
 * - Aspect ratio selection
 * - Generation progress indicator
 * - Result preview with download
 */

'use client';

import { useState, useCallback } from 'react';
import { X, Download, Copy, Check, Loader2, ImagePlus, AlertCircle } from 'lucide-react';
import type { AspectRatio } from '@/lib/connectors/bfl';

interface CreateImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string;
}

interface GenerationResult {
  id: string;
  imageUrl: string;
  prompt: string;
  enhancedPrompt?: string;
  dimensions: { width: number; height: number };
  cost: number;
}

const ASPECT_RATIO_OPTIONS: { value: AspectRatio; label: string; icon: string }[] = [
  { value: '1:1', label: 'Square', icon: '□' },
  { value: '16:9', label: 'Wide', icon: '▭' },
  { value: '9:16', label: 'Tall', icon: '▯' },
  { value: '4:3', label: 'Landscape', icon: '▬' },
  { value: '3:4', label: 'Portrait', icon: '▮' },
];

export function CreateImageModal({ isOpen, onClose, conversationId }: CreateImageModalProps) {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/create/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          aspectRatio,
          conversationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to generate image');
      }

      setResult({
        id: data.id,
        imageUrl: data.imageUrl,
        prompt: data.prompt,
        enhancedPrompt: data.enhancedPrompt,
        dimensions: data.dimensions,
        cost: data.cost,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, aspectRatio, conversationId]);

  const handleDownload = useCallback(async () => {
    if (!result?.imageUrl) return;

    try {
      const response = await fetch(result.imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated-${result.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  }, [result]);

  const handleCopyPrompt = useCallback(async () => {
    if (!result?.enhancedPrompt && !result?.prompt) return;

    try {
      await navigator.clipboard.writeText(result.enhancedPrompt || result.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, [result]);

  const handleClose = useCallback(() => {
    if (!isGenerating) {
      setPrompt('');
      setResult(null);
      setError(null);
      onClose();
    }
  }, [isGenerating, onClose]);

  const handleNewGeneration = useCallback(() => {
    setResult(null);
    setError(null);
    setPrompt('');
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
              <ImagePlus className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Create Image</h2>
              <p className="text-sm text-gray-400">Powered by FLUX.2 Pro</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isGenerating}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {result ? (
            // Result View
            <div className="space-y-4">
              {/* Generated Image */}
              <div className="relative rounded-xl overflow-hidden bg-gray-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result.imageUrl} alt={result.prompt} className="w-full h-auto" />
              </div>

              {/* Prompt Display */}
              {result.enhancedPrompt && result.enhancedPrompt !== result.prompt && (
                <div className="p-4 rounded-lg bg-gray-800 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-400">Enhanced Prompt</span>
                    <button
                      onClick={handleCopyPrompt}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-sm text-gray-300">{result.enhancedPrompt}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  {result.dimensions.width} x {result.dimensions.height} • ${result.cost.toFixed(4)}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleNewGeneration}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                  >
                    New Image
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-pink-600 hover:bg-pink-500 text-white transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Input View
            <div className="space-y-6">
              {/* Prompt Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Describe your image
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="A serene mountain landscape at sunset with golden light..."
                  className="w-full h-32 px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 resize-none"
                  disabled={isGenerating}
                  maxLength={2000}
                />
                <div className="flex justify-end mt-1">
                  <span className="text-xs text-gray-500">{prompt.length}/2000</span>
                </div>
              </div>

              {/* Aspect Ratio */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Aspect Ratio</label>
                <div className="flex flex-wrap gap-2">
                  {ASPECT_RATIO_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setAspectRatio(option.value)}
                      disabled={isGenerating}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        aspectRatio === option.value
                          ? 'bg-pink-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      } disabled:opacity-50`}
                    >
                      <span className="text-lg">{option.icon}</span>
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-base font-semibold bg-pink-600 hover:bg-pink-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <ImagePlus className="w-5 h-5" />
                    Generate Image
                  </>
                )}
              </button>

              {/* Info */}
              <p className="text-center text-xs text-gray-500">
                Images are generated using FLUX.2 Pro by Black Forest Labs
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
