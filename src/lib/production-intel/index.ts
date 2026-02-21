/**
 * PRODUCTION INTELLIGENCE
 *
 * The AI doesn't just help you write code - it watches your code
 * in PRODUCTION and tells you when things break before users complain.
 *
 * It connects to your error tracking, analytics, and logs to:
 * - Detect issues in real-time
 * - Correlate errors with recent deployments
 * - Suggest fixes based on production context
 * - Predict potential issues before they happen
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export interface ProductionError {
  id: string;
  message: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  timestamp: Date;
  count: number;
  affectedUsers: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  firstSeen: Date;
  lastSeen: Date;
  metadata?: Record<string, unknown>;
}

export interface Deployment {
  id: string;
  commit: string;
  branch: string;
  author: string;
  message: string;
  timestamp: Date;
  changedFiles: string[];
  status: 'success' | 'failed' | 'rolled_back';
}

export interface ProductionMetric {
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  anomaly?: boolean;
}

export interface ProductionInsight {
  type: 'error_spike' | 'regression' | 'performance' | 'anomaly' | 'prediction';
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  affectedArea: string;
  suggestedFix?: string;
  relatedDeployment?: Deployment;
  relatedErrors?: ProductionError[];
  confidence: number;
}

export interface ProductionContext {
  errors: ProductionError[];
  deployments: Deployment[];
  metrics: ProductionMetric[];
  timeRange: {
    start: Date;
    end: Date;
  };
}

/**
 * Production Intelligence System
 */
