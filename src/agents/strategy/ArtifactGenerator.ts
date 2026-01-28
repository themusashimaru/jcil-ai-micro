/**
 * ARTIFACT GENERATOR - Auto-generated Deliverables
 *
 * After synthesis completes, generates real deliverables:
 * - Comparison tables (CSV)
 * - Data charts (Python matplotlib via E2B → PNG)
 * - Summary reports (formatted markdown)
 *
 * Uses the E2B code execution sandbox for chart generation.
 * Stores artifacts in Supabase for retrieval.
 */

import { createClient as createServiceClient } from '@supabase/supabase-js';
import type {
  StrategyOutput,
  Finding,
  Artifact,
  ArtifactType,
  StrategyStreamCallback,
} from './types';
import { logger } from '@/lib/logger';

const log = logger('ArtifactGenerator');

// =============================================================================
// SUPABASE SERVICE CLIENT
// =============================================================================

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase credentials for ArtifactGenerator');
  }
  return createServiceClient(url, key);
}

// =============================================================================
// GENERATE ALL ARTIFACTS
// =============================================================================

/**
 * Generate all applicable artifacts from a completed strategy/research output.
 * Called after synthesis is complete.
 */
export async function generateArtifacts(
  userId: string,
  sessionId: string,
  output: StrategyOutput,
  findings: Finding[],
  onStream?: StrategyStreamCallback
): Promise<Artifact[]> {
  const artifacts: Artifact[] = [];

  onStream?.({
    type: 'synthesis_progress',
    message: 'Generating deliverables...',
    timestamp: Date.now(),
  });

  // 1. Generate comparison CSV if domain analyses have comparison tables
  try {
    const csvArtifact = await generateComparisonCSV(sessionId, output);
    if (csvArtifact) {
      artifacts.push(csvArtifact);
      await storeArtifact(userId, csvArtifact);
    }
  } catch (error) {
    log.warn('Failed to generate CSV artifact', { error });
  }

  // 2. Generate findings data table
  try {
    const findingsCSV = generateFindingsCSV(sessionId, findings);
    if (findingsCSV) {
      artifacts.push(findingsCSV);
      await storeArtifact(userId, findingsCSV);
    }
  } catch (error) {
    log.warn('Failed to generate findings CSV', { error });
  }

  // 3. Generate executive summary report
  try {
    const report = generateExecutiveReport(sessionId, output);
    artifacts.push(report);
    await storeArtifact(userId, report);
  } catch (error) {
    log.warn('Failed to generate report', { error });
  }

  // 4. Generate chart via E2B (if actionPlan has enough data)
  try {
    const chart = await generateChart(sessionId, output);
    if (chart) {
      artifacts.push(chart);
      await storeArtifact(userId, chart);
    }
  } catch (error) {
    log.warn('Failed to generate chart', { error });
  }

  log.info('Generated artifacts', {
    sessionId,
    count: artifacts.length,
    types: artifacts.map((a) => a.type),
  });

  return artifacts;
}

// =============================================================================
// COMPARISON CSV
// =============================================================================

async function generateComparisonCSV(
  sessionId: string,
  output: StrategyOutput
): Promise<Artifact | null> {
  // Find comparison tables in domain analyses
  const tables = output.analysis.byDomain
    .filter((d) => d.comparisonTable)
    .map((d) => d.comparisonTable!);

  if (tables.length === 0) return null;

  // Build CSV content
  const csvLines: string[] = [];

  for (const table of tables) {
    // Add headers
    csvLines.push(table.headers.map(escapeCsvField).join(','));

    // Add rows
    for (const row of table.rows) {
      const values = [row.option, ...row.values.map(String)];
      csvLines.push(values.map(escapeCsvField).join(','));
    }

    csvLines.push(''); // Empty line between tables
  }

  const content = csvLines.join('\n');

  return {
    id: crypto.randomUUID(),
    sessionId,
    type: 'csv',
    title: 'Comparison Table',
    description: `Comparison data from ${tables.length} domain${tables.length > 1 ? 's' : ''}`,
    mimeType: 'text/csv',
    fileName: `comparison_${sessionId.slice(0, 8)}.csv`,
    contentText: content,
    sizeBytes: new TextEncoder().encode(content).length,
    createdAt: Date.now(),
  };
}

// =============================================================================
// FINDINGS CSV
// =============================================================================

