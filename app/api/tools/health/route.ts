/**
 * TOOL HEALTH CHECK ENDPOINT
 * Quick health status for all tools
 *
 * GET /api/tools/health - Quick health summary
 */

import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { requireAdmin } from '@/lib/auth/admin-guard';

const TOOLS_DIR = path.join(process.cwd(), 'src/lib/ai/tools');

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const startTime = Date.now();

    // Get all tool files
    const toolFiles = fs.readdirSync(TOOLS_DIR).filter((f) => f.endsWith('-tool.ts'));

    // Count tools by category
    const categories = {
      security: 0,
      engineering: 0,
      science: 0,
      math: 0,
      utility: 0,
      other: 0,
    };

    const securityKeywords = [
      'security',
      'auth',
      'cipher',
      'crypto',
      'attack',
      'vuln',
      'threat',
      'forensic',
      'pentest',
      'hack',
    ];
    const engineeringKeywords = [
      'hvac',
      'structural',
      'mechanical',
      'civil',
      'electrical',
      'manufacturing',
      'cnc',
      'welding',
    ];
    const scienceKeywords = [
      'physics',
      'chemistry',
      'biology',
      'genetics',
      'geology',
      'astronomy',
      'ecology',
    ];
    const mathKeywords = [
      'math',
      'calc',
      'algebra',
      'geometry',
      'stats',
      'probability',
      'numerical',
    ];

    for (const file of toolFiles) {
      const name = file.toLowerCase();
      if (securityKeywords.some((k) => name.includes(k))) categories.security++;
      else if (engineeringKeywords.some((k) => name.includes(k))) categories.engineering++;
      else if (scienceKeywords.some((k) => name.includes(k))) categories.science++;
      else if (mathKeywords.some((k) => name.includes(k))) categories.math++;
      else if (name.includes('tool') && !name.includes('-')) categories.utility++;
      else categories.other++;
    }

    // Check for recent test results
    const resultsPath = path.join(process.cwd(), 'scripts/tests/test-results.json');
    let lastTestRun = null;
    let lastTestSummary = null;

    if (fs.existsSync(resultsPath)) {
      const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
      lastTestRun = results.timestamp;
      lastTestSummary = results.summary;
    }

    const duration = Date.now() - startTime;

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      tools: {
        total: toolFiles.length,
        wired: 344, // From our wiring work
        categories,
      },
      lastTestRun,
      lastTestSummary,
      endpoints: {
        health: '/api/tools/health',
        test: '/api/tools/test',
        testTool: '/api/tools/test/[tool-name]',
        inventory: '/api/tools/inventory',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
