/**
 * ADVANCED REASONER
 *
 * The cognitive core of the Code Agent.
 * Implements multiple reasoning strategies:
 *
 * 1. CHAIN-OF-THOUGHT (CoT)
 *    - Step-by-step reasoning visible to the user
 *    - Shows the "why" behind every decision
 *
 * 2. TREE-OF-THOUGHT (ToT)
 *    - Explores multiple approaches before committing
 *    - Scores and ranks alternatives
 *    - Picks the optimal path
 *
 * 3. SELF-REFLECTION
 *    - Agent critiques its own output
 *    - Catches errors before delivery
 *    - Iterative improvement
 *
 * 4. METACOGNITION
 *    - Agent is aware of its own limitations
 *    - Knows when to ask for help
 *    - Tracks confidence levels
 *
 * This is what makes the agent think like a senior engineer.
 */

import { agentChat, ProviderId } from '@/lib/ai/providers';
import { AgentContext, AgentStreamCallback, CodeIntent } from '../../core/types';

// ============================================================================
// TYPES
// ============================================================================

export interface ThoughtNode {
  id: string;
  content: string;
  type: 'observation' | 'hypothesis' | 'analysis' | 'decision' | 'action' | 'reflection';
  confidence: number; // 0-1
  children: ThoughtNode[];
  parent?: string;
  metadata?: Record<string, unknown>;
}

export interface ReasoningPath {
  id: string;
  description: string;
  steps: ThoughtNode[];
  score: number;
  pros: string[];
  cons: string[];
  effort: 'low' | 'medium' | 'high';
  risk: 'low' | 'medium' | 'high';
  selected?: boolean;
}

export interface ReasoningResult {
  selectedPath: ReasoningPath;
  alternativePaths: ReasoningPath[];
  chainOfThought: ThoughtNode[];
  selfReflection: SelfReflection;
  confidence: number;
  uncertainties: string[];
}

export interface SelfReflection {
  strengths: string[];
  weaknesses: string[];
  improvements: string[];
  overallQuality: number; // 0-100
  shouldProceed: boolean;
  blockers?: string[];
}

// ============================================================================
// CHAIN OF THOUGHT
// ============================================================================

export class ChainOfThought {
  private provider: ProviderId = 'claude';
  private thoughts: ThoughtNode[] = [];
  setProvider(provider: ProviderId): void {
    this.provider = provider;
  }

  /**
   * Think through a problem step by step
   */
  async reason(
    problem: string,
    context: string,
    onStream: AgentStreamCallback
  ): Promise<ThoughtNode[]> {
    this.thoughts = [];

    const prompt = `You are an expert software architect thinking through a problem step-by-step.

PROBLEM:
${problem}

CONTEXT:
${context}

Think through this problem methodically. For each step:
1. Make an OBSERVATION about what you see
2. Form a HYPOTHESIS about what might work
3. ANALYZE the hypothesis
4. Make a DECISION based on analysis
5. Plan the ACTION to take

Format your thinking as a JSON array of thought steps:
[
  {
    "type": "observation" | "hypothesis" | "analysis" | "decision" | "action" | "reflection",
    "content": "Your thought here",
    "confidence": 0.0-1.0,
    "reasoning": "Why you think this"
  }
]

Be thorough but concise. Show your real thinking process.
A senior engineer would think about edge cases, security, performance, maintainability.

OUTPUT ONLY THE JSON ARRAY.`;

    try {
      const response = await agentChat(
        [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        { provider: this.provider, maxTokens: 4000 }
      );

      const text = response.text.trim();
      const jsonMatch = text.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        this.thoughts = parsed.map((t: Record<string, unknown>, i: number) => ({
          id: `thought-${i}`,
          content: String(t.content || ''),
          type: this.validateThoughtType(t.type),
          confidence: Number(t.confidence) || 0.5,
          children: [],
          metadata: { reasoning: t.reasoning },
        }));

        // Stream thoughts to user
        for (const thought of this.thoughts) {
          this.streamThought(onStream, thought);
          await this.delay(100); // Brief pause for readability
        }
      }

      return this.thoughts;
    } catch (error) {
      console.error('[ChainOfThought] Error:', error);
      return [];
    }
  }

