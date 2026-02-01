/**
 * CI/CD GENERATOR TOOL
 * Generate CI/CD pipelines for GitHub Actions, GitLab CI, etc.
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function generateGitHubActions(config: {
  name?: string;
  triggers?: string[];
  nodeVersion?: string;
  steps?: string[];
  services?: string[];
  env?: Record<string, string>;
  secrets?: string[];
}): string {
  const {
    name = 'CI',
    triggers = ['push', 'pull_request'],
    nodeVersion = '18',
    steps = ['install', 'lint', 'test', 'build'],
    services = [],
    env = {},
    secrets = []
  } = config;

  const triggerYaml = triggers.map(t => {
    if (t === 'push') return `  push:\n    branches: [main, master]`;
    if (t === 'pull_request') return `  pull_request:\n    branches: [main, master]`;
    if (t === 'schedule') return `  schedule:\n    - cron: '0 0 * * *'`;
    return `  ${t}:`;
  }).join('\n');

  const envYaml = Object.entries(env).map(([k, v]) => `      ${k}: ${v}`).join('\n');
  const secretsYaml = secrets.map(s => `      ${s}: \${{ secrets.${s} }}`).join('\n');

  const servicesYaml = services.includes('postgres') ? `
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5` : '';

  const stepsYaml = steps.map(step => {
    switch (step) {
      case 'install':
        return `      - name: Install dependencies
        run: npm ci`;
      case 'lint':
        return `      - name: Lint
        run: npm run lint`;
      case 'test':
        return `      - name: Test
        run: npm test`;
      case 'build':
        return `      - name: Build
        run: npm run build`;
      case 'typecheck':
        return `      - name: Type check
        run: npm run typecheck`;
      case 'e2e':
        return `      - name: E2E Tests
        run: npm run test:e2e`;
      case 'coverage':
        return `      - name: Coverage
        run: npm run test:coverage`;
      case 'docker':
        return `      - name: Build Docker image
        run: docker build -t app:\${{ github.sha }} .`;
      default:
        return `      - name: ${step}\n        run: npm run ${step}`;
    }
  }).join('\n\n');

  return `name: ${name}

on:
${triggerYaml}

jobs:
  build:
    runs-on: ubuntu-latest
${servicesYaml}
${envYaml || secretsYaml ? `    env:\n${envYaml}\n${secretsYaml}` : ''}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '${nodeVersion}'
          cache: 'npm'

${stepsYaml}`;
}

function generateGitLabCI(config: {
  stages?: string[];
  nodeVersion?: string;
  variables?: Record<string, string>;
  services?: string[];
}): string {
  const {
    stages = ['install', 'lint', 'test', 'build', 'deploy'],
    nodeVersion = '18',
    variables = {},
    services = []
  } = config;

  const variablesYaml = Object.entries(variables).map(([k, v]) =>
    `  ${k}: ${v}`
  ).join('\n');

  const servicesYaml = services.length > 0
    ? `services:\n${services.map(s => `  - ${s}`).join('\n')}\n`
    : '';

  return `image: node:${nodeVersion}

stages:
${stages.map(s => `  - ${s}`).join('\n')}

${variablesYaml ? `variables:\n${variablesYaml}\n` : ''}
${servicesYaml}
cache:
  paths:
    - node_modules/

install:
  stage: install
  script:
    - npm ci
  artifacts:
    paths:
      - node_modules/

lint:
  stage: lint
  script:
    - npm run lint

test:
  stage: test
  script:
    - npm test
  coverage: '/Coverage: \\d+\\.\\d+%/'

build:
  stage: build
  script:
    - npm run build
  artifacts:
    paths:
      - dist/

deploy:
  stage: deploy
  script:
    - echo "Deploying..."
  only:
    - main
  environment:
    name: production`;
}

function generateCircleCI(config: {
  nodeVersion?: string;
  steps?: string[];
}): string {
  const { nodeVersion = '18', steps = ['install', 'lint', 'test', 'build'] } = config;

  const stepsYaml = steps.map(step => {
    switch (step) {
      case 'install': return '      - run: npm ci';
      case 'lint': return '      - run: npm run lint';
      case 'test': return '      - run: npm test';
      case 'build': return '      - run: npm run build';
      default: return `      - run: npm run ${step}`;
    }
  }).join('\n');

  return `version: 2.1

executors:
  node-executor:
    docker:
      - image: cimg/node:${nodeVersion}

jobs:
  build:
    executor: node-executor
    steps:
      - checkout
      - restore_cache:
          keys:
            - v1-deps-{{ checksum "package-lock.json" }}
${stepsYaml}
      - save_cache:
          paths:
            - node_modules
          key: v1-deps-{{ checksum "package-lock.json" }}

workflows:
  build-and-test:
    jobs:
      - build`;
}

function generateJenkinsfile(config: {
  stages?: string[];
  agent?: string;
  nodeVersion?: string;
}): string {
  const { stages = ['Install', 'Lint', 'Test', 'Build'], agent = 'any', nodeVersion = '18' } = config;

  const stagesGroovy = stages.map(stage => {
    const cmd = stage.toLowerCase();
    return `        stage('${stage}') {
            steps {
                sh 'npm ${cmd === 'install' ? 'ci' : `run ${cmd}`}'
            }
        }`;
  }).join('\n');

  return `pipeline {
    agent ${agent}

    tools {
        nodejs 'Node ${nodeVersion}'
    }

    stages {
${stagesGroovy}
    }

    post {
        always {
            cleanWs()
        }
        success {
            echo 'Build succeeded!'
        }
        failure {
            echo 'Build failed!'
        }
    }
}`;
}

function generateDeploymentWorkflow(config: {
  platform: 'vercel' | 'netlify' | 'aws' | 'gcp' | 'azure';
  branch?: string;
}): string {
  const { platform, branch = 'main' } = config;

  const deploySteps: Record<string, string> = {
    vercel: `      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: \${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: \${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: \${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'`,
    netlify: `      - name: Deploy to Netlify
        uses: nwtgck/actions-netlify@v2
        with:
          publish-dir: './dist'
          production-branch: ${branch}
          github-token: \${{ secrets.GITHUB_TOKEN }}
          deploy-message: "Deploy from GitHub Actions"
        env:
          NETLIFY_AUTH_TOKEN: \${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: \${{ secrets.NETLIFY_SITE_ID }}`,
    aws: `      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: \${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Deploy to S3
        run: aws s3 sync ./dist s3://\${{ secrets.S3_BUCKET }} --delete

      - name: Invalidate CloudFront
        run: aws cloudfront create-invalidation --distribution-id \${{ secrets.CF_DISTRIBUTION_ID }} --paths "/*"`,
    gcp: `      - name: Authenticate to GCP
        uses: google-github-actions/auth@v2
        with:
          credentials_json: \${{ secrets.GCP_CREDENTIALS }}

      - name: Deploy to Cloud Run
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: my-service
          region: us-central1
          source: .`,
    azure: `      - name: Azure Login
        uses: azure/login@v1
        with:
          creds: \${{ secrets.AZURE_CREDENTIALS }}

      - name: Deploy to Azure Web App
        uses: azure/webapps-deploy@v2
        with:
          app-name: my-app
          package: ./dist`
  };

  return `name: Deploy

on:
  push:
    branches: [${branch}]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

${deploySteps[platform]}`;
}

export const ciCdGeneratorTool: UnifiedTool = {
  name: 'ci_cd_generator',
  description: 'CI/CD Generator: github_actions, gitlab_ci, circleci, jenkins, deploy_workflow',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['github_actions', 'gitlab_ci', 'circleci', 'jenkins', 'deploy_workflow'] },
      name: { type: 'string' },
      triggers: { type: 'array' },
      stages: { type: 'array' },
      steps: { type: 'array' },
      nodeVersion: { type: 'string' },
      services: { type: 'array' },
      platform: { type: 'string' },
      env: { type: 'object' },
      variables: { type: 'object' }
    },
    required: ['operation']
  },
};

export async function executeCiCdGenerator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: string;

    switch (args.operation) {
      case 'github_actions':
        result = generateGitHubActions(args);
        break;
      case 'gitlab_ci':
        result = generateGitLabCI(args);
        break;
      case 'circleci':
        result = generateCircleCI(args);
        break;
      case 'jenkins':
        result = generateJenkinsfile(args);
        break;
      case 'deploy_workflow':
        result = generateDeploymentWorkflow({
          platform: args.platform || 'vercel',
          branch: args.branch
        });
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: result };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isCiCdGeneratorAvailable(): boolean { return true; }
