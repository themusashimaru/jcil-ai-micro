/**
 * ONE-CLICK CI/CD GENERATOR
 *
 * Automatically generate deployment pipelines from your project.
 *
 * Features:
 * - GitHub Actions workflow generation
 * - GitLab CI/CD pipeline generation
 * - Vercel/Netlify deployment configs
 * - Docker/Kubernetes manifests
 * - Auto-detect project type and dependencies
 * - Security scanning integration
 * - Test automation integration
 * - Multi-environment support (dev, staging, prod)
 */

import Anthropic from '@anthropic-ai/sdk';

// ============================================
// TYPES
// ============================================

export type CICDProvider = 'github-actions' | 'gitlab-ci' | 'circleci' | 'jenkins' | 'azure-devops';
export type DeploymentTarget = 'vercel' | 'netlify' | 'aws' | 'gcp' | 'azure' | 'heroku' | 'docker' | 'kubernetes';
export type ProjectType = 'nextjs' | 'react' | 'vue' | 'angular' | 'node' | 'python' | 'go' | 'rust' | 'java' | 'dotnet';

export interface ProjectAnalysis {
  type: ProjectType;
  framework?: string;
  language: string;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'pip' | 'cargo' | 'go' | 'maven' | 'gradle';
  hasTests: boolean;
  hasLinting: boolean;
  hasTypeScript: boolean;
  hasDocker: boolean;
  dependencies: string[];
  devDependencies: string[];
  scripts: Record<string, string>;
  envVars: string[];
}

export interface CICDConfig {
  provider: CICDProvider;
  fileName: string;
  content: string;
  description: string;
}

export interface DeploymentConfig {
  target: DeploymentTarget;
  fileName: string;
  content: string;
  description: string;
  envVars: EnvVar[];
}

export interface EnvVar {
  name: string;
  description: string;
  required: boolean;
  secret: boolean;
  example?: string;
}

export interface GeneratedPipeline {
  cicd: CICDConfig;
  deployment?: DeploymentConfig;
  docker?: DockerConfig;
  kubernetes?: KubernetesConfig;
  additionalFiles: AdditionalFile[];
  setupInstructions: string[];
  estimatedBuildTime: string;
}

export interface DockerConfig {
  dockerfile: string;
  dockerCompose?: string;
  dockerIgnore: string;
}

export interface KubernetesConfig {
  deployment: string;
  service: string;
  ingress?: string;
  configMap?: string;
  secrets?: string;
}

export interface AdditionalFile {
  path: string;
  content: string;
  description: string;
}

// ============================================
// CI/CD GENERATOR CLASS
// ============================================

