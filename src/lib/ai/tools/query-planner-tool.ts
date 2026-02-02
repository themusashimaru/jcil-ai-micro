/**
 * QUERY-PLANNER TOOL
 * SQL query execution planner with cost-based optimization
 * Supports parsing, optimization, plan generation, and explain visualization
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES
// ============================================================================

type SQLOperator = '=' | '<>' | '!=' | '<' | '>' | '<=' | '>=' | 'LIKE' | 'IN' | 'BETWEEN' | 'IS NULL' | 'IS NOT NULL';
type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL' | 'CROSS';
type AggregateFunction = 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
type SortOrder = 'ASC' | 'DESC';

interface Column {
  name: string;
  type: 'INT' | 'VARCHAR' | 'DATE' | 'FLOAT' | 'BOOLEAN';
  nullable: boolean;
  primaryKey?: boolean;
  foreignKey?: { table: string; column: string };
}

interface TableSchema {
  name: string;
  columns: Column[];
  rowCount: number;
  avgRowSize: number;
}

interface IndexMetadata {
  name: string;
  table: string;
  columns: string[];
  unique: boolean;
  clustered: boolean;
  cardinality: number;
  leafPages: number;
  height: number;
}

interface TableStatistics {
  tableName: string;
  rowCount: number;
  columnStats: Map<string, ColumnStatistics>;
  lastAnalyzed: Date;
}

interface ColumnStatistics {
  columnName: string;
  distinctValues: number;
  nullCount: number;
  minValue: unknown;
  maxValue: unknown;
  histogram?: HistogramBucket[];
}

interface HistogramBucket {
  lowerBound: unknown;
  upperBound: unknown;
  frequency: number;
  distinctCount: number;
}

interface Predicate {
  column: string;
  operator: SQLOperator;
  value: unknown;
  table?: string;
}

interface JoinCondition {
  leftTable: string;
  leftColumn: string;
  rightTable: string;
  rightColumn: string;
  type: JoinType;
}

interface SelectColumn {
  column: string;
  table?: string;
  alias?: string;
  aggregate?: AggregateFunction;
}

interface OrderByClause {
  column: string;
  table?: string;
  order: SortOrder;
}

interface ParsedQuery {
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  tables: string[];
  columns: SelectColumn[];
  predicates: Predicate[];
  joins: JoinCondition[];
  groupBy: string[];
  having: Predicate[];
  orderBy: OrderByClause[];
  limit?: number;
  offset?: number;
  distinct: boolean;
  insertValues?: Record<string, unknown>[];
  updateValues?: Record<string, unknown>;
}

type PlanNodeType = 'SeqScan' | 'IndexScan' | 'IndexOnlyScan' | 'BitmapScan' |
  'NestedLoop' | 'HashJoin' | 'MergeJoin' | 'Filter' | 'Sort' | 'Aggregate' |
  'GroupAggregate' | 'HashAggregate' | 'Limit' | 'Offset' | 'Project' |
  'Unique' | 'Materialize' | 'Result' | 'Insert' | 'Update' | 'Delete';

interface PlanNode {
  id: number;
  type: PlanNodeType;
  table?: string;
  index?: string;
  columns?: string[];
  predicate?: string;
  joinType?: JoinType;
  sortKeys?: string[];
  aggregates?: string[];
  estimatedRows: number;
  estimatedCost: number;
  startupCost: number;
  totalCost: number;
  width: number;
  children: PlanNode[];
  properties: Record<string, unknown>;
}

interface QueryPlan {
  root: PlanNode;
  totalCost: number;
  estimatedRows: number;
  estimatedTime: number;
  planningTime: number;
  optimizations: string[];
  warnings: string[];
}

interface CostModel {
  seqPageCost: number;
  randomPageCost: number;
  cpuTupleCost: number;
  cpuIndexTupleCost: number;
  cpuOperatorCost: number;
  effectiveCacheSize: number;
  workMem: number;
}

// ============================================================================
// COST MODEL
// ============================================================================

const DEFAULT_COST_MODEL: CostModel = {
  seqPageCost: 1.0,
  randomPageCost: 4.0,
  cpuTupleCost: 0.01,
  cpuIndexTupleCost: 0.005,
  cpuOperatorCost: 0.0025,
  effectiveCacheSize: 16384,
  workMem: 512
};

const PAGE_SIZE = 8192;

// ============================================================================
// CATALOG
// ============================================================================

class Catalog {
  private schemas: Map<string, TableSchema> = new Map();
  private indexes: Map<string, IndexMetadata[]> = new Map();
  private statistics: Map<string, TableStatistics> = new Map();

  addTable(schema: TableSchema): void {
    this.schemas.set(schema.name.toLowerCase(), schema);
    this.indexes.set(schema.name.toLowerCase(), []);
  }

  addIndex(index: IndexMetadata): void {
    const tableName = index.table.toLowerCase();
    const tableIndexes = this.indexes.get(tableName) || [];
    tableIndexes.push(index);
    this.indexes.set(tableName, tableIndexes);
  }

  getTable(name: string): TableSchema | undefined {
    return this.schemas.get(name.toLowerCase());
  }

  getIndexes(tableName: string): IndexMetadata[] {
    return this.indexes.get(tableName.toLowerCase()) || [];
  }

  getStatistics(tableName: string): TableStatistics | undefined {
    return this.statistics.get(tableName.toLowerCase());
  }

  setStatistics(stats: TableStatistics): void {
    this.statistics.set(stats.tableName.toLowerCase(), stats);
  }

  getAllTables(): TableSchema[] {
    return Array.from(this.schemas.values());
  }

  getAllIndexes(): IndexMetadata[] {
    const result: IndexMetadata[] = [];
    for (const indexes of this.indexes.values()) {
      result.push(...indexes);
    }
    return result;
  }
}

// ============================================================================
// SQL PARSER
// ============================================================================

class SQLParser {
  private tokens: string[] = [];
  private position = 0;

  parse(sql: string): ParsedQuery {
    this.tokenize(sql);
    this.position = 0;

    const firstToken = this.peek()?.toUpperCase();

    switch (firstToken) {
      case 'SELECT':
        return this.parseSelect();
      case 'INSERT':
        return this.parseInsert();
      case 'UPDATE':
        return this.parseUpdate();
      case 'DELETE':
        return this.parseDelete();
      default:
        throw new Error(`Unsupported query type: ${firstToken}`);
    }
  }

  private tokenize(sql: string): void {
    const regex = /('[^']*'|"[^"]*"|\w+\.?\w*|\*|[<>=!]+|,|\(|\)|;)/g;
    this.tokens = [];
    let match;
    while ((match = regex.exec(sql)) !== null) {
      this.tokens.push(match[0]);
    }
  }

  private peek(): string | undefined {
    return this.tokens[this.position];
  }

  private consume(): string {
    return this.tokens[this.position++];
  }

  private expect(expected: string): void {
    const token = this.consume();
    if (token?.toUpperCase() !== expected.toUpperCase()) {
      throw new Error(`Expected ${expected}, got ${token}`);
    }
  }

  private parseSelect(): ParsedQuery {
    this.expect('SELECT');

    const distinct = this.peek()?.toUpperCase() === 'DISTINCT';
    if (distinct) this.consume();

    const columns = this.parseSelectColumns();

    this.expect('FROM');
    const tables: string[] = [];
    const joins: JoinCondition[] = [];

    tables.push(this.parseTableName());

    while (this.isJoinKeyword()) {
      joins.push(this.parseJoin(tables[0]));
    }

    const predicates: Predicate[] = [];
    if (this.peek()?.toUpperCase() === 'WHERE') {
      this.consume();
      this.parsePredicates(predicates);
    }

    const groupBy: string[] = [];
    if (this.peek()?.toUpperCase() === 'GROUP') {
      this.consume();
      this.expect('BY');
      this.parseGroupBy(groupBy);
    }

    const having: Predicate[] = [];
    if (this.peek()?.toUpperCase() === 'HAVING') {
      this.consume();
      this.parsePredicates(having);
    }

    const orderBy: OrderByClause[] = [];
    if (this.peek()?.toUpperCase() === 'ORDER') {
      this.consume();
      this.expect('BY');
      this.parseOrderBy(orderBy);
    }

    let limit: number | undefined;
    if (this.peek()?.toUpperCase() === 'LIMIT') {
      this.consume();
      limit = parseInt(this.consume());
    }

    let offset: number | undefined;
    if (this.peek()?.toUpperCase() === 'OFFSET') {
      this.consume();
      offset = parseInt(this.consume());
    }

    return {
      type: 'SELECT',
      tables,
      columns,
      predicates,
      joins,
      groupBy,
      having,
      orderBy,
      limit,
      offset,
      distinct
    };
  }

  private parseSelectColumns(): SelectColumn[] {
    const columns: SelectColumn[] = [];

    do {
      if (this.peek() === ',') this.consume();

      let aggregate: AggregateFunction | undefined;
      const token = this.peek();

      if (['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'].includes(token?.toUpperCase() || '')) {
        aggregate = this.consume().toUpperCase() as AggregateFunction;
        this.expect('(');
      }

      const colToken = this.consume();
      let table: string | undefined;
      let column: string;

      if (colToken?.includes('.')) {
        [table, column] = colToken.split('.');
      } else {
        column = colToken || '*';
      }

      if (aggregate) {
        this.expect(')');
      }

      let alias: string | undefined;
      if (this.peek()?.toUpperCase() === 'AS') {
        this.consume();
        alias = this.consume();
      }

      columns.push({ column, table, alias, aggregate });

    } while (this.peek() === ',');

    return columns;
  }

  private parseTableName(): string {
    const name = this.consume();
    if (this.peek()?.toUpperCase() !== 'WHERE' &&
        this.peek()?.toUpperCase() !== 'JOIN' &&
        !this.isJoinKeyword() &&
        this.peek() !== ',' &&
        this.peek()?.toUpperCase() !== 'GROUP' &&
        this.peek()?.toUpperCase() !== 'ORDER' &&
        this.peek()?.toUpperCase() !== 'LIMIT') {
      // Skip alias handling for simplicity
    }
    return name || '';
  }

  private isJoinKeyword(): boolean {
    const token = this.peek()?.toUpperCase();
    return token === 'JOIN' || token === 'INNER' || token === 'LEFT' ||
           token === 'RIGHT' || token === 'FULL' || token === 'CROSS';
  }

  private parseJoin(leftTable: string): JoinCondition {
    let joinType: JoinType = 'INNER';

    const token = this.consume().toUpperCase();
    if (token === 'LEFT' || token === 'RIGHT' || token === 'FULL' || token === 'CROSS') {
      joinType = token as JoinType;
      if (this.peek()?.toUpperCase() === 'OUTER') this.consume();
      this.expect('JOIN');
    } else if (token === 'INNER') {
      this.expect('JOIN');
    }

    const rightTable = this.parseTableName();

    let leftColumn = '';
    let rightColumn = '';

    if (joinType !== 'CROSS' && this.peek()?.toUpperCase() === 'ON') {
      this.consume();
      const left = this.consume();
      this.consume(); // operator
      const right = this.consume();

      if (left?.includes('.')) {
        [, leftColumn] = left.split('.');
      } else {
        leftColumn = left || '';
      }
      if (right?.includes('.')) {
        [, rightColumn] = right.split('.');
      } else {
        rightColumn = right || '';
      }
    }

    return { leftTable, leftColumn, rightTable, rightColumn, type: joinType };
  }

  private parsePredicates(predicates: Predicate[]): void {
    do {
      if (this.peek()?.toUpperCase() === 'AND') this.consume();
      if (this.peek()?.toUpperCase() === 'OR') this.consume();

      const colToken = this.consume();
      let table: string | undefined;
      let column: string;

      if (colToken?.includes('.')) {
        [table, column] = colToken.split('.');
      } else {
        column = colToken || '';
      }

      if (this.peek()?.toUpperCase() === 'IS') {
        this.consume();
        const notNull = this.peek()?.toUpperCase() === 'NOT';
        if (notNull) this.consume();
        this.expect('NULL');
        predicates.push({
          column,
          table,
          operator: notNull ? 'IS NOT NULL' : 'IS NULL',
          value: null
        });
        continue;
      }

      const operator = this.consume() as SQLOperator;
      let value: unknown = this.consume();

      if (typeof value === 'string' && (value.startsWith("'") || value.startsWith('"'))) {
        value = value.slice(1, -1);
      } else if (!isNaN(Number(value))) {
        value = Number(value);
      }

      predicates.push({ column, table, operator, value });

    } while (this.peek()?.toUpperCase() === 'AND' || this.peek()?.toUpperCase() === 'OR');
  }

  private parseGroupBy(groupBy: string[]): void {
    do {
      if (this.peek() === ',') this.consume();
      const col = this.consume();
      if (col?.includes('.')) {
        groupBy.push(col.split('.')[1]);
      } else {
        groupBy.push(col || '');
      }
    } while (this.peek() === ',');
  }

  private parseOrderBy(orderBy: OrderByClause[]): void {
    do {
      if (this.peek() === ',') this.consume();
      const colToken = this.consume();
      let table: string | undefined;
      let column: string;

      if (colToken?.includes('.')) {
        [table, column] = colToken.split('.');
      } else {
        column = colToken || '';
      }

      let order: SortOrder = 'ASC';
      if (this.peek()?.toUpperCase() === 'ASC' || this.peek()?.toUpperCase() === 'DESC') {
        order = this.consume().toUpperCase() as SortOrder;
      }

      orderBy.push({ column, table, order });
    } while (this.peek() === ',');
  }

  private parseInsert(): ParsedQuery {
    this.expect('INSERT');
    this.expect('INTO');
    const tableName = this.consume();

    const columns: string[] = [];
    if (this.peek() === '(') {
      this.consume();
      while (this.peek() !== ')') {
        if (this.peek() === ',') this.consume();
        columns.push(this.consume() || '');
      }
      this.consume();
    }

    this.expect('VALUES');
    const insertValues: Record<string, unknown>[] = [];

    do {
      if (this.peek() === ',') this.consume();
      this.expect('(');
      const values: unknown[] = [];
      while (this.peek() !== ')') {
        if (this.peek() === ',') this.consume();
        let val: unknown = this.consume();
        if (typeof val === 'string' && (val.startsWith("'") || val.startsWith('"'))) {
          val = val.slice(1, -1);
        } else if (!isNaN(Number(val))) {
          val = Number(val);
        }
        values.push(val);
      }
      this.consume();

      const row: Record<string, unknown> = {};
      for (let i = 0; i < columns.length; i++) {
        row[columns[i]] = values[i];
      }
      insertValues.push(row);
    } while (this.peek() === ',');

    return {
      type: 'INSERT',
      tables: [tableName || ''],
      columns: columns.map(c => ({ column: c })),
      predicates: [],
      joins: [],
      groupBy: [],
      having: [],
      orderBy: [],
      distinct: false,
      insertValues
    };
  }

  private parseUpdate(): ParsedQuery {
    this.expect('UPDATE');
    const tableName = this.consume();
    this.expect('SET');

    const updateValues: Record<string, unknown> = {};
    do {
      if (this.peek() === ',') this.consume();
      const col = this.consume();
      this.expect('=');
      let val: unknown = this.consume();
      if (typeof val === 'string' && (val.startsWith("'") || val.startsWith('"'))) {
        val = val.slice(1, -1);
      } else if (!isNaN(Number(val))) {
        val = Number(val);
      }
      updateValues[col || ''] = val;
    } while (this.peek() === ',');

    const predicates: Predicate[] = [];
    if (this.peek()?.toUpperCase() === 'WHERE') {
      this.consume();
      this.parsePredicates(predicates);
    }

    return {
      type: 'UPDATE',
      tables: [tableName || ''],
      columns: Object.keys(updateValues).map(c => ({ column: c })),
      predicates,
      joins: [],
      groupBy: [],
      having: [],
      orderBy: [],
      distinct: false,
      updateValues
    };
  }

  private parseDelete(): ParsedQuery {
    this.expect('DELETE');
    this.expect('FROM');
    const tableName = this.consume();

    const predicates: Predicate[] = [];
    if (this.peek()?.toUpperCase() === 'WHERE') {
      this.consume();
      this.parsePredicates(predicates);
    }

    return {
      type: 'DELETE',
      tables: [tableName || ''],
      columns: [],
      predicates,
      joins: [],
      groupBy: [],
      having: [],
      orderBy: [],
      distinct: false
    };
  }
}

// ============================================================================
// SELECTIVITY ESTIMATOR
// ============================================================================

class SelectivityEstimator {
  private catalog: Catalog;

  constructor(catalog: Catalog) {
    this.catalog = catalog;
  }

  estimateSelectivity(predicate: Predicate, tableName: string): number {
    const stats = this.catalog.getStatistics(tableName);
    const schema = this.catalog.getTable(tableName);

    if (!stats || !schema) {
      return this.defaultSelectivity(predicate.operator);
    }

    const colStats = stats.columnStats.get(predicate.column);
    if (!colStats) {
      return this.defaultSelectivity(predicate.operator);
    }

    switch (predicate.operator) {
      case '=':
        return 1 / Math.max(1, colStats.distinctValues);

      case '<>':
      case '!=':
        return 1 - (1 / Math.max(1, colStats.distinctValues));

      case '<':
      case '<=':
      case '>':
      case '>=':
        return this.estimateRangeSelectivity(predicate, colStats);

      case 'LIKE':
        return this.estimateLikeSelectivity(predicate.value as string);

      case 'IN':
        const inValues = predicate.value as unknown[];
        return Math.min(1, inValues.length / colStats.distinctValues);

      case 'BETWEEN':
        return 0.25;

      case 'IS NULL':
        return colStats.nullCount / stats.rowCount;

      case 'IS NOT NULL':
        return 1 - (colStats.nullCount / stats.rowCount);

      default:
        return 0.1;
    }
  }

  private estimateRangeSelectivity(predicate: Predicate, colStats: ColumnStatistics): number {
    const value = predicate.value as number;
    const min = colStats.minValue as number;
    const max = colStats.maxValue as number;

    if (typeof min !== 'number' || typeof max !== 'number') {
      return 0.3;
    }

    const range = max - min;
    if (range === 0) return 0.5;

    switch (predicate.operator) {
      case '<':
        return Math.max(0, Math.min(1, (value - min) / range));
      case '<=':
        return Math.max(0, Math.min(1, (value - min + 1) / range));
      case '>':
        return Math.max(0, Math.min(1, (max - value) / range));
      case '>=':
        return Math.max(0, Math.min(1, (max - value + 1) / range));
      default:
        return 0.3;
    }
  }

  private estimateLikeSelectivity(pattern: string): number {
    if (!pattern.includes('%') && !pattern.includes('_')) {
      return 0.001;
    }
    if (pattern.startsWith('%')) {
      return 0.25;
    }
    const fixedPrefix = pattern.split('%')[0].split('_')[0];
    return Math.pow(0.1, fixedPrefix.length);
  }

  private defaultSelectivity(operator: SQLOperator): number {
    switch (operator) {
      case '=': return 0.1;
      case '<>': case '!=': return 0.9;
      case '<': case '>': return 0.3;
      case '<=': case '>=': return 0.35;
      case 'LIKE': return 0.1;
      case 'IN': return 0.2;
      case 'BETWEEN': return 0.25;
      case 'IS NULL': return 0.05;
      case 'IS NOT NULL': return 0.95;
      default: return 0.1;
    }
  }

  estimateCombinedSelectivity(predicates: Predicate[], tableName: string): number {
    if (predicates.length === 0) return 1.0;

    let selectivity = 1.0;
    for (const pred of predicates) {
      selectivity *= this.estimateSelectivity(pred, tableName);
    }
    return selectivity;
  }
}

// ============================================================================
// CARDINALITY ESTIMATOR
// ============================================================================

class CardinalityEstimator {
  private catalog: Catalog;
  private selectivityEstimator: SelectivityEstimator;

  constructor(catalog: Catalog) {
    this.catalog = catalog;
    this.selectivityEstimator = new SelectivityEstimator(catalog);
  }

  estimateTableCardinality(tableName: string, predicates: Predicate[]): number {
    const schema = this.catalog.getTable(tableName);
    if (!schema) return 1000;

    const tablePredicates = predicates.filter(p => !p.table || p.table === tableName);
    const selectivity = this.selectivityEstimator.estimateCombinedSelectivity(
      tablePredicates,
      tableName
    );

    return Math.max(1, Math.ceil(schema.rowCount * selectivity));
  }

  estimateJoinCardinality(
    leftTable: string,
    rightTable: string,
    leftCard: number,
    rightCard: number,
    joinType: JoinType,
    leftColumn: string,
    rightColumn: string
  ): number {
    const leftStats = this.catalog.getStatistics(leftTable);
    const rightStats = this.catalog.getStatistics(rightTable);

    let leftNDV = leftCard;
    let rightNDV = rightCard;

    if (leftStats) {
      const colStats = leftStats.columnStats.get(leftColumn);
      if (colStats) leftNDV = colStats.distinctValues;
    }
    if (rightStats) {
      const colStats = rightStats.columnStats.get(rightColumn);
      if (colStats) rightNDV = colStats.distinctValues;
    }

    switch (joinType) {
      case 'INNER':
        return Math.ceil((leftCard * rightCard) / Math.max(leftNDV, rightNDV));

      case 'LEFT':
        const innerCard = Math.ceil((leftCard * rightCard) / Math.max(leftNDV, rightNDV));
        return Math.max(leftCard, innerCard);

      case 'RIGHT':
        const innerCard2 = Math.ceil((leftCard * rightCard) / Math.max(leftNDV, rightNDV));
        return Math.max(rightCard, innerCard2);

      case 'FULL':
        return leftCard + rightCard;

      case 'CROSS':
        return leftCard * rightCard;

      default:
        return Math.ceil((leftCard * rightCard) / Math.max(leftNDV, rightNDV));
    }
  }

  estimateAggregateCardinality(inputCard: number, groupByColumns: string[], tableName: string): number {
    if (groupByColumns.length === 0) return 1;

    const stats = this.catalog.getStatistics(tableName);
    if (!stats) return Math.ceil(inputCard / 10);

    let groups = 1;
    for (const col of groupByColumns) {
      const colStats = stats.columnStats.get(col);
      if (colStats) {
        groups *= colStats.distinctValues;
      } else {
        groups *= 10;
      }
    }

    return Math.min(inputCard, groups);
  }
}

// ============================================================================
// COST ESTIMATOR
// ============================================================================

class CostEstimator {
  private catalog: Catalog;
  private costModel: CostModel;

  constructor(catalog: Catalog, costModel: CostModel = DEFAULT_COST_MODEL) {
    this.catalog = catalog;
    this.costModel = costModel;
  }

  seqScanCost(tableName: string, _outputRows: number): { startup: number; total: number } {
    const schema = this.catalog.getTable(tableName);
    if (!schema) return { startup: 0, total: 1000 };

    const pages = Math.ceil((schema.rowCount * schema.avgRowSize) / PAGE_SIZE);

    const diskCost = pages * this.costModel.seqPageCost;
    const cpuCost = schema.rowCount * this.costModel.cpuTupleCost;

    return {
      startup: 0,
      total: diskCost + cpuCost
    };
  }

  indexScanCost(
    tableName: string,
    indexName: string,
    selectivity: number
  ): { startup: number; total: number } {
    const schema = this.catalog.getTable(tableName);
    const indexes = this.catalog.getIndexes(tableName);
    const index = indexes.find(i => i.name === indexName);

    if (!schema || !index) return { startup: 0, total: 1000 };

    const outputRows = Math.ceil(schema.rowCount * selectivity);

    const indexCost = index.height * this.costModel.randomPageCost;
    const leafPages = Math.ceil(outputRows / (PAGE_SIZE / 16));
    const leafCost = leafPages * this.costModel.randomPageCost;
    const tablePages = Math.ceil(outputRows * (1 - (1 / schema.rowCount)));
    const tableCost = tablePages * this.costModel.randomPageCost;
    const cpuCost = outputRows * (this.costModel.cpuIndexTupleCost + this.costModel.cpuTupleCost);

    return {
      startup: indexCost,
      total: indexCost + leafCost + tableCost + cpuCost
    };
  }

  indexOnlyScanCost(
    tableName: string,
    indexName: string,
    selectivity: number
  ): { startup: number; total: number } {
    const schema = this.catalog.getTable(tableName);
    const indexes = this.catalog.getIndexes(tableName);
    const index = indexes.find(i => i.name === indexName);

    if (!schema || !index) return { startup: 0, total: 1000 };

    const outputRows = Math.ceil(schema.rowCount * selectivity);

    const indexCost = index.height * this.costModel.randomPageCost;
    const leafPages = Math.ceil(outputRows / (PAGE_SIZE / 16));
    const leafCost = leafPages * this.costModel.randomPageCost;
    const cpuCost = outputRows * this.costModel.cpuIndexTupleCost;

    return {
      startup: indexCost,
      total: indexCost + leafCost + cpuCost
    };
  }

  nestedLoopJoinCost(
    outerCost: number,
    outerRows: number,
    innerCost: number,
    innerRows: number
  ): { startup: number; total: number } {
    return {
      startup: outerCost * 0.1,
      total: outerCost + (outerRows * innerCost) +
             (outerRows * innerRows * this.costModel.cpuTupleCost)
    };
  }

  hashJoinCost(
    outerCost: number,
    outerRows: number,
    innerCost: number,
    innerRows: number
  ): { startup: number; total: number } {
    const buildCost = innerCost + (innerRows * this.costModel.cpuTupleCost);
    const probeCost = outerCost + (outerRows * this.costModel.cpuTupleCost);

    return {
      startup: innerCost + (innerRows * this.costModel.cpuTupleCost),
      total: buildCost + probeCost
    };
  }

  mergeSortJoinCost(
    outerCost: number,
    outerRows: number,
    innerCost: number,
    innerRows: number
  ): { startup: number; total: number } {
    const outerSortCost = outerRows > 0 ? outerRows * Math.log2(outerRows) * this.costModel.cpuOperatorCost : 0;
    const innerSortCost = innerRows > 0 ? innerRows * Math.log2(innerRows) * this.costModel.cpuOperatorCost : 0;
    const mergeCost = (outerRows + innerRows) * this.costModel.cpuTupleCost;

    return {
      startup: outerCost + innerCost + outerSortCost + innerSortCost,
      total: outerCost + innerCost + outerSortCost + innerSortCost + mergeCost
    };
  }

  sortCost(inputRows: number, inputCost: number): { startup: number; total: number } {
    const sortCost = inputRows > 0 ? inputRows * Math.log2(Math.max(1, inputRows)) * this.costModel.cpuOperatorCost : 0;

    const memoryRows = this.costModel.workMem * PAGE_SIZE / 100;
    const isExternal = inputRows > memoryRows;

    let ioCost = 0;
    if (isExternal) {
      const passes = Math.ceil(Math.log2(inputRows / memoryRows));
      const pages = inputRows * 100 / PAGE_SIZE;
      ioCost = passes * pages * this.costModel.seqPageCost * 2;
    }

    return {
      startup: inputCost + sortCost + ioCost,
      total: inputCost + sortCost + ioCost + inputRows * this.costModel.cpuTupleCost
    };
  }

  aggregateCost(
    inputRows: number,
    inputCost: number,
    useHash: boolean
  ): { startup: number; total: number } {
    if (useHash) {
      const hashCost = inputRows * this.costModel.cpuTupleCost * 1.5;
      return {
        startup: inputCost + hashCost,
        total: inputCost + hashCost
      };
    } else {
      return {
        startup: inputCost,
        total: inputCost + inputRows * this.costModel.cpuTupleCost
      };
    }
  }
}

// ============================================================================
// QUERY OPTIMIZER
// ============================================================================

class QueryOptimizer {
  private catalog: Catalog;
  private cardinalityEstimator: CardinalityEstimator;
  private costEstimator: CostEstimator;
  private selectivityEstimator: SelectivityEstimator;
  private nodeIdCounter = 0;

  constructor(catalog: Catalog, costModel?: CostModel) {
    this.catalog = catalog;
    this.cardinalityEstimator = new CardinalityEstimator(catalog);
    this.costEstimator = new CostEstimator(catalog, costModel);
    this.selectivityEstimator = new SelectivityEstimator(catalog);
  }

  optimize(query: ParsedQuery): QueryPlan {
    const startTime = Date.now();
    this.nodeIdCounter = 0;
    const optimizations: string[] = [];
    const warnings: string[] = [];

    const pushedPredicates = this.predicatePushdown(query);
    if (pushedPredicates.pushed) {
      optimizations.push('Predicate pushdown applied');
    }

    const tablePlans = this.generateTableAccessPlans(query, optimizations, warnings);

    let planRoot: PlanNode;
    if (tablePlans.length === 1) {
      planRoot = tablePlans[0];
    } else {
      planRoot = this.optimizeJoinOrder(tablePlans, query.joins, optimizations);
    }

    const unappliedPredicates = query.predicates.filter(
      p => !pushedPredicates.applied.includes(p)
    );
    if (unappliedPredicates.length > 0) {
      planRoot = this.addFilter(planRoot, unappliedPredicates);
    }

    if (query.groupBy.length > 0 || query.columns.some(c => c.aggregate)) {
      planRoot = this.addAggregate(planRoot, query, optimizations);
    }

    if (query.having.length > 0) {
      planRoot = this.addFilter(planRoot, query.having);
    }

    if (query.distinct) {
      planRoot = this.addUnique(planRoot);
      optimizations.push('Added DISTINCT processing');
    }

    if (query.orderBy.length > 0) {
      planRoot = this.addSort(planRoot, query.orderBy, optimizations);
    }

    if (query.offset !== undefined) {
      planRoot = this.addOffset(planRoot, query.offset);
    }
    if (query.limit !== undefined) {
      planRoot = this.addLimit(planRoot, query.limit);
    }

    if (query.columns.length > 0 && query.columns[0].column !== '*') {
      planRoot = this.addProject(planRoot, query.columns);
    }

    const planningTime = Date.now() - startTime;

    return {
      root: planRoot,
      totalCost: planRoot.totalCost,
      estimatedRows: planRoot.estimatedRows,
      estimatedTime: planRoot.totalCost * 0.1,
      planningTime,
      optimizations,
      warnings
    };
  }

  private predicatePushdown(query: ParsedQuery): { pushed: boolean; applied: Predicate[] } {
    const applied: Predicate[] = [];
    let pushed = false;

    for (const pred of query.predicates) {
      if (pred.table) {
        applied.push(pred);
        pushed = true;
      } else {
        for (const tableName of query.tables) {
          const schema = this.catalog.getTable(tableName);
          if (schema?.columns.some(c => c.name === pred.column)) {
            pred.table = tableName;
            applied.push(pred);
            pushed = true;
            break;
          }
        }
      }
    }

    return { pushed, applied };
  }

  private generateTableAccessPlans(
    query: ParsedQuery,
    optimizations: string[],
    warnings: string[]
  ): PlanNode[] {
    const plans: PlanNode[] = [];

    for (const tableName of query.tables) {
      const tablePredicates = query.predicates.filter(
        p => p.table === tableName || !p.table
      );

      const plan = this.chooseBestAccessPath(tableName, tablePredicates, optimizations, warnings);
      plans.push(plan);
    }

    return plans;
  }

  private chooseBestAccessPath(
    tableName: string,
    predicates: Predicate[],
    optimizations: string[],
    warnings: string[]
  ): PlanNode {
    const schema = this.catalog.getTable(tableName);
    const indexes = this.catalog.getIndexes(tableName);

    if (!schema) {
      warnings.push(`Table ${tableName} not found in catalog`);
      return this.createSeqScan(tableName, predicates, 1000);
    }

    const selectivity = this.selectivityEstimator.estimateCombinedSelectivity(predicates, tableName);
    const outputRows = Math.max(1, Math.ceil(schema.rowCount * selectivity));

    const seqCost = this.costEstimator.seqScanCost(tableName, outputRows);
    let bestPlan = this.createSeqScan(tableName, predicates, outputRows);
    bestPlan.startupCost = seqCost.startup;
    bestPlan.totalCost = seqCost.total;
    bestPlan.estimatedCost = seqCost.total;

    for (const index of indexes) {
      const indexPredicates = predicates.filter(p => index.columns.includes(p.column));
      if (indexPredicates.length === 0) continue;

      const indexSelectivity = this.selectivityEstimator.estimateCombinedSelectivity(
        indexPredicates,
        tableName
      );

      const indexCost = this.costEstimator.indexScanCost(tableName, index.name, indexSelectivity);

      if (indexCost.total < bestPlan.totalCost) {
        bestPlan = this.createIndexScan(tableName, index.name, predicates, outputRows);
        bestPlan.startupCost = indexCost.startup;
        bestPlan.totalCost = indexCost.total;
        bestPlan.estimatedCost = indexCost.total;
        optimizations.push(`Using index ${index.name} on ${tableName}`);
      }

      const indexOnlyCost = this.costEstimator.indexOnlyScanCost(
        tableName,
        index.name,
        indexSelectivity
      );

      if (indexOnlyCost.total < bestPlan.totalCost) {
        bestPlan = this.createIndexOnlyScan(tableName, index.name, predicates, outputRows);
        bestPlan.startupCost = indexOnlyCost.startup;
        bestPlan.totalCost = indexOnlyCost.total;
        bestPlan.estimatedCost = indexOnlyCost.total;
        optimizations.push(`Using index-only scan on ${index.name}`);
      }
    }

    return bestPlan;
  }

  private optimizeJoinOrder(
    tablePlans: PlanNode[],
    joins: JoinCondition[],
    optimizations: string[]
  ): PlanNode {
    if (tablePlans.length <= 2) {
      return this.createJoinPlan(tablePlans, joins, optimizations);
    }

    if (tablePlans.length <= 4) {
      return this.exhaustiveJoinOrder(tablePlans, joins, optimizations);
    }

    return this.greedyJoinOrder(tablePlans, joins, optimizations);
  }

  private createJoinPlan(
    tablePlans: PlanNode[],
    joins: JoinCondition[],
    optimizations: string[]
  ): PlanNode {
    if (tablePlans.length === 1) return tablePlans[0];

    let result = tablePlans[0];

    for (let i = 1; i < tablePlans.length; i++) {
      const rightPlan = tablePlans[i];
      const join = joins[i - 1] || {
        leftTable: '',
        rightTable: '',
        leftColumn: '',
        rightColumn: '',
        type: 'INNER' as JoinType
      };

      result = this.chooseBestJoinMethod(result, rightPlan, join, optimizations);
    }

    return result;
  }

  private exhaustiveJoinOrder(
    tablePlans: PlanNode[],
    joins: JoinCondition[],
    optimizations: string[]
  ): PlanNode {
    const permutations = this.getPermutations(tablePlans);
    let bestPlan: PlanNode | null = null;
    let bestCost = Infinity;

    for (const perm of permutations) {
      const plan = this.createJoinPlan(perm, joins, []);
      if (plan.totalCost < bestCost) {
        bestCost = plan.totalCost;
        bestPlan = plan;
      }
    }

    if (bestPlan && bestCost < this.createJoinPlan(tablePlans, joins, []).totalCost) {
      optimizations.push('Optimized join order using exhaustive search');
    }

    return bestPlan || this.createJoinPlan(tablePlans, joins, optimizations);
  }

  private greedyJoinOrder(
    tablePlans: PlanNode[],
    joins: JoinCondition[],
    optimizations: string[]
  ): PlanNode {
    const remaining = [...tablePlans];

    remaining.sort((a, b) => a.estimatedRows - b.estimatedRows);
    let result = remaining.shift()!;

    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestCost = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const join = joins[tablePlans.indexOf(remaining[i]) - 1] || {
          leftTable: '',
          rightTable: '',
          leftColumn: '',
          rightColumn: '',
          type: 'INNER' as JoinType
        };

        const testPlan = this.chooseBestJoinMethod(result, remaining[i], join, []);
        if (testPlan.totalCost < bestCost) {
          bestCost = testPlan.totalCost;
          bestIdx = i;
        }
      }

      const join = joins[tablePlans.indexOf(remaining[bestIdx]) - 1] || {
        leftTable: '',
        rightTable: '',
        leftColumn: '',
        rightColumn: '',
        type: 'INNER' as JoinType
      };

      result = this.chooseBestJoinMethod(result, remaining[bestIdx], join, optimizations);
      remaining.splice(bestIdx, 1);
    }

    optimizations.push('Optimized join order using greedy heuristic');
    return result;
  }

  private getPermutations<T>(arr: T[]): T[][] {
    if (arr.length <= 1) return [arr];

    const result: T[][] = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      const perms = this.getPermutations(rest);
      for (const perm of perms) {
        result.push([arr[i], ...perm]);
      }
    }
    return result;
  }

  private chooseBestJoinMethod(
    leftPlan: PlanNode,
    rightPlan: PlanNode,
    join: JoinCondition,
    optimizations: string[]
  ): PlanNode {
    const leftRows = leftPlan.estimatedRows;
    const rightRows = rightPlan.estimatedRows;
    const leftCost = leftPlan.totalCost;
    const rightCost = rightPlan.totalCost;

    const outputRows = this.cardinalityEstimator.estimateJoinCardinality(
      leftPlan.table || 'left',
      rightPlan.table || 'right',
      leftRows,
      rightRows,
      join.type,
      join.leftColumn,
      join.rightColumn
    );

    const nlCost = this.costEstimator.nestedLoopJoinCost(leftCost, leftRows, rightCost, rightRows);
    const hashCost = this.costEstimator.hashJoinCost(leftCost, leftRows, rightCost, rightRows);
    const mergeCost = this.costEstimator.mergeSortJoinCost(leftCost, leftRows, rightCost, rightRows);

    let bestMethod: 'NestedLoop' | 'HashJoin' | 'MergeJoin' = 'HashJoin';
    let bestCost = hashCost;

    if (nlCost.total < bestCost.total && rightRows < 100) {
      bestMethod = 'NestedLoop';
      bestCost = nlCost;
    }
    if (mergeCost.total < bestCost.total) {
      bestMethod = 'MergeJoin';
      bestCost = mergeCost;
    }

    optimizations.push(`Using ${bestMethod} for join`);

    return {
      id: this.nodeIdCounter++,
      type: bestMethod,
      joinType: join.type,
      estimatedRows: outputRows,
      estimatedCost: bestCost.total,
      startupCost: bestCost.startup,
      totalCost: bestCost.total,
      width: leftPlan.width + rightPlan.width,
      children: [leftPlan, rightPlan],
      properties: {
        joinCondition: `${join.leftColumn} = ${join.rightColumn}`,
        joinType: join.type
      }
    };
  }

  private createSeqScan(tableName: string, predicates: Predicate[], rows: number): PlanNode {
    const schema = this.catalog.getTable(tableName);
    return {
      id: this.nodeIdCounter++,
      type: 'SeqScan',
      table: tableName,
      predicate: predicates.map(p => `${p.column} ${p.operator} ${p.value}`).join(' AND '),
      estimatedRows: rows,
      estimatedCost: 0,
      startupCost: 0,
      totalCost: 0,
      width: schema?.avgRowSize || 100,
      children: [],
      properties: { accessMethod: 'Sequential Scan' }
    };
  }

  private createIndexScan(
    tableName: string,
    indexName: string,
    predicates: Predicate[],
    rows: number
  ): PlanNode {
    const schema = this.catalog.getTable(tableName);
    return {
      id: this.nodeIdCounter++,
      type: 'IndexScan',
      table: tableName,
      index: indexName,
      predicate: predicates.map(p => `${p.column} ${p.operator} ${p.value}`).join(' AND '),
      estimatedRows: rows,
      estimatedCost: 0,
      startupCost: 0,
      totalCost: 0,
      width: schema?.avgRowSize || 100,
      children: [],
      properties: { accessMethod: 'Index Scan', indexName }
    };
  }

  private createIndexOnlyScan(
    tableName: string,
    indexName: string,
    predicates: Predicate[],
    rows: number
  ): PlanNode {
    return {
      id: this.nodeIdCounter++,
      type: 'IndexOnlyScan',
      table: tableName,
      index: indexName,
      predicate: predicates.map(p => `${p.column} ${p.operator} ${p.value}`).join(' AND '),
      estimatedRows: rows,
      estimatedCost: 0,
      startupCost: 0,
      totalCost: 0,
      width: 50,
      children: [],
      properties: { accessMethod: 'Index Only Scan', indexName }
    };
  }

  private addFilter(input: PlanNode, predicates: Predicate[]): PlanNode {
    const selectivity = 0.3;
    const outputRows = Math.max(1, Math.ceil(input.estimatedRows * selectivity));

    return {
      id: this.nodeIdCounter++,
      type: 'Filter',
      predicate: predicates.map(p => `${p.column} ${p.operator} ${p.value}`).join(' AND '),
      estimatedRows: outputRows,
      estimatedCost: input.totalCost + outputRows * 0.01,
      startupCost: input.startupCost,
      totalCost: input.totalCost + outputRows * 0.01,
      width: input.width,
      children: [input],
      properties: {}
    };
  }

  private addAggregate(input: PlanNode, query: ParsedQuery, optimizations: string[]): PlanNode {
    const outputRows = this.cardinalityEstimator.estimateAggregateCardinality(
      input.estimatedRows,
      query.groupBy,
      query.tables[0]
    );

    const useHash = query.groupBy.length > 0 && input.estimatedRows > 1000;
    const aggCost = this.costEstimator.aggregateCost(input.estimatedRows, input.totalCost, useHash);

    if (useHash) {
      optimizations.push('Using hash aggregation');
    }

    return {
      id: this.nodeIdCounter++,
      type: useHash ? 'HashAggregate' : 'GroupAggregate',
      aggregates: query.columns.filter(c => c.aggregate).map(c => `${c.aggregate}(${c.column})`),
      estimatedRows: outputRows,
      estimatedCost: aggCost.total,
      startupCost: aggCost.startup,
      totalCost: aggCost.total,
      width: input.width,
      children: [input],
      properties: {
        groupBy: query.groupBy,
        aggregates: query.columns.filter(c => c.aggregate).map(c => c.aggregate)
      }
    };
  }

  private addSort(input: PlanNode, orderBy: OrderByClause[], optimizations: string[]): PlanNode {
    const sortCost = this.costEstimator.sortCost(input.estimatedRows, input.totalCost);

    optimizations.push(`Added sort on ${orderBy.map(o => o.column).join(', ')}`);

    return {
      id: this.nodeIdCounter++,
      type: 'Sort',
      sortKeys: orderBy.map(o => `${o.column} ${o.order}`),
      estimatedRows: input.estimatedRows,
      estimatedCost: sortCost.total,
      startupCost: sortCost.startup,
      totalCost: sortCost.total,
      width: input.width,
      children: [input],
      properties: { sortKeys: orderBy }
    };
  }

  private addUnique(input: PlanNode): PlanNode {
    return {
      id: this.nodeIdCounter++,
      type: 'Unique',
      estimatedRows: Math.ceil(input.estimatedRows * 0.8),
      estimatedCost: input.totalCost * 1.1,
      startupCost: input.startupCost,
      totalCost: input.totalCost * 1.1,
      width: input.width,
      children: [input],
      properties: {}
    };
  }

  private addLimit(input: PlanNode, limit: number): PlanNode {
    return {
      id: this.nodeIdCounter++,
      type: 'Limit',
      estimatedRows: Math.min(limit, input.estimatedRows),
      estimatedCost: input.startupCost + (limit / input.estimatedRows) * (input.totalCost - input.startupCost),
      startupCost: input.startupCost,
      totalCost: input.startupCost + (limit / input.estimatedRows) * (input.totalCost - input.startupCost),
      width: input.width,
      children: [input],
      properties: { limit }
    };
  }

  private addOffset(input: PlanNode, offset: number): PlanNode {
    return {
      id: this.nodeIdCounter++,
      type: 'Offset',
      estimatedRows: Math.max(1, input.estimatedRows - offset),
      estimatedCost: input.totalCost,
      startupCost: input.startupCost + (offset / input.estimatedRows) * (input.totalCost - input.startupCost),
      totalCost: input.totalCost,
      width: input.width,
      children: [input],
      properties: { offset }
    };
  }

  private addProject(input: PlanNode, columns: SelectColumn[]): PlanNode {
    return {
      id: this.nodeIdCounter++,
      type: 'Project',
      columns: columns.map(c => c.alias || c.column),
      estimatedRows: input.estimatedRows,
      estimatedCost: input.totalCost + input.estimatedRows * 0.001,
      startupCost: input.startupCost,
      totalCost: input.totalCost + input.estimatedRows * 0.001,
      width: columns.length * 20,
      children: [input],
      properties: { outputColumns: columns }
    };
  }

  suggestIndexes(query: ParsedQuery): { table: string; columns: string[]; reason: string }[] {
    const suggestions: { table: string; columns: string[]; reason: string }[] = [];

    for (const pred of query.predicates) {
      if (pred.table && ['=', '<', '>', '<=', '>='].includes(pred.operator)) {
        const existing = this.catalog.getIndexes(pred.table);
        if (!existing.some(idx => idx.columns[0] === pred.column)) {
          suggestions.push({
            table: pred.table,
            columns: [pred.column],
            reason: `Frequently used in WHERE clause with ${pred.operator} operator`
          });
        }
      }
    }

    for (const join of query.joins) {
      const leftIndexes = this.catalog.getIndexes(join.leftTable);
      if (!leftIndexes.some(idx => idx.columns[0] === join.leftColumn)) {
        suggestions.push({
          table: join.leftTable,
          columns: [join.leftColumn],
          reason: 'Used in JOIN condition'
        });
      }

      const rightIndexes = this.catalog.getIndexes(join.rightTable);
      if (!rightIndexes.some(idx => idx.columns[0] === join.rightColumn)) {
        suggestions.push({
          table: join.rightTable,
          columns: [join.rightColumn],
          reason: 'Used in JOIN condition'
        });
      }
    }

    for (const orderBy of query.orderBy) {
      if (orderBy.table) {
        const existing = this.catalog.getIndexes(orderBy.table);
        if (!existing.some(idx => idx.columns[0] === orderBy.column)) {
          suggestions.push({
            table: orderBy.table,
            columns: [orderBy.column],
            reason: 'Used in ORDER BY clause'
          });
        }
      }
    }

    return suggestions;
  }
}

// ============================================================================
// PLAN CACHE
// ============================================================================

interface CachedPlan {
  sql: string;
  plan: QueryPlan;
  createdAt: Date;
  useCount: number;
  lastUsed: Date;
}

class PlanCache {
  private cache: Map<string, CachedPlan> = new Map();
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  private hashSQL(sql: string): string {
    return sql.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  get(sql: string): QueryPlan | null {
    const key = this.hashSQL(sql);
    const cached = this.cache.get(key);

    if (cached) {
      cached.useCount++;
      cached.lastUsed = new Date();
      return cached.plan;
    }

    return null;
  }

  put(sql: string, plan: QueryPlan): void {
    const key = this.hashSQL(sql);

    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      sql: key,
      plan,
      createdAt: new Date(),
      useCount: 1,
      lastUsed: new Date()
    });
  }

  private evictLRU(): void {
    let oldest: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastUsed.getTime() < oldestTime) {
        oldestTime = entry.lastUsed.getTime();
        oldest = key;
      }
    }

    if (oldest) {
      this.cache.delete(oldest);
    }
  }

  getStats(): { size: number; hits: number; entries: { sql: string; useCount: number }[] } {
    const entries = Array.from(this.cache.values()).map(c => ({
      sql: c.sql.substring(0, 50) + '...',
      useCount: c.useCount
    }));

    return {
      size: this.cache.size,
      hits: Array.from(this.cache.values()).reduce((sum, c) => sum + c.useCount, 0),
      entries
    };
  }

  clear(): void {
    this.cache.clear();
  }
}

// ============================================================================
// EXPLAIN FORMATTER
// ============================================================================

class ExplainFormatter {
  formatPlan(plan: QueryPlan, format: 'text' | 'json' | 'tree' = 'text'): string {
    switch (format) {
      case 'json':
        return JSON.stringify(plan, null, 2);
      case 'tree':
        return this.formatTree(plan.root, 0);
      case 'text':
      default:
        return this.formatText(plan);
    }
  }

  private formatText(plan: QueryPlan): string {
    const lines: string[] = [];
    lines.push('QUERY PLAN');
    lines.push('-'.repeat(70));

    this.formatNode(plan.root, lines, 0);

    lines.push('-'.repeat(70));
    lines.push(`Planning Time: ${plan.planningTime.toFixed(2)} ms`);
    lines.push(`Total Cost: ${plan.totalCost.toFixed(2)}`);
    lines.push(`Estimated Rows: ${plan.estimatedRows}`);

    if (plan.optimizations.length > 0) {
      lines.push('\nOptimizations Applied:');
      for (const opt of plan.optimizations) {
        lines.push(`  - ${opt}`);
      }
    }

    if (plan.warnings.length > 0) {
      lines.push('\nWarnings:');
      for (const warn of plan.warnings) {
        lines.push(`  ! ${warn}`);
      }
    }

    return lines.join('\n');
  }

  private formatNode(node: PlanNode, lines: string[], indent: number): void {
    const prefix = '  '.repeat(indent) + (indent > 0 ? '-> ' : '');

    let nodeDesc = `${node.type}`;
    if (node.table) nodeDesc += ` on ${node.table}`;
    if (node.index) nodeDesc += ` using ${node.index}`;

    nodeDesc += ` (cost=${node.startupCost.toFixed(2)}..${node.totalCost.toFixed(2)} rows=${node.estimatedRows} width=${node.width})`;

    lines.push(prefix + nodeDesc);

    if (node.predicate) {
      lines.push('  '.repeat(indent + 1) + `Filter: ${node.predicate}`);
    }
    if (node.sortKeys && node.sortKeys.length > 0) {
      lines.push('  '.repeat(indent + 1) + `Sort Key: ${node.sortKeys.join(', ')}`);
    }
    if (node.aggregates && node.aggregates.length > 0) {
      lines.push('  '.repeat(indent + 1) + `Aggregates: ${node.aggregates.join(', ')}`);
    }

    for (const child of node.children) {
      this.formatNode(child, lines, indent + 1);
    }
  }

  private formatTree(node: PlanNode, depth: number): string {
    const indent = '|   '.repeat(depth);
    const connector = depth === 0 ? '' : '+-- ';

    let result = `${indent}${connector}${node.type}`;
    if (node.table) result += ` [${node.table}]`;
    result += ` (rows: ${node.estimatedRows}, cost: ${node.totalCost.toFixed(1)})`;
    result += '\n';

    for (let i = 0; i < node.children.length; i++) {
      result += this.formatTree(node.children[i], depth + 1);
    }

    return result;
  }
}

// ============================================================================
// GLOBAL STATE
// ============================================================================

const catalog = new Catalog();
const planCache = new PlanCache(100);
const parser = new SQLParser();
const formatter = new ExplainFormatter();

function initializeSampleSchema(): void {
  catalog.addTable({
    name: 'users',
    columns: [
      { name: 'id', type: 'INT', nullable: false, primaryKey: true },
      { name: 'name', type: 'VARCHAR', nullable: false },
      { name: 'email', type: 'VARCHAR', nullable: false },
      { name: 'created_at', type: 'DATE', nullable: false },
      { name: 'status', type: 'VARCHAR', nullable: true }
    ],
    rowCount: 100000,
    avgRowSize: 120
  });

  catalog.addIndex({
    name: 'users_pkey',
    table: 'users',
    columns: ['id'],
    unique: true,
    clustered: true,
    cardinality: 100000,
    leafPages: 500,
    height: 3
  });

  catalog.addIndex({
    name: 'users_email_idx',
    table: 'users',
    columns: ['email'],
    unique: true,
    clustered: false,
    cardinality: 100000,
    leafPages: 400,
    height: 3
  });

  catalog.setStatistics({
    tableName: 'users',
    rowCount: 100000,
    columnStats: new Map([
      ['id', { columnName: 'id', distinctValues: 100000, nullCount: 0, minValue: 1, maxValue: 100000 }],
      ['name', { columnName: 'name', distinctValues: 80000, nullCount: 0, minValue: 'A', maxValue: 'Z' }],
      ['email', { columnName: 'email', distinctValues: 100000, nullCount: 0, minValue: '', maxValue: '' }],
      ['status', { columnName: 'status', distinctValues: 5, nullCount: 1000, minValue: 'active', maxValue: 'suspended' }]
    ]),
    lastAnalyzed: new Date()
  });

  catalog.addTable({
    name: 'orders',
    columns: [
      { name: 'id', type: 'INT', nullable: false, primaryKey: true },
      { name: 'user_id', type: 'INT', nullable: false, foreignKey: { table: 'users', column: 'id' } },
      { name: 'amount', type: 'FLOAT', nullable: false },
      { name: 'status', type: 'VARCHAR', nullable: false },
      { name: 'created_at', type: 'DATE', nullable: false }
    ],
    rowCount: 500000,
    avgRowSize: 80
  });

  catalog.addIndex({
    name: 'orders_pkey',
    table: 'orders',
    columns: ['id'],
    unique: true,
    clustered: true,
    cardinality: 500000,
    leafPages: 2000,
    height: 4
  });

  catalog.addIndex({
    name: 'orders_user_id_idx',
    table: 'orders',
    columns: ['user_id'],
    unique: false,
    clustered: false,
    cardinality: 100000,
    leafPages: 1500,
    height: 3
  });

  catalog.setStatistics({
    tableName: 'orders',
    rowCount: 500000,
    columnStats: new Map([
      ['id', { columnName: 'id', distinctValues: 500000, nullCount: 0, minValue: 1, maxValue: 500000 }],
      ['user_id', { columnName: 'user_id', distinctValues: 100000, nullCount: 0, minValue: 1, maxValue: 100000 }],
      ['amount', { columnName: 'amount', distinctValues: 10000, nullCount: 0, minValue: 1, maxValue: 10000 }],
      ['status', { columnName: 'status', distinctValues: 4, nullCount: 0, minValue: 'completed', maxValue: 'pending' }]
    ]),
    lastAnalyzed: new Date()
  });

  catalog.addTable({
    name: 'products',
    columns: [
      { name: 'id', type: 'INT', nullable: false, primaryKey: true },
      { name: 'name', type: 'VARCHAR', nullable: false },
      { name: 'price', type: 'FLOAT', nullable: false },
      { name: 'category', type: 'VARCHAR', nullable: false }
    ],
    rowCount: 10000,
    avgRowSize: 100
  });

  catalog.addIndex({
    name: 'products_pkey',
    table: 'products',
    columns: ['id'],
    unique: true,
    clustered: true,
    cardinality: 10000,
    leafPages: 50,
    height: 2
  });

  catalog.setStatistics({
    tableName: 'products',
    rowCount: 10000,
    columnStats: new Map([
      ['id', { columnName: 'id', distinctValues: 10000, nullCount: 0, minValue: 1, maxValue: 10000 }],
      ['category', { columnName: 'category', distinctValues: 20, nullCount: 0, minValue: '', maxValue: '' }],
      ['price', { columnName: 'price', distinctValues: 500, nullCount: 0, minValue: 1, maxValue: 1000 }]
    ]),
    lastAnalyzed: new Date()
  });
}

initializeSampleSchema();

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const queryplannerTool: UnifiedTool = {
  name: 'query_planner',
  description: 'SQL query execution planner with cost-based optimization, plan generation, and explain visualization',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['parse_query', 'optimize', 'explain', 'estimate_cost', 'compare_plans',
               'get_statistics', 'suggest_indexes', 'analyze_join_order', 'add_table',
               'add_index', 'info', 'examples'],
        description: 'Operation to perform'
      },
      sql: {
        type: 'string',
        description: 'SQL query to analyze'
      },
      format: {
        type: 'string',
        enum: ['text', 'json', 'tree'],
        description: 'Output format for explain'
      },
      table: {
        type: 'object',
        description: 'Table schema for add_table operation'
      },
      index: {
        type: 'object',
        description: 'Index metadata for add_index operation'
      },
      queries: {
        type: 'array',
        items: { type: 'string' },
        description: 'Multiple queries for compare_plans'
      }
    },
    required: ['operation']
  }
};

export async function executequeryplanner(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    switch (operation) {
      case 'parse_query': {
        const sql = args.sql || 'SELECT * FROM users WHERE id = 1';
        const parsed = parser.parse(sql);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'parse_query',
            sql,
            parsed: {
              type: parsed.type,
              tables: parsed.tables,
              columns: parsed.columns,
              predicates: parsed.predicates,
              joins: parsed.joins,
              groupBy: parsed.groupBy,
              having: parsed.having,
              orderBy: parsed.orderBy,
              limit: parsed.limit,
              offset: parsed.offset,
              distinct: parsed.distinct
            }
          }, null, 2)
        };
      }

      case 'optimize': {
        const sql = args.sql || 'SELECT u.name, COUNT(o.id) FROM users u JOIN orders o ON u.id = o.user_id WHERE u.status = \'active\' GROUP BY u.name ORDER BY COUNT(o.id) DESC LIMIT 10';

        let plan = planCache.get(sql);
        let cached = false;

        if (plan) {
          cached = true;
        } else {
          const parsed = parser.parse(sql);
          const optimizer = new QueryOptimizer(catalog);
          plan = optimizer.optimize(parsed);
          planCache.put(sql, plan);
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'optimize',
            sql,
            cached,
            plan: {
              totalCost: plan.totalCost,
              estimatedRows: plan.estimatedRows,
              estimatedTime: `${plan.estimatedTime.toFixed(2)} ms`,
              planningTime: `${plan.planningTime} ms`,
              optimizations: plan.optimizations,
              warnings: plan.warnings,
              planTree: plan.root
            }
          }, null, 2)
        };
      }

      case 'explain': {
        const sql = args.sql || 'SELECT * FROM users WHERE email = \'test@example.com\'';
        const format = args.format || 'text';

        const parsed = parser.parse(sql);
        const optimizer = new QueryOptimizer(catalog);
        const plan = optimizer.optimize(parsed);

        const explained = formatter.formatPlan(plan, format as 'text' | 'json' | 'tree');

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'explain',
            sql,
            format,
            explainOutput: explained
          }, null, 2)
        };
      }

      case 'estimate_cost': {
        const sql = args.sql || 'SELECT * FROM orders WHERE user_id = 123';

        const parsed = parser.parse(sql);
        const optimizer = new QueryOptimizer(catalog);
        const plan = optimizer.optimize(parsed);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'estimate_cost',
            sql,
            costBreakdown: {
              totalCost: plan.totalCost.toFixed(2),
              startupCost: plan.root.startupCost.toFixed(2),
              estimatedRows: plan.estimatedRows,
              estimatedWidth: plan.root.width,
              estimatedTime: `${plan.estimatedTime.toFixed(2)} ms`
            },
            costModel: {
              seqPageCost: DEFAULT_COST_MODEL.seqPageCost,
              randomPageCost: DEFAULT_COST_MODEL.randomPageCost,
              cpuTupleCost: DEFAULT_COST_MODEL.cpuTupleCost
            }
          }, null, 2)
        };
      }

      case 'compare_plans': {
        const queries = args.queries || [
          'SELECT * FROM users WHERE id = 1',
          'SELECT * FROM users WHERE email = \'test@example.com\'',
          'SELECT * FROM users WHERE status = \'active\''
        ];

        const comparisons = queries.map((sql: string) => {
          const parsed = parser.parse(sql);
          const optimizer = new QueryOptimizer(catalog);
          const plan = optimizer.optimize(parsed);

          return {
            sql,
            totalCost: plan.totalCost.toFixed(2),
            estimatedRows: plan.estimatedRows,
            accessMethod: plan.root.type,
            indexUsed: plan.root.index || 'none',
            optimizations: plan.optimizations
          };
        });

        comparisons.sort((a: { totalCost: string }, b: { totalCost: string }) => parseFloat(a.totalCost) - parseFloat(b.totalCost));

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'compare_plans',
            comparisons,
            recommendation: `Best query: "${comparisons[0].sql}" with cost ${comparisons[0].totalCost}`
          }, null, 2)
        };
      }

      case 'get_statistics': {
        const tableName = args.tableName || 'users';
        const stats = catalog.getStatistics(tableName);
        const schema = catalog.getTable(tableName);
        const indexes = catalog.getIndexes(tableName);

        if (!stats || !schema) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: `Table ${tableName} not found`
            }, null, 2),
            isError: true
          };
        }

        const columnStats: Record<string, unknown> = {};
        for (const [col, st] of stats.columnStats) {
          columnStats[col] = st;
        }

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'get_statistics',
            tableName,
            schema: {
              columns: schema.columns,
              rowCount: schema.rowCount,
              avgRowSize: schema.avgRowSize
            },
            statistics: {
              rowCount: stats.rowCount,
              lastAnalyzed: stats.lastAnalyzed,
              columnStats
            },
            indexes: indexes.map(idx => ({
              name: idx.name,
              columns: idx.columns,
              unique: idx.unique,
              clustered: idx.clustered,
              cardinality: idx.cardinality,
              height: idx.height
            })),
            planCacheStats: planCache.getStats()
          }, null, 2)
        };
      }

      case 'suggest_indexes': {
        const sql = args.sql || 'SELECT * FROM orders WHERE status = \'pending\' AND amount > 100 ORDER BY created_at';

        const parsed = parser.parse(sql);
        const optimizer = new QueryOptimizer(catalog);
        const suggestions = optimizer.suggestIndexes(parsed);
        const plan = optimizer.optimize(parsed);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'suggest_indexes',
            sql,
            currentPlan: {
              cost: plan.totalCost.toFixed(2),
              accessMethod: plan.root.type
            },
            suggestions,
            potentialImprovement: suggestions.length > 0
              ? 'Adding suggested indexes could improve query performance by enabling index scans instead of sequential scans'
              : 'Query is already well-optimized'
          }, null, 2)
        };
      }

      case 'analyze_join_order': {
        const sql = args.sql || 'SELECT u.name, o.amount, p.name FROM users u JOIN orders o ON u.id = o.user_id JOIN products p ON o.product_id = p.id WHERE u.status = \'active\'';

        const parsed = parser.parse(sql);

        const tableCards = parsed.tables.map(t => {
          const schema = catalog.getTable(t);
          return {
            table: t,
            rowCount: schema?.rowCount || 1000
          };
        });

        const optimizer = new QueryOptimizer(catalog);
        const plan = optimizer.optimize(parsed);

        const joinOrder: string[] = [];
        const extractJoins = (node: PlanNode): void => {
          if (node.type === 'HashJoin' || node.type === 'MergeJoin' || node.type === 'NestedLoop') {
            for (const child of node.children) {
              extractJoins(child);
            }
          } else if (node.table) {
            joinOrder.push(node.table);
          }
        };
        extractJoins(plan.root);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'analyze_join_order',
            sql,
            tables: tableCards,
            optimizedJoinOrder: joinOrder,
            joinMethods: plan.optimizations.filter(o => o.includes('join') || o.includes('Join')),
            totalCost: plan.totalCost.toFixed(2),
            explanation: 'Join order is optimized to minimize intermediate result sizes'
          }, null, 2)
        };
      }

      case 'add_table': {
        const table = args.table || {
          name: 'inventory',
          columns: [
            { name: 'id', type: 'INT', nullable: false, primaryKey: true },
            { name: 'product_id', type: 'INT', nullable: false },
            { name: 'quantity', type: 'INT', nullable: false }
          ],
          rowCount: 50000,
          avgRowSize: 50
        };

        catalog.addTable(table);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'add_table',
            table: table.name,
            success: true,
            allTables: catalog.getAllTables().map(t => t.name)
          }, null, 2)
        };
      }

      case 'add_index': {
        const index = args.index || {
          name: 'orders_status_idx',
          table: 'orders',
          columns: ['status'],
          unique: false,
          clustered: false,
          cardinality: 4,
          leafPages: 1000,
          height: 2
        };

        catalog.addIndex(index);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'add_index',
            index: index.name,
            table: index.table,
            success: true,
            tableIndexes: catalog.getIndexes(index.table).map(i => i.name)
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Query Planner',
            description: 'SQL query execution planner with cost-based optimization',
            features: [
              'SQL parsing (SELECT, INSERT, UPDATE, DELETE, JOIN)',
              'Cost-based query optimization',
              'Selectivity and cardinality estimation',
              'Index selection (sequential, index, index-only scans)',
              'Join optimization (nested loop, hash, merge)',
              'Predicate pushdown',
              'Plan caching',
              'Explain plan visualization'
            ],
            operations: [
              { name: 'parse_query', description: 'Parse SQL and show AST' },
              { name: 'optimize', description: 'Generate optimized execution plan' },
              { name: 'explain', description: 'Show formatted explain plan' },
              { name: 'estimate_cost', description: 'Estimate query execution cost' },
              { name: 'compare_plans', description: 'Compare multiple query plans' },
              { name: 'get_statistics', description: 'Get table/column statistics' },
              { name: 'suggest_indexes', description: 'Suggest indexes for query' },
              { name: 'analyze_join_order', description: 'Analyze and optimize join order' },
              { name: 'add_table', description: 'Add table to catalog' },
              { name: 'add_index', description: 'Add index to catalog' }
            ],
            sampleTables: catalog.getAllTables().map(t => ({
              name: t.name,
              rowCount: t.rowCount,
              columns: t.columns.map(c => c.name)
            }))
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'Parse a SELECT query',
                call: {
                  operation: 'parse_query',
                  sql: 'SELECT name, email FROM users WHERE status = \'active\' ORDER BY name'
                }
              },
              {
                name: 'Optimize a JOIN query',
                call: {
                  operation: 'optimize',
                  sql: 'SELECT u.name, SUM(o.amount) FROM users u JOIN orders o ON u.id = o.user_id GROUP BY u.name'
                }
              },
              {
                name: 'Get explain plan',
                call: {
                  operation: 'explain',
                  sql: 'SELECT * FROM orders WHERE user_id = 123',
                  format: 'text'
                }
              },
              {
                name: 'Compare query alternatives',
                call: {
                  operation: 'compare_plans',
                  queries: [
                    'SELECT * FROM users WHERE id = 1',
                    'SELECT * FROM users WHERE name = \'John\''
                  ]
                }
              },
              {
                name: 'Get index suggestions',
                call: {
                  operation: 'suggest_indexes',
                  sql: 'SELECT * FROM orders WHERE status = \'pending\' ORDER BY created_at'
                }
              }
            ]
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: `Unknown operation: ${operation}. Use 'info' for available operations.`,
          isError: true
        };
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isqueryplannerAvailable(): boolean { return true; }
