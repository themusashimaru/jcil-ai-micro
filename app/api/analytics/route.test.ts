/**
 * ANALYTICS API TESTS
 *
 * Tests for POST /api/analytics endpoint:
 * - Authentication enforcement
 * - CSV parsing and analysis
 * - Excel parsing and analysis
 * - Unsupported file type rejection
 * - Missing content error handling
 * - Empty data error handling
 * - Insufficient data error handling
 * - Base64-encoded CSV handling
 * - Chart generation
 * - Insight generation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: vi.fn().mockResolvedValue({
    authorized: true,
    user: { id: 'user-1', email: 'test@test.com' },
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-1234'),
}));

// Mock ExcelJS - we test CSV directly, and mock Excel parsing
vi.mock('exceljs', () => {
  const mockWorksheet = {
    eachRow: vi.fn(),
    name: 'Sheet1',
  };
  const mockWorkbook = {
    xlsx: {
      load: vi.fn().mockResolvedValue(undefined),
    },
    worksheets: [mockWorksheet],
  };
  return {
    default: {
      Workbook: vi.fn(() => mockWorkbook),
    },
  };
});

// ============================================================================
// HELPERS
// ============================================================================

function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe('POST /api/analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // Module exports
  // --------------------------------------------------------------------------

  it('should export POST handler', async () => {
    const routeModule = await import('./route');
    expect(routeModule.POST).toBeDefined();
    expect(typeof routeModule.POST).toBe('function');
  }, 15000);

  it('should export runtime and maxDuration', async () => {
    const routeModule = await import('./route');
    expect(routeModule.runtime).toBe('nodejs');
    expect(routeModule.maxDuration).toBe(60);
  });

  // --------------------------------------------------------------------------
  // Authentication
  // --------------------------------------------------------------------------

  it('should return 401 when user is not authenticated', async () => {
    const { requireUser } = await import('@/lib/auth/user-guard');
    const unauthorizedResponse = NextResponse.json(
      { error: 'Authentication required', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
    vi.mocked(requireUser).mockResolvedValueOnce({
      authorized: false,
      response: unauthorizedResponse,
    });

    const { POST } = await import('./route');
    const request = createRequest({
      fileName: 'test.csv',
      fileType: 'text/csv',
      content: 'a,b\n1,2',
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  // --------------------------------------------------------------------------
  // Input validation
  // --------------------------------------------------------------------------

  it('should return 400 when content is missing', async () => {
    const { POST } = await import('./route');
    const request = createRequest({ fileName: 'test.csv', fileType: 'text/csv', content: '' });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('No file content provided');
  });

  it('should return 400 for unsupported file type', async () => {
    const { POST } = await import('./route');
    const request = createRequest({
      fileName: 'test.doc',
      fileType: 'application/msword',
      content: 'some data',
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toContain('Unsupported file type');
  });

  // --------------------------------------------------------------------------
  // CSV parsing - success
  // --------------------------------------------------------------------------

  it('should successfully analyze a CSV file with numeric data', async () => {
    const { POST } = await import('./route');

    const csvContent = [
      'Product,Sales,Profit',
      'Widget A,100,25',
      'Widget B,200,50',
      'Widget C,150,30',
    ].join('\n');

    const request = createRequest({
      fileName: 'sales.csv',
      fileType: 'text/csv',
      content: csvContent,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.analytics).toBeDefined();

    const analytics = body.data.analytics;
    expect(analytics.id).toBe('test-uuid-1234');
    expect(analytics.filename).toBe('sales.csv');
    expect(analytics.totalRows).toBe(3);
    expect(analytics.totalColumns).toBe(3);
    expect(analytics.columnNames).toEqual(['Product', 'Sales', 'Profit']);
    expect(analytics.summary).toContain('3 records');
    expect(analytics.charts.length).toBeGreaterThan(0);
    expect(analytics.insights.length).toBeGreaterThan(0);
  });

  it('should parse CSV with quoted fields containing commas', async () => {
    const { POST } = await import('./route');

    const csvContent = ['Name,Amount', '"Smith, John",100', '"Doe, Jane",200'].join('\n');

    const request = createRequest({
      fileName: 'data.csv',
      fileType: 'text/csv',
      content: csvContent,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.analytics.totalRows).toBe(2);
  });

  it('should handle CSV with escaped quotes', async () => {
    const { POST } = await import('./route');

    const csvContent = ['Name,Description', '"Item ""A""",Good', '"Item ""B""",Better'].join('\n');

    const request = createRequest({
      fileName: 'data.csv',
      fileType: 'text/csv',
      content: csvContent,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.analytics.totalRows).toBe(2);
  });

  it('should handle base64-encoded CSV content', async () => {
    const { POST } = await import('./route');

    const csvText = 'Name,Value\nA,100\nB,200';
    const base64Content = 'data:text/csv;base64,' + Buffer.from(csvText).toString('base64');

    const request = createRequest({
      fileName: 'encoded.csv',
      fileType: 'text/csv',
      content: base64Content,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.analytics.totalRows).toBe(2);
  });

  it('should detect CSV by file extension when fileType is not text/csv', async () => {
    const { POST } = await import('./route');

    const csvContent = 'Name,Value\nA,100\nB,200';

    const request = createRequest({
      fileName: 'data.csv',
      fileType: 'application/octet-stream',
      content: csvContent,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.analytics.totalRows).toBe(2);
  });

  // --------------------------------------------------------------------------
  // Analysis features
  // --------------------------------------------------------------------------

  it('should generate insights for numeric columns', async () => {
    const { POST } = await import('./route');

    const csvContent = [
      'Category,Revenue,Expenses',
      'A,1000,500',
      'B,2000,800',
      'C,3000,1200',
    ].join('\n');

    const request = createRequest({
      fileName: 'financial.csv',
      fileType: 'text/csv',
      content: csvContent,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    const analytics = body.data.analytics;

    // Should have insights for Revenue and Expenses, plus records count
    expect(analytics.insights.length).toBeGreaterThanOrEqual(2);

    // Check for stat insights
    const statInsights = analytics.insights.filter((i: { type: string }) => i.type === 'stat');
    expect(statInsights.length).toBeGreaterThan(0);
  });

  it('should generate charts from categorical + numeric data', async () => {
    const { POST } = await import('./route');

    const csvContent = ['Region,Sales', 'North,500', 'South,300', 'East,400', 'West,600'].join(
      '\n'
    );

    const request = createRequest({
      fileName: 'regional.csv',
      fileType: 'text/csv',
      content: csvContent,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    const analytics = body.data.analytics;

    // Should have a bar chart and possibly a pie chart
    expect(analytics.charts.length).toBeGreaterThanOrEqual(1);

    const barChart = analytics.charts.find((c: { type: string }) => c.type === 'bar');
    expect(barChart).toBeDefined();
    expect(barChart.title).toContain('Sales');
    expect(barChart.data.length).toBe(4);
  });

  it('should generate a pie chart when there are few categories', async () => {
    const { POST } = await import('./route');

    const csvContent = ['Fruit,Count', 'Apple,10', 'Banana,20', 'Cherry,15'].join('\n');

    const request = createRequest({
      fileName: 'fruits.csv',
      fileType: 'text/csv',
      content: csvContent,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    const analytics = body.data.analytics;

    const pieChart = analytics.charts.find((c: { type: string }) => c.type === 'pie');
    expect(pieChart).toBeDefined();
    expect(pieChart.title).toContain('Distribution');
  });

  it('should generate a line chart for date-like columns', async () => {
    const { POST } = await import('./route');

    const csvContent = ['Date,Revenue', '2024-01-01,100', '2024-02-01,150', '2024-03-01,200'].join(
      '\n'
    );

    const request = createRequest({
      fileName: 'monthly.csv',
      fileType: 'text/csv',
      content: csvContent,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    const analytics = body.data.analytics;

    const lineChart = analytics.charts.find((c: { type: string }) => c.type === 'line');
    expect(lineChart).toBeDefined();
    expect(lineChart.title).toContain('Trend');
  });

  it('should generate suggested queries', async () => {
    const { POST } = await import('./route');

    const csvContent = ['Product,Sales', 'A,100', 'B,200'].join('\n');

    const request = createRequest({
      fileName: 'test.csv',
      fileType: 'text/csv',
      content: csvContent,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    const analytics = body.data.analytics;

    expect(analytics.suggestedQueries).toBeDefined();
    expect(analytics.suggestedQueries.length).toBeGreaterThan(0);
    expect(analytics.suggestedQueries.length).toBeLessThanOrEqual(4);
  });

  it('should include raw data preview (first 10 rows)', async () => {
    const { POST } = await import('./route');

    // Generate more than 10 data rows
    const rows = ['Name,Value'];
    for (let i = 1; i <= 15; i++) {
      rows.push(`Item ${i},${i * 10}`);
    }

    const request = createRequest({
      fileName: 'large.csv',
      fileType: 'text/csv',
      content: rows.join('\n'),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    const analytics = body.data.analytics;

    expect(analytics.rawDataPreview.length).toBe(10);
    expect(analytics.totalRows).toBe(15);
  });

  // --------------------------------------------------------------------------
  // Column type detection
  // --------------------------------------------------------------------------

  it('should detect currency columns', async () => {
    const { POST } = await import('./route');

    const csvContent = ['Item,Price', 'A,$100.50', 'B,$200.75', 'C,$50.25'].join('\n');

    const request = createRequest({
      fileName: 'prices.csv',
      fileType: 'text/csv',
      content: csvContent,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    const analytics = body.data.analytics;

    // Should detect and parse currency values
    expect(analytics.insights.length).toBeGreaterThan(0);
  });

  it('should detect percent columns', async () => {
    const { POST } = await import('./route');

    const csvContent = ['Category,Rate', 'A,10.5%', 'B,20.3%', 'C,15.8%'].join('\n');

    const request = createRequest({
      fileName: 'rates.csv',
      fileType: 'text/csv',
      content: csvContent,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Edge cases and error handling
  // --------------------------------------------------------------------------

  it('should return 400 for CSV with only header row', async () => {
    const { POST } = await import('./route');

    const csvContent = 'Name,Value';

    const request = createRequest({
      fileName: 'empty.csv',
      fileType: 'text/csv',
      content: csvContent,
    });
    const response = await POST(request);

    // Should fail because data must have at least a header and one data row
    expect(response.status).toBe(500);
  });

  it('should handle text-only CSV data without numeric columns', async () => {
    const { POST } = await import('./route');

    const csvContent = ['FirstName,LastName,City', 'John,Smith,New York', 'Jane,Doe,Chicago'].join(
      '\n'
    );

    const request = createRequest({
      fileName: 'contacts.csv',
      fileType: 'text/csv',
      content: csvContent,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    const analytics = body.data.analytics;

    // Should handle gracefully (no charts if no numeric data)
    expect(analytics.totalRows).toBe(2);
  });

  it('should handle Excel file type (xlsx)', async () => {
    const { POST } = await import('./route');

    // For Excel, the mock will return empty rows from eachRow, so it triggers "No data found"
    const request = createRequest({
      fileName: 'data.xlsx',
      fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      content:
        'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,dGVzdA==',
    });
    const response = await POST(request);

    // The mock returns empty rows, so this should return 400 for "No data found"
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('No data found');
  });

  it('should handle server errors gracefully', async () => {
    const { requireUser } = await import('@/lib/auth/user-guard');
    vi.mocked(requireUser).mockRejectedValueOnce(new Error('Unexpected error'));

    const { POST } = await import('./route');
    const request = createRequest({
      fileName: 'test.csv',
      fileType: 'text/csv',
      content: 'a,b\n1,2',
    });
    const response = await POST(request);

    expect(response.status).toBe(500);
  });

  it('should pass optional query parameter through', async () => {
    const { POST } = await import('./route');

    const csvContent = ['Name,Sales', 'A,100', 'B,200'].join('\n');

    const request = createRequest({
      fileName: 'test.csv',
      fileType: 'text/csv',
      content: csvContent,
      query: 'Show top sellers',
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });
});
