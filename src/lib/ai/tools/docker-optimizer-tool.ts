/**
 * DOCKER OPTIMIZER TOOL
 * Optimize Dockerfiles and analyze container configurations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface DockerIssue {
  severity: 'high' | 'medium' | 'low';
  rule: string;
  description: string;
  line?: number;
  suggestion?: string;
}

function analyzeDockerfile(dockerfile: string): DockerIssue[] {
  const issues: DockerIssue[] = [];
  const lines = dockerfile.split('\n');

  // Check for latest tag
  if (dockerfile.match(/FROM\s+\w+:latest/i) || dockerfile.match(/FROM\s+\w+\s*$/im)) {
    issues.push({
      severity: 'high',
      rule: 'DL3007',
      description: 'Using latest tag - pins to non-deterministic version',
      suggestion: 'FROM node:18.17.0-alpine'
    });
  }

  // Check for root user
  if (!dockerfile.includes('USER ') || dockerfile.match(/USER\s+root/i)) {
    issues.push({
      severity: 'high',
      rule: 'DL3002',
      description: 'Running as root user',
      suggestion: 'Add USER nonroot or USER 1000:1000'
    });
  }

  // Check for COPY vs ADD
  if (dockerfile.includes('ADD ') && !dockerfile.match(/ADD\s+https?:/)) {
    issues.push({
      severity: 'medium',
      rule: 'DL3010',
      description: 'Using ADD for local files - COPY is preferred',
      suggestion: 'Use COPY instead of ADD for local files'
    });
  }

  // Check for apt-get
  if (dockerfile.match(/apt-get\s+install/i) && !dockerfile.includes('--no-install-recommends')) {
    issues.push({
      severity: 'medium',
      rule: 'DL3015',
      description: 'apt-get install without --no-install-recommends',
      suggestion: 'RUN apt-get install --no-install-recommends -y package'
    });
  }

  // Check for cleanup
  if (dockerfile.match(/apt-get\s+install/i) && !dockerfile.includes('rm -rf /var/lib/apt/lists')) {
    issues.push({
      severity: 'medium',
      rule: 'DL3009',
      description: 'apt cache not cleaned - increases image size',
      suggestion: 'Add && rm -rf /var/lib/apt/lists/* after apt-get'
    });
  }

  // Check for pip with --no-cache-dir
  if (dockerfile.match(/pip\s+install/i) && !dockerfile.includes('--no-cache-dir')) {
    issues.push({
      severity: 'medium',
      rule: 'DL3042',
      description: 'pip install without --no-cache-dir',
      suggestion: 'RUN pip install --no-cache-dir package'
    });
  }

  // Check for npm ci vs npm install
  if (dockerfile.includes('npm install') && !dockerfile.includes('npm ci')) {
    issues.push({
      severity: 'low',
      rule: 'DL3016',
      description: 'Using npm install instead of npm ci',
      suggestion: 'Use npm ci for reproducible builds'
    });
  }

  // Check for multi-stage builds potential
  if (!dockerfile.includes('AS ') && dockerfile.match(/RUN\s+.*build/i)) {
    issues.push({
      severity: 'medium',
      rule: 'DL3006',
      description: 'Consider multi-stage build for smaller final image',
      suggestion: 'Use FROM base AS builder, then FROM base AS final'
    });
  }

  // Check for HEALTHCHECK
  if (!dockerfile.includes('HEALTHCHECK')) {
    issues.push({
      severity: 'low',
      rule: 'DL3025',
      description: 'No HEALTHCHECK instruction',
      suggestion: 'HEALTHCHECK CMD curl -f http://localhost/ || exit 1'
    });
  }

  // Check for multiple RUN commands that could be combined
  const runCommands = lines.filter(l => l.trim().startsWith('RUN ')).length;
  if (runCommands > 5) {
    issues.push({
      severity: 'medium',
      rule: 'DL3003',
      description: `${runCommands} RUN commands - consider combining to reduce layers`,
      suggestion: 'Combine related RUN commands with &&'
    });
  }

  return issues;
}

function optimizeDockerfile(dockerfile: string): string {
  let optimized = dockerfile;

  // Add --no-install-recommends to apt-get
  optimized = optimized.replace(
    /apt-get install(?!\s+--no-install-recommends)/g,
    'apt-get install --no-install-recommends'
  );

  // Add cache cleanup after apt-get
  optimized = optimized.replace(
    /(apt-get install[^\n]+)(?!\s*&&\s*rm)/g,
    '$1 \\\n    && rm -rf /var/lib/apt/lists/*'
  );

  // Add --no-cache-dir to pip
  optimized = optimized.replace(
    /pip install(?!\s+--no-cache-dir)/g,
    'pip install --no-cache-dir'
  );

  // Replace npm install with npm ci
  optimized = optimized.replace(/npm install(?!\s+--)/g, 'npm ci');

  return optimized;
}

function generateDockerfile(config: {
  baseImage: string;
  workdir?: string;
  copyFiles?: string[];
  installDeps?: string;
  buildCmd?: string;
  exposePort?: number;
  cmd?: string[];
  env?: Record<string, string>;
  multiStage?: boolean;
}): string {
  const {
    baseImage,
    workdir = '/app',
    copyFiles = ['package*.json', '.'],
    installDeps = 'npm ci --only=production',
    buildCmd,
    exposePort = 3000,
    cmd = ['node', 'index.js'],
    env = {},
    multiStage = false
  } = config;

  const envLines = Object.entries(env).map(([k, v]) => `ENV ${k}=${v}`).join('\n');

  if (multiStage) {
    return `# Build stage
FROM ${baseImage} AS builder
WORKDIR ${workdir}

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
${buildCmd ? `RUN ${buildCmd}` : ''}

# Production stage
FROM ${baseImage}-slim AS production
WORKDIR ${workdir}

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \\
    adduser --system --uid 1001 appuser

# Copy built assets
COPY --from=builder --chown=appuser:nodejs ${workdir}/dist ./dist
COPY --from=builder --chown=appuser:nodejs ${workdir}/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs ${workdir}/package.json ./

${envLines}

USER appuser
EXPOSE ${exposePort}

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:${exposePort}/health || exit 1

CMD ${JSON.stringify(cmd)}`;
  }

  return `FROM ${baseImage}
WORKDIR ${workdir}

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \\
    adduser --system --uid 1001 appuser

# Install dependencies
${copyFiles.slice(0, -1).map(f => `COPY ${f} ./`).join('\n')}
RUN ${installDeps}

# Copy application
COPY --chown=appuser:nodejs ${copyFiles[copyFiles.length - 1]} .

${envLines}

USER appuser
EXPOSE ${exposePort}

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD curl -f http://localhost:${exposePort}/health || exit 1

CMD ${JSON.stringify(cmd)}`;
}

function estimateImageSize(dockerfile: string): Record<string, unknown> {
  const baseImages: Record<string, number> = {
    'alpine': 5,
    'node:alpine': 120,
    'node:slim': 200,
    'node:': 900,
    'python:alpine': 50,
    'python:slim': 150,
    'python:': 900,
    'nginx:alpine': 25,
    'nginx:': 140,
    'ubuntu': 75,
    'debian:slim': 80,
    'debian': 120,
    'golang': 800,
    'golang:alpine': 300
  };

  let estimatedSize = 100; // default

  for (const [image, size] of Object.entries(baseImages)) {
    if (dockerfile.toLowerCase().includes(image.toLowerCase())) {
      estimatedSize = size;
      break;
    }
  }

  // Add for layers
  const layers = (dockerfile.match(/^(?:RUN|COPY|ADD)\s/gm) || []).length;
  estimatedSize += layers * 10;

  // Add for dependencies
  if (dockerfile.includes('npm install') || dockerfile.includes('npm ci')) estimatedSize += 100;
  if (dockerfile.includes('pip install')) estimatedSize += 50;
  if (dockerfile.includes('apt-get install')) estimatedSize += 50;

  const isMultiStage = dockerfile.includes(' AS ');

  return {
    estimatedSizeMB: isMultiStage ? Math.round(estimatedSize * 0.4) : estimatedSize,
    layers,
    isMultiStage,
    recommendations: [
      !dockerfile.includes('alpine') ? 'Consider using alpine-based image' : null,
      !isMultiStage ? 'Multi-stage build could reduce size by 40-60%' : null,
      layers > 10 ? 'Combine RUN commands to reduce layers' : null
    ].filter(Boolean)
  };
}

function generateDockerCompose(services: Array<{
  name: string;
  image?: string;
  build?: string;
  ports?: string[];
  environment?: Record<string, string>;
  volumes?: string[];
  depends_on?: string[];
}>): string {
  let compose = `version: '3.8'

services:
`;

  for (const service of services) {
    compose += `  ${service.name}:\n`;
    if (service.build) compose += `    build: ${service.build}\n`;
    if (service.image) compose += `    image: ${service.image}\n`;
    if (service.ports?.length) {
      compose += `    ports:\n`;
      service.ports.forEach(p => compose += `      - "${p}"\n`);
    }
    if (service.environment && Object.keys(service.environment).length) {
      compose += `    environment:\n`;
      Object.entries(service.environment).forEach(([k, v]) =>
        compose += `      ${k}: ${v}\n`
      );
    }
    if (service.volumes?.length) {
      compose += `    volumes:\n`;
      service.volumes.forEach(v => compose += `      - ${v}\n`);
    }
    if (service.depends_on?.length) {
      compose += `    depends_on:\n`;
      service.depends_on.forEach(d => compose += `      - ${d}\n`);
    }
    compose += '\n';
  }

  return compose;
}

export const dockerOptimizerTool: UnifiedTool = {
  name: 'docker_optimizer',
  description: 'Docker Optimizer: analyze, optimize, generate, estimate_size, compose',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['analyze', 'optimize', 'generate', 'estimate_size', 'compose'] },
      dockerfile: { type: 'string' },
      baseImage: { type: 'string' },
      workdir: { type: 'string' },
      exposePort: { type: 'number' },
      cmd: { type: 'array' },
      multiStage: { type: 'boolean' },
      services: { type: 'array' }
    },
    required: ['operation']
  },
};

export async function executeDockerOptimizer(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;

    const sampleDockerfile = `FROM node:latest
WORKDIR /app
ADD . .
RUN npm install
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]`;

    let result: Record<string, unknown> | string;

    switch (args.operation) {
      case 'analyze':
        result = { issues: analyzeDockerfile(args.dockerfile || sampleDockerfile) };
        break;
      case 'optimize':
        result = { optimized: optimizeDockerfile(args.dockerfile || sampleDockerfile) };
        break;
      case 'generate':
        result = { dockerfile: generateDockerfile({
          baseImage: args.baseImage || 'node:18-alpine',
          workdir: args.workdir,
          exposePort: args.exposePort,
          cmd: args.cmd,
          multiStage: args.multiStage,
          env: args.env
        })};
        break;
      case 'estimate_size':
        result = estimateImageSize(args.dockerfile || sampleDockerfile);
        break;
      case 'compose':
        result = { compose: generateDockerCompose(args.services || [
          { name: 'web', build: '.', ports: ['3000:3000'], depends_on: ['db'] },
          { name: 'db', image: 'postgres:14-alpine', environment: { POSTGRES_DB: 'app' }, volumes: ['pgdata:/var/lib/postgresql/data'] }
        ])};
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: typeof result === 'string' ? result : JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isDockerOptimizerAvailable(): boolean { return true; }
