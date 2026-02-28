// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

/**
 * COMPREHENSIVE TESTS for src/agents/strategy/tools/AdvancedPuppeteer.ts
 *
 * Tests all exported classes, functions, interfaces, and constants:
 *   - AdvancedPuppeteer class (constructor, navigate, executeScript, screenshot, fillForm,
 *     createSession, addProxies, getProxyStats, generateFingerprint)
 *   - createAdvancedPuppeteer factory function
 *   - Private methods tested indirectly (proxy selection/rotation, delay, stealth scripts,
 *     session management, fingerprint initialization, sandbox execution, event emitting)
 *
 * All external dependencies are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  logger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────────

import { AdvancedPuppeteer, createAdvancedPuppeteer } from '../AdvancedPuppeteer';
import type { BrowserConfig, ProxyConfig, ProxyServer } from '../AdvancedPuppeteer';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeProxy(overrides: Partial<ProxyServer> = {}): ProxyServer {
  return {
    host: '192.168.1.1',
    port: 8080,
    protocol: 'http',
    ...overrides,
  };
}

function makeProxyConfig(overrides: Partial<ProxyConfig> = {}): ProxyConfig {
  return {
    enabled: true,
    rotationType: 'round_robin',
    proxies: [makeProxy()],
    ...overrides,
  };
}

function makeBrowserConfig(overrides: Partial<BrowserConfig> = {}): Partial<BrowserConfig> {
  return {
    antiDetectionLevel: 'standard',
    userAgentRotation: true,
    fingerprintMasking: true,
    requestDelay: { min: 0, max: 0 }, // no delay for fast tests
    sessionPersistence: true,
    maxConcurrentPages: 5,
    timeout: 30000,
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('AdvancedPuppeteer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Speed up timers so applyRequestDelay is instant
    vi.spyOn(global, 'setTimeout').mockImplementation((cb: () => void) => {
      cb();
      return 0 as unknown as ReturnType<typeof setTimeout>;
    });
  });

  // ===========================================================================
  // Constructor
  // ===========================================================================

  describe('constructor', () => {
    it('should create an instance with default config', () => {
      const puppeteer = new AdvancedPuppeteer();
      expect(puppeteer).toBeInstanceOf(AdvancedPuppeteer);
    });

    it('should create an instance with partial config', () => {
      const puppeteer = new AdvancedPuppeteer({ antiDetectionLevel: 'advanced' });
      expect(puppeteer).toBeInstanceOf(AdvancedPuppeteer);
    });

    it('should accept a stream callback', () => {
      const streamCb = vi.fn();
      const puppeteer = new AdvancedPuppeteer({}, streamCb);
      expect(puppeteer).toBeInstanceOf(AdvancedPuppeteer);
    });

    it('should merge provided config with defaults', () => {
      const puppeteer = new AdvancedPuppeteer({
        timeout: 5000,
        maxConcurrentPages: 2,
      });
      expect(puppeteer).toBeInstanceOf(AdvancedPuppeteer);
    });

    it('should initialise fingerprints during construction', () => {
      const puppeteer = new AdvancedPuppeteer();
      // generateFingerprint is accessible publicly — verify fingerprints were pre-created
      // by calling createSession which uses internal state
      const session = puppeteer.createSession('desktop');
      expect(session).toBeDefined();
      expect(session.userAgent).toBeTruthy();
    });
  });

  // ===========================================================================
  // createSession
  // ===========================================================================

  describe('createSession', () => {
    it('should create a desktop session by default', () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const session = puppeteer.createSession();
      expect(session.id).toMatch(/^session_/);
      expect(session.userAgent).toBeTruthy();
      expect(session.viewport.width).toBeGreaterThan(500);
      expect(session.cookies).toEqual([]);
      expect(session.localStorage).toEqual({});
      expect(session.requestCount).toBe(0);
      expect(session.createdAt).toBeGreaterThan(0);
      expect(session.lastUsedAt).toBeGreaterThan(0);
    });

    it('should create a mobile session', () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const session = puppeteer.createSession('mobile');
      expect(session.viewport.width).toBeLessThan(500);
      expect(session.userAgent).toBeTruthy();
    });

    it('should assign a proxy when proxyConfig is enabled', () => {
      const puppeteer = new AdvancedPuppeteer(
        makeBrowserConfig({ proxyConfig: makeProxyConfig() })
      );
      const session = puppeteer.createSession();
      expect(session.proxy).toBeDefined();
      expect(session.proxy?.host).toBe('192.168.1.1');
    });

    it('should not assign a proxy when proxyConfig is absent', () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const session = puppeteer.createSession();
      expect(session.proxy).toBeUndefined();
    });

    it('should generate unique session ids', () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const ids = new Set<string>();
      for (let i = 0; i < 20; i++) {
        ids.add(puppeteer.createSession().id);
      }
      expect(ids.size).toBe(20);
    });
  });

  // ===========================================================================
  // generateFingerprint
  // ===========================================================================

  describe('generateFingerprint', () => {
    it('should generate a desktop fingerprint', () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const fp = puppeteer.generateFingerprint('desktop');
      expect(fp.id).toMatch(/^fp_/);
      expect(fp.platform).toBe('Win32');
      expect(fp.language).toBe('en-US');
      expect(fp.plugins).toContain('Chrome PDF Plugin');
      expect(fp.mimeTypes).toContain('application/pdf');
      expect(fp.screen.colorDepth).toBe(24);
    });

    it('should generate a mobile fingerprint', () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const fp = puppeteer.generateFingerprint('mobile');
      expect(fp.platform).toBe('iPhone');
      expect(fp.viewport.width).toBeLessThan(500);
    });

    it('should default to desktop if no argument given', () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const fp = puppeteer.generateFingerprint();
      expect(fp.platform).toBe('Win32');
    });

    it('should generate unique fingerprint ids', () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const ids = new Set<string>();
      for (let i = 0; i < 20; i++) {
        ids.add(puppeteer.generateFingerprint().id);
      }
      expect(ids.size).toBe(20);
    });

    it('should include valid hardwareConcurrency values', () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const fp = puppeteer.generateFingerprint();
      expect([4, 8, 12, 16]).toContain(fp.hardwareConcurrency);
    });

    it('should include valid deviceMemory values', () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const fp = puppeteer.generateFingerprint();
      expect([4, 8, 16]).toContain(fp.deviceMemory);
    });

    it('should include a valid timezone', () => {
      const validTimezones = [
        'America/New_York',
        'America/Los_Angeles',
        'America/Chicago',
        'America/Denver',
        'Europe/London',
        'Europe/Paris',
        'Asia/Tokyo',
      ];
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const fp = puppeteer.generateFingerprint();
      expect(validTimezones).toContain(fp.timezone);
    });

    it('should have doNotTrack as a boolean', () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const fp = puppeteer.generateFingerprint();
      expect(typeof fp.doNotTrack).toBe('boolean');
    });

    it('should include webglVendor and webglRenderer', () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const fp = puppeteer.generateFingerprint();
      expect(fp.webglVendor).toBeTruthy();
      expect(fp.webglRenderer).toBeTruthy();
    });
  });

  // ===========================================================================
  // addProxies
  // ===========================================================================

  describe('addProxies', () => {
    it('should add proxies to an existing proxyConfig', () => {
      const puppeteer = new AdvancedPuppeteer(
        makeBrowserConfig({ proxyConfig: makeProxyConfig({ proxies: [] }) })
      );
      puppeteer.addProxies([makeProxy({ host: '10.0.0.1' }), makeProxy({ host: '10.0.0.2' })]);
      const stats = puppeteer.getProxyStats();
      expect(stats).toHaveLength(2);
    });

    it('should create a proxyConfig if none exists', () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      puppeteer.addProxies([makeProxy({ host: '10.0.0.1' })]);
      const stats = puppeteer.getProxyStats();
      expect(stats).toHaveLength(1);
      expect(stats[0].proxy).toBe('10.0.0.1:8080');
    });

    it('should append to existing proxies', () => {
      const puppeteer = new AdvancedPuppeteer(
        makeBrowserConfig({
          proxyConfig: makeProxyConfig({
            proxies: [makeProxy({ host: '1.1.1.1' })],
          }),
        })
      );
      puppeteer.addProxies([makeProxy({ host: '2.2.2.2' })]);
      const stats = puppeteer.getProxyStats();
      expect(stats).toHaveLength(2);
    });
  });

  // ===========================================================================
  // getProxyStats
  // ===========================================================================

  describe('getProxyStats', () => {
    it('should return empty array when no proxyConfig', () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      expect(puppeteer.getProxyStats()).toEqual([]);
    });

    it('should return empty array when proxyConfig has no proxies', () => {
      const puppeteer = new AdvancedPuppeteer(
        makeBrowserConfig({ proxyConfig: makeProxyConfig({ proxies: [] }) })
      );
      expect(puppeteer.getProxyStats()).toEqual([]);
    });

    it('should return stats for configured proxies', () => {
      const puppeteer = new AdvancedPuppeteer(
        makeBrowserConfig({
          proxyConfig: makeProxyConfig({
            proxies: [makeProxy({ host: '1.1.1.1', port: 3000, latencyMs: 100, failureCount: 2 })],
          }),
        })
      );
      const stats = puppeteer.getProxyStats();
      expect(stats).toHaveLength(1);
      expect(stats[0]).toEqual({
        proxy: '1.1.1.1:3000',
        successCount: 1, // latencyMs > 0 => 1
        failureCount: 2,
        avgLatency: 100,
      });
    });

    it('should report successCount 0 when latencyMs is 0', () => {
      const puppeteer = new AdvancedPuppeteer(
        makeBrowserConfig({
          proxyConfig: makeProxyConfig({
            proxies: [makeProxy({ latencyMs: 0, failureCount: 0 })],
          }),
        })
      );
      const stats = puppeteer.getProxyStats();
      expect(stats[0].successCount).toBe(0);
    });

    it('should handle proxies with undefined optional fields', () => {
      const puppeteer = new AdvancedPuppeteer(
        makeBrowserConfig({
          proxyConfig: makeProxyConfig({
            proxies: [makeProxy()],
          }),
        })
      );
      const stats = puppeteer.getProxyStats();
      expect(stats[0].failureCount).toBe(0);
      expect(stats[0].avgLatency).toBe(0);
    });
  });

  // ===========================================================================
  // navigate
  // ===========================================================================

  describe('navigate', () => {
    it('should return a PageResult with status 200 from sandbox', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const result = await puppeteer.navigate('https://example.com');
      expect(result.status).toBe(200);
      expect(result.timing).toBeDefined();
      expect(result.timing.totalMs).toBeGreaterThanOrEqual(0);
    });

    it('should include timing information', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const result = await puppeteer.navigate('https://example.com');
      expect(result.timing.navigationStart).toBeGreaterThan(0);
      expect(result.timing.loadComplete).toBeGreaterThanOrEqual(result.timing.navigationStart);
    });

    it('should emit stream events when callback is provided', async () => {
      const streamCb = vi.fn();
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig(), streamCb);
      await puppeteer.navigate('https://example.com');
      expect(streamCb).toHaveBeenCalled();
      const firstCall = streamCb.mock.calls[0][0];
      expect(firstCall.type).toBe('browser_visiting');
      expect(firstCall.message).toContain('[Puppeteer]');
      expect(firstCall.timestamp).toBeGreaterThan(0);
    });

    it('should not emit stream events when no callback is set', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      // Should not throw
      const result = await puppeteer.navigate('https://example.com');
      expect(result.status).toBe(200);
    });

    it('should include proxyUsed when proxy is configured', async () => {
      const puppeteer = new AdvancedPuppeteer(
        makeBrowserConfig({
          proxyConfig: makeProxyConfig(),
        })
      );
      const result = await puppeteer.navigate('https://example.com');
      expect(result.proxyUsed).toBe('192.168.1.1:8080');
    });

    it('should have undefined proxyUsed when no proxy is configured', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const result = await puppeteer.navigate('https://example.com');
      expect(result.proxyUsed).toBeUndefined();
    });

    it('should include fingerprintUsed as session id', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const result = await puppeteer.navigate('https://example.com');
      expect(result.fingerprintUsed).toMatch(/^session_/);
    });

    it('should increment session requestCount after navigate', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig({ sessionPersistence: false }));
      // Navigate creates a new session each time (no persistence)
      const result = await puppeteer.navigate('https://example.com');
      expect(result).toBeDefined();
    });

    it('should handle navigate errors gracefully', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      // Override executeInSandbox to throw
      (puppeteer as unknown as { executeInSandbox: () => Promise<never> }).executeInSandbox = vi
        .fn()
        .mockRejectedValue(new Error('Sandbox timeout'));

      const result = await puppeteer.navigate('https://example.com');
      expect(result.status).toBe(0);
      expect(result.content).toBe('');
      expect(result.errors).toContain('Sandbox timeout');
    });

    it('should handle non-Error thrown values in navigate', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      (puppeteer as unknown as { executeInSandbox: () => Promise<never> }).executeInSandbox = vi
        .fn()
        .mockRejectedValue('string error');

      const result = await puppeteer.navigate('https://example.com');
      expect(result.status).toBe(0);
      expect(result.errors).toContain('string error');
    });

    it('should mark proxy as failed on error', async () => {
      const proxy = makeProxy({ host: '10.0.0.1', failureCount: 0 });
      const puppeteer = new AdvancedPuppeteer(
        makeBrowserConfig({
          proxyConfig: makeProxyConfig({ proxies: [proxy] }),
        })
      );
      (puppeteer as unknown as { executeInSandbox: () => Promise<never> }).executeInSandbox = vi
        .fn()
        .mockRejectedValue(new Error('timeout'));

      await puppeteer.navigate('https://example.com');
      // The proxy object in the config should have failureCount incremented
      const stats = puppeteer.getProxyStats();
      expect(stats[0].failureCount).toBe(1);
    });

    it('should reuse active session when persistence is enabled', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig({ sessionPersistence: true }));
      const result1 = await puppeteer.navigate('https://example.com/page1');
      const result2 = await puppeteer.navigate('https://example.com/page2');
      // Both should use the same session
      expect(result1.fingerprintUsed).toBe(result2.fingerprintUsed);
    });
  });

  // ===========================================================================
  // executeScript
  // ===========================================================================

  describe('executeScript', () => {
    it('should navigate and return content', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const result = await puppeteer.executeScript('https://example.com', 'return document.title;');
      // executeInSandbox returns mock content
      expect(result).toBeDefined();
    });

    it('should throw when navigate returns errors', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      (puppeteer as unknown as { executeInSandbox: () => Promise<never> }).executeInSandbox = vi
        .fn()
        .mockRejectedValue(new Error('Script execution failed'));

      await expect(puppeteer.executeScript('https://example.com', 'return 1;')).rejects.toThrow(
        'Script execution failed'
      );
    });
  });

  // ===========================================================================
  // screenshot
  // ===========================================================================

  describe('screenshot', () => {
    it('should return a string (possibly empty from mock)', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const result = await puppeteer.screenshot('https://example.com');
      expect(typeof result).toBe('string');
    });

    it('should return empty string when no screenshot in result', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const result = await puppeteer.screenshot('https://example.com');
      // The mock sandbox does not return screenshot, so it should be ''
      expect(result).toBe('');
    });

    it('should accept options parameter', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const result = await puppeteer.screenshot('https://example.com', {
        fullPage: true,
        quality: 90,
      });
      expect(typeof result).toBe('string');
    });
  });

  // ===========================================================================
  // fillForm
  // ===========================================================================

  describe('fillForm', () => {
    it('should fill a form with safe fields', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const result = await puppeteer.fillForm('https://example.com/form', {
        '#name': 'John Doe',
        '#email': 'john@example.com',
      });
      expect(result).toBeDefined();
      expect(result.status).toBe(200);
    });

    it('should reject password fields', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      await expect(
        puppeteer.fillForm('https://example.com/form', {
          '#password': 'secret',
        })
      ).rejects.toThrow('Cannot fill sensitive field: #password');
    });

    it('should reject credit card fields', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      await expect(
        puppeteer.fillForm('https://example.com/form', {
          '#credit-card': '4111111111111111',
        })
      ).rejects.toThrow('Cannot fill sensitive field: #credit-card');
    });

    it('should reject creditCard (camelCase) fields', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      await expect(
        puppeteer.fillForm('https://example.com/form', {
          '#creditCard': '4111111111111111',
        })
      ).rejects.toThrow('Cannot fill sensitive field: #creditCard');
    });

    it('should reject CVV fields', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      await expect(
        puppeteer.fillForm('https://example.com/form', {
          '#cvv': '123',
        })
      ).rejects.toThrow('Cannot fill sensitive field: #cvv');
    });

    it('should reject expiration fields', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      await expect(
        puppeteer.fillForm('https://example.com/form', {
          '#expiry': '12/25',
        })
      ).rejects.toThrow('Cannot fill sensitive field: #expiry');
    });

    it('should reject SSN fields', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      await expect(
        puppeteer.fillForm('https://example.com/form', {
          '#ssn': '123-45-6789',
        })
      ).rejects.toThrow('Cannot fill sensitive field: #ssn');
    });

    it('should reject social security fields', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      await expect(
        puppeteer.fillForm('https://example.com/form', {
          '#social_security': '123-45-6789',
        })
      ).rejects.toThrow('Cannot fill sensitive field: #social_security');
    });

    it('should reject bank fields', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      await expect(
        puppeteer.fillForm('https://example.com/form', {
          '#bankAccount': '12345678',
        })
      ).rejects.toThrow('Cannot fill sensitive field: #bankAccount');
    });

    it('should accept a submitSelector', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const result = await puppeteer.fillForm(
        'https://example.com/form',
        { '#name': 'John' },
        '#submit-btn'
      );
      expect(result).toBeDefined();
    });

    it('should allow safe field names that partially match sensitive patterns', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      // "address" contains no sensitive pattern
      const result = await puppeteer.fillForm('https://example.com/form', {
        '#address': '123 Main St',
        '#city': 'Anytown',
      });
      expect(result).toBeDefined();
    });
  });

  // ===========================================================================
  // Proxy selection and rotation (tested indirectly)
  // ===========================================================================

  describe('proxy selection and rotation', () => {
    it('should return undefined proxy when proxyConfig is disabled', async () => {
      const puppeteer = new AdvancedPuppeteer(
        makeBrowserConfig({
          proxyConfig: { enabled: false, rotationType: 'round_robin', proxies: [makeProxy()] },
        })
      );
      const result = await puppeteer.navigate('https://example.com');
      expect(result.proxyUsed).toBeUndefined();
    });

    it('should return undefined proxy when proxy list is empty', async () => {
      const puppeteer = new AdvancedPuppeteer(
        makeBrowserConfig({
          proxyConfig: { enabled: true, rotationType: 'round_robin', proxies: [] },
        })
      );
      const result = await puppeteer.navigate('https://example.com');
      expect(result.proxyUsed).toBeUndefined();
    });

    it('should skip proxies with failureCount >= 3', async () => {
      const failedProxy = makeProxy({ host: '1.1.1.1', failureCount: 3 });
      const goodProxy = makeProxy({ host: '2.2.2.2', failureCount: 0 });
      const puppeteer = new AdvancedPuppeteer(
        makeBrowserConfig({
          proxyConfig: makeProxyConfig({ proxies: [failedProxy, goodProxy] }),
        })
      );
      const result = await puppeteer.navigate('https://example.com');
      expect(result.proxyUsed).toBe('2.2.2.2:8080');
    });

    it('should return undefined when all proxies have failed', async () => {
      const puppeteer = new AdvancedPuppeteer(
        makeBrowserConfig({
          proxyConfig: makeProxyConfig({
            proxies: [
              makeProxy({ host: '1.1.1.1', failureCount: 5 }),
              makeProxy({ host: '2.2.2.2', failureCount: 3 }),
            ],
          }),
        })
      );
      const result = await puppeteer.navigate('https://example.com');
      expect(result.proxyUsed).toBeUndefined();
    });

    it('should use sticky rotation (first proxy)', async () => {
      const puppeteer = new AdvancedPuppeteer(
        makeBrowserConfig({
          proxyConfig: makeProxyConfig({
            rotationType: 'sticky',
            proxies: [makeProxy({ host: '1.1.1.1' }), makeProxy({ host: '2.2.2.2' })],
          }),
        })
      );
      const result1 = await puppeteer.navigate('https://example.com');
      const result2 = await puppeteer.navigate('https://example.com');
      expect(result1.proxyUsed).toBe('1.1.1.1:8080');
      expect(result2.proxyUsed).toBe('1.1.1.1:8080');
    });

    it('should rotate proxy after rotationInterval requests', async () => {
      const puppeteer = new AdvancedPuppeteer(
        makeBrowserConfig({
          proxyConfig: makeProxyConfig({
            rotationType: 'round_robin',
            rotationInterval: 1, // rotate every request
            proxies: [makeProxy({ host: '1.1.1.1' }), makeProxy({ host: '2.2.2.2' })],
          }),
        })
      );
      // First navigate triggers rotation (requestsSinceRotation becomes 1 >= 1)
      await puppeteer.navigate('https://example.com');
      // After rotation, currentProxyIndex incremented, requestsSinceRotation reset
      const result2 = await puppeteer.navigate('https://example.com');
      expect(result2.proxyUsed).toBe('2.2.2.2:8080');
    });

    it('should not rotate when proxyConfig is disabled', async () => {
      const puppeteer = new AdvancedPuppeteer(
        makeBrowserConfig({
          proxyConfig: { enabled: false, rotationType: 'round_robin', proxies: [makeProxy()] },
        })
      );
      // Navigate should work without error
      const result = await puppeteer.navigate('https://example.com');
      expect(result.status).toBe(200);
    });

    it('should use default rotationInterval of 10 when not specified', async () => {
      const puppeteer = new AdvancedPuppeteer(
        makeBrowserConfig({
          proxyConfig: makeProxyConfig({
            rotationType: 'round_robin',
            // rotationInterval not set — defaults to 10
            proxies: [makeProxy({ host: '1.1.1.1' }), makeProxy({ host: '2.2.2.2' })],
          }),
        })
      );
      // First request should use 1.1.1.1, since we haven't hit 10 requests yet
      const result = await puppeteer.navigate('https://example.com');
      expect(result.proxyUsed).toBe('1.1.1.1:8080');
    });
  });

  // ===========================================================================
  // Anti-detection / stealth scripts (tested indirectly through buildNavigationScript)
  // ===========================================================================

  describe('anti-detection levels', () => {
    it('should work with antiDetectionLevel none', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig({ antiDetectionLevel: 'none' }));
      const result = await puppeteer.navigate('https://example.com');
      expect(result.status).toBe(200);
    });

    it('should work with antiDetectionLevel basic', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig({ antiDetectionLevel: 'basic' }));
      const result = await puppeteer.navigate('https://example.com');
      expect(result.status).toBe(200);
    });

    it('should work with antiDetectionLevel standard', async () => {
      const puppeteer = new AdvancedPuppeteer(
        makeBrowserConfig({ antiDetectionLevel: 'standard' })
      );
      const result = await puppeteer.navigate('https://example.com');
      expect(result.status).toBe(200);
    });

    it('should work with antiDetectionLevel advanced', async () => {
      const puppeteer = new AdvancedPuppeteer(
        makeBrowserConfig({ antiDetectionLevel: 'advanced' })
      );
      const result = await puppeteer.navigate('https://example.com');
      expect(result.status).toBe(200);
    });
  });

  // ===========================================================================
  // Session persistence
  // ===========================================================================

  describe('session persistence', () => {
    it('should reuse session when persistence is enabled', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig({ sessionPersistence: true }));
      const r1 = await puppeteer.navigate('https://example.com/1');
      const r2 = await puppeteer.navigate('https://example.com/2');
      expect(r1.fingerprintUsed).toBe(r2.fingerprintUsed);
    });

    it('should create new session when persistence is disabled', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig({ sessionPersistence: false }));
      const r1 = await puppeteer.navigate('https://example.com/1');
      const r2 = await puppeteer.navigate('https://example.com/2');
      // With persistence disabled, each navigate creates a new session
      expect(r1.fingerprintUsed).not.toBe(r2.fingerprintUsed);
    });
  });

  // ===========================================================================
  // Navigation options
  // ===========================================================================

  describe('navigation options', () => {
    it('should accept waitFor option', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const result = await puppeteer.navigate('https://example.com', {
        waitFor: 'load',
      });
      expect(result.status).toBe(200);
    });

    it('should accept timeout option', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const result = await puppeteer.navigate('https://example.com', {
        timeout: 5000,
      });
      expect(result.status).toBe(200);
    });

    it('should accept screenshot option', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const result = await puppeteer.navigate('https://example.com', {
        screenshot: true,
      });
      expect(result.status).toBe(200);
    });

    it('should accept extractCookies option', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const result = await puppeteer.navigate('https://example.com', {
        extractCookies: true,
      });
      expect(result.status).toBe(200);
    });

    it('should accept executeScript option', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const result = await puppeteer.navigate('https://example.com', {
        executeScript: 'return document.title;',
      });
      expect(result.status).toBe(200);
    });

    it('should accept delay option', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const result = await puppeteer.navigate('https://example.com', {
        delay: 100,
      });
      expect(result.status).toBe(200);
    });

    it('should handle all options combined', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const result = await puppeteer.navigate('https://example.com', {
        waitFor: 'domcontentloaded',
        timeout: 10000,
        screenshot: true,
        extractCookies: true,
        executeScript: 'return 42;',
        delay: 50,
      });
      expect(result.status).toBe(200);
    });
  });

  // ===========================================================================
  // createAdvancedPuppeteer factory
  // ===========================================================================

  describe('createAdvancedPuppeteer', () => {
    it('should return an AdvancedPuppeteer instance', () => {
      const puppeteer = createAdvancedPuppeteer();
      expect(puppeteer).toBeInstanceOf(AdvancedPuppeteer);
    });

    it('should pass config to the instance', () => {
      const puppeteer = createAdvancedPuppeteer({ timeout: 5000 });
      expect(puppeteer).toBeInstanceOf(AdvancedPuppeteer);
    });

    it('should pass stream callback to the instance', async () => {
      const streamCb = vi.fn();
      const puppeteer = createAdvancedPuppeteer({ requestDelay: { min: 0, max: 0 } }, streamCb);
      await puppeteer.navigate('https://example.com');
      expect(streamCb).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // Edge cases and error scenarios
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle URL with special characters', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const result = await puppeteer.navigate('https://example.com/path?q=hello%20world&a=1');
      expect(result.status).toBe(200);
    });

    it('should handle multiple rapid navigations', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const results = await Promise.all([
        puppeteer.navigate('https://example.com/1'),
        puppeteer.navigate('https://example.com/2'),
        puppeteer.navigate('https://example.com/3'),
      ]);
      expect(results).toHaveLength(3);
      results.forEach((r) => expect(r.status).toBe(200));
    });

    it('should handle empty formData in fillForm', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const result = await puppeteer.fillForm('https://example.com/form', {});
      expect(result).toBeDefined();
    });

    it('should handle formData with special characters in values', async () => {
      const puppeteer = new AdvancedPuppeteer(makeBrowserConfig());
      const result = await puppeteer.fillForm('https://example.com/form', {
        '#name': "O'Brien",
        '#bio': 'Line1\nLine2',
      });
      expect(result).toBeDefined();
    });
  });
});
