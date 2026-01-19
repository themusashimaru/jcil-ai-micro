/**
 * COGNITIVE DEBUGGER - THE BRAIN
 *
 * This is the master orchestrator of advanced debugging.
 * It coordinates all analysis modules to think like a senior engineer.
 *
 * Philosophy:
 * - "See" the code from multiple perspectives simultaneously
 * - "Think" about what could go wrong before it does
 * - "Learn" from patterns to predict future issues
 * - "Advise" with the wisdom of thousands of debugging sessions
 */

import { EventEmitter } from 'events';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';
import {
  CognitiveDebugSession,
  CognitiveDebugEvent,
  CodeContext,
  PredictedIssue,
  MultiDimensionalReport,
  CognitiveAnalysis,
  IntentFailureMap,
  UserIntent,
  PatternMatch,
  CodeFix,
  Recommendation,
  DebugLanguage,
  Severity,
} from './types';
import { PredictiveAnalyzer } from './predictive-analyzer';
import { IntentFailureMapper } from './intent-failure-mapper';
import { DeepExecutionTracer } from './deep-execution-tracer';
import { PatternRecognizer } from './pattern-recognizer';
import { MultiDimensionalAnalyzer } from './multi-dimensional-analyzer';
import { CognitiveReasoningEngine } from './cognitive-reasoning-engine';
import { CodeFlowVisualizer } from './code-flow-visualizer';
import { UniversalDebugger } from './universal-debugger';

const log = logger('CognitiveDebugger');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface CognitiveDebuggerConfig {
  /** Maximum concurrent analyses */
  maxConcurrentAnalyses: number;
  /** Enable predictive analysis */
  enablePrediction: boolean;
  /** Enable pattern recognition */
  enablePatternRecognition: boolean;
  /** Enable multi-dimensional analysis */
  enableMultiDimensional: boolean;
  /** Enable cognitive reasoning */
  enableReasoning: boolean;
  /** Auto-fix confidence threshold (0-1) */
  autoFixThreshold: number;
  /** Analysis depth */
  depth: 'surface' | 'shallow' | 'deep' | 'exhaustive';
  /** Languages to support */
  languages: DebugLanguage[];
}

const DEFAULT_CONFIG: CognitiveDebuggerConfig = {
  maxConcurrentAnalyses: 5,
  enablePrediction: true,
  enablePatternRecognition: true,
  enableMultiDimensional: true,
  enableReasoning: true,
  autoFixThreshold: 0.85,
  depth: 'deep',
  languages: [
    'javascript',
    'typescript',
    'python',
    'go',
    'rust',
    'java',
    'kotlin',
    'swift',
    'c',
    'cpp',
    'csharp',
    'ruby',
    'php',
  ],
};

// ============================================================================
// COGNITIVE DEBUGGER
// ============================================================================

export class CognitiveDebugger extends EventEmitter {
  private sessions: Map<string, CognitiveDebugSession> = new Map();
  private config: CognitiveDebuggerConfig;

  // Specialized analyzers
  private predictiveAnalyzer: PredictiveAnalyzer;
  private intentMapper: IntentFailureMapper;
  private executionTracer: DeepExecutionTracer;
  private patternRecognizer: PatternRecognizer;
  private multiDimensionalAnalyzer: MultiDimensionalAnalyzer;
  private reasoningEngine: CognitiveReasoningEngine;
  private flowVisualizer: CodeFlowVisualizer;
  private universalDebugger: UniversalDebugger;

  constructor(config: Partial<CognitiveDebuggerConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize all analyzers
    this.predictiveAnalyzer = new PredictiveAnalyzer();
    this.intentMapper = new IntentFailureMapper();
    this.executionTracer = new DeepExecutionTracer();
    this.patternRecognizer = new PatternRecognizer();
    this.multiDimensionalAnalyzer = new MultiDimensionalAnalyzer();
    this.reasoningEngine = new CognitiveReasoningEngine();
    this.flowVisualizer = new CodeFlowVisualizer();
    this.universalDebugger = new UniversalDebugger();

    log.info('Cognitive Debugger initialized', { config: this.config });
  }

  // ==========================================================================
  // SESSION MANAGEMENT
  // ==========================================================================

