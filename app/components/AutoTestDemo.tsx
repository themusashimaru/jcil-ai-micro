/**
 * AUTO-TEST DEMO COMPONENT
 *
 * PURPOSE:
 * - Landing page showcase for Auto-Testing Pipeline
 * - Animated demo showing tests being generated and run
 * - Visual test results display
 */

'use client';

import { useState, useEffect } from 'react';

const TEST_STAGES = [
  { label: 'Analyzing code...', icon: '🔍' },
  { label: 'Generating 24 test cases...', icon: '📝' },
  { label: 'Running unit tests...', icon: '🧪' },
  { label: 'Running integration tests...', icon: '🔗' },
  { label: 'Calculating coverage...', icon: '📊' },
  { label: 'Complete!', icon: '✅' },
];

const MOCK_TESTS = [
  { name: 'Component: Button', type: 'unit', passed: true },
  { name: 'Component: Header', type: 'unit', passed: true },
  { name: 'Component: Sidebar', type: 'unit', passed: true },
  { name: 'Component: Modal', type: 'unit', passed: true },
  { name: 'API: /api/users', type: 'integration', passed: true },
  { name: 'API: /api/auth', type: 'integration', passed: true },
  { name: 'API: /api/chat', type: 'integration', passed: true },
  { name: 'Utility: formatDate', type: 'unit', passed: true },
  { name: 'Utility: validateEmail', type: 'unit', passed: true },
  { name: 'Hook: useAuth', type: 'unit', passed: true },
];

export default function AutoTestDemo() {
  const [stage, setStage] = useState(0);
  const [visibleTests, setVisibleTests] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // Progress through stages
  useEffect(() => {
    if (stage >= TEST_STAGES.length) {
      setIsComplete(true);
      // Reset after a pause
      setTimeout(() => {
        setStage(0);
        setVisibleTests(0);
        setIsComplete(false);
      }, 4000);
      return;
    }

    const stageDuration = stage === TEST_STAGES.length - 1 ? 0 : 800;

    const timer = setTimeout(() => {
      setStage((s) => s + 1);
    }, stageDuration);

    return () => clearTimeout(timer);
  }, [stage]);

  // Show tests progressively when running tests
  useEffect(() => {
    if (stage < 2 || stage >= TEST_STAGES.length - 1) return;

    const timer = setInterval(() => {
      setVisibleTests((prev) => {
        if (prev >= MOCK_TESTS.length) {
          clearInterval(timer);
          return prev;
        }
        return prev + 1;
      });
    }, 150);

    return () => clearInterval(timer);
  }, [stage]);

  const progress = Math.min(100, (stage / (TEST_STAGES.length - 1)) * 100);
  const passedCount = MOCK_TESTS.slice(0, visibleTests).filter((t) => t.passed).length;
  const coverage = isComplete ? 94 : Math.min(94, (visibleTests / MOCK_TESTS.length) * 94);

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 mb-4">
          <span className="text-cyan-400">🧪</span>
          <span className="text-sm font-medium text-cyan-300">Auto-Testing Pipeline</span>
        </div>
        <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3">
          Test Before You Ship
        </h3>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Every project is automatically tested before deployment. The AI generates test cases,
          runs them, and reports coverage - ensuring your code works as expected.
        </p>
      </div>

      {/* Demo Window */}
      <div className="rounded-2xl overflow-hidden shadow-2xl shadow-cyan-500/10 border border-slate-700/50">
        {/* Window Chrome */}
        <div className="bg-slate-800 px-4 py-2 flex items-center justify-between border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <span className="text-sm font-medium text-white">Test Runner</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{passedCount}/{MOCK_TESTS.length} passed</span>
          </div>
        </div>

        {/* Content */}
        <div className="bg-slate-900 p-6">
          {/* Progress Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">
                {TEST_STAGES[Math.min(stage, TEST_STAGES.length - 1)].icon}{' '}
                {TEST_STAGES[Math.min(stage, TEST_STAGES.length - 1)].label}
              </span>
              <span className="text-sm text-cyan-400">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Split View */}
          <div className="grid grid-cols-2 gap-4">
            {/* Test Results */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 h-[250px] overflow-y-auto">
              <h4 className="text-sm font-medium text-slate-300 mb-3">Test Results</h4>
              <div className="space-y-2">
                {MOCK_TESTS.slice(0, visibleTests).map((test, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-700/30"
                  >
                    <div className="flex items-center gap-2">
                      <span className={test.passed ? 'text-green-400' : 'text-red-400'}>
                        {test.passed ? '✓' : '✗'}
                      </span>
                      <span className="text-sm text-slate-300">{test.name}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      test.type === 'unit'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {test.type}
                    </span>
                  </div>
                ))}
                {visibleTests < MOCK_TESTS.length && stage >= 2 && stage < 5 && (
                  <div className="flex items-center gap-2 px-3 py-2">
                    <span className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-slate-400">Running...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Coverage Report */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <h4 className="text-sm font-medium text-slate-300 mb-3">Coverage Report</h4>

              {/* Coverage Circle */}
              <div className="flex items-center justify-center mb-4">
                <div className="relative w-32 h-32">
                  <svg className="w-32 h-32 -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      fill="none"
                      stroke="#334155"
                      strokeWidth="12"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      fill="none"
                      stroke="url(#coverageGradient)"
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={`${coverage * 3.51} 351.68`}
                      className="transition-all duration-500"
                    />
                    <defs>
                      <linearGradient id="coverageGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#06b6d4" />
                        <stop offset="100%" stopColor="#22c55e" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-3xl font-bold text-white">{Math.round(coverage)}%</span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Lines</span>
                  <span className="text-green-400">{Math.round(coverage)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Functions</span>
                  <span className="text-green-400">{Math.round(coverage - 2)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Branches</span>
                  <span className="text-yellow-400">{Math.round(coverage - 8)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Final Status */}
          {isComplete && (
            <div className="mt-4 p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-center">
              <p className="text-green-400 font-semibold">
                ✅ All tests passed! Ready for deployment.
              </p>
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-slate-800 border-t border-slate-700/50 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${isComplete ? 'bg-green-400' : 'bg-cyan-400 animate-pulse'}`} />
              {isComplete ? 'Complete' : 'Testing'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>Jest</span>
            <span>24 tests</span>
          </div>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="text-center p-4">
          <div className="text-2xl mb-2">🤖</div>
          <div className="text-white font-medium text-sm">AI-Generated</div>
          <div className="text-slate-500 text-xs">Tests written by AI</div>
        </div>
        <div className="text-center p-4">
          <div className="text-2xl mb-2">📊</div>
          <div className="text-white font-medium text-sm">Coverage Report</div>
          <div className="text-slate-500 text-xs">See what&apos;s tested</div>
        </div>
        <div className="text-center p-4">
          <div className="text-2xl mb-2">🚫</div>
          <div className="text-white font-medium text-sm">Block Bad Code</div>
          <div className="text-slate-500 text-xs">Fails stop deployment</div>
        </div>
      </div>
    </div>
  );
}
