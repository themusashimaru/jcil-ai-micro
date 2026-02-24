import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '[]' }],
      }),
    },
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

import {
  AISecurityScanner,
  securityScanner,
  scanSecurity,
  scanProject,
  type Vulnerability,
  type VulnerabilitySeverity,
  type VulnerabilityCategory,
  type SecurityFix,
  type SecurityScanResult,
  type SecuritySummary,
  type SecretFinding,
  type DependencyVulnerability,
} from './index';

// ============================================================================
// TYPE EXPORT VALIDATION
// ============================================================================

describe('SecurityScanner type exports', () => {
  it('should export VulnerabilitySeverity type', () => {
    const sev: VulnerabilitySeverity = 'critical';
    expect(['critical', 'high', 'medium', 'low', 'info']).toContain(sev);
  });

  it('should export VulnerabilityCategory type', () => {
    const cat: VulnerabilityCategory = 'injection';
    expect(cat).toBe('injection');
  });

  it('should export Vulnerability interface', () => {
    const v: Vulnerability = {
      id: 'v-1',
      title: 'SQL Injection',
      description: 'Parameterize queries',
      severity: 'critical',
      category: 'injection',
      cweId: 'CWE-89',
      owaspCategory: 'A03:2021',
      filePath: 'src/db.ts',
      lineStart: 10,
      lineEnd: 10,
      codeSnippet: 'query(`SELECT * FROM ${table}`)',
    };
    expect(v.severity).toBe('critical');
    expect(v.category).toBe('injection');
  });

  it('should export SecurityFix interface', () => {
    const fix: SecurityFix = {
      description: 'Use parameterized query',
      code: 'query("SELECT * FROM $1", [table])',
      automated: true,
      breaking: false,
    };
    expect(fix.automated).toBe(true);
  });

  it('should export SecurityScanResult interface', () => {
    const result: SecurityScanResult = {
      scannedAt: new Date().toISOString(),
      filesScanned: 5,
      vulnerabilities: [],
      summary: { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 },
      recommendations: [],
      score: 100,
    };
    expect(result.score).toBe(100);
  });

  it('should export SecuritySummary interface', () => {
    const s: SecuritySummary = {
      critical: 1,
      high: 2,
      medium: 3,
      low: 4,
      info: 5,
      total: 15,
    };
    expect(s.total).toBe(15);
  });

  it('should export SecretFinding interface', () => {
    const sf: SecretFinding = {
      type: 'AWS Access Key',
      value: 'AKIAIOSFODNN7EXAMPLE',
      filePath: 'config.ts',
      lineNumber: 5,
      entropy: 4.2,
    };
    expect(sf.type).toBe('AWS Access Key');
  });

  it('should export DependencyVulnerability interface', () => {
    const dv: DependencyVulnerability = {
      package: 'lodash',
      version: '4.17.20',
      vulnerability: 'Prototype Pollution',
      severity: 'high',
      fixedIn: '4.17.21',
      cveId: 'CVE-2021-23337',
    };
    expect(dv.severity).toBe('high');
  });
});

// ============================================================================
// AISecurityScanner CLASS
// ============================================================================

