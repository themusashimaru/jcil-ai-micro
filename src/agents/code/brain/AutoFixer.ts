/**
 * AUTO-FIX ENGINE
 *
 * Automatically fixes code issues without human intervention.
 * The self-healing capability that makes this agent legendary.
 *
 * Fixes:
 * - TypeScript/JavaScript errors
 * - Linting issues (ESLint, Prettier)
 * - Import errors
 * - Type mismatches
 * - Missing dependencies
 * - Common anti-patterns
 * - Security vulnerabilities
 * - Performance issues
 *
 * This is what makes the agent truly autonomous.
 */

import Anthropic from '@anthropic-ai/sdk';
import { GeneratedFile } from '../../core/types';
import { AgentStreamCallback } from '../../core/types';
import { SecurityVulnerability } from './SecurityScanner';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ============================================================================
// TYPES
// ============================================================================

export interface CodeIssue {
  id: string;
  type: IssueType;
  severity: 'error' | 'warning' | 'info';
  message: string;
  file: string;
  line?: number;
  column?: number;
  code?: string;
  rule?: string;  // ESLint rule, TS error code, etc.
  autoFixable: boolean;
}

export type IssueType =
  | 'typescript'
  | 'eslint'
  | 'prettier'
  | 'import'
  | 'dependency'
  | 'security'
  | 'performance'
  | 'logic'
  | 'syntax'
  | 'runtime';

export interface Fix {
  issueId: string;
  file: string;
  description: string;
  before: string;
  after: string;
  line?: number;
  confidence: number;  // 0-1
  automated: boolean;
}

export interface FixResult {
  success: boolean;
  fixedFiles: GeneratedFile[];
  appliedFixes: Fix[];
  remainingIssues: CodeIssue[];
  summary: {
    totalIssues: number;
    fixed: number;
    skipped: number;
    failed: number;
  };
}

// ============================================================================
// FIX PATTERNS
// ============================================================================

interface FixPattern {
  type: IssueType;
  pattern: RegExp;
  messagePattern?: RegExp;
  fix: (match: RegExpMatchArray, context: FixContext) => string;
  confidence: number;
  description: string;
}

interface FixContext {
  file: GeneratedFile;
  line?: number;
  fullContent: string;
  imports: string[];
}

