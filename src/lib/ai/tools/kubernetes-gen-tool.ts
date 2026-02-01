/**
 * KUBERNETES GENERATOR TOOL
 * Generate Kubernetes manifests and configurations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function generateDeployment(config: {
  name: string;
  image: string;
  replicas?: number;
  port?: number;
  cpu?: string;
  memory?: string;
  env?: Record<string, string>;
  labels?: Record<string, string>;
}): string {
  const {
    name,
    image,
    replicas = 3,
    port = 8080,
    cpu = '100m',
    memory = '128Mi',
    env = {},
    labels = {}
  } = config;

  const envVars = Object.entries(env).map(([k, v]) =>
    `        - name: ${k}\n          value: "${v}"`
  ).join('\n');

  const labelEntries = { app: name, ...labels };
  const labelYaml = Object.entries(labelEntries).map(([k, v]) => `    ${k}: ${v}`).join('\n');

  return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  labels:
${labelYaml}
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
      - name: ${name}
        image: ${image}
        ports:
        - containerPort: ${port}
        resources:
          requests:
            cpu: ${cpu}
            memory: ${memory}
          limits:
            cpu: ${cpu.replace('m', '0m')}
            memory: ${memory.replace('Mi', '56Mi')}
${envVars ? `        env:\n${envVars}` : ''}
        livenessProbe:
          httpGet:
            path: /health
            port: ${port}
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: ${port}
          initialDelaySeconds: 5
          periodSeconds: 5`;
}

function generateService(config: {
  name: string;
  port?: number;
  targetPort?: number;
  type?: 'ClusterIP' | 'NodePort' | 'LoadBalancer';
}): string {
  const { name, port = 80, targetPort = 8080, type = 'ClusterIP' } = config;

  return `apiVersion: v1
kind: Service
metadata:
  name: ${name}
spec:
  type: ${type}
  selector:
    app: ${name}
  ports:
  - port: ${port}
    targetPort: ${targetPort}
    protocol: TCP`;
}

function generateIngress(config: {
  name: string;
  host: string;
  serviceName: string;
  servicePort?: number;
  tls?: boolean;
  annotations?: Record<string, string>;
}): string {
  const { name, host, serviceName, servicePort = 80, tls = false, annotations = {} } = config;

  const annotationYaml = Object.entries({
    'kubernetes.io/ingress.class': 'nginx',
    ...annotations
  }).map(([k, v]) => `    ${k}: "${v}"`).join('\n');

  const tlsBlock = tls ? `
  tls:
  - hosts:
    - ${host}
    secretName: ${name}-tls` : '';

  return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${name}
  annotations:
${annotationYaml}
spec:${tlsBlock}
  rules:
  - host: ${host}
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ${serviceName}
            port:
              number: ${servicePort}`;
}

function generateConfigMap(config: {
  name: string;
  data: Record<string, string>;
}): string {
  const { name, data } = config;
  const dataYaml = Object.entries(data).map(([k, v]) =>
    `  ${k}: ${v.includes('\n') ? `|\n${v.split('\n').map(l => '    ' + l).join('\n')}` : `"${v}"`}`
  ).join('\n');

  return `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${name}
data:
${dataYaml}`;
}

function generateSecret(config: {
  name: string;
  data: Record<string, string>;
  type?: string;
}): string {
  const { name, data, type = 'Opaque' } = config;
  const encodedData = Object.entries(data).map(([k, v]) =>
    `  ${k}: ${Buffer.from(v).toString('base64')}`
  ).join('\n');

  return `apiVersion: v1
kind: Secret
metadata:
  name: ${name}
type: ${type}
data:
${encodedData}`;
}

function generateHPA(config: {
  name: string;
  minReplicas?: number;
  maxReplicas?: number;
  cpuTarget?: number;
  memoryTarget?: number;
}): string {
  const { name, minReplicas = 2, maxReplicas = 10, cpuTarget = 70, memoryTarget } = config;

  const memoryMetric = memoryTarget ? `
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: ${memoryTarget}` : '';

  return `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${name}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${name}
  minReplicas: ${minReplicas}
  maxReplicas: ${maxReplicas}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: ${cpuTarget}${memoryMetric}`;
}

function generatePDB(config: {
  name: string;
  minAvailable?: number | string;
  maxUnavailable?: number | string;
}): string {
  const { name, minAvailable, maxUnavailable } = config;
  const spec = minAvailable !== undefined
    ? `minAvailable: ${minAvailable}`
    : `maxUnavailable: ${maxUnavailable || 1}`;

  return `apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: ${name}
spec:
  ${spec}
  selector:
    matchLabels:
      app: ${name}`;
}

function generateNamespace(name: string, labels?: Record<string, string>): string {
  const labelYaml = labels
    ? '\n  labels:\n' + Object.entries(labels).map(([k, v]) => `    ${k}: ${v}`).join('\n')
    : '';

  return `apiVersion: v1
kind: Namespace
metadata:
  name: ${name}${labelYaml}`;
}

function generateFullStack(config: {
  name: string;
  image: string;
  host: string;
  replicas?: number;
  port?: number;
}): string {
  const manifests = [
    generateNamespace(config.name),
    '---',
    generateDeployment({ ...config, labels: { tier: 'app' } }),
    '---',
    generateService({ name: config.name, port: 80, targetPort: config.port || 8080 }),
    '---',
    generateIngress({ name: config.name, host: config.host, serviceName: config.name }),
    '---',
    generateHPA({ name: config.name }),
    '---',
    generatePDB({ name: config.name, minAvailable: '50%' })
  ];

  return manifests.join('\n');
}

export const kubernetesGenTool: UnifiedTool = {
  name: 'kubernetes_gen',
  description: 'Kubernetes Generator: deployment, service, ingress, configmap, secret, hpa, pdb, namespace, full_stack',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['deployment', 'service', 'ingress', 'configmap', 'secret', 'hpa', 'pdb', 'namespace', 'full_stack'] },
      name: { type: 'string' },
      image: { type: 'string' },
      host: { type: 'string' },
      replicas: { type: 'number' },
      port: { type: 'number' },
      cpu: { type: 'string' },
      memory: { type: 'string' },
      type: { type: 'string' },
      tls: { type: 'boolean' },
      data: { type: 'object' },
      env: { type: 'object' },
      labels: { type: 'object' },
      minReplicas: { type: 'number' },
      maxReplicas: { type: 'number' }
    },
    required: ['operation']
  },
};

export async function executeKubernetesGen(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let manifest: string;

    switch (args.operation) {
      case 'deployment':
        manifest = generateDeployment({
          name: args.name || 'my-app',
          image: args.image || 'nginx:latest',
          replicas: args.replicas,
          port: args.port,
          cpu: args.cpu,
          memory: args.memory,
          env: args.env,
          labels: args.labels
        });
        break;
      case 'service':
        manifest = generateService({
          name: args.name || 'my-app',
          port: args.port,
          targetPort: args.targetPort,
          type: args.type
        });
        break;
      case 'ingress':
        manifest = generateIngress({
          name: args.name || 'my-app',
          host: args.host || 'app.example.com',
          serviceName: args.serviceName || args.name || 'my-app',
          servicePort: args.servicePort,
          tls: args.tls,
          annotations: args.annotations
        });
        break;
      case 'configmap':
        manifest = generateConfigMap({
          name: args.name || 'my-config',
          data: args.data || { 'config.json': '{}' }
        });
        break;
      case 'secret':
        manifest = generateSecret({
          name: args.name || 'my-secret',
          data: args.data || { 'password': 'secret123' },
          type: args.type
        });
        break;
      case 'hpa':
        manifest = generateHPA({
          name: args.name || 'my-app',
          minReplicas: args.minReplicas,
          maxReplicas: args.maxReplicas,
          cpuTarget: args.cpuTarget,
          memoryTarget: args.memoryTarget
        });
        break;
      case 'pdb':
        manifest = generatePDB({
          name: args.name || 'my-app',
          minAvailable: args.minAvailable,
          maxUnavailable: args.maxUnavailable
        });
        break;
      case 'namespace':
        manifest = generateNamespace(args.name || 'my-namespace', args.labels);
        break;
      case 'full_stack':
        manifest = generateFullStack({
          name: args.name || 'my-app',
          image: args.image || 'nginx:latest',
          host: args.host || 'app.example.com',
          replicas: args.replicas,
          port: args.port
        });
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: manifest };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isKubernetesGenAvailable(): boolean { return true; }
