/**
 * ANALOGICAL REASONING TOOL
 *
 * Implements Structure Mapping Theory (SMT) for analogical reasoning.
 * Finds structural correspondences between domains and transfers knowledge.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface Entity {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
}

interface Relation {
  predicate: string;
  arguments: string[];
  order: number; // Higher-order relations reference other relations
}

interface Domain {
  name: string;
  entities: Entity[];
  relations: Relation[];
  higherOrderRelations?: Relation[];
}

interface Mapping {
  entityMappings: Map<string, string>;
  relationMappings: Map<string, string>;
  score: number;
  structuralConsistency: number;
  systematicity: number;
}

interface AnalogySuggestion {
  sourceRelation: Relation;
  targetRelation: Relation;
  confidence: number;
  reasoning: string;
}

// ============================================================================
// CLASSIC ANALOGIES DATABASE
// ============================================================================

const CLASSIC_ANALOGIES: Record<string, { source: Domain; target: Domain; description: string }> = {
  solar_atom: {
    description: 'Rutherford analogy: Solar system <-> Atom structure',
    source: {
      name: 'Solar System',
      entities: [
        { id: 'sun', type: 'massive_body', attributes: { mass: 'very_high', charge: 'neutral' } },
        { id: 'planet', type: 'orbiting_body', attributes: { mass: 'low', charge: 'neutral' } }
      ],
      relations: [
        { predicate: 'attracts', arguments: ['sun', 'planet'], order: 1 },
        { predicate: 'more_massive', arguments: ['sun', 'planet'], order: 1 },
        { predicate: 'revolves_around', arguments: ['planet', 'sun'], order: 1 },
        { predicate: 'CAUSE', arguments: ['attracts', 'revolves_around'], order: 2 }
      ]
    },
    target: {
      name: 'Atom',
      entities: [
        { id: 'nucleus', type: 'massive_body', attributes: { mass: 'very_high', charge: 'positive' } },
        { id: 'electron', type: 'orbiting_body', attributes: { mass: 'low', charge: 'negative' } }
      ],
      relations: [
        { predicate: 'attracts', arguments: ['nucleus', 'electron'], order: 1 },
        { predicate: 'more_massive', arguments: ['nucleus', 'electron'], order: 1 },
        { predicate: 'revolves_around', arguments: ['electron', 'nucleus'], order: 1 }
      ]
    }
  },

  water_electricity: {
    description: 'Water flow <-> Electric current analogy',
    source: {
      name: 'Water Flow',
      entities: [
        { id: 'pipe', type: 'conduit', attributes: { material: 'metal' } },
        { id: 'water', type: 'flowing_substance', attributes: { state: 'liquid' } },
        { id: 'pump', type: 'pressure_source', attributes: {} },
        { id: 'valve', type: 'flow_restrictor', attributes: {} }
      ],
      relations: [
        { predicate: 'flows_through', arguments: ['water', 'pipe'], order: 1 },
        { predicate: 'creates_pressure', arguments: ['pump', 'water'], order: 1 },
        { predicate: 'restricts_flow', arguments: ['valve', 'water'], order: 1 },
        { predicate: 'CAUSE', arguments: ['creates_pressure', 'flows_through'], order: 2 }
      ]
    },
    target: {
      name: 'Electric Circuit',
      entities: [
        { id: 'wire', type: 'conduit', attributes: { material: 'copper' } },
        { id: 'current', type: 'flowing_substance', attributes: { state: 'electrons' } },
        { id: 'battery', type: 'pressure_source', attributes: {} },
        { id: 'resistor', type: 'flow_restrictor', attributes: {} }
      ],
      relations: [
        { predicate: 'flows_through', arguments: ['current', 'wire'], order: 1 },
        { predicate: 'creates_pressure', arguments: ['battery', 'current'], order: 1 },
        { predicate: 'restricts_flow', arguments: ['resistor', 'current'], order: 1 }
      ]
    }
  },

  teacher_gardener: {
    description: 'Teacher <-> Gardener analogy for education',
    source: {
      name: 'Gardening',
      entities: [
        { id: 'gardener', type: 'caretaker', attributes: { role: 'nurturing' } },
        { id: 'plant', type: 'growing_entity', attributes: { stage: 'developing' } },
        { id: 'soil', type: 'environment', attributes: { quality: 'variable' } },
        { id: 'water', type: 'resource', attributes: { essential: true } },
        { id: 'sunlight', type: 'resource', attributes: { essential: true } }
      ],
      relations: [
        { predicate: 'nurtures', arguments: ['gardener', 'plant'], order: 1 },
        { predicate: 'provides', arguments: ['gardener', 'water'], order: 1 },
        { predicate: 'grows_in', arguments: ['plant', 'soil'], order: 1 },
        { predicate: 'needs', arguments: ['plant', 'water'], order: 1 },
        { predicate: 'needs', arguments: ['plant', 'sunlight'], order: 1 },
        { predicate: 'ENABLES', arguments: ['nurtures', 'grows_in'], order: 2 }
      ]
    },
    target: {
      name: 'Education',
      entities: [
        { id: 'teacher', type: 'caretaker', attributes: { role: 'nurturing' } },
        { id: 'student', type: 'growing_entity', attributes: { stage: 'developing' } },
        { id: 'classroom', type: 'environment', attributes: { quality: 'variable' } },
        { id: 'knowledge', type: 'resource', attributes: { essential: true } },
        { id: 'encouragement', type: 'resource', attributes: { essential: true } }
      ],
      relations: [
        { predicate: 'nurtures', arguments: ['teacher', 'student'], order: 1 },
        { predicate: 'provides', arguments: ['teacher', 'knowledge'], order: 1 },
        { predicate: 'grows_in', arguments: ['student', 'classroom'], order: 1 },
        { predicate: 'needs', arguments: ['student', 'knowledge'], order: 1 },
        { predicate: 'needs', arguments: ['student', 'encouragement'], order: 1 }
      ]
    }
  },

  heart_pump: {
    description: 'Heart <-> Mechanical pump analogy',
    source: {
      name: 'Mechanical Pump',
      entities: [
        { id: 'pump', type: 'device', attributes: { function: 'move_fluid' } },
        { id: 'inlet_valve', type: 'valve', attributes: { direction: 'in' } },
        { id: 'outlet_valve', type: 'valve', attributes: { direction: 'out' } },
        { id: 'chamber', type: 'container', attributes: { expandable: true } },
        { id: 'fluid', type: 'substance', attributes: {} }
      ],
      relations: [
        { predicate: 'contains', arguments: ['chamber', 'fluid'], order: 1 },
        { predicate: 'contracts', arguments: ['chamber'], order: 1 },
        { predicate: 'expands', arguments: ['chamber'], order: 1 },
        { predicate: 'opens_during', arguments: ['inlet_valve', 'expands'], order: 1 },
        { predicate: 'opens_during', arguments: ['outlet_valve', 'contracts'], order: 1 },
        { predicate: 'CAUSE', arguments: ['contracts', 'ejects_fluid'], order: 2 }
      ]
    },
    target: {
      name: 'Heart',
      entities: [
        { id: 'heart', type: 'organ', attributes: { function: 'move_fluid' } },
        { id: 'tricuspid', type: 'valve', attributes: { direction: 'in' } },
        { id: 'pulmonary', type: 'valve', attributes: { direction: 'out' } },
        { id: 'ventricle', type: 'container', attributes: { expandable: true } },
        { id: 'blood', type: 'substance', attributes: {} }
      ],
      relations: [
        { predicate: 'contains', arguments: ['ventricle', 'blood'], order: 1 },
        { predicate: 'contracts', arguments: ['ventricle'], order: 1 },
        { predicate: 'expands', arguments: ['ventricle'], order: 1 },
        { predicate: 'opens_during', arguments: ['tricuspid', 'expands'], order: 1 },
        { predicate: 'opens_during', arguments: ['pulmonary', 'contracts'], order: 1 }
      ]
    }
  }
};

// ============================================================================
// STRUCTURE MAPPING ENGINE (SME)
// ============================================================================

function findEntityMappings(source: Domain, target: Domain): Map<string, string[]> {
  const candidates = new Map<string, string[]>();

  for (const sourceEntity of source.entities) {
    const matches: string[] = [];
    for (const targetEntity of target.entities) {
      // Type matching
      if (sourceEntity.type === targetEntity.type) {
        matches.push(targetEntity.id);
      }
      // Attribute similarity
      const attrOverlap = Object.keys(sourceEntity.attributes).filter(
        k => targetEntity.attributes[k] !== undefined
      ).length;
      if (attrOverlap > 0) {
        if (!matches.includes(targetEntity.id)) {
          matches.push(targetEntity.id);
        }
      }
    }
    candidates.set(sourceEntity.id, matches);
  }

  return candidates;
}

function computeStructuralMatch(
  sourceRel: Relation,
  targetRel: Relation,
  entityMapping: Map<string, string>
): number {
  // Predicate match
  if (sourceRel.predicate !== targetRel.predicate) return 0;

  // Argument structure match
  if (sourceRel.arguments.length !== targetRel.arguments.length) return 0;

  let matchScore = 1.0;

  for (let i = 0; i < sourceRel.arguments.length; i++) {
    const sourceArg = sourceRel.arguments[i];
    const targetArg = targetRel.arguments[i];
    const mappedArg = entityMapping.get(sourceArg);

    if (mappedArg === targetArg) {
      matchScore *= 1.0;
    } else if (mappedArg === undefined) {
      matchScore *= 0.5; // Could potentially map
    } else {
      matchScore *= 0.1; // Inconsistent mapping
    }
  }

  return matchScore;
}

function generateMappings(source: Domain, target: Domain): Mapping[] {
  const entityCandidates = findEntityMappings(source, target);
  const mappings: Mapping[] = [];

  // Generate initial entity mappings via greedy matching
  function generateMapping(
    remaining: string[],
    current: Map<string, string>,
    usedTargets: Set<string>
  ): Map<string, string>[] {
    if (remaining.length === 0) {
      return [new Map(current)];
    }

    const [sourceEntity, ...rest] = remaining;
    const candidates = entityCandidates.get(sourceEntity) || [];
    const results: Map<string, string>[] = [];

    for (const targetEntity of candidates) {
      if (usedTargets.has(targetEntity)) continue;

      const newMapping = new Map(current);
      newMapping.set(sourceEntity, targetEntity);
      const newUsed = new Set(usedTargets);
      newUsed.add(targetEntity);

      results.push(...generateMapping(rest, newMapping, newUsed));
    }

    // Also try not mapping this entity
    results.push(...generateMapping(rest, current, usedTargets));

    return results;
  }

  const sourceEntities = source.entities.map(e => e.id);
  const entityMappingCandidates = generateMapping(sourceEntities, new Map(), new Set());

  // Score each mapping based on structural consistency
  for (const entityMap of entityMappingCandidates) {
    const relationMappings = new Map<string, string>();
    let totalScore = 0;
    let matchCount = 0;

    // Find relation matches
    for (const sourceRel of source.relations) {
      let bestMatch: Relation | null = null;
      let bestScore = 0;

      for (const targetRel of target.relations) {
        const score = computeStructuralMatch(sourceRel, targetRel, entityMap);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = targetRel;
        }
      }

      if (bestMatch && bestScore > 0.5) {
        relationMappings.set(
          `${sourceRel.predicate}(${sourceRel.arguments.join(',')})`,
          `${bestMatch.predicate}(${bestMatch.arguments.join(',')})`
        );
        totalScore += bestScore;
        matchCount++;
      }
    }

    // Compute systematicity (preference for higher-order relations)
    const higherOrderScore = source.relations
      .filter(r => r.order > 1)
      .reduce((sum, r) => {
        const key = `${r.predicate}(${r.arguments.join(',')})`;
        return sum + (relationMappings.has(key) ? 2.0 : 0);
      }, 0);

    const mapping: Mapping = {
      entityMappings: entityMap,
      relationMappings,
      score: totalScore + higherOrderScore,
      structuralConsistency: matchCount / source.relations.length,
      systematicity: higherOrderScore / (source.relations.filter(r => r.order > 1).length || 1)
    };

    if (mapping.score > 0) {
      mappings.push(mapping);
    }
  }

  // Sort by score
  mappings.sort((a, b) => b.score - a.score);

  return mappings.slice(0, 5); // Return top 5
}

// ============================================================================
// INFERENCE AND TRANSFER
// ============================================================================

function inferMissingRelations(
  source: Domain,
  _target: Domain,
  mapping: Mapping
): AnalogySuggestion[] {
  const suggestions: AnalogySuggestion[] = [];

  for (const sourceRel of source.relations) {
    const key = `${sourceRel.predicate}(${sourceRel.arguments.join(',')})`;

    // Check if this relation is already mapped
    if (mapping.relationMappings.has(key)) continue;

    // Try to transfer this relation to target
    const mappedArgs = sourceRel.arguments.map(arg => mapping.entityMappings.get(arg));

    if (mappedArgs.every(arg => arg !== undefined)) {
      const suggestion: AnalogySuggestion = {
        sourceRelation: sourceRel,
        targetRelation: {
          predicate: sourceRel.predicate,
          arguments: mappedArgs as string[],
          order: sourceRel.order
        },
        confidence: calculateTransferConfidence(sourceRel, mapping),
        reasoning: `Transferred from source: ${sourceRel.predicate}(${sourceRel.arguments.join(', ')}) -> ${sourceRel.predicate}(${mappedArgs.join(', ')})`
      };

      suggestions.push(suggestion);
    }
  }

  return suggestions;
}

function calculateTransferConfidence(relation: Relation, mapping: Mapping): number {
  // Higher-order relations have higher confidence
  const orderBonus = relation.order * 0.1;

  // Base confidence on mapping quality
  const baseConfidence = mapping.structuralConsistency;

  return Math.min(1.0, baseConfidence + orderBonus);
}

// ============================================================================
// ANALOGY EVALUATION
// ============================================================================

interface AnalogyEvaluation {
  overallScore: number;
  structuralAlignment: number;
  systematicity: number;
  surfaceSimilarity: number;
  inferentialPower: number;
  critique: string[];
}

function evaluateAnalogy(source: Domain, target: Domain): AnalogyEvaluation {
  const mappings = generateMappings(source, target);
  const bestMapping = mappings[0];

  if (!bestMapping) {
    return {
      overallScore: 0,
      structuralAlignment: 0,
      systematicity: 0,
      surfaceSimilarity: 0,
      inferentialPower: 0,
      critique: ['No valid structural mapping found between domains']
    };
  }

  // Surface similarity (attribute overlap)
  let surfaceMatches = 0;
  let surfaceTotal = 0;
  for (const [sourceId, targetId] of bestMapping.entityMappings) {
    const sourceEntity = source.entities.find(e => e.id === sourceId);
    const targetEntity = target.entities.find(e => e.id === targetId);
    if (sourceEntity && targetEntity) {
      const sourceAttrs = Object.keys(sourceEntity.attributes);
      const targetAttrs = Object.keys(targetEntity.attributes);
      surfaceTotal += sourceAttrs.length;
      surfaceMatches += sourceAttrs.filter(a => targetAttrs.includes(a)).length;
    }
  }
  const surfaceSimilarity = surfaceTotal > 0 ? surfaceMatches / surfaceTotal : 0;

  // Inferential power (how many new relations can be transferred)
  const inferences = inferMissingRelations(source, target, bestMapping);
  const inferentialPower = inferences.length / (source.relations.length || 1);

  // Generate critique
  const critique: string[] = [];

  if (bestMapping.structuralConsistency < 0.5) {
    critique.push('Low structural consistency - many relations do not map well');
  }

  if (surfaceSimilarity > 0.8) {
    critique.push('High surface similarity may indicate literal similarity rather than deep analogy');
  }

  if (bestMapping.systematicity < 0.5) {
    critique.push('Low systematicity - higher-order relations (causal, explanatory) not well preserved');
  }

  if (inferences.length === 0) {
    critique.push('Limited inferential power - analogy does not suggest new relations in target');
  }

  const overallScore = (
    bestMapping.structuralConsistency * 0.4 +
    bestMapping.systematicity * 0.3 +
    inferentialPower * 0.2 +
    (1 - surfaceSimilarity) * 0.1 // Penalize pure surface similarity
  );

  return {
    overallScore,
    structuralAlignment: bestMapping.structuralConsistency,
    systematicity: bestMapping.systematicity,
    surfaceSimilarity,
    inferentialPower,
    critique: critique.length > 0 ? critique : ['Analogy appears structurally sound']
  };
}

// ============================================================================
// ANALOGY GENERATION
// ============================================================================

const DOMAIN_TEMPLATES: Record<string, Partial<Domain>> = {
  physical_system: {
    entities: [
      { id: 'container', type: 'container', attributes: { function: 'hold' } },
      { id: 'substance', type: 'flowing_entity', attributes: {} },
      { id: 'source', type: 'generator', attributes: {} },
      { id: 'restrictor', type: 'controller', attributes: {} }
    ],
    relations: [
      { predicate: 'contains', arguments: ['container', 'substance'], order: 1 },
      { predicate: 'generates', arguments: ['source', 'substance'], order: 1 },
      { predicate: 'restricts', arguments: ['restrictor', 'substance'], order: 1 }
    ]
  },
  biological_system: {
    entities: [
      { id: 'organism', type: 'living_entity', attributes: {} },
      { id: 'resource', type: 'required_input', attributes: {} },
      { id: 'environment', type: 'context', attributes: {} }
    ],
    relations: [
      { predicate: 'lives_in', arguments: ['organism', 'environment'], order: 1 },
      { predicate: 'needs', arguments: ['organism', 'resource'], order: 1 },
      { predicate: 'adapts_to', arguments: ['organism', 'environment'], order: 1 }
    ]
  },
  social_system: {
    entities: [
      { id: 'agent', type: 'actor', attributes: {} },
      { id: 'resource', type: 'desired_object', attributes: {} },
      { id: 'institution', type: 'structure', attributes: {} }
    ],
    relations: [
      { predicate: 'participates_in', arguments: ['agent', 'institution'], order: 1 },
      { predicate: 'competes_for', arguments: ['agent', 'resource'], order: 1 },
      { predicate: 'governed_by', arguments: ['agent', 'institution'], order: 1 }
    ]
  }
};

function generateAnalogies(domain: Domain): Array<{ target: string; score: number; mapping: Mapping }> {
  const results: Array<{ target: string; score: number; mapping: Mapping }> = [];

  // Try to find structural matches in templates
  for (const [templateName, template] of Object.entries(DOMAIN_TEMPLATES)) {
    const fullTemplate: Domain = {
      name: templateName,
      entities: template.entities || [],
      relations: template.relations || []
    };

    const mappings = generateMappings(domain, fullTemplate);
    if (mappings.length > 0 && mappings[0].score > 0.3) {
      results.push({
        target: templateName,
        score: mappings[0].score,
        mapping: mappings[0]
      });
    }
  }

  // Sort by score
  results.sort((a, b) => b.score - a.score);

  return results;
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export const analogicalreasoningTool: UnifiedTool = {
  name: 'analogical_reasoning',
  description: `Analogical reasoning using Structure Mapping Theory (SMT). Operations:
- map: Find structural correspondences between source and target domains
- transfer: Infer missing relations in target domain based on source
- evaluate: Assess analogy quality (structural alignment, systematicity, etc.)
- generate: Generate potential analogies for a given domain
- classic: Explore classic analogies (solar-atom, water-electricity, etc.)
- info: Documentation on SMT and analogical reasoning`,
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['map', 'transfer', 'evaluate', 'generate', 'classic', 'info', 'examples'],
        description: 'Operation to perform'
      },
      analogy: {
        type: 'string',
        enum: ['solar_atom', 'water_electricity', 'teacher_gardener', 'heart_pump'],
        description: 'Classic analogy name'
      },
      source: {
        type: 'object',
        description: 'Source domain definition'
      },
      target: {
        type: 'object',
        description: 'Target domain definition'
      }
    },
    required: ['operation']
  }
};

export async function executeanalogicalreasoning(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;

    switch (args.operation) {
      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'Analogical Reasoning',
            theory: 'Structure Mapping Theory (Gentner, 1983)',
            description: 'Analogies work by mapping relational structure, not surface features',
            principles: {
              structural_consistency: 'Mappings must preserve argument structure of relations',
              systematicity: 'Prefer mappings that include higher-order relations (causal, explanatory)',
              one_to_one: 'Each element maps to at most one element in other domain'
            },
            types_of_similarity: {
              literal_similarity: 'High attribute + high relational overlap',
              analogy: 'Low attribute + high relational overlap',
              mere_appearance: 'High attribute + low relational overlap',
              anomaly: 'Low attribute + low relational overlap'
            },
            applications: [
              'Scientific discovery (Rutherford atom model)',
              'Problem solving (transfer solutions across domains)',
              'Explanation (use familiar domain to explain unfamiliar)',
              'Education (scaffolding new concepts)'
            ]
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                description: 'Explore the classic solar system / atom analogy',
                call: { operation: 'classic', analogy: 'solar_atom' }
              },
              {
                description: 'Evaluate analogy quality',
                call: { operation: 'evaluate', analogy: 'water_electricity' }
              },
              {
                description: 'Transfer knowledge between domains',
                call: { operation: 'transfer', analogy: 'teacher_gardener' }
              }
            ]
          }, null, 2)
        };
      }

      case 'classic': {
        const analogyName = args.analogy || 'solar_atom';
        const analogyDef = CLASSIC_ANALOGIES[analogyName];
        if (!analogyDef) {
          throw new Error(`Unknown analogy: ${analogyName}. Available: ${Object.keys(CLASSIC_ANALOGIES).join(', ')}`);
        }

        const mappings = generateMappings(analogyDef.source, analogyDef.target);
        const evaluation = evaluateAnalogy(analogyDef.source, analogyDef.target);

        return {
          toolCallId: id,
          content: JSON.stringify({
            analogy: analogyName,
            description: analogyDef.description,
            source: {
              name: analogyDef.source.name,
              entities: analogyDef.source.entities.map(e => e.id),
              relations: analogyDef.source.relations.map(r => `${r.predicate}(${r.arguments.join(', ')})`)
            },
            target: {
              name: analogyDef.target.name,
              entities: analogyDef.target.entities.map(e => e.id),
              relations: analogyDef.target.relations.map(r => `${r.predicate}(${r.arguments.join(', ')})`)
            },
            bestMapping: mappings[0] ? {
              entities: Object.fromEntries(mappings[0].entityMappings),
              relations: Object.fromEntries(mappings[0].relationMappings),
              score: mappings[0].score.toFixed(3)
            } : null,
            evaluation: {
              overallScore: evaluation.overallScore.toFixed(3),
              structuralAlignment: evaluation.structuralAlignment.toFixed(3),
              systematicity: evaluation.systematicity.toFixed(3),
              critique: evaluation.critique
            }
          }, null, 2)
        };
      }

      case 'map': {
        const analogyName = args.analogy;
        let source: Domain, target: Domain;

        if (analogyName && CLASSIC_ANALOGIES[analogyName]) {
          source = CLASSIC_ANALOGIES[analogyName].source;
          target = CLASSIC_ANALOGIES[analogyName].target;
        } else if (args.source && args.target) {
          source = args.source as Domain;
          target = args.target as Domain;
        } else {
          throw new Error('Provide either analogy name or source/target domains');
        }

        const mappings = generateMappings(source, target);

        return {
          toolCallId: id,
          content: JSON.stringify({
            sourceDomain: source.name,
            targetDomain: target.name,
            mappingsFound: mappings.length,
            mappings: mappings.map((m, i) => ({
              rank: i + 1,
              entityMappings: Object.fromEntries(m.entityMappings),
              relationMappings: Object.fromEntries(m.relationMappings),
              score: m.score.toFixed(3),
              structuralConsistency: m.structuralConsistency.toFixed(3),
              systematicity: m.systematicity.toFixed(3)
            }))
          }, null, 2)
        };
      }

      case 'transfer': {
        const analogyName = args.analogy;
        let source: Domain, target: Domain;

        if (analogyName && CLASSIC_ANALOGIES[analogyName]) {
          source = CLASSIC_ANALOGIES[analogyName].source;
          target = CLASSIC_ANALOGIES[analogyName].target;
        } else if (args.source && args.target) {
          source = args.source as Domain;
          target = args.target as Domain;
        } else {
          throw new Error('Provide either analogy name or source/target domains');
        }

        const mappings = generateMappings(source, target);
        if (mappings.length === 0) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              error: 'No valid mappings found for knowledge transfer'
            }, null, 2)
          };
        }

        const inferences = inferMissingRelations(source, target, mappings[0]);

        return {
          toolCallId: id,
          content: JSON.stringify({
            sourceDomain: source.name,
            targetDomain: target.name,
            mappingUsed: {
              entities: Object.fromEntries(mappings[0].entityMappings),
              score: mappings[0].score.toFixed(3)
            },
            inferredRelations: inferences.map(inf => ({
              relation: `${inf.targetRelation.predicate}(${inf.targetRelation.arguments.join(', ')})`,
              confidence: inf.confidence.toFixed(3),
              reasoning: inf.reasoning
            })),
            note: 'These relations are suggested by analogy but should be verified empirically'
          }, null, 2)
        };
      }

      case 'evaluate': {
        const analogyName = args.analogy;
        let source: Domain, target: Domain;

        if (analogyName && CLASSIC_ANALOGIES[analogyName]) {
          source = CLASSIC_ANALOGIES[analogyName].source;
          target = CLASSIC_ANALOGIES[analogyName].target;
        } else if (args.source && args.target) {
          source = args.source as Domain;
          target = args.target as Domain;
        } else {
          throw new Error('Provide either analogy name or source/target domains');
        }

        const evaluation = evaluateAnalogy(source, target);

        return {
          toolCallId: id,
          content: JSON.stringify({
            sourceDomain: source.name,
            targetDomain: target.name,
            evaluation: {
              overallScore: evaluation.overallScore.toFixed(3),
              metrics: {
                structuralAlignment: {
                  score: evaluation.structuralAlignment.toFixed(3),
                  description: 'How well relations map between domains'
                },
                systematicity: {
                  score: evaluation.systematicity.toFixed(3),
                  description: 'Preservation of higher-order (causal/explanatory) relations'
                },
                surfaceSimilarity: {
                  score: evaluation.surfaceSimilarity.toFixed(3),
                  description: 'Attribute overlap (lower is more "analogical")'
                },
                inferentialPower: {
                  score: evaluation.inferentialPower.toFixed(3),
                  description: 'Ability to transfer new knowledge'
                }
              },
              critique: evaluation.critique
            },
            interpretation: evaluation.overallScore > 0.7 ? 'Strong analogy' :
              evaluation.overallScore > 0.4 ? 'Moderate analogy' : 'Weak analogy'
          }, null, 2)
        };
      }

      case 'generate': {
        let domain: Domain;

        if (args.analogy && CLASSIC_ANALOGIES[args.analogy]) {
          domain = CLASSIC_ANALOGIES[args.analogy].source;
        } else if (args.source) {
          domain = args.source as Domain;
        } else {
          throw new Error('Provide source domain for analogy generation');
        }

        const analogies = generateAnalogies(domain);

        return {
          toolCallId: id,
          content: JSON.stringify({
            sourceDomain: domain.name,
            potentialAnalogies: analogies.map(a => ({
              targetTemplate: a.target,
              matchScore: a.score.toFixed(3),
              suggestedMappings: Object.fromEntries(a.mapping.entityMappings)
            })),
            note: 'These are structural templates that may provide analogical insight'
          }, null, 2)
        };
      }

      default:
        throw new Error(`Unknown operation: ${args.operation}. Use 'info' for help.`);
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function isanalogicalreasoningAvailable(): boolean {
  return true;
}