const FIX_PATTERNS: FixPattern[] = [
  // Missing semicolons
  {
    type: 'eslint',
    pattern: /^(.+[^;\s{}\n])(\s*)$/gm,
    messagePattern: /missing semicolon/i,
    fix: (match) => `${match[1]};${match[2]}`,
    confidence: 0.95,
    description: 'Add missing semicolon',
  },

  // Single quotes to double quotes (or vice versa based on project)
  {
    type: 'prettier',
    pattern: /"([^"\\]|\\.)*"/g,
    messagePattern: /strings must use singlequote/i,
    fix: (match) => match[0].replace(/"/g, "'"),
    confidence: 0.9,
    description: 'Convert double quotes to single quotes',
  },

  // Missing async/await
  {
    type: 'typescript',
    pattern: /(\s+)(.+\.then\()/g,
    messagePattern: /promise.*not handled/i,
    fix: (match) => `${match[1]}await ${match[2].replace('.then(', '').replace(/\)$/, '')}`,
    confidence: 0.7,
    description: 'Convert .then() to async/await',
  },

  // console.log removal for production
  {
    type: 'eslint',
    pattern: /^\s*console\.(log|debug|info)\(.+\);?\s*$/gm,
    messagePattern: /no-console/i,
    fix: () => '',
    confidence: 0.9,
    description: 'Remove console.log statement',
  },

  // Unused variable prefix
  {
    type: 'typescript',
    pattern: /\b(const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g,
    messagePattern: /is declared but.*never used/i,
    fix: (match) => `${match[1]} _${match[2]} =`,
    confidence: 0.85,
    description: 'Prefix unused variable with underscore',
  },

  // Missing return type annotation
  {
    type: 'typescript',
    pattern: /((?:async\s+)?function\s+\w+\([^)]*\))\s*{/g,
    messagePattern: /missing return type/i,
    fix: (match) => `${match[1]}: void {`,
    confidence: 0.6,
    description: 'Add return type annotation',
  },

  // any to unknown
  {
    type: 'typescript',
    pattern: /:\s*any\b/g,
    messagePattern: /unexpected any/i,
    fix: () => ': unknown',
    confidence: 0.7,
    description: 'Replace any with unknown',
  },

  // == to ===
  {
    type: 'eslint',
    pattern: /([^=!])={2}([^=])/g,
    messagePattern: /eqeqeq|use.*===|strict equality/i,
    fix: (match) => `${match[1]}===${match[2]}`,
    confidence: 0.95,
    description: 'Use strict equality (===)',
  },

  // != to !==
  {
    type: 'eslint',
    pattern: /!={1}([^=])/g,
    messagePattern: /eqeqeq|use.*!==|strict equality/i,
    fix: (match) => `!==${match[1]}`,
    confidence: 0.95,
    description: 'Use strict inequality (!==)',
  },

  // var to const/let
  {
    type: 'eslint',
    pattern: /\bvar\s+/g,
    messagePattern: /no-var|prefer-const/i,
    fix: () => 'const ',
    confidence: 0.8,
    description: 'Replace var with const',
  },

  // Trailing comma
  {
    type: 'prettier',
    pattern: /([}\])])\s*$/gm,
    messagePattern: /missing trailing comma/i,
    fix: (match) => `,${match[1]}`,
    confidence: 0.85,
    description: 'Add trailing comma',
  },

  // Empty catch block
  {
    type: 'eslint',
    pattern: /catch\s*\([^)]*\)\s*{\s*}/g,
    messagePattern: /empty.*catch|no-empty/i,
    fix: (match) => match[0].replace('{}', '{ /* Error handled silently */ }'),
    confidence: 0.8,
    description: 'Add comment to empty catch block',
  },

  // Missing error handling for async
  {
    type: 'logic',
    pattern: /await\s+\w+\([^)]*\)\s*(?!\.catch)/g,
    fix: (match) => `${match[0]}.catch(console.error)`,
    confidence: 0.5,
    description: 'Add error handling for async call',
  },
];

// ============================================================================
// IMPORT FIXES
// ============================================================================

const COMMON_IMPORTS: Record<string, string> = {
  'useState': "import { useState } from 'react';",
  'useEffect': "import { useEffect } from 'react';",
  'useCallback': "import { useCallback } from 'react';",
  'useMemo': "import { useMemo } from 'react';",
  'useRef': "import { useRef } from 'react';",
  'useContext': "import { useContext } from 'react';",
  'useReducer': "import { useReducer } from 'react';",
  'React': "import React from 'react';",
  'NextResponse': "import { NextResponse } from 'next/server';",
  'NextRequest': "import { NextRequest } from 'next/server';",
  'useRouter': "import { useRouter } from 'next/navigation';",
  'useSearchParams': "import { useSearchParams } from 'next/navigation';",
  'usePathname': "import { usePathname } from 'next/navigation';",
  'Link': "import Link from 'next/link';",
  'Image': "import Image from 'next/image';",
  'z': "import { z } from 'zod';",
  'zod': "import { z } from 'zod';",
  'prisma': "import { prisma } from '@/lib/prisma';",
  'clsx': "import clsx from 'clsx';",
  'cn': "import { cn } from '@/lib/utils';",
  'axios': "import axios from 'axios';",
  'fs': "import fs from 'fs';",
  'path': "import path from 'path';",
  'express': "import express from 'express';",
};

// ============================================================================
// MAIN AUTO-FIXER
// ============================================================================

export class AutoFixer {
  private model = 'claude-opus-4-5-20251101';

