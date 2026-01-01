/**
 * Task Planner - Phase 1: Detection Only
 *
 * Detects complex multi-step requests and extracts subtasks.
 * Based on ADaPT (As-Needed Decomposition and Planning) pattern.
 *
 * This module identifies when a user request requires multiple distinct
 * actions and creates a structured plan. In Phase 1, we only detect
 * and display the plan - execution happens in later phases.
 */

import { createGeminiStructuredCompletion } from '@/lib/gemini/client';
import type { CoreMessage } from 'ai';

// ============================================================================
// Types
// ============================================================================

export type TaskType =
  | 'research'      // Web search, fact-finding
  | 'analysis'      // Data analysis, code execution
  | 'generation'    // Document creation (resume, spreadsheet, etc.)
  | 'conversation'  // Simple Q&A, follow-ups
  | 'creative'      // Writing, brainstorming
  | 'calculation';  // Math, formulas

export interface SubTask {
  id: number;
  description: string;
  type: TaskType;
  dependsOn: number[]; // IDs of tasks this depends on
  estimatedTool: string; // Which tool/capability will be used
}

export interface TaskPlan {
  isComplex: boolean;
  confidence: number; // 0-1 how confident we are in the classification
  reasoning: string; // Why we classified it this way
  subtasks: SubTask[];
  summary: string; // One-line summary of what we'll do
}

export interface TaskPlanResult {
  plan: TaskPlan;
  shouldShowPlan: boolean; // Only show plan for truly complex requests
  planDisplayText: string | null; // Formatted text to prepend to response
}

// ============================================================================
// Schema for Gemini Structured Output
// ============================================================================

const TASK_CLASSIFICATION_SCHEMA = {
  type: 'object',
  properties: {
    isComplex: {
      type: 'boolean',
      description: 'True if the request requires multiple distinct steps or actions'
    },
    confidence: {
      type: 'number',
      description: 'Confidence level from 0 to 1'
    },
    reasoning: {
      type: 'string',
      description: 'Brief explanation of why this is or is not complex'
    },
    subtasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          description: { type: 'string' },
          type: {
            type: 'string',
            enum: ['research', 'analysis', 'generation', 'conversation', 'creative', 'calculation']
          },
          dependsOn: {
            type: 'array',
            items: { type: 'number' }
          },
          estimatedTool: { type: 'string' }
        },
        required: ['id', 'description', 'type', 'dependsOn', 'estimatedTool']
      }
    },
    summary: {
      type: 'string',
      description: 'One sentence summary of the overall task'
    }
  },
  required: ['isComplex', 'confidence', 'reasoning', 'subtasks', 'summary']
};

// ============================================================================
// Classification Logic
// ============================================================================

const CLASSIFICATION_PROMPT = `You are a task classifier for an AI assistant. Analyze the user's request and determine if it requires multiple distinct steps.

A request is COMPLEX if it requires 2 or more of these distinct actions:
- Web research (searching for current information)
- Data analysis (processing numbers, creating charts)
- Document generation (creating resumes, spreadsheets, reports)
- Multi-part deliverables (e.g., "research X AND create a document about it")

A request is SIMPLE if it:
- Is a single question
- Is a single document request
- Is a follow-up to previous conversation
- Can be answered directly without multiple tools
- Is casual conversation

IMPORTANT: Do NOT over-classify. Only mark as complex if there are genuinely distinct steps needed.

Examples of SIMPLE requests:
- "What's the weather like?"
- "Create a resume for me"
- "Explain how photosynthesis works"
- "What did we discuss yesterday?"

Examples of COMPLEX requests:
- "Research competitors in the fitness app market and create a spreadsheet comparing them"
- "Find the latest AI news, analyze the trends, and write a summary report"
- "Calculate my monthly expenses from this data and then create a budget document"

For each subtask, specify:
- type: research, analysis, generation, conversation, creative, or calculation
- estimatedTool: googleSearch, codeExecution, documentGeneration, or chat
- dependsOn: IDs of tasks that must complete first (empty array if none)`;

/**
 * Analyzes a user request and creates a task plan
 */
