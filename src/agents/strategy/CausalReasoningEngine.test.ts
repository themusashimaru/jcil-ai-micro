import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import Anthropic from '@anthropic-ai/sdk';
import {
  CausalReasoningEngine,
  createCausalReasoningEngine,
  type CausalGraph,
  type CausalNode,
  type CausalEdge,
  type Confounder,
  type InterventionPoint,
  type CausalChain,
  type CounterfactualAnalysis,
  type RootCauseAnalysis,
  type CausalAnalysisResult,
} from './CausalReasoningEngine';

describe('CausalReasoningEngine type exports', () => {
  it('should export CausalGraph interface', () => {
    const graph: CausalGraph = {
      nodes: [],
      edges: [],
      rootCauses: [],
      finalEffects: [],
      confounders: [],
      interventionPoints: [],
    };
    expect(graph.nodes).toEqual([]);
    expect(graph.rootCauses).toEqual([]);
  });

  it('should export CausalNode interface', () => {
    const node: CausalNode = {
      id: 'n1',
      name: 'Housing Prices',
      type: 'cause',
      description: 'Rising housing prices',
      sourceIds: ['src-1'],
      confidence: 0.9,
    };
    expect(node.type).toBe('cause');
  });

  it('should export CausalEdge interface', () => {
    const edge: CausalEdge = {
      id: 'e1',
      fromNodeId: 'n1',
      toNodeId: 'n2',
      mechanism: 'Supply and demand',
      strength: 'strong',
      temporalOrder: 'short_term',
      confidence: 0.8,
      evidence: ['Statistical correlation'],
      isDirectCause: true,
    };
    expect(edge.strength).toBe('strong');
  });

  it('should export Confounder interface', () => {
    const conf: Confounder = {
      id: 'c1',
      name: 'Interest rates',
      affectedRelationships: [
        { causeId: 'n1', effectId: 'n2', confoundingMechanism: 'Rate changes affect both' },
      ],
      severity: 'high',
    };
    expect(conf.affectedRelationships).toHaveLength(1);
  });

  it('should export InterventionPoint interface', () => {
    const ip: InterventionPoint = {
      id: 'int1',
      nodeId: 'n1',
      name: 'Intervene on prices',
      interventionType: 'block',
      description: 'Block price increases',
      expectedImpact: 'Reduces downstream effects',
      feasibility: 'medium',
      cost: 'high',
      downstreamEffects: ['n2', 'n3'],
    };
    expect(ip.interventionType).toBe('block');
  });

  it('should export CausalChain interface', () => {
    const chain: CausalChain = {
      id: 'ch-1',
      nodes: [],
      edges: [],
      description: 'Prices -> Demand -> Supply',
      totalStrength: 0.7,
      confidence: 0.8,
    };
    expect(chain.totalStrength).toBe(0.7);
  });

  it('should export CounterfactualAnalysis interface', () => {
    const cf: CounterfactualAnalysis = {
      scenario: 'What if rates stayed low?',
      intervention: 'Keep rates at 2%',
      predictedOutcome: 'Prices would be higher',
      confidence: 0.6,
      assumptions: ['No external shocks'],
      limitations: ['Historical data limited'],
    };
    expect(cf.confidence).toBe(0.6);
  });

  it('should export RootCauseAnalysis interface', () => {
    const rca: RootCauseAnalysis = {
      problem: 'Housing affordability crisis',
      rootCauses: [
        {
          cause: 'Supply shortage',
          mechanism: 'Low inventory',
          confidence: 0.85,
          evidence: ['Census data'],
          priority: 'critical',
        },
      ],
      contributingFactors: ['Low interest rates'],
      recommendations: ['Build more housing'],
    };
    expect(rca.rootCauses).toHaveLength(1);
  });

  it('should export CausalAnalysisResult interface', () => {
    const result: CausalAnalysisResult = {
      graph: {
        nodes: [],
        edges: [],
        rootCauses: [],
        finalEffects: [],
        confounders: [],
        interventionPoints: [],
      },
      chains: [],
      counterfactuals: [],
      keyInsights: ['Key insight'],
      timestamp: Date.now(),
    };
    expect(result.keyInsights).toHaveLength(1);
  });
});