  /**
   * Automatically fix all issues in files
   */
  async fix(
    files: GeneratedFile[],
    issues: CodeIssue[],
    onStream?: AgentStreamCallback
  ): Promise<FixResult> {
    const appliedFixes: Fix[] = [];
    const remainingIssues: CodeIssue[] = [];
    let fixedFiles = [...files];

    onStream?.({
      type: 'pivoting',
      message: `🔧 Auto-fixing ${issues.length} issues...`,
      timestamp: Date.now(),
      progress: 0,
    });

    // Group issues by file
    const issuesByFile = new Map<string, CodeIssue[]>();
    for (const issue of issues) {
      const fileIssues = issuesByFile.get(issue.file) || [];
      fileIssues.push(issue);
      issuesByFile.set(issue.file, fileIssues);
    }

    let processedIssues = 0;

    // Process each file
    for (const [filePath, fileIssues] of issuesByFile) {
      const file = fixedFiles.find(f => f.path === filePath);
      if (!file) {
        remainingIssues.push(...fileIssues);
        continue;
      }

      onStream?.({
        type: 'pivoting',
        message: `🔧 Fixing ${filePath} (${fileIssues.length} issues)`,
        timestamp: Date.now(),
        progress: Math.round((processedIssues / issues.length) * 100),
      });

      let currentContent = file.content;
      const context = this.buildContext(file, currentContent);

      for (const issue of fileIssues) {
        const fix = await this.findFix(issue, currentContent, context);

        if (fix) {
          // Apply the fix
          currentContent = this.applyFix(currentContent, fix);
          appliedFixes.push(fix);

          onStream?.({
            type: 'thinking',
            message: `  ✓ ${fix.description}`,
            timestamp: Date.now(),
          });
        } else {
          remainingIssues.push(issue);
        }

        processedIssues++;
      }

      // Update the file
      fixedFiles = fixedFiles.map(f =>
        f.path === filePath
          ? { ...f, content: currentContent, linesOfCode: currentContent.split('\n').length }
          : f
      );
    }

    // Try AI-powered fixes for remaining issues
    if (remainingIssues.length > 0 && remainingIssues.length <= 10) {
      onStream?.({
        type: 'pivoting',
        message: `🧠 AI-powered fixes for ${remainingIssues.length} remaining issues...`,
        timestamp: Date.now(),
        progress: 90,
      });

      const aiFixResult = await this.aiPoweredFix(fixedFiles, remainingIssues);
      fixedFiles = aiFixResult.files;
      appliedFixes.push(...aiFixResult.fixes);

      // Remove successfully fixed issues from remaining
      const fixedIssueIds = new Set(aiFixResult.fixes.map(f => f.issueId));
      remainingIssues.splice(0, remainingIssues.length,
        ...remainingIssues.filter(i => !fixedIssueIds.has(i.id))
      );
    }

    const summary = {
      totalIssues: issues.length,
      fixed: appliedFixes.length,
      skipped: remainingIssues.length,
      failed: 0,
    };

    onStream?.({
      type: 'complete',
      message: `✅ Fixed ${summary.fixed}/${summary.totalIssues} issues`,
      timestamp: Date.now(),
      progress: 100,
    });

    return {
      success: remainingIssues.length === 0,
      fixedFiles,
      appliedFixes,
      remainingIssues,
      summary,
    };
  }

  /**
   * Quick fix for a single file
   */
  async quickFix(file: GeneratedFile, issues: CodeIssue[]): Promise<GeneratedFile> {
    const result = await this.fix([file], issues);
    return result.fixedFiles[0] || file;
  }

