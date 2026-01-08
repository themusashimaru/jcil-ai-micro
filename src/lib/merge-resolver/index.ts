/**
 * SMART MERGE CONFLICT RESOLVER
 *
 * AI that truly understands both sides of a merge conflict.
 *
 * Features:
 * - Semantic understanding of code changes
 * - Intent detection for each side
 * - Intelligent merge suggestions
 * - Test-aware merging
 * - Preserves both intents when possible
 * - Explains resolution reasoning
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/lib/logger';

const log = logger('MergeResolver');

// ============================================
// TYPES
// ============================================

export interface MergeConflict {
  filePath: string;
  baseContent: string;    // Original (common ancestor)
  oursContent: string;    // Our changes (current branch)
  theirsContent: string;  // Their changes (incoming branch)
  conflictMarkers: ConflictMarker[];
}

export interface ConflictMarker {
  startLine: number;
  endLine: number;
  baseStart: number;
  baseEnd: number;
  oursStart: number;
  oursEnd: number;
  theirsStart: number;
  theirsEnd: number;
  ours: string;
  theirs: string;
  base?: string;
}

export interface MergeResolution {
  filePath: string;
  resolvedContent: string;
  conflicts: ResolvedConflict[];
  confidence: number;
  reasoning: string;
  potentialIssues: string[];
  testsToRun: string[];
}

export interface ResolvedConflict {
  original: {
    ours: string;
    theirs: string;
    base?: string;
  };
  resolved: string;
  strategy: MergeStrategy;
  reasoning: string;
  confidence: number;
}

export type MergeStrategy =
  | 'accept-ours'
  | 'accept-theirs'
  | 'combine-both'
  | 'semantic-merge'
  | 'manual-required';

export interface ConflictAnalysis {
  oursIntent: string;
  theirsIntent: string;
  conflictType: ConflictType;
  canAutomerge: boolean;
  suggestedStrategy: MergeStrategy;
  riskLevel: 'low' | 'medium' | 'high';
}

export type ConflictType =
  | 'additive-both'       // Both sides add different things
  | 'modification-same'   // Both modify the same code differently
  | 'rename-conflict'     // Both rename differently
  | 'delete-modify'       // One deletes, one modifies
  | 'import-conflict'     // Import/dependency conflicts
  | 'formatting-only'     // Only whitespace/formatting differences
  | 'logic-conflict';     // Conflicting business logic

// ============================================
// MERGE RESOLVER CLASS
// ============================================

export class SmartMergeResolver {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic();
  }

  /**
   * Resolve a merge conflict intelligently
   */
  async resolveConflict(conflict: MergeConflict): Promise<MergeResolution> {
    log.info('Resolving conflicts', { filePath: conflict.filePath });

    // Parse conflict markers if not already parsed
    const markers = conflict.conflictMarkers.length > 0
      ? conflict.conflictMarkers
      : this.parseConflictMarkers(conflict.oursContent);

    const resolvedConflicts: ResolvedConflict[] = [];
    let resolvedContent = conflict.oursContent;
    let totalConfidence = 0;
    const potentialIssues: string[] = [];
    const testsToRun: string[] = [];

    // Resolve each conflict section
    for (const marker of markers) {
      const analysis = await this.analyzeConflict(marker, conflict);
      const resolution = await this.generateResolution(marker, analysis, conflict);

      resolvedConflicts.push(resolution);
      totalConfidence += resolution.confidence;

      // Replace conflict in content
      const conflictBlock = this.buildConflictBlock(marker);
      resolvedContent = resolvedContent.replace(conflictBlock, resolution.resolved);

      // Track issues and tests
      if (resolution.confidence < 0.8) {
        potentialIssues.push(`Low confidence merge at lines ${marker.startLine}-${marker.endLine}: ${resolution.reasoning}`);
      }

      // Suggest tests based on conflict type
      const relatedTests = this.suggestTests(marker, conflict.filePath);
      testsToRun.push(...relatedTests);
    }

    const avgConfidence = markers.length > 0 ? totalConfidence / markers.length : 1;

    return {
      filePath: conflict.filePath,
      resolvedContent,
      conflicts: resolvedConflicts,
      confidence: avgConfidence,
      reasoning: this.generateOverallReasoning(resolvedConflicts),
      potentialIssues,
      testsToRun: [...new Set(testsToRun)],
    };
  }

  /**
   * Parse conflict markers from a file
   */
  parseConflictMarkers(content: string): ConflictMarker[] {
    const markers: ConflictMarker[] = [];
    const lines = content.split('\n');

    let inConflict = false;
    let currentMarker: Partial<ConflictMarker> = {};
    let oursLines: string[] = [];
    let theirsLines: string[] = [];
    let inOurs = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('<<<<<<<')) {
        inConflict = true;
        inOurs = true;
        currentMarker = { startLine: i + 1 };
        oursLines = [];
        theirsLines = [];
      } else if (line.startsWith('=======') && inConflict) {
        inOurs = false;
      } else if (line.startsWith('>>>>>>>') && inConflict) {
        inConflict = false;
        currentMarker.endLine = i + 1;
        currentMarker.ours = oursLines.join('\n');
        currentMarker.theirs = theirsLines.join('\n');
        currentMarker.oursStart = currentMarker.startLine! + 1;
        currentMarker.oursEnd = currentMarker.startLine! + oursLines.length;
        currentMarker.theirsStart = currentMarker.oursEnd! + 2;
        currentMarker.theirsEnd = i;

        markers.push(currentMarker as ConflictMarker);
      } else if (inConflict) {
        if (inOurs) {
          oursLines.push(line);
        } else {
          theirsLines.push(line);
        }
      }
    }

    return markers;
  }

  /**
   * Analyze a conflict to understand intent
   */
  private async analyzeConflict(
    marker: ConflictMarker,
    context: MergeConflict
  ): Promise<ConflictAnalysis> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: `You are a code merge expert. Analyze this merge conflict to understand the intent of both sides.

Determine:
1. What is the intent/purpose of "ours" (current branch)?
2. What is the intent/purpose of "theirs" (incoming branch)?
3. What type of conflict is this?
4. Can this be auto-merged safely?
5. What strategy should be used?
6. What's the risk level?

Return JSON:
{
  "oursIntent": "description of what our changes aim to do",
  "theirsIntent": "description of what their changes aim to do",
  "conflictType": "additive-both" | "modification-same" | "rename-conflict" | "delete-modify" | "import-conflict" | "formatting-only" | "logic-conflict",
  "canAutomerge": true/false,
  "suggestedStrategy": "accept-ours" | "accept-theirs" | "combine-both" | "semantic-merge" | "manual-required",
  "riskLevel": "low" | "medium" | "high"
}`,
        messages: [
          {
            role: 'user',
            content: `Analyze this merge conflict:

File: ${context.filePath}

OURS (current branch):
\`\`\`
${marker.ours}
\`\`\`

THEIRS (incoming branch):
\`\`\`
${marker.theirs}
\`\`\`

${marker.base ? `BASE (common ancestor):
\`\`\`
${marker.base}
\`\`\`` : ''}

Surrounding context (full file):
\`\`\`
${context.baseContent.substring(0, 2000)}...
\`\`\``,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response');
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.getDefaultAnalysis();
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      log.error('Analysis error', error as Error);
      return this.getDefaultAnalysis();
    }
  }

  /**
   * Generate a resolution for a conflict
   */
  private async generateResolution(
    marker: ConflictMarker,
    analysis: ConflictAnalysis,
    context: MergeConflict
  ): Promise<ResolvedConflict> {
    // Simple cases - just accept one side
    if (analysis.suggestedStrategy === 'accept-ours') {
      return {
        original: { ours: marker.ours, theirs: marker.theirs, base: marker.base },
        resolved: marker.ours,
        strategy: 'accept-ours',
        reasoning: `Accepting our changes: ${analysis.oursIntent}`,
        confidence: analysis.riskLevel === 'low' ? 0.95 : 0.75,
      };
    }

    if (analysis.suggestedStrategy === 'accept-theirs') {
      return {
        original: { ours: marker.ours, theirs: marker.theirs, base: marker.base },
        resolved: marker.theirs,
        strategy: 'accept-theirs',
        reasoning: `Accepting their changes: ${analysis.theirsIntent}`,
        confidence: analysis.riskLevel === 'low' ? 0.95 : 0.75,
      };
    }

    // Complex cases - need AI to merge
    if (analysis.suggestedStrategy === 'combine-both' || analysis.suggestedStrategy === 'semantic-merge') {
      try {
        const response = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: `You are a code merge expert. Combine both changes intelligently.

IMPORTANT:
1. Preserve the intent of BOTH changes
2. Ensure the result is syntactically correct
3. Maintain code style consistency
4. Don't lose any functionality from either side
5. If there's a logical conflict, prefer the safer option

Return JSON:
{
  "mergedCode": "the merged code",
  "reasoning": "explanation of how you merged",
  "confidence": 0.0-1.0
}`,
          messages: [
            {
              role: 'user',
              content: `Merge these changes:

OURS intent: ${analysis.oursIntent}
THEIRS intent: ${analysis.theirsIntent}

OURS code:
\`\`\`
${marker.ours}
\`\`\`

THEIRS code:
\`\`\`
${marker.theirs}
\`\`\`

${marker.base ? `BASE code:
\`\`\`
${marker.base}
\`\`\`` : ''}

File context: ${context.filePath}`,
            },
          ],
        });

        const content = response.content[0];
        if (content.type === 'text') {
          const jsonMatch = content.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            return {
              original: { ours: marker.ours, theirs: marker.theirs, base: marker.base },
              resolved: result.mergedCode,
              strategy: analysis.suggestedStrategy,
              reasoning: result.reasoning,
              confidence: result.confidence || 0.8,
            };
          }
        }
      } catch (error) {
        log.error('Merge generation error', error as Error);
      }
    }

    // Fallback - require manual resolution
    return {
      original: { ours: marker.ours, theirs: marker.theirs, base: marker.base },
      resolved: `// TODO: Manual merge required\n// Ours: ${analysis.oursIntent}\n// Theirs: ${analysis.theirsIntent}\n${marker.ours}\n// --- OR ---\n${marker.theirs}`,
      strategy: 'manual-required',
      reasoning: 'This conflict requires manual review due to conflicting business logic',
      confidence: 0,
    };
  }

  /**
   * Build conflict block for replacement
   */
  private buildConflictBlock(marker: ConflictMarker): string {
    return `<<<<<<< HEAD\n${marker.ours}\n=======\n${marker.theirs}\n>>>>>>>`;
  }

  /**
   * Suggest tests to run after merge
   */
  private suggestTests(marker: ConflictMarker, filePath: string): string[] {
    const tests: string[] = [];

    // Suggest tests based on file type
    if (filePath.includes('component') || filePath.includes('.tsx')) {
      tests.push(`npm test -- --testPathPattern="${filePath.replace('.tsx', '.test.tsx')}"`);
    }

    if (filePath.includes('api') || filePath.includes('route')) {
      tests.push(`npm test -- --testPathPattern="api"`);
    }

    // Suggest integration tests if both sides modify significant logic
    if (marker.ours.length > 100 && marker.theirs.length > 100) {
      tests.push('npm run test:integration');
    }

    return tests;
  }

  /**
   * Generate overall reasoning summary
   */
  private generateOverallReasoning(conflicts: ResolvedConflict[]): string {
    const strategies = conflicts.map(c => c.strategy);
    const uniqueStrategies = [...new Set(strategies)];

    if (uniqueStrategies.length === 1) {
      return `All ${conflicts.length} conflicts resolved using "${uniqueStrategies[0]}" strategy.`;
    }

    const summary = uniqueStrategies.map(s => {
      const count = strategies.filter(x => x === s).length;
      return `${count} "${s}"`;
    }).join(', ');

    return `Resolved ${conflicts.length} conflicts: ${summary}`;
  }

  /**
   * Get default analysis when AI fails
   */
  private getDefaultAnalysis(): ConflictAnalysis {
    return {
      oursIntent: 'Unknown - analysis failed',
      theirsIntent: 'Unknown - analysis failed',
      conflictType: 'modification-same',
      canAutomerge: false,
      suggestedStrategy: 'manual-required',
      riskLevel: 'high',
    };
  }

  /**
   * Resolve multiple conflicts at once
   */
  async resolveMultipleConflicts(
    conflicts: MergeConflict[]
  ): Promise<MergeResolution[]> {
    const resolutions: MergeResolution[] = [];

    for (const conflict of conflicts) {
      const resolution = await this.resolveConflict(conflict);
      resolutions.push(resolution);
    }

    return resolutions;
  }

  /**
   * Detect if a file has conflicts
   */
  hasConflicts(content: string): boolean {
    return content.includes('<<<<<<<') &&
           content.includes('=======') &&
           content.includes('>>>>>>>');
  }

  /**
   * Extract conflict summary for quick review
   */
  async getConflictSummary(conflict: MergeConflict): Promise<string> {
    const markers = this.parseConflictMarkers(conflict.oursContent);

    const summaries: string[] = [];
    for (const marker of markers) {
      const analysis = await this.analyzeConflict(marker, conflict);
      summaries.push(`
Lines ${marker.startLine}-${marker.endLine}:
  - Ours: ${analysis.oursIntent}
  - Theirs: ${analysis.theirsIntent}
  - Type: ${analysis.conflictType}
  - Risk: ${analysis.riskLevel}
  - Suggested: ${analysis.suggestedStrategy}`);
    }

    return `Conflict Summary for ${conflict.filePath}:
${summaries.join('\n')}`;
  }
}

// ============================================
// EXPORTS
// ============================================

export const mergeResolver = new SmartMergeResolver();

/**
 * Quick function to resolve a conflict
 */
export async function resolveConflict(
  filePath: string,
  content: string,
  baseContent?: string
): Promise<MergeResolution> {
  return mergeResolver.resolveConflict({
    filePath,
    baseContent: baseContent || '',
    oursContent: content,
    theirsContent: '',
    conflictMarkers: [],
  });
}

/**
 * Check if content has conflicts
 */
export function hasConflicts(content: string): boolean {
  return mergeResolver.hasConflicts(content);
}
