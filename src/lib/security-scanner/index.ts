/**
 * AI SECURITY SCANNER
 *
 * Real-time vulnerability detection and security analysis.
 *
 * Features:
 * - OWASP Top 10 detection
 * - SQL injection detection
 * - XSS vulnerability detection
 * - Authentication/authorization issues
 * - Secrets detection
 * - Dependency vulnerability scanning
 * - Security best practices enforcement
 * - Auto-fix suggestions
 */

import Anthropic from '@anthropic-ai/sdk';

// ============================================
// TYPES
// ============================================

export type VulnerabilitySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type VulnerabilityCategory =
  | 'injection'
  | 'xss'
  | 'authentication'
  | 'authorization'
  | 'cryptography'
  | 'secrets'
  | 'configuration'
  | 'data-exposure'
  | 'dependency'
  | 'input-validation'
  | 'session-management'
  | 'error-handling';

export interface Vulnerability {
  id: string;
  title: string;
  description: string;
  severity: VulnerabilitySeverity;
  category: VulnerabilityCategory;
  cweId?: string;
  owaspCategory?: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  codeSnippet: string;
  fix?: SecurityFix;
  references?: string[];
}

export interface SecurityFix {
  description: string;
  code: string;
  automated: boolean;
  breaking: boolean;
}

export interface SecurityScanResult {
  scannedAt: string;
  filesScanned: number;
  vulnerabilities: Vulnerability[];
  summary: SecuritySummary;
  recommendations: string[];
  score: number; // 0-100
}

export interface SecuritySummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

export interface SecretFinding {
  type: string;
  value: string;
  filePath: string;
  lineNumber: number;
  entropy: number;
}

export interface DependencyVulnerability {
  package: string;
  version: string;
  vulnerability: string;
  severity: VulnerabilitySeverity;
  fixedIn?: string;
  cveId?: string;
}

// ============================================
// SECRET PATTERNS
// ============================================

