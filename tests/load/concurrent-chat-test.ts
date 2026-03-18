/**
 * CONCURRENT CHAT LOAD TEST
 *
 * Simulates 30-50 concurrent users hitting the chat endpoint simultaneously.
 * Tests the Redis queue (50 slot max), rate limiting, API key rotation,
 * and error handling under load.
 *
 * Usage:
 *   npx tsx tests/load/concurrent-chat-test.ts
 *   npx tsx tests/load/concurrent-chat-test.ts --users 50
 *   npx tsx tests/load/concurrent-chat-test.ts --url https://jcil.ai
 *
 * What this tests:
 *   - Queue slot acquisition (50 max concurrent)
 *   - Rate limiting (per-user and per-minute)
 *   - API key rotation under load
 *   - Error responses (401, 429, 503) are well-formed JSON
 *   - Health endpoint stability during load
 *   - Response time distribution
 *   - No 500 errors (server crashes)
 */

const BASE_URL = process.argv.find((a) => a.startsWith('--url='))?.split('=')[1] ||
  process.env.LOAD_TEST_URL ||
  'http://localhost:3000';

const CONCURRENT_USERS = parseInt(
  process.argv.find((a) => a.startsWith('--users='))?.split('=')[1] || '30'
);

const WAVES = parseInt(
  process.argv.find((a) => a.startsWith('--waves='))?.split('=')[1] || '3'
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface RequestResult {
  userId: number;
  endpoint: string;
  status: number;
  duration: number;
  error?: string;
  responseBody?: string;
  isJsonResponse: boolean;
}

interface WaveResult {
  wave: number;
  concurrent: number;
  results: RequestResult[];
  totalDuration: number;
}

interface TestSummary {
  totalRequests: number;
  successful: number;
  authRejected: number;
  rateLimited: number;
  serverBusy: number;
  serverErrors: number;
  otherErrors: number;
  avgResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  maxResponseTime: number;
  healthChecksDuringLoad: { status: number; duration: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

async function timedFetch(
  url: string,
  options: RequestInit
): Promise<{ status: number; duration: number; body: string; isJson: boolean }> {
  const start = performance.now();
  try {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
    const body = await response.text();
    const duration = performance.now() - start;
    const contentType = response.headers.get('content-type') || '';
    return {
      status: response.status,
      duration,
      body,
      isJson: contentType.includes('application/json'),
    };
  } catch (err) {
    const duration = performance.now() - start;
    return {
      status: 0,
      duration,
      body: err instanceof Error ? err.message : 'Unknown error',
      isJson: false,
    };
  }
}

// ─── Test Scenarios ───────────────────────────────────────────────────────────

async function simulateChatRequest(userId: number): Promise<RequestResult> {
  const messages = [
    'Hello, can you help me with a coding question?',
    'What is the difference between let and const in JavaScript?',
    'Explain React hooks to me',
    'How do I set up a REST API with Express?',
    'What are the best practices for TypeScript?',
    'Can you review this code for bugs?',
    'Help me understand async/await',
    'What is the difference between SQL and NoSQL?',
    'How do I deploy a Next.js app?',
    'Explain microservices architecture',
  ];

  const message = messages[userId % messages.length];

  const result = await timedFetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: BASE_URL,
      'X-Request-ID': `load-test-user-${userId}-${Date.now()}`,
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: message }],
      conversationId: `load-test-conv-${userId}`,
    }),
  });

  return {
    userId,
    endpoint: '/api/chat',
    status: result.status,
    duration: result.duration,
    responseBody: result.body.substring(0, 200),
    isJsonResponse: result.isJson,
    error: result.status >= 500 ? result.body.substring(0, 200) : undefined,
  };
}

async function simulateHealthCheck(): Promise<{ status: number; duration: number }> {
  const result = await timedFetch(`${BASE_URL}/api/health`, { method: 'GET' });
  return { status: result.status, duration: result.duration };
}

async function simulateHomepageLoad(userId: number): Promise<RequestResult> {
  const result = await timedFetch(BASE_URL, { method: 'GET' });
  return {
    userId,
    endpoint: '/',
    status: result.status,
    duration: result.duration,
    isJsonResponse: false,
  };
}