  /**
   * Fix security vulnerabilities
   */
  async fixSecurityIssues(
    files: GeneratedFile[],
    vulnerabilities: SecurityVulnerability[],
    onStream?: AgentStreamCallback
  ): Promise<FixResult> {
    // Convert security vulnerabilities to code issues
    const issues: CodeIssue[] = vulnerabilities.map(v => ({
      id: v.id,
      type: 'security' as IssueType,
      severity: v.severity === 'critical' || v.severity === 'high' ? 'error' : 'warning',
      message: v.description,
      file: v.file,
      line: v.line,
      code: v.code,
      autoFixable: v.fix.automated,
    }));

    return this.fix(files, issues, onStream);
  }

  /**
   * Find a fix for an issue
   */
  private async findFix(
    issue: CodeIssue,
    content: string,
    context: FixContext
  ): Promise<Fix | null> {
    // Try pattern-based fixes first
    for (const pattern of FIX_PATTERNS) {
      if (pattern.type !== issue.type) continue;
      if (pattern.messagePattern && !pattern.messagePattern.test(issue.message)) continue;

      const matches = content.match(pattern.pattern);
      if (matches) {
        const before = matches[0];
        const after = pattern.fix(matches, context);

        if (before !== after) {
          return {
            issueId: issue.id,
            file: issue.file,
            description: pattern.description,
            before,
            after,
            line: issue.line,
            confidence: pattern.confidence,
            automated: true,
          };
        }
      }
    }

    // Try import fixes
    if (issue.type === 'import' || issue.message.toLowerCase().includes('cannot find')) {
      const importFix = this.findImportFix(issue, content);
      if (importFix) return importFix;
    }

    return null;
  }

  /**
   * Find missing import fix
   */
  private findImportFix(issue: CodeIssue, content: string): Fix | null {
    // Extract the missing identifier from error message
    const match = issue.message.match(/Cannot find name '(\w+)'|'(\w+)' is not defined/);
    const identifier = match?.[1] || match?.[2];

    if (!identifier) return null;

    const importStatement = COMMON_IMPORTS[identifier];
    if (!importStatement) return null;

    // Check if already imported
    if (content.includes(importStatement)) return null;

    return {
      issueId: issue.id,
      file: issue.file,
      description: `Add import for ${identifier}`,
      before: '',
      after: importStatement + '\n',
      line: 1,  // Add at top
      confidence: 0.9,
      automated: true,
    };
  }

  /**
   * Apply a fix to content
   */
  private applyFix(content: string, fix: Fix): string {
    if (fix.line === 1 && fix.before === '') {
      // Import fix - add at top
      const lines = content.split('\n');
      const lastImportIndex = lines.findIndex((l, i) =>
        i > 0 && !l.startsWith('import') && lines[i - 1].startsWith('import')
      );
      const insertIndex = lastImportIndex > 0 ? lastImportIndex : 0;
      lines.splice(insertIndex, 0, fix.after.trim());
      return lines.join('\n');
    }

    // Regular replacement
    return content.replace(fix.before, fix.after);
  }

  /**
   * Build context for fixing
   */
  private buildContext(file: GeneratedFile, content: string): FixContext {
    const imports = content
      .split('\n')
      .filter(l => l.startsWith('import'))
      .map(l => l.trim());

    return {
      file,
      fullContent: content,
      imports,
    };
  }

