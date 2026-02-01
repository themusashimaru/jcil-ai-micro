/**
 * SQL OPTIMIZER TOOL
 * Optimize SQL queries and analyze execution plans
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface SqlIssue {
  severity: 'high' | 'medium' | 'low';
  issue: string;
  description: string;
  suggestion: string;
  location?: string;
}

function analyzeSqlQuery(sql: string): SqlIssue[] {
  const issues: SqlIssue[] = [];
  const upperSql = sql.toUpperCase();

  // SELECT *
  if (upperSql.includes('SELECT *')) {
    issues.push({
      severity: 'medium',
      issue: 'SELECT_STAR',
      description: 'SELECT * returns all columns, increasing I/O',
      suggestion: 'Specify only needed columns: SELECT col1, col2 FROM table'
    });
  }

  // Missing WHERE clause with DELETE/UPDATE
  if ((upperSql.includes('DELETE FROM') || upperSql.includes('UPDATE ')) &&
      !upperSql.includes('WHERE')) {
    issues.push({
      severity: 'high',
      issue: 'MISSING_WHERE',
      description: 'DELETE/UPDATE without WHERE affects all rows',
      suggestion: 'Add WHERE clause to limit affected rows'
    });
  }

  // NOT IN with subquery
  if (upperSql.match(/NOT\s+IN\s*\(\s*SELECT/)) {
    issues.push({
      severity: 'medium',
      issue: 'NOT_IN_SUBQUERY',
      description: 'NOT IN with subquery can be slow with NULLs',
      suggestion: 'Use NOT EXISTS or LEFT JOIN ... IS NULL instead'
    });
  }

  // LIKE with leading wildcard
  if (upperSql.match(/LIKE\s+['"]%/)) {
    issues.push({
      severity: 'high',
      issue: 'LEADING_WILDCARD',
      description: 'LIKE with leading % prevents index usage',
      suggestion: 'Consider full-text search or restructure query'
    });
  }

  // OR in WHERE (can prevent index usage)
  if (upperSql.match(/WHERE.*\sOR\s/)) {
    issues.push({
      severity: 'low',
      issue: 'OR_CLAUSE',
      description: 'OR in WHERE may prevent index usage',
      suggestion: 'Consider UNION ALL for separate index scans'
    });
  }

  // Implicit type conversion
  if (sql.match(/=\s*['"][0-9]+['"]/)) {
    issues.push({
      severity: 'medium',
      issue: 'IMPLICIT_CONVERSION',
      description: 'String compared to what may be numeric column',
      suggestion: 'Use proper types: WHERE id = 123 instead of id = "123"'
    });
  }

  // Missing index hints for complex joins
  const joinCount = (upperSql.match(/\bJOIN\b/g) || []).length;
  if (joinCount > 3) {
    issues.push({
      severity: 'low',
      issue: 'COMPLEX_JOIN',
      description: `${joinCount} JOINs detected - optimizer may choose suboptimal plan`,
      suggestion: 'Consider query hints or breaking into smaller queries'
    });
  }

  // Correlated subquery
  if (upperSql.match(/WHERE.*\(\s*SELECT.*WHERE.*=.*\.\w+\)/s)) {
    issues.push({
      severity: 'high',
      issue: 'CORRELATED_SUBQUERY',
      description: 'Correlated subquery executes for each row',
      suggestion: 'Rewrite as JOIN or use window functions'
    });
  }

  // DISTINCT with large result sets
  if (upperSql.includes('DISTINCT') && joinCount > 0) {
    issues.push({
      severity: 'medium',
      issue: 'DISTINCT_ABUSE',
      description: 'DISTINCT may indicate duplicate row issue from JOINs',
      suggestion: 'Review JOIN conditions; DISTINCT is expensive'
    });
  }

  // ORDER BY without LIMIT
  if (upperSql.includes('ORDER BY') && !upperSql.includes('LIMIT') && !upperSql.includes('TOP')) {
    issues.push({
      severity: 'low',
      issue: 'ORDER_WITHOUT_LIMIT',
      description: 'ORDER BY without LIMIT sorts entire result set',
      suggestion: 'Add LIMIT for pagination: ORDER BY col LIMIT 100'
    });
  }

  // Functions on indexed columns in WHERE
  if (upperSql.match(/WHERE\s+\w+\s*\([^)]+\)\s*=/)) {
    issues.push({
      severity: 'high',
      issue: 'FUNCTION_ON_INDEX',
      description: 'Function on column prevents index usage',
      suggestion: 'Move function to other side: WHERE col = FUNC(value)'
    });
  }

  return issues;
}

function optimizeSqlQuery(sql: string): Record<string, unknown> {
  let optimized = sql;
  const changes: string[] = [];

  // Replace SELECT * (if we can detect column context)
  if (sql.toUpperCase().includes('SELECT *')) {
    changes.push('Replace SELECT * with specific columns');
  }

  // Replace NOT IN with NOT EXISTS template
  if (sql.toUpperCase().match(/NOT\s+IN\s*\(\s*SELECT/)) {
    changes.push('Consider replacing NOT IN with NOT EXISTS');
    // Template for NOT EXISTS
    optimized = optimized.replace(
      /(\w+)\s+NOT\s+IN\s*\(\s*SELECT\s+(\w+)\s+FROM\s+(\w+)\s+WHERE\s+([^)]+)\)/gi,
      'NOT EXISTS (SELECT 1 FROM $3 WHERE $4 AND $3.$2 = $1)'
    );
  }

  // Add LIMIT if ORDER BY without LIMIT
  if (sql.toUpperCase().includes('ORDER BY') &&
      !sql.toUpperCase().includes('LIMIT') &&
      !sql.toUpperCase().includes('TOP')) {
    optimized = optimized.replace(/;?\s*$/, ' LIMIT 1000;');
    changes.push('Added LIMIT 1000 to prevent unbounded result');
  }

  return {
    original: sql,
    optimized,
    changes,
    changeCount: changes.length
  };
}

function suggestIndexes(sql: string): Record<string, unknown> {
  const suggestions: Array<{ table: string; columns: string[]; type: string; reason: string }> = [];

  // Extract WHERE conditions
  const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER|GROUP|LIMIT|HAVING|$)/is);
  if (whereMatch) {
    const conditions = whereMatch[1];

    // Find equality conditions
    const equalities = conditions.matchAll(/(\w+)\.?(\w+)?\s*=\s*(?:\?|[@:]\w+|'[^']+'|\d+)/g);
    for (const match of equalities) {
      const col = match[2] || match[1];
      const table = match[2] ? match[1] : 'unknown';
      suggestions.push({
        table,
        columns: [col],
        type: 'B-TREE',
        reason: 'Equality condition in WHERE'
      });
    }

    // Find range conditions
    const ranges = conditions.matchAll(/(\w+)\.?(\w+)?\s*(?:>|<|>=|<=|BETWEEN)/g);
    for (const match of ranges) {
      const col = match[2] || match[1];
      const table = match[2] ? match[1] : 'unknown';
      suggestions.push({
        table,
        columns: [col],
        type: 'B-TREE',
        reason: 'Range condition in WHERE'
      });
    }
  }

  // Extract ORDER BY columns
  const orderMatch = sql.match(/ORDER\s+BY\s+(.+?)(?:LIMIT|$)/is);
  if (orderMatch) {
    const orderCols = orderMatch[1].split(',').map(c => c.trim().split(/\s+/)[0]);
    suggestions.push({
      table: 'unknown',
      columns: orderCols.map(c => c.replace(/^\w+\./, '')),
      type: 'B-TREE',
      reason: 'ORDER BY optimization'
    });
  }

  // Extract JOIN conditions
  const joinMatches = sql.matchAll(/JOIN\s+(\w+)\s+\w*\s*ON\s+(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/gi);
  for (const match of joinMatches) {
    suggestions.push({
      table: match[1],
      columns: [match[5]],
      type: 'B-TREE',
      reason: 'JOIN condition'
    });
  }

  // Deduplicate
  const unique = suggestions.reduce((acc, s) => {
    const key = `${s.table}.${s.columns.join(',')}`;
    if (!acc.has(key)) acc.set(key, s);
    return acc;
  }, new Map());

  return {
    suggestions: Array.from(unique.values()),
    ddl: Array.from(unique.values()).map(s =>
      `CREATE INDEX idx_${s.table}_${s.columns.join('_')} ON ${s.table}(${s.columns.join(', ')});`
    )
  };
}

function explainPlan(sql: string): Record<string, unknown> {
  // Simulated explain plan (in real impl, would execute EXPLAIN)
  const hasJoin = sql.toUpperCase().includes('JOIN');
  const hasSubquery = sql.includes('(SELECT');
  const hasOrderBy = sql.toUpperCase().includes('ORDER BY');
  const hasGroupBy = sql.toUpperCase().includes('GROUP BY');

  const steps = [];

  if (hasSubquery) {
    steps.push({ operation: 'SUBQUERY', cost: 'HIGH', note: 'Subquery executed' });
  }

  if (hasJoin) {
    const joinCount = (sql.toUpperCase().match(/JOIN/g) || []).length;
    steps.push({
      operation: joinCount > 2 ? 'NESTED_LOOPS' : 'HASH_JOIN',
      cost: joinCount > 2 ? 'HIGH' : 'MEDIUM',
      note: `${joinCount} table(s) joined`
    });
  }

  steps.push({
    operation: sql.toUpperCase().includes('INDEX') ? 'INDEX_SCAN' : 'TABLE_SCAN',
    cost: sql.toUpperCase().includes('INDEX') ? 'LOW' : 'HIGH',
    note: 'Data access method'
  });

  if (hasGroupBy) {
    steps.push({ operation: 'AGGREGATION', cost: 'MEDIUM', note: 'GROUP BY processing' });
  }

  if (hasOrderBy) {
    steps.push({ operation: 'SORT', cost: 'MEDIUM', note: 'ORDER BY processing' });
  }

  const totalCost = steps.filter(s => s.cost === 'HIGH').length * 100 +
                   steps.filter(s => s.cost === 'MEDIUM').length * 10 +
                   steps.filter(s => s.cost === 'LOW').length;

  return {
    executionPlan: steps,
    estimatedCost: totalCost,
    recommendation: totalCost > 100
      ? 'Consider adding indexes or rewriting query'
      : 'Query plan looks reasonable'
  };
}

function rewriteQuery(sql: string, style: 'cte' | 'subquery' | 'join'): string {
  // Simple rewrite examples
  if (style === 'cte') {
    return `WITH base AS (
  ${sql.replace(/;$/, '')}
)
SELECT * FROM base;`;
  }

  return sql;
}

export const sqlOptimizerTool: UnifiedTool = {
  name: 'sql_optimizer',
  description: 'SQL Optimizer: analyze, optimize, suggest_indexes, explain_plan, rewrite',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['analyze', 'optimize', 'suggest_indexes', 'explain_plan', 'rewrite'] },
      sql: { type: 'string', description: 'SQL query to analyze' },
      style: { type: 'string', enum: ['cte', 'subquery', 'join'] }
    },
    required: ['operation']
  },
};

export async function executeSqlOptimizer(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const sampleSql = args.sql || `SELECT * FROM users u
JOIN orders o ON u.id = o.user_id
WHERE o.status NOT IN (SELECT status FROM excluded_statuses)
AND u.name LIKE '%john%'
ORDER BY o.created_at`;

    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'analyze':
        result = { issues: analyzeSqlQuery(sampleSql) };
        break;
      case 'optimize':
        result = optimizeSqlQuery(sampleSql);
        break;
      case 'suggest_indexes':
        result = suggestIndexes(sampleSql);
        break;
      case 'explain_plan':
        result = explainPlan(sampleSql);
        break;
      case 'rewrite':
        result = { rewritten: rewriteQuery(sampleSql, args.style || 'cte') };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isSqlOptimizerAvailable(): boolean { return true; }
