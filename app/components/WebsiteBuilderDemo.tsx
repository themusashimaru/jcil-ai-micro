/**
 * WEBSITE BUILDER DEMO
 *
 * PURPOSE:
 * - Showcase AI website generation capabilities
 * - 22+ professional templates
 * - One-click deploy to Vercel
 * - Supabase database integration
 */

'use client';

import { useState } from 'react';

const templates = [
  { name: 'Hero Landing', category: 'landing', icon: '🚀', color: 'from-indigo-500 to-purple-500' },
  { name: 'E-commerce', category: 'shop', icon: '🛒', color: 'from-amber-500 to-orange-500' },
  { name: 'SaaS Product', category: 'saas', icon: '💻', color: 'from-blue-500 to-cyan-500' },
  { name: 'Restaurant', category: 'food', icon: '🍽️', color: 'from-red-500 to-rose-500' },
  { name: 'Portfolio', category: 'creative', icon: '🎨', color: 'from-pink-500 to-purple-500' },
  { name: 'Agency', category: 'business', icon: '🏢', color: 'from-slate-500 to-gray-500' },
];

const features = [
  { icon: '🎯', title: '22+ Templates', desc: 'Professional designs for any business type' },
  { icon: '🤖', title: 'AI-Powered', desc: 'Describe your vision, we build it' },
  { icon: '⚡', title: 'One-Click Deploy', desc: 'Live on Vercel in seconds' },
  { icon: '🗄️', title: 'Supabase Ready', desc: 'Database schemas auto-generated' },
  { icon: '🖼️', title: 'Logo Generation', desc: 'AI creates your brand assets' },
  { icon: '✏️', title: 'Live Editing', desc: 'Customize anything in real-time' },
];

export default function WebsiteBuilderDemo() {
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildStep, setBuildStep] = useState(0);

  const buildSteps = [
    'Analyzing your requirements...',
    'Selecting optimal template...',
    'Generating custom content...',
    'Creating logo and assets...',
    'Building responsive layouts...',
    'Deploying to Vercel...',
    'Website live! 🎉',
  ];

  const simulateBuild = () => {
    setIsBuilding(true);
    setBuildStep(0);

    const interval = setInterval(() => {
      setBuildStep((prev) => {
        if (prev >= buildSteps.length - 1) {
          clearInterval(interval);
          setTimeout(() => setIsBuilding(false), 2000);
          return prev;
        }
        return prev + 1;
      });
    }, 800);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 mb-6">
          <span className="text-orange-400">🌐</span>
          <span className="text-sm font-medium text-orange-300">AI Website Builder</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Full Websites in{' '}
          <span className="bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent">
            60 Seconds
          </span>
        </h2>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
          Describe your business. Get a professional website with AI-generated content,
          logos, and one-click deployment to Vercel. 22+ templates, infinite possibilities.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 items-start">
        {/* Left: Template Showcase */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span>📂</span> 22+ Professional Templates
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {templates.map((template, index) => (
              <button
                key={index}
                onClick={() => setSelectedTemplate(index)}
                className={`p-4 rounded-xl border transition-all duration-300 text-left ${
                  selectedTemplate === index
                    ? 'bg-gradient-to-br ' + template.color + ' border-white/20 scale-105'
                    : 'bg-slate-700/50 border-slate-600/50 hover:border-slate-500'
                }`}
              >
                <span className="text-2xl mb-2 block">{template.icon}</span>
                <span className="text-sm font-medium text-white">{template.name}</span>
                <span className="text-xs text-slate-300 block">{template.category}</span>
              </button>
            ))}
          </div>

          <div className="text-center text-slate-400 text-sm">
            + 16 more categories: Wellness, Real Estate, Events, Education...
          </div>
        </div>

        {/* Right: Build Demo */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span>✨</span> AI Build Process
          </h3>

          {!isBuilding ? (
            <div className="space-y-4">
              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
                <label className="text-sm text-slate-400 mb-2 block">Describe your business:</label>
                <textarea
                  className="w-full bg-transparent text-white resize-none focus:outline-none"
                  rows={3}
                  defaultValue="I need a modern landing page for my coffee shop in Seattle. We specialize in organic, locally-roasted beans and cozy atmosphere."
                />
              </div>

              <button
                onClick={simulateBuild}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-600 to-red-600 text-white font-semibold hover:shadow-xl hover:shadow-orange-500/25 transition-all duration-300"
              >
                Build My Website →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {buildSteps.map((step, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-500 ${
                    index < buildStep
                      ? 'bg-green-500/10 text-green-400'
                      : index === buildStep
                      ? 'bg-orange-500/10 text-orange-400 animate-pulse'
                      : 'text-slate-500'
                  }`}
                >
                  <span className="text-lg">
                    {index < buildStep ? '✅' : index === buildStep ? '⏳' : '○'}
                  </span>
                  <span className="text-sm">{step}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-8">
        {features.map((feature, index) => (
          <div
            key={index}
            className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30 text-center hover:border-orange-500/30 transition-colors"
          >
            <span className="text-2xl mb-2 block">{feature.icon}</span>
            <h4 className="text-sm font-semibold text-white mb-1">{feature.title}</h4>
            <p className="text-xs text-slate-400">{feature.desc}</p>
          </div>
        ))}
      </div>

      {/* Tech Stack Badges */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50 text-sm">
          <span>▲</span>
          <span className="text-slate-300">Vercel Deploy</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50 text-sm">
          <span className="text-green-400">⚡</span>
          <span className="text-slate-300">Supabase</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50 text-sm">
          <span>📦</span>
          <span className="text-slate-300">GitHub Push</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700/50 text-sm">
          <span>🎨</span>
          <span className="text-slate-300">AI Images</span>
        </div>
      </div>
    </div>
  );
}
