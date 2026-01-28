/**
 * KNOWLEDGE GRAPH SYSTEM
 *
 * A structured knowledge representation system that goes beyond text storage.
 * Captures entities, relationships, and connections between findings.
 *
 * This enables:
 * - Entity extraction from findings
 * - Relationship mapping between concepts
 * - Graph traversal for related information
 * - Semantic querying
 * - Visual knowledge maps
 *
 * Architecture:
 * - Entities: Nodes representing concepts, places, organizations, etc.
 * - Relationships: Edges connecting entities with typed connections
 * - Properties: Attributes on nodes and edges
 * - Clusters: Groups of related entities
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Finding, StrategyStreamCallback } from './types';
import { CLAUDE_SONNET_45 } from './constants';
import { logger } from '@/lib/logger';

const log = logger('KnowledgeGraph');

// =============================================================================
// TYPES
// =============================================================================

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  aliases: string[];
  properties: Record<string, unknown>;
  confidence: number;
  sourceIds: string[]; // Finding IDs this entity was extracted from
  createdAt: number;
  updatedAt: number;
}

export type EntityType =
  | 'person'
  | 'organization'
  | 'location'
  | 'place' // Specific place (restaurant, building)
  | 'product'
  | 'service'
  | 'concept'
  | 'event'
  | 'date'
  | 'price'
  | 'metric'
  | 'document'
  | 'technology'
  | 'category';

export interface Relationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: RelationshipType;
  properties: Record<string, unknown>;
  confidence: number;
  sourceIds: string[]; // Finding IDs this relationship was extracted from
  bidirectional: boolean;
  createdAt: number;
}

export type RelationshipType =
  | 'is_a' // Taxonomy (A is a type of B)
  | 'part_of' // Composition (A is part of B)
  | 'located_in' // Spatial (A is in B)
  | 'owned_by' // Ownership
  | 'works_for' // Employment
  | 'related_to' // General relationship
  | 'competes_with' // Competition
  | 'similar_to' // Similarity
  | 'opposite_of' // Opposition
  | 'causes' // Causation
  | 'affects' // Influence
  | 'requires' // Dependency
  | 'provides' // Supply
  | 'costs' // Price relationship
  | 'rated_as' // Rating/score
  | 'compared_to' // Comparison
  | 'connected_to' // Connection (transit, network)
  | 'happened_on' // Temporal
  | 'created_by' // Authorship
  | 'mentions'; // Reference

export interface Cluster {
  id: string;
  name: string;
  description: string;
  entityIds: string[];
  centroidEntityId: string;
  cohesion: number; // How tightly related the entities are
  createdAt: number;
}

export interface GraphQuery {
  startEntity?: string;
  entityTypes?: EntityType[];
  relationshipTypes?: RelationshipType[];
  maxDepth?: number;
  minConfidence?: number;
  limit?: number;
}

export interface GraphQueryResult {
  entities: Entity[];
  relationships: Relationship[];
  clusters: Cluster[];
  paths: Path[];
}

export interface Path {
  entities: Entity[];
  relationships: Relationship[];
  totalConfidence: number;
}

export interface GraphStatistics {
  totalEntities: number;
  totalRelationships: number;
  totalClusters: number;
  entityTypeDistribution: Record<EntityType, number>;
  relationshipTypeDistribution: Record<RelationshipType, number>;
  averageConfidence: number;
  mostConnectedEntities: Array<{ entity: Entity; connectionCount: number }>;
}

export interface ExtractionResult {
  entities: Entity[];
  relationships: Relationship[];
  extractedFromCount: number;
}

// =============================================================================
// SUPABASE SERVICE CLIENT
// =============================================================================

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing Supabase credentials for KnowledgeGraph');
  }
  return createServiceClient(url, key);
}

// =============================================================================
// EXTRACTION PROMPT
// =============================================================================

const EXTRACTION_PROMPT = `You are a Knowledge Graph Extraction Engine. Your job is to extract structured entities and relationships from research findings.

EXTRACT:
1. ENTITIES - Named things (people, places, organizations, products, concepts, metrics, dates, prices)
2. RELATIONSHIPS - How entities connect to each other

ENTITY TYPES:
- person: Named individuals
- organization: Companies, agencies, groups
- location: Cities, regions, countries
- place: Specific locations (buildings, restaurants, parks)
- product: Physical or digital products
- service: Services offered
- concept: Abstract ideas, categories
- event: Things that happened
- date: Specific dates or time periods
- price: Monetary values
- metric: Measurements, statistics
- document: Reports, studies, articles
- technology: Tech, tools, platforms
- category: Classification types

RELATIONSHIP TYPES:
- is_a: Taxonomy (X is a type of Y)
- part_of: Composition
- located_in: Spatial containment
- owned_by: Ownership
- works_for: Employment
- related_to: General connection
- competes_with: Competition
- similar_to: Similarity
- opposite_of: Opposition
- causes: Causation
- affects: Influence
- requires: Dependency
- provides: Supply
- costs: Price relationship
- rated_as: Rating/evaluation
- compared_to: Comparison
- connected_to: Network/transit connection
- happened_on: Temporal
- created_by: Authorship
- mentions: Reference

OUTPUT FORMAT:
\`\`\`json
{
  "entities": [
    {
      "name": "Entity Name",
      "type": "entity_type",
      "aliases": ["alternate name"],
      "properties": {"key": "value"},
      "confidence": 0.9
    }
  ],
  "relationships": [
    {
      "source": "Entity A Name",
      "target": "Entity B Name",
      "type": "relationship_type",
      "properties": {"key": "value"},
      "confidence": 0.85,
      "bidirectional": false
    }
  ]
}
\`\`\`

Be thorough but precise. Only extract what's explicitly stated or strongly implied.`;

// =============================================================================
// KNOWLEDGE GRAPH CLASS
// =============================================================================

export class KnowledgeGraph {
  private client: Anthropic;
  private onStream?: StrategyStreamCallback;
  private sessionId: string;
  private userId: string;

  // In-memory graph (for current session)
  private entities: Map<string, Entity> = new Map();
  private relationships: Map<string, Relationship> = new Map();
  private clusters: Map<string, Cluster> = new Map();

  // Entity name to ID index
  private entityNameIndex: Map<string, string> = new Map();

  constructor(
    client: Anthropic,
    userId: string,
    sessionId: string,
    onStream?: StrategyStreamCallback
  ) {
    this.client = client;
    this.userId = userId;
    this.sessionId = sessionId;
    this.onStream = onStream;
  }

  // ===========================================================================
  // PUBLIC METHODS - EXTRACTION
  // ===========================================================================

  /**
   * Extract entities and relationships from findings
   */
  async extractFromFindings(findings: Finding[]): Promise<ExtractionResult> {
    if (findings.length === 0) {
      return { entities: [], relationships: [], extractedFromCount: 0 };
    }

    this.emitEvent(`Extracting knowledge graph from ${findings.length} findings...`);

    const allEntities: Entity[] = [];
    const allRelationships: Relationship[] = [];

    // Process in batches to avoid token limits
    const batchSize = 10;
    for (let i = 0; i < findings.length; i += batchSize) {
      const batch = findings.slice(i, i + batchSize);
      const result = await this.extractBatch(batch);

      allEntities.push(...result.entities);
      allRelationships.push(...result.relationships);

      this.emitEvent(
        `Processed ${Math.min(i + batchSize, findings.length)}/${findings.length} findings`
      );
    }

    // Deduplicate and merge entities
    const mergedEntities = this.mergeEntities(allEntities);
    const mergedRelationships = this.mergeRelationships(allRelationships, mergedEntities);

    // Store in local maps
    for (const entity of mergedEntities) {
      this.entities.set(entity.id, entity);
      this.entityNameIndex.set(entity.name.toLowerCase(), entity.id);
      for (const alias of entity.aliases) {
        this.entityNameIndex.set(alias.toLowerCase(), entity.id);
      }
    }

    for (const rel of mergedRelationships) {
      this.relationships.set(rel.id, rel);
    }

    // Auto-cluster entities
    await this.computeClusters();

    this.emitEvent(
      `Knowledge graph built: ${mergedEntities.length} entities, ` +
        `${mergedRelationships.length} relationships, ${this.clusters.size} clusters`
    );

    log.info('Knowledge graph extraction complete', {
      entities: mergedEntities.length,
      relationships: mergedRelationships.length,
      clusters: this.clusters.size,
    });

    return {
      entities: mergedEntities,
      relationships: mergedRelationships,
      extractedFromCount: findings.length,
    };
  }

  /**
   * Add a single entity manually
   */
  addEntity(entity: Omit<Entity, 'id' | 'createdAt' | 'updatedAt'>): Entity {
    const id = `entity_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const now = Date.now();

    const newEntity: Entity = {
      ...entity,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.entities.set(id, newEntity);
    this.entityNameIndex.set(entity.name.toLowerCase(), id);
    for (const alias of entity.aliases) {
      this.entityNameIndex.set(alias.toLowerCase(), id);
    }

    return newEntity;
  }

  /**
   * Add a relationship manually
   */
  addRelationship(rel: Omit<Relationship, 'id' | 'createdAt'>): Relationship | null {
    // Verify entities exist
    if (!this.entities.has(rel.sourceEntityId) || !this.entities.has(rel.targetEntityId)) {
      log.warn('Cannot add relationship: entity not found', {
        source: rel.sourceEntityId,
        target: rel.targetEntityId,
      });
      return null;
    }

    const id = `rel_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const newRel: Relationship = {
      ...rel,
      id,
      createdAt: Date.now(),
    };

    this.relationships.set(id, newRel);
    return newRel;
  }

  // ===========================================================================
  // PUBLIC METHODS - QUERYING
  // ===========================================================================

  /**
   * Query the knowledge graph
   */
  query(query: GraphQuery): GraphQueryResult {
    let resultEntities: Entity[] = [];
    let resultRelationships: Relationship[] = [];

    // Start with entity filter
    if (query.startEntity) {
      const startId = this.entityNameIndex.get(query.startEntity.toLowerCase());
      if (startId) {
        const traversed = this.traverseFrom(
          startId,
          query.maxDepth || 2,
          query.relationshipTypes,
          query.minConfidence || 0
        );
        resultEntities = traversed.entities;
        resultRelationships = traversed.relationships;
      }
    } else {
      // Return all entities matching filters
      resultEntities = Array.from(this.entities.values()).filter((e) => {
        if (query.entityTypes && !query.entityTypes.includes(e.type)) return false;
        if (query.minConfidence && e.confidence < query.minConfidence) return false;
        return true;
      });

      // Get relationships between result entities
      const entityIds = new Set(resultEntities.map((e) => e.id));
      resultRelationships = Array.from(this.relationships.values()).filter((r) => {
        if (!entityIds.has(r.sourceEntityId) || !entityIds.has(r.targetEntityId)) return false;
        if (query.relationshipTypes && !query.relationshipTypes.includes(r.type)) return false;
        if (query.minConfidence && r.confidence < query.minConfidence) return false;
        return true;
      });
    }

    // Apply limit
    if (query.limit) {
      resultEntities = resultEntities.slice(0, query.limit);
    }

    // Get relevant clusters
    const entityIds = new Set(resultEntities.map((e) => e.id));
    const resultClusters = Array.from(this.clusters.values()).filter((c) =>
      c.entityIds.some((id) => entityIds.has(id))
    );

    return {
      entities: resultEntities,
      relationships: resultRelationships,
      clusters: resultClusters,
      paths: [], // TODO: Implement path finding
    };
  }

  /**
   * Find shortest path between two entities
   */
  findPath(fromEntity: string, toEntity: string, maxDepth: number = 5): Path | null {
    const fromId = this.entityNameIndex.get(fromEntity.toLowerCase());
    const toId = this.entityNameIndex.get(toEntity.toLowerCase());

    if (!fromId || !toId) return null;

    // BFS for shortest path
    const queue: Array<{ entityId: string; path: Path }> = [
      {
        entityId: fromId,
        path: {
          entities: [this.entities.get(fromId)!],
          relationships: [],
          totalConfidence: 1,
        },
      },
    ];

    const visited = new Set<string>([fromId]);

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.entityId === toId) {
        return current.path;
      }

      if (current.path.entities.length > maxDepth) continue;

      // Get connected entities
      const connections = this.getConnections(current.entityId);

      for (const conn of connections) {
        if (visited.has(conn.entityId)) continue;
        visited.add(conn.entityId);

        const entity = this.entities.get(conn.entityId);
        if (!entity) continue;

        queue.push({
          entityId: conn.entityId,
          path: {
            entities: [...current.path.entities, entity],
            relationships: [...current.path.relationships, conn.relationship],
            totalConfidence: current.path.totalConfidence * conn.relationship.confidence,
          },
        });
      }
    }

    return null;
  }

  /**
   * Get entities related to a concept
   */
  getRelated(entityName: string, depth: number = 1): Entity[] {
    const entityId = this.entityNameIndex.get(entityName.toLowerCase());
    if (!entityId) return [];

    const result = this.traverseFrom(entityId, depth);
    return result.entities.filter((e) => e.id !== entityId);
  }

  /**
   * Get graph statistics
   */
  getStatistics(): GraphStatistics {
    const entities = Array.from(this.entities.values());
    const relationships = Array.from(this.relationships.values());

    // Entity type distribution
    const entityTypeDistribution = {} as Record<EntityType, number>;
    for (const entity of entities) {
      entityTypeDistribution[entity.type] = (entityTypeDistribution[entity.type] || 0) + 1;
    }

    // Relationship type distribution
    const relationshipTypeDistribution = {} as Record<RelationshipType, number>;
    for (const rel of relationships) {
      relationshipTypeDistribution[rel.type] = (relationshipTypeDistribution[rel.type] || 0) + 1;
    }

    // Average confidence
    const avgConfidence =
      entities.length > 0
        ? entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length
        : 0;

    // Most connected entities
    const connectionCounts = new Map<string, number>();
    for (const rel of relationships) {
      connectionCounts.set(rel.sourceEntityId, (connectionCounts.get(rel.sourceEntityId) || 0) + 1);
      connectionCounts.set(rel.targetEntityId, (connectionCounts.get(rel.targetEntityId) || 0) + 1);
    }

    const mostConnected = Array.from(connectionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([entityId, count]) => ({
        entity: this.entities.get(entityId)!,
        connectionCount: count,
      }))
      .filter((x) => x.entity);

    return {
      totalEntities: entities.length,
      totalRelationships: relationships.length,
      totalClusters: this.clusters.size,
      entityTypeDistribution,
      relationshipTypeDistribution,
      averageConfidence: avgConfidence,
      mostConnectedEntities: mostConnected,
    };
  }

  // ===========================================================================
  // PUBLIC METHODS - PERSISTENCE
  // ===========================================================================

  /**
   * Save graph to database
   */
  async persist(): Promise<void> {
    const supabase = getServiceClient();

    const entities = Array.from(this.entities.values());
    const relationships = Array.from(this.relationships.values());
    const clusters = Array.from(this.clusters.values());

    // Save entities
    if (entities.length > 0) {
      const entityRows = entities.map((e) => ({
        id: e.id,
        user_id: this.userId,
        session_id: this.sessionId,
        name: e.name,
        entity_type: e.type,
        aliases: e.aliases,
        properties: e.properties,
        confidence: e.confidence,
        source_ids: e.sourceIds,
        created_at: new Date(e.createdAt).toISOString(),
        updated_at: new Date(e.updatedAt).toISOString(),
      }));

      const { error: entityError } = await supabase
        .from('knowledge_graph_entities')
        .upsert(entityRows, { onConflict: 'id' });

      if (entityError) {
        log.error('Failed to persist entities', { error: entityError });
      }
    }

    // Save relationships
    if (relationships.length > 0) {
      const relRows = relationships.map((r) => ({
        id: r.id,
        user_id: this.userId,
        session_id: this.sessionId,
        source_entity_id: r.sourceEntityId,
        target_entity_id: r.targetEntityId,
        relationship_type: r.type,
        properties: r.properties,
        confidence: r.confidence,
        source_ids: r.sourceIds,
        bidirectional: r.bidirectional,
        created_at: new Date(r.createdAt).toISOString(),
      }));

      const { error: relError } = await supabase
        .from('knowledge_graph_relationships')
        .upsert(relRows, { onConflict: 'id' });

      if (relError) {
        log.error('Failed to persist relationships', { error: relError });
      }
    }

    // Save clusters
    if (clusters.length > 0) {
      const clusterRows = clusters.map((c) => ({
        id: c.id,
        user_id: this.userId,
        session_id: this.sessionId,
        name: c.name,
        description: c.description,
        entity_ids: c.entityIds,
        centroid_entity_id: c.centroidEntityId,
        cohesion: c.cohesion,
        created_at: new Date(c.createdAt).toISOString(),
      }));

      const { error: clusterError } = await supabase
        .from('knowledge_graph_clusters')
        .upsert(clusterRows, { onConflict: 'id' });

      if (clusterError) {
        log.error('Failed to persist clusters', { error: clusterError });
      }
    }

    log.info('Knowledge graph persisted', {
      entities: entities.length,
      relationships: relationships.length,
      clusters: clusters.length,
    });
  }

  /**
   * Load graph from database
   */
  async load(): Promise<void> {
    const supabase = getServiceClient();

    // Load entities
    const { data: entityData } = await supabase
      .from('knowledge_graph_entities')
      .select('*')
      .eq('user_id', this.userId);

    if (entityData) {
      for (const row of entityData) {
        const entity: Entity = {
          id: row.id,
          name: row.name,
          type: row.entity_type as EntityType,
          aliases: row.aliases || [],
          properties: row.properties || {},
          confidence: row.confidence,
          sourceIds: row.source_ids || [],
          createdAt: new Date(row.created_at).getTime(),
          updatedAt: new Date(row.updated_at).getTime(),
        };
        this.entities.set(entity.id, entity);
        this.entityNameIndex.set(entity.name.toLowerCase(), entity.id);
        for (const alias of entity.aliases) {
          this.entityNameIndex.set(alias.toLowerCase(), entity.id);
        }
      }
    }

    // Load relationships
    const { data: relData } = await supabase
      .from('knowledge_graph_relationships')
      .select('*')
      .eq('user_id', this.userId);

    if (relData) {
      for (const row of relData) {
        const rel: Relationship = {
          id: row.id,
          sourceEntityId: row.source_entity_id,
          targetEntityId: row.target_entity_id,
          type: row.relationship_type as RelationshipType,
          properties: row.properties || {},
          confidence: row.confidence,
          sourceIds: row.source_ids || [],
          bidirectional: row.bidirectional,
          createdAt: new Date(row.created_at).getTime(),
        };
        this.relationships.set(rel.id, rel);
      }
    }

    // Load clusters
    const { data: clusterData } = await supabase
      .from('knowledge_graph_clusters')
      .select('*')
      .eq('user_id', this.userId);

    if (clusterData) {
      for (const row of clusterData) {
        const cluster: Cluster = {
          id: row.id,
          name: row.name,
          description: row.description,
          entityIds: row.entity_ids || [],
          centroidEntityId: row.centroid_entity_id,
          cohesion: row.cohesion,
          createdAt: new Date(row.created_at).getTime(),
        };
        this.clusters.set(cluster.id, cluster);
      }
    }

    log.info('Knowledge graph loaded', {
      entities: this.entities.size,
      relationships: this.relationships.size,
      clusters: this.clusters.size,
    });
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private async extractBatch(
    findings: Finding[]
  ): Promise<{ entities: Entity[]; relationships: Relationship[] }> {
    const findingTexts = findings.map((f, i) => `[${i}] ${f.title}: ${f.content}`).join('\n\n');

    try {
      const response = await this.client.messages.create({
        model: CLAUDE_SONNET_45,
        max_tokens: 4096,
        temperature: 0.3,
        system: EXTRACTION_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Extract entities and relationships from these findings:\n\n${findingTexts}`,
          },
        ],
      });

      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) return { entities: [], relationships: [] };

      const parsed = JSON.parse(jsonMatch[1]);
      const now = Date.now();

      const entities: Entity[] = (parsed.entities || []).map(
        (e: Record<string, unknown>, i: number) => ({
          id: `entity_${now}_${i}`,
          name: String(e.name || ''),
          type: String(e.type || 'concept') as EntityType,
          aliases: Array.isArray(e.aliases) ? e.aliases.map(String) : [],
          properties: (e.properties as Record<string, unknown>) || {},
          confidence: Math.max(0, Math.min(1, Number(e.confidence) || 0.7)),
          sourceIds: findings.map((f) => f.id),
          createdAt: now,
          updatedAt: now,
        })
      );

      // Create entity name to temp ID mapping for relationships
      const nameToId = new Map<string, string>();
      for (const e of entities) {
        nameToId.set(e.name.toLowerCase(), e.id);
      }

      const relationships: Relationship[] = (parsed.relationships || [])
        .map((r: Record<string, unknown>, i: number) => {
          const sourceId = nameToId.get(String(r.source || '').toLowerCase());
          const targetId = nameToId.get(String(r.target || '').toLowerCase());

          if (!sourceId || !targetId) return null;

          return {
            id: `rel_${now}_${i}`,
            sourceEntityId: sourceId,
            targetEntityId: targetId,
            type: String(r.type || 'related_to') as RelationshipType,
            properties: (r.properties as Record<string, unknown>) || {},
            confidence: Math.max(0, Math.min(1, Number(r.confidence) || 0.7)),
            sourceIds: findings.map((f) => f.id),
            bidirectional: Boolean(r.bidirectional),
            createdAt: now,
          };
        })
        .filter(Boolean) as Relationship[];

      return { entities, relationships };
    } catch (error) {
      log.error('Entity extraction failed', { error });
      return { entities: [], relationships: [] };
    }
  }

  private mergeEntities(entities: Entity[]): Entity[] {
    const merged = new Map<string, Entity>();

    for (const entity of entities) {
      const key = entity.name.toLowerCase();
      const existing = merged.get(key);

      if (existing) {
        // Merge properties and sources
        existing.aliases = [...new Set([...existing.aliases, ...entity.aliases])];
        existing.properties = { ...existing.properties, ...entity.properties };
        existing.sourceIds = [...new Set([...existing.sourceIds, ...entity.sourceIds])];
        existing.confidence = Math.max(existing.confidence, entity.confidence);
        existing.updatedAt = Date.now();
      } else {
        merged.set(key, { ...entity });
      }
    }

    return Array.from(merged.values());
  }

  private mergeRelationships(
    relationships: Relationship[],
    mergedEntities: Entity[]
  ): Relationship[] {
    // Create old ID to new ID mapping
    const entityIdMap = new Map<string, string>();
    for (const entity of mergedEntities) {
      entityIdMap.set(entity.name.toLowerCase(), entity.id);
    }

    // Update relationship entity IDs
    const updatedRels = relationships
      .map((r) => {
        const sourceEntity = mergedEntities.find(
          (e) => e.sourceIds.some((id) => r.sourceIds.includes(id)) || e.id === r.sourceEntityId
        );
        const targetEntity = mergedEntities.find(
          (e) => e.sourceIds.some((id) => r.sourceIds.includes(id)) || e.id === r.targetEntityId
        );

        if (!sourceEntity || !targetEntity) return null;

        return {
          ...r,
          sourceEntityId: sourceEntity.id,
          targetEntityId: targetEntity.id,
        };
      })
      .filter(Boolean) as Relationship[];

    // Deduplicate
    const merged = new Map<string, Relationship>();
    for (const rel of updatedRels) {
      const key = `${rel.sourceEntityId}-${rel.type}-${rel.targetEntityId}`;
      const existing = merged.get(key);

      if (existing) {
        existing.sourceIds = [...new Set([...existing.sourceIds, ...rel.sourceIds])];
        existing.confidence = Math.max(existing.confidence, rel.confidence);
      } else {
        merged.set(key, rel);
      }
    }

    return Array.from(merged.values());
  }

  private async computeClusters(): Promise<void> {
    // Simple clustering based on connected components
    const visited = new Set<string>();
    const entities = Array.from(this.entities.values());

    for (const entity of entities) {
      if (visited.has(entity.id)) continue;

      // BFS to find connected component
      const component: string[] = [];
      const queue = [entity.id];

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);
        component.push(current);

        const connections = this.getConnections(current);
        for (const conn of connections) {
          if (!visited.has(conn.entityId)) {
            queue.push(conn.entityId);
          }
        }
      }

      // Create cluster if component has multiple entities
      if (component.length >= 2) {
        const clusterEntities = component.map((id) => this.entities.get(id)!);
        const centroid = clusterEntities.reduce((best, current) => {
          const bestConns = this.getConnections(best.id).length;
          const currentConns = this.getConnections(current.id).length;
          return currentConns > bestConns ? current : best;
        });

        const cluster: Cluster = {
          id: `cluster_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          name: `${centroid.name} cluster`,
          description: `Cluster of ${component.length} related entities centered on ${centroid.name}`,
          entityIds: component,
          centroidEntityId: centroid.id,
          cohesion: Math.min(1, component.length / 10), // Simple cohesion metric
          createdAt: Date.now(),
        };

        this.clusters.set(cluster.id, cluster);
      }
    }
  }

  private getConnections(
    entityId: string
  ): Array<{ entityId: string; relationship: Relationship }> {
    const connections: Array<{ entityId: string; relationship: Relationship }> = [];

    for (const rel of this.relationships.values()) {
      if (rel.sourceEntityId === entityId) {
        connections.push({ entityId: rel.targetEntityId, relationship: rel });
      }
      if (rel.targetEntityId === entityId && rel.bidirectional) {
        connections.push({ entityId: rel.sourceEntityId, relationship: rel });
      }
    }

    return connections;
  }

  private traverseFrom(
    startId: string,
    maxDepth: number,
    relationshipTypes?: RelationshipType[],
    minConfidence?: number
  ): { entities: Entity[]; relationships: Relationship[] } {
    const visitedEntities = new Set<string>();
    const visitedRels = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;

      if (visitedEntities.has(id) || depth > maxDepth) continue;
      visitedEntities.add(id);

      const connections = this.getConnections(id);

      for (const conn of connections) {
        if (relationshipTypes && !relationshipTypes.includes(conn.relationship.type)) continue;
        if (minConfidence && conn.relationship.confidence < minConfidence) continue;

        visitedRels.add(conn.relationship.id);

        if (!visitedEntities.has(conn.entityId)) {
          queue.push({ id: conn.entityId, depth: depth + 1 });
        }
      }
    }

    return {
      entities: Array.from(visitedEntities)
        .map((id) => this.entities.get(id)!)
        .filter(Boolean),
      relationships: Array.from(visitedRels)
        .map((id) => this.relationships.get(id)!)
        .filter(Boolean),
    };
  }

  private emitEvent(message: string): void {
    if (this.onStream) {
      this.onStream({
        type: 'synthesis_progress',
        message: `[KnowledgeGraph] ${message}`,
        timestamp: Date.now(),
      });
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createKnowledgeGraph(
  client: Anthropic,
  userId: string,
  sessionId: string,
  onStream?: StrategyStreamCallback
): KnowledgeGraph {
  return new KnowledgeGraph(client, userId, sessionId, onStream);
}
