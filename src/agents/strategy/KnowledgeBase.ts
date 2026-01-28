/**
 * KNOWLEDGE BASE - Persistent Memory System
 *
 * Stores findings from every session in Supabase with full-text search.
 * Future sessions can query past findings to build on previous research
 * instead of starting from scratch.
 *
 * Uses PostgreSQL tsvector for full-text search (no external embedding API needed).
 * pgvector can be added later for semantic search if the Supabase plan supports it.
 */

import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Finding, AgentMode, KnowledgeEntry, KnowledgeQuery, KnowledgeContext } from './types';
import { logger } from '@/lib/logger';

const log = logger('KnowledgeBase');

// =============================================================================
// SUPABASE SERVICE CLIENT (bypasses RLS for server-side operations)
// =============================================================================

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase credentials for KnowledgeBase');
  }
  return createServiceClient(url, key);
}

// =============================================================================
// STORE FINDINGS
// =============================================================================

/**
 * Store findings from a completed session into the knowledge base.
 * Called after synthesis is complete.
 */
export async function storeFindings(
  userId: string,
  sessionId: string,
  agentMode: AgentMode,
  findings: Finding[],
  domains: string[]
): Promise<number> {
  if (findings.length === 0) return 0;

  const supabase = getServiceClient();
  let stored = 0;

  // Batch insert findings
  const rows = findings.map((finding) => ({
    user_id: userId,
    session_id: sessionId,
    agent_mode: agentMode,
    finding_type: finding.type,
    title: finding.title,
    content: finding.content,
    confidence: finding.confidence,
    relevance_score: finding.relevanceScore,
    sources: finding.sources,
    data_points: finding.dataPoints || [],
    domain: findDomain(finding, domains),
    topic_tags: extractTags(finding),
    search_queries: [],
    scout_name: finding.agentName,
    scout_tools_used: [],
  }));

  // Insert in batches of 50
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error, data } = await supabase.from('knowledge_base').insert(batch).select('id');

    if (error) {
      log.error('Failed to store findings batch', {
        error: error.message,
        batchIndex: i,
        batchSize: batch.length,
      });
    } else {
      stored += data?.length || 0;
    }
  }

  log.info('Stored findings in knowledge base', {
    userId,
    sessionId,
    total: findings.length,
    stored,
  });

  return stored;
}

// =============================================================================
// QUERY KNOWLEDGE BASE
// =============================================================================

/**
 * Query the knowledge base for relevant prior findings.
 * Uses PostgreSQL full-text search (tsvector).
 */
export async function queryKnowledge(query: KnowledgeQuery): Promise<KnowledgeEntry[]> {
  const supabase = getServiceClient();

  let q = supabase
    .from('knowledge_base')
    .select('*')
    .eq('user_id', query.userId)
    .order('relevance_score', { ascending: false })
    .limit(query.limit || 50);

  // Full-text search
  if (query.searchText) {
    // Convert search text to tsquery format
    const tsQuery = query.searchText
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .join(' & ');
    if (tsQuery) {
      q = q.textSearch('search_vector', tsQuery);
    }
  }

  // Filter by domain
  if (query.domain) {
    q = q.eq('domain', query.domain);
  }

  // Filter by mode
  if (query.agentMode) {
    q = q.eq('agent_mode', query.agentMode);
  }

  // Filter by tags
  if (query.tags && query.tags.length > 0) {
    q = q.overlaps('topic_tags', query.tags);
  }

  // Filter by minimum relevance
  if (query.minRelevance) {
    q = q.gte('relevance_score', query.minRelevance);
  }

  const { data, error } = await q;

  if (error) {
    log.error('Knowledge base query failed', { error: error.message, query });
    return [];
  }

  return (data || []).map(mapRowToEntry);
}

/**
 * Get a summary of what's in the knowledge base for a user.
 * Used during intake to show the user what prior research exists.
 */
export async function getKnowledgeSummary(
  userId: string,
  searchText?: string
): Promise<KnowledgeContext> {
  const entries = await queryKnowledge({
    userId,
    searchText,
    limit: 100,
    minRelevance: 0.3,
  });

  if (entries.length === 0) {
    return {
      entries: [],
      summary: '',
      domains: [],
      totalFindings: 0,
    };
  }

  // Extract unique domains
  const domains = [...new Set(entries.map((e) => e.domain).filter(Boolean))] as string[];

  // Build summary
  const domainCounts = domains.map((d) => {
    const count = entries.filter((e) => e.domain === d).length;
    return `${d} (${count} findings)`;
  });

  const summary = `Found ${entries.length} prior findings across ${domains.length} domains: ${domainCounts.join(', ')}. Top findings include: ${entries
    .slice(0, 5)
    .map((e) => e.title)
    .join('; ')}.`;

  return {
    entries,
    summary,
    domains,
    totalFindings: entries.length,
  };
}

/**
 * Build a context string from knowledge entries for injection into prompts.
 * Used by the Master Architect to leverage prior research.
 */
export function buildKnowledgePromptContext(context: KnowledgeContext): string {
  if (context.totalFindings === 0) {
    return '';
  }

  const sections: string[] = [
    `\n\nPRIOR RESEARCH (from ${context.totalFindings} previous findings):`,
  ];

  // Group by domain
  for (const domain of context.domains) {
    const domainEntries = context.entries.filter((e) => e.domain === domain);
    sections.push(`\n## ${domain} (${domainEntries.length} findings)`);

    for (const entry of domainEntries.slice(0, 10)) {
      sections.push(
        `- [${entry.confidence}] ${entry.title}: ${entry.content.slice(0, 200)}${entry.content.length > 200 ? '...' : ''}`
      );
    }
  }

  sections.push(
    '\nLeverage these prior findings where relevant. Do NOT re-research topics already covered unless the user specifically asks for updated information.'
  );

  return sections.join('\n');
}

// =============================================================================
// HELPERS
// =============================================================================

function findDomain(finding: Finding, domains: string[]): string | undefined {
  // Try to match finding to a domain based on agent name or content
  const text = `${finding.agentName} ${finding.title} ${finding.content}`.toLowerCase();
  for (const domain of domains) {
    if (text.includes(domain.toLowerCase())) {
      return domain;
    }
  }
  return domains[0]; // Default to first domain
}

function extractTags(finding: Finding): string[] {
  const tags: string[] = [finding.type];

  // Extract key terms from title
  const words = finding.title
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);
  tags.push(...words.slice(0, 5));

  return [...new Set(tags)];
}

function mapRowToEntry(row: Record<string, unknown>): KnowledgeEntry {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    sessionId: row.session_id as string,
    agentMode: (row.agent_mode as AgentMode) || 'strategy',
    findingType: row.finding_type as string,
    title: row.title as string,
    content: row.content as string,
    confidence: row.confidence as 'high' | 'medium' | 'low',
    relevanceScore: (row.relevance_score as number) || 0.5,
    sources: (row.sources as KnowledgeEntry['sources']) || [],
    dataPoints: (row.data_points as KnowledgeEntry['dataPoints']) || [],
    domain: row.domain as string | undefined,
    topicTags: (row.topic_tags as string[]) || [],
    searchQueries: (row.search_queries as string[]) || [],
    scoutName: row.scout_name as string | undefined,
    scoutToolsUsed: (row.scout_tools_used as string[]) || [],
    createdAt: new Date(row.created_at as string).getTime(),
  };
}
