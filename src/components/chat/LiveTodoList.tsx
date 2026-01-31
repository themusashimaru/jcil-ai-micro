/**
 * LIVE TODO LIST COMPONENT
 *
 * Displays and manages to-do items extracted from chat messages
 * - Parses markdown checkboxes from AI responses
 * - Interactive checkboxes
 * - Persists state locally
 */

'use client';

import { useState, useEffect, useMemo } from 'react';

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  messageId: string;
}

interface LiveTodoListProps {
  messages: Array<{ id: string; role: string; content: string }>;
  conversationId: string | null;
  onTodoToggle?: (todoId: string, completed: boolean) => void;
}

// Storage key prefix for persisting todos
const STORAGE_KEY_PREFIX = 'chat_todos_';

/**
 * Patterns that identify transient progress indicators (not user-actionable to-dos)
 * These are system status messages that shouldn't appear in the interactive to-do list
 */
const PROGRESS_INDICATOR_PATTERNS = [
  // Slide generation progress - COMPREHENSIVE patterns
  /^Researching topic$/i,
  /^Research complete$/i,
  /^Designing slide layout/i,
  /^Slide \d+/i, // Matches "Slide 1: Title", "Slide 1 regenerated", etc.
  /regenerated$/i, // Matches anything ending in "regenerated"
  /^Generating background$/i,
  /^Background complete$/i,
  /^Rendering text overlay$/i,
  /^Text overlay complete$/i,
  /^Running quality check$/i,
  /^Re-checking quality$/i,
  /^Quality check/i,
  /^Regenerating/i, // "Regenerating slide 1", etc.
  /automatically improved$/i,
  /^Creating presentation/i,
  /^Generating \d+ slides/i,
  // Image generation progress
  /^Generating image$/i,
  /^Image complete$/i,
  /^Enhancing prompt$/i,
  /^Storing image$/i,
  // Document generation progress
  /^Creating document$/i,
  /^Document complete$/i,
  /^Generating PDF$/i,
  /^PDF complete$/i,
  // Research/Deep Strategy progress
  /^Understanding your situation$/i,
  /^Designing agent army$/i,
  /^Spawning research scouts$/i,
  /^Conducting web research$/i,
  /^Processing scout findings$/i,
  /^Discovering insights$/i,
  /^Synthesizing strategy$/i,
  // Generic progress patterns
  /^Almost ready/i,
  /^Processing/i,
  /^Analyzing/i,
  /^Fetching/i,
  /^Loading/i,
];

/**
 * Check if a to-do item is a transient progress indicator
 * These should not appear in the interactive to-do list
 */
function isProgressIndicator(text: string): boolean {
  return PROGRESS_INDICATOR_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Extract to-do items from message content
 * Supports: - [ ] task, - [x] task, * [ ] task, * [x] task
 * Filters out transient progress indicators that aren't user-actionable
 */
function extractTodos(content: string, messageId: string): TodoItem[] {
  const todoRegex = /^[\s]*[-*]\s*\[([ xX~!])\]\s*(.+)$/gm;
  const todos: TodoItem[] = [];
  let match;

  while ((match = todoRegex.exec(content)) !== null) {
    const completed = match[1].toLowerCase() === 'x';
    const text = match[2].trim();

    // Skip transient progress indicators - these aren't user-actionable
    if (isProgressIndicator(text)) {
      continue;
    }

    todos.push({
      id: `${messageId}-${todos.length}`,
      text,
      completed,
      messageId,
    });
  }

  return todos;
}

export function LiveTodoList({ messages, conversationId, onTodoToggle }: LiveTodoListProps) {
  // Track manually toggled todos (overrides parsed state)
  const [toggledTodos, setToggledTodos] = useState<Record<string, boolean>>({});
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load persisted toggles for this conversation
  useEffect(() => {
    if (!conversationId) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY_PREFIX + conversationId);
      if (stored) {
        setToggledTodos(JSON.parse(stored));
      }
    } catch (error) {
      console.error('[LiveTodoList] Error loading persisted todos:', error);
    }
  }, [conversationId]);

  // Save toggles when they change
  useEffect(() => {
    if (!conversationId || Object.keys(toggledTodos).length === 0) return;

    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + conversationId, JSON.stringify(toggledTodos));
    } catch (error) {
      console.error('[LiveTodoList] Error saving todos:', error);
    }
  }, [conversationId, toggledTodos]);

  // Extract all todos from assistant messages
  const allTodos = useMemo(() => {
    const todos: TodoItem[] = [];

    for (const msg of messages) {
      if (msg.role === 'assistant') {
        const msgTodos = extractTodos(msg.content, msg.id);
        todos.push(...msgTodos);
      }
    }

    // Apply manual toggles
    return todos.map((todo) => ({
      ...todo,
      completed: toggledTodos[todo.id] ?? todo.completed,
    }));
  }, [messages, toggledTodos]);

  // Handle checkbox toggle
  const handleToggle = (todoId: string, currentState: boolean) => {
    const newState = !currentState;
    setToggledTodos((prev) => ({ ...prev, [todoId]: newState }));
    onTodoToggle?.(todoId, newState);
  };

  // Calculate progress
  const completedCount = allTodos.filter((t) => t.completed).length;
  const totalCount = allTodos.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Don't render if no todos
  if (allTodos.length === 0) {
    return null;
  }

  return (
    <div className="mx-4 mb-4">
      <div
        className="rounded-xl border backdrop-blur-md overflow-hidden"
        style={{
          backgroundColor: 'var(--glass-bg)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Header */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            {/* Checkbox icon */}
            <div className="p-1.5 rounded-lg bg-green-500/20">
              <svg
                className="w-4 h-4 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </div>
            <div className="text-left">
              <span className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>
                To-Do List
              </span>
              <span className="ml-2 text-xs text-gray-500">
                {completedCount}/{totalCount} completed
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Progress bar */}
            <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Collapse icon */}
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </button>

        {/* Todo items */}
        {!isCollapsed && (
          <div className="px-3 pb-3 space-y-1">
            {allTodos.map((todo) => (
              <label
                key={todo.id}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer group transition-colors"
              >
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => handleToggle(todo.id, todo.completed)}
                  className="mt-0.5 w-4 h-4 rounded border-2 border-gray-500 bg-transparent checked:bg-green-500 checked:border-green-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span
                  className={`text-sm leading-relaxed transition-all ${
                    todo.completed ? 'line-through text-gray-500' : ''
                  }`}
                  style={{ color: todo.completed ? undefined : 'var(--foreground)' }}
                >
                  {todo.text}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Generate a to-do list prompt for the AI
 */
export function generateTodoPrompt(): string {
  return `When suggesting tasks or action items, please format them as a checklist using this format:

- [ ] Task description here
- [ ] Another task

This allows the user to interactively track their progress.`;
}
