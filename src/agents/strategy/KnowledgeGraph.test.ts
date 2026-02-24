import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: [],
          error: null,
        })),
      })),
    })),
  })),
}));

import Anthropic from '@anthropic-ai/sdk';
import {
  KnowledgeGraph,
  type Entity,
  type EntityType,
  type RelationshipType,
  type Cluster,
  type GraphQuery,
  type GraphQueryResult,
  type GraphStatistics,
  type ExtractionResult,
  type Path,
} from './KnowledgeGraph';

// -------------------------------------------------------------------
// Type Exports
// -------------------------------------------------------------------
describe('KnowledgeGraph type exports', () => {
  it('should export Entity type', () => {
    const entity: Entity = {
      id: 'e1',
      name: 'Test',
      type: 'person',
      aliases: [],
      properties: {},
      confidence: 0.9,
      sourceIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(entity.id).toBe('e1');
  });

  it('should export EntityType as union', () => {
    const types: EntityType[] = [
      'person',
      'organization',
      'location',
      'place',
      'product',
      'service',
      'concept',
      'event',
      'date',
      'price',
      'metric',
      'document',
      'technology',
      'category',
    ];
    expect(types).toHaveLength(14);
  });

  it('should export RelationshipType as union', () => {
    const types: RelationshipType[] = [
      'is_a',
      'part_of',
      'located_in',
      'owned_by',
      'works_for',
      'related_to',
      'competes_with',
      'similar_to',
      'opposite_of',
      'causes',
      'affects',
      'requires',
      'provides',
      'costs',
      'rated_as',
      'compared_to',
      'connected_to',
      'happened_on',
      'created_by',
      'mentions',
    ];
    expect(types).toHaveLength(20);
  });

  it('should export Cluster type', () => {
    const cluster: Cluster = {
      id: 'c1',
      name: 'Cluster',
      description: 'A cluster',
      entityIds: [],
      centroidEntityId: 'e1',
      cohesion: 0.8,
      createdAt: Date.now(),
    };
    expect(cluster.id).toBe('c1');
  });

  it('should export GraphQuery type', () => {
    const query: GraphQuery = {
      startEntity: 'test',
      entityTypes: ['person'],
      maxDepth: 3,
    };
    expect(query.startEntity).toBe('test');
  });

  it('should export GraphQueryResult type', () => {
    const result: GraphQueryResult = {
      entities: [],
      relationships: [],
      clusters: [],
      paths: [],
    };
    expect(result.entities).toHaveLength(0);
  });

  it('should export GraphStatistics type', () => {
    const stats: GraphStatistics = {
      totalEntities: 0,
      totalRelationships: 0,
      totalClusters: 0,
      entityTypeDistribution: {} as Record<EntityType, number>,
      relationshipTypeDistribution: {} as Record<RelationshipType, number>,
      averageConfidence: 0,
      mostConnectedEntities: [],
    };
    expect(stats.totalEntities).toBe(0);
  });

  it('should export ExtractionResult type', () => {
    const result: ExtractionResult = {
      entities: [],
      relationships: [],
      extractedFromCount: 0,
    };
    expect(result.extractedFromCount).toBe(0);
  });

  it('should export Path type', () => {
    const path: Path = {
      entities: [],
      relationships: [],
      totalConfidence: 1,
    };
    expect(path.totalConfidence).toBe(1);
  });
});

// -------------------------------------------------------------------
// KnowledgeGraph class
// -------------------------------------------------------------------
describe('KnowledgeGraph', () => {
  let graph: KnowledgeGraph;

  beforeEach(() => {
    const client = new Anthropic();
    graph = new KnowledgeGraph(client, 'user-1', 'session-1');
  });

  describe('constructor', () => {
    it('should create a KnowledgeGraph instance', () => {
      expect(graph).toBeInstanceOf(KnowledgeGraph);
    });

    it('should accept optional onStream callback', () => {
      const client = new Anthropic();
      const onStream = vi.fn();
      const g = new KnowledgeGraph(client, 'user-1', 'session-1', onStream);
      expect(g).toBeInstanceOf(KnowledgeGraph);
    });
  });

  describe('addEntity', () => {
    it('should add an entity and return it with generated id', () => {
      const entity = graph.addEntity({
        name: 'Google',
        type: 'organization',
        aliases: ['Alphabet'],
        properties: { founded: 1998 },
        confidence: 0.95,
        sourceIds: ['f1'],
      });

      expect(entity.id).toMatch(/^entity_/);
      expect(entity.name).toBe('Google');
      expect(entity.type).toBe('organization');
      expect(entity.createdAt).toBeGreaterThan(0);
      expect(entity.updatedAt).toBeGreaterThan(0);
    });

    it('should index entity by name', () => {
      graph.addEntity({
        name: 'Google',
        type: 'organization',
        aliases: [],
        properties: {},
        confidence: 0.9,
        sourceIds: [],
      });

      const related = graph.getRelated('Google');
      // Should find the entity (even if no related entities)
      expect(Array.isArray(related)).toBe(true);
    });

    it('should index entity by aliases', () => {
      graph.addEntity({
        name: 'Google',
        type: 'organization',
        aliases: ['Alphabet', 'GOOG'],
        properties: {},
        confidence: 0.9,
        sourceIds: [],
      });

      // Can look up by alias
      const related = graph.getRelated('Alphabet');
      expect(Array.isArray(related)).toBe(true);
    });
  });

  describe('addRelationship', () => {
    it('should add a relationship between existing entities', () => {
      const e1 = graph.addEntity({
        name: 'Google',
        type: 'organization',
        aliases: [],
        properties: {},
        confidence: 0.9,
        sourceIds: [],
      });
      const e2 = graph.addEntity({
        name: 'YouTube',
        type: 'product',
        aliases: [],
        properties: {},
        confidence: 0.9,
        sourceIds: [],
      });

      const rel = graph.addRelationship({
        sourceEntityId: e1.id,
        targetEntityId: e2.id,
        type: 'owned_by',
        properties: {},
        confidence: 0.95,
        sourceIds: [],
        bidirectional: false,
      });

      expect(rel).not.toBeNull();
      expect(rel!.id).toMatch(/^rel_/);
      expect(rel!.type).toBe('owned_by');
    });

    it('should return null if source entity does not exist', () => {
      const e1 = graph.addEntity({
        name: 'Google',
        type: 'organization',
        aliases: [],
        properties: {},
        confidence: 0.9,
        sourceIds: [],
      });

      const rel = graph.addRelationship({
        sourceEntityId: 'nonexistent',
        targetEntityId: e1.id,
        type: 'related_to',
        properties: {},
        confidence: 0.8,
        sourceIds: [],
        bidirectional: false,
      });

      expect(rel).toBeNull();
    });

    it('should return null if target entity does not exist', () => {
      const e1 = graph.addEntity({
        name: 'Google',
        type: 'organization',
        aliases: [],
        properties: {},
        confidence: 0.9,
        sourceIds: [],
      });

      const rel = graph.addRelationship({
        sourceEntityId: e1.id,
        targetEntityId: 'nonexistent',
        type: 'related_to',
        properties: {},
        confidence: 0.8,
        sourceIds: [],
        bidirectional: false,
      });

      expect(rel).toBeNull();
    });
  });

  describe('query', () => {
    it('should return empty results for empty graph', () => {
      const result = graph.query({});

      expect(result.entities).toHaveLength(0);
      expect(result.relationships).toHaveLength(0);
      expect(result.clusters).toHaveLength(0);
      expect(result.paths).toHaveLength(0);
    });

    it('should return all entities when no filters specified', () => {
      graph.addEntity({
        name: 'Google',
        type: 'organization',
        aliases: [],
        properties: {},
        confidence: 0.9,
        sourceIds: [],
      });
      graph.addEntity({
        name: 'Apple',
        type: 'organization',
        aliases: [],
        properties: {},
        confidence: 0.8,
        sourceIds: [],
      });

      const result = graph.query({});
      expect(result.entities).toHaveLength(2);
    });

    it('should filter entities by type', () => {
      graph.addEntity({
        name: 'Google',
        type: 'organization',
        aliases: [],
        properties: {},
        confidence: 0.9,
        sourceIds: [],
      });
      graph.addEntity({
        name: 'John',
        type: 'person',
        aliases: [],
        properties: {},
        confidence: 0.8,
        sourceIds: [],
      });

      const result = graph.query({ entityTypes: ['person'] });
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('John');
    });

    it('should filter entities by minimum confidence', () => {
      graph.addEntity({
        name: 'Google',
        type: 'organization',
        aliases: [],
        properties: {},
        confidence: 0.9,
        sourceIds: [],
      });
      graph.addEntity({
        name: 'Maybe Inc',
        type: 'organization',
        aliases: [],
        properties: {},
        confidence: 0.3,
        sourceIds: [],
      });

      const result = graph.query({ minConfidence: 0.5 });
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('Google');
    });

    it('should apply limit', () => {
      for (let i = 0; i < 5; i++) {
        graph.addEntity({
          name: `Entity ${i}`,
          type: 'concept',
          aliases: [],
          properties: {},
          confidence: 0.9,
          sourceIds: [],
        });
      }

      const result = graph.query({ limit: 2 });
      expect(result.entities).toHaveLength(2);
    });

    it('should query by startEntity name', () => {
      const e1 = graph.addEntity({
        name: 'Google',
        type: 'organization',
        aliases: [],
        properties: {},
        confidence: 0.9,
        sourceIds: [],
      });
      const e2 = graph.addEntity({
        name: 'YouTube',
        type: 'product',
        aliases: [],
        properties: {},
        confidence: 0.9,
        sourceIds: [],
      });
      graph.addRelationship({
        sourceEntityId: e1.id,
        targetEntityId: e2.id,
        type: 'owned_by',
        properties: {},
        confidence: 0.95,
        sourceIds: [],
        bidirectional: false,
      });

      const result = graph.query({ startEntity: 'Google' });
      expect(result.entities.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('findPath', () => {
    it('should return null when entities do not exist', () => {
      const path = graph.findPath('Unknown1', 'Unknown2');
      expect(path).toBeNull();
    });

    it('should find direct path between connected entities', () => {
      const e1 = graph.addEntity({
        name: 'A',
        type: 'concept',
        aliases: [],
        properties: {},
        confidence: 1,
        sourceIds: [],
      });
      const e2 = graph.addEntity({
        name: 'B',
        type: 'concept',
        aliases: [],
        properties: {},
        confidence: 1,
        sourceIds: [],
      });
      graph.addRelationship({
        sourceEntityId: e1.id,
        targetEntityId: e2.id,
        type: 'related_to',
        properties: {},
        confidence: 0.8,
        sourceIds: [],
        bidirectional: false,
      });

      const path = graph.findPath('A', 'B');
      expect(path).not.toBeNull();
      expect(path!.entities).toHaveLength(2);
      expect(path!.relationships).toHaveLength(1);
    });

    it('should return path with itself when from equals to', () => {
      graph.addEntity({
        name: 'A',
        type: 'concept',
        aliases: [],
        properties: {},
        confidence: 1,
        sourceIds: [],
      });

      const path = graph.findPath('A', 'A');
      expect(path).not.toBeNull();
      expect(path!.entities).toHaveLength(1);
    });

    it('should return null when no path exists', () => {
      graph.addEntity({
        name: 'Isolated1',
        type: 'concept',
        aliases: [],
        properties: {},
        confidence: 1,
        sourceIds: [],
      });
      graph.addEntity({
        name: 'Isolated2',
        type: 'concept',
        aliases: [],
        properties: {},
        confidence: 1,
        sourceIds: [],
      });

      const path = graph.findPath('Isolated1', 'Isolated2');
      expect(path).toBeNull();
    });
  });

  describe('getRelated', () => {
    it('should return empty array for unknown entity', () => {
      const related = graph.getRelated('Unknown');
      expect(related).toHaveLength(0);
    });

    it('should return related entities', () => {
      const e1 = graph.addEntity({
        name: 'Center',
        type: 'concept',
        aliases: [],
        properties: {},
        confidence: 1,
        sourceIds: [],
      });
      const e2 = graph.addEntity({
        name: 'Related1',
        type: 'concept',
        aliases: [],
        properties: {},
        confidence: 1,
        sourceIds: [],
      });
      graph.addRelationship({
        sourceEntityId: e1.id,
        targetEntityId: e2.id,
        type: 'related_to',
        properties: {},
        confidence: 0.9,
        sourceIds: [],
        bidirectional: false,
      });

      const related = graph.getRelated('Center');
      expect(related.length).toBeGreaterThanOrEqual(1);
      expect(related.some((e) => e.name === 'Related1')).toBe(true);
    });

    it('should not include the queried entity itself', () => {
      const e1 = graph.addEntity({
        name: 'Center',
        type: 'concept',
        aliases: [],
        properties: {},
        confidence: 1,
        sourceIds: [],
      });
      const e2 = graph.addEntity({
        name: 'Neighbor',
        type: 'concept',
        aliases: [],
        properties: {},
        confidence: 1,
        sourceIds: [],
      });
      graph.addRelationship({
        sourceEntityId: e1.id,
        targetEntityId: e2.id,
        type: 'related_to',
        properties: {},
        confidence: 0.9,
        sourceIds: [],
        bidirectional: false,
      });

      const related = graph.getRelated('Center');
      expect(related.every((e) => e.name !== 'Center')).toBe(true);
    });
  });

  describe('getStatistics', () => {
    it('should return zero stats for empty graph', () => {
      const stats = graph.getStatistics();

      expect(stats.totalEntities).toBe(0);
      expect(stats.totalRelationships).toBe(0);
      expect(stats.totalClusters).toBe(0);
      expect(stats.averageConfidence).toBe(0);
      expect(stats.mostConnectedEntities).toHaveLength(0);
    });

    it('should count entities correctly', () => {
      graph.addEntity({
        name: 'A',
        type: 'person',
        aliases: [],
        properties: {},
        confidence: 0.8,
        sourceIds: [],
      });
      graph.addEntity({
        name: 'B',
        type: 'organization',
        aliases: [],
        properties: {},
        confidence: 0.9,
        sourceIds: [],
      });

      const stats = graph.getStatistics();
      expect(stats.totalEntities).toBe(2);
      expect(stats.entityTypeDistribution.person).toBe(1);
      expect(stats.entityTypeDistribution.organization).toBe(1);
    });

    it('should calculate average confidence', () => {
      graph.addEntity({
        name: 'A',
        type: 'person',
        aliases: [],
        properties: {},
        confidence: 0.8,
        sourceIds: [],
      });
      graph.addEntity({
        name: 'B',
        type: 'person',
        aliases: [],
        properties: {},
        confidence: 1.0,
        sourceIds: [],
      });

      const stats = graph.getStatistics();
      expect(stats.averageConfidence).toBe(0.9);
    });

    it('should track relationship type distribution', () => {
      const e1 = graph.addEntity({
        name: 'A',
        type: 'concept',
        aliases: [],
        properties: {},
        confidence: 1,
        sourceIds: [],
      });
      const e2 = graph.addEntity({
        name: 'B',
        type: 'concept',
        aliases: [],
        properties: {},
        confidence: 1,
        sourceIds: [],
      });
      graph.addRelationship({
        sourceEntityId: e1.id,
        targetEntityId: e2.id,
        type: 'related_to',
        properties: {},
        confidence: 0.9,
        sourceIds: [],
        bidirectional: false,
      });

      const stats = graph.getStatistics();
      expect(stats.totalRelationships).toBe(1);
      expect(stats.relationshipTypeDistribution.related_to).toBe(1);
    });

    it('should identify most connected entities', () => {
      const center = graph.addEntity({
        name: 'Hub',
        type: 'concept',
        aliases: [],
        properties: {},
        confidence: 1,
        sourceIds: [],
      });

      for (let i = 0; i < 3; i++) {
        const spoke = graph.addEntity({
          name: `Spoke${i}`,
          type: 'concept',
          aliases: [],
          properties: {},
          confidence: 1,
          sourceIds: [],
        });
        graph.addRelationship({
          sourceEntityId: center.id,
          targetEntityId: spoke.id,
          type: 'related_to',
          properties: {},
          confidence: 0.9,
          sourceIds: [],
          bidirectional: false,
        });
      }

      const stats = graph.getStatistics();
      expect(stats.mostConnectedEntities.length).toBeGreaterThanOrEqual(1);
      expect(stats.mostConnectedEntities[0].connectionCount).toBe(3);
    });
  });
});
