/**
 * STEERING ENGINE - Real-time Execution Control
 *
 * Parses natural language steering commands from the user during execution
 * and translates them into concrete actions: kill scouts, redirect focus,
 * spawn new agents, pause/resume.
 *
 * Integrates with the ExecutionQueue for task cancellation and
 * StrategyAgent for dynamic agent spawning.
 */

import type {
  SteeringCommand,
  SteeringAction,
  AgentBlueprint,
  StrategyStreamCallback,
} from './types';
import { logger } from '@/lib/logger';

const log = logger('SteeringEngine');

// =============================================================================
// COMMAND PATTERNS - Natural Language Parsing
// =============================================================================

interface CommandPattern {
  action: SteeringAction;
  patterns: RegExp[];
  extractTarget: (match: RegExpMatchArray, input: string) => string | undefined;
}

const COMMAND_PATTERNS: CommandPattern[] = [
  {
    action: 'kill_domain',
    patterns: [
      /(?:stop|kill|cancel|drop|ignore|skip)\s+(?:all\s+)?(?:research(?:ing)?|scout(?:s|ing)?|agent(?:s)?)\s+(?:on|for|in|about|related to)\s+(.+)/i,
      /(?:don'?t|do not|no more)\s+(?:research|look at|investigate)\s+(.+)/i,
      /(?:forget|abandon|drop)\s+(.+?)(?:\s+research|\s+agents?)?$/i,
    ],
    extractTarget: (match) => match[1]?.trim(),
  },
  {
    action: 'focus_domain',
    patterns: [
      /(?:focus|double down|concentrate|prioritize|more)\s+(?:on|research on|agents? (?:on|for))\s+(.+)/i,
      /(?:spend more|allocate more|put more)\s+(?:time|budget|resources|effort)\s+(?:on|into|towards?)\s+(.+)/i,
      /(?:I care most about|most important is|priority is)\s+(.+)/i,
    ],
    extractTarget: (match) => match[1]?.trim(),
  },
  {
    action: 'redirect',
    patterns: [
      /(?:instead|rather|switch)\s+(?:of|to)\s+(?:research(?:ing)?)\s+(.+)/i,
      /(?:change|pivot|redirect)\s+(?:focus|direction|research)\s+(?:to|towards?)\s+(.+)/i,
      /(?:actually|wait|hold on),?\s+(?:look at|research|investigate|focus on)\s+(.+)/i,
    ],
    extractTarget: (match) => match[1]?.trim(),
  },
  {
    action: 'spawn_scouts',
    patterns: [
      /(?:also|additionally|add)\s+(?:research|investigate|look (?:at|into))\s+(.+)/i,
      /(?:can you also|I also need|please also)\s+(?:research|check|find|look into)\s+(.+)/i,
    ],
    extractTarget: (match) => match[1]?.trim(),
  },
  {
    action: 'pause',
    patterns: [/(?:pause|hold|wait|stop)\s*(?:everything|all|execution)?/i],
    extractTarget: () => undefined,
  },
  {
    action: 'resume',
    patterns: [/(?:resume|continue|go|proceed|keep going|unpause)/i],
    extractTarget: () => undefined,
  },
];

// =============================================================================
// STEERING ENGINE CLASS
// =============================================================================

export class SteeringEngine {
  private onStream?: StrategyStreamCallback;
  private activeDomains: Set<string> = new Set();
  private killedDomains: Set<string> = new Set();
  private isPaused = false;
  private commandHistory: SteeringCommand[] = [];

  constructor(onStream?: StrategyStreamCallback) {
    this.onStream = onStream;
  }

  /**
   * Register active research domains (called when architect designs agents).
   */
  setActiveDomains(domains: string[]): void {
    this.activeDomains = new Set(domains.map((d) => d.toLowerCase()));
  }

  /**
   * Parse a user message into a steering command.
   * Returns null if the message isn't a steering command.
   */
  parseCommand(message: string): SteeringCommand | null {
    const trimmed = message.trim();
    if (!trimmed) return null;

    for (const pattern of COMMAND_PATTERNS) {
      for (const regex of pattern.patterns) {
        const match = trimmed.match(regex);
        if (match) {
          const target = pattern.extractTarget(match, trimmed);
          const command: SteeringCommand = {
            action: pattern.action,
            target,
            message: trimmed,
            parameters: this.extractParameters(pattern.action, target, trimmed),
            timestamp: Date.now(),
          };

          this.commandHistory.push(command);
          log.info('Parsed steering command', {
            action: command.action,
            target: command.target,
          });

          return command;
        }
      }
    }

    return null;
  }

  /**
   * Check if a scout should be killed based on steering commands.
   * Called by the execution loop before running each scout.
   */
  shouldKillScout(blueprint: AgentBlueprint): boolean {
    if (this.isPaused) return false; // Don't kill, just skip

    // Check if the scout's domain has been killed
    const scoutDomains = [...blueprint.expertise, blueprint.role, blueprint.name, blueprint.purpose]
      .join(' ')
      .toLowerCase();

    for (const killed of this.killedDomains) {
      if (scoutDomains.includes(killed)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if execution should be paused.
   */
  isExecutionPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Apply a steering command. Returns the resulting action description.
   */
  applyCommand(command: SteeringCommand): string {
    switch (command.action) {
      case 'kill_domain': {
        const target = (command.target || '').toLowerCase();
        this.killedDomains.add(target);
        this.emitEvent(`Steering: Killing all scouts related to "${command.target}"`);
        return `Stopped all research on "${command.target}". Active scouts in this domain will be skipped.`;
      }

      case 'focus_domain': {
        // Kill everything NOT in the focused domain
        const focusTarget = (command.target || '').toLowerCase();
        for (const domain of this.activeDomains) {
          if (!domain.includes(focusTarget) && !focusTarget.includes(domain)) {
            this.killedDomains.add(domain);
          }
        }
        this.emitEvent(`Steering: Focusing all resources on "${command.target}"`);
        return `Redirecting all resources to "${command.target}". Other domains will be deprioritized.`;
      }

      case 'redirect': {
        this.emitEvent(`Steering: Redirecting research to "${command.target}"`);
        return `Redirecting research focus to "${command.target}". New scouts will target this area.`;
      }

      case 'spawn_scouts': {
        this.emitEvent(`Steering: Spawning additional scouts for "${command.target}"`);
        return `Adding research on "${command.target}". New investigators will be deployed.`;
      }

      case 'pause': {
        this.isPaused = true;
        this.emitEvent('Steering: Execution paused by user');
        return 'Execution paused. Send "resume" or "continue" to restart.';
      }

      case 'resume': {
        this.isPaused = false;
        this.emitEvent('Steering: Execution resumed by user');
        return 'Execution resumed. Scouts are back to work.';
      }

      default:
        return `Noted: "${command.message}"`;
    }
  }

  /**
   * Generate additional scout blueprints for redirect/spawn commands.
   * Returns blueprints for new scouts to add to the execution queue.
   */
  generateRedirectBlueprints(
    command: SteeringCommand,
    existingBlueprints: AgentBlueprint[]
  ): AgentBlueprint[] {
    if (
      command.action !== 'redirect' &&
      command.action !== 'spawn_scouts' &&
      command.action !== 'focus_domain'
    ) {
      return [];
    }

    const target = command.target || '';
    const nextId = existingBlueprints.length + 1;

    // Create 3-5 new scouts for the redirect target
    const newBlueprints: AgentBlueprint[] = [
      {
        id: `scout_steer_${nextId}_broad`,
        name: `${target} Broad Scan`,
        role: `Research specialist for ${target}`,
        expertise: [target],
        purpose: `Conduct broad research on ${target} as requested by user`,
        keyQuestions: [
          `What are the key facts about ${target}?`,
          `What are the latest developments?`,
        ],
        researchApproach: 'broad_scan',
        dataSources: ['Web search', 'News', 'Industry publications'],
        searchQueries: [
          `${target} overview latest`,
          `${target} key facts data`,
          `${target} analysis report`,
        ],
        deliverable: `Broad research findings on ${target}`,
        outputFormat: 'summary',
        modelTier: 'haiku',
        priority: 9, // High priority for user-requested research
        estimatedSearches: 5,
        depth: 1,
        canSpawnChildren: true,
        maxChildren: 2,
        tools: ['brave_search', 'browser_visit'],
      },
      {
        id: `scout_steer_${nextId}_deep`,
        name: `${target} Deep Dive`,
        role: `Deep research analyst for ${target}`,
        expertise: [target],
        purpose: `Deep investigation of ${target} with data extraction`,
        keyQuestions: [`What specific data is available?`, `What do experts say?`],
        researchApproach: 'deep_dive',
        dataSources: ['Specialized sources', 'Expert analysis'],
        searchQueries: [
          `${target} detailed analysis`,
          `${target} expert opinion research`,
          `${target} statistics data`,
        ],
        deliverable: `Detailed findings on ${target}`,
        outputFormat: 'bullet_points',
        modelTier: 'haiku',
        priority: 8,
        estimatedSearches: 5,
        depth: 1,
        canSpawnChildren: false,
        maxChildren: 0,
        tools: ['brave_search', 'browser_visit', 'screenshot', 'run_code'],
      },
      {
        id: `scout_steer_${nextId}_compare`,
        name: `${target} Comparative Analysis`,
        role: `Comparative analyst for ${target}`,
        expertise: [target, 'comparison'],
        purpose: `Compare options and perspectives on ${target}`,
        keyQuestions: [`What are the different perspectives?`, `How do options compare?`],
        researchApproach: 'comparative',
        dataSources: ['Multiple viewpoints', 'Review sites'],
        searchQueries: [`${target} comparison review`, `${target} pros cons analysis`],
        deliverable: `Comparison analysis of ${target}`,
        outputFormat: 'comparison_matrix',
        modelTier: 'haiku',
        priority: 7,
        estimatedSearches: 4,
        depth: 1,
        canSpawnChildren: false,
        maxChildren: 0,
        tools: ['brave_search', 'browser_visit', 'screenshot'],
      },
    ];

    return newBlueprints;
  }

  /**
   * Get the command history for this session.
   */
  getHistory(): SteeringCommand[] {
    return [...this.commandHistory];
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private extractParameters(
    action: SteeringAction,
    target: string | undefined,
    _message: string
  ): SteeringCommand['parameters'] {
    return {
      domain: target,
      focus: action === 'focus_domain' ? target : undefined,
    };
  }

  private emitEvent(message: string): void {
    if (this.onStream) {
      this.onStream({
        type: 'user_context_added',
        message,
        timestamp: Date.now(),
      });
    }
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createSteeringEngine(onStream?: StrategyStreamCallback): SteeringEngine {
  return new SteeringEngine(onStream);
}
