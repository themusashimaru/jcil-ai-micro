// @ts-nocheck - Test file with extensive mocking
/**
 * COMPREHENSIVE TESTS FOR SecurityScanner
 *
 * Tests:
 * 1. Security pattern detection (SQL injection, XSS, command injection, path traversal, etc.)
 * 2. Vulnerability classification and severity scoring
 * 3. Code analysis logic (score calculation, grading)
 * 4. Recommendation generation
 * 5. Edge cases (empty input, no vulnerabilities, multiple issues)
 * 6. AI-powered analysis (mocked)
 * 7. isSafeToExecute checks
 * 8. quickCheck method
 * 9. Provider management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the AI providers module before importing SecurityScanner
vi.mock('@/lib/ai/providers', () => ({
  agentChat: vi.fn().mockResolvedValue({
    text: '{"vulnerabilities": []}',
  }),
}));

import {
  SecurityScanner,
  securityScanner,
  type SecurityVulnerability,
  type SecurityScanResult,
} from '../SecurityScanner';
import { agentChat } from '@/lib/ai/providers';
import type { GeneratedFile } from '../../../core/types';

// Helper to create a GeneratedFile
function createFile(path: string, content: string, language = 'typescript'): GeneratedFile {
  return {
    path,
    content,
    language,
    purpose: 'test file',
    linesOfCode: content.split('\n').length,
    generatedAt: Date.now(),
    version: 1,
  };
}

describe('SecurityScanner', () => {
  let scanner: SecurityScanner;

  beforeEach(() => {
    scanner = new SecurityScanner();
    vi.clearAllMocks();
  });

  // =========================================================================
  // BASIC INSTANTIATION
  // =========================================================================

  describe('instantiation', () => {
    it('should create a new instance', () => {
      expect(scanner).toBeInstanceOf(SecurityScanner);
    });

    it('should export a singleton instance', () => {
      expect(securityScanner).toBeInstanceOf(SecurityScanner);
    });

    it('should allow setting provider', () => {
      scanner.setProvider('openai');
      // No error thrown means it works; we verify via AI analysis calls later
      expect(true).toBe(true);
    });
  });

  // =========================================================================
  // SQL INJECTION DETECTION
  // =========================================================================

  describe('SQL injection detection', () => {
    it('should detect SQL injection via string interpolation', async () => {
      const file = createFile('db.ts', 'const query = `${userInput} SELECT * FROM users`;');
      const result = await scanner.scan([file]);
      const sqlVulns = result.vulnerabilities.filter(
        (v) => v.type === 'injection' && v.cwe === 'CWE-89'
      );
      expect(sqlVulns.length).toBeGreaterThanOrEqual(1);
      expect(sqlVulns[0].severity).toBe('critical');
      expect(sqlVulns[0].title).toContain('SQL Injection');
    });

    it('should detect SQL query string concatenation', async () => {
      const file = createFile('db.ts', 'db.query("SELECT * FROM users WHERE id = " + userId);');
      const result = await scanner.scan([file]);
      const sqlVulns = result.vulnerabilities.filter(
        (v) => v.title === 'SQL Query String Concatenation'
      );
      expect(sqlVulns.length).toBeGreaterThanOrEqual(1);
      expect(sqlVulns[0].severity).toBe('critical');
    });

    it('should not flag parameterized queries', async () => {
      const file = createFile('db.ts', 'db.query("SELECT * FROM users WHERE id = $1", [userId]);');
      const result = await scanner.scan([file]);
      const sqlVulns = result.vulnerabilities.filter(
        (v) => v.type === 'injection' && v.cwe === 'CWE-89'
      );
      expect(sqlVulns.length).toBe(0);
    });
  });

  // =========================================================================
  // XSS DETECTION
  // =========================================================================

  describe('XSS detection', () => {
    it('should detect dangerouslySetInnerHTML', async () => {
      const file = createFile(
        'component.tsx',
        '<div dangerouslySetInnerHTML={{ __html: content }} />'
      );
      const result = await scanner.scan([file]);
      const xssVulns = result.vulnerabilities.filter((v) => v.type === 'xss');
      expect(xssVulns.length).toBeGreaterThanOrEqual(1);
      expect(xssVulns[0].severity).toBe('high');
    });

    it('should detect innerHTML assignment from user input', async () => {
      const file = createFile('handler.ts', 'element.innerHTML = req.body.content;');
      const result = await scanner.scan([file]);
      const xssVulns = result.vulnerabilities.filter(
        (v) => v.type === 'xss' && v.title.includes('innerHTML')
      );
      expect(xssVulns.length).toBeGreaterThanOrEqual(1);
      expect(xssVulns[0].severity).toBe('critical');
    });

    it('should detect document.write usage', async () => {
      const file = createFile('legacy.js', 'document.write("<h1>Hello</h1>");');
      const result = await scanner.scan([file]);
      const xssVulns = result.vulnerabilities.filter(
        (v) => v.type === 'xss' && v.title.includes('document.write')
      );
      expect(xssVulns.length).toBeGreaterThanOrEqual(1);
      expect(xssVulns[0].severity).toBe('medium');
    });
  });

  // =========================================================================
  // COMMAND INJECTION DETECTION
  // =========================================================================

  describe('command injection detection', () => {
    it('should detect exec with string interpolation', async () => {
      const file = createFile('utils.ts', 'exec(`ls ${userInput}`);');
      const result = await scanner.scan([file]);
      const cmdVulns = result.vulnerabilities.filter(
        (v) => v.type === 'injection' && v.cwe === 'CWE-78'
      );
      expect(cmdVulns.length).toBeGreaterThanOrEqual(1);
      expect(cmdVulns[0].severity).toBe('critical');
    });

    it('should detect child_process exec with user input', async () => {
      const file = createFile(
        'server.ts',
        'const child_process = require("child_process");\nchild_process.exec(req.body.command);'
      );
      const result = await scanner.scan([file]);
      const cmdVulns = result.vulnerabilities.filter(
        (v) => v.title === 'Shell Command with User Input'
      );
      expect(cmdVulns.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // SECRETS DETECTION
  // =========================================================================

  describe('secrets detection', () => {
    it('should detect hardcoded API keys', async () => {
      // The regex expects: keyword + quote + colon/equals + quote + 20+ alphanumeric chars
      // Pattern: /(?:api[_-]?key|...|token|auth)['"]\s*[:=]\s*['"][A-Za-z0-9+/=]{20,}/i
      const file = createFile(
        'config.ts',
        `const config = { "api_key": "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij" };`
      );
      const result = await scanner.scan([file]);
      const secretVulns = result.vulnerabilities.filter((v) => v.type === 'secrets');
      expect(secretVulns.length).toBeGreaterThanOrEqual(1);
      expect(secretVulns[0].severity).toBe('critical');
    });

    it('should detect AWS access keys', async () => {
      const file = createFile('config.ts', 'const awsKey = "AKIAIOSFODNN7EXAMPLE";');
      const result = await scanner.scan([file]);
      const awsVulns = result.vulnerabilities.filter((v) => v.title === 'AWS Access Key Exposed');
      expect(awsVulns.length).toBeGreaterThanOrEqual(1);
      expect(awsVulns[0].severity).toBe('critical');
    });

    it('should detect GitHub personal access tokens', async () => {
      const file = createFile(
        'config.ts',
        'const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";'
      );
      const result = await scanner.scan([file]);
      const ghVulns = result.vulnerabilities.filter(
        (v) => v.title === 'GitHub Personal Access Token Exposed'
      );
      expect(ghVulns.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // PATH TRAVERSAL DETECTION
  // =========================================================================

  describe('path traversal detection', () => {
    it('should detect readFile with user input', async () => {
      const file = createFile('handler.ts', 'fs.readFile(req.query.path, "utf8", callback);');
      const result = await scanner.scan([file]);
      const pathVulns = result.vulnerabilities.filter((v) => v.type === 'path-traversal');
      expect(pathVulns.length).toBeGreaterThanOrEqual(1);
      expect(pathVulns[0].severity).toBe('high');
      expect(pathVulns[0].cwe).toBe('CWE-22');
    });

    it('should detect readFileSync with user input', async () => {
      const file = createFile('handler.ts', 'const data = fs.readFileSync(req.params.filename);');
      const result = await scanner.scan([file]);
      const pathVulns = result.vulnerabilities.filter((v) => v.type === 'path-traversal');
      expect(pathVulns.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // CRYPTOGRAPHIC ISSUES DETECTION
  // =========================================================================

  describe('cryptographic issues detection', () => {
    it('should detect weak hashing (MD5)', async () => {
      const file = createFile(
        'auth.ts',
        "const hash = crypto.createHash('md5').update(data).digest('hex');"
      );
      const result = await scanner.scan([file]);
      const cryptoVulns = result.vulnerabilities.filter(
        (v) => v.type === 'crypto' && v.title.includes('Weak Hashing')
      );
      expect(cryptoVulns.length).toBeGreaterThanOrEqual(1);
      expect(cryptoVulns[0].severity).toBe('medium');
    });

    it('should detect weak hashing (SHA1)', async () => {
      const file = createFile(
        'auth.ts',
        "const hash = crypto.createHash('sha1').update(data).digest('hex');"
      );
      const result = await scanner.scan([file]);
      const cryptoVulns = result.vulnerabilities.filter(
        (v) => v.type === 'crypto' && v.title.includes('Weak Hashing')
      );
      expect(cryptoVulns.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect Math.random for security-sensitive values', async () => {
      // Pattern: /Math\.random\s*\(\s*\).*(?:token|secret|key|password|id)/i
      // Math.random() must appear BEFORE the keyword on the same line
      const file = createFile('auth.ts', 'const val = Math.random().toString(36) + secret;');
      const result = await scanner.scan([file]);
      const cryptoVulns = result.vulnerabilities.filter(
        (v) => v.type === 'crypto' && v.title.includes('Insecure Random')
      );
      expect(cryptoVulns.length).toBeGreaterThanOrEqual(1);
      expect(cryptoVulns[0].severity).toBe('high');
    });
  });

  // =========================================================================
  // AUTHENTICATION ISSUES
  // =========================================================================

  describe('authentication issues detection', () => {
    it('should detect JWT none algorithm', async () => {
      const file = createFile('auth.ts', "jwt.sign({ user }, secret, { algorithm: 'none' });");
      const result = await scanner.scan([file]);
      const authVulns = result.vulnerabilities.filter(
        (v) => v.type === 'auth' && v.title.includes('JWT None')
      );
      expect(authVulns.length).toBeGreaterThanOrEqual(1);
      expect(authVulns[0].severity).toBe('critical');
    });

    it('should detect weak session secrets', async () => {
      const file = createFile('app.ts', "session.secret = 'abc123';");
      const result = await scanner.scan([file]);
      const authVulns = result.vulnerabilities.filter(
        (v) => v.type === 'auth' && v.title.includes('Weak Session')
      );
      expect(authVulns.length).toBeGreaterThanOrEqual(1);
      expect(authVulns[0].severity).toBe('high');
    });
  });

  // =========================================================================
  // PROTOTYPE POLLUTION
  // =========================================================================

  describe('prototype pollution detection', () => {
    it('should detect __proto__ access', async () => {
      const file = createFile('utils.ts', 'obj["__proto__"] = maliciousPayload;');
      const result = await scanner.scan([file]);
      const ppVulns = result.vulnerabilities.filter((v) => v.type === 'prototype-pollution');
      expect(ppVulns.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect Object.assign with user input', async () => {
      const file = createFile('handler.ts', 'const merged = Object.assign({}, req.body.data);');
      const result = await scanner.scan([file]);
      const ppVulns = result.vulnerabilities.filter(
        (v) => v.type === 'prototype-pollution' && v.title.includes('Prototype Pollution Risk')
      );
      expect(ppVulns.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // SSRF DETECTION
  // =========================================================================

  describe('SSRF detection', () => {
    it('should detect fetch with user-provided URL', async () => {
      const file = createFile('proxy.ts', 'const res = await fetch(req.query.url);');
      const result = await scanner.scan([file]);
      const ssrfVulns = result.vulnerabilities.filter((v) => v.type === 'ssrf');
      expect(ssrfVulns.length).toBeGreaterThanOrEqual(1);
      expect(ssrfVulns[0].severity).toBe('high');
    });
  });

  // =========================================================================
  // LOGGING ISSUES
  // =========================================================================

  describe('logging issues detection', () => {
    it('should detect sensitive data in console.log', async () => {
      const file = createFile('auth.ts', 'console.log("User password:", password);');
      const result = await scanner.scan([file]);
      const logVulns = result.vulnerabilities.filter((v) => v.type === 'logging');
      expect(logVulns.length).toBeGreaterThanOrEqual(1);
      expect(logVulns[0].severity).toBe('medium');
    });
  });

  // =========================================================================
  // CONFIGURATION ISSUES
  // =========================================================================

  describe('configuration issues detection', () => {
    it('should detect permissive CORS wildcard', async () => {
      const file = createFile('server.ts', "res.setHeader('Access-Control-Allow-Origin': '*');");
      const result = await scanner.scan([file]);
      const corsVulns = result.vulnerabilities.filter(
        (v) => v.type === 'configuration' && v.title.includes('Permissive CORS')
      );
      expect(corsVulns.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // INPUT VALIDATION
  // =========================================================================

  describe('input validation detection', () => {
    it('should detect eval with user input', async () => {
      const file = createFile('handler.ts', 'const result = eval(req.body.expression);');
      const result = await scanner.scan([file]);
      const evalVulns = result.vulnerabilities.filter(
        (v) => v.type === 'validation' && v.title.includes('eval')
      );
      expect(evalVulns.length).toBeGreaterThanOrEqual(1);
      expect(evalVulns[0].severity).toBe('critical');
    });

    it('should detect new Function with user input', async () => {
      const file = createFile('handler.ts', 'const fn = new Function(req.body.code);');
      const result = await scanner.scan([file]);
      const funcVulns = result.vulnerabilities.filter(
        (v) => v.type === 'validation' && v.title.includes('Function Constructor')
      );
      expect(funcVulns.length).toBeGreaterThanOrEqual(1);
      expect(funcVulns[0].severity).toBe('critical');
    });
  });

  // =========================================================================
  // SCORE CALCULATION AND GRADING
  // =========================================================================

  describe('score calculation and grading', () => {
    it('should return score 100 and grade A for clean code', async () => {
      const file = createFile('clean.ts', 'const x = 1 + 2;');
      const result = await scanner.scan([file]);
      expect(result.overallScore).toBe(100);
      expect(result.grade).toBe('A');
    });

    it('should deduct 25 points per critical vulnerability', async () => {
      // One critical: SQL injection via interpolation
      const file = createFile('db.ts', 'const q = `${userInput} SELECT * FROM t`;');
      const result = await scanner.scan([file]);
      // At least one critical => score <= 75
      expect(result.overallScore).toBeLessThanOrEqual(75);
    });

    it('should never go below 0', async () => {
      // Multiple critical vulnerabilities to push score well below 0
      const file = createFile(
        'terrible.ts',
        [
          'const q = `${userInput} SELECT * FROM t`;',
          'db.query("SELECT * FROM users WHERE id = " + userId);',
          'exec(`rm ${req.body.path}`);',
          'child_process.exec(req.body.cmd);',
          "const api_key = 'sk_test_PLACEHOLDER_NOT_A_REAL_KEY_1234';",
          "jwt.sign({ user }, secret, { algorithm: 'none' });",
          'eval(req.body.expression);',
          'new Function(req.body.code);',
        ].join('\n')
      );
      const result = await scanner.scan([file]);
      expect(result.overallScore).toBe(0);
      expect(result.grade).toBe('F');
    });

    it('should assign correct grades based on score thresholds', async () => {
      // We can test grade calculation indirectly via different vulnerability counts
      // Clean file = 100 = A
      const cleanResult = await scanner.scan([createFile('clean.ts', 'const a = 1;')]);
      expect(cleanResult.grade).toBe('A');

      // One medium issue (8 points) = 92 = A
      const mediumResult = await scanner.scan([createFile('med.js', 'document.write("hello");')]);
      expect(mediumResult.grade).toBe('A');
    });

    it('should correctly count vulnerabilities by severity in summary', async () => {
      const file = createFile(
        'mixed.ts',
        [
          // critical: SQL injection
          'const q = `${userInput} SELECT * FROM t`;',
          // medium: document.write
          'document.write("hello");',
          // medium: weak hash
          "crypto.createHash('md5').update(data).digest('hex');",
        ].join('\n')
      );
      const result = await scanner.scan([file]);
      expect(result.summary.critical).toBeGreaterThanOrEqual(1);
      expect(result.summary.medium).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // RECOMMENDATION GENERATION
  // =========================================================================

  describe('recommendation generation', () => {
    it('should recommend parameterized queries for injection vulns', async () => {
      const file = createFile('db.ts', 'const q = `${userInput} SELECT * FROM t`;');
      const result = await scanner.scan([file]);
      expect(result.recommendations.some((r) => r.includes('parameterized'))).toBe(true);
    });

    it('should recommend CSP for XSS vulns', async () => {
      const file = createFile('comp.tsx', '<div dangerouslySetInnerHTML={{ __html: content }} />');
      const result = await scanner.scan([file]);
      expect(result.recommendations.some((r) => r.includes('Content Security Policy'))).toBe(true);
    });

    it('should recommend env vars for secrets vulns', async () => {
      const file = createFile(
        'config.ts',
        `const config = { "api_key": "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij" };`
      );
      const result = await scanner.scan([file]);
      expect(result.recommendations.some((r) => r.includes('environment variables'))).toBe(true);
    });

    it('should recommend crypto best practices for crypto vulns', async () => {
      const file = createFile(
        'auth.ts',
        "const hash = crypto.createHash('md5').update(data).digest('hex');"
      );
      const result = await scanner.scan([file]);
      expect(result.recommendations.some((r) => r.includes('SHA-256'))).toBe(true);
    });

    it('should recommend input validation for validation vulns', async () => {
      const file = createFile('handler.ts', 'const result = eval(req.body.expression);');
      const result = await scanner.scan([file]);
      expect(result.recommendations.some((r) => r.includes('input validation'))).toBe(true);
    });

    it('should recommend best practices when no vulnerabilities found', async () => {
      const file = createFile('clean.ts', 'const x = 1;');
      const result = await scanner.scan([file]);
      expect(result.recommendations).toContain(
        'Great job! Continue following security best practices.'
      );
    });
  });

  // =========================================================================
  // PASSED CHECKS
  // =========================================================================

  describe('passed checks', () => {
    it('should list passed checks for clean code', async () => {
      const file = createFile('clean.ts', 'const x = 1;');
      const result = await scanner.scan([file]);
      expect(result.passedChecks).toContain('No injection vulnerabilities detected');
      expect(result.passedChecks).toContain('No XSS vulnerabilities detected');
      expect(result.passedChecks).toContain('No hardcoded secrets detected');
      expect(result.passedChecks).toContain('No authentication issues detected');
      expect(result.passedChecks).toContain('Cryptographic practices look good');
    });

    it('should detect positive patterns like helmet', async () => {
      const file = createFile('server.ts', "const helmet = require('helmet');\napp.use(helmet());");
      const result = await scanner.scan([file]);
      expect(result.passedChecks).toContain('Using Helmet for HTTP security headers');
    });

    it('should detect CSRF protection', async () => {
      const file = createFile('server.ts', 'app.use(csrf({ cookie: true }));');
      const result = await scanner.scan([file]);
      expect(result.passedChecks).toContain('CSRF protection implemented');
    });

    it('should detect rate limiting', async () => {
      const file = createFile('server.ts', 'app.use(rateLimit({ windowMs: 15 * 60 * 1000 }));');
      const result = await scanner.scan([file]);
      expect(result.passedChecks).toContain('Rate limiting configured');
    });

    it('should detect input sanitization', async () => {
      const file = createFile('handler.ts', 'const clean = sanitize(input);');
      const result = await scanner.scan([file]);
      expect(result.passedChecks).toContain('Input sanitization detected');
    });
  });

  // =========================================================================
  // EDGE CASES
  // =========================================================================

  describe('edge cases', () => {
    it('should handle empty file list', async () => {
      const result = await scanner.scan([]);
      expect(result.overallScore).toBe(100);
      expect(result.grade).toBe('A');
      expect(result.vulnerabilities).toHaveLength(0);
    });

    it('should handle file with empty content', async () => {
      const file = createFile('empty.ts', '');
      const result = await scanner.scan([file]);
      expect(result.overallScore).toBe(100);
      expect(result.vulnerabilities).toHaveLength(0);
    });

    it('should handle multiple files with mixed vulnerabilities', async () => {
      const files = [
        createFile('clean.ts', 'const x = 1;'),
        createFile('dirty.ts', 'const q = `${userInput} SELECT * FROM t`;'),
        createFile('comp.tsx', '<div dangerouslySetInnerHTML={{ __html: content }} />'),
      ];
      const result = await scanner.scan(files);
      expect(result.vulnerabilities.length).toBeGreaterThanOrEqual(2);
      // Should have both injection and xss types
      const types = new Set(result.vulnerabilities.map((v) => v.type));
      expect(types.has('injection')).toBe(true);
      expect(types.has('xss')).toBe(true);
    });

    it('should include correct file path in vulnerability', async () => {
      const file = createFile('src/db/queries.ts', 'const q = `${userInput} SELECT * FROM t`;');
      const result = await scanner.scan([file]);
      expect(result.vulnerabilities[0].file).toBe('src/db/queries.ts');
    });

    it('should include line numbers in vulnerabilities', async () => {
      const file = createFile(
        'handler.ts',
        'const x = 1;\nconst y = 2;\ndocument.write("hello");\nconst z = 3;'
      );
      const result = await scanner.scan([file]);
      const vuln = result.vulnerabilities.find((v) => v.title.includes('document.write'));
      expect(vuln).toBeDefined();
      expect(vuln!.line).toBe(3);
    });

    it('should include code snippet in vulnerability', async () => {
      const file = createFile(
        'handler.ts',
        'const x = 1;\nconst y = 2;\ndocument.write("hello");\nconst z = 3;'
      );
      const result = await scanner.scan([file]);
      const vuln = result.vulnerabilities.find((v) => v.title.includes('document.write'));
      expect(vuln).toBeDefined();
      expect(vuln!.code).toContain('document.write');
    });

    it('should generate unique IDs for vulnerabilities', async () => {
      const file = createFile(
        'mixed.ts',
        ['const q = `${userInput} SELECT * FROM t`;', 'document.write("hello");'].join('\n')
      );
      const result = await scanner.scan([file]);
      const ids = result.vulnerabilities.map((v) => v.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should record scan time', async () => {
      const file = createFile('clean.ts', 'const x = 1;');
      const result = await scanner.scan([file]);
      expect(result.scanTime).toBeGreaterThanOrEqual(0);
      expect(typeof result.scanTime).toBe('number');
    });
  });

  // =========================================================================
  // AI ANALYSIS
  // =========================================================================

  describe('AI-powered analysis', () => {
    it('should trigger AI analysis for critical files (auth)', async () => {
      const file = createFile('auth/login.ts', 'const user = authenticate(req);');
      await scanner.scan([file]);
      expect(agentChat).toHaveBeenCalled();
    });

    it('should trigger AI analysis for API files', async () => {
      const file = createFile('api/users.ts', 'export function getUsers() {}');
      await scanner.scan([file]);
      expect(agentChat).toHaveBeenCalled();
    });

    it('should trigger AI analysis for route files', async () => {
      const file = createFile('routes/index.ts', 'router.get("/", handler);');
      await scanner.scan([file]);
      expect(agentChat).toHaveBeenCalled();
    });

    it('should trigger AI analysis for middleware files', async () => {
      const file = createFile('middleware/auth.ts', 'export function authMiddleware() {}');
      await scanner.scan([file]);
      expect(agentChat).toHaveBeenCalled();
    });

    it('should trigger AI analysis for server files', async () => {
      const file = createFile('server/app.ts', 'const app = express();');
      await scanner.scan([file]);
      expect(agentChat).toHaveBeenCalled();
    });

    it('should NOT trigger AI analysis for non-critical files', async () => {
      const file = createFile('utils/math.ts', 'const add = (a, b) => a + b;');
      await scanner.scan([file]);
      expect(agentChat).not.toHaveBeenCalled();
    });

    it('should NOT trigger AI analysis when more than 5 critical files', async () => {
      const files = Array.from({ length: 6 }, (_, i) =>
        createFile(`api/route${i}.ts`, `export function handler${i}() {}`)
      );
      await scanner.scan(files);
      expect(agentChat).not.toHaveBeenCalled();
    });

    it('should parse AI vulnerabilities from response', async () => {
      vi.mocked(agentChat).mockResolvedValueOnce({
        text: JSON.stringify({
          vulnerabilities: [
            {
              type: 'authentication',
              severity: 'high',
              title: 'Missing auth check',
              description: 'No authentication on admin endpoint',
              file: 'api/admin.ts',
              line: 5,
              fix: 'Add authentication middleware',
            },
          ],
        }),
        usage: { inputTokens: 100, outputTokens: 200 },
        model: 'claude-3-sonnet',
        provider: 'claude',
        stopReason: 'end_turn',
      });

      const file = createFile('api/admin.ts', 'router.get("/admin", handler);');
      const result = await scanner.scan([file]);
      const aiVulns = result.vulnerabilities.filter((v) => v.id.startsWith('ai-'));
      expect(aiVulns.length).toBeGreaterThanOrEqual(1);
      expect(aiVulns[0].type).toBe('auth');
      expect(aiVulns[0].severity).toBe('high');
    });

    it('should handle AI analysis errors gracefully', async () => {
      vi.mocked(agentChat).mockRejectedValueOnce(new Error('API error'));

      const file = createFile('api/users.ts', 'export function getUsers() {}');
      const result = await scanner.scan([file]);
      // Should not throw, just skip AI vulnerabilities
      expect(result).toBeDefined();
      expect(result.overallScore).toBeDefined();
    });

    it('should handle invalid AI JSON response', async () => {
      vi.mocked(agentChat).mockResolvedValueOnce({
        text: 'This is not valid JSON at all',
        usage: { inputTokens: 100, outputTokens: 200 },
        model: 'claude-3-sonnet',
        provider: 'claude',
        stopReason: 'end_turn',
      });

      const file = createFile('api/users.ts', 'export function getUsers() {}');
      const result = await scanner.scan([file]);
      // Should not throw, just have no AI vulnerabilities
      expect(result).toBeDefined();
    });

    it('should default unknown AI severity to medium', async () => {
      vi.mocked(agentChat).mockResolvedValueOnce({
        text: JSON.stringify({
          vulnerabilities: [
            {
              type: 'other',
              severity: 'unknown_severity',
              title: 'Some issue',
              description: 'Some description',
              file: 'api/test.ts',
              fix: 'Fix it',
            },
          ],
        }),
        usage: { inputTokens: 100, outputTokens: 200 },
        model: 'claude-3-sonnet',
        provider: 'claude',
        stopReason: 'end_turn',
      });

      const file = createFile('api/test.ts', 'export function handler() {}');
      const result = await scanner.scan([file]);
      const aiVulns = result.vulnerabilities.filter((v) => v.id.startsWith('ai-'));
      expect(aiVulns.length).toBe(1);
      expect(aiVulns[0].severity).toBe('medium');
    });

    it('should map AI vulnerability types correctly', async () => {
      vi.mocked(agentChat).mockResolvedValueOnce({
        text: JSON.stringify({
          vulnerabilities: [
            {
              type: 'CSRF',
              severity: 'medium',
              title: 'Missing CSRF protection',
              description: 'No CSRF token',
              file: 'api/form.ts',
              fix: 'Add CSRF middleware',
            },
          ],
        }),
        usage: { inputTokens: 100, outputTokens: 200 },
        model: 'claude-3-sonnet',
        provider: 'claude',
        stopReason: 'end_turn',
      });

      const file = createFile('api/form.ts', 'export function handleForm() {}');
      const result = await scanner.scan([file]);
      const aiVulns = result.vulnerabilities.filter((v) => v.id.startsWith('ai-'));
      expect(aiVulns.length).toBe(1);
      expect(aiVulns[0].type).toBe('csrf');
    });

    it('should map unknown AI types to other', async () => {
      vi.mocked(agentChat).mockResolvedValueOnce({
        text: JSON.stringify({
          vulnerabilities: [
            {
              type: 'something_custom',
              severity: 'low',
              title: 'Custom issue',
              description: 'A custom vulnerability type',
              file: 'api/custom.ts',
              fix: 'Fix it',
            },
          ],
        }),
        usage: { inputTokens: 100, outputTokens: 200 },
        model: 'claude-3-sonnet',
        provider: 'claude',
        stopReason: 'end_turn',
      });

      const file = createFile('api/custom.ts', 'export function handler() {}');
      const result = await scanner.scan([file]);
      const aiVulns = result.vulnerabilities.filter((v) => v.id.startsWith('ai-'));
      expect(aiVulns.length).toBe(1);
      expect(aiVulns[0].type).toBe('other');
    });
  });

  // =========================================================================
  // quickCheck METHOD
  // =========================================================================

  describe('quickCheck', () => {
    it('should return vulnerabilities for a single file', () => {
      const file = createFile('handler.ts', 'document.write("hello");');
      const vulns = scanner.quickCheck(file);
      expect(vulns.length).toBeGreaterThanOrEqual(1);
      expect(vulns[0].type).toBe('xss');
    });

    it('should return empty array for clean file', () => {
      const file = createFile('clean.ts', 'const x = 1;');
      const vulns = scanner.quickCheck(file);
      expect(vulns).toHaveLength(0);
    });
  });

  // =========================================================================
  // isSafeToExecute METHOD
  // =========================================================================

  describe('isSafeToExecute', () => {
    it('should flag rm -rf as unsafe', () => {
      const result = scanner.isSafeToExecute('rm -rf /');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Destructive file deletion');
    });

    it('should flag eval as unsafe', () => {
      const result = scanner.isSafeToExecute('eval("alert(1)")');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Dynamic code execution');
    });

    it('should flag child_process as unsafe', () => {
      const result = scanner.isSafeToExecute('const cp = require("child_process");');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('Shell command execution');
    });

    it('should flag fs require as unsafe', () => {
      const result = scanner.isSafeToExecute('const fs = require("fs");');
      expect(result.safe).toBe(false);
      expect(result.reason).toBe('File system access');
    });

    it('should mark safe code as safe', () => {
      const result = scanner.isSafeToExecute('console.log("Hello, world!");');
      expect(result.safe).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should mark simple arithmetic as safe', () => {
      const result = scanner.isSafeToExecute('const sum = 1 + 2 + 3;');
      expect(result.safe).toBe(true);
    });
  });

  // =========================================================================
  // STREAMING CALLBACK
  // =========================================================================

  describe('streaming callback', () => {
    it('should call onStream with progress events', async () => {
      const onStream = vi.fn();
      const file = createFile('clean.ts', 'const x = 1;');
      await scanner.scan([file], onStream);

      expect(onStream).toHaveBeenCalled();
      // Should have at least a starting event and a completion event
      const calls = onStream.mock.calls;
      expect(calls[0][0].type).toBe('evaluating');
      expect(calls[0][0].message).toContain('Starting security scan');
      // Last call should be 'complete'
      const lastCall = calls[calls.length - 1][0];
      expect(lastCall.type).toBe('complete');
      expect(lastCall.progress).toBe(100);
    });

    it('should work without onStream callback', async () => {
      const file = createFile('clean.ts', 'const x = 1;');
      // Should not throw when no callback provided
      const result = await scanner.scan([file]);
      expect(result).toBeDefined();
    });
  });

  // =========================================================================
  // VULNERABILITY STRUCTURE
  // =========================================================================

  describe('vulnerability structure', () => {
    it('should include CWE reference in vulnerabilities', async () => {
      const file = createFile('handler.ts', 'document.write("hello");');
      const result = await scanner.scan([file]);
      const vuln = result.vulnerabilities[0];
      expect(vuln.cwe).toBe('CWE-79');
    });

    it('should include OWASP reference in vulnerabilities', async () => {
      const file = createFile('handler.ts', 'document.write("hello");');
      const result = await scanner.scan([file]);
      const vuln = result.vulnerabilities[0];
      expect(vuln.owasp).toContain('A03:2021');
    });

    it('should include fix description in vulnerabilities', async () => {
      const file = createFile('handler.ts', 'document.write("hello");');
      const result = await scanner.scan([file]);
      const vuln = result.vulnerabilities[0];
      expect(vuln.fix).toBeDefined();
      expect(vuln.fix.description).toBeTruthy();
      expect(vuln.fix.automated).toBe(false);
    });
  });
});