  /**
   * Start a new cognitive debugging session
   */
  startSession(workspaceId: string, userId: string): CognitiveDebugSession {
    const session: CognitiveDebugSession = {
      id: `cognitive_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      workspaceId,
      userId,
      startTime: Date.now(),
      lastActivity: Date.now(),
      codeContext: new Map(),
      predictedIssues: [],
      executionPaths: [],
      patterns: [],
      intentFailureMaps: new Map(),
      learnedPatterns: [],
      userPreferences: {
        verbosity: 'normal',
        autoFix: false,
        focusAreas: [],
        ignoredRules: [],
      },
    };

    this.sessions.set(session.id, session);
    this.emitEvent({ type: 'session_started', session });

    log.info('Cognitive debug session started', { sessionId: session.id, workspaceId });
    return session;
  }

  /**
   * End a cognitive debugging session
   */
  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.emitEvent({ type: 'session_ended', session });
      this.sessions.delete(sessionId);
      log.info('Cognitive debug session ended', { sessionId });
    }
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): CognitiveDebugSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get the universal debugger for multi-language debug support
   */
  getUniversalDebugger(): UniversalDebugger {
    return this.universalDebugger;
  }

  // ==========================================================================
  // CORE ANALYSIS
  // ==========================================================================

  /**
   * FULL COGNITIVE ANALYSIS
   *
   * This is the main entry point that orchestrates all analyses.
   * Think of it as a senior engineer doing a comprehensive code review.
   */
  async analyzeCode(
    sessionId: string,
    code: string,
    language: DebugLanguage,
    options: {
      file?: string;
      userIntent?: string;
      relatedFiles?: Map<string, string>;
      focusAreas?: ('security' | 'performance' | 'logic' | 'reliability')[];
    } = {}
  ): Promise<{
    predictions: PredictedIssue[];
    patterns: PatternMatch[];
    multiDimensional?: MultiDimensionalReport;
    reasoning?: CognitiveAnalysis;
    recommendations: Recommendation[];
    fixes: CodeFix[];
  }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.lastActivity = Date.now();

    log.info('Starting cognitive analysis', {
      sessionId,
      language,
      file: options.file,
      codeLength: code.length,
    });

    // Store code context
    const contextKey = options.file || 'main';
    const context: CodeContext = {
      code,
      language,
      file: options.file,
      startLine: 1,
    };
    session.codeContext.set(contextKey, context);

    // Run analyses in parallel for speed
    const [predictions, patterns, executionPaths] = await Promise.all([
      // Predictive analysis
      this.config.enablePrediction
        ? this.predictiveAnalyzer.analyze(code, language, {
            depth: this.config.depth,
            relatedFiles: options.relatedFiles,
          })
        : Promise.resolve({
            issues: [],
            hotspots: [],
            safetyScore: 100,
            analysisDepth: 'surface' as const,
            executionPaths: [],
            dataFlows: [],
          }),

      // Pattern recognition
      this.config.enablePatternRecognition
        ? this.patternRecognizer.findPatterns(code, language)
        : Promise.resolve([]),

      // Execution tracing
      this.executionTracer.traceExecutionPaths(code, language),
    ]);

    // Store results in session
    session.predictedIssues.push(...predictions.issues);
    session.patterns.push(...patterns);
    session.executionPaths.push(...executionPaths);

    // Emit events for real-time updates
    for (const issue of predictions.issues) {
      this.emitEvent({ type: 'issue_predicted', issue });
    }
    for (const pattern of patterns) {
      this.emitEvent({ type: 'pattern_detected', match: pattern });
    }

    // Multi-dimensional analysis (more expensive, so optional)
    let multiDimensional: MultiDimensionalReport | undefined;
    if (this.config.enableMultiDimensional) {
      multiDimensional = await this.multiDimensionalAnalyzer.analyze(code, language, {
        focusAreas: options.focusAreas || ['security', 'performance', 'logic', 'reliability'],
        relatedFiles: options.relatedFiles,
      });
      session.multiDimensionalReport = multiDimensional;
      this.emitEvent({ type: 'analysis_complete', report: multiDimensional });
    }

    // Cognitive reasoning (uses Claude Opus for deep thinking)
    let reasoning: CognitiveAnalysis | undefined;
    if (this.config.enableReasoning) {
      reasoning = await this.reasoningEngine.analyze({
        code,
        language,
        predictions: predictions.issues,
        patterns,
        multiDimensional,
        userIntent: options.userIntent,
      });
      session.cognitiveAnalysis = reasoning;
      this.emitEvent({ type: 'reasoning_update', analysis: reasoning });
    }

    // Generate prioritized recommendations
    const recommendations = this.synthesizeRecommendations(
      predictions.issues,
      patterns,
      multiDimensional,
      reasoning
    );

    // Generate fixes for high-confidence issues
    const fixes = await this.generateFixes(
      predictions.issues.filter((i) => i.confidence === 'certain' || i.confidence === 'high'),
      patterns.filter((p) => p.confidence === 'certain' || p.confidence === 'high'),
      code,
      language
    );

    log.info('Cognitive analysis complete', {
      sessionId,
      predictions: predictions.issues.length,
      patterns: patterns.length,
      recommendations: recommendations.length,
      fixes: fixes.length,
    });

    return {
      predictions: predictions.issues,
      patterns,
      multiDimensional,
      reasoning,
      recommendations,
      fixes,
    };
  }

  /**
   * INTENT-AWARE ANALYSIS
   *
   * Analyze code with understanding of what the user is trying to achieve.
   * Maps user intent to potential failure points.
   */
  async analyzeWithIntent(
    sessionId: string,
    code: string,
    language: DebugLanguage,
    userIntent: UserIntent
  ): Promise<IntentFailureMap> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.lastActivity = Date.now();

    log.info('Starting intent-aware analysis', {
      sessionId,
      intentId: userIntent.id,
      goals: userIntent.goals.length,
    });

    // First, run predictive analysis
    const predictions = await this.predictiveAnalyzer.analyze(code, language, {
      depth: this.config.depth,
    });

    // Map intent to potential failures
    const intentFailureMap = await this.intentMapper.mapIntentToFailures(
      userIntent,
      code,
      language,
      {
        predictions: predictions.issues,
        executionPaths: predictions.executionPaths,
      }
    );

    // Store in session
    session.intentFailureMaps.set(userIntent.id, intentFailureMap);

    return intentFailureMap;
  }

  /**
   * QUICK PREDICTION
   *
   * Fast prediction of potential issues without full analysis.
   * Use this for real-time feedback as the user types.
   */
  async quickPredict(
    code: string,
    language: DebugLanguage,
    cursorPosition?: { line: number; column: number }
  ): Promise<PredictedIssue[]> {
    return this.predictiveAnalyzer
      .analyze(code, language, {
        depth: 'surface',
        focusArea: cursorPosition ? { line: cursorPosition.line, radius: 10 } : undefined,
      })
      .then((result) => result.issues);
  }

  /**
   * EXPLAIN CODE BEHAVIOR
   *
   * Use cognitive reasoning to explain what code does and why.
   */
  async explainCode(
    code: string,
    language: DebugLanguage,
    question?: string
  ): Promise<{
    explanation: string;
    executionFlow: string;
    dataTransformations: string;
    potentialIssues: string[];
    suggestions: string[];
  }> {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `As a senior software engineer, explain this ${language} code:

\`\`\`${language}
${code}
\`\`\`

${question ? `Specific question: ${question}` : ''}

Provide:
1. **Explanation**: What this code does (clear, concise)
2. **Execution Flow**: Step-by-step how it executes
3. **Data Transformations**: How data flows and changes
4. **Potential Issues**: What could go wrong
5. **Suggestions**: How to improve it

Be thorough but practical. Focus on what matters.`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse sections from response
    const sections = this.parseSections(text, [
      'Explanation',
      'Execution Flow',
      'Data Transformations',
      'Potential Issues',
      'Suggestions',
    ]);

    return {
      explanation: sections['Explanation'] || text,
      executionFlow: sections['Execution Flow'] || '',
      dataTransformations: sections['Data Transformations'] || '',
      potentialIssues: this.parseList(sections['Potential Issues'] || ''),
      suggestions: this.parseList(sections['Suggestions'] || ''),
    };
  }

  // ==========================================================================
  // FIX GENERATION
  // ==========================================================================

  /**
   * Generate fixes for identified issues
   */
  private async generateFixes(
    issues: PredictedIssue[],
    patterns: PatternMatch[],
    code: string,
    language: DebugLanguage
  ): Promise<CodeFix[]> {
    const fixes: CodeFix[] = [];

    // Collect fixes from patterns (they often have pre-defined fixes)
    for (const pattern of patterns) {
      if (pattern.suggestedFix) {
        fixes.push(pattern.suggestedFix);
        this.emitEvent({ type: 'fix_suggested', fix: pattern.suggestedFix });
      }
    }

    // Generate fixes for issues that don't have pattern-based fixes
    const issuesNeedingFixes = issues.filter(
      (issue) =>
        !issue.suggestedFix && (issue.confidence === 'certain' || issue.confidence === 'high')
    );

    if (issuesNeedingFixes.length > 0) {
      const generatedFixes = await this.generateFixesWithAI(issuesNeedingFixes, code, language);
      fixes.push(...generatedFixes);
    }

    return fixes;
  }

  /**
   * Use AI to generate fixes for issues
   */
  private async generateFixesWithAI(
    issues: PredictedIssue[],
    code: string,
    language: DebugLanguage
  ): Promise<CodeFix[]> {
    if (issues.length === 0) return [];

    const issueDescriptions = issues
      .slice(0, 5) // Limit to 5 issues
      .map(
        (issue, i) => `${i + 1}. [${issue.type}] Line ${issue.location.line}: ${issue.description}`
      )
      .join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `Generate precise fixes for these ${language} code issues:

CODE:
\`\`\`${language}
${code}
\`\`\`

ISSUES:
${issueDescriptions}

For each issue, provide a JSON fix object:
{
  "issueIndex": number,
  "type": "replace" | "insert" | "delete",
  "line": number,
  "oldCode": "exact code to replace (if replace)",
  "newCode": "new code",
  "explanation": "why this fixes the issue",
  "confidence": "certain" | "high" | "medium",
  "requiresReview": boolean
}

Rules:
1. oldCode must be EXACT match from the source
2. Minimal changes - fix the issue, don't refactor
3. Only generate fixes you're confident about
4. Set requiresReview=true if the fix might have side effects

Return a JSON array of fixes.`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) return [];

      return parsed.map(
        (fix: {
          issueIndex?: number;
          type?: string;
          line?: number;
          oldCode?: string;
          newCode?: string;
          explanation?: string;
          confidence?: string;
          requiresReview?: boolean;
        }) => ({
          type: (fix.type as 'replace' | 'insert' | 'delete') || 'replace',
          location: {
            file: issues[fix.issueIndex || 0]?.location.file || 'unknown',
            line: fix.line || issues[fix.issueIndex || 0]?.location.line || 1,
          },
          oldCode: fix.oldCode,
          newCode: fix.newCode || '',
          explanation: fix.explanation || '',
          confidence: (fix.confidence || 'medium') as
            | 'certain'
            | 'high'
            | 'medium'
            | 'low'
            | 'speculative',
          requiresReview: fix.requiresReview ?? true,
        })
      );
    } catch {
      log.warn('Failed to parse AI-generated fixes');
      return [];
    }
  }

  /**
   * Apply a fix to code
   */
  async applyFix(
    _sessionId: string,
    fix: CodeFix,
    code: string
  ): Promise<{ success: boolean; newCode: string; error?: string }> {
    try {
      let newCode = code;

      if (fix.type === 'replace' && fix.oldCode) {
        if (!code.includes(fix.oldCode)) {
          return {
            success: false,
            newCode: code,
            error: 'Could not find the code to replace',
          };
        }
        newCode = code.replace(fix.oldCode, fix.newCode);
      } else if (fix.type === 'insert') {
        const lines = code.split('\n');
        lines.splice(fix.location.line - 1, 0, fix.newCode);
        newCode = lines.join('\n');
      } else if (fix.type === 'delete' && fix.oldCode) {
        newCode = code.replace(fix.oldCode, '');
      }

      this.emitEvent({ type: 'fix_applied', fix, result: 'success' });

      return { success: true, newCode };
    } catch (error) {
      this.emitEvent({ type: 'fix_applied', fix, result: 'failed' });
      return {
        success: false,
        newCode: code,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ==========================================================================
  // RECOMMENDATION SYNTHESIS
  // ==========================================================================

  /**
   * Synthesize recommendations from all analyses
   */
  private synthesizeRecommendations(
    predictions: PredictedIssue[],
    patterns: PatternMatch[],
    multiDimensional?: MultiDimensionalReport,
    reasoning?: CognitiveAnalysis
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    let priorityCounter = 1;

    // High-priority predictions
    for (const issue of predictions.filter(
      (p) => p.severity === 'critical' || p.severity === 'high'
    )) {
      recommendations.push({
        id: `pred_${issue.id}`,
        title: `Fix: ${issue.type}`,
        description: issue.description,
        rationale: `Predicted issue with ${issue.probability * 100}% probability`,
        priority: issue.severity === 'critical' ? 'critical' : 'high',
        type: 'fix',
        action: issue.suggestedFix || issue.preventionStrategy,
      });
      priorityCounter++;
    }

    // Pattern-based recommendations
    for (const pattern of patterns) {
      recommendations.push({
        id: `pattern_${pattern.pattern.id}`,
        title: `Pattern: ${pattern.pattern.name}`,
        description: pattern.pattern.description,
        rationale: `Known bug pattern with ${pattern.confidence} confidence`,
        priority:
          pattern.pattern.severity === 'critical'
            ? 'critical'
            : pattern.pattern.severity === 'high'
              ? 'high'
              : 'medium',
        type: 'fix',
        action: pattern.suggestedFix || pattern.pattern.description,
      });
    }

    // Multi-dimensional recommendations
    if (multiDimensional?.prioritizedActions) {
      for (const action of multiDimensional.prioritizedActions.slice(0, 10)) {
        recommendations.push({
          id: `multi_${priorityCounter++}`,
          title: action.description,
          description: `Category: ${action.category}`,
          rationale: `Impact: ${action.impact}, Effort: ${action.effort}`,
          priority: action.impact === 'critical' ? 'critical' : action.impact,
          type: this.inferActionType(action.category),
          action: action.fix || action.description,
        });
      }
    }

    // Cognitive reasoning recommendations
    if (reasoning?.recommendations) {
      for (const rec of reasoning.recommendations) {
        if (!recommendations.find((r) => r.id === rec.id)) {
          recommendations.push(rec);
        }
      }
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  private inferActionType(category: string): Recommendation['type'] {
    if (category.includes('security')) return 'fix';
    if (category.includes('performance')) return 'improvement';
    if (category.includes('architecture')) return 'refactor';
    if (category.includes('test')) return 'test';
    if (category.includes('doc')) return 'documentation';
    return 'improvement';
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  private parseSections(text: string, sectionNames: string[]): Record<string, string> {
    const sections: Record<string, string> = {};

    for (let i = 0; i < sectionNames.length; i++) {
      const name = sectionNames[i];
      const pattern = new RegExp(
        `\\*\\*${name}\\*\\*:?\\s*([\\s\\S]*?)(?=\\*\\*${sectionNames[i + 1] || '$'}|$)`,
        'i'
      );
      const match = text.match(pattern);
      if (match) {
        sections[name] = match[1].trim();
      }
    }

    return sections;
  }

  private parseList(text: string): string[] {
    if (!text) return [];
    return text
      .split(/\n/)
      .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
      .filter((line) => line.length > 0);
  }

  private emitEvent(event: CognitiveDebugEvent): void {
    this.emit(event.type, event);
    this.emit('event', event);
  }

  // ==========================================================================
  // VISUALIZATION HELPERS
  // ==========================================================================

  /**
   * Generate a visual representation of code flow
   */
  async visualizeCodeFlow(
    _sessionId: string,
    code: string,
    language: DebugLanguage
  ): Promise<{
    mermaid: string;
    ascii: string;
    hotspots: { line: number; severity: Severity; reason: string }[];
  }> {
    return this.flowVisualizer.visualize(code, language);
  }

  /**
   * Generate execution path diagram
   */
  async visualizeExecutionPaths(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) return '';

    return this.flowVisualizer.generatePathDiagram(session.executionPaths);
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: CognitiveDebugger | null = null;

export function getCognitiveDebugger(config?: Partial<CognitiveDebuggerConfig>): CognitiveDebugger {
  if (!instance) {
    instance = new CognitiveDebugger(config);
  }
  return instance;
}
