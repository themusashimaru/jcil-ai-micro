/**
 * PROMPT ENGINEERING TOOL
 * LLM prompt optimization and design
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

const PROMPT_TEMPLATES = {
  zeroShot: {
    description: 'Direct instruction without examples',
    template: `[TASK DESCRIPTION]

{instruction}

[INPUT]
{input}

[OUTPUT]`,
    useCase: 'Simple, well-defined tasks'
  },
  fewShot: {
    description: 'Instruction with examples',
    template: `[TASK DESCRIPTION]
{instruction}

[EXAMPLES]
Input: {example1_input}
Output: {example1_output}

Input: {example2_input}
Output: {example2_output}

[YOUR TURN]
Input: {input}
Output:`,
    useCase: 'Tasks requiring pattern learning'
  },
  chainOfThought: {
    description: 'Step-by-step reasoning',
    template: `{instruction}

Let's think through this step by step:

1. First, I need to understand...
2. Then, I should consider...
3. Based on this analysis...
4. Therefore, the answer is...

Input: {input}`,
    useCase: 'Complex reasoning, math, logic'
  },
  rolePlay: {
    description: 'Assign a specific persona',
    template: `You are {role}, an expert in {domain} with {experience}.

Your task is to {instruction}.

Guidelines:
- {guideline1}
- {guideline2}
- {guideline3}

User Query: {input}

Your Response:`,
    useCase: 'Domain expertise, specific tone/style'
  },
  structured: {
    description: 'Structured output format',
    template: `{instruction}

Input: {input}

Respond with a JSON object containing:
{
  "analysis": "your analysis here",
  "confidence": 0.0-1.0,
  "reasoning": "step by step reasoning",
  "result": "final answer"
}`,
    useCase: 'Parsing, structured data extraction'
  },
  selfConsistency: {
    description: 'Multiple reasoning paths',
    template: `{instruction}

Input: {input}

Generate 3 different approaches to solve this:

Approach 1:
[reasoning]
Answer: [answer1]

Approach 2:
[reasoning]
Answer: [answer2]

Approach 3:
[reasoning]
Answer: [answer3]

Final Answer (most common): [final]`,
    useCase: 'Uncertain tasks, improving accuracy'
  }
};

function optimizePrompt(prompt: string): Record<string, unknown> {
  const issues: Array<{ issue: string; suggestion: string; severity: string }> = [];
  const improvements: string[] = [];

  // Check for clarity issues
  if (!prompt.includes('You are') && !prompt.includes('Your task') && !prompt.includes('Please')) {
    issues.push({
      issue: 'Missing clear instruction framing',
      suggestion: 'Start with "You are..." or "Your task is to..."',
      severity: 'medium'
    });
  }

  // Check for output format specification
  if (!prompt.toLowerCase().includes('format') && !prompt.toLowerCase().includes('output') && !prompt.toLowerCase().includes('respond')) {
    issues.push({
      issue: 'No output format specified',
      suggestion: 'Add "Respond with..." or "Format your answer as..."',
      severity: 'high'
    });
    improvements.push('Specify expected output format');
  }

  // Check for ambiguity
  const vagueWords = ['maybe', 'perhaps', 'kind of', 'sort of', 'might'];
  for (const word of vagueWords) {
    if (prompt.toLowerCase().includes(word)) {
      issues.push({
        issue: `Vague language detected: "${word}"`,
        suggestion: 'Use precise, definitive language',
        severity: 'low'
      });
    }
  }

  // Check length
  if (prompt.length > 2000) {
    issues.push({
      issue: 'Prompt is very long',
      suggestion: 'Consider breaking into smaller tasks or using system prompt',
      severity: 'medium'
    });
  }

  if (prompt.length < 50) {
    issues.push({
      issue: 'Prompt is very short',
      suggestion: 'Add more context and specific instructions',
      severity: 'high'
    });
  }

  // Check for examples
  if (!prompt.includes('example') && !prompt.includes('Example') && !prompt.includes('e.g.')) {
    improvements.push('Consider adding examples (few-shot learning)');
  }

  // Check for constraints
  if (!prompt.includes('must') && !prompt.includes('should') && !prompt.includes('avoid')) {
    improvements.push('Add explicit constraints and boundaries');
  }

  // Suggest template
  let suggestedTemplate = 'zeroShot';
  if (prompt.includes('step') || prompt.includes('reason')) {
    suggestedTemplate = 'chainOfThought';
  } else if (prompt.includes('JSON') || prompt.includes('format')) {
    suggestedTemplate = 'structured';
  } else if (prompt.includes('expert') || prompt.includes('You are')) {
    suggestedTemplate = 'rolePlay';
  }

  return {
    originalLength: prompt.length,
    issues,
    improvements,
    suggestedTemplate,
    score: Math.max(0, 100 - issues.filter(i => i.severity === 'high').length * 20 - issues.filter(i => i.severity === 'medium').length * 10),
    optimizedPrompt: generateOptimizedPrompt(prompt, issues)
  };
}

function generateOptimizedPrompt(original: string, issues: Array<{ issue: string; suggestion: string }>): string {
  let optimized = original;

  // Add instruction framing if missing
  if (issues.some(i => i.issue.includes('instruction framing'))) {
    optimized = `Your task is to:\n${optimized}`;
  }

  // Add output format if missing
  if (issues.some(i => i.issue.includes('output format'))) {
    optimized = `${optimized}\n\nPlease provide your response in a clear, structured format.`;
  }

  return optimized;
}

function generatePrompt(config: {
  task: string;
  template: string;
  role?: string;
  examples?: Array<{ input: string; output: string }>;
  constraints?: string[];
  outputFormat?: string;
}): string {
  const { task, template, role, examples, constraints, outputFormat } = config;

  const templateData = PROMPT_TEMPLATES[template as keyof typeof PROMPT_TEMPLATES] || PROMPT_TEMPLATES.zeroShot;
  let prompt = templateData.template;

  // Replace placeholders
  prompt = prompt.replace('{instruction}', task);

  if (role) {
    prompt = prompt.replace('{role}', role);
    prompt = prompt.replace('{domain}', 'the relevant field');
    prompt = prompt.replace('{experience}', 'extensive experience');
  }

  if (examples && examples.length > 0) {
    prompt = prompt.replace('{example1_input}', examples[0]?.input || '');
    prompt = prompt.replace('{example1_output}', examples[0]?.output || '');
    if (examples[1]) {
      prompt = prompt.replace('{example2_input}', examples[1].input);
      prompt = prompt.replace('{example2_output}', examples[1].output);
    }
  }

  if (constraints && constraints.length > 0) {
    const guidelineText = constraints.map((c) => `- ${c}`).join('\n');
    prompt = prompt.replace('{guideline1}\n- {guideline2}\n- {guideline3}', guidelineText);
  }

  if (outputFormat) {
    prompt += `\n\nOutput Format: ${outputFormat}`;
  }

  // Clean up unused placeholders
  prompt = prompt.replace(/\{[^}]+\}/g, '');

  return prompt;
}

function countTokens(text: string): Record<string, unknown> {
  // Approximate token counting (GPT-style tokenization)
  // Average: 1 token ≈ 4 characters for English
  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // More accurate estimation
  const estimatedTokens = Math.ceil(charCount / 4);

  // Cost estimation (approximate, based on GPT-4 pricing)
  const costPer1KInput = 0.03;
  const costPer1KOutput = 0.06;

  return {
    characters: charCount,
    words: wordCount,
    estimatedTokens,
    estimatedCost: {
      asInput: `$${((estimatedTokens / 1000) * costPer1KInput).toFixed(4)}`,
      asOutput: `$${((estimatedTokens / 1000) * costPer1KOutput).toFixed(4)}`
    },
    fitsInContext: {
      'gpt-3.5-turbo': estimatedTokens < 4096,
      'gpt-4': estimatedTokens < 8192,
      'gpt-4-32k': estimatedTokens < 32768,
      'claude-3': estimatedTokens < 100000
    }
  };
}

function suggestImprovements(prompt: string, task: string): Record<string, unknown> {
  const suggestions: Array<{ category: string; suggestion: string; example: string }> = [];

  // Task-specific suggestions
  if (task.includes('code') || task.includes('programming')) {
    suggestions.push({
      category: 'Code Generation',
      suggestion: 'Add language and framework specifications',
      example: 'Write the code in TypeScript using React 18 and Next.js 14'
    });
    suggestions.push({
      category: 'Code Generation',
      suggestion: 'Specify coding standards',
      example: 'Follow ESLint rules, use functional components, include error handling'
    });
  }

  if (task.includes('summarize') || task.includes('summary')) {
    suggestions.push({
      category: 'Summarization',
      suggestion: 'Specify length and style',
      example: 'Provide a 3-sentence summary in bullet points'
    });
  }

  if (task.includes('analyze') || task.includes('analysis')) {
    suggestions.push({
      category: 'Analysis',
      suggestion: 'Define analysis criteria',
      example: 'Analyze based on: accuracy, completeness, clarity, and relevance'
    });
  }

  // General suggestions
  suggestions.push({
    category: 'Clarity',
    suggestion: 'Add explicit success criteria',
    example: 'A good response will include X, Y, and Z'
  });

  suggestions.push({
    category: 'Format',
    suggestion: 'Request structured output',
    example: 'Return as JSON with keys: summary, key_points, recommendations'
  });

  suggestions.push({
    category: 'Grounding',
    suggestion: 'Add constraints to prevent hallucination',
    example: 'Only use information from the provided context. Say "I don\'t know" if unsure.'
  });

  return {
    originalPrompt: prompt.substring(0, 100) + '...',
    taskType: task,
    suggestions,
    recommendedTemplate: task.includes('reason') ? 'chainOfThought' : task.includes('expert') ? 'rolePlay' : 'structured'
  };
}

export const promptEngineeringTool: UnifiedTool = {
  name: 'prompt_engineering',
  description: 'Prompt Engineering: templates, optimize, generate, count_tokens, suggest_improvements',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['templates', 'optimize', 'generate', 'count_tokens', 'suggest_improvements'] },
      prompt: { type: 'string' },
      task: { type: 'string' },
      template: { type: 'string' },
      role: { type: 'string' },
      examples: { type: 'array' },
      constraints: { type: 'array' },
      outputFormat: { type: 'string' }
    },
    required: ['operation']
  },
};

export async function executePromptEngineering(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'templates':
        result = { templates: PROMPT_TEMPLATES };
        break;
      case 'optimize':
        result = optimizePrompt(args.prompt || 'Write code');
        break;
      case 'generate':
        result = {
          prompt: generatePrompt({
            task: args.task || 'Analyze the given text',
            template: args.template || 'structured',
            role: args.role,
            examples: args.examples,
            constraints: args.constraints,
            outputFormat: args.outputFormat
          })
        };
        break;
      case 'count_tokens':
        result = countTokens(args.prompt || 'Sample text for token counting');
        break;
      case 'suggest_improvements':
        result = suggestImprovements(
          args.prompt || 'Help me with this',
          args.task || 'general assistance'
        );
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isPromptEngineeringAvailable(): boolean { return true; }
