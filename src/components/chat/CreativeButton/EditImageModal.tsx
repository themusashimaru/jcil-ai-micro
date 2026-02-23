/**
 * EDIT IMAGE MODAL
 *
 * Modal for editing images using FLUX.2 models with reference images.
 * Features:
 * - Upload reference images (up to 8)
 * - Natural language editing instructions
 * - Before/after comparison
 * - Download edited result
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { X, Download, Loader2, Wand2, AlertCircle, Plus, Trash2 } from 'lucide-react';
import type { GeneratedImage } from '@/app/chat/types';

interface EditImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string;
  onImageGenerated?: (image: GeneratedImage) => void;
}

interface EditResult {
  id: string;
  imageUrl: string;
  prompt: string;
  dimensions: { width: number; height: number };
  cost: number;
}

interface UploadedImage {
  id: string;
  dataUrl: string;
  name: string;
}

const MAX_IMAGES = 8;

export function EditImageModal({
  isOpen,
  onClose,
  conversationId,
  onImageGenerated,
}: EditImageModalProps) {
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<EditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files) return;

      const remainingSlots = MAX_IMAGES - images.length;
      const filesToProcess = Array.from(files).slice(0, remainingSlots);

      for (const file of filesToProcess) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          setError('Only image files are supported');
          continue;
        }

        // Validate file size (10MB max)
        if (file.size > 10 * 1024 * 1024) {
          setError('Images must be smaller than 10MB');
          continue;
        }

        // Read as data URL
        const reader = new FileReader();
        reader.onload = () => {
          setImages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${file.name}`,
              dataUrl: reader.result as string,
              name: file.name,
            },
          ]);
        };
        reader.readAsDataURL(file);
      }

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [images.length]
  );

  const removeImage = useCallback((id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  const handleEdit = useCallback(async () => {
    if (!prompt.trim() || images.length === 0) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/create/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          images: images.map((img) => img.dataUrl),
          conversationId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to edit image');
      }

      setResult({
        id: data.id,
        imageUrl: data.imageUrl,
        prompt: data.prompt,
        dimensions: data.dimensions,
        cost: data.cost,
      });

      // Notify parent to add image to conversation
      onImageGenerated?.({
        id: data.id,
        type: 'edit',
        imageUrl: data.imageUrl,
        prompt: data.prompt,
        enhancedPrompt: data.enhancedPrompt,
        dimensions: data.dimensions,
        model: data.model || 'flux-2-pro',
        seed: data.seed,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  }, [prompt, images, conversationId, onImageGenerated]);

  const handleDownload = useCallback(async () => {
    if (!result?.imageUrl) return;

    try {
      const response = await fetch(result.imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edited-${result.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  }, [result]);

  const handleClose = useCallback(() => {
    if (!isProcessing) {
      setPrompt('');
      setImages([]);
      setResult(null);
      setError(null);
      onClose();
    }
  }, [isProcessing, onClose]);

  const handleNewEdit = useCallback(() => {
    setResult(null);
    setError(null);
    setPrompt('');
    setImages([]);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative w-full max-w-3xl bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <Wand2 className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Edit Image</h2>
              <p className="text-sm text-gray-400">Transform images with AI</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
            aria-label="Close image editing modal"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {result ? (
            // Result View
            <div className="space-y-4">
              {/* Before/After Comparison */}
              <div className="grid grid-cols-2 gap-4">
                {/* Original */}
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-2">Original</p>
                  <div className="rounded-xl overflow-hidden bg-gray-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={images[0]?.dataUrl} alt="Original" className="w-full h-auto" />
                  </div>
                </div>

                {/* Edited */}
                <div>
                  <p className="text-xs font-medium text-gray-400 mb-2">Edited</p>
                  <div className="rounded-xl overflow-hidden bg-gray-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={result.imageUrl} alt="Edited" className="w-full h-auto" />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  {result.dimensions.width} x {result.dimensions.height} • ${result.cost.toFixed(4)}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleNewEdit}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
                  >
                    New Edit
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-colors"
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
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Reference Images ({images.length}/{MAX_IMAGES})
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                />

                <div className="grid grid-cols-4 gap-3">
                  {/* Uploaded images */}
                  {images.map((img) => (
                    <div
                      key={img.id}
                      className="relative aspect-square rounded-lg overflow-hidden bg-gray-800 group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.dataUrl}
                        alt={img.name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removeImage(img.id)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={`Remove image ${img.name}`}
                      >
                        <Trash2 className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </div>
                  ))}

                  {/* Add button */}
                  {images.length < MAX_IMAGES && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isProcessing}
                      className="aspect-square rounded-lg border-2 border-dashed border-gray-700 hover:border-gray-600 flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-gray-400 transition-colors disabled:opacity-50"
                    >
                      <Plus className="w-6 h-6" />
                      <span className="text-xs">Add</span>
                    </button>
                  )}
                </div>

                <p className="mt-2 text-xs text-gray-500">
                  Upload up to 8 reference images for style matching and editing
                </p>
              </div>

              {/* Edit Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  What would you like to change?
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Make this photo look like a professional headshot with studio lighting..."
                  className="w-full h-28 px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-violet-500 resize-none"
                  disabled={isProcessing}
                  maxLength={2000}
                />
                <div className="flex justify-end mt-1">
                  <span className="text-xs text-gray-500">{prompt.length}/2000</span>
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
                onClick={handleEdit}
                disabled={!prompt.trim() || images.length === 0 || isProcessing}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-base font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    Apply Edit
                  </>
                )}
              </button>

              {/* Info */}
              <p className="text-center text-xs text-gray-500">
                Image editing powered by FLUX.2 Pro
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
