import { describe, it, expect, vi } from 'vitest';

// Mock all external dependencies that the re-exported modules use
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
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{}' }],
      }),
    },
  })),
}));

import {
  CognitiveDebugger,
  getCognitiveDebugger,
  PredictiveAnalyzer,
  IntentFailureMapper,
  DeepExecutionTracer,
  PatternRecognizer,
  MultiDimensionalAnalyzer,
  CognitiveReasoningEngine,
  CodeFlowVisualizer,
  UniversalDebugger,
} from './index';

describe('index.ts - Barrel Exports', () => {
  describe('Class exports', () => {
    it('should export CognitiveDebugger', () => {
      expect(CognitiveDebugger).toBeDefined();
      expect(typeof CognitiveDebugger).toBe('function');
    });

    it('should export getCognitiveDebugger', () => {
      expect(getCognitiveDebugger).toBeDefined();
      expect(typeof getCognitiveDebugger).toBe('function');
    });

    it('should export PredictiveAnalyzer', () => {
      expect(PredictiveAnalyzer).toBeDefined();
      expect(typeof PredictiveAnalyzer).toBe('function');
    });

    it('should export IntentFailureMapper', () => {
      expect(IntentFailureMapper).toBeDefined();
      expect(typeof IntentFailureMapper).toBe('function');
    });

    it('should export DeepExecutionTracer', () => {
      expect(DeepExecutionTracer).toBeDefined();
      expect(typeof DeepExecutionTracer).toBe('function');
    });

    it('should export PatternRecognizer', () => {
      expect(PatternRecognizer).toBeDefined();
      expect(typeof PatternRecognizer).toBe('function');
    });

    it('should export MultiDimensionalAnalyzer', () => {
      expect(MultiDimensionalAnalyzer).toBeDefined();
      expect(typeof MultiDimensionalAnalyzer).toBe('function');
    });

    it('should export CognitiveReasoningEngine', () => {
      expect(CognitiveReasoningEngine).toBeDefined();
      expect(typeof CognitiveReasoningEngine).toBe('function');
    });

    it('should export CodeFlowVisualizer', () => {
      expect(CodeFlowVisualizer).toBeDefined();
      expect(typeof CodeFlowVisualizer).toBe('function');
    });

    it('should export UniversalDebugger', () => {
      expect(UniversalDebugger).toBeDefined();
      expect(typeof UniversalDebugger).toBe('function');
    });
  });

  describe('Class instantiation', () => {
    it('CognitiveDebugger should be instantiable', () => {
      const instance = new CognitiveDebugger();
      expect(instance).toBeInstanceOf(CognitiveDebugger);
    });

    it('PredictiveAnalyzer should be instantiable', () => {
      const instance = new PredictiveAnalyzer();
      expect(instance).toBeInstanceOf(PredictiveAnalyzer);
    });

    it('IntentFailureMapper should be instantiable', () => {
      const instance = new IntentFailureMapper();
      expect(instance).toBeInstanceOf(IntentFailureMapper);
    });

    it('DeepExecutionTracer should be instantiable', () => {
      const instance = new DeepExecutionTracer();
      expect(instance).toBeInstanceOf(DeepExecutionTracer);
    });

    it('PatternRecognizer should be instantiable', () => {
      const instance = new PatternRecognizer();
      expect(instance).toBeInstanceOf(PatternRecognizer);
    });

    it('MultiDimensionalAnalyzer should be instantiable', () => {
      const instance = new MultiDimensionalAnalyzer();
      expect(instance).toBeInstanceOf(MultiDimensionalAnalyzer);
    });

    it('CognitiveReasoningEngine should be instantiable', () => {
      const instance = new CognitiveReasoningEngine();
      expect(instance).toBeInstanceOf(CognitiveReasoningEngine);
    });

    it('CodeFlowVisualizer should be instantiable', () => {
      const instance = new CodeFlowVisualizer();
      expect(instance).toBeInstanceOf(CodeFlowVisualizer);
    });

    it('UniversalDebugger should be instantiable', () => {
      const instance = new UniversalDebugger();
      expect(instance).toBeInstanceOf(UniversalDebugger);
    });
  });

  describe('getCognitiveDebugger singleton', () => {
    it('should return a CognitiveDebugger instance', () => {
      const instance = getCognitiveDebugger();
      expect(instance).toBeInstanceOf(CognitiveDebugger);
    });
  });
});
