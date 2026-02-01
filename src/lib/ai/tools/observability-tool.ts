/**
 * OBSERVABILITY TOOL
 * Design logging, metrics, tracing, and alerting systems
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function designLogging(config: {
  format?: 'json' | 'text';
  level?: 'debug' | 'info' | 'warn' | 'error';
  fields?: string[];
  destination?: 'stdout' | 'file' | 'elasticsearch' | 'cloudwatch';
}): Record<string, unknown> {
  const { format = 'json', level = 'info', fields = [], destination = 'stdout' } = config;

  const defaultFields = ['timestamp', 'level', 'message', 'service', 'traceId', 'spanId'];
  const allFields = [...new Set([...defaultFields, ...fields])];

  return {
    configuration: {
      format,
      defaultLevel: level,
      fields: allFields,
      destination
    },
    logLevels: {
      debug: 'Detailed debugging information',
      info: 'Routine operational messages',
      warn: 'Potentially harmful situations',
      error: 'Error events that might still allow the application to continue'
    },
    structuredLogExample: {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'User logged in',
      service: 'auth-service',
      traceId: 'abc123',
      spanId: 'def456',
      userId: 'user123',
      duration_ms: 45
    },
    implementation: generateLoggerCode(format, destination),
    bestPractices: [
      'Use structured logging (JSON) for machine parsing',
      'Include correlation IDs for distributed tracing',
      'Log at appropriate levels',
      'Avoid logging sensitive data',
      'Include context in error logs',
      'Use sampling for high-volume debug logs'
    ]
  };
}

function generateLoggerCode(format: string, _destination: string): string {
  return `import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ${format === 'json' ? '' : "transport: { target: 'pino-pretty' },"}
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      service: process.env.SERVICE_NAME || 'unknown',
      version: process.env.APP_VERSION || '0.0.0',
      pid: bindings.pid,
      host: bindings.hostname
    })
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: ['password', 'token', 'secret', 'authorization']
});

// Create child logger with request context
export function createRequestLogger(req: Request) {
  return logger.child({
    traceId: req.headers['x-trace-id'],
    requestId: req.headers['x-request-id'],
    path: req.url,
    method: req.method
  });
}

export { logger };`;
}

function designMetrics(config: {
  type?: 'counter' | 'gauge' | 'histogram' | 'summary';
  name?: string;
  labels?: string[];
  buckets?: number[];
}): Record<string, unknown> {
  const { type = 'histogram', name = 'http_request_duration_seconds', labels = ['method', 'path', 'status'], buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10] } = config;

  const metricTypes = {
    counter: {
      description: 'Monotonically increasing value',
      useCase: 'Request count, error count, events',
      example: `const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status']
});

// Usage
httpRequestsTotal.inc({ method: 'GET', path: '/api/users', status: '200' });`
    },
    gauge: {
      description: 'Value that can go up or down',
      useCase: 'Current connections, queue size, temperature',
      example: `const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Current active connections'
});

// Usage
activeConnections.set(42);
activeConnections.inc();
activeConnections.dec();`
    },
    histogram: {
      description: 'Distribution of values in buckets',
      useCase: 'Request latency, response size',
      example: `const httpDuration = new Histogram({
  name: '${name}',
  help: 'HTTP request duration in seconds',
  labelNames: ${JSON.stringify(labels)},
  buckets: ${JSON.stringify(buckets)}
});

// Usage
const end = httpDuration.startTimer();
// ... handle request
end({ method: 'GET', path: '/api/users', status: '200' });`
    },
    summary: {
      description: 'Similar to histogram but calculates percentiles',
      useCase: 'When you need precise percentiles',
      example: `const httpDuration = new Summary({
  name: 'http_request_duration_summary',
  help: 'HTTP request duration',
  percentiles: [0.5, 0.9, 0.95, 0.99]
});`
    }
  };

  return {
    metricType: type,
    definition: metricTypes[type],
    prometheusConfig: `# prometheus.yml
scrape_configs:
  - job_name: 'app'
    static_configs:
      - targets: ['localhost:9090']
    scrape_interval: 15s
    metrics_path: /metrics`,
    redMetrics: {
      description: 'RED Method - Rate, Errors, Duration',
      metrics: [
        'http_requests_total - Rate of requests',
        'http_request_errors_total - Rate of errors',
        'http_request_duration_seconds - Duration of requests'
      ]
    },
    useMetrics: {
      description: 'USE Method - Utilization, Saturation, Errors',
      metrics: [
        'cpu_utilization_percent',
        'memory_utilization_percent',
        'connection_pool_saturation',
        'disk_io_errors_total'
      ]
    },
    goldenSignals: {
      description: 'Four Golden Signals (Google SRE)',
      metrics: ['Latency', 'Traffic', 'Errors', 'Saturation']
    }
  };
}

function designTracing(config: {
  serviceName?: string;
  sampler?: 'always_on' | 'always_off' | 'ratio' | 'parent_based';
  ratio?: number;
  exporter?: 'jaeger' | 'zipkin' | 'otlp';
}): Record<string, unknown> {
  const { serviceName = 'my-service', sampler = 'ratio', ratio = 0.1, exporter = 'otlp' } = config;

  return {
    configuration: {
      serviceName,
      sampler,
      samplingRatio: ratio,
      exporter
    },
    openTelemetrySetup: `import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: '${serviceName}',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
  ${sampler === 'ratio' ? `sampler: new TraceIdRatioBasedSampler(${ratio}),` : ''}
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown().finally(() => process.exit(0));
});`,
    manualSpans: `import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('${serviceName}');

async function processOrder(orderId: string) {
  return tracer.startActiveSpan('process-order', async (span) => {
    try {
      span.setAttribute('order.id', orderId);

      // Child span
      await tracer.startActiveSpan('validate-order', async (childSpan) => {
        await validateOrder(orderId);
        childSpan.end();
      });

      // Add event
      span.addEvent('order-validated');

      const result = await submitOrder(orderId);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}`,
    contextPropagation: {
      description: 'Trace context flows through services via HTTP headers',
      headers: ['traceparent', 'tracestate'],
      example: 'traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01'
    },
    bestPractices: [
      'Use auto-instrumentation for common libraries',
      'Add custom spans for business operations',
      'Include relevant attributes (user_id, order_id, etc)',
      'Use appropriate sampling for high-traffic services',
      'Propagate context across async boundaries'
    ]
  };
}

function designAlerting(config: {
  name?: string;
  type?: 'threshold' | 'anomaly' | 'slo';
  metric?: string;
  condition?: string;
  severity?: 'critical' | 'warning' | 'info';
}): Record<string, unknown> {
  const { name = 'HighErrorRate', type = 'threshold', metric = 'http_requests_errors_total', condition = '> 1%', severity = 'critical' } = config;

  return {
    alert: {
      name,
      type,
      metric,
      condition,
      severity
    },
    prometheusAlert: `groups:
  - name: ${name.toLowerCase()}_alerts
    rules:
      - alert: ${name}
        expr: |
          sum(rate(http_requests_errors_total[5m])) /
          sum(rate(http_requests_total[5m])) > 0.01
        for: 5m
        labels:
          severity: ${severity}
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} (threshold: 1%)"
          runbook_url: "https://wiki.example.com/runbooks/${name.toLowerCase()}"

      - alert: HighLatency
        expr: |
          histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency detected"
          description: "P95 latency is {{ $value }}s (threshold: 500ms)"`,
    sloDefinition: {
      sli: 'Percentage of successful requests (status < 500)',
      slo: '99.9% availability over 30 days',
      errorBudget: '0.1% = ~43 minutes of downtime per month',
      burnRateAlert: `- alert: SLOBurnRateHigh
        expr: |
          sum(rate(http_requests_errors_total[1h])) /
          sum(rate(http_requests_total[1h])) > 14.4 * 0.001
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error budget burn rate"
          description: "Burning error budget 14.4x faster than sustainable"`
    },
    alertBestPractices: [
      'Alert on symptoms, not causes',
      'Every alert should be actionable',
      'Include runbook links',
      'Use severity levels consistently',
      'Avoid alert fatigue with appropriate thresholds',
      'Test alerts regularly'
    ],
    oncallIntegration: `// PagerDuty integration
const alertPayload = {
  routing_key: process.env.PAGERDUTY_ROUTING_KEY,
  event_action: 'trigger',
  dedup_key: \`\${alert.name}-\${alert.fingerprint}\`,
  payload: {
    summary: alert.annotations.summary,
    severity: alert.labels.severity,
    source: alert.labels.instance,
    custom_details: {
      metric: alert.labels.__name__,
      value: alert.value,
      runbook: alert.annotations.runbook_url
    }
  }
};`
  };
}

function designDashboard(config: {
  name?: string;
  type?: 'overview' | 'service' | 'infrastructure' | 'slo';
  metrics?: string[];
}): Record<string, unknown> {
  const { name = 'Service Dashboard', type = 'service' } = config;

  const dashboardTemplates: Record<string, Record<string, unknown>> = {
    overview: {
      panels: [
        { title: 'Request Rate', type: 'timeseries', query: 'sum(rate(http_requests_total[5m]))' },
        { title: 'Error Rate', type: 'gauge', query: 'sum(rate(http_request_errors_total[5m])) / sum(rate(http_requests_total[5m]))' },
        { title: 'Latency P95', type: 'timeseries', query: 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))' },
        { title: 'Active Instances', type: 'stat', query: 'count(up{job="app"})' }
      ]
    },
    service: {
      panels: [
        { title: 'Requests by Endpoint', type: 'timeseries', query: 'sum(rate(http_requests_total[5m])) by (path)' },
        { title: 'Error Rate by Endpoint', type: 'heatmap', query: 'sum(rate(http_request_errors_total[5m])) by (path, status)' },
        { title: 'Latency Distribution', type: 'histogram', query: 'http_request_duration_seconds_bucket' },
        { title: 'Dependency Latency', type: 'timeseries', query: 'histogram_quantile(0.95, sum(rate(dependency_request_duration_bucket[5m])) by (le, service))' }
      ]
    },
    infrastructure: {
      panels: [
        { title: 'CPU Usage', type: 'timeseries', query: 'avg(rate(container_cpu_usage_seconds_total[5m])) by (pod)' },
        { title: 'Memory Usage', type: 'timeseries', query: 'container_memory_usage_bytes / container_spec_memory_limit_bytes' },
        { title: 'Network I/O', type: 'timeseries', query: 'rate(container_network_receive_bytes_total[5m])' },
        { title: 'Disk I/O', type: 'timeseries', query: 'rate(container_fs_writes_bytes_total[5m])' }
      ]
    },
    slo: {
      panels: [
        { title: 'SLI - Availability', type: 'stat', query: '1 - (sum(rate(http_request_errors_total[30d])) / sum(rate(http_requests_total[30d])))' },
        { title: 'Error Budget Remaining', type: 'gauge', query: '1 - (slo_errors / slo_budget)' },
        { title: 'Burn Rate (1h)', type: 'timeseries', query: 'sum(rate(http_request_errors_total[1h])) / sum(rate(http_requests_total[1h])) / 0.001' },
        { title: 'SLO Compliance History', type: 'timeseries', query: 'slo_compliance_ratio' }
      ]
    }
  };

  return {
    dashboard: {
      name,
      type,
      panels: dashboardTemplates[type]?.panels || []
    },
    grafanaJson: {
      title: name,
      uid: name.toLowerCase().replace(/\s+/g, '-'),
      tags: ['generated', type],
      time: { from: 'now-6h', to: 'now' },
      refresh: '30s',
      panels: (dashboardTemplates[type]?.panels as Array<Record<string, unknown>> | undefined)?.map((p: Record<string, unknown>, i: number) => ({
        ...p,
        id: i + 1,
        gridPos: { x: (i % 2) * 12, y: Math.floor(i / 2) * 8, w: 12, h: 8 }
      }))
    },
    recommendations: [
      'Use consistent color schemes',
      'Group related panels together',
      'Include time range selector',
      'Add annotations for deployments',
      'Use variables for filtering'
    ]
  };
}

export const observabilityTool: UnifiedTool = {
  name: 'observability',
  description: 'Observability: logging, metrics, tracing, alerting, dashboard',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['logging', 'metrics', 'tracing', 'alerting', 'dashboard'] },
      config: { type: 'object' }
    },
    required: ['operation']
  },
};

export async function executeObservability(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'logging':
        result = designLogging(args.config || {});
        break;
      case 'metrics':
        result = designMetrics(args.config || {});
        break;
      case 'tracing':
        result = designTracing(args.config || {});
        break;
      case 'alerting':
        result = designAlerting(args.config || {});
        break;
      case 'dashboard':
        result = designDashboard(args.config || {});
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isObservabilityAvailable(): boolean { return true; }
