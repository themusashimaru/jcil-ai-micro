'use client';

/**
 * DEEP STRATEGY PROGRESS
 *
 * Real-time checkbox-style progress visualization for the Deep Strategy Agent.
 * Inspired by Claude Code's task list UI - clean checkboxes with streaming updates.
 *
 * Features:
 * - Claude Code-style checkbox task list
 * - Mid-execution messaging (add context while running)
 * - Real-time metrics and findings
 */

import { useState, useMemo, useRef, FormEvent } from 'react';
import {
  Brain,
  Search,
  CheckCircle2,
  Circle,
  Loader2,
  X,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Lightbulb,
  Send,
  MessageSquarePlus,
  Monitor,
} from 'lucide-react';
import type { StrategyStreamEvent, Finding } from '@/agents/strategy';
import { BrowserPreviewWindow } from './BrowserPreviewWindow';
import { ResearchActivityFeed } from './ResearchActivityFeed';

interface DeepStrategyProgressProps {
  events: StrategyStreamEvent[];
  isComplete: boolean;
  onCancel?: () => void;
  onAddContext?: (message: string) => Promise<void>;
  isAddingContext?: boolean;
}

interface Task {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'complete';
  detail?: string;
  count?: number;
}

export function DeepStrategyProgress({
  events,
  isComplete,
  onCancel,
  onAddContext,
  isAddingContext = false,
}: DeepStrategyProgressProps) {
  const [showFindings, setShowFindings] = useState(false);
  const [showContextInput, setShowContextInput] = useState(false);
  const [contextMessage, setContextMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Calculate metrics from events
  const metrics = useMemo(() => {
    let totalAgents = 0;
    let completedAgents = 0;
    let searches = 0;
    let cost = 0;

    for (const event of events) {
      if (event.type === 'agent_spawned' && event.data?.totalAgents) {
        totalAgents = event.data.totalAgents;
      }
      if (event.type === 'agent_complete') {
        completedAgents++;
      }
      if (event.type === 'search_complete') {
        searches++;
      }
      if (event.data?.cost) {
        cost = event.data.cost;
      }
    }

    return { totalAgents, completedAgents, searches, cost };
  }, [events]);

  // Get recent findings
  const findings = useMemo(() => {
    return events
      .filter(
        (e): e is StrategyStreamEvent & { data: { finding: Finding } } =>
          e.type === 'finding_discovered' && !!e.data?.finding
      )
      .map((e) => e.data.finding);
  }, [events]);

  // Get user-added context messages
  const contextMessages = useMemo(() => {
    return events.filter((e) => e.type === 'user_context_added').map((e) => e.message);
  }, [events]);

  // Build task list from events
  const tasks = useMemo((): Task[] => {
    const taskList: Task[] = [];

    // 1. Forensic Intake
    const intakeStart = events.find((e) => e.type === 'intake_start');
    const intakeComplete = events.find((e) => e.type === 'intake_complete');
    taskList.push({
      id: 'intake',
      label: 'Understanding your situation',
      status: intakeComplete ? 'complete' : intakeStart ? 'active' : 'pending',
      detail: intakeStart ? 'Forensic intake in progress...' : undefined,
    });

    // 2. Designing Agent Army
    const designStart = events.find((e) => e.type === 'architect_designing');
    const agentSpawned = events.find((e) => e.type === 'agent_spawned');
    taskList.push({
      id: 'design',
      label: 'Designing agent army',
      status: agentSpawned
        ? 'complete'
        : designStart
          ? 'active'
          : intakeComplete
            ? 'pending'
            : 'pending',
      detail: designStart && !agentSpawned ? 'Opus 4.5 designing specialized scouts...' : undefined,
      count: metrics.totalAgents || undefined,
    });

    // 3. Spawning Scouts
    if (agentSpawned) {
      taskList.push({
        id: 'spawn',
        label: 'Spawning research scouts',
        status: metrics.completedAgents > 0 ? 'complete' : 'active',
        count: metrics.totalAgents,
      });
    }

    // 4. Executing Research
    const hasSearches = events.some(
      (e) => e.type === 'search_executing' || e.type === 'search_complete'
    );
    if (hasSearches) {
      const allSearchesComplete = metrics.completedAgents >= metrics.totalAgents;
      taskList.push({
        id: 'research',
        label: 'Conducting web research',
        status: allSearchesComplete ? 'complete' : 'active',
        detail: !allSearchesComplete ? `${metrics.searches} searches completed...` : undefined,
        count: metrics.searches,
      });
    }

    // 5. Processing Scouts
    if (metrics.completedAgents > 0) {
      taskList.push({
        id: 'processing',
        label: 'Processing scout findings',
        status: metrics.completedAgents >= metrics.totalAgents ? 'complete' : 'active',
        detail:
          metrics.completedAgents < metrics.totalAgents
            ? `${metrics.completedAgents}/${metrics.totalAgents} scouts complete`
            : undefined,
        count: metrics.completedAgents,
      });
    }

    // 6. Discovering Findings
    if (findings.length > 0) {
      taskList.push({
        id: 'findings',
        label: 'Discovering insights',
        status: isComplete ? 'complete' : 'active',
        count: findings.length,
      });
    }

    // 7. Synthesis
    const synthStart = events.find((e) => e.type === 'synthesis_start');
    const stratComplete = events.find((e) => e.type === 'strategy_complete');
    if (synthStart || stratComplete) {
      taskList.push({
        id: 'synthesis',
        label: 'Synthesizing strategy',
        status: stratComplete ? 'complete' : 'active',
        detail: !stratComplete ? 'Opus 4.5 creating final recommendations...' : undefined,
      });
    }

    return taskList;
  }, [events, metrics, findings.length, isComplete]);

  // Get current status message
  const statusMessage = events.length > 0 ? events[events.length - 1].message : 'Initializing...';

  // Handle adding context
  const handleAddContext = async (e: FormEvent) => {
    e.preventDefault();
    if (!contextMessage.trim() || !onAddContext) return;

    await onAddContext(contextMessage.trim());
    setContextMessage('');
    setShowContextInput(false);
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Brain className="w-5 h-5 text-purple-400" />
            {!isComplete && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            )}
          </div>
          <div>
            <h3 className="font-medium text-white text-sm">Deep Strategy</h3>
            <p className="text-xs text-gray-500 max-w-[200px] truncate">{statusMessage}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Add Context button - like Claude Code's interrupt */}
          {!isComplete && onAddContext && (
            <button
              onClick={() => {
                setShowContextInput(!showContextInput);
                setTimeout(() => inputRef.current?.focus(), 100);
              }}
              className="p-1.5 text-gray-500 hover:text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors"
              title="Add more context"
            >
              <MessageSquarePlus className="w-4 h-4" />
            </button>
          )}
          {!isComplete && onCancel && (
            <button
              onClick={onCancel}
              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Mid-execution context input */}
      {showContextInput && !isComplete && (
        <form onSubmit={handleAddContext} className="p-3 border-b border-gray-800 bg-gray-800/30">
          <p className="text-xs text-gray-400 mb-2">
            Add more context while the strategy runs (like Claude Code):
          </p>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={contextMessage}
              onChange={(e) => setContextMessage(e.target.value)}
              placeholder="I forgot to mention..."
              disabled={isAddingContext}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!contextMessage.trim() || isAddingContext}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 transition-colors"
            >
              {isAddingContext ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </form>
      )}

      {/* User-added context messages */}
      {contextMessages.length > 0 && (
        <div className="p-3 border-b border-gray-800 space-y-2">
          <p className="text-xs text-gray-500">Added context:</p>
          {contextMessages.map((msg, i) => (
            <div key={i} className="text-xs text-purple-300 bg-purple-500/10 rounded px-2 py-1">
              {msg}
            </div>
          ))}
        </div>
      )}

      {/* Browser Preview Window - The star of the show */}
      <div className="p-4 border-b border-gray-800">
        <BrowserPreviewWindow events={events} isComplete={isComplete} />
      </div>

      {/* Task List - Claude Code style checkboxes */}
      <div className="p-4 space-y-2">
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} />
        ))}
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-4 px-4 py-3 bg-gray-800/30 border-t border-gray-800 text-xs">
        <div className="flex items-center gap-1.5 text-gray-400">
          <Brain className="w-3.5 h-3.5" />
          <span>
            {metrics.completedAgents}/{metrics.totalAgents || '?'} agents
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-400">
          <Search className="w-3.5 h-3.5" />
          <span>{metrics.searches} searches</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-400">
          <Lightbulb className="w-3.5 h-3.5" />
          <span>{findings.length} findings</span>
        </div>
        {metrics.cost > 0 && (
          <div className="flex items-center gap-1.5 text-gray-400 ml-auto">
            <Sparkles className="w-3.5 h-3.5" />
            <span>${metrics.cost.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Expandable Findings Preview */}
      {findings.length > 0 && (
        <div className="border-t border-gray-800">
          <button
            onClick={() => setShowFindings(!showFindings)}
            className="w-full flex items-center gap-2 px-4 py-2 text-xs text-gray-400 hover:bg-gray-800/50 transition-colors"
          >
            {showFindings ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            <span>Recent Findings ({findings.length})</span>
          </button>
          {showFindings && (
            <div className="px-4 pb-3 space-y-2 max-h-40 overflow-y-auto">
              {findings.slice(-5).map((finding, i) => (
                <div
                  key={finding.id || i}
                  className="flex items-start gap-2 p-2 bg-gray-800/50 rounded-lg"
                >
                  <div
                    className={`
                    mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0
                    ${
                      finding.confidence === 'high'
                        ? 'bg-green-400'
                        : finding.confidence === 'medium'
                          ? 'bg-yellow-400'
                          : 'bg-red-400'
                    }
                  `}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{finding.title}</p>
                    <p className="text-xs text-gray-500 truncate">{finding.agentName}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Expandable Activity Log */}
      <div className="border-t border-gray-800">
        <details className="group">
          <summary className="flex items-center gap-2 px-4 py-2 text-xs text-gray-400 hover:bg-gray-800/50 transition-colors cursor-pointer list-none">
            <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" />
            <Monitor className="w-3.5 h-3.5" />
            <span>Activity Log</span>
          </summary>
          <div className="p-4 pt-0">
            <ResearchActivityFeed events={events} isComplete={isComplete} maxVisible={12} />
          </div>
        </details>
      </div>
    </div>
  );
}

// =============================================================================
// TASK ITEM COMPONENT - Claude Code style checkbox
// =============================================================================

function TaskItem({ task }: { task: Task }) {
  return (
    <div className="flex items-start gap-3">
      {/* Checkbox */}
      <div className="mt-0.5 flex-shrink-0">
        {task.status === 'complete' ? (
          <CheckCircle2 className="w-4 h-4 text-green-400" />
        ) : task.status === 'active' ? (
          <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
        ) : (
          <Circle className="w-4 h-4 text-gray-600" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm ${
              task.status === 'complete'
                ? 'text-gray-400 line-through'
                : task.status === 'active'
                  ? 'text-white'
                  : 'text-gray-500'
            }`}
          >
            {task.label}
          </span>
          {task.count !== undefined && (
            <span
              className={`
              text-xs px-1.5 py-0.5 rounded
              ${
                task.status === 'active'
                  ? 'bg-purple-500/20 text-purple-300'
                  : 'bg-gray-700 text-gray-400'
              }
            `}
            >
              {task.count}
            </span>
          )}
        </div>
        {task.detail && task.status === 'active' && (
          <p className="text-xs text-gray-500 mt-0.5">{task.detail}</p>
        )}
      </div>
    </div>
  );
}
