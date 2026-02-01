/**
 * KNOWLEDGE GRAPH TOOL
 * Entity relationships, reasoning, and inference
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Entity { id: string; type: string; properties: Record<string, unknown>; }
interface Relation { from: string; to: string; type: string; properties?: Record<string, unknown>; }
interface KnowledgeGraph { entities: Map<string, Entity>; relations: Relation[]; }

function createGraph(): KnowledgeGraph {
  return { entities: new Map(), relations: [] };
}

function addEntity(g: KnowledgeGraph, id: string, type: string, props: Record<string, unknown> = {}): void {
  g.entities.set(id, { id, type, properties: props });
}

function addRelation(g: KnowledgeGraph, from: string, to: string, type: string, props?: Record<string, unknown>): void {
  g.relations.push({ from, to, type, properties: props });
}

function query(g: KnowledgeGraph, pattern: { subject?: string; predicate?: string; object?: string }): Relation[] {
  return g.relations.filter(r => {
    if (pattern.subject && r.from !== pattern.subject) return false;
    if (pattern.predicate && r.type !== pattern.predicate) return false;
    if (pattern.object && r.to !== pattern.object) return false;
    return true;
  });
}

function findPath(g: KnowledgeGraph, from: string, to: string, maxDepth: number = 5): string[][] {
  const paths: string[][] = [];
  const visited = new Set<string>();
  
  function dfs(current: string, path: string[], depth: number): void {
    if (depth > maxDepth) return;
    if (current === to) { paths.push([...path]); return; }
    if (visited.has(current)) return;
    visited.add(current);
    
    for (const rel of g.relations) {
      if (rel.from === current) {
        dfs(rel.to, [...path, rel.type, rel.to], depth + 1);
      }
    }
    visited.delete(current);
  }
  
  dfs(from, [from], 0);
  return paths;
}

function infer(g: KnowledgeGraph, rules: Array<{ if: { predicate: string }; then: { predicate: string } }>): Relation[] {
  const inferred: Relation[] = [];
  for (const rule of rules) {
    const matches = query(g, { predicate: rule.if.predicate });
    for (const match of matches) {
      const newRel = { from: match.from, to: match.to, type: rule.then.predicate };
      if (!g.relations.some(r => r.from === newRel.from && r.to === newRel.to && r.type === newRel.type)) {
        inferred.push(newRel);
      }
    }
  }
  return inferred;
}

function transitiveClose(g: KnowledgeGraph, predicate: string): Relation[] {
  const edges = query(g, { predicate });
  const reachable = new Map<string, Set<string>>();
  
  for (const e of edges) {
    if (!reachable.has(e.from)) reachable.set(e.from, new Set());
    reachable.get(e.from)!.add(e.to);
  }
  
  let changed = true;
  while (changed) {
    changed = false;
    for (const [, tos] of reachable) {
      for (const to of [...tos]) {
        const transitive = reachable.get(to);
        if (transitive) {
          for (const t of transitive) {
            if (!tos.has(t)) {
              tos.add(t);
              changed = true;
            }
          }
        }
      }
    }
  }

  const result: Relation[] = [];
  for (const [fromNode, tos] of reachable) {
    for (const to of tos) {
      result.push({ from: fromNode, to, type: predicate + '*' });
    }
  }
  return result;
}

export const knowledgeGraphTool: UnifiedTool = {
  name: 'knowledge_graph',
  description: 'Knowledge graph with entity relationships, path finding, and inference',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['query', 'path', 'infer', 'transitive', 'demo', 'info'], description: 'Operation' },
      subject: { type: 'string', description: 'Query subject' },
      predicate: { type: 'string', description: 'Query predicate' },
      object: { type: 'string', description: 'Query object' },
      from: { type: 'string', description: 'Path start' },
      to: { type: 'string', description: 'Path end' }
    },
    required: ['operation']
  }
};

export async function executeKnowledgeGraph(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    
    // Demo graph
    const g = createGraph();
    addEntity(g, 'Socrates', 'Person', { born: -470 });
    addEntity(g, 'Plato', 'Person', { born: -428 });
    addEntity(g, 'Aristotle', 'Person', { born: -384 });
    addEntity(g, 'Athens', 'City', {});
    addEntity(g, 'Philosophy', 'Field', {});
    addRelation(g, 'Socrates', 'Plato', 'taught');
    addRelation(g, 'Plato', 'Aristotle', 'taught');
    addRelation(g, 'Socrates', 'Athens', 'livedIn');
    addRelation(g, 'Plato', 'Athens', 'livedIn');
    addRelation(g, 'Socrates', 'Philosophy', 'foundedWestern');
    addRelation(g, 'Plato', 'Philosophy', 'contributedTo');
    addRelation(g, 'Aristotle', 'Philosophy', 'contributedTo');
    
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'query':
        result = { matches: query(g, { subject: args.subject, predicate: args.predicate, object: args.object }) };
        break;
      case 'path':
        result = { paths: findPath(g, args.from || 'Socrates', args.to || 'Aristotle') };
        break;
      case 'transitive':
        result = { closure: transitiveClose(g, args.predicate || 'taught') };
        break;
      case 'infer':
        result = { inferred: infer(g, [{ if: { predicate: 'taught' }, then: { predicate: 'influenced' } }]) };
        break;
      case 'demo':
        result = { entities: Array.from(g.entities.values()), relations: g.relations };
        break;
      case 'info':
      default:
        result = { description: 'Knowledge graph reasoning', features: ['SPARQL-like queries', 'Path finding', 'Transitive closure', 'Rule-based inference'] };
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isKnowledgeGraphAvailable(): boolean { return true; }