function generateFindingsCSV(sessionId: string, findings: Finding[]): Artifact | null {
  if (findings.length === 0) return null;

  const headers = ['Type', 'Title', 'Content', 'Confidence', 'Relevance', 'Agent', 'Sources'];

  const csvLines: string[] = [headers.map(escapeCsvField).join(',')];

  for (const finding of findings) {
    const sources = finding.sources.map((s) => s.url || s.title).join('; ');
    const row = [
      finding.type,
      finding.title,
      finding.content.slice(0, 500),
      finding.confidence,
      finding.relevanceScore.toFixed(2),
      finding.agentName,
      sources,
    ];
    csvLines.push(row.map(escapeCsvField).join(','));
  }

  const content = csvLines.join('\n');

  return {
    id: crypto.randomUUID(),
    sessionId,
    type: 'csv',
    title: 'All Research Findings',
    description: `${findings.length} findings from all agents`,
    mimeType: 'text/csv',
    fileName: `findings_${sessionId.slice(0, 8)}.csv`,
    contentText: content,
    sizeBytes: new TextEncoder().encode(content).length,
    createdAt: Date.now(),
  };
}

// =============================================================================
// EXECUTIVE REPORT
// =============================================================================

function generateExecutiveReport(sessionId: string, output: StrategyOutput): Artifact {
  const sections: string[] = [];

  // Header
  sections.push(`# ${output.recommendation.title}`);
  sections.push(`Generated: ${new Date().toISOString()}`);
  sections.push('');

  // Executive Summary
  sections.push('## Executive Summary');
  sections.push(output.recommendation.summary);
  sections.push(`**Confidence Level:** ${output.recommendation.confidence}%`);
  sections.push('');

  // Key Reasoning
  sections.push('## Key Reasoning');
  for (const reason of output.recommendation.reasoning) {
    sections.push(`- ${reason}`);
  }
  sections.push('');

  // Trade-offs
  sections.push('## Trade-offs');
  for (const tradeoff of output.recommendation.tradeoffs) {
    sections.push(`- ${tradeoff}`);
  }
  sections.push('');

  // Alternatives
  if (output.alternatives.length > 0) {
    sections.push('## Alternative Options');
    for (const alt of output.alternatives) {
      sections.push(`### ${alt.title} (${alt.confidence}% confidence)`);
      sections.push(alt.summary);
      sections.push(`*Why not top choice:* ${alt.whyNotTop}`);
      sections.push('');
    }
  }

  // Domain Analysis
  sections.push('## Detailed Analysis');
  for (const domain of output.analysis.byDomain) {
    sections.push(`### ${domain.domain}`);
    sections.push(domain.summary);

    if (domain.comparisonTable) {
      sections.push('');
      sections.push(`| ${domain.comparisonTable.headers.join(' | ')} |`);
      sections.push(`| ${domain.comparisonTable.headers.map(() => '---').join(' | ')} |`);
      for (const row of domain.comparisonTable.rows) {
        sections.push(`| ${row.option} | ${row.values.join(' | ')} |`);
      }
    }
    sections.push('');
  }

  // Risk Assessment
  sections.push('## Risk Assessment');
  sections.push(`**Overall Risk Level:** ${output.analysis.riskAssessment.overallRisk}`);
  for (const risk of output.analysis.riskAssessment.risks) {
    sections.push(
      `- **${risk.risk}** (Probability: ${risk.probability}, Impact: ${risk.impact})${risk.mitigation ? `\n  Mitigation: ${risk.mitigation}` : ''}`
    );
  }
  sections.push('');

  // Action Plan
  sections.push('## Action Plan');
  for (const item of output.actionPlan) {
    sections.push(
      `${item.order}. **${item.action}** [${item.priority}] — ${item.timeframe}${item.details ? `\n   ${item.details}` : ''}`
    );
  }
  sections.push('');

  // Gaps & Next Steps
  if (output.gaps.length > 0) {
    sections.push('## Information Gaps');
    for (const gap of output.gaps) {
      sections.push(`- ${gap}`);
    }
    sections.push('');
  }

  sections.push('## Next Steps');
  for (const step of output.nextSteps) {
    sections.push(`- ${step}`);
  }
  sections.push('');

  // Metadata
  sections.push('## Research Metadata');
  sections.push(`- Agents Deployed: ${output.metadata.totalAgents}`);
  sections.push(`- Searches Conducted: ${output.metadata.totalSearches}`);
  sections.push(`- Total Cost: $${output.metadata.totalCost.toFixed(2)}`);
  sections.push(`- Duration: ${Math.round(output.metadata.executionTime / 1000)}s`);
  sections.push(`- Quality Score: ${output.metadata.qualityScore}`);

  const content = sections.join('\n');

  return {
    id: crypto.randomUUID(),
    sessionId,
    type: 'report',
    title: 'Executive Report',
    description: `Full report: ${output.recommendation.title}`,
    mimeType: 'text/markdown',
    fileName: `report_${sessionId.slice(0, 8)}.md`,
    contentText: content,
    sizeBytes: new TextEncoder().encode(content).length,
    createdAt: Date.now(),
  };
}

