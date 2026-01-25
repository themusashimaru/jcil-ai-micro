'use client';

/**
 * DEEP STRATEGY MODAL
 *
 * The hype warning modal before launching the Deep Strategy Agent.
 */

import { useEffect, useRef } from 'react';
import { X, Zap, Brain, Search, Shield, Sparkles } from 'lucide-react';

interface DeepStrategyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: () => void;
}

export function DeepStrategyModal({ isOpen, onClose, onStart }: DeepStrategyModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        ref={modalRef}
        className="relative w-full max-w-lg mx-4 bg-gray-900 rounded-2xl shadow-2xl border border-purple-500/30 animate-in zoom-in-95 duration-200"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <Brain className="w-16 h-16 text-purple-400" />
                <Zap className="absolute -top-1 -right-1 w-6 h-6 text-yellow-400 animate-pulse" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Deep Strategy Mode</h2>
            <p className="text-gray-400">
              You&apos;re about to activate the most advanced AI strategy system ever built.
            </p>
          </div>

          {/* Features */}
          <div className="bg-gray-800/50 rounded-xl p-4 mb-6 space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <span className="text-white font-medium">Opus 4.5 Master Architect</span>
                <span className="text-gray-400"> — designs your strategy</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Brain className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <span className="text-white font-medium">Sonnet 4.5 Project Managers</span>
                <span className="text-gray-400"> — coordinate research</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Search className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <span className="text-white font-medium">Up to 100 Haiku 4.5 Scouts</span>
                <span className="text-gray-400"> — parallel research army</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <Shield className="w-4 h-4 text-yellow-400" />
              </div>
              <div>
                <span className="text-white font-medium">Hundreds of web searches</span>
                <span className="text-gray-400"> — real-time data</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-400 text-center mb-6">
            This system will deeply analyze your situation and produce a comprehensive strategy with
            specific recommendations. The AI will ask you clarifying questions first —{' '}
            <span className="text-white">tell it everything, don&apos;t hold back.</span>
          </p>

          {/* Cost estimate */}
          <div className="bg-gray-800/30 rounded-lg p-3 mb-6 text-center">
            <span className="text-gray-400 text-sm">Estimated time: </span>
            <span className="text-white text-sm font-medium">2-5 minutes</span>
            <span className="text-gray-500 text-sm mx-2">|</span>
            <span className="text-gray-400 text-sm">Estimated cost: </span>
            <span className="text-white text-sm font-medium">$8-15</span>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={onStart}
              className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Launch Deep Strategy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
