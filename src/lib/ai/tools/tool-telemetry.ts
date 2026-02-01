/**
 * TOOL TELEMETRY & SELF-IMPROVEMENT (Enhancement #10)
 *
 * Logs tool execution results to identify failure patterns
 * and generate improvement suggestions.
 *
 * Features:
 * - Execution logging
 * - Failure pattern detection
 * - Success rate tracking
 * - Improvement suggestions
 * - Health dashboard data
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const log = logger('ToolTelemetry');

// ============================================================================
// TYPES
// ============================================================================

export interface ToolExecutionLog {
  id?: string;
  toolName: string;
  success: boolean;
  errorMessage?: string;
  errorType?: string;
  executionTimeMs: number;
  inputSummary?: string;
  outputSummary?: string;
  userId?: string;
  conversationId?: string;
  timestamp: Date;
}

export interface ToolHealthMetrics {
  toolName: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageExecutionTimeMs: number;
  commonErrors: Array<{
    errorType: string;
    count: number;
    percentage: number;
  }>;
  trend: 'improving' | 'stable' | 'degrading';
}

export interface ImprovementSuggestion {
  toolName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestion: string;
  evidence: string;
  potentialFix?: string;
}

// ============================================================================
// TELEMETRY SERVICE
// ============================================================================

class ToolTelemetryService {
  private supabase;
  private memoryLogs: ToolExecutionLog[] = [];
  private maxMemoryLogs = 1000;

  constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      log.warn('Supabase not configured for telemetry - using in-memory only');
      this.supabase = null;
    } else {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  /**
   * Log a tool execution
   */
  async logExecution(logEntry: Omit<ToolExecutionLog, 'id' | 'timestamp'>): Promise<void> {
    const entry: ToolExecutionLog = {
      ...logEntry,
      timestamp: new Date(),
    };

    // Always store in memory
    this.memoryLogs.push(entry);
    if (this.memoryLogs.length > this.maxMemoryLogs) {
      this.memoryLogs.shift();
    }

    // Try to persist to database
    if (this.supabase) {
      try {
        await this.supabase.from('tool_execution_logs').insert([{
          tool_name: entry.toolName,
          success: entry.success,
          error_message: entry.errorMessage,
          error_type: entry.errorType,
          execution_time_ms: entry.executionTimeMs,
          input_summary: entry.inputSummary,
          output_summary: entry.outputSummary,
          user_id: entry.userId,
          conversation_id: entry.conversationId,
          created_at: entry.timestamp.toISOString(),
        }]);
      } catch (error) {
        log.warn('Failed to persist execution log', { error: (error as Error).message });
      }
    }

    // Log failures for immediate attention
    if (!entry.success) {
      log.warn('Tool execution failed', {
        tool: entry.toolName,
        error: entry.errorMessage,
        type: entry.errorType,
      });
    }
  }

  /**
   * Get health metrics for a tool
   */
  async getToolHealth(toolName: string, days: number = 7): Promise<ToolHealthMetrics> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let logs: ToolExecutionLog[] = [];

    // Try database first
    if (this.supabase) {
      try {
        const { data } = await this.supabase
          .from('tool_execution_logs')
          .select('*')
          .eq('tool_name', toolName)
          .gte('created_at', cutoffDate.toISOString())
          .order('created_at', { ascending: false });

        if (data) {
          logs = data.map(d => ({
            toolName: d.tool_name,
            success: d.success,
            errorMessage: d.error_message,
            errorType: d.error_type,
            executionTimeMs: d.execution_time_ms,
            timestamp: new Date(d.created_at),
          }));
        }
      } catch {
        // Fall back to memory logs
      }
    }

    // Fall back to memory logs
    if (logs.length === 0) {
      logs = this.memoryLogs.filter(
        (l) => l.toolName === toolName && l.timestamp >= cutoffDate
      );
    }

    // Calculate metrics
    const totalExecutions = logs.length;
    const successCount = logs.filter((l) => l.success).length;
    const failureCount = totalExecutions - successCount;
    const successRate = totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 100;

    const totalTime = logs.reduce((sum, l) => sum + l.executionTimeMs, 0);
    const averageExecutionTimeMs = totalExecutions > 0 ? totalTime / totalExecutions : 0;

    // Group errors by type
    const errorCounts = new Map<string, number>();
    for (const log of logs.filter((l) => !l.success)) {
      const errorType = log.errorType || 'unknown';
      errorCounts.set(errorType, (errorCounts.get(errorType) || 0) + 1);
    }

    const commonErrors = Array.from(errorCounts.entries())
      .map(([errorType, count]) => ({
        errorType,
        count,
        percentage: failureCount > 0 ? (count / failureCount) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate trend (compare recent vs older)
    const midpoint = Math.floor(logs.length / 2);
    const recentLogs = logs.slice(0, midpoint);
    const olderLogs = logs.slice(midpoint);

    const recentSuccessRate = recentLogs.length > 0
      ? recentLogs.filter((l) => l.success).length / recentLogs.length
      : 1;
    const olderSuccessRate = olderLogs.length > 0
      ? olderLogs.filter((l) => l.success).length / olderLogs.length
      : 1;

    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (recentSuccessRate > olderSuccessRate + 0.05) trend = 'improving';
    if (recentSuccessRate < olderSuccessRate - 0.05) trend = 'degrading';

    return {
      toolName,
      totalExecutions,
      successCount,
      failureCount,
      successRate,
      averageExecutionTimeMs,
      commonErrors,
      trend,
    };
  }

  /**
   * Get health metrics for all tools
   */
  async getAllToolsHealth(days: number = 7): Promise<ToolHealthMetrics[]> {
    // Get unique tool names
    const toolNames = new Set<string>();

    if (this.supabase) {
      try {
        const { data } = await this.supabase
          .from('tool_execution_logs')
          .select('tool_name')
          .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

        for (const row of data || []) {
          toolNames.add(row.tool_name);
        }
      } catch {
        // Fall back to memory
      }
    }

    // Add tools from memory
    for (const log of this.memoryLogs) {
      toolNames.add(log.toolName);
    }

    // Get health for each tool
    const healthMetrics: ToolHealthMetrics[] = [];
    for (const toolName of toolNames) {
      const health = await this.getToolHealth(toolName, days);
      healthMetrics.push(health);
    }

    return healthMetrics.sort((a, b) => b.totalExecutions - a.totalExecutions);
  }

  /**
   * Generate improvement suggestions based on failure patterns
   */
  async generateSuggestions(days: number = 7): Promise<ImprovementSuggestion[]> {
    const allHealth = await this.getAllToolsHealth(days);
    const suggestions: ImprovementSuggestion[] = [];

    for (const health of allHealth) {
      // Critical: Very low success rate
      if (health.successRate < 50 && health.totalExecutions >= 5) {
        suggestions.push({
          toolName: health.toolName,
          severity: 'critical',
          suggestion: `${health.toolName} has a critically low success rate (${health.successRate.toFixed(1)}%)`,
          evidence: `${health.failureCount} failures out of ${health.totalExecutions} executions`,
          potentialFix: health.commonErrors[0]
            ? `Most common error: ${health.commonErrors[0].errorType}. Review error handling for this case.`
            : undefined,
        });
      }

      // High: Low success rate
      if (health.successRate >= 50 && health.successRate < 80 && health.totalExecutions >= 10) {
        suggestions.push({
          toolName: health.toolName,
          severity: 'high',
          suggestion: `${health.toolName} success rate (${health.successRate.toFixed(1)}%) is below target`,
          evidence: `${health.failureCount} failures, ${health.commonErrors.length} distinct error types`,
        });
      }

      // Medium: Degrading trend
      if (health.trend === 'degrading' && health.totalExecutions >= 20) {
        suggestions.push({
          toolName: health.toolName,
          severity: 'medium',
          suggestion: `${health.toolName} performance is degrading over time`,
          evidence: 'Recent executions showing lower success rate than earlier ones',
        });
      }

      // Medium: Slow execution
      if (health.averageExecutionTimeMs > 10000 && health.totalExecutions >= 5) {
        suggestions.push({
          toolName: health.toolName,
          severity: 'medium',
          suggestion: `${health.toolName} has slow average execution time (${(health.averageExecutionTimeMs / 1000).toFixed(1)}s)`,
          evidence: `Based on ${health.totalExecutions} executions`,
          potentialFix: 'Consider adding timeout handling or optimizing the tool implementation',
        });
      }

      // Low: Single error type dominates failures
      if (health.commonErrors[0]?.percentage > 70 && health.failureCount >= 3) {
        suggestions.push({
          toolName: health.toolName,
          severity: 'low',
          suggestion: `Most ${health.toolName} failures are "${health.commonErrors[0].errorType}"`,
          evidence: `${health.commonErrors[0].count} of ${health.failureCount} failures (${health.commonErrors[0].percentage.toFixed(0)}%)`,
          potentialFix: 'Targeted fix for this specific error could significantly improve reliability',
        });
      }
    }

    return suggestions.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Get summary statistics
   */
  async getSummary(days: number = 7): Promise<{
    totalExecutions: number;
    overallSuccessRate: number;
    totalTools: number;
    criticalTools: number;
    improvingSuggestions: number;
  }> {
    const allHealth = await this.getAllToolsHealth(days);
    const suggestions = await this.generateSuggestions(days);

    const totalExecutions = allHealth.reduce((sum, h) => sum + h.totalExecutions, 0);
    const totalSuccesses = allHealth.reduce((sum, h) => sum + h.successCount, 0);

    return {
      totalExecutions,
      overallSuccessRate: totalExecutions > 0 ? (totalSuccesses / totalExecutions) * 100 : 100,
      totalTools: allHealth.length,
      criticalTools: suggestions.filter((s) => s.severity === 'critical').length,
      improvingSuggestions: suggestions.length,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let telemetryInstance: ToolTelemetryService | null = null;

export function getToolTelemetry(): ToolTelemetryService {
  if (!telemetryInstance) {
    telemetryInstance = new ToolTelemetryService();
  }
  return telemetryInstance;
}

// ============================================================================
// CONVENIENCE WRAPPER FOR TOOL EXECUTION
// ============================================================================

/**
 * Wrap a tool executor with telemetry logging
 */
export function withTelemetry<T extends Record<string, unknown>>(
  toolName: string,
  executor: (args: T) => Promise<{ success: boolean; output: string }>,
  options?: {
    userId?: string;
    conversationId?: string;
  }
): (args: T) => Promise<{ success: boolean; output: string }> {
  return async (args: T) => {
    const startTime = Date.now();
    let result: { success: boolean; output: string };

    try {
      result = await executor(args);

      // Log execution
      await getToolTelemetry().logExecution({
        toolName,
        success: result.success,
        errorMessage: result.success ? undefined : result.output,
        errorType: result.success ? undefined : classifyError(result.output),
        executionTimeMs: Date.now() - startTime,
        inputSummary: summarizeInput(args),
        outputSummary: result.success ? summarizeOutput(result.output) : undefined,
        userId: options?.userId,
        conversationId: options?.conversationId,
      });

      return result;
    } catch (error) {
      const errorMessage = (error as Error).message;

      // Log failed execution
      await getToolTelemetry().logExecution({
        toolName,
        success: false,
        errorMessage,
        errorType: classifyError(errorMessage),
        executionTimeMs: Date.now() - startTime,
        inputSummary: summarizeInput(args),
        userId: options?.userId,
        conversationId: options?.conversationId,
      });

      throw error;
    }
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function classifyError(errorMessage: string): string {
  const message = errorMessage.toLowerCase();

  if (message.includes('timeout')) return 'timeout';
  if (message.includes('network') || message.includes('connection')) return 'network';
  if (message.includes('rate limit') || message.includes('429')) return 'rate_limit';
  if (message.includes('auth') || message.includes('401') || message.includes('403')) return 'authentication';
  if (message.includes('not found') || message.includes('404')) return 'not_found';
  if (message.includes('validation') || message.includes('invalid')) return 'validation';
  if (message.includes('parse') || message.includes('json')) return 'parsing';
  if (message.includes('api') || message.includes('external')) return 'external_api';

  return 'unknown';
}

function summarizeInput(args: Record<string, unknown>): string {
  const keys = Object.keys(args);
  if (keys.length === 0) return '(no args)';

  return keys.slice(0, 5).map((k) => {
    const v = args[k];
    if (typeof v === 'string') return `${k}: ${v.slice(0, 30)}...`;
    return `${k}: ${typeof v}`;
  }).join(', ');
}

function summarizeOutput(output: string): string {
  if (!output) return '(empty)';
  return output.slice(0, 100) + (output.length > 100 ? '...' : '');
}

// Export main functions
export const logToolExecution = (log: Omit<ToolExecutionLog, 'id' | 'timestamp'>) =>
  getToolTelemetry().logExecution(log);

export const getToolHealth = (toolName: string, days?: number) =>
  getToolTelemetry().getToolHealth(toolName, days);

export const getAllToolsHealth = (days?: number) =>
  getToolTelemetry().getAllToolsHealth(days);

export const getImprovementSuggestions = (days?: number) =>
  getToolTelemetry().generateSuggestions(days);

export const getToolTelemetrySummary = (days?: number) =>
  getToolTelemetry().getSummary(days);
