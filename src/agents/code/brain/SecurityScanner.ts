/**
 * SECURITY SCANNER
 *
 * Comprehensive security analysis for generated and existing code.
 *
 * Detects:
 * - OWASP Top 10 vulnerabilities
 * - Common security anti-patterns
 * - Dependency vulnerabilities (CVEs)
 * - Secret exposure risks
 * - Input validation issues
 * - Authentication/Authorization flaws
 *
 * This is what separates amateur code from production-ready code.
 */

import Anthropic from '@anthropic-ai/sdk';
import { GeneratedFile } from '../../core/types';
import { AgentStreamCallback } from '../../core/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// TYPES
// ============================================================================

export interface SecurityVulnerability {
  id: string;
  type: VulnerabilityType;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  file: string;
  line?: number;
  code?: string;
  cwe?: string;  // Common Weakness Enumeration
  owasp?: string;  // OWASP category
  fix: {
    description: string;
    code?: string;
    automated: boolean;
  };
  references?: string[];
}

export type VulnerabilityType =
  | 'injection'           // SQL, NoSQL, OS command injection
  | 'xss'                 // Cross-site scripting
  | 'csrf'                // Cross-site request forgery
  | 'auth'                // Authentication issues
  | 'access-control'      // Broken access control
  | 'crypto'              // Cryptographic failures
  | 'secrets'             // Exposed secrets
  | 'validation'          // Input validation
  | 'dependencies'        // Vulnerable dependencies
  | 'configuration'       // Security misconfiguration
  | 'logging'             // Insufficient logging
  | 'ssrf'                // Server-side request forgery
  | 'path-traversal'      // Path traversal
  | 'prototype-pollution' // JavaScript prototype pollution
  | 'deserialization'     // Insecure deserialization
  | 'race-condition'      // Race conditions
  | 'other';