// =============================================================================
// CHART GENERATION (via E2B Python)
// =============================================================================

async function generateChart(sessionId: string, output: StrategyOutput): Promise<Artifact | null> {
  // Only generate chart if we have enough data for it to be useful
  const hasAlternatives = output.alternatives.length >= 2;
  const hasDomains = output.analysis.byDomain.length >= 2;

  if (!hasAlternatives && !hasDomains) return null;

  // Build a confidence comparison chart
  const chartData: { label: string; value: number }[] = [];

  // Add main recommendation
  chartData.push({
    label: output.recommendation.title.slice(0, 30),
    value: output.recommendation.confidence,
  });

  // Add alternatives
  for (const alt of output.alternatives) {
    chartData.push({
      label: alt.title.slice(0, 30),
      value: alt.confidence,
    });
  }

  if (chartData.length < 2) return null;

  // Generate Python code for matplotlib chart
  const pythonCode = `
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import base64
import io

labels = ${JSON.stringify(chartData.map((d) => d.label))}
values = ${JSON.stringify(chartData.map((d) => d.value))}
colors = ['#10b981' if i == 0 else '#6366f1' for i in range(len(labels))]

fig, ax = plt.subplots(figsize=(10, 6))
bars = ax.barh(labels, values, color=colors, edgecolor='white', linewidth=0.5)

# Style
ax.set_xlim(0, 100)
ax.set_xlabel('Confidence Score (%)', fontsize=12, fontweight='bold')
ax.set_title('Options Comparison - Confidence Levels', fontsize=14, fontweight='bold', pad=20)
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

# Add value labels on bars
for bar, val in zip(bars, values):
    ax.text(bar.get_width() + 1, bar.get_y() + bar.get_height()/2,
            f'{val}%', va='center', fontsize=11, fontweight='bold')

plt.tight_layout()

# Save to buffer as base64
buf = io.BytesIO()
fig.savefig(buf, format='png', dpi=150, bbox_inches='tight', facecolor='white')
buf.seek(0)
img_base64 = base64.b64encode(buf.read()).decode('utf-8')
plt.close()

print(img_base64)
`;

  try {
    // Dynamic import to avoid issues when E2B is not available
    const { runCode } = await import('./tools/e2bCode');
    const result = await runCode({ language: 'python', code: pythonCode, timeout: 30000 });

    if (!result.success || !result.stdout) {
      log.warn('Chart generation failed', { error: result.error });
      return null;
    }

    const imageBase64 = result.stdout.trim();
    if (!imageBase64 || imageBase64.length < 100) {
      log.warn('Chart generation produced empty output');
      return null;
    }

    return {
      id: crypto.randomUUID(),
      sessionId,
      type: 'chart',
      title: 'Options Comparison Chart',
      description: 'Confidence levels across all options',
      mimeType: 'image/png',
      fileName: `chart_${sessionId.slice(0, 8)}.png`,
      contentBase64: imageBase64,
      sizeBytes: Math.round((imageBase64.length * 3) / 4), // Base64 to bytes estimate
      createdAt: Date.now(),
    };
  } catch (error) {
    log.warn('Chart generation failed (E2B unavailable)', { error });
    return null;
  }
}

// =============================================================================
// STORE & RETRIEVE
// =============================================================================

async function storeArtifact(userId: string, artifact: Artifact): Promise<void> {
  const supabase = getServiceClient();

  const { error } = await supabase.from('strategy_artifacts').insert({
    id: artifact.id,
    user_id: userId,
    session_id: artifact.sessionId,
    artifact_type: artifact.type,
    title: artifact.title,
    description: artifact.description,
    mime_type: artifact.mimeType,
    file_name: artifact.fileName,
    content_base64: artifact.contentBase64,
    content_text: artifact.contentText,
    size_bytes: artifact.sizeBytes,
  });

  if (error) {
    log.error('Failed to store artifact', {
      error: error.message,
      artifactId: artifact.id,
    });
  }
}

/**
 * Retrieve artifacts for a session.
 */
export async function getSessionArtifacts(sessionId: string): Promise<Artifact[]> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('strategy_artifacts')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    log.error('Failed to retrieve artifacts', { error: error.message });
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id as string,
    sessionId: row.session_id as string,
    type: row.artifact_type as ArtifactType,
    title: row.title as string,
    description: row.description as string | undefined,
    mimeType: row.mime_type as string,
    fileName: row.file_name as string,
    contentBase64: row.content_base64 as string | undefined,
    contentText: row.content_text as string | undefined,
    sizeBytes: row.size_bytes as number,
    createdAt: new Date(row.created_at as string).getTime(),
  }));
}

// =============================================================================
// HELPERS
// =============================================================================

function escapeCsvField(value: string): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
