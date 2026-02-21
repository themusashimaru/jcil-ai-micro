/**
 * TOOL INVENTORY ENDPOINT
 * List all available tools with their operations
 *
 * GET /api/tools/inventory - Full tool inventory
 * GET /api/tools/inventory?category=security - Filter by category
 * GET /api/tools/inventory?search=crypto - Search tools
 */

import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { requireAdmin } from '@/lib/auth/admin-guard';

const TOOLS_DIR = path.join(process.cwd(), 'src/lib/ai/tools');

interface ToolInfo {
  name: string;
  file: string;
  description: string;
  operations: string[];
  category: string;
}

function categorize(name: string): string {
  const n = name.toLowerCase();
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
    'exploit',
    'malware',
    'firewall',
    'ids',
    'siem',
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
    'casting',
    'forging',
    'extrusion',
  ];
  const scienceKeywords = [
    'physics',
    'chemistry',
    'biology',
    'genetics',
    'geology',
    'astronomy',
    'ecology',
    'botany',
    'zoology',
    'microbiology',
  ];
  const mathKeywords = [
    'math',
    'calc',
    'algebra',
    'geometry',
    'stats',
    'probability',
    'numerical',
    'matrix',
    'linear',
  ];

  if (securityKeywords.some((k) => n.includes(k))) return 'security';
  if (engineeringKeywords.some((k) => n.includes(k))) return 'engineering';
  if (scienceKeywords.some((k) => n.includes(k))) return 'science';
  if (mathKeywords.some((k) => n.includes(k))) return 'math';
  return 'utility';
}

function extractToolInfo(filePath: string): Partial<ToolInfo> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract description
    const descMatch = content.match(/description:\s*['"`]([^'"`]+)['"`]/);
    const description = descMatch ? descMatch[1] : 'No description';

    // Extract operations
    const enumMatch = content.match(/enum:\s*\[([\s\S]*?)\]/);
    let operations: string[] = [];

    if (enumMatch) {
      const ops = enumMatch[1].match(/'([^']+)'/g);
      if (ops) {
        operations = ops.map((o) => o.replace(/'/g, ''));
      }
    }

    return { description, operations };
  } catch {
    return { description: 'Error reading tool', operations: [] };
  }
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const { searchParams } = new URL(request.url);
    const categoryFilter = searchParams.get('category');
    const searchFilter = searchParams.get('search')?.toLowerCase();
    const limit = parseInt(searchParams.get('limit') || '0');

    // Get all tool files
    const toolFiles = fs
      .readdirSync(TOOLS_DIR)
      .filter((f) => f.endsWith('-tool.ts'))
      .sort();

    // Build inventory
    let tools: ToolInfo[] = toolFiles.map((file) => {
      const name = file.replace('-tool.ts', '');
      const filePath = path.join(TOOLS_DIR, file);
      const info = extractToolInfo(filePath);
      const category = categorize(name);

      return {
        name,
        file,
        description: info.description || 'No description',
        operations: info.operations || [],
        category,
      };
    });

    // Apply filters
    if (categoryFilter) {
      tools = tools.filter((t) => t.category === categoryFilter);
    }

    if (searchFilter) {
      tools = tools.filter(
        (t) =>
          t.name.toLowerCase().includes(searchFilter) ||
          t.description.toLowerCase().includes(searchFilter) ||
          t.operations.some((op) => op.toLowerCase().includes(searchFilter))
      );
    }

    if (limit > 0) {
      tools = tools.slice(0, limit);
    }

    // Category summary
    const categorySummary: Record<string, number> = {};
    toolFiles.forEach((f) => {
      const cat = categorize(f.replace('-tool.ts', ''));
      categorySummary[cat] = (categorySummary[cat] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      total: toolFiles.length,
      filtered: tools.length,
      categories: categorySummary,
      filters: {
        category: categoryFilter,
        search: searchFilter,
        limit,
      },
      tools,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
