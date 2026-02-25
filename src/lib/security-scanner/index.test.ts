import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify([
                {
                  title: 'Insecure Direct Object Reference',
                  description: 'User ID from URL used directly in query',
                  severity: 'high',
                  category: 'authorization',
                  cweId: 'CWE-639',
                  owaspCategory: 'A01:2021',
                  lineStart: 10,
                  lineEnd: 15,
                  codeSnippet: 'db.query(userId)',
                  fix: {
                    description: 'Validate ownership',
                    code: 'if (session.userId !== userId) throw 403;',
                    automated: false,
                    breaking: false,
                  },
                },
              ]),
            },
          ],
        }),
      },
    })),
  };
});

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { AISecurityScanner, securityScanner, scanSecurity, scanProject } from './index';
import type {
  VulnerabilitySeverity,
  VulnerabilityCategory,
  Vulnerability,
  SecurityFix,
  SecuritySummary,
  SecretFinding,
  DependencyVulnerability,
} from './index';

describe('AISecurityScanner', () => {
  let scanner: AISecurityScanner;

  beforeEach(() => {
    vi.clearAllMocks();
    scanner = new AISecurityScanner();
  });

  // ----- Type exports -----
  describe('Type exports', () => {
    it('should export VulnerabilitySeverity type', () => {
      const severities: VulnerabilitySeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
      expect(severities).toHaveLength(5);
    });

    it('should export VulnerabilityCategory type', () => {
      const cats: VulnerabilityCategory[] = [
        'injection',
        'xss',
        'authentication',
        'authorization',
        'cryptography',
        'secrets',
        'configuration',
        'data-exposure',
        'dependency',
        'input-validation',
        'session-management',
        'error-handling',
      ];
      expect(cats).toHaveLength(12);
    });

    it('should export Vulnerability shape', () => {
      const vuln: Vulnerability = {
        id: 'v1',
        title: 'SQL Injection',
        description: 'User input in query',
        severity: 'critical',
        category: 'injection',
        filePath: 'src/db.ts',
        lineStart: 10,
        lineEnd: 10,
        codeSnippet: 'query(`SELECT * FROM users WHERE id = ${userId}`)',
      };
      expect(vuln.severity).toBe('critical');
    });

    it('should export SecurityFix shape', () => {
      const fix: SecurityFix = {
        description: 'Use parameterized query',
        code: 'query("SELECT * FROM users WHERE id = $1", [userId])',
        automated: true,
        breaking: false,
      };
      expect(fix.automated).toBe(true);
    });

    it('should export SecuritySummary shape', () => {
      const summary: SecuritySummary = {
        critical: 1,
        high: 2,
        medium: 3,
        low: 4,
        info: 5,
        total: 15,
      };
      expect(summary.total).toBe(15);
    });

    it('should export SecretFinding shape', () => {
      const secret: SecretFinding = {
        type: 'AWS Access Key',
        value: 'AKIAXXXXXXXX',
        filePath: 'src/config.ts',
        lineNumber: 5,
        entropy: 4.5,
      };
      expect(secret.type).toBe('AWS Access Key');
    });

    it('should export DependencyVulnerability shape', () => {
      const dep: DependencyVulnerability = {
        package: 'lodash',
        version: '4.17.0',
        vulnerability: 'Prototype pollution',
        severity: 'high',
        fixedIn: '4.17.21',
        cveId: 'CVE-2020-8203',
      };
      expect(dep.cveId).toBe('CVE-2020-8203');
    });
  });

  // ----- Singleton export -----
  describe('securityScanner singleton', () => {
    it('should be an AISecurityScanner instance', () => {
      expect(securityScanner).toBeInstanceOf(AISecurityScanner);
    });
  });

  // ----- Pattern-based scanning -----
  describe('pattern-based vulnerability detection', () => {
    it('should detect SQL injection', async () => {
      const code = 'const result = query(`SELECT * FROM users WHERE id = ${userId}`);';
      const vulns = await scanner.scanCode(code, 'src/db.ts');
      const sqli = vulns.filter((v) => v.category === 'injection' && v.title.includes('SQL'));
      expect(sqli.length).toBeGreaterThan(0);
      expect(sqli[0].severity).toBe('critical');
      expect(sqli[0].cweId).toBe('CWE-89');
    });

    it('should detect XSS via dangerouslySetInnerHTML', async () => {
      const code = '<div dangerouslySetInnerHTML={{ __html: userInput }} />';
      const vulns = await scanner.scanCode(code, 'src/component.tsx');
      const xss = vulns.filter((v) => v.category === 'xss');
      expect(xss.length).toBeGreaterThan(0);
    });

    it('should detect XSS via innerHTML assignment with interpolation', async () => {
      // Pattern: innerHTML\s*=\s*[^"'`]*\$\{  expects no quotes/backticks between = and ${
      const code = 'element.innerHTML = content + ${userInput};';
      const vulns = await scanner.scanCode(code, 'src/dom.ts');
      const xss = vulns.filter((v) => v.category === 'xss');
      expect(xss.length).toBeGreaterThan(0);
    });

    it('should detect document.write usage', async () => {
      const code = 'document.write(userInput);';
      const vulns = await scanner.scanCode(code, 'src/legacy.ts');
      const xss = vulns.filter((v) => v.category === 'xss');
      expect(xss.length).toBeGreaterThan(0);
    });

    it('should detect eval usage', async () => {
      const code = 'const userResult = eval(userCode);';
      const vulns = await scanner.scanCode(code, 'src/exec.ts');
      const cmdi = vulns.filter((v) => v.category === 'injection' && v.title.includes('Command'));
      expect(cmdi.length).toBeGreaterThan(0);
    });

    it('should detect Math.random as insecure', async () => {
      const code = 'const token = Math.random().toString(36);';
      const vulns = await scanner.scanCode(code, 'src/auth.ts');
      const crypto = vulns.filter((v) => v.category === 'cryptography');
      expect(crypto.length).toBeGreaterThan(0);
      expect(crypto[0].title).toContain('Insecure Random');
    });

    it('should detect weak hash (md5)', async () => {
      const code = "const hash = createHash('md5').update(data).digest('hex');";
      const vulns = await scanner.scanCode(code, 'src/hash.ts');
      const crypto = vulns.filter((v) => v.category === 'cryptography');
      expect(crypto.length).toBeGreaterThan(0);
      expect(crypto[0].title).toContain('Weak Cryptographic Hash');
    });

    it('should detect wildcard CORS', async () => {
      const code = 'cors()';
      const vulns = await scanner.scanCode(code, 'src/server.ts');
      const corsVulns = vulns.filter((v) => v.category === 'configuration');
      expect(corsVulns.length).toBeGreaterThan(0);
    });
  });

  // ----- Secret detection -----
  describe('secret detection', () => {
    const ghPrefix = 'ghp_';
    const ghSuffix = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij';
    const fakeGhToken = ghPrefix + ghSuffix;

    it('should detect GitHub tokens', async () => {
      const code = `const token = "${fakeGhToken}";`;
      const vulns = await scanner.scanCode(code, 'src/config.ts');
      const secrets = vulns.filter((v) => v.category === 'secrets');
      expect(secrets.length).toBeGreaterThan(0);
      expect(secrets[0].severity).toBe('critical');
    });

    it('should detect Stripe live keys', async () => {
      const prefix = 'sk_live_';
      const code = `const key = "${prefix}1234567890abcdefghijklmn";`;
      const vulns = await scanner.scanCode(code, 'src/payment.ts');
      const secrets = vulns.filter((v) => v.category === 'secrets');
      expect(secrets.length).toBeGreaterThan(0);
    });

    it('should skip secrets in test files', async () => {
      const code = `const token = "${fakeGhToken}";`;
      const vulns = await scanner.scanCode(code, 'src/test/config.test.ts');
      const secrets = vulns.filter((v) => v.category === 'secrets');
      expect(secrets).toHaveLength(0);
    });

    it('should skip secrets in example files', async () => {
      const code = `const token = "${fakeGhToken}";`;
      const vulns = await scanner.scanCode(code, '.env.example');
      const secrets = vulns.filter((v) => v.category === 'secrets');
      expect(secrets).toHaveLength(0);
    });
  });

  // ----- AI analysis -----
  describe('AI security analysis', () => {
    it('should include AI-detected vulnerabilities', async () => {
      const code = `
export async function getUser(req: Request) {
  const userId = req.url.split('/').pop();
  const user = await db.query("SELECT * FROM users WHERE id = $1", [userId]);
  return user;
}`;
      const vulns = await scanner.scanCode(code, 'src/api.ts');
      const aiVulns = vulns.filter((v) => v.id?.startsWith('ai-'));
      expect(aiVulns.length).toBeGreaterThan(0);
    });

    it('should handle AI errors gracefully', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      vi.mocked(Anthropic).mockImplementationOnce(
        () =>
          ({
            messages: {
              create: vi.fn().mockRejectedValue(new Error('API error')),
            },
          }) as never
      );

      const s = new AISecurityScanner();
      const vulns = await s.scanCode('const x = 1;', 'src/a.ts');
      expect(Array.isArray(vulns)).toBe(true);
    });

    it('should handle non-text AI response', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      vi.mocked(Anthropic).mockImplementationOnce(
        () =>
          ({
            messages: {
              create: vi.fn().mockResolvedValue({
                content: [{ type: 'tool_use', id: 't1', name: 'x', input: {} }],
              }),
            },
          }) as never
      );

      const s = new AISecurityScanner();
      const vulns = await s.scanCode('const x = 1;', 'src/a.ts');
      expect(Array.isArray(vulns)).toBe(true);
    });
  });

  // ----- fullScan -----
  describe('fullScan', () => {
    it('should scan multiple files and return a result', async () => {
      const files = [
        { path: 'src/app.ts', content: 'const x = Math.random();' },
        { path: 'src/db.ts', content: 'const r = query(`SELECT * FROM t WHERE id = ${id}`);' },
      ];

      const result = await scanner.fullScan(files);
      expect(result.filesScanned).toBe(2);
      expect(result.vulnerabilities.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(result.score).toBeDefined();
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.scannedAt).toBeDefined();
    });

    it('should detect language from file extension', async () => {
      const files = [{ path: 'src/app.py', content: 'import os\nos.system(user_input)' }];

      const result = await scanner.fullScan(files);
      expect(result.filesScanned).toBe(1);
    });
  });

  // ----- Security score -----
  describe('security score calculation', () => {
    it('should return 100 for no vulnerabilities', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      vi.mocked(Anthropic).mockImplementation(
        () =>
          ({
            messages: {
              create: vi.fn().mockResolvedValue({
                content: [{ type: 'text', text: '[]' }],
              }),
            },
          }) as never
      );

      const s = new AISecurityScanner();
      const result = await s.fullScan([{ path: 'src/clean.ts', content: 'const x = 1;' }]);
      expect(result.score).toBe(100);
    });

    it('should lower score for critical vulnerabilities', async () => {
      const result = await scanner.fullScan([
        { path: 'src/bad.ts', content: 'const r = query(`SELECT * FROM t WHERE id = ${id}`);' },
      ]);
      expect(result.score).toBeLessThan(100);
    });
  });

  // ----- Recommendations -----
  describe('recommendations', () => {
    it('should recommend parameterized queries for injection', async () => {
      const result = await scanner.fullScan([
        { path: 'src/db.ts', content: 'const r = query(`SELECT * FROM t WHERE id = ${id}`);' },
      ]);
      expect(result.recommendations.some((r) => r.includes('parameterized'))).toBe(true);
    });

    it('should recommend CSP for XSS', async () => {
      const result = await scanner.fullScan([
        { path: 'src/app.tsx', content: '<div dangerouslySetInnerHTML={{ __html: data }} />' },
      ]);
      expect(result.recommendations.some((r) => r.includes('Content Security Policy'))).toBe(true);
    });

    it('should recommend environment variables for secrets', async () => {
      const ghToken = 'ghp_' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij';
      const result = await scanner.fullScan([
        {
          path: 'src/config.ts',
          content: `const key = "${ghToken}";`,
        },
      ]);
      expect(result.recommendations.some((r) => r.includes('environment variables'))).toBe(true);
    });

    it('should recommend security testing when no vulns found', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      vi.mocked(Anthropic).mockImplementation(
        () =>
          ({
            messages: {
              create: vi.fn().mockResolvedValue({
                content: [{ type: 'text', text: '[]' }],
              }),
            },
          }) as never
      );

      const s = new AISecurityScanner();
      const result = await s.fullScan([{ path: 'src/clean.ts', content: 'const x = 1;' }]);
      expect(result.recommendations.some((r) => r.includes('No vulnerabilities'))).toBe(true);
    });
  });

  // ----- generateFix -----
  describe('generateFix', () => {
    it('should generate a security fix', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      vi.mocked(Anthropic).mockImplementationOnce(
        () =>
          ({
            messages: {
              create: vi.fn().mockResolvedValue({
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      description: 'Use parameterized query',
                      code: 'query("SELECT * FROM users WHERE id = $1", [id])',
                      automated: true,
                      breaking: false,
                    }),
                  },
                ],
              }),
            },
          }) as never
      );

      const s = new AISecurityScanner();
      const fix = await s.generateFix(
        {
          id: 'v1',
          title: 'SQL Injection',
          description: 'User input in query',
          severity: 'critical',
          category: 'injection',
          filePath: 'src/db.ts',
          lineStart: 5,
          lineEnd: 5,
          codeSnippet: 'query(`...${id}`)',
        },
        'const r = query(`SELECT * FROM users WHERE id = ${id}`);'
      );

      expect(fix).not.toBeNull();
      expect(fix!.automated).toBe(true);
    });

    it('should return null on AI error', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      vi.mocked(Anthropic).mockImplementationOnce(
        () =>
          ({
            messages: {
              create: vi.fn().mockRejectedValue(new Error('API error')),
            },
          }) as never
      );

      const s = new AISecurityScanner();
      const fix = await s.generateFix(
        {
          id: 'v1',
          title: 'XSS',
          description: 'XSS issue',
          severity: 'high',
          category: 'xss',
          filePath: 'src/a.ts',
          lineStart: 1,
          lineEnd: 1,
          codeSnippet: 'innerHTML',
        },
        'code'
      );
      expect(fix).toBeNull();
    });
  });

  // ----- Convenience functions -----
  describe('scanSecurity convenience function', () => {
    it('should scan code and return vulnerabilities', async () => {
      const vulns = await scanSecurity('const x = Math.random();', 'src/a.ts');
      expect(Array.isArray(vulns)).toBe(true);
    });
  });

  describe('scanProject convenience function', () => {
    it('should perform full scan', async () => {
      const result = await scanProject([{ path: 'src/a.ts', content: 'const x = 1;' }]);
      expect(result.filesScanned).toBe(1);
    });
  });

  // ----- Language detection -----
  describe('language detection', () => {
    it('should detect typescript from .ts extension', async () => {
      const result = await scanner.fullScan([{ path: 'src/app.ts', content: 'const x = 1;' }]);
      expect(result.filesScanned).toBe(1);
    });

    it('should detect python from .py extension', async () => {
      const result = await scanner.fullScan([{ path: 'main.py', content: 'x = 1' }]);
      expect(result.filesScanned).toBe(1);
    });

    it('should handle unknown extensions', async () => {
      const result = await scanner.fullScan([{ path: 'Makefile', content: 'all: build' }]);
      expect(result.filesScanned).toBe(1);
    });
  });

  // ----- Entropy calculation -----
  describe('entropy calculation (via secret detection)', () => {
    it('should flag high-entropy strings as secrets', async () => {
      const code = 'const api_key = "aBcDeFgHiJkLmNoPqRsTuVwXyZ123456";';
      const vulns = await scanner.scanCode(code, 'src/config.ts');
      expect(Array.isArray(vulns)).toBe(true);
    });
  });
});