describe('AISecurityScanner', () => {
  let scanner: AISecurityScanner;

  beforeEach(() => {
    scanner = new AISecurityScanner();
  });

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(scanner).toBeInstanceOf(AISecurityScanner);
    });
  });

  describe('methods', () => {
    it('should have scanCode method', () => {
      expect(typeof scanner.scanCode).toBe('function');
    });

    it('should have fullScan method', () => {
      expect(typeof scanner.fullScan).toBe('function');
    });

    it('should have generateFix method', () => {
      expect(typeof scanner.generateFix).toBe('function');
    });
  });

  describe('scanCode - pattern detection', () => {
    it('should detect SQL injection with template literals', async () => {
      const code = 'const result = query(`SELECT * FROM users WHERE id = ${userId}`)';
      const vulns = await scanner.scanCode(code, 'src/db.ts');
      const sqli = vulns.find((v) => v.category === 'injection');
      expect(sqli).toBeDefined();
      expect(sqli?.severity).toBe('critical');
    });

    it('should detect XSS with innerHTML', async () => {
      const code = 'document.write(userInput)';
      const vulns = await scanner.scanCode(code, 'src/ui.ts');
      const xss = vulns.find((v) => v.category === 'xss');
      expect(xss).toBeDefined();
    });

    it('should detect dangerouslySetInnerHTML', async () => {
      const code = '<div dangerouslySetInnerHTML={{ __html: content }} />';
      const vulns = await scanner.scanCode(code, 'src/component.tsx');
      const xss = vulns.find((v) => v.category === 'xss');
      expect(xss).toBeDefined();
    });

    it('should detect eval usage', async () => {
      const code = 'const result = userVal; eval(userInput)';
      const vulns = await scanner.scanCode(code, 'src/exec.ts');
      const cmdInj = vulns.find((v) => v.title?.includes('Command'));
      expect(cmdInj).toBeDefined();
    });

    it('should detect insecure crypto (MD5)', async () => {
      const code = "const hash = createHash('md5').update(data).digest('hex')";
      const vulns = await scanner.scanCode(code, 'src/crypto.ts');
      const crypto = vulns.find((v) => v.category === 'cryptography');
      expect(crypto).toBeDefined();
    });

    it('should detect insecure crypto (SHA1)', async () => {
      const code = "const hash = createHash('sha1').update(data).digest('hex')";
      const vulns = await scanner.scanCode(code, 'src/crypto.ts');
      const crypto = vulns.find((v) => v.category === 'cryptography');
      expect(crypto).toBeDefined();
    });

    it('should detect Math.random', async () => {
      const code = 'const token = Math.random().toString(36)';
      const vulns = await scanner.scanCode(code, 'src/auth.ts');
      const crypto = vulns.find((v) => v.category === 'cryptography');
      expect(crypto).toBeDefined();
    });

    it('should detect wildcard CORS', async () => {
      const code = 'cors()';
      const vulns = await scanner.scanCode(code, 'src/server.ts');
      const cors = vulns.find((v) => v.category === 'configuration');
      expect(cors).toBeDefined();
    });

    it('should return empty for clean code', async () => {
      const code = 'const x = 1 + 2;\nconsole.log(x);';
      const vulns = await scanner.scanCode(code, 'src/clean.ts');
      // Only AI vulns possible, pattern-based should be empty
      // Since AI mock returns [], should be empty
      expect(vulns).toEqual([]);
    });
  });

  describe('fullScan', () => {
    it('should return a SecurityScanResult', async () => {
      const result = await scanner.fullScan([{ path: 'src/app.ts', content: 'const x = 1;' }]);
      expect(result).toHaveProperty('scannedAt');
      expect(result).toHaveProperty('filesScanned');
      expect(result).toHaveProperty('vulnerabilities');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('score');
    });

    it('should count files scanned', async () => {
      const result = await scanner.fullScan([
        { path: 'src/a.ts', content: 'const a = 1;' },
        { path: 'src/b.ts', content: 'const b = 2;' },
        { path: 'src/c.ts', content: 'const c = 3;' },
      ]);
      expect(result.filesScanned).toBe(3);
    });

    it('should return high score for clean code', async () => {
      const result = await scanner.fullScan([{ path: 'src/clean.ts', content: 'const x = 1;' }]);
      expect(result.score).toBeGreaterThanOrEqual(90);
    });

    it('should return summary with zeroes for clean code', async () => {
      const result = await scanner.fullScan([{ path: 'src/clean.ts', content: 'const x = 1;' }]);
      expect(result.summary.total).toBe(0);
      expect(result.summary.critical).toBe(0);
    });

    it('should generate recommendations for no vulns', async () => {
      const result = await scanner.fullScan([{ path: 'src/clean.ts', content: 'const x = 1;' }]);
      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations[0]).toContain('No vulnerabilities');
    });

    it('should detect vulns across multiple files', async () => {
      const result = await scanner.fullScan([
        { path: 'src/db.ts', content: 'query(`SELECT * FROM ${table}`)' },
        { path: 'src/ui.ts', content: 'element.innerHTML = `${userInput}`' },
      ]);
      expect(result.vulnerabilities.length).toBeGreaterThan(0);
      expect(result.summary.total).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// EXPORTED FUNCTIONS & SINGLETONS
// ============================================================================

describe('securityScanner singleton', () => {
  it('should be an AISecurityScanner instance', () => {
    expect(securityScanner).toBeInstanceOf(AISecurityScanner);
  });
});

describe('scanSecurity', () => {
  it('should be a function', () => {
    expect(typeof scanSecurity).toBe('function');
  });

  it('should return an array', async () => {
    const result = await scanSecurity('const x = 1;', 'test.ts');
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('scanProject', () => {
  it('should be a function', () => {
    expect(typeof scanProject).toBe('function');
  });

  it('should return a SecurityScanResult', async () => {
    const result = await scanProject([{ path: 'test.ts', content: 'const x = 1;' }]);
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('vulnerabilities');
  });
});