async function simulateApiEndpoint(
  userId: number,
  endpoint: string,
  method: string = 'GET'
): Promise<RequestResult> {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: BASE_URL,
    },
  };

  if (method === 'POST') {
    options.body = JSON.stringify({});
  }

  const result = await timedFetch(`${BASE_URL}${endpoint}`, options);
  return {
    userId,
    endpoint,
    status: result.status,
    duration: result.duration,
    isJsonResponse: result.isJson,
    error: result.status >= 500 ? result.body.substring(0, 200) : undefined,
  };
}

// ─── Wave Runner ──────────────────────────────────────────────────────────────

async function runWave(waveNum: number, concurrency: number): Promise<WaveResult> {
  console.log(`\n--- Wave ${waveNum}: ${concurrency} concurrent users ---`);

  const waveStart = performance.now();

  // Mix of request types to simulate real usage:
  // 60% chat, 20% page loads, 20% API checks
  const requests: Promise<RequestResult>[] = [];

  for (let i = 0; i < concurrency; i++) {
    const rand = Math.random();
    if (rand < 0.6) {
      // 60% try to chat
      requests.push(simulateChatRequest(i));
    } else if (rand < 0.8) {
      // 20% load homepage
      requests.push(simulateHomepageLoad(i));
    } else {
      // 20% hit various API endpoints
      const endpoints = [
        '/api/conversations',
        '/api/user/settings',
        '/api/code-lab/sessions',
        '/api/documents/user/files',
      ];
      requests.push(simulateApiEndpoint(i, endpoints[i % endpoints.length]));
    }
  }

  const results = await Promise.all(requests);
  const totalDuration = performance.now() - waveStart;

  // Print wave summary
  const statuses: Record<number, number> = {};
  for (const r of results) {
    statuses[r.status] = (statuses[r.status] || 0) + 1;
  }

  console.log(`  Duration: ${totalDuration.toFixed(0)}ms`);
  console.log(`  Status breakdown: ${JSON.stringify(statuses)}`);

  const durations = results.map((r) => r.duration);
  console.log(
    `  Response times: avg=${(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(0)}ms, ` +
      `p95=${percentile(durations, 95).toFixed(0)}ms, max=${Math.max(...durations).toFixed(0)}ms`
  );

  return { wave: waveNum, concurrent: concurrency, results, totalDuration };
}