  /**
   * Stream a thought to the user
   */
  private streamThought(onStream: AgentStreamCallback, thought: ThoughtNode): void {
    const icons: Record<string, string> = {
      observation: '👁️',
      hypothesis: '💭',
      analysis: '🔍',
      decision: '⚖️',
      action: '🎯',
      reflection: '🪞',
    };

    const icon = icons[thought.type] || '○';
    const confidence = Math.round(thought.confidence * 100);

    onStream({
      type: 'thinking',
      message: `${icon} **${thought.type.toUpperCase()}** (${confidence}% confident): ${thought.content}`,
      timestamp: Date.now(),
      details: {
        thoughtType: thought.type,
        confidence: thought.confidence,
      },
    });
  }

  private validateThoughtType(type: unknown): ThoughtNode['type'] {
    const valid = ['observation', 'hypothesis', 'analysis', 'decision', 'action', 'reflection'];
    return valid.includes(String(type)) ? (type as ThoughtNode['type']) : 'observation';
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// TREE OF THOUGHT
// ============================================================================

export class TreeOfThought {
  private provider: ProviderId = 'claude';
  setProvider(provider: ProviderId): void {
    this.provider = provider;
  }

  /**
   * Explore multiple approaches and pick the best one
   */
  async explore(
    task: string,
    intent: CodeIntent,
    _context: AgentContext,
    onStream: AgentStreamCallback
  ): Promise<{ paths: ReasoningPath[]; selected: ReasoningPath }> {
    onStream({
      type: 'thinking',
      message: '🌳 Exploring multiple approaches...',
      timestamp: Date.now(),
    });

    const prompt = `You are an expert software architect evaluating different approaches to a task.

TASK:
${task}

PROJECT CONTEXT:
- Type: ${intent.projectType}
- Complexity: ${intent.complexity}
- Technologies: ${intent.technologies.primary}
- Requirements: ${intent.requirements.functional.join(', ')}

Generate 3 different approaches to solve this task. For each approach:
1. Describe the approach
2. List the steps involved
3. Identify pros and cons
4. Estimate effort (low/medium/high)
5. Assess risk (low/medium/high)
6. Score it 0-100

IMPORTANT: Think like a senior engineer. Consider:
- Maintainability over time
- Team scalability
- Performance implications
- Security considerations
- Testing ease
- Deployment complexity

Format as JSON:
{
  "approaches": [
    {
      "id": "approach-1",
      "description": "Brief description",
      "steps": ["Step 1", "Step 2", ...],
      "pros": ["Pro 1", "Pro 2"],
      "cons": ["Con 1", "Con 2"],
      "effort": "low" | "medium" | "high",
      "risk": "low" | "medium" | "high",
      "score": 0-100
    }
  ],
  "recommendation": "approach-X",
  "reasoning": "Why this approach is best"
}

OUTPUT ONLY THE JSON.`;

    try {
      const response = await agentChat(
        [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        { provider: this.provider, maxTokens: 4000 }
      );

      const text = response.text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('No JSON response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const approaches = parsed.approaches || [];
      const recommendedId = parsed.recommendation;

      const paths: ReasoningPath[] = approaches.map((a: Record<string, unknown>) => ({
        id: String(a.id || `approach-${Math.random()}`),
        description: String(a.description || ''),
        steps: this.convertStepsToNodes(a.steps as string[]),
        score: Number(a.score) || 50,
        pros: (a.pros as string[]) || [],
        cons: (a.cons as string[]) || [],
        effort: this.validateLevel(a.effort),
        risk: this.validateLevel(a.risk),
        selected: a.id === recommendedId,
      }));

      // Sort by score
      paths.sort((a, b) => b.score - a.score);

      // Stream approaches to user
      for (const path of paths) {
        this.streamApproach(onStream, path);
        await this.delay(200);
      }

      const selected = paths.find((p) => p.selected) || paths[0];

      onStream({
        type: 'thinking',
        message: `✅ Selected: **${selected.description}** (Score: ${selected.score})`,
        timestamp: Date.now(),
        details: { selectedApproach: selected.id },
      });

      return { paths, selected };
    } catch (error) {
      console.error('[TreeOfThought] Error:', error);

      // Return default path
      const defaultPath: ReasoningPath = {
        id: 'default',
        description: 'Standard implementation approach',
        steps: [],
        score: 70,
        pros: ['Simple', 'Straightforward'],
        cons: ['May not be optimal'],
        effort: 'medium',
        risk: 'low',
        selected: true,
      };

      return { paths: [defaultPath], selected: defaultPath };
    }
  }

  /**
   * Stream approach to user
   */
  private streamApproach(onStream: AgentStreamCallback, path: ReasoningPath): void {
    const selected = path.selected ? '→' : ' ';
    const scoreBar =
      '█'.repeat(Math.round(path.score / 10)) + '░'.repeat(10 - Math.round(path.score / 10));

    onStream({
      type: 'thinking',
      message: `${selected} **${path.description}** [${scoreBar}] ${path.score}%\n   Effort: ${path.effort} | Risk: ${path.risk}`,
      timestamp: Date.now(),
      details: {
        approach: path.id,
        score: path.score,
        pros: path.pros,
        cons: path.cons,
      },
    });
  }

  private convertStepsToNodes(steps: string[]): ThoughtNode[] {
    return (steps || []).map((step, i) => ({
      id: `step-${i}`,
      content: step,
      type: 'action' as const,
      confidence: 0.8,
      children: [],
    }));
  }

  private validateLevel(level: unknown): 'low' | 'medium' | 'high' {
    const valid = ['low', 'medium', 'high'];
    return valid.includes(String(level)) ? (level as 'low' | 'medium' | 'high') : 'medium';
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// SELF REFLECTION
// ============================================================================

export class SelfReflector {
  private provider: ProviderId = 'claude';
  setProvider(provider: ProviderId): void {
    this.provider = provider;
  }

  /**
   * Critically evaluate generated output
   */
  async reflect(
    task: string,
    output: string,
    context: string,
    onStream: AgentStreamCallback
  ): Promise<SelfReflection> {
    onStream({
      type: 'evaluating',
      message: '🪞 Self-reflecting on output quality...',
      timestamp: Date.now(),
    });

    const prompt = `You are a senior code reviewer critically evaluating AI-generated output.

ORIGINAL TASK:
${task}

GENERATED OUTPUT:
${output}

CONTEXT:
${context}

Critically evaluate this output. Be HARSH but FAIR. Look for:

1. **Correctness** - Does it actually solve the problem?
2. **Completeness** - Are all requirements addressed?
3. **Security** - Any OWASP vulnerabilities?
4. **Performance** - Any obvious bottlenecks?
5. **Best Practices** - Does it follow conventions?
6. **Edge Cases** - Are they handled?
7. **Error Handling** - Is it robust?
8. **Testability** - Can it be easily tested?

Format as JSON:
{
  "strengths": ["What's good about this output"],
  "weaknesses": ["What's wrong or missing"],
  "improvements": ["Specific changes to make"],
  "overallQuality": 0-100,
  "shouldProceed": true/false,
  "blockers": ["Critical issues that must be fixed first"] or null
}

Be specific. Don't just say "good error handling" - say exactly what's good or bad.

OUTPUT ONLY THE JSON.`;

    try {
      const response = await agentChat(
        [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        { provider: this.provider, maxTokens: 2000 }
      );

      const text = response.text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('No JSON response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      const reflection: SelfReflection = {
        strengths: (parsed.strengths || []).map(String),
        weaknesses: (parsed.weaknesses || []).map(String),
        improvements: (parsed.improvements || []).map(String),
        overallQuality: Number(parsed.overallQuality) || 50,
        shouldProceed: Boolean(parsed.shouldProceed),
        blockers: parsed.blockers ? parsed.blockers.map(String) : undefined,
      };

      // Stream reflection results
      this.streamReflection(onStream, reflection);

      return reflection;
    } catch (error) {
      console.error('[SelfReflector] Error:', error);
      return {
        strengths: [],
        weaknesses: ['Unable to complete self-reflection'],
        improvements: [],
        overallQuality: 50,
        shouldProceed: true,
      };
    }
  }

  /**
   * Stream reflection to user
   */
  private streamReflection(onStream: AgentStreamCallback, reflection: SelfReflection): void {
    const qualityBar =
      '█'.repeat(Math.round(reflection.overallQuality / 10)) +
      '░'.repeat(10 - Math.round(reflection.overallQuality / 10));

    let message = `📊 Quality: [${qualityBar}] ${reflection.overallQuality}%\n`;

    if (reflection.strengths.length > 0) {
      message += `✅ Strengths: ${reflection.strengths.slice(0, 2).join(', ')}\n`;
    }

    if (reflection.weaknesses.length > 0) {
      message += `⚠️ Weaknesses: ${reflection.weaknesses.slice(0, 2).join(', ')}\n`;
    }

    if (reflection.blockers && reflection.blockers.length > 0) {
      message += `🛑 Blockers: ${reflection.blockers.join(', ')}`;
    }

    onStream({
      type: 'evaluating',
      message,
      timestamp: Date.now(),
      details: reflection,
    });
  }
}

// ============================================================================
// MAIN REASONER
// ============================================================================

export class Reasoner {
  private chainOfThought = new ChainOfThought();
  private treeOfThought = new TreeOfThought();
  private selfReflector = new SelfReflector();

  setProvider(provider: ProviderId): void {
    this.chainOfThought.setProvider(provider);
    this.treeOfThought.setProvider(provider);
    this.selfReflector.setProvider(provider);
  }

  /**
   * Full reasoning pipeline
   */
  async reason(
    task: string,
    intent: CodeIntent,
    context: AgentContext,
    onStream: AgentStreamCallback
  ): Promise<ReasoningResult> {
    // Step 1: Chain of Thought - understand the problem
    const thoughts = await this.chainOfThought.reason(
      task,
      `Project: ${intent.refinedDescription}`,
      onStream
    );

    // Step 2: Tree of Thought - explore approaches
    const { paths, selected } = await this.treeOfThought.explore(task, intent, context, onStream);

    // Calculate overall confidence
    const avgThoughtConfidence =
      thoughts.length > 0
        ? thoughts.reduce((sum, t) => sum + t.confidence, 0) / thoughts.length
        : 0.5;

    const confidence = (avgThoughtConfidence + selected.score / 100) / 2;

    // Identify uncertainties
    const uncertainties = thoughts.filter((t) => t.confidence < 0.6).map((t) => t.content);

    return {
      selectedPath: selected,
      alternativePaths: paths.filter((p) => !p.selected),
      chainOfThought: thoughts,
      selfReflection: {
        strengths: [],
        weaknesses: [],
        improvements: [],
        overallQuality: 0,
        shouldProceed: true,
      },
      confidence,
      uncertainties,
    };
  }

  /**
   * Reflect on generated output
   */
  async reflect(
    task: string,
    output: string,
    context: string,
    onStream: AgentStreamCallback
  ): Promise<SelfReflection> {
    return this.selfReflector.reflect(task, output, context, onStream);
  }
}

export const reasoner = new Reasoner();