export interface SecurityScanResult {
  overallScore: number;  // 0-100 (100 = secure)
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  vulnerabilities: SecurityVulnerability[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  recommendations: string[];
  passedChecks: string[];
  scanTime: number;
}

// ============================================================================
// SECURITY PATTERNS
// ============================================================================

const SECURITY_PATTERNS: {
  type: VulnerabilityType;
  pattern: RegExp;
  severity: SecurityVulnerability['severity'];
  title: string;
  description: string;
  cwe: string;
  owasp: string;
  fix: string;
}[] = [
  // SQL Injection
  {
    type: 'injection',
    pattern: /\$\{.*\}.*(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)/i,
    severity: 'critical',
    title: 'Potential SQL Injection',
    description: 'String interpolation in SQL query can lead to SQL injection attacks.',
    cwe: 'CWE-89',
    owasp: 'A03:2021 - Injection',
    fix: 'Use parameterized queries or prepared statements instead of string interpolation.',
  },
  {
    type: 'injection',
    pattern: /query\s*\(\s*['"`].*\+/i,
    severity: 'critical',
    title: 'SQL Query String Concatenation',
    description: 'Concatenating strings in SQL queries can lead to SQL injection.',
    cwe: 'CWE-89',
    owasp: 'A03:2021 - Injection',
    fix: 'Use parameterized queries with placeholders ($1, ?, :param).',
  },

  // XSS
  {
    type: 'xss',
    pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html/,
    severity: 'high',
    title: 'Dangerous HTML Injection (React)',
    description: 'dangerouslySetInnerHTML can lead to XSS if content is not sanitized.',
    cwe: 'CWE-79',
    owasp: 'A03:2021 - Injection',
    fix: 'Sanitize HTML content using DOMPurify before rendering.',
  },
  {
    type: 'xss',
    pattern: /innerHTML\s*=\s*[^;]*(?:req\.|params\.|query\.|body\.)/,
    severity: 'critical',
    title: 'Direct innerHTML Assignment from User Input',
    description: 'Setting innerHTML from user input enables XSS attacks.',
    cwe: 'CWE-79',
    owasp: 'A03:2021 - Injection',
    fix: 'Use textContent instead, or sanitize with DOMPurify.',
  },
  {
    type: 'xss',
    pattern: /document\.write\s*\(/,
    severity: 'medium',
    title: 'document.write Usage',
    description: 'document.write can be exploited for XSS attacks.',
    cwe: 'CWE-79',
    owasp: 'A03:2021 - Injection',
    fix: 'Use DOM manipulation methods (createElement, appendChild) instead.',
  },

  // Command Injection
  {
    type: 'injection',
    pattern: /exec\s*\(\s*['"`].*\$\{|exec\s*\(\s*.*\+/,
    severity: 'critical',
    title: 'Command Injection Risk',
    description: 'Executing shell commands with user input can lead to command injection.',
    cwe: 'CWE-78',
    owasp: 'A03:2021 - Injection',
    fix: 'Use spawn with array arguments instead of exec with string interpolation.',
  },
  {
    type: 'injection',
    pattern: /child_process.*exec.*(?:req\.|params\.|query\.|body\.)/,
    severity: 'critical',
    title: 'Shell Command with User Input',
    description: 'Passing user input to shell commands enables command injection.',
    cwe: 'CWE-78',
    owasp: 'A03:2021 - Injection',
    fix: 'Validate and sanitize input, use spawn with array arguments.',
  },

  // Secrets Exposure
  {
    type: 'secrets',
    pattern: /(?:api[_-]?key|apikey|secret|password|token|auth)['"]\s*[:=]\s*['"][A-Za-z0-9+/=]{20,}/i,
    severity: 'critical',
    title: 'Hardcoded Secret',
    description: 'Hardcoded API keys, passwords, or tokens detected in source code.',
    cwe: 'CWE-798',
    owasp: 'A02:2021 - Cryptographic Failures',
    fix: 'Move secrets to environment variables or a secrets manager.',
  },
  {
    type: 'secrets',
    pattern: /(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}/,
    severity: 'critical',
    title: 'AWS Access Key Exposed',
    description: 'AWS access key ID detected in source code.',
    cwe: 'CWE-798',
    owasp: 'A02:2021 - Cryptographic Failures',
    fix: 'Remove immediately, rotate the key, use IAM roles or environment variables.',
  },
  {
    type: 'secrets',
    pattern: /ghp_[A-Za-z0-9]{36}/,
    severity: 'critical',
    title: 'GitHub Personal Access Token Exposed',
    description: 'GitHub PAT detected in source code.',
    cwe: 'CWE-798',
    owasp: 'A02:2021 - Cryptographic Failures',
    fix: 'Remove immediately, revoke the token, use environment variables.',
  },

  // Authentication Issues
  {
    type: 'auth',
    pattern: /jwt\.sign\s*\([^)]*algorithm\s*:\s*['"]none['"]/i,
    severity: 'critical',
    title: 'JWT None Algorithm',
    description: 'Using "none" algorithm for JWT defeats the purpose of signing.',
    cwe: 'CWE-327',
    owasp: 'A02:2021 - Cryptographic Failures',
    fix: 'Use HS256, RS256, or other secure algorithms.',
  },
  {
    type: 'auth',
    pattern: /session\s*\.\s*secret\s*=\s*['"][^'"]{1,10}['"]/,
    severity: 'high',
    title: 'Weak Session Secret',
    description: 'Session secret is too short or predictable.',
    cwe: 'CWE-330',
    owasp: 'A02:2021 - Cryptographic Failures',
    fix: 'Use a cryptographically random secret of at least 32 characters.',
  },

  // Cryptographic Issues
  {
    type: 'crypto',
    pattern: /createHash\s*\(\s*['"](?:md5|sha1)['"]\s*\)/i,
    severity: 'medium',
    title: 'Weak Hashing Algorithm',
    description: 'MD5 and SHA1 are considered weak for security purposes.',
    cwe: 'CWE-328',
    owasp: 'A02:2021 - Cryptographic Failures',
    fix: 'Use SHA-256 or SHA-3 for hashing, bcrypt/argon2 for passwords.',
  },
  {
    type: 'crypto',
    pattern: /Math\.random\s*\(\s*\).*(?:token|secret|key|password|id)/i,
    severity: 'high',
    title: 'Insecure Random Number Generation',
    description: 'Math.random() is not cryptographically secure.',
    cwe: 'CWE-330',
    owasp: 'A02:2021 - Cryptographic Failures',
    fix: 'Use crypto.randomBytes() or crypto.randomUUID() for security-sensitive values.',
  },

  // Path Traversal
  {
    type: 'path-traversal',
    pattern: /(?:readFile|readFileSync|createReadStream)\s*\([^)]*(?:req\.|params\.|query\.|body\.)/,
    severity: 'high',
    title: 'Path Traversal Risk',
    description: 'Reading files with user-provided paths can lead to path traversal.',
    cwe: 'CWE-22',
    owasp: 'A01:2021 - Broken Access Control',
    fix: 'Validate and sanitize paths, use path.resolve() with a whitelist.',
  },

  // SSRF
  {
    type: 'ssrf',
    pattern: /(?:fetch|axios|request)\s*\([^)]*(?:req\.|params\.|query\.|body\.)/,
    severity: 'high',
    title: 'Server-Side Request Forgery (SSRF) Risk',
    description: 'Making HTTP requests with user-provided URLs can lead to SSRF.',
    cwe: 'CWE-918',
    owasp: 'A10:2021 - SSRF',
    fix: 'Validate URLs against a whitelist, block private IP ranges.',
  },

  // Prototype Pollution
  {
    type: 'prototype-pollution',
    pattern: /Object\.assign\s*\(\s*\{\s*\}\s*,\s*(?:req\.|params\.|query\.|body\.)/,
    severity: 'medium',
    title: 'Prototype Pollution Risk',
    description: 'Merging user input into objects can lead to prototype pollution.',
    cwe: 'CWE-1321',
    owasp: 'A03:2021 - Injection',
    fix: 'Use a safe merge library or explicitly copy known properties.',
  },
  {
    type: 'prototype-pollution',
    pattern: /\[['"]__proto__['"]\]|\[['"]constructor['"]\]|\[['"]prototype['"]\]/,
    severity: 'high',
    title: 'Potential Prototype Pollution',
    description: 'Direct access to __proto__, constructor, or prototype is dangerous.',
    cwe: 'CWE-1321',
    owasp: 'A03:2021 - Injection',
    fix: 'Validate object keys and reject __proto__, constructor, prototype.',
  },

  // Input Validation
  {
    type: 'validation',
    pattern: /eval\s*\([^)]*(?:req\.|params\.|query\.|body\.)/,
    severity: 'critical',
    title: 'Code Injection via eval()',
    description: 'Using eval() with user input enables arbitrary code execution.',
    cwe: 'CWE-94',
    owasp: 'A03:2021 - Injection',
    fix: 'Never use eval() with user input. Use JSON.parse() for JSON data.',
  },
  {
    type: 'validation',
    pattern: /new\s+Function\s*\([^)]*(?:req\.|params\.|query\.|body\.)/,
    severity: 'critical',
    title: 'Code Injection via Function Constructor',
    description: 'Using Function constructor with user input enables code injection.',
    cwe: 'CWE-94',
    owasp: 'A03:2021 - Injection',
    fix: 'Avoid dynamic code generation with user input.',
  },

  // Logging Issues
  {
    type: 'logging',
    pattern: /console\.log\s*\([^)]*(?:password|token|secret|key|auth)/i,
    severity: 'medium',
    title: 'Sensitive Data in Logs',
    description: 'Logging sensitive information can expose credentials.',
    cwe: 'CWE-532',
    owasp: 'A09:2021 - Security Logging and Monitoring Failures',
    fix: 'Redact or remove sensitive data before logging.',
  },

  // CORS Issues
  {
    type: 'configuration',
    pattern: /Access-Control-Allow-Origin['"]\s*:\s*['"]\*/,
    severity: 'medium',
    title: 'Permissive CORS Configuration',
    description: 'Allowing all origins (*) can expose API to unauthorized access.',
    cwe: 'CWE-942',
    owasp: 'A05:2021 - Security Misconfiguration',
    fix: 'Specify allowed origins explicitly instead of using wildcard.',
  },
  {
    type: 'configuration',
    pattern: /credentials\s*:\s*true.*origin\s*:\s*['"]\*/,
    severity: 'high',
    title: 'CORS with Credentials and Wildcard Origin',
    description: 'This configuration is invalid and insecure.',
    cwe: 'CWE-942',
    owasp: 'A05:2021 - Security Misconfiguration',
    fix: 'Cannot use credentials with wildcard origin. Specify exact origins.',
  },
];

// ============================================================================
// MAIN SCANNER
// ============================================================================

export class SecurityScanner {
  private model = 'claude-opus-4-5-20251101';

  /**
   * Scan files for security vulnerabilities
   */
  async scan(
    files: GeneratedFile[],
    onStream?: AgentStreamCallback
  ): Promise<SecurityScanResult> {
    const startTime = Date.now();
    const vulnerabilities: SecurityVulnerability[] = [];

    onStream?.({
      type: 'evaluating',
      message: '🔒 Starting security scan...',
      timestamp: Date.now(),
      progress: 0,
    });

    // Step 1: Pattern-based detection (fast)
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileVulns = this.scanFilePatterns(file);
      vulnerabilities.push(...fileVulns);

      onStream?.({
        type: 'evaluating',
        message: `🔍 Scanning ${file.path}... (${fileVulns.length} issues)`,
        timestamp: Date.now(),
        progress: Math.round((i / files.length) * 50),
      });
    }

    // Step 2: AI-powered deep analysis for critical files
    const criticalFiles = files.filter(f =>
      f.path.includes('auth') ||
      f.path.includes('api') ||
      f.path.includes('server') ||
      f.path.includes('middleware') ||
      f.path.includes('route')
    );

    if (criticalFiles.length > 0 && criticalFiles.length <= 5) {
      onStream?.({
        type: 'evaluating',
        message: '🧠 Deep analysis of critical files...',
        timestamp: Date.now(),
        progress: 60,
      });

      const aiVulns = await this.aiAnalysis(criticalFiles);
      vulnerabilities.push(...aiVulns);
    }

    // Step 3: Calculate score and grade
    const summary = {
      critical: vulnerabilities.filter(v => v.severity === 'critical').length,
      high: vulnerabilities.filter(v => v.severity === 'high').length,
      medium: vulnerabilities.filter(v => v.severity === 'medium').length,
      low: vulnerabilities.filter(v => v.severity === 'low').length,
      info: vulnerabilities.filter(v => v.severity === 'info').length,
    };

    const score = this.calculateScore(summary);
    const grade = this.calculateGrade(score);

    // Step 4: Generate recommendations
    const recommendations = this.generateRecommendations(vulnerabilities);
    const passedChecks = this.getPassedChecks(files, vulnerabilities);

    onStream?.({
      type: 'complete',
      message: `🔒 Security scan complete: Grade ${grade} (${score}/100)`,
      timestamp: Date.now(),
      progress: 100,
      details: { grade, score, summary },
    });

    return {
      overallScore: score,
      grade,
      vulnerabilities,
      summary,
      recommendations,
      passedChecks,
      scanTime: Date.now() - startTime,
    };
  }

  /**
   * Scan a file using pattern matching
   */
  private scanFilePatterns(file: GeneratedFile): SecurityVulnerability[] {
    const vulnerabilities: SecurityVulnerability[] = [];
    const lines = file.content.split('\n');

    for (const pattern of SECURITY_PATTERNS) {
      // Check full content first
      if (pattern.pattern.test(file.content)) {
        // Find specific line
        let lineNumber: number | undefined;
        let codeSnippet: string | undefined;

        for (let i = 0; i < lines.length; i++) {
          if (pattern.pattern.test(lines[i])) {
            lineNumber = i + 1;
            codeSnippet = lines.slice(Math.max(0, i - 1), i + 2).join('\n');
            break;
          }
        }

        vulnerabilities.push({
          id: `${pattern.type}-${file.path}-${lineNumber || 0}`,
          type: pattern.type,
          severity: pattern.severity,
          title: pattern.title,
          description: pattern.description,
          file: file.path,
          line: lineNumber,
          code: codeSnippet,
          cwe: pattern.cwe,
          owasp: pattern.owasp,
          fix: {
            description: pattern.fix,
            automated: false,
          },
        });
      }
    }

    return vulnerabilities;
  }

  /**
   * AI-powered deep analysis for complex vulnerabilities
   */
  private async aiAnalysis(files: GeneratedFile[]): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    const filesContent = files.map(f => `=== ${f.path} ===\n${f.content}`).join('\n\n');

    const prompt = `You are a senior security engineer performing a code review.
Analyze this code for security vulnerabilities that pattern matching might miss.

CODE TO ANALYZE:
${filesContent}

Look for:
1. Business logic flaws
2. Race conditions
3. Improper error handling that leaks info
4. Missing authentication/authorization checks
5. Insecure data handling
6. Time-of-check to time-of-use (TOCTOU) issues

For each vulnerability found, respond with JSON:
{
  "vulnerabilities": [
    {
      "type": "vulnerability type",
      "severity": "critical|high|medium|low|info",
      "title": "Short title",
      "description": "Detailed description",
      "file": "filename",
      "line": optional line number,
      "fix": "How to fix this"
    }
  ]
}

If no additional vulnerabilities found, return: {"vulnerabilities": []}
OUTPUT ONLY JSON.`;

    try {
      const response = await anthropic.messages.create({
        model: this.model,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        for (const v of parsed.vulnerabilities || []) {
          vulnerabilities.push({
            id: `ai-${v.file}-${Date.now()}`,
            type: this.mapVulnerabilityType(v.type),
            severity: this.validateSeverity(v.severity),
            title: String(v.title),
            description: String(v.description),
            file: String(v.file),
            line: v.line,
            fix: {
              description: String(v.fix),
              automated: false,
            },
          });
        }
      }
    } catch (error) {
      console.error('[SecurityScanner] AI analysis error:', error);
    }

    return vulnerabilities;
  }

  /**
   * Calculate security score
   */
  private calculateScore(summary: SecurityScanResult['summary']): number {
    // Deduct points for each severity level
    let score = 100;
    score -= summary.critical * 25;
    score -= summary.high * 15;
    score -= summary.medium * 8;
    score -= summary.low * 3;
    score -= summary.info * 1;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate letter grade
   */
  private calculateGrade(score: number): SecurityScanResult['grade'] {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Generate recommendations based on vulnerabilities
   */
  private generateRecommendations(vulnerabilities: SecurityVulnerability[]): string[] {
    const recommendations: string[] = [];
    const types = new Set(vulnerabilities.map(v => v.type));

    if (types.has('injection')) {
      recommendations.push('Implement parameterized queries and input validation for all user inputs.');
    }
    if (types.has('xss')) {
      recommendations.push('Use a Content Security Policy (CSP) and sanitize all HTML output.');
    }
    if (types.has('secrets')) {
      recommendations.push('Move all secrets to environment variables and use a secrets manager.');
    }
    if (types.has('auth')) {
      recommendations.push('Implement proper authentication with secure session management.');
    }
    if (types.has('crypto')) {
      recommendations.push('Use modern cryptographic algorithms (SHA-256+, bcrypt for passwords).');
    }
    if (types.has('validation')) {
      recommendations.push('Add comprehensive input validation using a library like Zod or Joi.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Great job! Continue following security best practices.');
    }

    return recommendations;
  }

  /**
   * Get list of passed security checks
   */
  private getPassedChecks(files: GeneratedFile[], vulnerabilities: SecurityVulnerability[]): string[] {
    const passed: string[] = [];
    const vulnTypes = new Set(vulnerabilities.map(v => v.type));

    if (!vulnTypes.has('injection')) passed.push('No injection vulnerabilities detected');
    if (!vulnTypes.has('xss')) passed.push('No XSS vulnerabilities detected');
    if (!vulnTypes.has('secrets')) passed.push('No hardcoded secrets detected');
    if (!vulnTypes.has('auth')) passed.push('No authentication issues detected');
    if (!vulnTypes.has('crypto')) passed.push('Cryptographic practices look good');

    // Check for positive patterns
    const allContent = files.map(f => f.content).join('\n');
    if (allContent.includes('helmet')) passed.push('Using Helmet for HTTP security headers');
    if (allContent.includes('csrf')) passed.push('CSRF protection implemented');
    if (allContent.includes('rate-limit') || allContent.includes('rateLimit')) passed.push('Rate limiting configured');
    if (allContent.includes('sanitize') || allContent.includes('escape')) passed.push('Input sanitization detected');

    return passed;
  }

  private mapVulnerabilityType(type: string): VulnerabilityType {
    const typeMap: Record<string, VulnerabilityType> = {
      injection: 'injection',
      xss: 'xss',
      csrf: 'csrf',
      authentication: 'auth',
      authorization: 'access-control',
      crypto: 'crypto',
      secrets: 'secrets',
      validation: 'validation',
      dependencies: 'dependencies',
      configuration: 'configuration',
      logging: 'logging',
      ssrf: 'ssrf',
    };
    return typeMap[type.toLowerCase()] || 'other';
  }

  private validateSeverity(severity: unknown): SecurityVulnerability['severity'] {
    const valid = ['critical', 'high', 'medium', 'low', 'info'];
    return valid.includes(String(severity)) ? (severity as SecurityVulnerability['severity']) : 'medium';
  }

  /**
   * Quick check for a single file
   */
  quickCheck(file: GeneratedFile): SecurityVulnerability[] {
    return this.scanFilePatterns(file);
  }

  /**
   * Check if code is safe to execute
   */
  isSafeToExecute(code: string): { safe: boolean; reason?: string } {
    // Check for dangerous patterns
    const dangerousPatterns = [
      { pattern: /rm\s+-rf/, reason: 'Destructive file deletion' },
      { pattern: /eval\s*\(/, reason: 'Dynamic code execution' },
      { pattern: /child_process/, reason: 'Shell command execution' },
      { pattern: /require\s*\(\s*['"]fs['"]/, reason: 'File system access' },
    ];

    for (const { pattern, reason } of dangerousPatterns) {
      if (pattern.test(code)) {
        return { safe: false, reason };
      }
    }

    return { safe: true };
  }
}

export const securityScanner = new SecurityScanner();