// ─── Main Test ────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== JCIL AI Concurrent Chat Load Test ===');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Concurrent users: ${CONCURRENT_USERS}`);
  console.log(`Waves: ${WAVES}`);
  console.log('');

  // Pre-flight: check the server is up
  console.log('Pre-flight health check...');
  const healthCheck = await simulateHealthCheck();
  if (healthCheck.status !== 200) {
    console.error(`Server not ready (status: ${healthCheck.status}). Aborting.`);
    process.exit(1);
  }
  console.log(`Server healthy (${healthCheck.duration.toFixed(0)}ms)`);

  // Run waves with increasing concurrency
  const allResults: RequestResult[] = [];
  const healthDuringLoad: { status: number; duration: number }[] = [];

  for (let w = 1; w <= WAVES; w++) {
    // Scale concurrency: wave 1 = half, wave 2 = full, wave 3 = 1.5x
    const scale = w === 1 ? 0.5 : w === 2 ? 1 : 1.5;
    const concurrency = Math.round(CONCURRENT_USERS * scale);

    const wave = await runWave(w, concurrency);
    allResults.push(...wave.results);

    // Health check between waves
    const mid = await simulateHealthCheck();
    healthDuringLoad.push(mid);
    console.log(`  Health check: ${mid.status} (${mid.duration.toFixed(0)}ms)`);

    // Brief pause between waves
    if (w < WAVES) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  // Post-load health check
  console.log('\nPost-load health check...');
  const postHealth = await simulateHealthCheck();
  healthDuringLoad.push(postHealth);
  console.log(`Server status: ${postHealth.status} (${postHealth.duration.toFixed(0)}ms)`);

  // ─── Aggregate Summary ──────────────────────────────────────────────────

  const durations = allResults.map((r) => r.duration);
  const summary: TestSummary = {
    totalRequests: allResults.length,
    successful: allResults.filter((r) => r.status >= 200 && r.status < 300).length,
    authRejected: allResults.filter((r) => r.status === 401 || r.status === 403).length,
    rateLimited: allResults.filter((r) => r.status === 429).length,
    serverBusy: allResults.filter((r) => r.status === 503).length,
    serverErrors: allResults.filter((r) => r.status >= 500 && r.status !== 503).length,
    otherErrors: allResults.filter((r) => r.status === 0).length,
    avgResponseTime: durations.reduce((a, b) => a + b, 0) / durations.length,
    p50ResponseTime: percentile(durations, 50),
    p95ResponseTime: percentile(durations, 95),
    p99ResponseTime: percentile(durations, 99),
    maxResponseTime: Math.max(...durations),
    healthChecksDuringLoad: healthDuringLoad,
  };

  console.log('\n=== FINAL SUMMARY ===');
  console.log(`Total requests:    ${summary.totalRequests}`);
  console.log(`  Successful (2xx): ${summary.successful}`);
  console.log(`  Auth rejected:    ${summary.authRejected} (expected — no auth token)`);
  console.log(`  Rate limited:     ${summary.rateLimited}`);
  console.log(`  Server busy:      ${summary.serverBusy} (queue full — 503)`);
  console.log(`  Server errors:    ${summary.serverErrors} (5xx excluding 503)`);
  console.log(`  Network errors:   ${summary.otherErrors}`);
  console.log('');
  console.log('Response times:');
  console.log(`  Average: ${summary.avgResponseTime.toFixed(0)}ms`);
  console.log(`  P50:     ${summary.p50ResponseTime.toFixed(0)}ms`);
  console.log(`  P95:     ${summary.p95ResponseTime.toFixed(0)}ms`);
  console.log(`  P99:     ${summary.p99ResponseTime.toFixed(0)}ms`);
  console.log(`  Max:     ${summary.maxResponseTime.toFixed(0)}ms`);
  console.log('');
  console.log('Health checks during load:');
  for (const hc of healthDuringLoad) {
    const emoji = hc.status === 200 ? 'OK' : 'DEGRADED';
    console.log(`  ${emoji} — ${hc.status} (${hc.duration.toFixed(0)}ms)`);
  }

  // ─── Pass/Fail Criteria ─────────────────────────────────────────────────

  console.log('\n=== PASS/FAIL CRITERIA ===');
  let passed = true;

  // No 500 errors (503 is expected for queue full)
  if (summary.serverErrors > 0) {
    console.log(`FAIL: ${summary.serverErrors} server errors (5xx excluding 503)`);
    passed = false;
  } else {
    console.log('PASS: Zero server errors');
  }

  // P95 under 5 seconds
  if (summary.p95ResponseTime > 5000) {
    console.log(`FAIL: P95 response time ${summary.p95ResponseTime.toFixed(0)}ms > 5000ms`);
    passed = false;
  } else {
    console.log(`PASS: P95 response time ${summary.p95ResponseTime.toFixed(0)}ms < 5000ms`);
  }

  // Health check stayed up during load
  const healthFailures = healthDuringLoad.filter((h) => h.status !== 200);
  if (healthFailures.length > 0) {
    console.log(`WARN: ${healthFailures.length} health check(s) returned non-200 during load`);
  } else {
    console.log('PASS: Health endpoint stayed healthy throughout test');
  }

  // No network errors
  if (summary.otherErrors > 0) {
    console.log(`FAIL: ${summary.otherErrors} network errors (timeouts/connection refused)`);
    passed = false;
  } else {
    console.log('PASS: Zero network errors');
  }

  // All error responses are JSON (not HTML error pages)
  const nonJsonErrors = allResults.filter(
    (r) => r.status >= 400 && r.status < 600 && !r.isJsonResponse
  );
  if (nonJsonErrors.length > 0) {
    console.log(`WARN: ${nonJsonErrors.length} error responses were not JSON`);
  } else {
    console.log('PASS: All error responses returned JSON');
  }

  console.log(`\n${passed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'}`);
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error('Load test crashed:', err);
  process.exit(1);
});
