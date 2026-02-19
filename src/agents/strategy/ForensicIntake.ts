/**
 * FORENSIC INTAKE SYSTEM
 *
 * Acts as a forensic psychologist to deeply understand the user's situation
 * before deploying the strategy agent army.
 *
 * Uses Opus 4.6 for maximum understanding and nuance.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  UserProblem,
  SynthesizedProblem,
  StrategyStreamCallback,
  PriorityItem,
} from './types';
import { CLAUDE_OPUS_46, FORENSIC_INTAKE_PROMPT } from './constants';
import { logger } from '@/lib/logger';

const log = logger('ForensicIntake');

// =============================================================================
// INTAKE CONVERSATION STATE
// =============================================================================

interface IntakeState {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  synthesizedProblem?: SynthesizedProblem;
  isComplete: boolean;
  questionCount: number;
  maxQuestions: number;
}

// =============================================================================
// FORENSIC INTAKE CLASS
// =============================================================================

export class ForensicIntake {
  private client: Anthropic;
  private state: IntakeState;
  private onStream?: StrategyStreamCallback;
  private model = CLAUDE_OPUS_46;
  private systemPrompt: string;
  private openingMessage: string;

  constructor(
    client: Anthropic,
    onStream?: StrategyStreamCallback,
    systemPrompt?: string,
    openingMessage?: string
  ) {
    this.client = client;
    this.onStream = onStream;
    this.systemPrompt = systemPrompt || FORENSIC_INTAKE_PROMPT;
    this.openingMessage = openingMessage || '';
    this.state = {
      messages: [],
      isComplete: false,
      questionCount: 0,
      maxQuestions: 10, // Max back-and-forth before forcing synthesis
    };
  }

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

  /**
   * Get the current messages for persistence
   */
  getMessages(): Array<{ role: 'user' | 'assistant'; content: string }> {
    return [...this.state.messages];
  }

  /**
   * Restore messages from persistence (for serverless session restoration)
   */
  restoreMessages(messages: Array<{ role: 'user' | 'assistant'; content: string }>): void {
    this.state.messages = [...messages];
    // Count questions from restored messages
    this.state.questionCount = messages.filter((m) => m.role === 'assistant').length;
    log.info('Restored intake state', {
      messageCount: messages.length,
      questionCount: this.state.questionCount,
    });
  }

  /**
   * Start the intake process
   * Returns the opening message to display to the user
   */
  async startIntake(): Promise<string> {
    this.emitEvent('intake_start', 'Starting forensic intake process');

    // Use injected opening message if provided, otherwise use default
    const openingMessage =
      this.openingMessage ||
      `## Deep Strategy Mode Activated

**You've activated the most powerful AI strategy system ever built.**

This isn't ChatGPT. This is an autonomous research army. I'm about to deploy:

**THE BRAIN HIERARCHY**
• **Claude Opus 4.6** — Master Architect (designs your strategy, maximum intelligence)
• **Claude Sonnet 4.5** — Project Managers (coordinate research teams)
• **Up to 100 Claude Haiku 4.5 Scouts** (parallel research army)

**EACH SCOUT HAS ACCESS TO:**
• **E2B Cloud Sandbox** — Secure isolated execution environment
• **Headless Chromium + Puppeteer** — Full browser automation
• **Claude Vision AI** — Screenshot analysis, chart extraction, visual intelligence
• **Python/JavaScript Execution** — Data processing, calculations, scraping
• **14 Specialized Research Tools:**
  - Brave Search (real-time web search)
  - Browser Visit (JavaScript-rendered pages)
  - Vision Analyze (AI screenshot analysis)
  - Extract Tables (pricing tables, comparison charts)
  - Safe Form Fill (search filters, not logins)
  - Pagination Handler (multi-page results)
  - Infinite Scroll (social feeds, listings)
  - Click Navigate (expand details, tabs)
  - PDF Extraction (documents, reports)
  - Screenshot Capture (visual documentation)
  - Code Execution (data analysis)
  - Compare Screenshots (side-by-side analysis)
  - Comparison Table Generator (organize findings)

**SAFETY FRAMEWORK:**
• Domain blocking (no .gov, banking, adult content)
• Form whitelist (only search/filter forms)
• Input validation (no passwords, payment info)
• Rate limiting (prevents abuse)
• Output sanitization (redacts sensitive data)

**This will take 2-5 minutes once I understand your problem.**

Don't summarize. Don't filter. Don't worry about being organized. Just... tell me everything. Vent if you need to. The more context I have, the better strategy I can build.

**What's going on? What are you trying to figure out?**`;

    this.state.messages.push({
      role: 'assistant',
      content: openingMessage,
    });

    return openingMessage;
  }

  /**
   * Process user input and generate follow-up or synthesis
   */
  async processUserInput(userInput: string): Promise<{
    response: string;
    isComplete: boolean;
    problem?: UserProblem;
  }> {
    // Add user message to history
    this.state.messages.push({
      role: 'user',
      content: userInput,
    });

    this.state.questionCount++;

    // Check if we've hit the question limit
    if (this.state.questionCount >= this.state.maxQuestions) {
      log.info('Max questions reached, forcing synthesis');
      return this.forceSynthesis();
    }

    // Generate response using Opus
    const response = await this.generateResponse();

    // Check if the response contains a synthesis
    const synthesis = this.extractSynthesis(response);

    if (synthesis) {
      this.state.isComplete = true;
      this.state.synthesizedProblem = synthesis;

      this.emitEvent('intake_complete', 'Intake complete, problem synthesized');

      return {
        response: this.formatSynthesisResponse(response, synthesis),
        isComplete: true,
        problem: this.buildUserProblem(),
      };
    }

    // Continue the conversation
    this.state.messages.push({
      role: 'assistant',
      content: response,
    });

    this.emitEvent('intake_question', `Follow-up question ${this.state.questionCount}`);

    return {
      response,
      isComplete: false,
    };
  }

  /**
   * Check if intake is complete
   */
  isComplete(): boolean {
    return this.state.isComplete;
  }

  /**
   * Get the synthesized problem
   */
  getSynthesizedProblem(): SynthesizedProblem | undefined {
    return this.state.synthesizedProblem;
  }

  /**
   * Get the full user problem object
   */
  getUserProblem(): UserProblem | undefined {
    if (!this.state.isComplete || !this.state.synthesizedProblem) {
      return undefined;
    }
    return this.buildUserProblem();
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Generate a response using Opus 4.6
   */
  private async generateResponse(): Promise<string> {
    try {
      // Filter messages to ensure they start with 'user' role
      // (Anthropic API requires first message to be 'user')
      // The opening assistant message is for frontend display only
      const apiMessages = this.state.messages.filter((m, i) => {
        // Skip leading assistant messages
        if (i === 0 && m.role === 'assistant') return false;
        return true;
      });

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        temperature: 0.7,
        system: this.systemPrompt,
        messages: apiMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const textContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      return textContent;
    } catch (error) {
      log.error('Error generating intake response', error as Error);
      throw error;
    }
  }

  /**
   * Extract synthesis JSON from response
   */
  private extractSynthesis(response: string): SynthesizedProblem | null {
    // Look for JSON block in response
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/i);
    if (!jsonMatch) return null;

    try {
      const parsed = JSON.parse(jsonMatch[1]);

      // Check if it's a complete synthesis
      if (parsed.intakeComplete && parsed.synthesis) {
        return this.validateAndNormalizeSynthesis(parsed.synthesis);
      }

      return null;
    } catch (error) {
      log.warn('Failed to parse synthesis JSON', { error });
      return null;
    }
  }

  /**
   * Validate and normalize the synthesis object
   */
  private validateAndNormalizeSynthesis(raw: Record<string, unknown>): SynthesizedProblem {
    return {
      summary: String(raw.summary || ''),
      coreQuestion: String(raw.coreQuestion || ''),
      constraints: Array.isArray(raw.constraints) ? raw.constraints.map(String) : [],
      priorities: this.normalizePriorities(raw.priorities),
      stakeholders: Array.isArray(raw.stakeholders) ? raw.stakeholders.map(String) : [],
      timeframe: String(raw.timeframe || 'Not specified'),
      riskTolerance: this.normalizeRiskTolerance(raw.riskTolerance),
      complexity: this.normalizeComplexity(raw.complexity),
      domains: Array.isArray(raw.domains) ? raw.domains.map(String) : [],
      hiddenFactors: Array.isArray(raw.hiddenFactors) ? raw.hiddenFactors.map(String) : [],
      successCriteria: Array.isArray(raw.successCriteria) ? raw.successCriteria.map(String) : [],
    };
  }

  /**
   * Normalize priorities array
   */
  private normalizePriorities(raw: unknown): PriorityItem[] {
    if (!Array.isArray(raw)) return [];

    return raw.map((item) => {
      if (typeof item === 'object' && item !== null) {
        const p = item as Record<string, unknown>;
        return {
          factor: String(p.factor || ''),
          importance: typeof p.importance === 'number' ? p.importance : 5,
          isNegotiable: Boolean(p.isNegotiable),
        };
      }
      return { factor: String(item), importance: 5, isNegotiable: true };
    });
  }

  /**
   * Normalize risk tolerance
   */
  private normalizeRiskTolerance(raw: unknown): 'low' | 'medium' | 'high' {
    const value = String(raw).toLowerCase();
    if (value === 'low' || value === 'medium' || value === 'high') {
      return value;
    }
    return 'medium';
  }

  /**
   * Normalize complexity
   */
  private normalizeComplexity(raw: unknown): 'simple' | 'moderate' | 'complex' | 'extreme' {
    const value = String(raw).toLowerCase();
    if (value === 'simple' || value === 'moderate' || value === 'complex' || value === 'extreme') {
      return value;
    }
    return 'moderate';
  }

  /**
   * Force synthesis when max questions reached
   */
  private async forceSynthesis(): Promise<{
    response: string;
    isComplete: boolean;
    problem?: UserProblem;
  }> {
    const forcePrompt = `Based on what the user has shared so far, please provide your synthesis now. We've gathered enough information to proceed. Output the JSON synthesis block.`;

    this.state.messages.push({
      role: 'user',
      content: forcePrompt,
    });

    const response = await this.generateResponse();
    const synthesis = this.extractSynthesis(response);

    if (synthesis) {
      this.state.isComplete = true;
      this.state.synthesizedProblem = synthesis;

      this.emitEvent('intake_complete', 'Intake complete (forced synthesis)');

      return {
        response: this.formatSynthesisResponse(response, synthesis),
        isComplete: true,
        problem: this.buildUserProblem(),
      };
    }

    // If still no synthesis, create a basic one from the conversation
    const fallbackSynthesis = this.createFallbackSynthesis();
    this.state.isComplete = true;
    this.state.synthesizedProblem = fallbackSynthesis;

    this.emitEvent('intake_complete', 'Intake complete (fallback synthesis)');

    return {
      response: "I've gathered enough information to proceed. Let me deploy the strategy team now.",
      isComplete: true,
      problem: this.buildUserProblem(),
    };
  }

  /**
   * Create a fallback synthesis from conversation history
   */
  private createFallbackSynthesis(): SynthesizedProblem {
    const userMessages = this.state.messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join('\n\n');

    return {
      summary: userMessages.slice(0, 500),
      coreQuestion: "How to best address the user's situation?",
      constraints: [],
      priorities: [],
      stakeholders: ['User'],
      timeframe: 'Not specified',
      riskTolerance: 'medium',
      complexity: 'moderate',
      domains: ['General'],
      hiddenFactors: [],
      successCriteria: ["Address the user's core concerns"],
    };
  }

  /**
   * Format the synthesis response for display
   */
  private formatSynthesisResponse(rawResponse: string, synthesis: SynthesizedProblem): string {
    // Remove the JSON block from the response
    const cleanResponse = rawResponse.replace(/```json[\s\S]*?```/gi, '').trim();

    // Add a confirmation message
    const confirmation = `

---

**I understand your situation. Here's my synthesis:**

**Core Question:** ${synthesis.coreQuestion}

**Key Domains to Research:**
${synthesis.domains.map((d) => `• ${d}`).join('\n')}

**Your Priorities:**
${synthesis.priorities
  .slice(0, 5)
  .map((p) => `• ${p.factor} (importance: ${p.importance}/10)`)
  .join('\n')}

**Complexity Level:** ${synthesis.complexity}
**Risk Tolerance:** ${synthesis.riskTolerance}

I'm now deploying the strategy team. This will take 2-5 minutes.`;

    return cleanResponse + confirmation;
  }

  /**
   * Build the full UserProblem object
   */
  private buildUserProblem(): UserProblem {
    const userMessages = this.state.messages.filter((m) => m.role === 'user').map((m) => m.content);

    return {
      rawInput: userMessages[0] || '',
      clarifyingResponses: userMessages.slice(1),
      synthesizedProblem: this.state.synthesizedProblem!,
      intakeTimestamp: Date.now(),
      intakeComplete: true,
    };
  }

  /**
   * Emit a stream event
   */
  private emitEvent(
    type: 'intake_start' | 'intake_question' | 'intake_complete',
    message: string
  ): void {
    if (this.onStream) {
      this.onStream({
        type,
        message,
        timestamp: Date.now(),
      });
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createForensicIntake(
  client: Anthropic,
  onStream?: StrategyStreamCallback,
  systemPrompt?: string,
  openingMessage?: string
): ForensicIntake {
  return new ForensicIntake(client, onStream, systemPrompt, openingMessage);
}
