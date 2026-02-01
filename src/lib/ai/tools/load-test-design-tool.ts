/**
 * LOAD TEST DESIGN TOOL
 * Design and analyze load tests
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function designLoadTest(config: {
  targetRPS: number;
  duration: number;
  rampUp: number;
  scenarios: string[];
}): Record<string, unknown> {
  const { targetRPS, duration, rampUp, scenarios } = config;

  const virtualUsers = Math.ceil(targetRPS / 10); // Assuming 10 RPS per VU
  const totalRequests = targetRPS * duration;

  return {
    testPlan: {
      name: 'Load Test Plan',
      targetRPS,
      durationSeconds: duration,
      rampUpSeconds: rampUp,
      virtualUsers,
      totalRequests
    },
    phases: [
      { name: 'Ramp Up', duration: rampUp, startVUs: 1, endVUs: virtualUsers },
      { name: 'Steady State', duration: duration - rampUp - 30, vus: virtualUsers },
      { name: 'Ramp Down', duration: 30, startVUs: virtualUsers, endVUs: 0 }
    ],
    scenarios: scenarios.map((s) => ({
      name: s,
      weight: Math.round(100 / scenarios.length),
      thinkTime: '1-3s'
    })),
    k6Script: `import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '${rampUp}s', target: ${virtualUsers} },
    { duration: '${duration - rampUp - 30}s', target: ${virtualUsers} },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function() {
  const res = http.get('https://api.example.com/endpoint');
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(Math.random() * 2 + 1);
}`,
    infrastructure: {
      loadGenerators: Math.ceil(virtualUsers / 1000),
      recommendedTool: 'k6 or Gatling',
      estimatedBandwidth: `${Math.round(totalRequests * 10 / 1024)} MB`
    }
  };
}

function analyzeResults(results: {
  avgLatency: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  throughput: number;
}): Record<string, unknown> {
  const { avgLatency, p50, p95, p99, errorRate, throughput } = results;

  const issues: string[] = [];
  const recommendations: string[] = [];

  if (p95 > 500) {
    issues.push('P95 latency exceeds 500ms threshold');
    recommendations.push('Investigate slow endpoints, add caching');
  }

  if (p99 > p95 * 3) {
    issues.push('High latency variance (P99 >> P95)');
    recommendations.push('Check for GC pauses, connection pool exhaustion');
  }

  if (errorRate > 0.01) {
    issues.push(`Error rate ${(errorRate * 100).toFixed(2)}% exceeds 1% threshold`);
    recommendations.push('Review error logs, check resource limits');
  }

  if (avgLatency > p50 * 1.5) {
    issues.push('Average significantly higher than median');
    recommendations.push('Outliers affecting average - investigate spikes');
  }

  return {
    summary: {
      avgLatency: `${avgLatency}ms`,
      p50: `${p50}ms`,
      p95: `${p95}ms`,
      p99: `${p99}ms`,
      errorRate: `${(errorRate * 100).toFixed(2)}%`,
      throughput: `${throughput} req/s`
    },
    health: issues.length === 0 ? 'PASS' : issues.length < 2 ? 'WARNING' : 'FAIL',
    issues,
    recommendations,
    apdex: calculateApdex(p50, p95, 500)
  };
}

function calculateApdex(satisfied: number, tolerating: number, threshold: number): Record<string, unknown> {
  // Simplified Apdex calculation
  const satisfiedRatio = satisfied < threshold ? 0.8 : 0.4;
  const toleratingRatio = tolerating < threshold * 4 ? 0.15 : 0.05;
  const apdex = satisfiedRatio + (toleratingRatio * 0.5);

  return {
    score: Math.round(apdex * 100) / 100,
    rating: apdex >= 0.94 ? 'Excellent' : apdex >= 0.85 ? 'Good' : apdex >= 0.7 ? 'Fair' : apdex >= 0.5 ? 'Poor' : 'Unacceptable',
    threshold: `${threshold}ms`
  };
}

function generateGatlingScript(config: {
  baseUrl: string;
  scenarios: Array<{ name: string; path: string; method: string }>;
  users: number;
  duration: number;
}): string {
  const { baseUrl, scenarios, users, duration } = config;

  return `import io.gatling.core.Predef._
import io.gatling.http.Predef._
import scala.concurrent.duration._

class LoadTest extends Simulation {
  val httpProtocol = http
    .baseUrl("${baseUrl}")
    .acceptHeader("application/json")
    .contentTypeHeader("application/json")

  val scn = scenario("Load Test")
${scenarios.map(s => `    .exec(http("${s.name}")
      .${s.method.toLowerCase()}("${s.path}")
      .check(status.is(200)))
    .pause(1, 3)`).join('\n')}

  setUp(
    scn.inject(
      rampUsers(${users}).during(${Math.floor(duration / 3)}.seconds),
      constantUsersPerSec(${Math.ceil(users / 10)}).during(${Math.floor(duration * 2 / 3)}.seconds)
    )
  ).protocols(httpProtocol)
   .assertions(
     global.responseTime.percentile(95).lt(500),
     global.successfulRequests.percent.gt(99)
   )
}`;
}

function capacityTest(baseline: {
  currentRPS: number;
  currentLatency: number;
  targetRPS: number;
}): Record<string, unknown> {
  const { currentRPS, currentLatency, targetRPS } = baseline;

  const scaleFactor = targetRPS / currentRPS;
  const estimatedLatencyAtTarget = currentLatency * Math.sqrt(scaleFactor); // Simplified model

  return {
    baseline: { rps: currentRPS, latency: `${currentLatency}ms` },
    target: { rps: targetRPS },
    projection: {
      estimatedLatency: `${Math.round(estimatedLatencyAtTarget)}ms`,
      scaleFactor: scaleFactor.toFixed(2),
      willMeetSLA: estimatedLatencyAtTarget < 500
    },
    testPlan: [
      { step: 1, rps: Math.round(currentRPS * 1.25), description: '25% increase' },
      { step: 2, rps: Math.round(currentRPS * 1.5), description: '50% increase' },
      { step: 3, rps: Math.round(currentRPS * 2), description: '100% increase' },
      { step: 4, rps: targetRPS, description: 'Target load' },
      { step: 5, rps: Math.round(targetRPS * 1.2), description: 'Headroom test (+20%)' }
    ],
    recommendations: scaleFactor > 2 ? [
      'Consider horizontal scaling',
      'Implement caching layer',
      'Optimize database queries',
      'Add read replicas'
    ] : ['Current architecture may handle load with tuning']
  };
}

function spikeTestDesign(normalLoad: number, spikeMultiplier: number): Record<string, unknown> {
  return {
    testType: 'Spike Test',
    purpose: 'Verify system behavior under sudden load increase',
    design: {
      normalLoad: `${normalLoad} RPS`,
      spikeLoad: `${normalLoad * spikeMultiplier} RPS`,
      multiplier: `${spikeMultiplier}x`
    },
    phases: [
      { name: 'Baseline', duration: '2m', load: normalLoad },
      { name: 'Spike', duration: '30s', load: normalLoad * spikeMultiplier },
      { name: 'Recovery', duration: '2m', load: normalLoad },
      { name: 'Spike 2', duration: '30s', load: normalLoad * spikeMultiplier },
      { name: 'Cooldown', duration: '2m', load: normalLoad }
    ],
    successCriteria: [
      'Error rate < 5% during spike',
      'Recovery to baseline latency within 30s',
      'No cascading failures',
      'Auto-scaling triggers correctly (if configured)'
    ],
    k6Config: `export const options = {
  scenarios: {
    spike: {
      executor: 'ramping-arrival-rate',
      startRate: ${normalLoad},
      stages: [
        { target: ${normalLoad}, duration: '2m' },
        { target: ${normalLoad * spikeMultiplier}, duration: '10s' },
        { target: ${normalLoad * spikeMultiplier}, duration: '30s' },
        { target: ${normalLoad}, duration: '10s' },
        { target: ${normalLoad}, duration: '2m' },
      ],
    },
  },
};`
  };
}

export const loadTestDesignTool: UnifiedTool = {
  name: 'load_test_design',
  description: 'Load Test Design: design, analyze_results, gatling_script, capacity_test, spike_test',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['design', 'analyze_results', 'gatling_script', 'capacity_test', 'spike_test'] },
      config: { type: 'object' },
      results: { type: 'object' },
      baseline: { type: 'object' },
      normalLoad: { type: 'number' },
      spikeMultiplier: { type: 'number' }
    },
    required: ['operation']
  },
};

export async function executeLoadTestDesign(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown> | string;

    switch (args.operation) {
      case 'design':
        result = designLoadTest(args.config || {
          targetRPS: 1000,
          duration: 300,
          rampUp: 60,
          scenarios: ['Browse Products', 'Search', 'Add to Cart', 'Checkout']
        });
        break;
      case 'analyze_results':
        result = analyzeResults(args.results || {
          avgLatency: 120,
          p50: 85,
          p95: 350,
          p99: 890,
          errorRate: 0.005,
          throughput: 950
        });
        break;
      case 'gatling_script':
        result = { script: generateGatlingScript(args.config || {
          baseUrl: 'https://api.example.com',
          scenarios: [
            { name: 'Get Users', path: '/users', method: 'GET' },
            { name: 'Create Order', path: '/orders', method: 'POST' }
          ],
          users: 100,
          duration: 300
        })};
        break;
      case 'capacity_test':
        result = capacityTest(args.baseline || {
          currentRPS: 500,
          currentLatency: 100,
          targetRPS: 2000
        });
        break;
      case 'spike_test':
        result = spikeTestDesign(args.normalLoad || 500, args.spikeMultiplier || 5);
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: typeof result === 'string' ? result : JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isLoadTestDesignAvailable(): boolean { return true; }
