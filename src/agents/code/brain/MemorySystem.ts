/**
 * MEMORY SYSTEM
 *
 * Persistent learning and memory for the Code Agent.
 * Remembers user preferences, past projects, and learned patterns.
 *
 * Features:
 * - User preference learning (coding style, frameworks)
 * - Project history tracking
 * - Pattern recognition across sessions
 * - Context retrieval for relevant past work
 * - Mistake tracking and avoidance
 *
 * This is what makes the agent get better over time.
 */

import { CodeIntent, ProjectPlan, GeneratedFile } from '../../core/types';

// ============================================================================
// TYPES
// ============================================================================

export interface UserProfile {
  userId: string;
  preferences: CodingPreferences;
  history: ProjectHistory[];
  patterns: LearnedPattern[];
  feedback: UserFeedback[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CodingPreferences {
  // Language preferences
  preferredLanguages: string[];
  preferredFrameworks: string[];
  preferredRuntime: 'node' | 'python' | 'both';
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'pip';

  // Style preferences
  codingStyle: {
    quotes: 'single' | 'double';
    semicolons: boolean;
    indentation: 'tabs' | 'spaces';
    indentSize: number;
    trailingComma: boolean;
    maxLineLength: number;
  };

  // Architecture preferences
  architecturePattern: string;
  preferTests: boolean;
  testFramework?: string;
  preferDocs: boolean;

  // Communication preferences
  verboseExplanations: boolean;
  askClarifyingQuestions: boolean;
  showThinkingProcess: boolean;

  // GitHub preferences
  defaultBranch: string;
  commitStyle: 'conventional' | 'simple';
  privateRepos: boolean;
}

export interface ProjectHistory {
  id: string;
  timestamp: Date;
  intent: CodeIntent;
  plan: ProjectPlan;
  files: string[];  // File paths only to save space
  success: boolean;
  feedback?: string;
  metrics: {
    executionTime: number;
    iterations: number;
    errorsFixed: number;
  };
}

export interface LearnedPattern {
  id: string;
  type: 'success' | 'failure' | 'preference';
  pattern: string;
  context: string;
  frequency: number;
  lastUsed: Date;
  effectiveness: number;  // 0-1 based on outcomes
}

export interface UserFeedback {
  projectId: string;
  timestamp: Date;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  specificFeedback?: {
    codeQuality?: number;
    correctness?: number;
    style?: number;
    documentation?: number;
  };
}

export interface ContextMemory {
  recentProjects: ProjectHistory[];
  relevantPatterns: LearnedPattern[];
  userPreferences: CodingPreferences;
  suggestions: string[];
}

// ============================================================================
// DEFAULT PREFERENCES
// ============================================================================

const DEFAULT_PREFERENCES: CodingPreferences = {
  preferredLanguages: ['TypeScript'],
  preferredFrameworks: ['React', 'Next.js'],
  preferredRuntime: 'node',
  packageManager: 'npm',
  codingStyle: {
    quotes: 'single',
    semicolons: true,
    indentation: 'spaces',
    indentSize: 2,
    trailingComma: true,
    maxLineLength: 100,
  },
  architecturePattern: 'modular',
  preferTests: true,
  testFramework: 'vitest',
  preferDocs: true,
  verboseExplanations: true,
  askClarifyingQuestions: true,
  showThinkingProcess: true,
  defaultBranch: 'main',
  commitStyle: 'conventional',
  privateRepos: false,
};

// ============================================================================
// MEMORY SYSTEM
// ============================================================================

export class MemorySystem {
  private profiles: Map<string, UserProfile> = new Map();
  // Global patterns for cross-user learning (future feature)
  // private globalPatterns: LearnedPattern[] = [];

  /**
   * Get or create user profile
   */
  getProfile(userId: string): UserProfile {
    let profile = this.profiles.get(userId);

    if (!profile) {
      profile = {
        userId,
        preferences: { ...DEFAULT_PREFERENCES },
        history: [],
        patterns: [],
        feedback: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.profiles.set(userId, profile);
    }

    return profile;
  }

  /**
   * Update user preferences based on project
   */
  learnFromProject(
    userId: string,
    intent: CodeIntent,
    plan: ProjectPlan,
    files: GeneratedFile[],
    success: boolean
  ): void {
    const profile = this.getProfile(userId);

    // Add to history
    const historyEntry: ProjectHistory = {
      id: `project-${Date.now()}`,
      timestamp: new Date(),
      intent,
      plan,
      files: files.map(f => f.path),
      success,
      metrics: {
        executionTime: 0,
        iterations: 0,
        errorsFixed: 0,
      },
    };
    profile.history.push(historyEntry);

    // Learn preferences from intent
    if (success) {
      this.learnPreferences(profile, intent);
      this.learnPatterns(profile, intent, plan);
    }

    // Keep history limited
    if (profile.history.length > 50) {
      profile.history = profile.history.slice(-50);
    }

    profile.updatedAt = new Date();
    this.profiles.set(userId, profile);
  }

  /**
   * Learn preferences from successful project
   */
  private learnPreferences(profile: UserProfile, intent: CodeIntent): void {
    const prefs = profile.preferences;

    // Update language preferences
    const lang = intent.technologies.primary.split(' ')[0];
    if (!prefs.preferredLanguages.includes(lang)) {
      prefs.preferredLanguages.unshift(lang);
      prefs.preferredLanguages = prefs.preferredLanguages.slice(0, 5);
    }

    // Update framework preferences
    intent.technologies.secondary.forEach(tech => {
      if (!prefs.preferredFrameworks.includes(tech)) {
        prefs.preferredFrameworks.push(tech);
        prefs.preferredFrameworks = prefs.preferredFrameworks.slice(0, 10);
      }
    });

    // Update runtime preference
    prefs.preferredRuntime = intent.technologies.runtime;
    prefs.packageManager = intent.technologies.packageManager;
  }

  /**
   * Learn patterns from successful project
   */
  private learnPatterns(profile: UserProfile, intent: CodeIntent, plan: ProjectPlan): void {
    // Learn architecture pattern
    const archPattern: LearnedPattern = {
      id: `pattern-${Date.now()}`,
      type: 'success',
      pattern: plan.architecture.pattern,
      context: `${intent.projectType} with ${intent.complexity} complexity`,
      frequency: 1,
      lastUsed: new Date(),
      effectiveness: 1,
    };

    const existing = profile.patterns.find(p =>
      p.pattern === archPattern.pattern && p.context === archPattern.context
    );

    if (existing) {
      existing.frequency++;
      existing.lastUsed = new Date();
      existing.effectiveness = Math.min(1, existing.effectiveness + 0.1);
    } else {
      profile.patterns.push(archPattern);
    }

    // Keep patterns limited
    if (profile.patterns.length > 100) {
      // Sort by effectiveness and frequency, keep top 100
      profile.patterns.sort((a, b) =>
        (b.effectiveness * b.frequency) - (a.effectiveness * a.frequency)
      );
      profile.patterns = profile.patterns.slice(0, 100);
    }
  }

  /**
   * Record user feedback
   */
  recordFeedback(userId: string, projectId: string, feedback: Omit<UserFeedback, 'projectId' | 'timestamp'>): void {
    const profile = this.getProfile(userId);

    profile.feedback.push({
      projectId,
      timestamp: new Date(),
      ...feedback,
    });

    // Update pattern effectiveness based on feedback
    const project = profile.history.find(p => p.id === projectId);
    if (project && feedback.rating) {
      const effectiveness = feedback.rating / 5;
      profile.patterns.forEach(p => {
        if (p.lastUsed.getTime() > project.timestamp.getTime() - 60000) {
          p.effectiveness = (p.effectiveness + effectiveness) / 2;
        }
      });
    }

    profile.updatedAt = new Date();
    this.profiles.set(userId, profile);
  }

  /**
   * Get context memory for a new task
   */
  getContextMemory(userId: string, newIntent: CodeIntent): ContextMemory {
    const profile = this.getProfile(userId);

    // Find relevant past projects
    const recentProjects = profile.history
      .filter(p => p.success)
      .filter(p =>
        p.intent.projectType === newIntent.projectType ||
        p.intent.technologies.primary === newIntent.technologies.primary
      )
      .slice(-5);

    // Find relevant patterns
    const relevantPatterns = profile.patterns
      .filter(p =>
        p.context.includes(newIntent.projectType) ||
        p.context.includes(newIntent.complexity)
      )
      .sort((a, b) => b.effectiveness - a.effectiveness)
      .slice(0, 10);

    // Generate suggestions based on history
    const suggestions = this.generateSuggestions(profile, newIntent);

    return {
      recentProjects,
      relevantPatterns,
      userPreferences: profile.preferences,
      suggestions,
    };
  }

  /**
   * Generate suggestions based on user history
   */
  private generateSuggestions(profile: UserProfile, intent: CodeIntent): string[] {
    const suggestions: string[] = [];

    // Suggest based on preferences
    if (profile.preferences.preferTests && intent.complexity !== 'simple') {
      suggestions.push('Based on your history, I\'ll include comprehensive tests.');
    }

    if (profile.preferences.preferDocs) {
      suggestions.push('I\'ll generate documentation as you prefer.');
    }

    // Suggest based on successful patterns
    const relevantPattern = profile.patterns.find(p =>
      p.type === 'success' &&
      p.effectiveness > 0.8 &&
      p.context.includes(intent.projectType)
    );

    if (relevantPattern) {
      suggestions.push(`Using ${relevantPattern.pattern} pattern which worked well for similar projects.`);
    }

    // Suggest based on past mistakes
    const failedPatterns = profile.patterns.filter(p => p.type === 'failure');
    failedPatterns.forEach(p => {
      if (intent.projectType.includes(p.context)) {
        suggestions.push(`Note: Avoiding ${p.pattern} which caused issues before.`);
      }
    });

    return suggestions;
  }

  /**
   * Get user's coding style as ESLint/Prettier config
   */
  getCodingStyleConfig(userId: string): Record<string, unknown> {
    const profile = this.getProfile(userId);
    const style = profile.preferences.codingStyle;

    return {
      semi: style.semicolons,
      singleQuote: style.quotes === 'single',
      tabWidth: style.indentSize,
      useTabs: style.indentation === 'tabs',
      trailingComma: style.trailingComma ? 'all' : 'none',
      printWidth: style.maxLineLength,
    };
  }

  /**
   * Update preferences directly
   */
  updatePreferences(userId: string, updates: Partial<CodingPreferences>): void {
    const profile = this.getProfile(userId);
    profile.preferences = { ...profile.preferences, ...updates };
    profile.updatedAt = new Date();
    this.profiles.set(userId, profile);
  }

  /**
   * Get statistics about a user
   */
  getStats(userId: string): {
    totalProjects: number;
    successRate: number;
    averageRating: number;
    topLanguages: string[];
    topPatterns: string[];
  } {
    const profile = this.getProfile(userId);

    const successfulProjects = profile.history.filter(p => p.success).length;
    const successRate = profile.history.length > 0
      ? successfulProjects / profile.history.length
      : 0;

    const avgRating = profile.feedback.length > 0
      ? profile.feedback.reduce((sum, f) => sum + f.rating, 0) / profile.feedback.length
      : 0;

    // Count language usage
    const langCounts = new Map<string, number>();
    profile.history.forEach(p => {
      const lang = p.intent.technologies.primary.split(' ')[0];
      langCounts.set(lang, (langCounts.get(lang) || 0) + 1);
    });
    const topLanguages = [...langCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([lang]) => lang);

    // Get top patterns
    const topPatterns = profile.patterns
      .filter(p => p.type === 'success')
      .sort((a, b) => b.effectiveness * b.frequency - a.effectiveness * a.frequency)
      .slice(0, 3)
      .map(p => p.pattern);

    return {
      totalProjects: profile.history.length,
      successRate,
      averageRating: avgRating,
      topLanguages,
      topPatterns,
    };
  }

  /**
   * Export profile (for backup/transfer)
   */
  exportProfile(userId: string): string {
    const profile = this.getProfile(userId);
    return JSON.stringify(profile, null, 2);
  }

  /**
   * Import profile (from backup)
   */
  importProfile(data: string): void {
    try {
      const profile = JSON.parse(data) as UserProfile;
      profile.updatedAt = new Date();
      this.profiles.set(profile.userId, profile);
    } catch (error) {
      console.error('[MemorySystem] Import error:', error);
    }
  }

  /**
   * Clear user data
   */
  clearProfile(userId: string): void {
    this.profiles.delete(userId);
  }
}

export const memorySystem = new MemorySystem();
