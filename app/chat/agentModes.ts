/**
 * AGENT MODE CONFIGURATION & UTILITIES
 *
 * Configuration-driven architecture for the 6 agent modes.
 * Eliminates ~1,700 lines of duplicated start/input/execute/cancel functions
 * by parameterizing the differences between modes.
 */

import type { StrategyOutput } from '@/agents/strategy';
import type { AgentMode, AgentPhase } from '@/hooks/useAgentMode';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentModeId =
  | 'strategy'
  | 'deep-research'
  | 'quick-research'
  | 'quick-strategy'
  | 'deep-writer'
  | 'quick-writer';

export interface Artifact {
  id: string;
  type: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface AgentModeConfig {
  /** Identifier matching the agent selector UI */
  id: AgentModeId;
  /** Mode parameter sent to /api/strategy (undefined = default strategy) */
  apiMode?: string;
  /** Human-readable label for logs */
  label: string;
  /** Markdown intro message shown when mode activates */
  introMessage: string;
  /** Markdown message shown when execution begins */
  execMessage: string;
  /** Message shown when user cancels */
  cancelMessage: string;
  /** Prefix for error messages (e.g. "Strategy", "Research") */
  errorPrefix: string;
  /** Which result formatter to use */
  resultStyle: 'strategy' | 'research';
  /** Deep modes show periodic progress updates during execution */
  hasProgressTracking: boolean;
  /** Label for progress tracking (e.g. "agents", "investigators") */
  progressLabel: string;
  /** Deep modes deactivate (setActive(false)) on execution error */
  deactivateOnError: boolean;
  /** Quick writer clears sessionId on completion */
  clearSessionOnComplete: boolean;
}

// ---------------------------------------------------------------------------
// Mode Registry (maps AgentModeId → hook instance at runtime)
// ---------------------------------------------------------------------------

export type AgentModeRegistry = Record<AgentModeId, AgentMode>;

// ---------------------------------------------------------------------------
// Configurations
// ---------------------------------------------------------------------------

export const AGENT_CONFIGS: Record<AgentModeId, AgentModeConfig> = {
  strategy: {
    id: 'strategy',
    apiMode: undefined,
    label: 'Deep Strategy',
    introMessage: `## 🧠 Deep Strategy Mode Activated

**You've activated the most powerful AI strategy system ever built.**

This isn't just ChatGPT with a fancy prompt. I'm about to deploy:
- **Opus 4.6** as the Master Architect (designs your strategy)
- **Sonnet 4.6** Project Managers (coordinate research teams)
- **Up to 100 Haiku 4.5 Scouts** (parallel research army)
- **Hundreds of web searches** for real-time data

**But first, I need to understand your situation deeply.**

Don't summarize. Don't filter. Don't worry about being organized. Just... tell me everything. Vent if you need to. The more context I have, the better strategy I can build.

**What's going on? What are you trying to figure out?**

---
*Estimated: 2-5 min | $8-15 | Stop anytime by typing "cancel"*`,
    execMessage: `## ⚡ Deploying Strategy Army...

Research is now underway. This will take 2-5 minutes.

I'll update you as scouts report back with findings.`,
    cancelMessage: '✋ **Strategy cancelled.** You can start a new one anytime.',
    errorPrefix: 'Strategy',
    resultStyle: 'strategy',
    hasProgressTracking: true,
    progressLabel: 'agents',
    deactivateOnError: true,
    clearSessionOnComplete: false,
  },

  'deep-research': {
    id: 'deep-research',
    apiMode: 'research',
    label: 'Deep Research',
    introMessage: `## 📚 Deep Research Mode Activated

**You've activated the most powerful AI research system ever built.**

This isn't a simple search. I'm about to deploy an autonomous research army:
- **Opus 4.6** as the Research Director (designs your investigation)
- **Sonnet 4.6** Domain Leads (coordinate research teams)
- **Up to 100 Haiku 4.5 Investigators** (parallel research army)
- **14 specialized tools** including browser automation, vision AI, PDF extraction

**But first, I need to understand what you want to research.**

Tell me the topic, your questions, and what you'll use this research for. The more context you give me, the deeper I can go.

**What topic do you want me to research?**

---
*Estimated: 2-5 min | $8-15 | Stop anytime by typing "cancel"*`,
    execMessage: `## 🔬 Deploying Research Army...

Research is now underway. This will take 2-5 minutes.

I'll update you as investigators report back with findings.`,
    cancelMessage: '✋ **Research cancelled.** You can start a new research session anytime.',
    errorPrefix: 'Research',
    resultStyle: 'research',
    hasProgressTracking: true,
    progressLabel: 'investigators',
    deactivateOnError: true,
    clearSessionOnComplete: false,
  },

  'quick-research': {
    id: 'quick-research',
    apiMode: 'quick-research',
    label: 'Quick Research',
    introMessage: `## 🔍 Quick Research Mode

I'll deploy a focused research team to investigate your topic.

**What you get:**
- **10-15 intelligent scouts** (Claude Sonnet 4.6)
- **All research tools:** Browser automation, web search, PDF extraction, vision analysis
- **Opus synthesis:** Claude Opus 4.6 compiles findings

**Estimated: 1-2 min | $2-3**

**What do you want me to research?**`,
    execMessage: `## 🚀 Deploying Research Scouts...

Research is now underway. This will take 1-2 minutes.

I'll update you as scouts report back with findings.`,
    cancelMessage: '✋ **Research cancelled.** You can start a new research session anytime.',
    errorPrefix: 'Research',
    resultStyle: 'research',
    hasProgressTracking: false,
    progressLabel: 'scouts',
    deactivateOnError: false,
    clearSessionOnComplete: false,
  },

  'quick-strategy': {
    id: 'quick-strategy',
    apiMode: 'quick-strategy',
    label: 'Quick Strategy',
    introMessage: `## 🎯 Quick Strategy Mode

I'll deploy a focused team to help you make this decision.

**What you get:**
- **10-15 intelligent scouts** (Claude Sonnet 4.6)
- **All research tools:** Browser automation, web search, data analysis
- **Opus synthesis:** Claude Opus 4.6 analyzes and recommends

**Estimated: 1-2 min | $2-3**

**What decision do you need help with?**`,
    execMessage: `## 🚀 Deploying Strategy Scouts...

Analysis is now underway. This will take 1-2 minutes.

I'll update you as scouts report back with findings.`,
    cancelMessage: '✋ **Strategy cancelled.** You can start a new strategy session anytime.',
    errorPrefix: 'Strategy',
    resultStyle: 'strategy',
    hasProgressTracking: false,
    progressLabel: 'scouts',
    deactivateOnError: false,
    clearSessionOnComplete: false,
  },

  'deep-writer': {
    id: 'deep-writer',
    apiMode: 'deep-writer',
    label: 'Deep Writer',
    introMessage: `## ✍️ Deep Writer Mode Activated

**You've activated the most advanced AI writing system ever built.**

This is a full publishing operation:
- **Claude Opus 4.6** - Editorial Director & Writers
- **Claude Sonnet 4.6** - Research Corps (15-50 agents)
- **Full browser tools** - Web research, PDF extraction, data gathering

**The Process:**
1. Deep intake - I understand exactly what you're creating
2. Research phase - Agents gather ALL facts first
3. Writing phase - Professional writers craft each section
4. Editorial phase - Voice consistency, polish, citations
5. Export - Markdown, PDF, or DOCX

**What are you writing today?**`,
    execMessage: `## 📚 Writing Operation Underway

**Phase 1: Research**
Deploying research scouts to gather facts, quotes, and sources...

**Phase 2: Writing**
Writers will craft each section using verified research...

**Phase 3: Editorial**
Final polish, voice consistency, and citations...

This may take 5-15 minutes depending on document length.`,
    cancelMessage: '✋ **Writing cancelled.** You can start a new writing project anytime.',
    errorPrefix: 'Writer',
    resultStyle: 'strategy',
    hasProgressTracking: false,
    progressLabel: 'agents',
    deactivateOnError: false,
    clearSessionOnComplete: false,
  },

  'quick-writer': {
    id: 'quick-writer',
    apiMode: 'quick-writer',
    label: 'Quick Writer',
    introMessage: `## ✍️ Quick Writer Mode

I'll deploy a focused team to research and write your content.

**What you get:**
- **10-15 research scouts** (Claude Sonnet 4.6) - gather facts first
- **Opus writers** (Claude Opus 4.6) - craft polished content
- **Fast turnaround:** 2-3 minutes

**Best for:**
- Blog posts and articles
- Short reports and summaries
- Professional emails
- Product descriptions

**What do you want me to write?**`,
    execMessage: '**Writing in progress...** Opus is crafting your content.',
    cancelMessage: '✋ **Writing cancelled.** You can start a new writing project anytime.',
    errorPrefix: 'Writer',
    resultStyle: 'strategy',
    hasProgressTracking: false,
    progressLabel: 'agents',
    deactivateOnError: false,
    clearSessionOnComplete: true,
  },
};

export const ALL_MODE_IDS = Object.keys(AGENT_CONFIGS) as AgentModeId[];

// ---------------------------------------------------------------------------
// Pure utility functions
// ---------------------------------------------------------------------------

/**
 * Determine which agent mode is currently active (for UI indicators).
 * Returns null if no mode is active.
 */
export function getActiveAgent(modes: AgentModeRegistry): AgentModeId | null {
  for (const id of ALL_MODE_IDS) {
    if (modes[id].isActive) return id;
  }
  return null;
}

/**
 * Get the session ID of whichever agent mode is currently active.
 */
export function getActiveSessionId(modes: AgentModeRegistry): string | null {
  for (const id of ALL_MODE_IDS) {
    if (modes[id].sessionId) return modes[id].sessionId;
  }
  return null;
}

/**
 * Check if any agent mode is in a given phase.
 */
export function isAnyModeInPhase(
  modes: AgentModeRegistry,
  phase: AgentPhase
): { active: boolean; modeId: AgentModeId | null } {
  for (const id of ALL_MODE_IDS) {
    if (modes[id].isActive && modes[id].phase === phase && modes[id].sessionId) {
      return { active: true, modeId: id };
    }
  }
  return { active: false, modeId: null };
}

/**
 * Check if any agent mode is currently executing (for steering commands).
 */
export function isAnyModeExecuting(modes: AgentModeRegistry): {
  executing: boolean;
  sessionId: string | null;
} {
  for (const id of ALL_MODE_IDS) {
    if (modes[id].isActive && modes[id].phase === 'executing' && modes[id].sessionId) {
      return { executing: true, sessionId: modes[id].sessionId };
    }
  }
  return { executing: false, sessionId: null };
}

// ---------------------------------------------------------------------------
// Result formatting (pure functions — no React dependencies)
// ---------------------------------------------------------------------------

function formatArtifactSection(artifacts?: Artifact[]): string {
  if (!artifacts || artifacts.length === 0) return '';
  return `\n### Generated Deliverables\n${artifacts
    .map((a) => `- **${a.title}** (${a.fileName}) — ${(a.sizeBytes / 1024).toFixed(1)} KB`)
    .join('\n')}\n\n*Deliverables are stored and can be retrieved from your session.*`;
}

/**
 * Format a strategy/writer result into a markdown string.
 */
export function formatStrategyResultContent(
  result: StrategyOutput,
  artifacts?: Artifact[]
): string {
  const artifactSection = formatArtifactSection(artifacts);

  // Check for writer mode document
  const doc = result.document;
  if (doc?.content) {
    let content = `# ${doc.title || result.recommendation.title}\n\n${doc.content}`;
    if (doc.citations && doc.citations.length > 0) {
      content += `\n\n---\n\n**Sources:**\n${doc.citations.map((c: string) => `- ${c}`).join('\n')}`;
    }
    content += `${artifactSection}\n\n---\n*Content generated by ${result.metadata.totalAgents} agents in ${Math.round(result.metadata.executionTime / 1000)}s.*`;
    return content;
  }

  // Standard strategy output
  return `## Strategy Complete

### Recommendation
**${result.recommendation.title}**

${result.recommendation.summary}

**Confidence:** ${result.recommendation.confidence}%
**Best For:** ${result.recommendation.bestFor}

### Key Reasoning
${result.recommendation.reasoning.map((item, i) => `${i + 1}. ${item}`).join('\n')}

### Trade-offs to Consider
${result.recommendation.tradeoffs.map((item) => `- ${typeof item === 'object' && item !== null ? (item as { text?: string; description?: string }).text || (item as { text?: string; description?: string }).description || JSON.stringify(item) : item}`).join('\n')}

${result.alternatives.length > 0 ? `### Alternative Options\n${result.alternatives.map((alt) => `- **${alt.title || 'Alternative'}** (${alt.confidence ?? 'N/A'}% confidence)\n  ${alt.summary || ''}\n  *Why not top:* ${alt.whyNotTop || 'Not specified'}`).join('\n\n')}` : ''}

### Action Plan
${result.actionPlan.map((item, i) => `${i + 1}. **${item.action}**\n   Priority: ${item.priority} | Timeframe: ${item.timeframe}${item.details ? `\n   ${item.details}` : ''}`).join('\n\n')}

### Next Steps
${result.nextSteps.map((step) => `- ${step}`).join('\n')}

${result.gaps.length > 0 ? `### Information Gaps\n${result.gaps.map((gap) => `- ${gap}`).join('\n')}` : ''}
${artifactSection}

### Research Metadata
- **Agents Deployed:** ${result.metadata.totalAgents}
- **Searches Conducted:** ${result.metadata.totalSearches}
- **Total Cost:** $${result.metadata.totalCost.toFixed(2)}
- **Duration:** ${Math.round(result.metadata.executionTime / 1000)}s

---
*Strategy complete. Ask follow-up questions or start a new strategy.*`;
}

/**
 * Format a research result into a markdown string.
 */
export function formatResearchResultContent(
  result: StrategyOutput,
  artifacts?: Artifact[]
): string {
  const artifactSection = formatArtifactSection(artifacts);

  return `## 📚 Research Report Complete

### Executive Summary
**${result.recommendation.title}**

${result.recommendation.summary}

**Confidence:** ${result.recommendation.confidence}%

### Key Findings
${result.recommendation.reasoning.map((item, i) => `${i + 1}. ${item}`).join('\n')}

### Limitations & Caveats
${result.recommendation.tradeoffs.map((item) => `- ${typeof item === 'object' && item !== null ? (item as { text?: string; description?: string }).text || (item as { text?: string; description?: string }).description || JSON.stringify(item) : item}`).join('\n')}

${result.alternatives.length > 0 ? `### Alternative Perspectives\n${result.alternatives.map((alt) => `- **${alt.title || 'Alternative'}** (${alt.confidence ?? 'N/A'}% confidence)\n  ${alt.summary || ''}`).join('\n\n')}` : ''}

### Recommended Next Steps
${result.actionPlan.map((item, i) => `${i + 1}. **${item.action}**\n   Priority: ${item.priority} | Timeframe: ${item.timeframe}${item.details ? `\n   ${item.details}` : ''}`).join('\n\n')}

### Further Research
${result.nextSteps.map((step) => `- ${step}`).join('\n')}

${result.gaps.length > 0 ? `### Knowledge Gaps\n${result.gaps.map((gap) => `- ${gap}`).join('\n')}` : ''}
${artifactSection}

### Research Metadata
- **Investigators Deployed:** ${result.metadata.totalAgents}
- **Searches Conducted:** ${result.metadata.totalSearches}
- **Total Cost:** $${result.metadata.totalCost.toFixed(2)}
- **Duration:** ${Math.round(result.metadata.executionTime / 1000)}s

---
*Research complete. Ask follow-up questions or start a new research session.*`;
}

/**
 * Format result content based on the mode's configured result style.
 */
export function formatResultContent(
  config: AgentModeConfig,
  result: StrategyOutput,
  artifacts?: Artifact[]
): string {
  if (config.resultStyle === 'research') {
    return formatResearchResultContent(result, artifacts);
  }
  return formatStrategyResultContent(result, artifacts);
}

/**
 * Parse an SSE line, returning the data payload or null.
 * Handles both `data:{json}` and `data: {json}` formats.
 */
export function parseSSELine(line: string): string | null {
  if (!line.startsWith('data:')) return null;
  const data = line.slice(5).trim();
  if (!data || data === '[DONE]') return null;
  return data;
}
