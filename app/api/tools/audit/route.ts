/**
 * TOOLS AUDIT API ROUTE
 *
 * GET /api/tools/audit
 * Returns a comprehensive audit of all registered chat tools
 *
 * Created: 2026-02-01
 * Total Tools: 363
 */

import { NextResponse } from 'next/server';
import { getAvailableChatTools, executeChatTool } from '@/lib/ai/tools';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const startTime = Date.now();

    // Get all available tools
    const tools = await getAvailableChatTools();

    // Categorize tools
    const categories: Record<string, string[]> = {
      security: [],
      science: [],
      engineering: [],
      math: [],
      data: [],
      media: [],
      web: [],
      utility: [],
      other: []
    };

    const toolDetails = tools.map(tool => {
      const name = tool.name;

      // Categorize based on name patterns
      if (name.includes('security') || name.includes('threat') || name.includes('cyber') ||
          name.includes('auth') || name.includes('encrypt') || name.includes('firewall') ||
          name.includes('malware') || name.includes('vulnerability') || name.includes('siem') ||
          name.includes('soc') || name.includes('red_team') || name.includes('blue_team') ||
          name.includes('incident') || name.includes('forensic') || name.includes('osint') ||
          name.includes('pen_test') || name.includes('compliance') || name.includes('privacy') ||
          name.includes('identity') || name.includes('access_control') || name.includes('pki') ||
          name.includes('vpn') || name.includes('ids') || name.includes('honeypot') ||
          name.includes('ransomware') || name.includes('phishing') || name.includes('xdr') ||
          name.includes('soar') || name.includes('zero_trust') || name.includes('owasp')) {
        categories.security.push(name);
      } else if (name.includes('physics') || name.includes('chemistry') || name.includes('biology') ||
                 name.includes('quantum') || name.includes('thermo') || name.includes('spectro') ||
                 name.includes('molecular') || name.includes('genetics') || name.includes('ecology') ||
                 name.includes('geology') || name.includes('astronomy') || name.includes('cosmology') ||
                 name.includes('nuclear') || name.includes('particle') || name.includes('relativity')) {
        categories.science.push(name);
      } else if (name.includes('engineering') || name.includes('structural') || name.includes('fluid') ||
                 name.includes('heat') || name.includes('circuit') || name.includes('control') ||
                 name.includes('robotics') || name.includes('manufacturing') || name.includes('materials') ||
                 name.includes('hvac') || name.includes('welding') || name.includes('casting')) {
        categories.engineering.push(name);
      } else if (name.includes('math') || name.includes('calc') || name.includes('matrix') ||
                 name.includes('polynomial') || name.includes('statistics') || name.includes('probability') ||
                 name.includes('algebra') || name.includes('geometry') || name.includes('optimize') ||
                 name.includes('number_theory') || name.includes('combinatorics')) {
        categories.math.push(name);
      } else if (name.includes('data') || name.includes('sql') || name.includes('csv') ||
                 name.includes('json') || name.includes('xml') || name.includes('parse') ||
                 name.includes('analyze') || name.includes('spreadsheet') || name.includes('excel')) {
        categories.data.push(name);
      } else if (name.includes('image') || name.includes('audio') || name.includes('video') ||
                 name.includes('media') || name.includes('graphics') || name.includes('animation') ||
                 name.includes('render') || name.includes('svg') || name.includes('chart')) {
        categories.media.push(name);
      } else if (name.includes('web') || name.includes('http') || name.includes('url') ||
                 name.includes('browser') || name.includes('fetch') || name.includes('search') ||
                 name.includes('screenshot') || name.includes('github')) {
        categories.web.push(name);
      } else if (name.includes('convert') || name.includes('format') || name.includes('validate') ||
                 name.includes('generate') || name.includes('encode') || name.includes('compress') ||
                 name.includes('hash') || name.includes('cron') || name.includes('diff')) {
        categories.utility.push(name);
      } else {
        categories.other.push(name);
      }

      return {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      };
    });

    const loadTime = Date.now() - startTime;

    const audit = {
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      totalTools: tools.length,
      loadTimeMs: loadTime,
      status: 'operational',
      categories: {
        security: { count: categories.security.length, tools: categories.security.sort() },
        science: { count: categories.science.length, tools: categories.science.sort() },
        engineering: { count: categories.engineering.length, tools: categories.engineering.sort() },
        math: { count: categories.math.length, tools: categories.math.sort() },
        data: { count: categories.data.length, tools: categories.data.sort() },
        media: { count: categories.media.length, tools: categories.media.sort() },
        web: { count: categories.web.length, tools: categories.web.sort() },
        utility: { count: categories.utility.length, tools: categories.utility.sort() },
        other: { count: categories.other.length, tools: categories.other.sort() }
      },
      allTools: toolDetails.sort((a, b) => a.name.localeCompare(b.name))
    };

    return NextResponse.json(audit, { status: 200 });
  } catch (error) {
    console.error('Tool audit error:', error);
    return NextResponse.json(
      {
        error: 'Failed to audit tools',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tools/audit
 * Test a specific tool by name
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { toolName, testArgs } = body;

    if (!toolName) {
      return NextResponse.json(
        { error: 'toolName is required' },
        { status: 400 }
      );
    }

    const tools = await getAvailableChatTools();
    const tool = tools.find(t => t.name === toolName);

    if (!tool) {
      return NextResponse.json(
        { error: `Tool '${toolName}' not found`, availableTools: tools.map(t => t.name) },
        { status: 404 }
      );
    }

    // Execute the tool with test arguments
    const result = await executeChatTool({
      id: `test-${Date.now()}`,
      name: toolName,
      arguments: testArgs || {}
    });

    return NextResponse.json({
      tool: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      },
      testResult: result,
      timestamp: new Date().toISOString()
    }, { status: 200 });
  } catch (error) {
    console.error('Tool test error:', error);
    return NextResponse.json(
      {
        error: 'Failed to test tool',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