describe('CausalReasoningEngine', () => {
  let engine: CausalReasoningEngine;
  let mockClient: Anthropic;

  beforeEach(() => {
    mockClient = new Anthropic();
    engine = new CausalReasoningEngine(mockClient);
  });

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(engine).toBeInstanceOf(CausalReasoningEngine);
    });

    it('should accept optional onStream', () => {
      const e = new CausalReasoningEngine(mockClient, vi.fn());
      expect(e).toBeInstanceOf(CausalReasoningEngine);
    });
  });

  describe('methods', () => {
    it('should have analyze method', () => {
      expect(typeof engine.analyze).toBe('function');
    });

    it('should have identifyInterventionPoints method', () => {
      expect(typeof engine.identifyInterventionPoints).toBe('function');
    });

    it('should have calculateCausalEffect method', () => {
      expect(typeof engine.calculateCausalEffect).toBe('function');
    });

    it('should have getHistory method', () => {
      expect(typeof engine.getHistory).toBe('function');
    });
  });

  describe('getHistory', () => {
    it('should return empty array initially', () => {
      expect(engine.getHistory()).toEqual([]);
    });
  });

  describe('identifyInterventionPoints', () => {
    it('should return empty array for empty graph', () => {
      const graph: CausalGraph = {
        nodes: [],
        edges: [],
        rootCauses: [],
        finalEffects: [],
        confounders: [],
        interventionPoints: [],
      };
      expect(engine.identifyInterventionPoints(graph)).toEqual([]);
    });

    it('should identify mediator nodes with multiple outgoing edges', () => {
      const graph: CausalGraph = {
        nodes: [
          {
            id: 'n1',
            name: 'Root',
            type: 'cause',
            description: 'A root cause',
            sourceIds: [],
            confidence: 0.9,
          },
          {
            id: 'n2',
            name: 'Mediator',
            type: 'mediator',
            description: 'A mediating factor',
            sourceIds: [],
            confidence: 0.8,
          },
          {
            id: 'n3',
            name: 'Effect1',
            type: 'effect',
            description: 'First effect',
            sourceIds: [],
            confidence: 0.7,
          },
          {
            id: 'n4',
            name: 'Effect2',
            type: 'effect',
            description: 'Second effect',
            sourceIds: [],
            confidence: 0.7,
          },
        ],
        edges: [
          {
            id: 'e1',
            fromNodeId: 'n1',
            toNodeId: 'n2',
            mechanism: 'causes',
            strength: 'strong',
            temporalOrder: 'short_term',
            confidence: 0.9,
            evidence: ['Data'],
            isDirectCause: true,
          },
          {
            id: 'e2',
            fromNodeId: 'n2',
            toNodeId: 'n3',
            mechanism: 'causes',
            strength: 'moderate',
            temporalOrder: 'short_term',
            confidence: 0.8,
            evidence: ['Data'],
            isDirectCause: true,
          },
          {
            id: 'e3',
            fromNodeId: 'n2',
            toNodeId: 'n4',
            mechanism: 'causes',
            strength: 'weak',
            temporalOrder: 'long_term',
            confidence: 0.7,
            evidence: ['Data'],
            isDirectCause: true,
          },
        ],
        rootCauses: [],
        finalEffects: [],
        confounders: [],
        interventionPoints: [],
      };
      const points = engine.identifyInterventionPoints(graph);
      expect(points.length).toBeGreaterThan(0);
      expect(points[0].nodeId).toBe('n2');
      expect(points[0].interventionType).toBe('block');
    });

    it('should identify root cause nodes', () => {
      const graph: CausalGraph = {
        nodes: [
          {
            id: 'n1',
            name: 'Root',
            type: 'cause',
            description: 'Root cause',
            sourceIds: [],
            confidence: 0.9,
          },
          {
            id: 'n2',
            name: 'Effect',
            type: 'effect',
            description: 'Effect',
            sourceIds: [],
            confidence: 0.7,
          },
        ],
        edges: [
          {
            id: 'e1',
            fromNodeId: 'n1',
            toNodeId: 'n2',
            mechanism: 'causes',
            strength: 'strong',
            temporalOrder: 'immediate',
            confidence: 0.9,
            evidence: ['Data'],
            isDirectCause: true,
          },
        ],
        rootCauses: ['n1'],
        finalEffects: [],
        confounders: [],
        interventionPoints: [],
      };
      const points = engine.identifyInterventionPoints(graph);
      expect(points.some((p) => p.interventionType === 'remove')).toBe(true);
    });
  });

  describe('calculateCausalEffect', () => {
    it('should return zero effect for disconnected nodes', () => {
      const graph: CausalGraph = {
        nodes: [
          { id: 'n1', name: 'A', type: 'cause', description: 'A', sourceIds: [], confidence: 0.9 },
          { id: 'n2', name: 'B', type: 'effect', description: 'B', sourceIds: [], confidence: 0.9 },
        ],
        edges: [],
        rootCauses: [],
        finalEffects: [],
        confounders: [],
        interventionPoints: [],
      };
      const result = engine.calculateCausalEffect(graph, 'n1', 'n2');
      expect(result.totalEffect).toBe(0);
      expect(result.paths).toEqual([]);
    });

    it('should find direct causal effect', () => {
      const graph: CausalGraph = {
        nodes: [
          { id: 'n1', name: 'A', type: 'cause', description: 'A', sourceIds: [], confidence: 0.9 },
          { id: 'n2', name: 'B', type: 'effect', description: 'B', sourceIds: [], confidence: 0.9 },
        ],
        edges: [
          {
            id: 'e1',
            fromNodeId: 'n1',
            toNodeId: 'n2',
            mechanism: 'causes',
            strength: 'strong',
            temporalOrder: 'immediate',
            confidence: 0.8,
            evidence: ['Data'],
            isDirectCause: true,
          },
        ],
        rootCauses: [],
        finalEffects: [],
        confounders: [],
        interventionPoints: [],
      };
      const result = engine.calculateCausalEffect(graph, 'n1', 'n2');
      expect(result.totalEffect).toBeGreaterThan(0);
      expect(result.paths.length).toBeGreaterThan(0);
    });
  });
});

describe('createCausalReasoningEngine', () => {
  it('should return an instance', () => {
    const client = new Anthropic();
    expect(createCausalReasoningEngine(client)).toBeInstanceOf(CausalReasoningEngine);
  });

  it('should accept optional onStream', () => {
    const client = new Anthropic();
    expect(createCausalReasoningEngine(client, vi.fn())).toBeInstanceOf(CausalReasoningEngine);
  });
});