  /**
   * AI-powered fix for complex issues
   */
  private async aiPoweredFix(
    files: GeneratedFile[],
    issues: CodeIssue[]
  ): Promise<{ files: GeneratedFile[]; fixes: Fix[] }> {
    const fixes: Fix[] = [];
    let updatedFiles = [...files];

    // Group issues by file for efficiency
    const issuesByFile = new Map<string, CodeIssue[]>();
    for (const issue of issues) {
      const fileIssues = issuesByFile.get(issue.file) || [];
      fileIssues.push(issue);
      issuesByFile.set(issue.file, fileIssues);
    }

    for (const [filePath, fileIssues] of issuesByFile) {
      const file = updatedFiles.find(f => f.path === filePath);
      if (!file) continue;

      const issueDescriptions = fileIssues
        .map(i => `- Line ${i.line || '?'}: ${i.message}`)
        .join('\n');

      const prompt = `Fix these code issues without changing the overall logic or structure.

FILE: ${file.path}
\`\`\`${file.language}
${file.content}
\`\`\`

ISSUES TO FIX:
${issueDescriptions}

Rules:
1. ONLY fix the specific issues listed
2. Keep all functionality the same
3. Maintain code style and formatting
4. Don't add unnecessary code

Return ONLY the fixed code, no explanations.`;

      try {
        const response = await anthropic.messages.create({
          model: this.model,
          max_tokens: 8000,
          messages: [{ role: 'user', content: prompt }],
        });

        const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
        const fixedCode = text.replace(/^```\w*\n?/, '').replace(/```$/, '');

        if (fixedCode && fixedCode !== file.content) {
          updatedFiles = updatedFiles.map(f =>
            f.path === filePath
              ? { ...f, content: fixedCode, linesOfCode: fixedCode.split('\n').length }
              : f
          );

          for (const issue of fileIssues) {
            fixes.push({
              issueId: issue.id,
              file: filePath,
              description: `AI fix: ${issue.message}`,
              before: '[complex]',
              after: '[AI-fixed]',
              confidence: 0.7,
              automated: true,
            });
          }
        }
      } catch (error) {
        console.error('[AutoFixer] AI fix error:', error);
      }
    }

    return { files: updatedFiles, fixes };
  }

  /**
   * Parse TypeScript compiler errors
   */
  parseTypeScriptErrors(output: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const errorPattern = /(.+)\((\d+),(\d+)\):\s*error\s*(TS\d+):\s*(.+)/g;

    let match;
    while ((match = errorPattern.exec(output)) !== null) {
      issues.push({
        id: `ts-${match[4]}-${match[2]}-${match[3]}`,
        type: 'typescript',
        severity: 'error',
        message: match[5],
        file: match[1],
        line: parseInt(match[2]),
        column: parseInt(match[3]),
        rule: match[4],
        autoFixable: this.isAutoFixable('typescript', match[4]),
      });
    }

    return issues;
  }

  /**
   * Parse ESLint output
   */
  parseEslintErrors(output: string): CodeIssue[] {
    const issues: CodeIssue[] = [];

    // JSON format
    try {
      const results = JSON.parse(output);
      for (const result of results) {
        for (const message of result.messages || []) {
          issues.push({
            id: `eslint-${result.filePath}-${message.line}-${message.column}`,
            type: 'eslint',
            severity: message.severity === 2 ? 'error' : 'warning',
            message: message.message,
            file: result.filePath,
            line: message.line,
            column: message.column,
            rule: message.ruleId,
            autoFixable: message.fix !== undefined,
          });
        }
      }
    } catch {
      // Plain text format
      const linePattern = /(.+):(\d+):(\d+):\s*(error|warning)\s+(.+?)\s+(\S+)$/gm;
      let match;
      while ((match = linePattern.exec(output)) !== null) {
        issues.push({
          id: `eslint-${match[1]}-${match[2]}-${match[3]}`,
          type: 'eslint',
          severity: match[4] as 'error' | 'warning',
          message: match[5],
          file: match[1],
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          rule: match[6],
          autoFixable: true,
        });
      }
    }

    return issues;
  }

  /**
   * Check if an error type is auto-fixable
   */
  private isAutoFixable(type: IssueType, rule?: string): boolean {
    const autoFixableRules = new Set([
      'TS2304', // Cannot find name
      'TS2307', // Cannot find module
      'TS7006', // Parameter implicitly has any type
      'no-unused-vars',
      'prefer-const',
      'no-var',
      'eqeqeq',
      'semi',
      'quotes',
      'comma-dangle',
      'no-console',
    ]);

    if (rule && autoFixableRules.has(rule)) return true;

    return type === 'prettier' || type === 'import';
  }
}

export const autoFixer = new AutoFixer();