const SECRET_PATTERNS = [
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/g },
  { name: 'AWS Secret Key', pattern: /[0-9a-zA-Z/+]{40}/g },
  { name: 'GitHub Token', pattern: /ghp_[a-zA-Z0-9]{36}/g },
  { name: 'GitHub OAuth', pattern: /gho_[a-zA-Z0-9]{36}/g },
  { name: 'Slack Token', pattern: /xox[baprs]-[0-9a-zA-Z-]{10,}/g },
  { name: 'Stripe Key', pattern: /sk_live_[0-9a-zA-Z]{24}/g },
  { name: 'Stripe Test Key', pattern: /sk_test_[0-9a-zA-Z]{24}/g },
  { name: 'Google API Key', pattern: /AIza[0-9A-Za-z-_]{35}/g },
  { name: 'Private Key', pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'Generic API Key', pattern: /api[_-]?key[_-]?[=:]["']?[a-zA-Z0-9]{20,}["']?/gi },
  { name: 'Generic Secret', pattern: /secret[_-]?[=:]["']?[a-zA-Z0-9]{20,}["']?/gi },
  { name: 'Password in URL', pattern: /[a-zA-Z]+:\/\/[^:]+:[^@]+@/g },
  { name: 'JWT Token', pattern: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g },
  { name: 'Bearer Token', pattern: /bearer\s+[a-zA-Z0-9_\-.]+/gi },
  { name: 'Anthropic API Key', pattern: /sk-ant-[a-zA-Z0-9-]{40,}/g },
  { name: 'OpenAI API Key', pattern: /sk-[a-zA-Z0-9]{48}/g },
  { name: 'Supabase Key', pattern: /sbp_[a-zA-Z0-9]{40}/g },
  { name: 'Firebase Key', pattern: /AAAA[a-zA-Z0-9_-]{7}:[a-zA-Z0-9_-]{140}/g },
];

// ============================================
// VULNERABILITY PATTERNS
// ============================================

const VULN_PATTERNS = {
  sqlInjection: [
    /query\s*\(\s*[`'"]\s*SELECT.*\$\{/gi,
    /query\s*\(\s*[`'"]\s*INSERT.*\$\{/gi,
    /query\s*\(\s*[`'"]\s*UPDATE.*\$\{/gi,
    /query\s*\(\s*[`'"]\s*DELETE.*\$\{/gi,
    /execute\s*\(\s*[`'"]\s*.*\$\{/gi,
    /\.raw\s*\(\s*[`'"]\s*.*\$\{/gi,
  ],
  xss: [
    /innerHTML\s*=\s*[^"'`]*\$\{/g,
    /outerHTML\s*=\s*[^"'`]*\$\{/g,
    /document\.write\s*\(/g,
    /dangerouslySetInnerHTML/g,
    /v-html\s*=/g,
    /\[innerHTML\]/g,
  ],
  commandInjection: [
    /exec\s*\(\s*[`'"]\s*.*\$\{/gi,
    /execSync\s*\(\s*[`'"]\s*.*\$\{/gi,
    /spawn\s*\(\s*[`'"]\s*.*\$\{/gi,
    /child_process/g,
    /eval\s*\(/g,
    /Function\s*\(/g,
  ],
  pathTraversal: [
    /readFile\s*\(\s*[^,]*\+/g,
    /readFileSync\s*\(\s*[^,]*\+/g,
    /fs\.(read|write|append).*\$\{/g,
    /\.\.\/.*\$\{/g,
  ],
  insecureCrypto: [
    /createHash\s*\(\s*['"]md5['"]\s*\)/gi,
    /createHash\s*\(\s*['"]sha1['"]\s*\)/gi,
    /Math\.random\s*\(\s*\)/g,
    /crypto\.pseudoRandomBytes/g,
  ],
  hardcodedCredentials: [
    /password\s*[=:]\s*['"][^'"]+['"]/gi,
    /passwd\s*[=:]\s*['"][^'"]+['"]/gi,
    /secret\s*[=:]\s*['"][^'"]+['"]/gi,
    /apiKey\s*[=:]\s*['"][^'"]+['"]/gi,
  ],
  insecureAuth: [
    /jwt\.sign\s*\([^)]*algorithm\s*:\s*['"]none['"]/gi,
    /verify\s*=\s*false/gi,
    /rejectUnauthorized\s*:\s*false/gi,
    /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0['"]?/g,
  ],
  cors: [
    /Access-Control-Allow-Origin['"]\s*:\s*['"]\*/g,
    /cors\s*\(\s*\)/g,
    /origin\s*:\s*true/g,
  ],
};

// ============================================
// SECURITY SCANNER CLASS
// ============================================

export class AISecurityScanner {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic();
  }

  /**
   * Scan code for security vulnerabilities
   */
  async scanCode(
    code: string,
    filePath: string,
    language: string = 'typescript'
  ): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];

    // 1. Pattern-based detection (fast)
    const patternVulns = this.patternBasedScan(code, filePath);
    vulnerabilities.push(...patternVulns);

    // 2. Secret detection
    const secrets = this.detectSecrets(code, filePath);
    for (const secret of secrets) {
      vulnerabilities.push({
        id: `secret-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        title: `Exposed ${secret.type}`,
        description: `A ${secret.type} was found in the code. Secrets should never be committed to source control.`,
        severity: 'critical',
        category: 'secrets',
        cweId: 'CWE-798',
        owaspCategory: 'A07:2021 – Identification and Authentication Failures',
        filePath: secret.filePath,
        lineStart: secret.lineNumber,
        lineEnd: secret.lineNumber,
        codeSnippet: `${secret.value.substring(0, 10)}...`,
        fix: {
          description: 'Move secret to environment variable',
          code: `process.env.${secret.type.toUpperCase().replace(/\s+/g, '_')}`,
          automated: false,
          breaking: false,
        },
      });
    }

    // 3. AI-powered deep analysis
    const aiVulns = await this.aiSecurityAnalysis(code, filePath, language);
    vulnerabilities.push(...aiVulns);

    return vulnerabilities;
  }

  /**
   * Pattern-based vulnerability scanning
   */
  private patternBasedScan(code: string, filePath: string): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];
    const lines = code.split('\n');

    // SQL Injection
    for (const pattern of VULN_PATTERNS.sqlInjection) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const lineNumber = this.getLineNumber(code, match.index);
        vulnerabilities.push({
          id: `sqli-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          title: 'Potential SQL Injection',
          description: 'User input appears to be directly interpolated into a SQL query. Use parameterized queries instead.',
          severity: 'critical',
          category: 'injection',
          cweId: 'CWE-89',
          owaspCategory: 'A03:2021 – Injection',
          filePath,
          lineStart: lineNumber,
          lineEnd: lineNumber,
          codeSnippet: lines[lineNumber - 1] || '',
          fix: {
            description: 'Use parameterized queries with placeholders',
            code: 'query("SELECT * FROM users WHERE id = $1", [userId])',
            automated: false,
            breaking: false,
          },
        });
      }
    }

    // XSS
    for (const pattern of VULN_PATTERNS.xss) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const lineNumber = this.getLineNumber(code, match.index);
        vulnerabilities.push({
          id: `xss-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          title: 'Potential Cross-Site Scripting (XSS)',
          description: 'Unsanitized data may be rendered as HTML. This could allow attackers to inject malicious scripts.',
          severity: 'high',
          category: 'xss',
          cweId: 'CWE-79',
          owaspCategory: 'A03:2021 – Injection',
          filePath,
          lineStart: lineNumber,
          lineEnd: lineNumber,
          codeSnippet: lines[lineNumber - 1] || '',
          fix: {
            description: 'Sanitize HTML content before rendering',
            code: 'import DOMPurify from "dompurify";\nconst safe = DOMPurify.sanitize(untrusted);',
            automated: false,
            breaking: false,
          },
        });
      }
    }

    // Command Injection
    for (const pattern of VULN_PATTERNS.commandInjection) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const lineNumber = this.getLineNumber(code, match.index);
        const matchText = match[0].toLowerCase();

        // Skip false positives for eval
        if (matchText === 'eval(' && !code.substring(match.index - 20, match.index).includes('user')) {
          continue;
        }

        vulnerabilities.push({
          id: `cmdi-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          title: 'Potential Command Injection',
          description: 'User input may be passed to a system command. This could allow attackers to execute arbitrary commands.',
          severity: 'critical',
          category: 'injection',
          cweId: 'CWE-78',
          owaspCategory: 'A03:2021 – Injection',
          filePath,
          lineStart: lineNumber,
          lineEnd: lineNumber,
          codeSnippet: lines[lineNumber - 1] || '',
          fix: {
            description: 'Use a safe command execution library or sanitize inputs',
            code: 'import { execFile } from "child_process";\nexecFile(command, [arg1, arg2], callback);',
            automated: false,
            breaking: false,
          },
        });
      }
    }

    // Insecure Crypto
    for (const pattern of VULN_PATTERNS.insecureCrypto) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const lineNumber = this.getLineNumber(code, match.index);
        const isMathRandom = match[0].includes('Math.random');

        vulnerabilities.push({
          id: `crypto-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          title: isMathRandom ? 'Insecure Random Number Generator' : 'Weak Cryptographic Hash',
          description: isMathRandom
            ? 'Math.random() is not cryptographically secure. Use crypto.randomBytes() instead.'
            : 'MD5 and SHA1 are considered weak for cryptographic purposes. Use SHA-256 or better.',
          severity: 'medium',
          category: 'cryptography',
          cweId: isMathRandom ? 'CWE-330' : 'CWE-328',
          owaspCategory: 'A02:2021 – Cryptographic Failures',
          filePath,
          lineStart: lineNumber,
          lineEnd: lineNumber,
          codeSnippet: lines[lineNumber - 1] || '',
          fix: {
            description: isMathRandom
              ? 'Use crypto.randomBytes for secure random numbers'
              : 'Use SHA-256 or SHA-512 instead',
            code: isMathRandom
              ? 'import { randomBytes } from "crypto";\nconst secure = randomBytes(32).toString("hex");'
              : 'crypto.createHash("sha256")',
            automated: true,
            breaking: false,
          },
        });
      }
    }

    // CORS issues
    for (const pattern of VULN_PATTERNS.cors) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const lineNumber = this.getLineNumber(code, match.index);
        vulnerabilities.push({
          id: `cors-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          title: 'Overly Permissive CORS Policy',
          description: 'Allowing all origins (*) can expose your API to cross-origin attacks.',
          severity: 'medium',
          category: 'configuration',
          cweId: 'CWE-942',
          owaspCategory: 'A05:2021 – Security Misconfiguration',
          filePath,
          lineStart: lineNumber,
          lineEnd: lineNumber,
          codeSnippet: lines[lineNumber - 1] || '',
          fix: {
            description: 'Restrict CORS to specific trusted origins',
            code: 'cors({ origin: ["https://yourdomain.com"] })',
            automated: false,
            breaking: true,
          },
        });
      }
    }

    return vulnerabilities;
  }

  /**
   * Detect secrets in code
   */
  private detectSecrets(code: string, filePath: string): SecretFinding[] {
    const secrets: SecretFinding[] = [];

    // Skip common false positive files
    if (filePath.includes('.example') ||
        filePath.includes('.sample') ||
        filePath.includes('test') ||
        filePath.includes('mock')) {
      return secrets;
    }

    for (const { name, pattern } of SECRET_PATTERNS) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);

      while ((match = regex.exec(code)) !== null) {
        const value = match[0];
        const entropy = this.calculateEntropy(value);

        // Only flag high-entropy matches to reduce false positives
        if (entropy > 3.5 || name.includes('Key') || name.includes('Token')) {
          secrets.push({
            type: name,
            value,
            filePath,
            lineNumber: this.getLineNumber(code, match.index),
            entropy,
          });
        }
      }
    }

    return secrets;
  }

  /**
   * Calculate Shannon entropy of a string
   */
  private calculateEntropy(str: string): number {
    const freq: Record<string, number> = {};
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }

    let entropy = 0;
    const len = str.length;
    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
   * Get line number from character index
   */
  private getLineNumber(code: string, index: number): number {
    return code.substring(0, index).split('\n').length;
  }

  /**
   * AI-powered deep security analysis
   */
  private async aiSecurityAnalysis(
    code: string,
    filePath: string,
    language: string
  ): Promise<Vulnerability[]> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: `You are a senior security researcher specializing in application security.
Analyze code for security vulnerabilities beyond simple pattern matching.

Look for:
1. Logic flaws in authentication/authorization
2. Race conditions
3. Insecure deserialization
4. Server-side request forgery (SSRF)
5. Insecure direct object references (IDOR)
6. Mass assignment vulnerabilities
7. Broken access control
8. Security logging gaps
9. Input validation bypass opportunities
10. Business logic vulnerabilities

Return JSON array of vulnerabilities:
[
  {
    "title": "Vulnerability Name",
    "description": "Detailed explanation",
    "severity": "critical" | "high" | "medium" | "low",
    "category": "category",
    "cweId": "CWE-XXX",
    "owaspCategory": "OWASP category",
    "lineStart": number,
    "lineEnd": number,
    "codeSnippet": "relevant code",
    "fix": {
      "description": "How to fix",
      "code": "Fixed code example",
      "automated": boolean,
      "breaking": boolean
    }
  }
]

Only report real vulnerabilities with high confidence. No false positives.`,
        messages: [
          {
            role: 'user',
            content: `Analyze this ${language} code for security vulnerabilities:

File: ${filePath}

\`\`\`${language}
${code}
\`\`\`

Report any security issues found.`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        return [];
      }

      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Add IDs and file paths
      return parsed.map((v: Partial<Vulnerability>) => ({
        ...v,
        id: `ai-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        filePath,
      }));
    } catch (error) {
      console.error('[SecurityScanner] AI analysis error:', error);
      return [];
    }
  }

  /**
   * Perform a full security scan of multiple files
   */
  async fullScan(
    files: Array<{ path: string; content: string; language?: string }>
  ): Promise<SecurityScanResult> {
    const allVulnerabilities: Vulnerability[] = [];

    for (const file of files) {
      const vulns = await this.scanCode(
        file.content,
        file.path,
        file.language || this.detectLanguage(file.path)
      );
      allVulnerabilities.push(...vulns);
    }

    const summary = this.summarizeVulnerabilities(allVulnerabilities);
    const score = this.calculateSecurityScore(summary, files.length);
    const recommendations = this.generateRecommendations(allVulnerabilities);

    return {
      scannedAt: new Date().toISOString(),
      filesScanned: files.length,
      vulnerabilities: allVulnerabilities,
      summary,
      recommendations,
      score,
    };
  }

  /**
   * Summarize vulnerabilities by severity
   */
  private summarizeVulnerabilities(vulns: Vulnerability[]): SecuritySummary {
    return {
      critical: vulns.filter(v => v.severity === 'critical').length,
      high: vulns.filter(v => v.severity === 'high').length,
      medium: vulns.filter(v => v.severity === 'medium').length,
      low: vulns.filter(v => v.severity === 'low').length,
      info: vulns.filter(v => v.severity === 'info').length,
      total: vulns.length,
    };
  }

  /**
   * Calculate security score (0-100)
   */
  private calculateSecurityScore(summary: SecuritySummary, fileCount: number): number {
    // Start with 100, deduct for vulnerabilities
    let score = 100;

    score -= summary.critical * 25;
    score -= summary.high * 15;
    score -= summary.medium * 8;
    score -= summary.low * 3;
    score -= summary.info * 1;

    // Normalize based on file count
    const normalized = score + (fileCount > 10 ? 5 : 0);

    return Math.max(0, Math.min(100, normalized));
  }

  /**
   * Generate security recommendations
   */
  private generateRecommendations(vulns: Vulnerability[]): string[] {
    const recommendations: string[] = [];
    const categories = new Set(vulns.map(v => v.category));

    if (categories.has('injection')) {
      recommendations.push('Implement parameterized queries and input validation across all database interactions');
    }
    if (categories.has('xss')) {
      recommendations.push('Add Content Security Policy (CSP) headers and sanitize all user-generated content');
    }
    if (categories.has('secrets')) {
      recommendations.push('Move all secrets to environment variables and add secret scanning to CI/CD pipeline');
    }
    if (categories.has('authentication')) {
      recommendations.push('Review authentication flow and implement multi-factor authentication');
    }
    if (categories.has('cryptography')) {
      recommendations.push('Upgrade cryptographic algorithms to current standards (SHA-256+, AES-256)');
    }
    if (categories.has('configuration')) {
      recommendations.push('Review security headers and CORS configuration');
    }

    if (vulns.length === 0) {
      recommendations.push('No vulnerabilities detected. Consider adding security testing to CI/CD pipeline.');
    }

    return recommendations;
  }

  /**
   * Detect language from file path
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      rb: 'ruby',
      go: 'go',
      rs: 'rust',
      java: 'java',
      cs: 'csharp',
      php: 'php',
    };
    return langMap[ext || ''] || 'unknown';
  }

  /**
   * Generate auto-fix for a vulnerability
   */
  async generateFix(vuln: Vulnerability, fullCode: string): Promise<SecurityFix | null> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: `You are a security engineer. Generate a fix for the security vulnerability.

Return JSON:
{
  "description": "What the fix does",
  "code": "Complete fixed code snippet that can replace the vulnerable code",
  "automated": true/false (can this be auto-applied?),
  "breaking": true/false (might this break existing functionality?)
}`,
        messages: [
          {
            role: 'user',
            content: `Fix this vulnerability:

Title: ${vuln.title}
Description: ${vuln.description}
Category: ${vuln.category}
CWE: ${vuln.cweId}

Vulnerable code (lines ${vuln.lineStart}-${vuln.lineEnd}):
${vuln.codeSnippet}

Full file context:
${fullCode}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') return null;

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('[SecurityScanner] Fix generation error:', error);
      return null;
    }
  }
}

// ============================================
// EXPORTS
// ============================================

export const securityScanner = new AISecurityScanner();

/**
 * Quick scan function
 */
export async function scanSecurity(
  code: string,
  filePath: string
): Promise<Vulnerability[]> {
  return securityScanner.scanCode(code, filePath);
}

/**
 * Full project scan
 */
export async function scanProject(
  files: Array<{ path: string; content: string }>
): Promise<SecurityScanResult> {
  return securityScanner.fullScan(files);
}
