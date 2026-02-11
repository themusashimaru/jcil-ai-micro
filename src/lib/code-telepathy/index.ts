/**
 * CODE TELEPATHY - CROSS-PROJECT INTELLIGENCE
 *
 * This is the most advanced feature. It creates a unified intelligence
 * across ALL your repositories, learning your:
 * - Coding patterns and preferences
 * - Architecture decisions
 * - Common solutions you use
 * - Team conventions
 *
 * It's like giving the AI your entire brain as a developer.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const log = logger('CodeTelepathy');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export interface DeveloperProfile {
  userId: string;
  patterns: CodingPattern[];
  preferences: Map<string, string>;
  commonSolutions: Solution[];
  conventions: Convention[];
  expertise: ExpertiseArea[];
  lastUpdated: Date;
}

export interface CodingPattern {
  id: string;
  name: string;
  description: string;
  frequency: number;
  examples: string[];
  contexts: string[];
  confidence: number;
}

export interface Solution {
  id: string;
  problem: string;
  solution: string;
  repos: string[];
  lastUsed: Date;
  timesUsed: number;
}

export interface Convention {
  id: string;
  type: 'naming' | 'structure' | 'style' | 'architecture';
  rule: string;
  examples: string[];
  consistency: number; // 0-1 how consistently followed
}

export interface ExpertiseArea {
  domain: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  evidence: string[];
  lastActivity: Date;
}

export interface CrossProjectInsight {
  type: 'pattern' | 'suggestion' | 'warning' | 'opportunity';
  title: string;
  description: string;
  relevantRepos: string[];
  code?: string;
  confidence: number;
}

/**
 * The Code Telepathy System - learns your coding DNA
 */
export class CodeTelepathy {
  private profileCache: Map<string, DeveloperProfile> = new Map();

  /**
   * Analyze all repos and build developer profile
   */
  async buildDeveloperProfile(
    userId: string,
    repos: Array<{ owner: string; name: string; files: Array<{ path: string; content: string }> }>
  ): Promise<DeveloperProfile> {
    log.info('Building profile', { userId, repoCount: repos.length });

    const patterns: CodingPattern[] = [];
    const solutions: Solution[] = [];
    const conventions: Convention[] = [];

    // Analyze each repo
    for (const repo of repos) {
      const repoAnalysis = await this.analyzeRepo(repo.owner, repo.name, repo.files);
      patterns.push(...repoAnalysis.patterns);
      solutions.push(...repoAnalysis.solutions);
      conventions.push(...repoAnalysis.conventions);
    }

    // Consolidate and deduplicate
    const consolidatedPatterns = this.consolidatePatterns(patterns);
    const consolidatedSolutions = this.consolidateSolutions(solutions);
    const consolidatedConventions = this.consolidateConventions(conventions);

    // Determine expertise areas
    const expertiseAreas = await this.determineExpertise(repos);

    const profile: DeveloperProfile = {
      userId,
      patterns: consolidatedPatterns,
      preferences: new Map(),
      commonSolutions: consolidatedSolutions,
      conventions: consolidatedConventions,
      expertise: expertiseAreas,
      lastUpdated: new Date(),
    };

    // Cache the profile
    this.profileCache.set(userId, profile);

    // Save to database
    await this.saveProfile(profile);

    return profile;
  }

