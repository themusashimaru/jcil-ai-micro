/**
 * MASTER ARCHITECT - Self-Designing Agent Creator
 *
 * Uses Opus 4.6 to design a perfect team of specialized agents
 * based on the user's synthesized problem.
 *
 * This is where the magic happens - the AI designs AI agents in real-time.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  SynthesizedProblem,
  AgentBlueprint,
  AgentHierarchy,
  MasterArchitectState,
  ProjectManagerState,
  QualityControlState,
  StrategyStreamCallback,
  StrategyLimits,
  ModelTier,
  ResearchApproach,
  OutputFormat,
  ScoutToolType,
} from './types';
import { CLAUDE_OPUS_46, MASTER_ARCHITECT_PROMPT, DEFAULT_LIMITS } from './constants';
import { extractJSON } from './utils';
import { logger } from '@/lib/logger';

const log = logger('MasterArchitect');

// =============================================================================
// ARCHITECT OUTPUT TYPES
// =============================================================================

interface ArchitectDesign {
  projectManagers: ProjectManagerBlueprint[];
  scouts: AgentBlueprint[];
  estimatedTotalSearches: number;
  estimatedCost: number;
  rationale: string;
}

interface ProjectManagerBlueprint {
  id: string;
  name: string;
  domain: string;
  purpose: string;
  focusAreas: string[];
  expectedScouts: number;
  priority: number;
}

// =============================================================================
// MASTER ARCHITECT CLASS
// =============================================================================

export class MasterArchitect {
  private client: Anthropic;
  private onStream?: StrategyStreamCallback;
  private model = CLAUDE_OPUS_46;
  private limits: StrategyLimits;
  private state: MasterArchitectState;
  private systemPrompt: string;
  // Cache the last design to avoid duplicate API calls
  private lastDesign: ArchitectDesign | null = null;
  private lastDesignProblemHash: string | null = null;

  constructor(
    client: Anthropic,
    limits: StrategyLimits = DEFAULT_LIMITS,
    onStream?: StrategyStreamCallback,
    systemPrompt?: string
  ) {
    this.client = client;
    this.limits = limits;
    this.onStream = onStream;
    this.systemPrompt = systemPrompt || MASTER_ARCHITECT_PROMPT;
    this.state = {
      status: 'pending',
      blueprintsCreated: 0,
      lastAction: 'Initialized',
    };
  }

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

  /**
   * Update the stream callback (needed when switching from intake to execute stream)
   */
  setStreamCallback(callback: StrategyStreamCallback | undefined): void {
    this.onStream = callback;
  }

  /**
   * Inject additional context (prior knowledge, performance data) into the
   * architect's system prompt before designing agents.
   */
  injectAdditionalContext(context: string): void {
    if (context) {
      this.systemPrompt += context;
    }
  }

  /**
   * Design the agent army based on the synthesized problem
   */
  async designAgents(problem: SynthesizedProblem): Promise<AgentHierarchy> {
    this.state.status = 'initializing';
    this.state.lastAction = 'Analyzing problem';
    this.emitEvent('architect_designing', 'Master Architect analyzing problem...');

    try {
      // Generate the agent design using Opus
      const design = await this.generateDesign(problem);

      // Cache the design for getScoutBlueprints() to reuse
      this.lastDesign = design;
      this.lastDesignProblemHash = this.hashProblem(problem);

      this.state.lastAction = 'Creating blueprints';
      this.emitEvent('architect_designing', `Creating ${design.scouts.length} agent blueprints...`);

      // Validate and adjust design to fit within limits
      const adjustedDesign = this.adjustDesignToLimits(design);

      // Build the hierarchy
      const hierarchy = this.buildHierarchy(adjustedDesign, problem);

      this.state.status = 'complete';
      this.state.blueprintsCreated = adjustedDesign.scouts.length;
      this.state.lastAction = `Designed ${adjustedDesign.scouts.length} agents`;

      log.info('Agent design complete', {
        projectManagers: adjustedDesign.projectManagers.length,
        scouts: adjustedDesign.scouts.length,
        estimatedSearches: adjustedDesign.estimatedTotalSearches,
        estimatedCost: adjustedDesign.estimatedCost,
      });

      return hierarchy;
    } catch (error) {
      this.state.status = 'failed';
      this.state.lastAction = 'Design failed';
      log.error('Failed to design agents', error as Error);
      throw error;
    }
  }

  /**
   * Hash a problem for cache comparison
   */
  private hashProblem(problem: SynthesizedProblem): string {
    return JSON.stringify({
      summary: problem.summary,
      coreQuestion: problem.coreQuestion,
      domains: problem.domains,
    });
  }

  /**
   * Get current state
   */
  getState(): MasterArchitectState {
    return { ...this.state };
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Generate agent design using Opus 4.6
   */
  private async generateDesign(problem: SynthesizedProblem): Promise<ArchitectDesign> {
    const prompt = this.systemPrompt.replace(
      '{SYNTHESIZED_PROBLEM}',
      JSON.stringify(problem, null, 2)
    );

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 8192,
      temperature: 0.7,
      system: prompt,
      messages: [
        {
          role: 'user',
          content: `Design the agent team for this problem. Be specific and comprehensive. Output valid JSON.`,
        },
      ],
    });

    const textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    // Extract JSON from response - pass problem for context-aware fallback
    const design = this.parseDesignResponse(textContent, problem);

    return design;
  }

  /**
   * Parse the design response JSON
   * Uses robust JSON extraction with repair for malformed LLM outputs
   */
  private parseDesignResponse(response: string, problem: SynthesizedProblem): ArchitectDesign {
    // Use robust JSON extraction with repair capabilities
    const parsed = extractJSON<{
      projectManagers?: unknown[];
      scouts?: unknown[];
      estimatedTotalSearches?: number;
      estimatedCost?: number;
      rationale?: string;
    }>(response);

    if (parsed) {
      log.info('Successfully parsed architect design', {
        projectManagers: (parsed.projectManagers || []).length,
        scouts: (parsed.scouts || []).length,
      });

      // Validate and normalize
      return {
        projectManagers: this.normalizeProjectManagers(parsed.projectManagers || []),
        scouts: this.normalizeScouts(parsed.scouts || []),
        estimatedTotalSearches: Number(parsed.estimatedTotalSearches) || 100,
        estimatedCost: Number(parsed.estimatedCost) || 5.0,
        rationale: String(parsed.rationale || ''),
      };
    }

    log.error('Failed to parse design JSON even with repair', {
      responsePreview: response.slice(0, 500),
    });

    // Return a context-aware fallback design based on the problem
    return this.createFallbackDesign(problem);
  }

  /**
   * Normalize project manager blueprints
   */
  private normalizeProjectManagers(raw: unknown[]): ProjectManagerBlueprint[] {
    return raw.map((item, index) => {
      const pm = item as Record<string, unknown>;
      return {
        id: String(pm.id || `pm_${index}`),
        name: String(pm.name || `Project Manager ${index + 1}`),
        domain: String(pm.domain || 'General'),
        purpose: String(pm.purpose || ''),
        focusAreas: Array.isArray(pm.focusAreas) ? pm.focusAreas.map(String) : [],
        expectedScouts: Number(pm.expectedScouts) || 10,
        priority: Number(pm.priority) || 5,
      };
    });
  }

  /**
   * Normalize scout blueprints
   */
  private normalizeScouts(raw: unknown[]): AgentBlueprint[] {
    return raw.map((item, index) => {
      const scout = item as Record<string, unknown>;
      return {
        id: String(scout.id || `scout_${index}`),
        name: String(scout.name || `Scout ${index + 1}`),
        role: String(scout.role || 'Research specialist'),
        expertise: Array.isArray(scout.expertise) ? scout.expertise.map(String) : [],
        purpose: String(scout.purpose || ''),
        keyQuestions: Array.isArray(scout.keyQuestions) ? scout.keyQuestions.map(String) : [],
        researchApproach: this.normalizeResearchApproach(scout.researchApproach),
        dataSources: Array.isArray(scout.dataSources) ? scout.dataSources.map(String) : [],
        searchQueries: Array.isArray(scout.searchQueries) ? scout.searchQueries.map(String) : [],
        deliverable: String(scout.deliverable || 'Research report'),
        outputFormat: this.normalizeOutputFormat(scout.outputFormat),
        modelTier: this.normalizeModelTier(scout.modelTier),
        priority: Number(scout.priority) || 5,
        estimatedSearches: Number(scout.estimatedSearches) || 3,
        parentId: scout.parentId ? String(scout.parentId) : undefined,
        depth: Number(scout.depth) || 1,
        canSpawnChildren: Boolean(scout.canSpawnChildren),
        maxChildren: Number(scout.maxChildren) || 3,
        // Tool capabilities
        tools: this.normalizeTools(scout.tools),
        browserTargets: Array.isArray(scout.browserTargets)
          ? scout.browserTargets.map(String)
          : undefined,
      };
    });
  }

  /**
   * Normalize scout tools
   */
  private normalizeTools(raw: unknown): ScoutToolType[] | undefined {
    if (!Array.isArray(raw) || raw.length === 0) {
      // Default: all scouts get brave_search
      return ['brave_search'];
    }

    const validTools: ScoutToolType[] = [
      'brave_search',
      'browser_visit',
      'run_code',
      'screenshot',
      'vision_analyze',
      'extract_table',
      'compare_screenshots',
      'safe_form_fill',
      'paginate',
      'infinite_scroll',
      'click_navigate',
      'extract_pdf',
      'generate_comparison',
    ];
    const tools = raw
      .map((t) => String(t).toLowerCase())
      .filter((t): t is ScoutToolType => validTools.includes(t as ScoutToolType));

    return tools.length > 0 ? tools : ['brave_search'];
  }

  /**
   * Normalize research approach
   */
  private normalizeResearchApproach(raw: unknown): ResearchApproach {
    const value = String(raw).toLowerCase();
    const valid: ResearchApproach[] = [
      'broad_scan',
      'deep_dive',
      'comparative',
      'risk_analysis',
      'opportunity_scan',
      'validation',
      'synthesis',
    ];
    return valid.includes(value as ResearchApproach) ? (value as ResearchApproach) : 'deep_dive';
  }

  /**
   * Normalize output format
   */
  private normalizeOutputFormat(raw: unknown): OutputFormat {
    const value = String(raw).toLowerCase();
    const valid: OutputFormat[] = [
      'summary',
      'bullet_points',
      'comparison_matrix',
      'comparison_table',
      'swot_analysis',
      'risk_assessment',
      'recommendation',
      'action_plan',
      'data_table',
    ];
    return valid.includes(value as OutputFormat) ? (value as OutputFormat) : 'summary';
  }

  /**
   * Normalize model tier
   */
  private normalizeModelTier(raw: unknown): ModelTier {
    const value = String(raw).toLowerCase();
    if (value === 'opus' || value === 'sonnet' || value === 'haiku') {
      return value;
    }
    return 'haiku'; // Default scouts to Haiku for cost efficiency
  }

  /**
   * Adjust design to fit within limits
   */
  private adjustDesignToLimits(design: ArchitectDesign): ArchitectDesign {
    let scouts = [...design.scouts];
    let totalSearches = design.estimatedTotalSearches;

    // Cap scouts at max limit
    if (scouts.length > this.limits.maxScouts) {
      log.warn('Capping scouts', { original: scouts.length, max: this.limits.maxScouts });
      // Keep highest priority scouts
      scouts = scouts.sort((a, b) => b.priority - a.priority).slice(0, this.limits.maxScouts);
      totalSearches = scouts.reduce((sum, s) => sum + s.estimatedSearches, 0);
    }

    // Cap total searches
    if (totalSearches > this.limits.maxSearches) {
      log.warn('Capping searches', { original: totalSearches, max: this.limits.maxSearches });
      const ratio = this.limits.maxSearches / totalSearches;
      scouts = scouts.map((s) => ({
        ...s,
        estimatedSearches: Math.max(1, Math.floor(s.estimatedSearches * ratio)),
      }));
      totalSearches = scouts.reduce((sum, s) => sum + s.estimatedSearches, 0);
    }

    // Recalculate estimated cost
    const estimatedCost = this.estimateCost(
      design.projectManagers.length,
      scouts.length,
      totalSearches
    );

    return {
      ...design,
      scouts,
      estimatedTotalSearches: totalSearches,
      estimatedCost,
    };
  }

  /**
   * Estimate cost based on design
   */
  private estimateCost(pmCount: number, scoutCount: number, searchCount: number): number {
    // Opus (architect + final synthesis): ~$1.50
    const opusCost = 1.5;

    // Sonnet (PMs): ~$0.05 per PM
    const sonnetCost = pmCount * 0.05;

    // Haiku (scouts): ~$0.02 per scout
    const haikuCost = scoutCount * 0.02;

    // Brave searches: $0.005 per search
    const searchCost = searchCount * 0.005;

    return opusCost + sonnetCost + haikuCost + searchCost;
  }

  /**
   * Create fallback design when parsing fails - now context-aware
   */
  private createFallbackDesign(problem: SynthesizedProblem): ArchitectDesign {
    // Extract key info from the problem to generate relevant scouts
    const domains = problem.domains || ['General'];
    const coreQuestion = problem.coreQuestion || problem.summary || 'the problem';
    const constraints = problem.constraints || [];
    const priorities = problem.priorities || [];

    // Create project managers based on domains (up to 5)
    const projectManagers: ProjectManagerBlueprint[] = domains.slice(0, 5).map((domain, i) => ({
      id: `pm_${domain.toLowerCase().replace(/\s+/g, '_')}`,
      name: `${domain} Research Director`,
      domain: domain,
      purpose: `Coordinate research on ${domain} aspects of ${coreQuestion}`,
      focusAreas: [domain, ...constraints.slice(0, 2)],
      expectedScouts: Math.ceil(20 / domains.length),
      priority: i + 1,
    }));

    // If no domains, create a general PM
    if (projectManagers.length === 0) {
      projectManagers.push({
        id: 'pm_general',
        name: 'General Research Director',
        domain: 'General Research',
        purpose: `Coordinate research on ${coreQuestion}`,
        focusAreas: ['Comprehensive analysis'],
        expectedScouts: 20,
        priority: 1,
      });
    }

    // Create scouts for each domain with relevant search queries
    const scouts: AgentBlueprint[] = [];
    let scoutIndex = 0;

    for (const pm of projectManagers) {
      // Generate 3-5 scouts per domain
      const scoutsPerDomain = Math.ceil(20 / projectManagers.length);

      for (let i = 0; i < scoutsPerDomain && scouts.length < 50; i++) {
        const scoutFocus = this.generateScoutFocus(
          pm.domain,
          coreQuestion,
          constraints,
          priorities,
          i
        );

        scouts.push({
          id: `scout_${scoutIndex}`,
          name: `${pm.domain} Scout ${i + 1}`,
          role: `${pm.domain} research specialist`,
          expertise: [pm.domain],
          purpose: scoutFocus.purpose,
          keyQuestions: scoutFocus.questions,
          researchApproach: 'deep_dive' as ResearchApproach,
          dataSources: ['Web search', 'News', 'Forums'],
          searchQueries: scoutFocus.searchQueries,
          deliverable: `${pm.domain} research findings`,
          outputFormat: 'summary' as OutputFormat,
          modelTier: 'haiku' as ModelTier,
          priority: 5,
          estimatedSearches: scoutFocus.searchQueries.length,
          parentId: pm.id,
          depth: 1,
          canSpawnChildren: true,
          maxChildren: 2,
          // Default tools - brave_search for all, browser_visit for deeper research
          tools: ['brave_search', 'browser_visit'] as ScoutToolType[],
        });
        scoutIndex++;
      }
    }

    log.warn('Using fallback design based on problem context', {
      domains: domains.length,
      scouts: scouts.length,
      coreQuestion: coreQuestion.slice(0, 100),
    });

    return {
      projectManagers,
      scouts,
      estimatedTotalSearches: scouts.reduce((sum, s) => sum + s.estimatedSearches, 0),
      estimatedCost: 3.0,
      rationale: 'Fallback design generated from problem context (Opus JSON parsing failed)',
    };
  }

  /**
   * Generate scout focus and search queries from problem context
   */
  private generateScoutFocus(
    domain: string,
    coreQuestion: string,
    constraints: string[],
    priorities: Array<{ factor: string; importance: number }>,
    index: number
  ): {
    purpose: string;
    questions: string[];
    searchQueries: string[];
  } {
    // Extract key terms from constraints and priorities
    const keyTerms = [
      ...constraints.slice(0, 3),
      ...priorities.slice(0, 3).map((p) => p.factor),
    ].filter(Boolean);

    const year = new Date().getFullYear();

    // Generate specific search queries based on domain and context
    const searchAngles = [
      `${domain} ${coreQuestion.split(' ').slice(0, 5).join(' ')} ${year}`,
      `best ${domain.toLowerCase()} options ${keyTerms[0] || ''} ${year}`,
      `${domain.toLowerCase()} comparison reviews ${year}`,
      `${domain.toLowerCase()} cost analysis ${keyTerms[index % keyTerms.length] || ''}`,
      `${domain.toLowerCase()} pros cons ${coreQuestion.split(' ').slice(0, 3).join(' ')}`,
    ];

    return {
      purpose: `Research ${domain} aspects: ${coreQuestion}`,
      questions: [
        `What are the best ${domain.toLowerCase()} options?`,
        `What are the costs and tradeoffs for ${domain.toLowerCase()}?`,
        `What factors should be considered for ${domain.toLowerCase()}?`,
      ],
      searchQueries: searchAngles.slice(0, 3 + (index % 2)), // 3-4 queries per scout
    };
  }

  /**
   * Build the full agent hierarchy
   */
  private buildHierarchy(design: ArchitectDesign, _problem: SynthesizedProblem): AgentHierarchy {
    // Create project manager states
    const projectManagers: ProjectManagerState[] = design.projectManagers.map((pm) => ({
      id: pm.id,
      name: pm.name,
      domain: pm.domain,
      status: 'pending',
      assignedScouts: design.scouts.filter((s) => s.parentId === pm.id).map((s) => s.id),
      completedScouts: 0,
      findings: [],
    }));

    // Ensure all scouts have a parent
    const scouts = design.scouts.map((scout) => {
      if (!scout.parentId) {
        // Assign to first PM if no parent specified
        scout.parentId = projectManagers[0]?.id;
      }
      return scout;
    });

    // Update PM assigned scouts
    for (const pm of projectManagers) {
      pm.assignedScouts = scouts.filter((s) => s.parentId === pm.id).map((s) => s.id);
    }

    const qualityControl: QualityControlState = {
      status: 'pending',
      issuesFound: [],
      killSwitchTriggered: false,
      overallQualityScore: 1.0,
      lastCheck: Date.now(),
    };

    return {
      masterArchitect: this.state,
      qualityControl,
      projectManagers,
      scouts: [], // Will be populated as scouts are spawned
      totalAgents: scouts.length + projectManagers.length + 2, // +2 for architect and QC
      activeAgents: 0,
      completedAgents: 0,
      failedAgents: 0,
    };
  }

  /**
   * Get the scout blueprints (for execution)
   * Uses cached design if available to avoid duplicate API calls
   */
  getScoutBlueprints(problem: SynthesizedProblem): AgentBlueprint[] {
    // Check if we have a cached design for this problem
    const problemHash = this.hashProblem(problem);

    if (this.lastDesign && this.lastDesignProblemHash === problemHash) {
      log.info('Using cached design for scout blueprints (saved ~$1.50 Opus call)');
      const adjusted = this.adjustDesignToLimits(this.lastDesign);
      return adjusted.scouts;
    }

    // This should not happen if designAgents() was called first
    log.warn('No cached design found - this indicates a call order issue');
    throw new Error('Must call designAgents() before getScoutBlueprints()');
  }

  /**
   * Emit a stream event
   */
  private emitEvent(type: 'architect_designing', message: string): void {
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

export function createMasterArchitect(
  client: Anthropic,
  limits?: StrategyLimits,
  onStream?: StrategyStreamCallback,
  systemPrompt?: string
): MasterArchitect {
  return new MasterArchitect(client, limits, onStream, systemPrompt);
}
