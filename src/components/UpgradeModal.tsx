'use client';

import { X, Zap, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  features: string[];
  price: string;
  paymentLink: string;
  fromTier: string;
  toTier: string;
  highlightText?: string;
}

export default function UpgradeModal({
  isOpen,
  onClose,
  title,
  description,
  features,
  price,
  paymentLink,
  fromTier,
  toTier,
  highlightText = "14 Days Free Trial"
}: UpgradeModalProps) {
  if (!isOpen) return null;

  const handleUpgrade = () => {
    // Open payment link in current tab
    window.location.href = paymentLink;
  };

  const handleClose = (e: React.MouseEvent) => {
    // Prevent closing if clicking inside the modal content
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative animate-in zoom-in-95 duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-lg">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">
          {title}
        </h2>

        {/* Highlight Badge */}
        {highlightText && (
          <div className="flex justify-center mb-4">
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-bold rounded-full shadow-md">
              <Zap className="h-4 w-4" />
              {highlightText}
            </span>
          </div>
        )}

        {/* Description */}
        <p className="text-slate-600 text-center mb-6">
          {description}
        </p>

        {/* Price */}
        <div className="text-center mb-6">
          <div className="text-4xl font-black text-blue-900 mb-1">
            {price}
            <span className="text-lg text-slate-600 font-normal">/month</span>
          </div>
          <p className="text-sm text-slate-500">Cancel anytime • No hidden fees</p>
        </div>

        {/* Features List */}
        <div className="bg-slate-50 rounded-lg p-4 mb-6 space-y-2">
          {features.map((feature, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <div className="mt-0.5">
                <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
              </div>
              <span className="text-sm text-slate-700">{feature}</span>
            </div>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="space-y-3">
          <Button
            onClick={handleUpgrade}
            className="w-full bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-600 hover:to-yellow-500 text-blue-900 font-bold text-lg py-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            Upgrade Now - {highlightText}
            <Zap className="ml-2 h-5 w-5" />
          </Button>

          <Button
            onClick={onClose}
            variant="ghost"
            className="w-full text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          >
            Maybe Later
          </Button>
        </div>

        {/* Trust Signal */}
        <p className="text-xs text-center text-slate-500 mt-4">
          Join thousands of Christians using Slingshot 2.0
        </p>
      </div>
    </div>
  );
}
