import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const supabase = await createClient();

  // Check authentication
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
  }

  try {
    // Get all users
    const { data: users, error: usersError } = await supabase
      .rpc('get_all_users_for_admin');

    if (usersError) throw usersError;

    // Get stats
    const { data: statsData, error: statsError } = await supabase
      .rpc('get_admin_stats');

    if (statsError) throw statsError;

    const stats = statsData || {
      total_users: 0,
      total_messages: 0,
      total_tokens: 0,
      users_by_tier: {},
      revenue_by_period: {},
    };

    // Calculate metrics
    const PRICING = { free: 0, basic: 12, pro: 30, executive: 150 };
    const usersByTier = stats.users_by_tier || {};
    const totalRevenue = Object.entries(usersByTier).reduce((sum, [tier, count]) => {
      return sum + (PRICING[tier as keyof typeof PRICING] || 0) * (count as number);
    }, 0);

    // Generate HTML report
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Report - ${currentDate}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 40px;
      background: white;
      color: #1e293b;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid #3b82f6;
    }
    .header h1 { font-size: 32px; margin-bottom: 8px; }
    .header p { color: #64748b; font-size: 16px; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    .stat-card {
      padding: 20px;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .stat-card h3 {
      font-size: 14px;
      color: #64748b;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .stat-card p {
      font-size: 28px;
      font-weight: bold;
      color: #1e293b;
    }
    .section {
      margin-bottom: 40px;
    }
    .section h2 {
      font-size: 24px;
      margin-bottom: 20px;
      color: #1e293b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    thead {
      background: #f1f5f9;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    th {
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      font-size: 12px;
      letter-spacing: 0.5px;
    }
    tr:hover {
      background: #f8fafc;
    }
    .tier-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .tier-free { background: #e0e7ff; color: #3730a3; }
    .tier-basic { background: #dbeafe; color: #1e40af; }
    .tier-pro { background: #fef3c7; color: #92400e; }
    .tier-executive { background: #fee2e2; color: #991b1b; }
    .footer {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      color: #94a3b8;
      font-size: 12px;
    }
    @media print {
      body { padding: 20px; }
      .stat-card { break-inside: avoid; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Admin Dashboard Report</h1>
    <p>Generated on ${currentDate}</p>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <h3>Total Users</h3>
      <p>${stats.total_users || 0}</p>
    </div>
    <div class="stat-card">
      <h3>Total Messages</h3>
      <p>${(stats.total_messages || 0).toLocaleString()}</p>
    </div>
    <div class="stat-card">
      <h3>Total Tokens</h3>
      <p>${(stats.total_tokens || 0).toLocaleString()}</p>
    </div>
    <div class="stat-card">
      <h3>Monthly Revenue</h3>
      <p>$${totalRevenue.toLocaleString()}</p>
    </div>
  </div>

  <div class="section">
    <h2>User Distribution by Tier</h2>
    <table>
      <thead>
        <tr>
          <th>Tier</th>
          <th>Users</th>
          <th>Price/Month</th>
          <th>Revenue</th>
        </tr>
      </thead>
      <tbody>
        ${['free', 'basic', 'pro', 'executive'].map(tier => {
          const count = usersByTier[tier] || 0;
          const price = PRICING[tier as keyof typeof PRICING];
          const revenue = count * price;
          return `
        <tr>
          <td><span class="tier-badge tier-${tier}">${tier}</span></td>
          <td>${count}</td>
          <td>$${price}/mo</td>
          <td>$${revenue.toLocaleString()}/mo</td>
        </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>User Details</h2>
    <table>
      <thead>
        <tr>
          <th>Email</th>
          <th>Tier</th>
          <th>Messages</th>
          <th>Tokens</th>
          <th>Join Date</th>
        </tr>
      </thead>
      <tbody>
        ${(users || []).map((user: any) => {
          const joinDate = user.created_at
            ? new Date(user.created_at).toLocaleDateString()
            : 'N/A';
          const tier = user.subscription_tier || 'free';
          return `
        <tr>
          <td>${user.email || 'N/A'}</td>
          <td><span class="tier-badge tier-${tier}">${tier}</span></td>
          <td>${(user.total_messages_sent || 0).toLocaleString()}</td>
          <td>${(user.total_tokens_used || 0).toLocaleString()}</td>
          <td>${joinDate}</td>
        </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <p>This report is confidential and intended for administrative use only.</p>
    <p>To save as PDF: Use your browser's Print function (Ctrl/Cmd + P) and select "Save as PDF"</p>
  </div>

  <script>
    // Auto-trigger print dialog when page loads
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
    `;

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error: any) {
    console.error('PDF export error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report', details: error.message },
      { status: 500 }
    );
  }
}