export async function analyzeRequest(
  userMessage: string,
  conversationContext?: string
): Promise<TaskPlanResult> {
  console.log('[TaskPlanner] Analyzing request:', userMessage.substring(0, 100));

  // Quick filter: Skip very short or obvious simple messages
  if (isObviouslySimple(userMessage)) {
    console.log('[TaskPlanner] Skipping analysis - obviously simple');
    return createSimpleResult();
  }

  try {
    const messages: CoreMessage[] = [
      {
        role: 'user',
        content: conversationContext
          ? `Context from conversation:\n${conversationContext}\n\nUser's request:\n${userMessage}`
          : userMessage
      }
    ];

    const { data: plan } = await createGeminiStructuredCompletion<TaskPlan>({
      messages,
      systemPrompt: CLASSIFICATION_PROMPT,
      schema: TASK_CLASSIFICATION_SCHEMA,
      temperature: 0.3, // Low temperature for consistent classification
      maxTokens: 1024,
      model: 'gemini-2.0-flash', // Use fast model for classification
    });

    console.log('[TaskPlanner] Classification result:', {
      isComplex: plan.isComplex,
      confidence: plan.confidence,
      subtaskCount: plan.subtasks?.length || 0
    });

    // Only show plan for genuinely complex requests with high confidence
    const shouldShowPlan = plan.isComplex &&
                           plan.confidence >= 0.7 &&
                           (plan.subtasks?.length || 0) >= 2;

    return {
      plan,
      shouldShowPlan,
      planDisplayText: shouldShowPlan ? formatPlanForDisplay(plan) : null
    };
  } catch (error) {
    console.error('[TaskPlanner] Classification error:', error);
    // On error, default to simple (don't break the chat)
    return createSimpleResult();
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Quick check for obviously simple messages (avoid API call)
 */
function isObviouslySimple(message: string): boolean {
  const lowerMessage = message.toLowerCase().trim();

  // Very short messages
  if (message.length < 20) return true;

  // Greetings and simple phrases
  const simplePatterns = [
    /^(hi|hello|hey|good morning|good afternoon|good evening|thanks|thank you|ok|okay|yes|no|sure)/i,
    /^what('s| is) (the )?(weather|time|date)/i,
  ];

  for (const pattern of simplePatterns) {
    if (pattern.test(lowerMessage)) return true;
  }

  // Short questions (ends with ? and less than 50 chars)
  if (message.endsWith('?') && message.length < 50) return true;

  // No conjunctions suggesting multiple tasks
  const complexIndicators = [
    'and then', 'after that', 'also', 'additionally', 'as well as',
    'create a', 'make a', 'generate', 'write a', 'build a',
    'analyze', 'research', 'find', 'search', 'compare',
    ', and ', // Comma followed by "and" indicates list of actions
  ];
  const hasComplexIndicator = complexIndicators.some(ind => lowerMessage.includes(ind));

  // Check for multiple action verbs (indicates multi-step task)
  const actionVerbs = ['find', 'search', 'research', 'analyze', 'create', 'write', 'make', 'build', 'compare', 'summarize', 'generate', 'calculate', 'review'];
  const verbCount = actionVerbs.filter(verb => lowerMessage.includes(verb)).length;
  const hasMultipleActions = verbCount >= 2;

  // If no complex indicators AND no multiple actions AND message is short, it's simple
  if (!hasComplexIndicator && !hasMultipleActions && message.length < 100) return true;

  return false;
}

/**
 * Creates a result for simple requests
 */
function createSimpleResult(): TaskPlanResult {
  return {
    plan: {
      isComplex: false,
      confidence: 1.0,
      reasoning: 'Simple request - proceeding directly',
      subtasks: [],
      summary: 'Direct response'
    },
    shouldShowPlan: false,
    planDisplayText: null
  };
}

/**
 * Formats the plan for display to the user
 */
function formatPlanForDisplay(plan: TaskPlan): string {
  if (!plan.subtasks || plan.subtasks.length === 0) {
    return '';
  }

  const toolEmojis: Record<string, string> = {
    googleSearch: '🔍',
    codeExecution: '⚙️',
    documentGeneration: '📄',
    chat: '💬',
  };

  const lines = [
    '**Task Plan**',
    '',
    `*${plan.summary}*`,
    '',
  ];

  for (const task of plan.subtasks) {
    const emoji = toolEmojis[task.estimatedTool] || '📋';
    const dependency = task.dependsOn.length > 0
      ? ` *(after step ${task.dependsOn.join(', ')})*`
      : '';
    lines.push(`${task.id}. ${emoji} ${task.description}${dependency}`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

/**
 * Checks if task planning is enabled (feature flag)
 */
export function isTaskPlanningEnabled(): boolean {
  // For Phase 1, we can control this with an env variable
  // Default to false for safety
  return process.env.ENABLE_TASK_PLANNING === 'true';
}
