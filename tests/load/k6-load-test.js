/**
 * K6 LOAD TESTING SCRIPT
 *
 * Performance and load testing for JCIL.AI platform.
 *
 * Usage:
 *   # Install k6: https://k6.io/docs/get-started/installation/
 *   brew install k6  # macOS
 *   # or: choco install k6  # Windows
 *   # or: sudo apt install k6  # Linux
 *
 *   # Run tests
 *   k6 run tests/load/k6-load-test.js
 *
 *   # Run with custom options
 *   k6 run --vus 50 --duration 60s tests/load/k6-load-test.js
 *
 *   # Run specific scenario
 *   k6 run --env SCENARIO=smoke tests/load/k6-load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const healthCheckDuration = new Trend('health_check_duration');
const apiResponseTime = new Trend('api_response_time');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'https://jcil.ai';

// Test scenarios
export const options = {
  scenarios: {
    // Smoke test - verify system works
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '30s',
      tags: { scenario: 'smoke' },
    },

    // Load test - normal load
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 20 },   // Ramp up
        { duration: '3m', target: 20 },   // Stay at 20 users
        { duration: '1m', target: 50 },   // Ramp up to 50
        { duration: '3m', target: 50 },   // Stay at 50 users
        { duration: '1m', target: 0 },    // Ramp down
      ],
      tags: { scenario: 'load' },
    },

    // Stress test - find breaking point
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // Ramp up
        { duration: '5m', target: 50 },   // Stay
        { duration: '2m', target: 100 },  // Push higher
        { duration: '5m', target: 100 },  // Stay
        { duration: '2m', target: 150 },  // Push to limit
        { duration: '5m', target: 150 },  // Stay
        { duration: '2m', target: 0 },    // Ramp down
      ],
      tags: { scenario: 'stress' },
    },

    // Spike test - sudden traffic surge
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 5 },    // Normal load
        { duration: '1m', target: 5 },     // Stay
        { duration: '10s', target: 100 },  // Spike!
        { duration: '3m', target: 100 },   // Stay at spike
        { duration: '10s', target: 5 },    // Back to normal
        { duration: '1m', target: 5 },     // Stay
        { duration: '10s', target: 0 },    // Ramp down
      ],
      tags: { scenario: 'spike' },
    },
  },

  // Thresholds - test fails if these aren't met
  thresholds: {
    http_req_duration: ['p(95)<2000'],      // 95% of requests under 2s
    http_req_failed: ['rate<0.05'],          // Less than 5% errors
    errors: ['rate<0.05'],                   // Custom error rate under 5%
    health_check_duration: ['p(95)<500'],    // Health check under 500ms
  },
};

// Helper function for API requests
function apiRequest(method, endpoint, body = null, params = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const defaultParams = {
    headers: {
      'Content-Type': 'application/json',
      'Origin': BASE_URL,
    },
    ...params,
  };

  let response;
  if (method === 'GET') {
    response = http.get(url, defaultParams);
  } else if (method === 'POST') {
    response = http.post(url, body ? JSON.stringify(body) : null, defaultParams);
  }

  return response;
}

// Main test function
export default function () {
  // Health check
  group('Health Check', () => {
    const start = Date.now();
    const response = http.get(`${BASE_URL}/api/health`);
    healthCheckDuration.add(Date.now() - start);

    const success = check(response, {
      'health check status is 200': (r) => r.status === 200,
      'health check returns healthy': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.status === 'healthy' || body.status === 'degraded';
        } catch {
          return false;
        }
      },
    });

    errorRate.add(!success);
  });

  sleep(1);

  // Homepage load
  group('Homepage', () => {
    const response = http.get(BASE_URL);

    const success = check(response, {
      'homepage status is 200': (r) => r.status === 200,
      'homepage has content': (r) => r.body && r.body.length > 0,
    });

    errorRate.add(!success);
    apiResponseTime.add(response.timings.duration);
  });

  sleep(1);

  // API endpoint tests (public endpoints only)
  group('Public API Endpoints', () => {
    // Test user status endpoint (should work without auth)
    const response = apiRequest('GET', '/api/user/is-admin');
    apiResponseTime.add(response.timings.duration);

    // We expect 401 for unauthenticated requests, which is correct behavior
    const success = check(response, {
      'API responds': (r) => r.status !== 0,
      'API response time OK': (r) => r.timings.duration < 2000,
    });

    errorRate.add(!success);
  });

  sleep(1);

  // Static assets
  group('Static Assets', () => {
    const assets = ['/icon-192.png', '/icon-512.png'];

    for (const asset of assets) {
      const response = http.get(`${BASE_URL}${asset}`);

      check(response, {
        [`${asset} loads`]: (r) => r.status === 200 || r.status === 304,
      });
    }
  });

  sleep(Math.random() * 2 + 1); // Random sleep 1-3 seconds
}

// Setup function - runs once before tests
export function setup() {
  console.log(`Starting load test against: ${BASE_URL}`);

  // Verify system is up before starting
  const response = http.get(`${BASE_URL}/api/health`);
  if (response.status !== 200) {
    throw new Error(`System not ready: ${response.status}`);
  }

  console.log('System is ready, starting tests...');
  return { startTime: Date.now() };
}

// Teardown function - runs once after tests
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed in ${duration.toFixed(2)} seconds`);
}

// Handle test summary
export function handleSummary(data) {
  return {
    'tests/load/summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
  };
}

// Text summary helper
function textSummary(data, options = {}) {
  const { indent = '', enableColors = false } = options;

  let summary = '\n';
  summary += `${indent}=== LOAD TEST SUMMARY ===\n\n`;

  // Metrics
  if (data.metrics) {
    summary += `${indent}Requests:\n`;
    summary += `${indent}  Total: ${data.metrics.http_reqs?.values?.count || 0}\n`;
    summary += `${indent}  Rate: ${(data.metrics.http_reqs?.values?.rate || 0).toFixed(2)}/s\n`;

    summary += `\n${indent}Response Times:\n`;
    summary += `${indent}  Avg: ${(data.metrics.http_req_duration?.values?.avg || 0).toFixed(2)}ms\n`;
    summary += `${indent}  P95: ${(data.metrics.http_req_duration?.values?.['p(95)'] || 0).toFixed(2)}ms\n`;
    summary += `${indent}  Max: ${(data.metrics.http_req_duration?.values?.max || 0).toFixed(2)}ms\n`;

    summary += `\n${indent}Errors:\n`;
    summary += `${indent}  Failed: ${(data.metrics.http_req_failed?.values?.rate || 0) * 100}%\n`;
    summary += `${indent}  Custom Error Rate: ${((data.metrics.errors?.values?.rate || 0) * 100).toFixed(2)}%\n`;
  }

  // Thresholds
  if (data.thresholds) {
    summary += `\n${indent}Thresholds:\n`;
    for (const [name, threshold] of Object.entries(data.thresholds)) {
      const status = threshold.ok ? 'PASS' : 'FAIL';
      const color = enableColors ? (threshold.ok ? '\x1b[32m' : '\x1b[31m') : '';
      const reset = enableColors ? '\x1b[0m' : '';
      summary += `${indent}  ${color}${status}${reset} ${name}\n`;
    }
  }

  summary += '\n';
  return summary;
}
