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
  | 'research'        // Web search, fact-finding
  | 'deep-research'   // Comprehensive parallel research (multiple sub-queries)
  | 'analysis'        // Data analysis, code execution
  | 'generation'      // Document creation (resume, spreadsheet, etc.)
  | 'conversation'    // Simple Q&A, follow-ups
  | 'creative'        // Writing, brainstorming
  | 'calculation'     // Math, formulas
  | 'code-review';    // GitHub repository analysis and review

export interface SubTask {
  id: number;
  description: string;
  type: TaskType;
  dependsOn: number[]; // IDs of tasks this depends on
  estimatedTool: string; // Which tool/capability will be used
  requiresCheckpoint?: boolean; // If true, pause after this step for user confirmation
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
            enum: ['research', 'deep-research', 'analysis', 'generation', 'conversation', 'creative', 'calculation', 'code-review']
          },
          dependsOn: {
            type: 'array',
            items: { type: 'number' }
          },
          estimatedTool: { type: 'string' },
          requiresCheckpoint: {
            type: 'boolean',
            description: 'True if user should confirm before proceeding to next step (for major decisions or deliverables)'
          }
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

const CLASSIFICATION_PROMPT = `You are a task classifier for an AI assistant. Analyze the user's request and determine if it TRULY requires multiple distinct steps.

⚠️ CRITICAL: DEFAULT TO SIMPLE. Only mark as complex if there are GENUINELY MULTIPLE DISTINCT PHASES.

A request is COMPLEX ONLY if it requires 2+ of these DISTINCT phases:
1. RESEARCH PHASE: Searching the web for current information the AI doesn't know
2. ANALYSIS PHASE: Processing data, calculations, comparisons
3. CREATION PHASE: Generating a document/report based on gathered information

A request is SIMPLE if:
- It's a single question or request
- It can be answered directly from AI knowledge
- It's writing code, explaining concepts, creating content
- It's a follow-up or conversation
- NO external research is needed

🚨 SIMPLE REQUESTS (DO NOT OVERCOMPLICATE):
- "Write hello world in Python" → SIMPLE (just write the code!)
- "Create a function that sorts arrays" → SIMPLE (just write it!)
- "Explain how React works" → SIMPLE (AI knows this)
- "Write me an email" → SIMPLE (just write it!)
- "Create a resume" → SIMPLE (gather info conversationally, then create)
- "What's 2+2?" → SIMPLE (just answer!)
- "How do I use TypeScript?" → SIMPLE (explain it!)

🔧 COMPLEX REQUESTS (genuinely need multiple phases):
- "Research current crypto prices AND create a report" → COMPLEX (needs live research + document)
- "Find competitor analysis AND make a comparison spreadsheet" → COMPLEX (research + creation)
- "Look up the latest AI news AND summarize the trends" → COMPLEX (web search + synthesis)

THE KEY QUESTION: Does this REQUIRE external web research/data that the AI doesn't already know?
- If NO → SIMPLE. Just do it.
- If YES, and also needs document creation → COMPLEX.

Code generation is ALWAYS simple. The AI knows programming languages. Don't "research" how to write hello world.

For each subtask, specify:
- type: One of these based on the task nature:
  * research - Simple web search, quick fact-finding
  * deep-research - Comprehensive research requiring multiple angles (use for "research X thoroughly", "deep dive into", "analyze the market for")
  * analysis - Data analysis, processing information
  * generation - Creating documents, reports, content
  * conversation - Simple Q&A, follow-ups
  * creative - Writing, brainstorming
  * calculation - Math, formulas
  * code-review - Analyzing GitHub repositories, reviewing code, finding bugs (use when user provides a GitHub URL or asks to review their project/code)
- estimatedTool: googleSearch, deepResearch, codeExecution, documentGeneration, githubReview, or chat
- dependsOn: IDs of tasks that must complete first (empty array if none)
- requiresCheckpoint: true/false - Set to TRUE for steps where user should confirm before proceeding

WHEN TO USE code-review:
- User provides a GitHub URL (github.com/owner/repo)
- User asks to "review my code/project/repo"
- User asks to "analyze my codebase"
- User asks "what's wrong with my code"
- User asks to "help me with my GitHub project"

WHEN TO USE deep-research vs research:
- Use "deep-research" for: market analysis, competitor research, comprehensive topic research, trend analysis
- Use "research" for: quick fact lookup, simple questions, single-source queries

CHECKPOINT GUIDELINES (requiresCheckpoint):
- Set TRUE after research steps if the findings significantly affect next steps
- Set TRUE before generating final deliverables (documents, reports)
- Set TRUE when the user needs to make a decision
- Set FALSE for routine steps that should flow automatically
- When in doubt for 3+ step tasks, add a checkpoint after step 1 or 2`;

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

  // =========================================================================
  // SIMPLE CODE GENERATION - These should NEVER trigger task planning
  // =========================================================================
  // Single code snippets, examples, or basic programming tasks
  const simpleCodePatterns = [
    /^write (a |an |me )?(hello world|fizzbuzz|fibonacci|factorial)/i,
    /^(write|create|make|show|give) (a |an |me )?(simple |basic )?(function|class|script|code|program|snippet)/i,
    /^(write|create|show|give) (a |an |me )?.*\b(in|using) (typescript|javascript|python|java|go|rust|c\+\+|ruby|php|swift|kotlin)/i,
    /^how (do|would) (i|you) (write|create|make)/i,
    /^(can you )?(write|create|show|make) (a |an )?(simple |basic |quick )?(example|demo|snippet)/i,
    /^(code|implement|write) (a |an )?\w+ (function|method|class)/i,
    /^print\b/i,
    /^console\.log/i,
    /^hello world/i,
  ];

  for (const pattern of simpleCodePatterns) {
    if (pattern.test(lowerMessage)) {
      console.log('[TaskPlanner] Simple code request detected - skipping classification');
      return true;
    }
  }

  // Simple document/content requests (no research needed)
  const simpleContentPatterns = [
    /^(write|draft|create) (a |an )?(short |brief )?(email|message|note|letter)/i,
    /^(explain|describe|tell me about|what is)/i,
    /^(summarize|rewrite|translate|convert)/i,
  ];

  for (const pattern of simpleContentPatterns) {
    if (pattern.test(lowerMessage)) return true;
  }

  // Multi-step indicators - these genuinely need planning
  const complexIndicators = [
    'and then', 'after that', 'additionally', 'as well as',
    'research', 'find out', 'look up', 'search for',
    'compare', 'analyze the market', 'investigate',
    ', then ', // Sequential tasks
    ', and ', // Multiple tasks in a list
  ];
  const hasComplexIndicator = complexIndicators.some(ind => lowerMessage.includes(ind));

  // Check for multiple DISTINCT action verbs (not just any verb)
  // Only count verbs that suggest separate tasks
  const researchVerbs = ['research', 'investigate', 'find out', 'look up', 'search for'];
  const analysisVerbs = ['analyze', 'compare', 'evaluate', 'assess'];
  const creationVerbs = ['create', 'write', 'build', 'make', 'generate'];

  const hasResearch = researchVerbs.some(v => lowerMessage.includes(v));
  const hasAnalysis = analysisVerbs.some(v => lowerMessage.includes(v));
  const hasCreation = creationVerbs.some(v => lowerMessage.includes(v));

  // Only complex if combining research/analysis WITH creation
  const hasMultiplePhases = (hasResearch || hasAnalysis) && hasCreation;

  // If no complex indicators AND no multi-phase work, it's simple
  if (!hasComplexIndicator && !hasMultiplePhases) return true;

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
