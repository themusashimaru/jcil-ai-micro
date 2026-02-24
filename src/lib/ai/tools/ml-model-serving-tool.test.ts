import { describe, it, expect } from 'vitest';
import {
  executeMlModelServing,
  isMlModelServingAvailable,
  mlModelServingTool,
} from './ml-model-serving-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'ml_model_serving', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executeMlModelServing(makeCall(args));
  return JSON.parse(res.content);
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('mlModelServingTool metadata', () => {
  it('should have correct name', () => {
    expect(mlModelServingTool.name).toBe('ml_model_serving');
  });

  it('should require operation', () => {
    expect(mlModelServingTool.parameters.required).toContain('operation');
  });
});

describe('isMlModelServingAvailable', () => {
  it('should return true', () => {
    expect(isMlModelServingAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// API operation
// -------------------------------------------------------------------
describe('executeMlModelServing - api', () => {
  it('should design a classification API with defaults', async () => {
    const result = await getResult({ operation: 'api' });
    expect(result.api).toBeDefined();
    expect(result.api.endpoint).toBe('/v1/predict');
    expect(result.api.method).toBe('POST');
    expect(result.serverImplementation).toBeDefined();
    expect(result.dockerfile).toBeDefined();
    expect(result.kubernetes).toBeDefined();
    expect(result.loadTesting).toBeDefined();
  });

  it('should design an NLP API', async () => {
    const result = await getResult({
      operation: 'api',
      config: { modelType: 'nlp', framework: 'huggingface' },
    });
    expect(result.api.request).toBeDefined();
    expect(result.loadTesting.expectedLatency).toBe('100-500ms');
  });

  it('should design a vision API', async () => {
    const result = await getResult({
      operation: 'api',
      config: { modelType: 'vision', framework: 'tensorflow' },
    });
    expect(result.api.request).toBeDefined();
    expect(result.dockerfile).toContain('tensorflow');
    expect(result.kubernetes).toContain('nvidia.com/gpu');
  });

  it('should design an embedding API', async () => {
    const result = await getResult({
      operation: 'api',
      config: { modelType: 'embedding' },
    });
    expect(result.api.request).toBeDefined();
    expect(result.loadTesting.expectedLatency).toBe('10-50ms');
  });

  it('should include batching in pytorch server', async () => {
    const result = await getResult({
      operation: 'api',
      config: { framework: 'pytorch', batchingEnabled: true },
    });
    expect(result.serverImplementation).toContain('BatchProcessor');
    expect(result.loadTesting.recommendedBatchSize).toBe(32);
  });

  it('should omit batching when disabled', async () => {
    const result = await getResult({
      operation: 'api',
      config: { framework: 'pytorch', batchingEnabled: false },
    });
    expect(result.serverImplementation).not.toContain('BatchProcessor');
    expect(result.loadTesting.recommendedBatchSize).toBe(1);
  });

  it('should generate ONNX dockerfile', async () => {
    const result = await getResult({
      operation: 'api',
      config: { framework: 'onnx' },
    });
    expect(result.dockerfile).toContain('onnxruntime');
  });
});

// -------------------------------------------------------------------
// A/B test operation
// -------------------------------------------------------------------
describe('executeMlModelServing - ab_test', () => {
  it('should design AB test with defaults', async () => {
    const result = await getResult({ operation: 'ab_test' });
    expect(result.experiment).toBeDefined();
    expect(result.experiment.name).toBe('model_v1_vs_model_v2');
    expect(result.implementation).toBeDefined();
    expect(result.analysis).toBeDefined();
    expect(result.statisticalSignificance).toBeDefined();
  });

  it('should design AB test with custom config', async () => {
    const result = await getResult({
      operation: 'ab_test',
      config: {
        modelA: 'resnet50',
        modelB: 'efficientnet',
        trafficSplit: 70,
        metrics: ['latency', 'accuracy'],
      },
    });
    expect(result.experiment.name).toBe('resnet50_vs_efficientnet');
    expect(result.experiment.trafficSplit.resnet50).toBe(70);
    expect(result.experiment.trafficSplit.efficientnet).toBe(30);
    expect(result.experiment.metrics).toEqual(['latency', 'accuracy']);
  });
});

// -------------------------------------------------------------------
// Registry operation
// -------------------------------------------------------------------
describe('executeMlModelServing - registry', () => {
  it('should design model registry', async () => {
    const result = await getResult({ operation: 'registry' });
    expect(result.schema).toBeDefined();
    expect(result.schema.model).toBeDefined();
    expect(result.implementation).toBeDefined();
    expect(result.cli).toBeDefined();
  });
});

// -------------------------------------------------------------------
// Feature store operation
// -------------------------------------------------------------------
describe('executeMlModelServing - feature_store', () => {
  it('should design feature store', async () => {
    const result = await getResult({ operation: 'feature_store' });
    expect(result.architecture).toBeDefined();
    expect(result.featureDefinition).toBeDefined();
    expect(result.retrieval).toBeDefined();
    expect(result.bestPractices).toBeDefined();
    expect(result.bestPractices.length).toBeGreaterThan(0);
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeMlModelServing - errors', () => {
  it('should handle unknown operation', async () => {
    const res = await executeMlModelServing(makeCall({ operation: 'xyz' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Unknown operation');
  });

  it('should return toolCallId', async () => {
    const res = await executeMlModelServing({
      id: 'my-id',
      name: 'ml_model_serving',
      arguments: { operation: 'api' },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
