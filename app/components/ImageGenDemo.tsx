/**
 * IMAGE GENERATION DEMO COMPONENT
 *
 * PURPOSE:
 * - Landing page showcase for Image Generation
 * - Show AI image creation capabilities
 * - Demo various styles
 */

'use client';

import { useState, useEffect } from 'react';

const DEMO_IMAGES = [
  {
    prompt: 'A serene mountain landscape at sunset with a lake reflection',
    style: 'Photorealistic',
    gradient: 'from-orange-500 to-pink-500',
  },
  {
    prompt: 'A futuristic city with flying cars and neon lights',
    style: 'Digital Art',
    gradient: 'from-purple-500 to-blue-500',
  },
  {
    prompt: 'A cute robot reading a book in a cozy library',
    style: 'Anime',
    gradient: 'from-pink-400 to-purple-400',
  },
  {
    prompt: 'An abstract visualization of AI neural networks',
    style: '3D Render',
    gradient: 'from-cyan-500 to-blue-500',
  },
];

const STYLES = ['Photorealistic', 'Digital Art', 'Anime', 'Oil Painting', 'Watercolor', 'Minimalist'];

export default function ImageGenDemo() {
  const [activeImage, setActiveImage] = useState(0);
  const [isGenerating, setIsGenerating] = useState(true);
  const [progress, setProgress] = useState(0);
  const [selectedStyle, setSelectedStyle] = useState('Photorealistic');

  // Simulate image generation
  useEffect(() => {
    setIsGenerating(true);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setIsGenerating(false);
          return 100;
        }
        return prev + Math.random() * 15 + 5;
      });
    }, 200);

    return () => clearInterval(progressInterval);
  }, [activeImage]);

  // Cycle through images
  useEffect(() => {
    const cycleInterval = setInterval(() => {
      setActiveImage((prev) => (prev + 1) % DEMO_IMAGES.length);
    }, 5000);

    return () => clearInterval(cycleInterval);
  }, []);

  const currentImage = DEMO_IMAGES[activeImage];

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-500/10 border border-pink-500/30 mb-4">
          <span className="text-pink-400">🎨</span>
          <span className="text-sm font-medium text-pink-300">AI Image Generation</span>
        </div>
        <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3">
          Bring Your Ideas to Life
        </h3>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Describe what you want, choose a style, and watch the AI create stunning images.
          Powered by Nano Banana 3 with configurable model selection.
        </p>
      </div>

      {/* Demo Window */}
      <div className="rounded-2xl overflow-hidden shadow-2xl shadow-pink-500/10 border border-slate-700/50">
        {/* Window Chrome */}
        <div className="bg-slate-800 px-4 py-2 flex items-center justify-between border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <span className="text-sm font-medium text-white">Image Generator</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-pink-500/20 text-pink-400 border border-pink-500/30">
              Nano Banana 3
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="bg-slate-900 p-6">
          {/* Split View */}
          <div className="grid grid-cols-2 gap-6">
            {/* Controls */}
            <div className="space-y-4">
              {/* Prompt */}
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">Prompt</label>
                <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                  <p className="text-slate-300 text-sm italic">&quot;{currentImage.prompt}&quot;</p>
                </div>
              </div>

              {/* Style Selection */}
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">Style</label>
                <div className="grid grid-cols-3 gap-2">
                  {STYLES.map((style) => (
                    <button
                      key={style}
                      onClick={() => setSelectedStyle(style)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        selectedStyle === style || currentImage.style === style
                          ? 'bg-pink-500/20 border border-pink-500/50 text-pink-300'
                          : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              {/* Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Size</label>
                  <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 px-3 py-2 text-sm text-slate-300">
                    1024 × 1024
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Steps</label>
                  <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 px-3 py-2 text-sm text-slate-300">
                    30
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <button
                className={`w-full py-3 rounded-xl font-semibold text-white transition-all ${
                  isGenerating
                    ? 'bg-slate-700 cursor-wait'
                    : 'bg-gradient-to-r from-pink-600 to-purple-600 hover:shadow-lg hover:shadow-pink-500/25'
                }`}
              >
                {isGenerating ? 'Generating...' : 'Generate Image'}
              </button>
            </div>

            {/* Image Preview */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Preview</label>
              <div className="relative aspect-square rounded-xl overflow-hidden border border-slate-700/50">
                {/* Placeholder with gradient */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${currentImage.gradient} opacity-30`}
                />

                {/* Generation Animation */}
                {isGenerating ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80">
                    <div className="w-16 h-16 border-4 border-pink-500/20 border-t-pink-500 rounded-full animate-spin mb-4" />
                    <p className="text-sm text-slate-400 mb-2">Generating image...</p>
                    <div className="w-48 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, progress)}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-2">{Math.round(progress)}%</p>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-6xl mb-4">🎨</div>
                      <p className="text-slate-400 text-sm">Image Generated</p>
                      <p className="text-xs text-slate-500 mt-1">{currentImage.style} Style</p>
                    </div>
                  </div>
                )}

                {/* Style Badge */}
                <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm text-xs text-white">
                  {currentImage.style}
                </div>
              </div>
            </div>
          </div>

          {/* Image Carousel Indicators */}
          <div className="flex justify-center gap-2 mt-6">
            {DEMO_IMAGES.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === activeImage ? 'bg-pink-500 w-6' : 'bg-slate-600 hover:bg-slate-500'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-slate-800 border-t border-slate-700/50 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span>Nano Banana 3</span>
            <span>30 steps</span>
          </div>
          <div className="flex items-center gap-4">
            <span>1024×1024</span>
            <span>~15s</span>
          </div>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="text-center p-4">
          <div className="text-2xl mb-2">🎯</div>
          <div className="text-white font-medium text-sm">Multiple Styles</div>
          <div className="text-slate-500 text-xs">8+ artistic styles</div>
        </div>
        <div className="text-center p-4">
          <div className="text-2xl mb-2">⚡</div>
          <div className="text-white font-medium text-sm">Fast Generation</div>
          <div className="text-slate-500 text-xs">Results in seconds</div>
        </div>
        <div className="text-center p-4">
          <div className="text-2xl mb-2">🔧</div>
          <div className="text-white font-medium text-sm">Configurable</div>
          <div className="text-slate-500 text-xs">Swap models anytime</div>
        </div>
      </div>
    </div>
  );
}