  /**
   * Analyze a single repo
   */
  private async analyzeRepo(
    owner: string,
    name: string,
    files: Array<{ path: string; content: string }>
  ) {
    // Sample files for analysis (limit for performance)
    const sampleFiles = files
      .filter(f => this.isAnalyzableFile(f.path))
      .slice(0, 50);

    const allCode = sampleFiles
      .map(f => `// File: ${f.path}\n${f.content.slice(0, 1000)}`)
      .join('\n\n---\n\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: `You are analyzing code to understand a developer's patterns and preferences.
Extract:
1. Coding patterns (recurring code structures)
2. Common solutions (how they solve specific problems)
3. Conventions (naming, structure, style)

Be specific and include code examples.`,
      messages: [{
        role: 'user',
        content: `Analyze these files from ${owner}/${name}:

${allCode.slice(0, 10000)}

Return JSON:
{
  "patterns": [{ "name": "", "description": "", "examples": ["code"], "contexts": ["when used"] }],
  "solutions": [{ "problem": "", "solution": "code or description" }],
  "conventions": [{ "type": "naming|structure|style|architecture", "rule": "", "examples": [""] }]
}`,
      }],
    });

    let content = '';
    for (const block of response.content) {
      if (block.type === 'text') content += block.text;
    }

    try {
      const analysis = JSON.parse(content.replace(/```json?\s*/g, '').replace(/```/g, ''));
      return {
        patterns: (analysis.patterns || []).map((p: CodingPattern) => ({ ...p, frequency: 1, confidence: 0.7 })),
        solutions: (analysis.solutions || []).map((s: Solution) => ({ ...s, repos: [`${owner}/${name}`], timesUsed: 1, lastUsed: new Date() })),
        conventions: (analysis.conventions || []).map((c: Convention) => ({ ...c, consistency: 0.8 })),
      };
    } catch {
      return { patterns: [], solutions: [], conventions: [] };
    }
  }

  /**
   * Check if file is analyzable
   */
  private isAnalyzableFile(path: string): boolean {
    const ext = path.split('.').pop()?.toLowerCase();
    const analyzable = ['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java'];
    const skip = ['node_modules', '.next', 'dist', 'build', '.min.'];
    return analyzable.includes(ext || '') && !skip.some(s => path.includes(s));
  }

  /**
   * Consolidate patterns across repos
   */
  private consolidatePatterns(patterns: CodingPattern[]): CodingPattern[] {
    const consolidated = new Map<string, CodingPattern>();

    for (const pattern of patterns) {
      const key = pattern.name.toLowerCase();
      if (consolidated.has(key)) {
        const existing = consolidated.get(key)!;
        existing.frequency += pattern.frequency;
        existing.examples.push(...pattern.examples);
        existing.contexts.push(...pattern.contexts);
        existing.confidence = Math.max(existing.confidence, pattern.confidence);
      } else {
        consolidated.set(key, { ...pattern, id: `pattern_${Date.now()}_${Math.random().toString(36).slice(2)}` });
      }
    }

    return Array.from(consolidated.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 20);
  }

  /**
   * Consolidate solutions across repos
   */
  private consolidateSolutions(solutions: Solution[]): Solution[] {
    const consolidated = new Map<string, Solution>();

    for (const solution of solutions) {
      const key = solution.problem.toLowerCase().slice(0, 50);
      if (consolidated.has(key)) {
        const existing = consolidated.get(key)!;
        existing.repos.push(...solution.repos);
        existing.timesUsed += solution.timesUsed;
        existing.lastUsed = new Date(Math.max(
          existing.lastUsed.getTime(),
          solution.lastUsed.getTime()
        ));
      } else {
        consolidated.set(key, { ...solution, id: `solution_${Date.now()}_${Math.random().toString(36).slice(2)}` });
      }
    }

    return Array.from(consolidated.values())
      .sort((a, b) => b.timesUsed - a.timesUsed)
      .slice(0, 30);
  }

  /**
   * Consolidate conventions
   */
  private consolidateConventions(conventions: Convention[]): Convention[] {
    return conventions.slice(0, 15).map((c, i) => ({
      ...c,
      id: `convention_${i}`,
    }));
  }

  /**
   * Determine expertise areas from repos
   */
  private async determineExpertise(
    repos: Array<{ owner: string; name: string; files: Array<{ path: string; content: string }> }>
  ): Promise<ExpertiseArea[]> {
    const techStack: Record<string, number> = {};

    for (const repo of repos) {
      for (const file of repo.files) {
        const ext = file.path.split('.').pop()?.toLowerCase();
        if (ext) {
          techStack[ext] = (techStack[ext] || 0) + 1;
        }

        // Check content for frameworks
        const content = file.content.toLowerCase();
        if (content.includes('react')) techStack['react'] = (techStack['react'] || 0) + 1;
        if (content.includes('next')) techStack['nextjs'] = (techStack['nextjs'] || 0) + 1;
        if (content.includes('express')) techStack['express'] = (techStack['express'] || 0) + 1;
        if (content.includes('prisma')) techStack['prisma'] = (techStack['prisma'] || 0) + 1;
      }
    }

    // Convert to expertise areas
    return Object.entries(techStack)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => ({
        domain,
        level: count > 50 ? 'expert' : count > 20 ? 'advanced' : count > 5 ? 'intermediate' : 'beginner',
        evidence: [`Found in ${count} files`],
        lastActivity: new Date(),
      }));
  }

  /**
   * Get insights based on current context
   */
  async getInsights(
    userId: string,
    currentCode: string,
    currentFile: string
  ): Promise<CrossProjectInsight[]> {
    const profile = this.profileCache.get(userId) || await this.loadProfile(userId);
    if (!profile) return [];

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Given this developer profile and current code, provide insights:

## Developer Profile
Patterns: ${profile.patterns.slice(0, 5).map(p => p.name).join(', ')}
Expertise: ${profile.expertise.slice(0, 5).map(e => `${e.domain}(${e.level})`).join(', ')}
Common Solutions: ${profile.commonSolutions.slice(0, 3).map(s => s.problem).join(', ')}

## Current Code (${currentFile})
\`\`\`
${currentCode.slice(0, 2000)}
\`\`\`

Provide insights:
1. Patterns they usually apply here but haven't
2. Better solutions they've used elsewhere
3. Convention violations
4. Opportunities to improve

Return JSON array:
[{
  "type": "pattern" | "suggestion" | "warning" | "opportunity",
  "title": "",
  "description": "",
  "relevantRepos": [],
  "code": "optional code",
  "confidence": 0-1
}]`,
      }],
    });

    let content = '';
    for (const block of response.content) {
      if (block.type === 'text') content += block.text;
    }

    try {
      const insights = JSON.parse(content.replace(/```json?\s*/g, '').replace(/```/g, ''));
      return Array.isArray(insights) ? insights : [];
    } catch {
      return [];
    }
  }

  /**
   * Generate personalized code based on profile
   */
  async generatePersonalizedCode(
    userId: string,
    request: string,
    context?: string
  ): Promise<string> {
    const profile = this.profileCache.get(userId) || await this.loadProfile(userId);

    const systemPrompt = profile
      ? `You are generating code for a developer with these characteristics:
- Patterns they use: ${profile.patterns.slice(0, 5).map(p => p.name).join(', ')}
- Conventions: ${profile.conventions.slice(0, 5).map(c => c.rule).join('; ')}
- Expertise: ${profile.expertise.slice(0, 5).map(e => e.domain).join(', ')}

Generate code that matches their style and preferences.`
      : 'Generate clean, professional code.';

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `${request}\n\n${context ? `Context:\n${context}` : ''}`,
      }],
    });

    let code = '';
    for (const block of response.content) {
      if (block.type === 'text') code += block.text;
    }
    return code;
  }

  /**
   * Save profile to database
   */
  private async saveProfile(profile: DeveloperProfile): Promise<void> {
    const supabase = createServiceClient();

    await supabase.from('developer_profiles').upsert({
      user_id: profile.userId,
      patterns: JSON.stringify(profile.patterns),
      common_solutions: JSON.stringify(profile.commonSolutions),
      conventions: JSON.stringify(profile.conventions),
      expertise: JSON.stringify(profile.expertise),
      updated_at: profile.lastUpdated.toISOString(),
    });
  }

  /**
   * Load profile from database
   */
  private async loadProfile(userId: string): Promise<DeveloperProfile | null> {
    const supabase = createServiceClient();

    const { data } = await supabase
      .from('developer_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!data) return null;

    const profile: DeveloperProfile = {
      userId,
      patterns: JSON.parse(data.patterns || '[]'),
      preferences: new Map(),
      commonSolutions: JSON.parse(data.common_solutions || '[]'),
      conventions: JSON.parse(data.conventions || '[]'),
      expertise: JSON.parse(data.expertise || '[]'),
      lastUpdated: new Date(data.updated_at),
    };

    this.profileCache.set(userId, profile);
    return profile;
  }
}

// Singleton instance
let telepathyInstance: CodeTelepathy | null = null;

export function getCodeTelepathy(): CodeTelepathy {
  if (!telepathyInstance) {
    telepathyInstance = new CodeTelepathy();
  }
  return telepathyInstance;
}
