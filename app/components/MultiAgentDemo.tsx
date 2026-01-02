/**
 * MULTI-AGENT DEMO COMPONENT
 *
 * PURPOSE:
 * - Landing page showcase for Multi-Agent Orchestration
 * - Animated demo showing agents working together
 * - Visual representation of the agent pipeline
 */

'use client';

import { useState, useEffect } from 'react';

const AGENTS = [
  {
    id: 'researcher',
    name: 'Research Agent',
    icon: '🔬',
    color: 'blue',
    output: 'Analyzing requirements... Found 3 relevant patterns. Recommending Next.js 14 with App Router.',
  },
  {
    id: 'architect',
    name: 'Architect Agent',
    icon: '📐',
    color: 'purple',
    output: 'Designed 5-layer architecture. Planning 12 components. API routes defined.',
  },
  {
    id: 'coder',
    name: 'Coder Agent',
    icon: '💻',
    color: 'green',
    output: 'Generated 2,847 lines of code. 18 files created. All TypeScript types defined.',
  },
  {
    id: 'reviewer',
    name: 'Review Agent',
    icon: '👁️',
    color: 'amber',
    output: 'Code review complete. 0 critical issues. 2 suggestions applied. Ready for deployment.',
  },
  {
    id: 'tester',
    name: 'Tester Agent',
    icon: '🧪',
    color: 'cyan',
    output: '24 test cases generated. 100% coverage. All tests passing.',
  },
];

const COLOR_CLASSES: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/50', text: 'text-blue-400', glow: 'shadow-blue-500/30' },
  purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/50', text: 'text-purple-400', glow: 'shadow-purple-500/30' },
  green: { bg: 'bg-green-500/20', border: 'border-green-500/50', text: 'text-green-400', glow: 'shadow-green-500/30' },
  amber: { bg: 'bg-amber-500/20', border: 'border-amber-500/50', text: 'text-amber-400', glow: 'shadow-amber-500/30' },
  cyan: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/50', text: 'text-cyan-400', glow: 'shadow-cyan-500/30' },
};

export default function MultiAgentDemo() {
  const [activeAgent, setActiveAgent] = useState(0);
  const [typedOutput, setTypedOutput] = useState('');
  const [completedAgents, setCompletedAgents] = useState<number[]>([]);

  // Progress through agents
  useEffect(() => {
    if (activeAgent >= AGENTS.length) {
      // Reset after a pause
      setTimeout(() => {
        setActiveAgent(0);
        setTypedOutput('');
        setCompletedAgents([]);
      }, 3000);
      return;
    }

    const currentAgent = AGENTS[activeAgent];
    let charIndex = 0;

    const typingInterval = setInterval(() => {
      if (charIndex <= currentAgent.output.length) {
        setTypedOutput(currentAgent.output.slice(0, charIndex));
        charIndex += 2;
      } else {
        clearInterval(typingInterval);
        // Mark as complete and move to next
        setTimeout(() => {
          setCompletedAgents((prev) => [...prev, activeAgent]);
          setActiveAgent((prev) => prev + 1);
          setTypedOutput('');
        }, 500);
      }
    }, 30);

    return () => clearInterval(typingInterval);
  }, [activeAgent]);

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 mb-4">
          <span className="text-amber-400">🤖</span>
          <span className="text-sm font-medium text-amber-300">Multi-Agent Orchestration</span>
        </div>
        <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3">
          5 Specialized Agents. One Mission.
        </h3>
        <p className="text-slate-400 max-w-2xl mx-auto">
          Complex tasks are broken down and handled by specialized AI agents that work together.
          Research, design, code, review, and test - all automated.
        </p>
      </div>

      {/* Demo Window */}
      <div className="rounded-2xl overflow-hidden shadow-2xl shadow-amber-500/10 border border-slate-700/50">
        {/* Window Chrome */}
        <div className="bg-slate-800 px-4 py-2 flex items-center justify-between border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
            <span className="text-sm font-medium text-white">Agent Orchestrator</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>{completedAgents.length}/{AGENTS.length} complete</span>
          </div>
        </div>

        {/* Content */}
        <div className="bg-slate-900 p-6">
          {/* Agent Pipeline */}
          <div className="flex items-center justify-between mb-8 relative">
            {/* Connection Line */}
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-700 -translate-y-1/2 -z-0" />
            <div
              className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 -translate-y-1/2 -z-0 transition-all duration-500"
              style={{ width: `${(completedAgents.length / (AGENTS.length - 1)) * 100}%` }}
            />

            {AGENTS.map((agent, index) => {
              const colors = COLOR_CLASSES[agent.color];
              const isActive = index === activeAgent;
              const isComplete = completedAgents.includes(index);

              return (
                <div
                  key={agent.id}
                  className="relative z-10 flex flex-col items-center"
                >
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all duration-300 ${
                      isComplete
                        ? 'bg-green-500/20 border-2 border-green-500'
                        : isActive
                        ? `${colors.bg} border-2 ${colors.border} shadow-lg ${colors.glow} animate-pulse`
                        : 'bg-slate-800 border-2 border-slate-700'
                    }`}
                  >
                    {isComplete ? '✅' : agent.icon}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium ${
                      isActive ? colors.text : isComplete ? 'text-green-400' : 'text-slate-500'
                    }`}
                  >
                    {agent.name.replace(' Agent', '')}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Active Agent Output */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 min-h-[120px]">
            {activeAgent < AGENTS.length ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-10 h-10 rounded-full ${
                      COLOR_CLASSES[AGENTS[activeAgent].color].bg
                    } flex items-center justify-center text-xl`}
                  >
                    {AGENTS[activeAgent].icon}
                  </div>
                  <div>
                    <p className={`font-semibold ${COLOR_CLASSES[AGENTS[activeAgent].color].text}`}>
                      {AGENTS[activeAgent].name}
                    </p>
                    <p className="text-xs text-slate-500">Working...</p>
                  </div>
                </div>
                <div className="font-mono text-sm text-slate-300">
                  {typedOutput}
                  <span className="inline-block w-2 h-4 bg-slate-400 animate-pulse ml-1" />
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="text-4xl mb-3">🎉</div>
                <p className="text-white font-semibold">All Agents Complete!</p>
                <p className="text-sm text-green-400">Project ready for deployment</p>
              </div>
            )}
          </div>

          {/* Agent Summary */}
          {completedAgents.length > 0 && activeAgent < AGENTS.length && (
            <div className="mt-4 flex flex-wrap gap-2">
              {completedAgents.map((agentIndex) => {
                const agent = AGENTS[agentIndex];
                return (
                  <div
                    key={agent.id}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-xs"
                  >
                    <span className="text-green-400">✓</span>
                    <span className="text-green-300">{agent.name}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-slate-800 border-t border-slate-700/50 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Orchestrating
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>5 agents</span>
            <span>Parallel execution</span>
          </div>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="text-center p-4">
          <div className="text-2xl mb-2">🎯</div>
          <div className="text-white font-medium text-sm">Specialized Agents</div>
          <div className="text-slate-500 text-xs">Each agent has a focus</div>
        </div>
        <div className="text-center p-4">
          <div className="text-2xl mb-2">⚡</div>
          <div className="text-white font-medium text-sm">Parallel Execution</div>
          <div className="text-slate-500 text-xs">Work together efficiently</div>
        </div>
        <div className="text-center p-4">
          <div className="text-2xl mb-2">🔄</div>
          <div className="text-white font-medium text-sm">Context Sharing</div>
          <div className="text-slate-500 text-xs">Agents inform each other</div>
        </div>
      </div>
    </div>
  );
}
