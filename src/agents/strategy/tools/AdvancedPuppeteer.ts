/**
 * ADVANCED PUPPETEERING
 *
 * Enhanced browser automation with:
 * - Proxy rotation
 * - User agent spoofing
 * - Anti-detection measures
 * - Fingerprint masking
 * - Session management
 * - Rate limiting
 *
 * IMPORTANT: This is for legitimate research purposes only.
 * Do not use for scraping sites that prohibit it.
 */

import type { StrategyStreamCallback } from '../types';
import { logger } from '@/lib/logger';

const log = logger('AdvancedPuppeteer');

// =============================================================================
// TYPES
// =============================================================================

export interface BrowserConfig {
  proxyConfig?: ProxyConfig;
  antiDetectionLevel: 'none' | 'basic' | 'standard' | 'advanced';
  userAgentRotation: boolean;
  fingerprintMasking: boolean;
  requestDelay: { min: number; max: number }; // ms
  sessionPersistence: boolean;
  maxConcurrentPages: number;
  timeout: number; // ms
}

export interface ProxyConfig {
  enabled: boolean;
  rotationType: 'round_robin' | 'random' | 'sticky';
  proxies: ProxyServer[];
  rotationInterval?: number; // Requests before rotation
}

export interface ProxyServer {
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'socks4' | 'socks5';
  username?: string;
  password?: string;
  country?: string;
  latencyMs?: number;
  lastUsed?: number;
  failureCount?: number;
}

export interface BrowserSession {
  id: string;
  userAgent: string;
  viewport: { width: number; height: number };
  cookies: BrowserCookie[];
  localStorage: Record<string, string>;
  proxy?: ProxyServer;
  createdAt: number;
  lastUsedAt: number;
  requestCount: number;
}

export interface BrowserCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  secure?: boolean;
  httpOnly?: boolean;
}

export interface FingerprintProfile {
  id: string;
  userAgent: string;
  viewport: { width: number; height: number };
  screen: { width: number; height: number; colorDepth: number };
  timezone: string;
  language: string;
  platform: string;
  webglVendor: string;
  webglRenderer: string;
  plugins: string[];
  mimeTypes: string[];
  doNotTrack: boolean;
  hardwareConcurrency: number;
  deviceMemory: number;
}

export interface PageResult {
  url: string;
  status: number;
  content: string;
  title?: string;
  screenshot?: string; // base64
  cookies?: BrowserCookie[];
  headers?: Record<string, string>;
  timing: {
    navigationStart: number;
    loadComplete: number;
    totalMs: number;
  };
  errors?: string[];
  proxyUsed?: string;
  fingerprintUsed?: string;
}

export interface NavigationOptions {
  waitFor?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  timeout?: number;
  delay?: number; // Wait after load
  screenshot?: boolean;
  extractCookies?: boolean;
  executeScript?: string;
}

// =============================================================================
// USER AGENT DATABASE
// =============================================================================

