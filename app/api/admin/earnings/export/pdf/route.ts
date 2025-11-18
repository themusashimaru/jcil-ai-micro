import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/admin-guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function generateReportHTML(report: {
  report_type: string;
  report_period_start: string;
  report_period_end: string;
  full_report: string;
  key_metrics: {
    users: { total: number; byTier: Record<string, number> };
    revenue: { total: number; byTier: Record<string, number> };
    costs: { total: number; api: number; news: number; byModel: Record<string, { count: number; cost: number }> };
    profit: { total: number; margin: string };
  };
  created_at: string;
}) {
  // Convert markdown-style formatting to HTML
  const formattedReport = report.full_report
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/<\/li>\n<li>/g, '</li><li>');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>JCIL.ai Business Report - ${report.report_type}</title>
  <style>
    @page {
      size: A4;
      margin: 2cm;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 210mm;
      margin: 0 auto;
      padding: 20px;
    }

    .header {
      text-align: center;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }

    .header h1 {
      color: #1e40af;
      font-size: 32px;
      margin: 0 0 10px 0;
    }

    .header .subtitle {
      color: #64748b;
      font-size: 18px;
      margin: 5px 0;
    }

    .metrics-summary {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin: 30px 0;
      padding: 20px;
      background: #f8fafc;
      border-radius: 8px;
      page-break-inside: avoid;
    }

    .metric-card {
      padding: 15px;
      background: white;
      border-radius: 6px;
      border-left: 4px solid #2563eb;
    }

    .metric-card .label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }

    .metric-card .value {
      font-size: 28px;
      font-weight: bold;
      color: #1e40af;
    }

    .metric-card .subvalue {
      font-size: 14px;
      color: #64748b;
      margin-top: 5px;
    }

    .report-content {
      margin-top: 30px;
    }

    .report-content h2 {
      color: #1e40af;
      font-size: 24px;
      margin-top: 30px;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #e2e8f0;
      page-break-after: avoid;
    }

    .report-content h3 {
      color: #475569;
      font-size: 18px;
      margin-top: 20px;
      margin-bottom: 10px;
      page-break-after: avoid;
    }

    .report-content p {
      margin: 10px 0;
      text-align: justify;
    }

    .report-content ul, .report-content ol {
      margin: 10px 0;
      padding-left: 30px;
    }

    .report-content li {
      margin: 8px 0;
    }

    .report-content strong {
      color: #1e40af;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 14px;
      page-break-inside: avoid;
    }

    table th {
      background: #f1f5f9;
      color: #1e40af;
      font-weight: 600;
      text-align: left;
      padding: 12px;
      border-bottom: 2px solid #cbd5e1;
    }

    table td {
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
    }

    table tr:hover {
      background: #f8fafc;
    }

    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #e2e8f0;
      text-align: center;
      color: #64748b;
      font-size: 12px;
    }

    .positive {
      color: #059669;
    }

    .negative {
      color: #dc2626;
    }

    @media print {
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }

      .page-break {
        page-break-before: always;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>JCIL.ai Business Report</h1>
    <div class="subtitle">${report.report_type.charAt(0).toUpperCase() + report.report_type.slice(1)} Report</div>
    <div class="subtitle">Period: ${report.report_period_start} to ${report.report_period_end}</div>
    <div class="subtitle" style="font-size: 14px; margin-top: 10px;">Generated: ${new Date(report.created_at).toLocaleString()}</div>
  </div>

  <div class="metrics-summary">
    <div class="metric-card">
      <div class="label">Total Revenue</div>
      <div class="value positive">$${report.key_metrics.revenue.total.toFixed(2)}</div>
      <div class="subvalue">${report.key_metrics.users.total} active users</div>
    </div>

    <div class="metric-card">
      <div class="label">Total Costs</div>
      <div class="value negative">$${report.key_metrics.costs.total.toFixed(2)}</div>
      <div class="subvalue">API: $${report.key_metrics.costs.api.toFixed(2)} | News: $${report.key_metrics.costs.news.toFixed(2)}</div>
    </div>

    <div class="metric-card">
      <div class="label">Net Profit</div>
      <div class="value ${report.key_metrics.profit.total >= 0 ? 'positive' : 'negative'}">$${report.key_metrics.profit.total.toFixed(2)}</div>
      <div class="subvalue">Margin: ${report.key_metrics.profit.margin}%</div>
    </div>

    <div class="metric-card">
      <div class="label">User Distribution</div>
      <div class="value" style="font-size: 16px;">
        Free: ${report.key_metrics.users.byTier.free} |
        Basic: ${report.key_metrics.users.byTier.basic}<br>
        Pro: ${report.key_metrics.users.byTier.pro} |
        Executive: ${report.key_metrics.users.byTier.executive}
      </div>
    </div>
  </div>

  <div class="report-content">
    <p>${formattedReport}</p>
  </div>

  <div class="page-break"></div>

  <h2>Detailed Financial Breakdown</h2>

  <h3>Revenue by Tier</h3>
  <table>
    <thead>
      <tr>
        <th>Tier</th>
        <th style="text-align: right;">Users</th>
        <th style="text-align: right;">Revenue</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Free</td>
        <td style="text-align: right;">${report.key_metrics.users.byTier.free}</td>
        <td style="text-align: right;">$${report.key_metrics.revenue.byTier.free.toFixed(2)}</td>
      </tr>
      <tr>
        <td>Basic</td>
        <td style="text-align: right;">${report.key_metrics.users.byTier.basic}</td>
        <td style="text-align: right;">$${report.key_metrics.revenue.byTier.basic.toFixed(2)}</td>
      </tr>
      <tr>
        <td>Pro</td>
        <td style="text-align: right;">${report.key_metrics.users.byTier.pro}</td>
        <td style="text-align: right;">$${report.key_metrics.revenue.byTier.pro.toFixed(2)}</td>
      </tr>
      <tr>
        <td>Executive</td>
        <td style="text-align: right;">${report.key_metrics.users.byTier.executive}</td>
        <td style="text-align: right;">$${report.key_metrics.revenue.byTier.executive.toFixed(2)}</td>
      </tr>
      <tr style="font-weight: bold; background: #f1f5f9;">
        <td>Total</td>
        <td style="text-align: right;">${report.key_metrics.users.total}</td>
        <td style="text-align: right;">$${report.key_metrics.revenue.total.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <h3>API Costs by Model</h3>
  <table>
    <thead>
      <tr>
        <th>Model</th>
        <th style="text-align: right;">Usage Count</th>
        <th style="text-align: right;">Total Cost</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(report.key_metrics.costs.byModel).map(([model, stats]) => `
        <tr>
          <td>${model}</td>
          <td style="text-align: right;">${stats.count}</td>
          <td style="text-align: right;">$${stats.cost.toFixed(6)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <p><strong>JCIL.ai</strong> - AI-Powered Business Intelligence</p>
    <p>This report was generated automatically using Grok-4 AI</p>
    <p>Confidential - For Internal Use Only</p>
  </div>

  <script>
    // Auto-print when loaded
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
  `;
}

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    const supabase = getSupabaseAdmin();

    // Get report ID from query
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get('reportId');

    if (!reportId) {
      return NextResponse.json({ error: 'Report ID required' }, { status: 400 });
    }

    // Fetch report from database
    const { data: report, error: reportError } = await supabase
      .from('business_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // Generate HTML
    const html = generateReportHTML(report);

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
      },
    });

  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
