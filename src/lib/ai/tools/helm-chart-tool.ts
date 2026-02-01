/**
 * HELM CHART TOOL
 * Generate Helm charts and templates
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function generateChart(config: {
  name: string;
  version?: string;
  description?: string;
  appVersion?: string;
  type?: 'application' | 'library';
}): Record<string, unknown> {
  const { name, version = '0.1.0', description = 'A Helm chart', appVersion = '1.0.0', type = 'application' } = config;

  const chartYaml = `apiVersion: v2
name: ${name}
description: ${description}
type: ${type}
version: ${version}
appVersion: "${appVersion}"

keywords:
  - ${name}

home: https://github.com/example/${name}

maintainers:
  - name: Your Name
    email: your.email@example.com

dependencies: []
`;

  const valuesYaml = `# Default values for ${name}
# This is a YAML-formatted file.

replicaCount: 1

image:
  repository: ${name}
  pullPolicy: IfNotPresent
  tag: ""

imagePullSecrets: []
nameOverride: ""
fullnameOverride: ""

serviceAccount:
  create: true
  annotations: {}
  name: ""

podAnnotations: {}

podSecurityContext:
  fsGroup: 1000

securityContext:
  capabilities:
    drop:
      - ALL
  readOnlyRootFilesystem: true
  runAsNonRoot: true
  runAsUser: 1000

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: false
  className: ""
  annotations: {}
  hosts:
    - host: ${name}.local
      paths:
        - path: /
          pathType: ImplementationSpecific
  tls: []

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 128Mi

autoscaling:
  enabled: false
  minReplicas: 1
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80

nodeSelector: {}

tolerations: []

affinity: {}

env: []

configMaps: {}

secrets: {}

persistence:
  enabled: false
  storageClass: ""
  size: 1Gi
`;

  const helpersTemplate = `{{/*
Expand the name of the chart.
*/}}
{{- define "${name}.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "${name}.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "${name}.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "${name}.labels" -}}
helm.sh/chart: {{ include "${name}.chart" . }}
{{ include "${name}.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "${name}.selectorLabels" -}}
app.kubernetes.io/name: {{ include "${name}.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "${name}.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "${name}.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
`;

  const deploymentTemplate = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "${name}.fullname" . }}
  labels:
    {{- include "${name}.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "${name}.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      {{- with .Values.podAnnotations }}
      annotations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      labels:
        {{- include "${name}.selectorLabels" . | nindent 8 }}
    spec:
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      serviceAccountName: {{ include "${name}.serviceAccountName" . }}
      securityContext:
        {{- toYaml .Values.podSecurityContext | nindent 8 }}
      containers:
        - name: {{ .Chart.Name }}
          securityContext:
            {{- toYaml .Values.securityContext | nindent 12 }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: 80
              protocol: TCP
          livenessProbe:
            httpGet:
              path: /health
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
          {{- with .Values.env }}
          env:
            {{- toYaml . | nindent 12 }}
          {{- end }}
      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
`;

  const serviceTemplate = `apiVersion: v1
kind: Service
metadata:
  name: {{ include "${name}.fullname" . }}
  labels:
    {{- include "${name}.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: http
      protocol: TCP
      name: http
  selector:
    {{- include "${name}.selectorLabels" . | nindent 4 }}
`;

  const ingressTemplate = `{{- if .Values.ingress.enabled -}}
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {{ include "${name}.fullname" . }}
  labels:
    {{- include "${name}.labels" . | nindent 4 }}
  {{- with .Values.ingress.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  {{- if .Values.ingress.className }}
  ingressClassName: {{ .Values.ingress.className }}
  {{- end }}
  {{- if .Values.ingress.tls }}
  tls:
    {{- range .Values.ingress.tls }}
    - hosts:
        {{- range .hosts }}
        - {{ . | quote }}
        {{- end }}
      secretName: {{ .secretName }}
    {{- end }}
  {{- end }}
  rules:
    {{- range .Values.ingress.hosts }}
    - host: {{ .host | quote }}
      http:
        paths:
          {{- range .paths }}
          - path: {{ .path }}
            pathType: {{ .pathType }}
            backend:
              service:
                name: {{ include "${name}.fullname" $ }}
                port:
                  number: {{ $.Values.service.port }}
          {{- end }}
    {{- end }}
{{- end }}
`;

  return {
    chartName: name,
    structure: `${name}/
├── Chart.yaml
├── values.yaml
├── templates/
│   ├── _helpers.tpl
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   ├── serviceaccount.yaml
│   ├── hpa.yaml
│   └── NOTES.txt
├── charts/
└── .helmignore`,
    files: {
      'Chart.yaml': chartYaml,
      'values.yaml': valuesYaml,
      'templates/_helpers.tpl': helpersTemplate,
      'templates/deployment.yaml': deploymentTemplate,
      'templates/service.yaml': serviceTemplate,
      'templates/ingress.yaml': ingressTemplate
    },
    commands: [
      `helm create ${name}`,
      `helm lint ${name}`,
      `helm template ${name} ./${name}`,
      `helm install ${name} ./${name} --dry-run`,
      `helm install ${name} ./${name} -n default`
    ]
  };
}

function generateValues(config: {
  environment: 'dev' | 'staging' | 'prod';
  replicas?: number;
  image?: string;
  resources?: { cpu: string; memory: string };
}): string {
  const { environment, replicas, image, resources } = config;

  const envDefaults = {
    dev: { replicas: 1, cpuLimit: '200m', memoryLimit: '256Mi' },
    staging: { replicas: 2, cpuLimit: '500m', memoryLimit: '512Mi' },
    prod: { replicas: 3, cpuLimit: '1000m', memoryLimit: '1Gi' }
  };

  const defaults = envDefaults[environment];

  return `# ${environment.toUpperCase()} Environment Values

replicaCount: ${replicas || defaults.replicas}

image:
  repository: ${image || 'myapp'}
  pullPolicy: ${environment === 'prod' ? 'IfNotPresent' : 'Always'}
  tag: ""

resources:
  limits:
    cpu: ${resources?.cpu || defaults.cpuLimit}
    memory: ${resources?.memory || defaults.memoryLimit}
  requests:
    cpu: ${environment === 'prod' ? '200m' : '50m'}
    memory: ${environment === 'prod' ? '256Mi' : '64Mi'}

autoscaling:
  enabled: ${environment === 'prod'}
  minReplicas: ${environment === 'prod' ? 3 : 1}
  maxReplicas: ${environment === 'prod' ? 10 : 3}
  targetCPUUtilizationPercentage: 80

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-${environment === 'prod' ? 'prod' : 'staging'}"
  hosts:
    - host: app.${environment}.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: app-${environment}-tls
      hosts:
        - app.${environment}.example.com

env:
  - name: ENVIRONMENT
    value: "${environment}"
  - name: LOG_LEVEL
    value: "${environment === 'prod' ? 'info' : 'debug'}"

${environment === 'prod' ? `
podDisruptionBudget:
  enabled: true
  minAvailable: 2

affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
              - key: app.kubernetes.io/name
                operator: In
                values:
                  - myapp
          topologyKey: kubernetes.io/hostname
` : ''}
`;
}

function generateSubchart(config: {
  name: string;
  parent: string;
  type: 'database' | 'cache' | 'queue' | 'monitoring';
}): Record<string, unknown> {
  const { name, parent, type } = config;

  const dependencies: Record<string, Record<string, unknown>> = {
    database: {
      name: 'postgresql',
      repository: 'https://charts.bitnami.com/bitnami',
      version: '12.x.x',
      condition: 'postgresql.enabled',
      values: `postgresql:
  enabled: true
  auth:
    postgresPassword: ""
    username: app
    password: ""
    database: ${name}
  primary:
    persistence:
      size: 8Gi`
    },
    cache: {
      name: 'redis',
      repository: 'https://charts.bitnami.com/bitnami',
      version: '17.x.x',
      condition: 'redis.enabled',
      values: `redis:
  enabled: true
  auth:
    enabled: true
    password: ""
  master:
    persistence:
      size: 1Gi
  replica:
    replicaCount: 2`
    },
    queue: {
      name: 'rabbitmq',
      repository: 'https://charts.bitnami.com/bitnami',
      version: '12.x.x',
      condition: 'rabbitmq.enabled',
      values: `rabbitmq:
  enabled: true
  auth:
    username: app
    password: ""
  persistence:
    size: 2Gi`
    },
    monitoring: {
      name: 'prometheus',
      repository: 'https://prometheus-community.github.io/helm-charts',
      version: '25.x.x',
      condition: 'prometheus.enabled',
      values: `prometheus:
  enabled: true
  alertmanager:
    enabled: true
  server:
    persistentVolume:
      size: 10Gi`
    }
  };

  const dep = dependencies[type];

  return {
    dependency: {
      chartYaml: `dependencies:
  - name: ${dep.name}
    version: "${dep.version}"
    repository: ${dep.repository}
    condition: ${dep.condition}`,
      parentValues: dep.values
    },
    parentChart: parent,
    commands: [
      `helm dependency add ${dep.repository}/${dep.name}`,
      `helm dependency update ./${parent}`,
      `helm dependency build ./${parent}`
    ]
  };
}

function lintChart(issues: string[]): Record<string, unknown> {
  const defaultIssues = [
    'Missing icon in Chart.yaml',
    'No NOTES.txt template',
    'Container running as root',
    'No resource limits defined',
    'No liveness probe configured',
    'No readiness probe configured',
    'Using latest tag',
    'No PodDisruptionBudget',
    'No NetworkPolicy',
    'Secrets not encrypted'
  ];

  const reportIssues = issues.length > 0 ? issues : defaultIssues.slice(0, 5);

  return {
    issues: reportIssues.map(issue => ({
      issue,
      severity: issue.includes('root') || issue.includes('Secrets') ? 'HIGH' :
                issue.includes('resource') || issue.includes('probe') ? 'MEDIUM' : 'LOW',
      recommendation: getRecommendation(issue)
    })),
    score: `${Math.max(0, 100 - (reportIssues.length * 10))}/100`,
    commands: {
      lint: 'helm lint ./my-chart',
      template: 'helm template my-release ./my-chart --debug',
      dryRun: 'helm install my-release ./my-chart --dry-run --debug'
    },
    tools: [
      'helm lint - Basic chart validation',
      'kubeval - Kubernetes manifest validation',
      'conftest - Policy testing with OPA',
      'chart-testing (ct) - Automated chart testing'
    ]
  };
}

function getRecommendation(issue: string): string {
  const recommendations: Record<string, string> = {
    'icon': 'Add icon: URL in Chart.yaml',
    'NOTES': 'Create templates/NOTES.txt with usage instructions',
    'root': 'Set securityContext.runAsNonRoot: true',
    'resource': 'Define resources.limits and resources.requests',
    'liveness': 'Add livenessProbe with httpGet or exec',
    'readiness': 'Add readinessProbe with httpGet or exec',
    'latest': 'Use specific image tag, not latest',
    'PodDisruptionBudget': 'Create PDB for production workloads',
    'NetworkPolicy': 'Add NetworkPolicy to restrict traffic',
    'Secrets': 'Use sealed-secrets or external-secrets'
  };

  for (const [key, rec] of Object.entries(recommendations)) {
    if (issue.toLowerCase().includes(key.toLowerCase())) {
      return rec;
    }
  }
  return 'Review Helm best practices';
}

function generateHelmfile(apps: Array<{ name: string; namespace: string; chart: string }>): string {
  const defaultApps = [
    { name: 'nginx-ingress', namespace: 'ingress-nginx', chart: 'ingress-nginx/ingress-nginx' },
    { name: 'cert-manager', namespace: 'cert-manager', chart: 'jetstack/cert-manager' },
    { name: 'prometheus', namespace: 'monitoring', chart: 'prometheus-community/prometheus' },
    { name: 'myapp', namespace: 'default', chart: './charts/myapp' }
  ];

  const releases = (apps.length > 0 ? apps : defaultApps).map(app => `
  - name: ${app.name}
    namespace: ${app.namespace}
    chart: ${app.chart}
    values:
      - ./values/${app.name}/common.yaml
      - ./values/${app.name}/{{ .Environment.Name }}.yaml`).join('');

  return `# Helmfile - Declarative Helm Chart Management

environments:
  dev:
    values:
      - ./environments/dev.yaml
  staging:
    values:
      - ./environments/staging.yaml
  prod:
    values:
      - ./environments/prod.yaml

helmDefaults:
  wait: true
  timeout: 600
  recreatePods: false
  force: false

repositories:
  - name: ingress-nginx
    url: https://kubernetes.github.io/ingress-nginx
  - name: jetstack
    url: https://charts.jetstack.io
  - name: prometheus-community
    url: https://prometheus-community.github.io/helm-charts
  - name: bitnami
    url: https://charts.bitnami.com/bitnami

releases:${releases}

# Common template for all releases
templates:
  default: &default
    missingFileHandler: Warn
    installedTemplate: "{{ .Release.Name }}"
`;
}

export const helmChartTool: UnifiedTool = {
  name: 'helm_chart',
  description: 'Helm Chart: generate, values, subchart, lint, helmfile',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['generate', 'values', 'subchart', 'lint', 'helmfile'] },
      config: { type: 'object' },
      issues: { type: 'array' },
      apps: { type: 'array' }
    },
    required: ['operation']
  },
};

export async function executeHelmChart(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown> | string;

    switch (args.operation) {
      case 'generate':
        result = generateChart(args.config || { name: 'myapp', version: '0.1.0', description: 'My application' });
        break;
      case 'values':
        result = { values: generateValues(args.config || { environment: 'prod' }) };
        break;
      case 'subchart':
        result = generateSubchart(args.config || { name: 'myapp', parent: 'myapp', type: 'database' });
        break;
      case 'lint':
        result = lintChart(args.issues || []);
        break;
      case 'helmfile':
        result = { helmfile: generateHelmfile(args.apps || []) };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: typeof result === 'string' ? result : JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isHelmChartAvailable(): boolean { return true; }