export class CICDGenerator {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic();
  }

  /**
   * Analyze a project and generate appropriate CI/CD configuration
   */
  async generatePipeline(
    projectFiles: Array<{ path: string; content: string }>,
    options: {
      provider?: CICDProvider;
      deployTarget?: DeploymentTarget;
      includeDocker?: boolean;
      includeK8s?: boolean;
      environments?: string[];
    } = {}
  ): Promise<GeneratedPipeline> {
    // Analyze the project
    const analysis = await this.analyzeProject(projectFiles);

    // Determine best provider if not specified
    const provider = options.provider || 'github-actions';
    const deployTarget = options.deployTarget || this.suggestDeployTarget(analysis);
    const environments = options.environments || ['staging', 'production'];

    // Generate CI/CD config
    const cicd = await this.generateCICDConfig(analysis, provider, environments);

    // Generate deployment config
    const deployment = deployTarget
      ? await this.generateDeploymentConfig(analysis, deployTarget)
      : undefined;

    // Generate Docker config if requested or detected
    const docker = (options.includeDocker || analysis.hasDocker)
      ? await this.generateDockerConfig(analysis)
      : undefined;

    // Generate Kubernetes config if requested
    const kubernetes = options.includeK8s
      ? await this.generateK8sConfig(analysis)
      : undefined;

    // Generate additional files
    const additionalFiles = this.generateAdditionalFiles(analysis, provider);

    // Setup instructions
    const setupInstructions = this.generateSetupInstructions(
      analysis,
      provider,
      deployTarget,
      options.includeDocker,
      options.includeK8s
    );

    return {
      cicd,
      deployment,
      docker,
      kubernetes,
      additionalFiles,
      setupInstructions,
      estimatedBuildTime: this.estimateBuildTime(analysis),
    };
  }

  /**
   * Analyze project structure and dependencies
   */
  private async analyzeProject(
    files: Array<{ path: string; content: string }>
  ): Promise<ProjectAnalysis> {
    // Find package.json or similar
    const packageJson = files.find(f => f.path.endsWith('package.json'));
    const pyProject = files.find(f => f.path.endsWith('pyproject.toml') || f.path.endsWith('requirements.txt'));
    const cargoToml = files.find(f => f.path.endsWith('Cargo.toml'));
    const goMod = files.find(f => f.path.endsWith('go.mod'));
    const pomXml = files.find(f => f.path.endsWith('pom.xml'));

    const analysis: ProjectAnalysis = {
      type: 'node',
      language: 'javascript',
      packageManager: 'npm',
      hasTests: false,
      hasLinting: false,
      hasTypeScript: false,
      hasDocker: files.some(f => f.path.includes('Dockerfile')),
      dependencies: [],
      devDependencies: [],
      scripts: {},
      envVars: [],
    };

    if (packageJson) {
      try {
        const pkg = JSON.parse(packageJson.content);

        // Detect framework
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        if (deps.next) {
          analysis.type = 'nextjs';
          analysis.framework = 'Next.js';
        } else if (deps.react) {
          analysis.type = 'react';
          analysis.framework = 'React';
        } else if (deps.vue) {
          analysis.type = 'vue';
          analysis.framework = 'Vue';
        } else if (deps['@angular/core']) {
          analysis.type = 'angular';
          analysis.framework = 'Angular';
        }

        analysis.hasTypeScript = !!deps.typescript;
        analysis.hasTests = !!(deps.jest || deps.vitest || deps.mocha);
        analysis.hasLinting = !!(deps.eslint || deps.prettier);
        analysis.dependencies = Object.keys(pkg.dependencies || {});
        analysis.devDependencies = Object.keys(pkg.devDependencies || {});
        analysis.scripts = pkg.scripts || {};

        // Detect package manager
        if (files.some(f => f.path.includes('pnpm-lock.yaml'))) {
          analysis.packageManager = 'pnpm';
        } else if (files.some(f => f.path.includes('yarn.lock'))) {
          analysis.packageManager = 'yarn';
        }
      } catch {
        // Keep defaults
      }
    } else if (pyProject) {
      analysis.type = 'python';
      analysis.language = 'python';
      analysis.packageManager = 'pip';
    } else if (cargoToml) {
      analysis.type = 'rust';
      analysis.language = 'rust';
      analysis.packageManager = 'cargo';
    } else if (goMod) {
      analysis.type = 'go';
      analysis.language = 'go';
      analysis.packageManager = 'go';
    } else if (pomXml) {
      analysis.type = 'java';
      analysis.language = 'java';
      analysis.packageManager = 'maven';
    }

    // Detect environment variables from .env.example or code
    const envExample = files.find(f => f.path.includes('.env.example') || f.path.includes('.env.sample'));
    if (envExample) {
      const envMatches = envExample.content.match(/^[A-Z][A-Z0-9_]*/gm);
      if (envMatches) {
        analysis.envVars = [...new Set(envMatches)];
      }
    }

    return analysis;
  }

  /**
   * Generate CI/CD configuration
   */
  private async generateCICDConfig(
    analysis: ProjectAnalysis,
    provider: CICDProvider,
    environments: string[]
  ): Promise<CICDConfig> {
    const templates: Record<CICDProvider, () => CICDConfig> = {
      'github-actions': () => this.generateGitHubActions(analysis, environments),
      'gitlab-ci': () => this.generateGitLabCI(analysis, environments),
      'circleci': () => this.generateCircleCI(analysis),
      'jenkins': () => this.generateJenkinsfile(analysis),
      'azure-devops': () => this.generateAzurePipelines(analysis),
    };

    return templates[provider]();
  }

  /**
   * Generate GitHub Actions workflow
   */
  private generateGitHubActions(
    analysis: ProjectAnalysis,
    environments: string[]
  ): CICDConfig {
    const installCmd = {
      npm: 'npm ci',
      yarn: 'yarn install --frozen-lockfile',
      pnpm: 'pnpm install --frozen-lockfile',
    }[analysis.packageManager] || 'npm ci';

    const buildCmd = analysis.scripts.build ? `${analysis.packageManager} run build` : '';
    const testCmd = analysis.scripts.test ? `${analysis.packageManager} run test` : '';
    const lintCmd = analysis.scripts.lint ? `${analysis.packageManager} run lint` : '';

    const workflow = `name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'
${analysis.envVars.map(v => `  # ${v}: \${{ secrets.${v} }}`).join('\n')}

jobs:
  # ============================================
  # QUALITY CHECKS
  # ============================================
  quality:
    name: Code Quality
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: '${analysis.packageManager}'

      - name: Install dependencies
        run: ${installCmd}

${lintCmd ? `      - name: Lint
        run: ${lintCmd}

` : ''}${analysis.hasTypeScript ? `      - name: Type check
        run: ${analysis.packageManager} run type-check || ${analysis.packageManager} run tsc --noEmit

` : ''}  # ============================================
  # TESTING
  # ============================================
${testCmd ? `  test:
    name: Tests
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: '${analysis.packageManager}'

      - name: Install dependencies
        run: ${installCmd}

      - name: Run tests
        run: ${testCmd}
        env:
          CI: true

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        if: always()

` : ''}  # ============================================
  # BUILD
  # ============================================
  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [quality${testCmd ? ', test' : ''}]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: \${{ env.NODE_VERSION }}
          cache: '${analysis.packageManager}'

      - name: Install dependencies
        run: ${installCmd}

${buildCmd ? `      - name: Build
        run: ${buildCmd}
        env:
          NODE_ENV: production

` : ''}      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build
          path: ${analysis.type === 'nextjs' ? '.next' : 'dist'}
          retention-days: 7

  # ============================================
  # SECURITY SCAN
  # ============================================
  security:
    name: Security Scan
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run security audit
        run: ${analysis.packageManager} audit --audit-level=high || true

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        continue-on-error: true
        env:
          SNYK_TOKEN: \${{ secrets.SNYK_TOKEN }}

${environments.includes('staging') ? `  # ============================================
  # DEPLOY STAGING
  # ============================================
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: [build, security]
    if: github.ref == 'refs/heads/develop'
    environment:
      name: staging
      url: \${{ steps.deploy.outputs.url }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: build
          path: ${analysis.type === 'nextjs' ? '.next' : 'dist'}

      - name: Deploy to staging
        id: deploy
        run: echo "Deploying to staging..."
        # Add your deployment commands here

` : ''}${environments.includes('production') ? `  # ============================================
  # DEPLOY PRODUCTION
  # ============================================
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [build, security${environments.includes('staging') ? ', deploy-staging' : ''}]
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
      url: \${{ steps.deploy.outputs.url }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: build
          path: ${analysis.type === 'nextjs' ? '.next' : 'dist'}

      - name: Deploy to production
        id: deploy
        run: echo "Deploying to production..."
        # Add your deployment commands here
` : ''}`;

    return {
      provider: 'github-actions',
      fileName: '.github/workflows/ci-cd.yml',
      content: workflow,
      description: 'Complete CI/CD pipeline with quality checks, testing, security scanning, and multi-environment deployment',
    };
  }

  /**
   * Generate GitLab CI configuration
   */
  private generateGitLabCI(analysis: ProjectAnalysis, environments: string[]): CICDConfig {
    const content = `image: node:20

stages:
  - install
  - quality
  - test
  - build
  - security
  - deploy

variables:
  npm_config_cache: "$CI_PROJECT_DIR/.npm"

cache:
  key: \${CI_COMMIT_REF_SLUG}
  paths:
    - .npm/
    - node_modules/

install:
  stage: install
  script:
    - ${analysis.packageManager} install

lint:
  stage: quality
  script:
    - ${analysis.packageManager} run lint

${analysis.hasTests ? `test:
  stage: test
  script:
    - ${analysis.packageManager} run test
  coverage: '/Coverage: \\d+\\.\\d+%/'

` : ''}build:
  stage: build
  script:
    - ${analysis.packageManager} run build
  artifacts:
    paths:
      - ${analysis.type === 'nextjs' ? '.next/' : 'dist/'}
    expire_in: 1 week

security_scan:
  stage: security
  script:
    - ${analysis.packageManager} audit --audit-level=high || true

${environments.map(env => `deploy_${env}:
  stage: deploy
  environment:
    name: ${env}
  script:
    - echo "Deploying to ${env}..."
  ${env === 'production' ? 'when: manual' : ''}
  only:
    - ${env === 'production' ? 'main' : 'develop'}
`).join('\n')}`;

    return {
      provider: 'gitlab-ci',
      fileName: '.gitlab-ci.yml',
      content,
      description: 'GitLab CI/CD pipeline configuration',
    };
  }

  /**
   * Generate CircleCI configuration
   */
  private generateCircleCI(analysis: ProjectAnalysis): CICDConfig {
    const content = `version: 2.1

orbs:
  node: circleci/node@5.0

jobs:
  build-and-test:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - node/install-packages:
          pkg-manager: ${analysis.packageManager}
      - run:
          name: Lint
          command: ${analysis.packageManager} run lint
      - run:
          name: Test
          command: ${analysis.packageManager} run test
      - run:
          name: Build
          command: ${analysis.packageManager} run build
      - persist_to_workspace:
          root: .
          paths:
            - ${analysis.type === 'nextjs' ? '.next' : 'dist'}

  deploy:
    docker:
      - image: cimg/node:20.0
    steps:
      - attach_workspace:
          at: .
      - run:
          name: Deploy
          command: echo "Deploying..."

workflows:
  build-deploy:
    jobs:
      - build-and-test
      - deploy:
          requires:
            - build-and-test
          filters:
            branches:
              only: main`;

    return {
      provider: 'circleci',
      fileName: '.circleci/config.yml',
      content,
      description: 'CircleCI pipeline configuration',
    };
  }

  /**
   * Generate Jenkinsfile
   */
  private generateJenkinsfile(analysis: ProjectAnalysis): CICDConfig {
    const content = `pipeline {
    agent any

    tools {
        nodejs 'Node-20'
    }

    environment {
        CI = 'true'
    }

    stages {
        stage('Install') {
            steps {
                sh '${analysis.packageManager} install'
            }
        }

        stage('Lint') {
            steps {
                sh '${analysis.packageManager} run lint'
            }
        }

        stage('Test') {
            steps {
                sh '${analysis.packageManager} run test'
            }
            post {
                always {
                    junit '**/test-results.xml'
                }
            }
        }

        stage('Build') {
            steps {
                sh '${analysis.packageManager} run build'
            }
        }

        stage('Security Scan') {
            steps {
                sh '${analysis.packageManager} audit --audit-level=high || true'
            }
        }

        stage('Deploy Staging') {
            when {
                branch 'develop'
            }
            steps {
                echo 'Deploying to staging...'
            }
        }

        stage('Deploy Production') {
            when {
                branch 'main'
            }
            steps {
                input message: 'Deploy to production?'
                echo 'Deploying to production...'
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        failure {
            mail to: 'team@example.com',
                 subject: "Pipeline Failed: \${env.JOB_NAME}",
                 body: "Check console output at \${env.BUILD_URL}"
        }
    }
}`;

    return {
      provider: 'jenkins',
      fileName: 'Jenkinsfile',
      content,
      description: 'Jenkins declarative pipeline',
    };
  }

  /**
   * Generate Azure Pipelines configuration
   */
  private generateAzurePipelines(analysis: ProjectAnalysis): CICDConfig {
    const content = `trigger:
  - main
  - develop

pool:
  vmImage: 'ubuntu-latest'

variables:
  nodeVersion: '20.x'

stages:
  - stage: Build
    jobs:
      - job: BuildJob
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: '\$(nodeVersion)'

          - script: ${analysis.packageManager} install
            displayName: 'Install dependencies'

          - script: ${analysis.packageManager} run lint
            displayName: 'Lint'

          - script: ${analysis.packageManager} run test
            displayName: 'Test'

          - script: ${analysis.packageManager} run build
            displayName: 'Build'

          - task: PublishBuildArtifacts@1
            inputs:
              pathtoPublish: '${analysis.type === 'nextjs' ? '.next' : 'dist'}'
              artifactName: 'build'

  - stage: DeployStaging
    dependsOn: Build
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/develop'))
    jobs:
      - deployment: DeployStaging
        environment: 'staging'
        strategy:
          runOnce:
            deploy:
              steps:
                - script: echo 'Deploying to staging...'

  - stage: DeployProduction
    dependsOn: DeployStaging
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - deployment: DeployProduction
        environment: 'production'
        strategy:
          runOnce:
            deploy:
              steps:
                - script: echo 'Deploying to production...'`;

    return {
      provider: 'azure-devops',
      fileName: 'azure-pipelines.yml',
      content,
      description: 'Azure DevOps pipeline configuration',
    };
  }

  /**
   * Generate deployment configuration
   */
  private async generateDeploymentConfig(
    analysis: ProjectAnalysis,
    target: DeploymentTarget
  ): Promise<DeploymentConfig> {
    const generators: Record<DeploymentTarget, () => DeploymentConfig> = {
      vercel: () => this.generateVercelConfig(analysis),
      netlify: () => this.generateNetlifyConfig(analysis),
      aws: () => this.generateAWSConfig(analysis),
      gcp: () => this.generateGCPConfig(analysis),
      azure: () => this.generateAzureConfig(analysis),
      heroku: () => this.generateHerokuConfig(analysis),
      docker: () => this.generateDockerDeployConfig(analysis),
      kubernetes: () => this.generateK8sDeployConfig(analysis),
    };

    return generators[target]();
  }

  /**
   * Generate Vercel config
   */
  private generateVercelConfig(analysis: ProjectAnalysis): DeploymentConfig {
    const content = JSON.stringify({
      buildCommand: `${analysis.packageManager} run build`,
      outputDirectory: analysis.type === 'nextjs' ? '.next' : 'dist',
      framework: analysis.type === 'nextjs' ? 'nextjs' : null,
      installCommand: `${analysis.packageManager} install`,
    }, null, 2);

    return {
      target: 'vercel',
      fileName: 'vercel.json',
      content,
      description: 'Vercel deployment configuration',
      envVars: analysis.envVars.map(name => ({
        name,
        description: `Environment variable ${name}`,
        required: true,
        secret: name.includes('KEY') || name.includes('SECRET') || name.includes('TOKEN'),
      })),
    };
  }

  /**
   * Generate Netlify config
   */
  private generateNetlifyConfig(analysis: ProjectAnalysis): DeploymentConfig {
    const content = `[build]
  command = "${analysis.packageManager} run build"
  publish = "${analysis.type === 'nextjs' ? '.next' : 'dist'}"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"`;

    return {
      target: 'netlify',
      fileName: 'netlify.toml',
      content,
      description: 'Netlify deployment configuration',
      envVars: analysis.envVars.map(name => ({
        name,
        description: `Environment variable ${name}`,
        required: true,
        secret: name.includes('KEY') || name.includes('SECRET'),
      })),
    };
  }

  // Additional deployment configs...
  private generateAWSConfig(_analysis: ProjectAnalysis): DeploymentConfig {
    return {
      target: 'aws',
      fileName: 'aws-app-runner.yaml',
      content: `# AWS App Runner configuration\nruntime: nodejs20`,
      description: 'AWS deployment configuration',
      envVars: [],
    };
  }

  private generateGCPConfig(_analysis: ProjectAnalysis): DeploymentConfig {
    return {
      target: 'gcp',
      fileName: 'app.yaml',
      content: `runtime: nodejs20\ninstance_class: F2`,
      description: 'Google Cloud Platform deployment configuration',
      envVars: [],
    };
  }

  private generateAzureConfig(_analysis: ProjectAnalysis): DeploymentConfig {
    return {
      target: 'azure',
      fileName: 'azure-webapp.yaml',
      content: `# Azure Web App configuration`,
      description: 'Azure deployment configuration',
      envVars: [],
    };
  }

  private generateHerokuConfig(analysis: ProjectAnalysis): DeploymentConfig {
    return {
      target: 'heroku',
      fileName: 'Procfile',
      content: `web: ${analysis.packageManager} start`,
      description: 'Heroku deployment configuration',
      envVars: [],
    };
  }

  private generateDockerDeployConfig(_analysis: ProjectAnalysis): DeploymentConfig {
    return {
      target: 'docker',
      fileName: 'docker-compose.prod.yml',
      content: `version: '3.8'\nservices:\n  app:\n    build: .\n    ports:\n      - "3000:3000"`,
      description: 'Docker deployment configuration',
      envVars: [],
    };
  }

  private generateK8sDeployConfig(_analysis: ProjectAnalysis): DeploymentConfig {
    return {
      target: 'kubernetes',
      fileName: 'k8s/deployment.yaml',
      content: `apiVersion: apps/v1\nkind: Deployment`,
      description: 'Kubernetes deployment configuration',
      envVars: [],
    };
  }

  /**
   * Generate Docker configuration
   */
  private async generateDockerConfig(analysis: ProjectAnalysis): Promise<DockerConfig> {
    const dockerfile = `# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
${analysis.packageManager === 'pnpm' ? 'RUN npm install -g pnpm\nCOPY pnpm-lock.yaml ./\nRUN pnpm install --frozen-lockfile' : ''}
${analysis.packageManager === 'yarn' ? 'COPY yarn.lock ./\nRUN yarn install --frozen-lockfile' : ''}
${analysis.packageManager === 'npm' ? 'COPY package-lock.json ./\nRUN npm ci' : ''}

# Copy source and build
COPY . .
RUN ${analysis.packageManager} run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

# Copy built files
COPY --from=builder /app/${analysis.type === 'nextjs' ? '.next' : 'dist'} ./${analysis.type === 'nextjs' ? '.next' : 'dist'}
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
${analysis.type === 'nextjs' ? 'COPY --from=builder /app/public ./public' : ''}

USER appuser

EXPOSE 3000
ENV PORT 3000

CMD ["${analysis.packageManager}", "start"]`;

    const dockerIgnore = `node_modules
.git
.gitignore
*.md
.env*
.next
dist
coverage
.DS_Store
*.log`;

    return {
      dockerfile,
      dockerIgnore,
    };
  }

  /**
   * Generate Kubernetes configuration
   */
  private async generateK8sConfig(analysis: ProjectAnalysis): Promise<KubernetesConfig> {
    const deployment = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${analysis.type}-app
  labels:
    app: ${analysis.type}-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ${analysis.type}-app
  template:
    metadata:
      labels:
        app: ${analysis.type}-app
    spec:
      containers:
        - name: app
          image: your-registry/${analysis.type}-app:latest
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: "production"
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5`;

    const service = `apiVersion: v1
kind: Service
metadata:
  name: ${analysis.type}-app-service
spec:
  selector:
    app: ${analysis.type}-app
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: LoadBalancer`;

    const ingress = `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${analysis.type}-app-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - your-domain.com
      secretName: ${analysis.type}-app-tls
  rules:
    - host: your-domain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ${analysis.type}-app-service
                port:
                  number: 80`;

    return {
      deployment,
      service,
      ingress,
    };
  }

  /**
   * Suggest deployment target based on project
   */
  private suggestDeployTarget(analysis: ProjectAnalysis): DeploymentTarget {
    if (analysis.type === 'nextjs') return 'vercel';
    if (analysis.type === 'react' || analysis.type === 'vue') return 'netlify';
    return 'docker';
  }

  /**
   * Generate additional helpful files
   */
  private generateAdditionalFiles(
    analysis: ProjectAnalysis,
    _provider: CICDProvider
  ): AdditionalFile[] {
    const files: AdditionalFile[] = [];

    // .nvmrc
    files.push({
      path: '.nvmrc',
      content: '20',
      description: 'Node version specification',
    });

    // .env.example
    if (analysis.envVars.length > 0) {
      files.push({
        path: '.env.example',
        content: analysis.envVars.map(v => `${v}=`).join('\n'),
        description: 'Environment variables template',
      });
    }

    return files;
  }

  /**
   * Generate setup instructions
   */
  private generateSetupInstructions(
    analysis: ProjectAnalysis,
    provider: CICDProvider,
    deployTarget?: DeploymentTarget,
    includeDocker?: boolean,
    includeK8s?: boolean
  ): string[] {
    const instructions: string[] = [];

    instructions.push(`1. Copy the generated ${provider} configuration to your repository`);

    if (analysis.envVars.length > 0) {
      instructions.push(`2. Set up the following secrets in your ${provider} settings: ${analysis.envVars.join(', ')}`);
    }

    if (deployTarget) {
      instructions.push(`3. Configure ${deployTarget} deployment credentials`);
    }

    if (includeDocker) {
      instructions.push('4. Build Docker image: docker build -t your-app .');
    }

    if (includeK8s) {
      instructions.push('5. Apply Kubernetes manifests: kubectl apply -f k8s/');
    }

    instructions.push('6. Push to trigger the pipeline');

    return instructions;
  }

  /**
   * Estimate build time
   */
  private estimateBuildTime(analysis: ProjectAnalysis): string {
    let minutes = 2; // Base time

    if (analysis.hasTests) minutes += 2;
    if (analysis.hasTypeScript) minutes += 1;
    if (analysis.dependencies.length > 50) minutes += 2;
    if (analysis.type === 'nextjs') minutes += 2;

    return `~${minutes}-${minutes + 2} minutes`;
  }
}

// ============================================
// EXPORTS
// ============================================

export const cicdGenerator = new CICDGenerator();

/**
 * Quick function to generate CI/CD pipeline
 */
export async function generateCICD(
  projectFiles: Array<{ path: string; content: string }>,
  options?: {
    provider?: CICDProvider;
    deployTarget?: DeploymentTarget;
  }
): Promise<GeneratedPipeline> {
  return cicdGenerator.generatePipeline(projectFiles, options);
}
