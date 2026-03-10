// @ts-nocheck - Test file with extensive mocking
/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { BaseAgent } from '../BaseAgent';

// ---------------------------------------------------------------------------
// Concrete implementation for testing the abstract class
// ---------------------------------------------------------------------------

class TestAgent extends BaseAgent<string, string> {
  name = 'test-agent';
  description = 'Agent for testing BaseAgent';
  version = '1.0.0';

  async execute(input, context, onStream) {
    this.startExecution();
    this.emit(onStream, 'thinking', 'Starting...');
    this.incrementIteration();
    this.trackSource('source-1');

    if (input === 'fail') {
      return this.failure('Test failure');
    }

    return this.success(`Processed: ${input}`, 0.9);
  }

  canHandle(input) {
    return typeof input === 'string';
  }

  // Expose protected methods for testing
  public testEmit(...args) {
    return this.emit(...args);
  }
  public testStartExecution() {
    return this.startExecution();
  }
  public testGetExecutionTime() {
    return this.getExecutionTime();
  }
  public testIncrementIteration() {
    return this.incrementIteration();
  }
  public testTrackSource(source) {
    return this.trackSource(source);
  }
  public testBuildMetadata(score) {
    return this.buildMetadata(score);
  }
  public testSuccess(data, score) {
    return this.success(data, score);
  }
  public testFailure(error) {
    return this.failure(error);
  }
  public testSleep(ms) {
    return this.sleep(ms);
  }
  public testWithRetry(fn, retries?, delay?) {
    return this.withRetry(fn, retries, delay);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BaseAgent', () => {
  let agent: TestAgent;

  beforeEach(() => {
    agent = new TestAgent();
  });

  // =========================================================================
  // Properties
  // =========================================================================

  describe('properties', () => {
    it('should have name', () => {
      expect(agent.name).toBe('test-agent');
    });

    it('should have description', () => {
      expect(agent.description).toBe('Agent for testing BaseAgent');
    });

    it('should have version', () => {
      expect(agent.version).toBe('1.0.0');
    });
  });

  // =========================================================================
  // execute
  // =========================================================================

  describe('execute', () => {
    it('should return success result', async () => {
      const onStream = vi.fn();
      const result = await agent.execute('hello', {} as any, onStream);
      expect(result.success).toBe(true);
      expect(result.data).toBe('Processed: hello');
    });

    it('should return failure result', async () => {
      const onStream = vi.fn();
      const result = await agent.execute('fail', {} as any, onStream);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Test failure');
    });

    it('should emit stream events', async () => {
      const onStream = vi.fn();
      await agent.execute('test', {} as any, onStream);
      expect(onStream).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'thinking',
          message: 'Starting...',
        })
      );
    });