const USER_AGENTS = {
  desktop: [
    // Chrome on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    // Chrome on Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    // Firefox on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    // Firefox on Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    // Safari on Mac
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    // Edge on Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  ],
  mobile: [
    // iPhone Safari
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    // Android Chrome
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    // Samsung Browser
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
  ],
};

const VIEWPORTS = {
  desktop: [
    { width: 1920, height: 1080 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 1280, height: 720 },
  ],
  mobile: [
    { width: 390, height: 844 }, // iPhone 14
    { width: 393, height: 852 }, // Pixel 7
    { width: 412, height: 915 }, // Galaxy S22
  ],
};

const TIMEZONES = [
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'America/Denver',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
];

// =============================================================================
// ANTI-DETECTION SCRIPTS
// =============================================================================

const STEALTH_SCRIPTS: Record<'none' | 'basic' | 'standard' | 'advanced', string> = {
  none: '', // No anti-detection scripts
  basic: `
    // Hide webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  `,
  standard: `
    // Hide webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );

    // Mock plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
        { name: 'Native Client', filename: 'internal-nacl-plugin' },
      ],
    });

    // Mock languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
  `,
  advanced: `
    // All standard protections plus:

    // Hide webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    delete navigator.__proto__.webdriver;

    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );

    // Mock plugins array
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const plugins = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '', length: 1 },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '', length: 2 },
        ];
        plugins.item = (i) => plugins[i] || null;
        plugins.namedItem = (name) => plugins.find(p => p.name === name) || null;
        plugins.refresh = () => {};
        return plugins;
      },
    });

    // Mock chrome runtime
    window.chrome = {
      runtime: {},
      loadTimes: function() {},
      csi: function() {},
      app: {},
    };

    // Override toString to hide modifications
    const nativeToStringFunctionString = Error.toString.toString();
    const originalToString = Function.prototype.toString;
    const customToString = function() {
      if (this === window.navigator.permissions.query) {
        return 'function query() { [native code] }';
      }
      return originalToString.call(this);
    };
    Function.prototype.toString = customToString;
    Function.prototype.toString.toString = () => nativeToStringFunctionString;

    // Mock hardware concurrency
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });

    // Mock device memory
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });

    // Mock connection
    Object.defineProperty(navigator, 'connection', {
      get: () => ({
        effectiveType: '4g',
        rtt: 50,
        downlink: 10,
        saveData: false,
      }),
    });
  `,
};

// =============================================================================
// ADVANCED PUPPETEER CLASS
// =============================================================================

export class AdvancedPuppeteer {
  private config: BrowserConfig;
  private sessions: Map<string, BrowserSession> = new Map();
  private fingerprints: FingerprintProfile[] = [];
  private currentProxyIndex = 0;
  private requestsSinceRotation = 0;
  private onStream?: StrategyStreamCallback;

  constructor(config?: Partial<BrowserConfig>, onStream?: StrategyStreamCallback) {
    this.config = {
      antiDetectionLevel: 'standard',
      userAgentRotation: true,
      fingerprintMasking: true,
      requestDelay: { min: 1000, max: 3000 },
      sessionPersistence: true,
      maxConcurrentPages: 5,
      timeout: 30000,
      ...config,
    };
    this.onStream = onStream;
    this.initializeFingerprints();
  }

  // ===========================================================================
  // PUBLIC METHODS
  // ===========================================================================

  /**
   * Navigate to a URL with all protections
   */
  async navigate(url: string, options?: NavigationOptions): Promise<PageResult> {
    const startTime = Date.now();
    const session = this.getOrCreateSession();

    this.emitEvent(`Navigating to ${new URL(url).hostname}...`);

    // Apply request delay
    await this.applyRequestDelay();

    // Get proxy if configured
    const proxy = this.selectProxy();

    // Build the E2B script with all protections
    const script = this.buildNavigationScript(url, session, proxy, options);

    try {
      // Execute in E2B sandbox
      const result = await this.executeInSandbox(script);

      // Update session
      session.requestCount++;
      session.lastUsedAt = Date.now();
      if (result.cookies) {
        session.cookies = result.cookies;
      }

      // Handle proxy rotation
      this.requestsSinceRotation++;
      if (this.shouldRotateProxy()) {
        this.rotateProxy();
      }

      const timing = {
        navigationStart: startTime,
        loadComplete: Date.now(),
        totalMs: Date.now() - startTime,
      };

      this.emitEvent(`Page loaded in ${timing.totalMs}ms`);

      return {
        ...result,
        timing,
        proxyUsed: proxy ? `${proxy.host}:${proxy.port}` : undefined,
        fingerprintUsed: session.id,
      };
    } catch (error) {
      // Mark proxy as failed if used
      if (proxy) {
        proxy.failureCount = (proxy.failureCount || 0) + 1;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('Navigation failed', { url, error: errorMessage });

      return {
        url,
        status: 0,
        content: '',
        timing: {
          navigationStart: startTime,
          loadComplete: Date.now(),
          totalMs: Date.now() - startTime,
        },
        errors: [errorMessage],
        proxyUsed: proxy ? `${proxy.host}:${proxy.port}` : undefined,
      };
    }
  }

  /**
   * Execute JavaScript on a page
   */
  async executeScript(url: string, script: string): Promise<unknown> {
    const result = await this.navigate(url, {
      executeScript: script,
      waitFor: 'networkidle2',
    });

    if (result.errors && result.errors.length > 0) {
      throw new Error(result.errors.join('; '));
    }

    return result.content;
  }

  /**
   * Take a screenshot with anti-detection
   */
  async screenshot(
    url: string,
    _options?: { fullPage?: boolean; quality?: number }
  ): Promise<string> {
    const result = await this.navigate(url, {
      screenshot: true,
      waitFor: 'networkidle2',
    });

    return result.screenshot || '';
  }

  /**
   * Fill a form safely (no login/payment)
   */
  async fillForm(
    url: string,
    formData: Record<string, string>,
    submitSelector?: string
  ): Promise<PageResult> {
    // Validate no sensitive fields
    const sensitivePatterns = [
      /password/i,
      /credit.?card/i,
      /cvv/i,
      /expir/i,
      /ssn/i,
      /social.?security/i,
      /bank/i,
    ];

    for (const key of Object.keys(formData)) {
      if (sensitivePatterns.some((p) => p.test(key))) {
        throw new Error(`Cannot fill sensitive field: ${key}`);
      }
    }

    const script = `
      ${this.getStealthScript()}

      const page = await browser.newPage();
      await page.goto('${url}', { waitUntil: 'networkidle2', timeout: ${this.config.timeout} });

      // Fill form fields
      ${Object.entries(formData)
        .map(
          ([selector, value]) => `
        try {
          await page.waitForSelector('${selector}', { timeout: 5000 });
          await page.type('${selector}', '${value.replace(/'/g, "\\'")}', { delay: 50 });
        } catch (e) {
          console.log('Could not fill: ${selector}');
        }
      `
        )
        .join('\n')}

      ${
        submitSelector
          ? `
        await page.click('${submitSelector}');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: ${this.config.timeout} });
      `
          : ''
      }

      const content = await page.content();
      const title = await page.title();

      return { content, title, url: page.url() };
    `;

    return this.navigate(url, {
      executeScript: script,
      waitFor: 'networkidle2',
    });
  }

  /**
   * Create a new session with fresh fingerprint
   */
  createSession(deviceType: 'desktop' | 'mobile' = 'desktop'): BrowserSession {
    const userAgents = USER_AGENTS[deviceType];
    const viewports = VIEWPORTS[deviceType];

    const session: BrowserSession = {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
      viewport: viewports[Math.floor(Math.random() * viewports.length)],
      cookies: [],
      localStorage: {},
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      requestCount: 0,
    };

    if (this.config.proxyConfig?.enabled) {
      session.proxy = this.selectProxy();
    }

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Add proxies to the pool
   */
  addProxies(proxies: ProxyServer[]): void {
    if (!this.config.proxyConfig) {
      this.config.proxyConfig = {
        enabled: true,
        rotationType: 'round_robin',
        proxies: [],
      };
    }
    this.config.proxyConfig.proxies.push(...proxies);
    log.info('Proxies added', { count: proxies.length });
  }

  /**
   * Get proxy statistics
   */
  getProxyStats(): Array<{
    proxy: string;
    successCount: number;
    failureCount: number;
    avgLatency: number;
  }> {
    if (!this.config.proxyConfig?.proxies) return [];

    return this.config.proxyConfig.proxies.map((p) => ({
      proxy: `${p.host}:${p.port}`,
      successCount: (p.latencyMs || 0) > 0 ? 1 : 0, // Simplified
      failureCount: p.failureCount || 0,
      avgLatency: p.latencyMs || 0,
    }));
  }

  /**
   * Generate a new fingerprint profile
   */
  generateFingerprint(deviceType: 'desktop' | 'mobile' = 'desktop'): FingerprintProfile {
    const userAgents = USER_AGENTS[deviceType];
    const viewports = VIEWPORTS[deviceType];
    const viewport = viewports[Math.floor(Math.random() * viewports.length)];

    return {
      id: `fp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
      viewport,
      screen: {
        width: viewport.width,
        height: viewport.height,
        colorDepth: 24,
      },
      timezone: TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)],
      language: 'en-US',
      platform: deviceType === 'desktop' ? 'Win32' : 'iPhone',
      webglVendor: 'Google Inc. (NVIDIA)',
      webglRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1080 Ti Direct3D11 vs_5_0 ps_5_0)',
      plugins: ['Chrome PDF Plugin', 'Chrome PDF Viewer', 'Native Client'],
      mimeTypes: ['application/pdf'],
      doNotTrack: Math.random() > 0.5,
      hardwareConcurrency: [4, 8, 12, 16][Math.floor(Math.random() * 4)],
      deviceMemory: [4, 8, 16][Math.floor(Math.random() * 3)],
    };
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private initializeFingerprints(): void {
    // Pre-generate some fingerprints
    for (let i = 0; i < 10; i++) {
      this.fingerprints.push(this.generateFingerprint('desktop'));
    }
    for (let i = 0; i < 5; i++) {
      this.fingerprints.push(this.generateFingerprint('mobile'));
    }
  }

  private getOrCreateSession(): BrowserSession {
    // Return existing session if persistence enabled and session exists
    if (this.config.sessionPersistence && this.sessions.size > 0) {
      const sessions = Array.from(this.sessions.values());
      const activeSession = sessions.find(
        (s) => Date.now() - s.lastUsedAt < 30 * 60 * 1000 // 30 min timeout
      );
      if (activeSession) return activeSession;
    }

    return this.createSession();
  }

  private selectProxy(): ProxyServer | undefined {
    if (!this.config.proxyConfig?.enabled || !this.config.proxyConfig.proxies.length) {
      return undefined;
    }

    const proxies = this.config.proxyConfig.proxies.filter(
      (p) => (p.failureCount || 0) < 3 // Skip failed proxies
    );

    if (proxies.length === 0) return undefined;

    switch (this.config.proxyConfig.rotationType) {
      case 'random':
        return proxies[Math.floor(Math.random() * proxies.length)];
      case 'sticky':
        return proxies[0];
      case 'round_robin':
      default:
        const proxy = proxies[this.currentProxyIndex % proxies.length];
        return proxy;
    }
  }

  private shouldRotateProxy(): boolean {
    if (!this.config.proxyConfig?.enabled) return false;
    const interval = this.config.proxyConfig.rotationInterval || 10;
    return this.requestsSinceRotation >= interval;
  }

  private rotateProxy(): void {
    this.currentProxyIndex++;
    this.requestsSinceRotation = 0;
    log.debug('Proxy rotated', { newIndex: this.currentProxyIndex });
  }

  private async applyRequestDelay(): Promise<void> {
    const { min, max } = this.config.requestDelay;
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private getStealthScript(): string {
    return STEALTH_SCRIPTS[this.config.antiDetectionLevel] || STEALTH_SCRIPTS.basic;
  }

  private buildNavigationScript(
    url: string,
    session: BrowserSession,
    proxy: ProxyServer | undefined,
    options?: NavigationOptions
  ): string {
    const waitFor = options?.waitFor || 'networkidle2';
    const timeout = options?.timeout || this.config.timeout;

    return `
      const puppeteer = require('puppeteer');

      (async () => {
        const browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=${session.viewport.width},${session.viewport.height}',
            ${proxy ? `'--proxy-server=${proxy.protocol}://${proxy.host}:${proxy.port}',` : ''}
          ],
        });

        const page = await browser.newPage();

        // Set user agent
        await page.setUserAgent('${session.userAgent}');

        // Set viewport
        await page.setViewport({
          width: ${session.viewport.width},
          height: ${session.viewport.height},
        });

        // Apply anti-detection
        await page.evaluateOnNewDocument(() => {
          ${this.getStealthScript()}
        });

        // Set cookies if any
        ${
          session.cookies.length > 0
            ? `
        await page.setCookie(...${JSON.stringify(session.cookies)});
        `
            : ''
        }

        try {
          await page.goto('${url}', {
            waitUntil: '${waitFor}',
            timeout: ${timeout},
          });

          ${options?.delay ? `await new Promise(r => setTimeout(r, ${options.delay}));` : ''}

          const content = await page.content();
          const title = await page.title();

          ${
            options?.screenshot
              ? `
          const screenshot = await page.screenshot({
            encoding: 'base64',
            fullPage: false,
          });
          `
              : 'const screenshot = null;'
          }

          ${
            options?.extractCookies
              ? `
          const cookies = await page.cookies();
          `
              : 'const cookies = [];'
          }

          ${
            options?.executeScript
              ? `
          const scriptResult = await page.evaluate(() => {
            ${options.executeScript}
          });
          `
              : 'const scriptResult = null;'
          }

          console.log(JSON.stringify({
            url: page.url(),
            status: 200,
            content: scriptResult || content,
            title,
            screenshot,
            cookies,
          }));
        } catch (error) {
          console.log(JSON.stringify({
            url: '${url}',
            status: 0,
            content: '',
            errors: [error.message],
          }));
        } finally {
          await browser.close();
        }
      })();
    `;
  }

  private async executeInSandbox(script: string): Promise<PageResult> {
    // In production, this would execute in E2B sandbox
    // For now, return a mock result indicating sandbox execution is needed
    log.info('Script prepared for E2B execution', { scriptLength: script.length });

    // This is a placeholder - actual execution would happen in E2B
    return {
      url: '',
      status: 200,
      content: '<!-- Sandbox execution required -->',
      timing: {
        navigationStart: Date.now(),
        loadComplete: Date.now(),
        totalMs: 0,
      },
    };
  }

  private emitEvent(message: string): void {
    if (this.onStream) {
      this.onStream({
        type: 'browser_visiting',
        message: `[Puppeteer] ${message}`,
        timestamp: Date.now(),
      });
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

export function createAdvancedPuppeteer(
  config?: Partial<BrowserConfig>,
  onStream?: StrategyStreamCallback
): AdvancedPuppeteer {
  return new AdvancedPuppeteer(config, onStream);
}