export class ProductionIntelligence {
  /**
   * Analyze production state and generate insights
   */
  async analyzeProduction(context: ProductionContext): Promise<ProductionInsight[]> {
    const insights: ProductionInsight[] = [];

    // 1. Check for error spikes
    const errorSpikes = this.detectErrorSpikes(context.errors);
    insights.push(...errorSpikes);

    // 2. Correlate errors with deployments
    const regressions = await this.detectRegressions(context.errors, context.deployments);
    insights.push(...regressions);

    // 3. Analyze performance metrics
    const performanceIssues = this.analyzePerformance(context.metrics);
    insights.push(...performanceIssues);

    // 4. Generate AI-powered predictions
    const predictions = await this.generatePredictions(context);
    insights.push(...predictions);

    return insights.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Detect sudden spikes in error rates
   */
  private detectErrorSpikes(errors: ProductionError[]): ProductionInsight[] {
    const insights: ProductionInsight[] = [];

    // Group errors by hour
    const hourlyErrors = new Map<string, ProductionError[]>();
    errors.forEach((error) => {
      const hour = new Date(error.timestamp).toISOString().slice(0, 13);
      if (!hourlyErrors.has(hour)) hourlyErrors.set(hour, []);
      hourlyErrors.get(hour)!.push(error);
    });

    // Calculate average and detect spikes
    const counts = Array.from(hourlyErrors.values()).map((e) =>
      e.reduce((sum, err) => sum + err.count, 0)
    );
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length || 0;
    const latest = counts[counts.length - 1] || 0;

    if (latest > avg * 2 && latest > 10) {
      insights.push({
        type: 'error_spike',
        title: 'Error Spike Detected',
        description: `Error rate is ${(latest / avg).toFixed(1)}x higher than average (${latest} vs avg ${avg.toFixed(0)})`,
        severity: latest > avg * 5 ? 'critical' : 'high',
        affectedArea: 'production',
        confidence: 0.9,
        relatedErrors: errors.slice(0, 5),
      });
    }

    return insights;
  }

  /**
   * Correlate errors with recent deployments
   */
  private async detectRegressions(
    errors: ProductionError[],
    deployments: Deployment[]
  ): Promise<ProductionInsight[]> {
    const insights: ProductionInsight[] = [];

    // Find errors that started after a deployment
    for (const deployment of deployments.slice(0, 5)) {
      const errorsAfterDeploy = errors.filter(
        (e) => e.firstSeen >= deployment.timestamp && e.count > 5
      );

      if (errorsAfterDeploy.length > 0) {
        // Use AI to correlate
        const correlation = await this.correlateErrorsWithDeployment(errorsAfterDeploy, deployment);

        if (correlation) {
          insights.push(correlation);
        }
      }
    }

    return insights;
  }

  /**
   * AI-powered correlation of errors with deployments
   */
  private async correlateErrorsWithDeployment(
    errors: ProductionError[],
    deployment: Deployment
  ): Promise<ProductionInsight | null> {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Analyze if these production errors might be caused by this deployment:

## Deployment
- Commit: ${deployment.commit}
- Message: ${deployment.message}
- Changed Files: ${deployment.changedFiles.slice(0, 10).join(', ')}
- Time: ${deployment.timestamp.toISOString()}

## Errors (started after deployment)
${errors
  .slice(0, 5)
  .map((e) => `- ${e.message} (${e.count} occurrences, ${e.affectedUsers} users)`)
  .join('\n')}

Is there likely a correlation? Return JSON:
{
  "correlation": true/false,
  "confidence": 0-1,
  "explanation": "why",
  "suggestedFix": "if applicable",
  "affectedArea": "component or area affected"
}`,
        },
      ],
    });

    let content = '';
    for (const block of response.content) {
      if (block.type === 'text') content += block.text;
    }

    try {
      const analysis = JSON.parse(content.replace(/```json?\s*/g, '').replace(/```/g, ''));

      if (analysis.correlation && analysis.confidence > 0.6) {
        return {
          type: 'regression',
          title: `Regression: ${errors[0].message.slice(0, 50)}`,
          description: analysis.explanation,
          severity: errors.reduce((sum, e) => sum + e.count, 0) > 100 ? 'critical' : 'high',
          affectedArea: analysis.affectedArea,
          suggestedFix: analysis.suggestedFix,
          relatedDeployment: deployment,
          relatedErrors: errors,
          confidence: analysis.confidence,
        };
      }
    } catch {
      // Ignore parse errors
    }

    return null;
  }

  /**
   * Analyze performance metrics for issues
   */
  private analyzePerformance(metrics: ProductionMetric[]): ProductionInsight[] {
    const insights: ProductionInsight[] = [];

    for (const metric of metrics) {
      if (metric.anomaly) {
        let severity: 'critical' | 'high' | 'medium' | 'low' = 'medium';

        if (metric.name.includes('error') || metric.name.includes('latency')) {
          severity = metric.trend === 'up' ? 'high' : 'medium';
        }

        if (metric.name.includes('p99') && metric.value > 1000) {
          severity = 'critical';
        }

        insights.push({
          type: 'performance',
          title: `${metric.name} Anomaly`,
          description: `${metric.name} is ${metric.value}${metric.unit} (${metric.trend})`,
          severity,
          affectedArea: 'performance',
          confidence: 0.8,
        });
      }
    }

    return insights;
  }

  /**
   * Generate predictive insights using AI
   */
  private async generatePredictions(context: ProductionContext): Promise<ProductionInsight[]> {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `Based on this production data, predict potential issues:

## Recent Errors (${context.errors.length} total)
${context.errors
  .slice(0, 10)
  .map((e) => `- ${e.message} (${e.count}x, ${e.affectedUsers} users, severity: ${e.severity})`)
  .join('\n')}

## Recent Deployments
${context.deployments
  .slice(0, 5)
  .map((d) => `- ${d.timestamp.toISOString()}: ${d.message} by ${d.author}`)
  .join('\n')}

## Metrics
${context.metrics.map((m) => `- ${m.name}: ${m.value}${m.unit} (${m.trend}${m.anomaly ? ' ⚠️' : ''})`).join('\n')}

Predict:
1. What issues might occur next?
2. What areas need attention?
3. What preventive actions should be taken?

Return JSON array:
[{
  "type": "prediction",
  "title": "",
  "description": "",
  "severity": "critical|high|medium|low",
  "affectedArea": "",
  "suggestedFix": "",
  "confidence": 0-1
}]`,
        },
      ],
    });

    let content = '';
    for (const block of response.content) {
      if (block.type === 'text') content += block.text;
    }

    try {
      const predictions = JSON.parse(content.replace(/```json?\s*/g, '').replace(/```/g, ''));
      return Array.isArray(predictions)
        ? predictions.filter((p: ProductionInsight) => p.confidence > 0.5)
        : [];
    } catch {
      return [];
    }
  }

  /**
   * Generate a fix for a production error
   */
  async generateProductionFix(
    error: ProductionError,
    codeContext?: string
  ): Promise<{
    diagnosis: string;
    fix: string;
    testing: string;
    rollbackPlan: string;
  }> {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `Generate a production-ready fix for this error:

## Error
\`\`\`
${error.message}
${error.stack || ''}
\`\`\`

- Affected Users: ${error.affectedUsers}
- Occurrences: ${error.count}
- First Seen: ${error.firstSeen.toISOString()}
${error.url ? `- URL: ${error.url}` : ''}

${codeContext ? `## Code Context\n\`\`\`\n${codeContext}\n\`\`\`` : ''}

Provide:
1. Diagnosis - root cause
2. Fix - exact code change
3. Testing - how to verify
4. Rollback plan - if fix fails

Return JSON:
{
  "diagnosis": "",
  "fix": "code",
  "testing": "",
  "rollbackPlan": ""
}`,
        },
      ],
    });

    let content = '';
    for (const block of response.content) {
      if (block.type === 'text') content += block.text;
    }

    try {
      return JSON.parse(content.replace(/```json?\s*/g, '').replace(/```/g, ''));
    } catch {
      return {
        diagnosis: 'Unable to diagnose',
        fix: '',
        testing: '',
        rollbackPlan: 'Revert to previous deployment',
      };
    }
  }

  /**
   * Create a production health report
   */
  async generateHealthReport(context: ProductionContext): Promise<string> {
    const insights = await this.analyzeProduction(context);

    let report = `# Production Health Report\n\n`;
    report += `**Generated:** ${new Date().toISOString()}\n`;
    report += `**Period:** ${context.timeRange.start.toISOString()} to ${context.timeRange.end.toISOString()}\n\n`;

    // Summary
    const critical = insights.filter((i) => i.severity === 'critical').length;
    const high = insights.filter((i) => i.severity === 'high').length;

    report += `## Summary\n\n`;
    report += `- 🔴 Critical Issues: ${critical}\n`;
    report += `- 🟠 High Priority: ${high}\n`;
    report += `- Total Errors: ${context.errors.reduce((sum, e) => sum + e.count, 0)}\n`;
    report += `- Affected Users: ${new Set(context.errors.flatMap((e) => [e.affectedUsers])).size}\n`;
    report += `- Deployments: ${context.deployments.length}\n\n`;

    // Insights
    if (insights.length > 0) {
      report += `## Issues & Insights\n\n`;
      for (const insight of insights) {
        const emoji = {
          critical: '🔴',
          high: '🟠',
          medium: '🟡',
          low: '🟢',
        }[insight.severity];

        report += `### ${emoji} ${insight.title}\n`;
        report += `**Type:** ${insight.type} | **Confidence:** ${(insight.confidence * 100).toFixed(0)}%\n\n`;
        report += `${insight.description}\n\n`;

        if (insight.suggestedFix) {
          report += `**Suggested Fix:**\n\`\`\`\n${insight.suggestedFix}\n\`\`\`\n\n`;
        }

        if (insight.relatedDeployment) {
          report += `**Related Deployment:** ${insight.relatedDeployment.message} by ${insight.relatedDeployment.author}\n\n`;
        }
      }
    }

    // Metrics
    report += `## Metrics\n\n`;
    report += `| Metric | Value | Trend | Status |\n`;
    report += `|--------|-------|-------|--------|\n`;
    for (const metric of context.metrics) {
      const status = metric.anomaly ? '⚠️ Anomaly' : '✅ Normal';
      report += `| ${metric.name} | ${metric.value}${metric.unit} | ${metric.trend} | ${status} |\n`;
    }

    return report;
  }
}

// Singleton
let prodIntelInstance: ProductionIntelligence | null = null;

export function getProductionIntelligence(): ProductionIntelligence {
  if (!prodIntelInstance) {
    prodIntelInstance = new ProductionIntelligence();
  }
  return prodIntelInstance;
}