    it('should include metadata in result', async () => {
      const onStream = vi.fn();
      const result = await agent.execute('test', {} as any, onStream);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata.iterations).toBe(1);
    });
  });

  // =========================================================================
  // canHandle
  // =========================================================================

  describe('canHandle', () => {
    it('should return true for valid input', () => {
      expect(agent.canHandle('hello')).toBe(true);
    });

    it('should return false for invalid input', () => {
      expect(agent.canHandle(123)).toBe(false);
      expect(agent.canHandle(null)).toBe(false);
    });
  });

  // =========================================================================
  // emit
  // =========================================================================

  describe('emit', () => {
    it('should call onStream with event', () => {
      const onStream = vi.fn();
      agent.testEmit(onStream, 'thinking', 'Hello');
      expect(onStream).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'thinking',
          message: 'Hello',
          timestamp: expect.any(Number),
        })
      );
    });

    it('should include optional progress', () => {
      const onStream = vi.fn();
      agent.testEmit(onStream, 'progress', 'Working', { progress: 50 });
      expect(onStream).toHaveBeenCalledWith(expect.objectContaining({ progress: 50 }));
    });

    it('should include optional phase', () => {
      const onStream = vi.fn();
      agent.testEmit(onStream, 'phase', 'New phase', { phase: 'build' });
      expect(onStream).toHaveBeenCalledWith(expect.objectContaining({ phase: 'build' }));
    });

    it('should include optional details', () => {
      const onStream = vi.fn();
      agent.testEmit(onStream, 'data', 'Details', { details: { key: 'val' } });
      expect(onStream).toHaveBeenCalledWith(expect.objectContaining({ details: { key: 'val' } }));
    });
  });

  // =========================================================================
  // startExecution
  // =========================================================================

  describe('startExecution', () => {
    it('should reset iteration count', () => {
      agent.testIncrementIteration();
      agent.testIncrementIteration();
      agent.testStartExecution();
      expect(agent.testBuildMetadata(1).iterations).toBe(0);
    });

    it('should clear sources', () => {
      agent.testTrackSource('a');
      agent.testStartExecution();
      expect(agent.testBuildMetadata(1).sourcesUsed).toEqual([]);
    });
  });

  // =========================================================================
  // getExecutionTime
  // =========================================================================

  describe('getExecutionTime', () => {
    it('should return non-negative value after startExecution', () => {
      agent.testStartExecution();
      expect(agent.testGetExecutionTime()).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // incrementIteration
  // =========================================================================

  describe('incrementIteration', () => {
    it('should increment counter', () => {
      agent.testStartExecution();
      agent.testIncrementIteration();
      agent.testIncrementIteration();
      expect(agent.testBuildMetadata(1).iterations).toBe(2);
    });
  });

  // =========================================================================
  // trackSource
  // =========================================================================

  describe('trackSource', () => {
    it('should add source to set', () => {
      agent.testStartExecution();
      agent.testTrackSource('api');
      expect(agent.testBuildMetadata(1).sourcesUsed).toContain('api');
    });

    it('should deduplicate sources', () => {
      agent.testStartExecution();
      agent.testTrackSource('api');
      agent.testTrackSource('api');
      expect(agent.testBuildMetadata(1).sourcesUsed).toHaveLength(1);
    });

    it('should track multiple sources', () => {
      agent.testStartExecution();
      agent.testTrackSource('api');
      agent.testTrackSource('db');
      expect(agent.testBuildMetadata(1).sourcesUsed).toHaveLength(2);
    });
  });

  // =========================================================================
  // buildMetadata
  // =========================================================================

  describe('buildMetadata', () => {
    it('should include executionTime', () => {
      agent.testStartExecution();
      const meta = agent.testBuildMetadata(0.8);
      expect(meta.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should include confidenceScore', () => {
      agent.testStartExecution();
      expect(agent.testBuildMetadata(0.8).confidenceScore).toBe(0.8);
    });

    it('should include iterations', () => {
      agent.testStartExecution();
      agent.testIncrementIteration();
      expect(agent.testBuildMetadata(1).iterations).toBe(1);
    });

    it('should include sourcesUsed as array', () => {
      agent.testStartExecution();
      agent.testTrackSource('x');
      const meta = agent.testBuildMetadata(1);
      expect(Array.isArray(meta.sourcesUsed)).toBe(true);
    });
  });

  // =========================================================================
  // success / failure
  // =========================================================================

  describe('success', () => {
    it('should return success=true with data', () => {
      agent.testStartExecution();
      const result = agent.testSuccess('data', 0.9);
      expect(result.success).toBe(true);
      expect(result.data).toBe('data');
    });

    it('should include metadata with confidence', () => {
      agent.testStartExecution();
      const result = agent.testSuccess('data', 0.75);
      expect(result.metadata.confidenceScore).toBe(0.75);
    });
  });

  describe('failure', () => {
    it('should return success=false with error', () => {
      agent.testStartExecution();
      const result = agent.testFailure('something broke');
      expect(result.success).toBe(false);
      expect(result.error).toBe('something broke');
    });

    it('should set confidence to 0', () => {
      agent.testStartExecution();
      const result = agent.testFailure('error');
      expect(result.metadata.confidenceScore).toBe(0);
    });
  });

  // =========================================================================
  // withRetry
  // =========================================================================

  describe('withRetry', () => {
    it('should return result on first success', async () => {
      const fn = vi.fn().mockResolvedValue('ok');
      const result = await agent.testWithRetry(fn, 3, 1);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = vi.fn().mockRejectedValueOnce(new Error('fail1')).mockResolvedValue('ok');
      const result = await agent.testWithRetry(fn, 3, 1);
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always fails'));
      await expect(agent.testWithRetry(fn, 2, 1)).rejects.toThrow('always fails');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should handle non-Error throws', async () => {
      const fn = vi.fn().mockRejectedValue('string error');
      await expect(agent.testWithRetry(fn, 1, 1)).rejects.toThrow('string error');
    });
  });
});
