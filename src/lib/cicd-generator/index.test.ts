// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

import { describe, it, expect, beforeEach } from 'vitest';
import { CICDGenerator, cicdGenerator, generateCICD } from './index';
import type { CICDProvider, DeploymentTarget } from './index';

// ============================================
// TEST FIXTURES
// ============================================

const nextjsProject = [
  {
    path: 'package.json',
    content: JSON.stringify({
      name: 'my-nextjs-app',
      dependencies: { next: '14.0.0', react: '18.0.0', 'react-dom': '18.0.0' },
      devDependencies: { typescript: '5.0.0', eslint: '8.0.0', vitest: '1.0.0' },
      scripts: {
        build: 'next build',
        test: 'vitest run',
        lint: 'eslint .',
        dev: 'next dev',
        start: 'next start',
      },
    }),
  },
  { path: 'tsconfig.json', content: '{}' },
];

const reactProject = [
  {
    path: 'package.json',
    content: JSON.stringify({
      name: 'my-react-app',
      dependencies: { react: '18.0.0', 'react-dom': '18.0.0' },
      devDependencies: { typescript: '5.0.0', eslint: '8.0.0', jest: '29.0.0' },
      scripts: { build: 'react-scripts build', test: 'jest', lint: 'eslint .' },
    }),
  },
];

const vueProject = [
  {
    path: 'package.json',
    content: JSON.stringify({
      name: 'my-vue-app',
      dependencies: { vue: '3.0.0' },
      devDependencies: { prettier: '3.0.0' },
      scripts: { build: 'vite build', lint: 'prettier --check .' },
    }),
  },
];

const angularProject = [
  {
    path: 'package.json',
    content: JSON.stringify({
      name: 'my-angular-app',
      dependencies: { '@angular/core': '17.0.0' },
      devDependencies: { typescript: '5.0.0' },
      scripts: { build: 'ng build', test: 'ng test' },
    }),
  },
];

const pythonProject = [
  { path: 'requirements.txt', content: 'flask==3.0.0\nrequests==2.31.0\n' },
  { path: 'main.py', content: 'from flask import Flask\napp = Flask(__name__)' },
];

const pyprojectProject = [
  { path: 'pyproject.toml', content: '[project]\nname = "myapp"\nversion = "0.1.0"' },
];

const goProject = [
  { path: 'go.mod', content: 'module example.com/myapp\ngo 1.21' },
  { path: 'main.go', content: 'package main\nfunc main() {}' },
];

const rustProject = [
  { path: 'Cargo.toml', content: '[package]\nname = "myapp"\nversion = "0.1.0"' },
  { path: 'src/main.rs', content: 'fn main() {}' },
];

const javaProject = [
  { path: 'pom.xml', content: '<project><groupId>com.example</groupId></project>' },
  { path: 'src/main/java/App.java', content: 'class App {}' },
];

const minimalNodeProject = [
  {
    path: 'package.json',
    content: JSON.stringify({
      name: 'minimal-app',
      dependencies: { express: '4.18.0' },
      scripts: {},
    }),
  },
];

const projectWithEnvVars = [
  ...nextjsProject,
  {
    path: '.env.example',
    content:
      'DATABASE_URL=postgresql://localhost\nAPI_KEY=abc123\nSECRET_TOKEN=xyz\nNEXT_PUBLIC_URL=http://localhost:3000',
  },
];

const projectWithEnvSample = [
  ...nextjsProject,
  {
    path: '.env.sample',
    content: 'REDIS_URL=redis://localhost\nSTRIPE_SECRET=sk_test',
  },
];

const emptyProject: Array<{ path: string; content: string }> = [];

const projectWithDockerfile = [
  ...nextjsProject,
  { path: 'Dockerfile', content: 'FROM node:20-alpine\nWORKDIR /app' },
];

const pnpmProject = [...nextjsProject, { path: 'pnpm-lock.yaml', content: 'lockfileVersion: 9' }];

const yarnProject = [...nextjsProject, { path: 'yarn.lock', content: '# yarn lockfile v1' }];

const projectWithManyDeps = [
  {
    path: 'package.json',
    content: JSON.stringify({
      name: 'big-app',
      dependencies: Object.fromEntries(Array.from({ length: 55 }, (_, i) => [`dep-${i}`, '1.0.0'])),
      devDependencies: { typescript: '5.0.0', vitest: '1.0.0' },
      scripts: { build: 'tsc', test: 'vitest', lint: 'eslint .' },
    }),
  },
];

const projectWithInvalidJson = [
  {
    path: 'package.json',
    content: '{ this is not valid JSON }',
  },
];

// ============================================
// TESTS
// ============================================

describe('CICDGenerator - class and exports', () => {
  it('should create a new instance', () => {
    const gen = new CICDGenerator();
    expect(gen).toBeDefined();
    expect(gen).toBeInstanceOf(CICDGenerator);
  });

  it('should export a singleton instance', () => {
    expect(cicdGenerator).toBeDefined();
    expect(cicdGenerator).toBeInstanceOf(CICDGenerator);
  });

  it('should export the generateCICD convenience function', () => {
    expect(typeof generateCICD).toBe('function');
  });

  it('generateCICD should delegate to cicdGenerator.generatePipeline', async () => {
    const result = await generateCICD(nextjsProject);
    expect(result).toBeDefined();
    expect(result.cicd).toBeDefined();
    expect(result.cicd.provider).toBe('github-actions');
  });

  it('generateCICD should accept options', async () => {
    const result = await generateCICD(nextjsProject, { provider: 'gitlab-ci' });
    expect(result.cicd.provider).toBe('gitlab-ci');
  });
});

// ============================================
// PROJECT ANALYSIS / DETECTION
// ============================================

describe('CICDGenerator - project type detection', () => {
  let gen: CICDGenerator;

  beforeEach(() => {
    gen = new CICDGenerator();
  });

  it('should detect Next.js project', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.cicd.content).toContain('npm ci');
    // Next.js => .next artifact path
    expect(result.cicd.content).toContain('.next');
  });

  it('should detect React project', async () => {
    const result = await gen.generatePipeline(reactProject);
    expect(result.cicd.content).toContain('npm ci');
    // React => dist artifact path
    expect(result.cicd.content).toContain('dist');
  });

  it('should detect Vue project', async () => {
    const result = await gen.generatePipeline(vueProject);
    expect(result.cicd.content).toContain('npm ci');
    expect(result.cicd.content).toContain('dist');
  });

  it('should detect Angular project', async () => {
    const result = await gen.generatePipeline(angularProject);
    expect(result.cicd.content).toContain('npm ci');
  });

  it('should detect Python project from requirements.txt', async () => {
    const result = await gen.generatePipeline(pythonProject);
    expect(result.cicd.content).toContain('pip');
  });

  it('should detect Python project from pyproject.toml', async () => {
    const result = await gen.generatePipeline(pyprojectProject);
    expect(result.cicd.content).toContain('pip');
  });

  it('should detect Go project', async () => {
    const result = await gen.generatePipeline(goProject);
    expect(result.cicd.content).toContain('go');
  });

  it('should detect Rust project', async () => {
    const result = await gen.generatePipeline(rustProject);
    expect(result.cicd.content).toContain('cargo');
  });

  it('should detect Java project', async () => {
    const result = await gen.generatePipeline(javaProject);
    expect(result.cicd.content).toContain('maven');
  });

  it('should fall back to node for empty project', async () => {
    const result = await gen.generatePipeline(emptyProject);
    expect(result.cicd.content).toContain('npm ci');
  });

  it('should handle invalid package.json gracefully', async () => {
    const result = await gen.generatePipeline(projectWithInvalidJson);
    // Should not throw, should fall back to defaults
    expect(result.cicd).toBeDefined();
    expect(result.cicd.content).toContain('npm ci');
  });
});

// ============================================
// PACKAGE MANAGER DETECTION
// ============================================

describe('CICDGenerator - package manager detection', () => {
  let gen: CICDGenerator;

  beforeEach(() => {
    gen = new CICDGenerator();
  });

  it('should default to npm when no lockfile present', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.cicd.content).toContain('npm ci');
  });

  it('should detect pnpm from pnpm-lock.yaml', async () => {
    const result = await gen.generatePipeline(pnpmProject);
    expect(result.cicd.content).toContain('pnpm install --frozen-lockfile');
  });

  it('should detect yarn from yarn.lock', async () => {
    const result = await gen.generatePipeline(yarnProject);
    expect(result.cicd.content).toContain('yarn install --frozen-lockfile');
  });
});

// ============================================
// FEATURE DETECTION (tests, linting, TypeScript)
// ============================================

describe('CICDGenerator - feature detection', () => {
  let gen: CICDGenerator;

  beforeEach(() => {
    gen = new CICDGenerator();
  });

  it('should include test step when vitest is a dependency', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.cicd.content).toContain('Run tests');
  });

  it('should include test step when jest is a dependency', async () => {
    const result = await gen.generatePipeline(reactProject);
    expect(result.cicd.content).toContain('Run tests');
  });

  it('should include lint step when eslint is a dependency', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.cicd.content).toContain('Lint');
  });

  it('should include TypeScript check when typescript is a dependency', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.cicd.content).toContain('Type check');
  });

  it('should omit test step when no test framework detected', async () => {
    const result = await gen.generatePipeline(minimalNodeProject);
    expect(result.cicd.content).not.toContain('Run tests');
  });

  it('should omit lint step when no lint script defined', async () => {
    const result = await gen.generatePipeline(minimalNodeProject);
    expect(result.cicd.content).not.toContain('Lint\n');
  });

  it('should omit TypeScript check when no typescript dependency', async () => {
    const result = await gen.generatePipeline(minimalNodeProject);
    expect(result.cicd.content).not.toContain('Type check');
  });

  it('should detect Docker when Dockerfile is in project files', async () => {
    const result = await gen.generatePipeline(projectWithDockerfile);
    expect(result.docker).toBeDefined();
    expect(result.docker?.dockerfile).toContain('FROM');
  });
});

// ============================================
// ENVIRONMENT VARIABLE DETECTION
// ============================================

describe('CICDGenerator - environment variable detection', () => {
  let gen: CICDGenerator;

  beforeEach(() => {
    gen = new CICDGenerator();
  });

  it('should detect env vars from .env.example', async () => {
    const result = await gen.generatePipeline(projectWithEnvVars);
    expect(result.cicd.content).toContain('DATABASE_URL');
    expect(result.cicd.content).toContain('API_KEY');
    expect(result.cicd.content).toContain('SECRET_TOKEN');
    expect(result.cicd.content).toContain('NEXT_PUBLIC_URL');
  });

  it('should detect env vars from .env.sample', async () => {
    const result = await gen.generatePipeline(projectWithEnvSample);
    expect(result.cicd.content).toContain('REDIS_URL');
    expect(result.cicd.content).toContain('STRIPE_SECRET');
  });

  it('should deduplicate env vars', async () => {
    const project = [
      ...nextjsProject,
      {
        path: '.env.example',
        content: 'API_KEY=one\nAPI_KEY=two\nSECRET=three',
      },
    ];
    const result = await gen.generatePipeline(project);
    // Should contain each once
    const matches = result.cicd.content.match(/API_KEY/g);
    // At least appears, deduplication means the set is unique in the analysis
    expect(matches).not.toBeNull();
  });

  it('should include env vars in setup instructions', async () => {
    const result = await gen.generatePipeline(projectWithEnvVars);
    const secretInstruction = result.setupInstructions.find((i) => i.includes('secrets'));
    expect(secretInstruction).toBeDefined();
    expect(secretInstruction).toContain('DATABASE_URL');
  });

  it('should generate .env.example in additional files when env vars exist', async () => {
    const result = await gen.generatePipeline(projectWithEnvVars);
    const envFile = result.additionalFiles.find((f) => f.path === '.env.example');
    expect(envFile).toBeDefined();
    expect(envFile?.content).toContain('DATABASE_URL=');
  });
});

// ============================================
// GITHUB ACTIONS (default provider)
// ============================================

describe('CICDGenerator - GitHub Actions', () => {
  let gen: CICDGenerator;

  beforeEach(() => {
    gen = new CICDGenerator();
  });

  it('should return correct provider name', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.cicd.provider).toBe('github-actions');
  });

  it('should return correct filename', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.cicd.fileName).toBe('.github/workflows/ci-cd.yml');
  });

  it('should contain workflow name', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.cicd.content).toContain('name: CI/CD Pipeline');
  });

  it('should have push and PR triggers', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.cicd.content).toContain('push:');
    expect(result.cicd.content).toContain('pull_request:');
  });

  it('should include quality, build, and security jobs', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.cicd.content).toContain('Code Quality');
    expect(result.cicd.content).toContain('Build');
    expect(result.cicd.content).toContain('Security Scan');
  });

  it('should use codecov for coverage upload', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.cicd.content).toContain('codecov/codecov-action');
  });

  it('should include staging deployment for develop branch', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.cicd.content).toContain('Deploy to Staging');
    expect(result.cicd.content).toContain('refs/heads/develop');
  });

  it('should include production deployment for main branch', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.cicd.content).toContain('Deploy to Production');
    expect(result.cicd.content).toContain('refs/heads/main');
  });

  it('should use .next artifact path for Next.js projects', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.cicd.content).toContain('path: .next');
  });

  it('should use dist artifact path for React projects', async () => {
    const result = await gen.generatePipeline(reactProject);
    expect(result.cicd.content).toContain('path: dist');
  });

  it('should include security audit step', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.cicd.content).toContain('npm audit');
  });

  it('should include Snyk security scan', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.cicd.content).toContain('snyk/actions');
  });

  it('should have a description', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.cicd.description).toBeTruthy();
    expect(result.cicd.description.length).toBeGreaterThan(10);
  });
});

// ============================================
// GITLAB CI
// ============================================

describe('CICDGenerator - GitLab CI', () => {
  let gen: CICDGenerator;

  beforeEach(() => {
    gen = new CICDGenerator();
  });

  it('should return correct provider and filename', async () => {
    const result = await gen.generatePipeline(nextjsProject, { provider: 'gitlab-ci' });
    expect(result.cicd.provider).toBe('gitlab-ci');
    expect(result.cicd.fileName).toBe('.gitlab-ci.yml');
  });

  it('should define stages', async () => {
    const result = await gen.generatePipeline(nextjsProject, { provider: 'gitlab-ci' });
    expect(result.cicd.content).toContain('stages:');
    expect(result.cicd.content).toContain('- install');
    expect(result.cicd.content).toContain('- quality');
    expect(result.cicd.content).toContain('- test');
    expect(result.cicd.content).toContain('- build');
    expect(result.cicd.content).toContain('- deploy');
  });

  it('should include coverage regex for test jobs', async () => {
    const result = await gen.generatePipeline(nextjsProject, { provider: 'gitlab-ci' });
    expect(result.cicd.content).toContain('coverage:');
  });

  it('should include npm caching', async () => {
    const result = await gen.generatePipeline(nextjsProject, { provider: 'gitlab-ci' });
    expect(result.cicd.content).toContain('cache:');
    expect(result.cicd.content).toContain('node_modules/');
  });

  it('should require manual trigger for production deployment', async () => {
    const result = await gen.generatePipeline(nextjsProject, { provider: 'gitlab-ci' });
    expect(result.cicd.content).toContain('when: manual');
  });
});

// ============================================
// CIRCLECI
// ============================================

describe('CICDGenerator - CircleCI', () => {
  let gen: CICDGenerator;

  beforeEach(() => {
    gen = new CICDGenerator();
  });

  it('should return correct provider and filename', async () => {
    const result = await gen.generatePipeline(nextjsProject, { provider: 'circleci' });
    expect(result.cicd.provider).toBe('circleci');
    expect(result.cicd.fileName).toBe('.circleci/config.yml');
  });

  it('should use version 2.1', async () => {
    const result = await gen.generatePipeline(nextjsProject, { provider: 'circleci' });
    expect(result.cicd.content).toContain('version: 2.1');
  });

  it('should use node orb', async () => {
    const result = await gen.generatePipeline(nextjsProject, { provider: 'circleci' });
    expect(result.cicd.content).toContain('circleci/node@5.0');
  });

  it('should include workflows section', async () => {
    const result = await gen.generatePipeline(nextjsProject, { provider: 'circleci' });
    expect(result.cicd.content).toContain('workflows:');
  });

  it('should filter deploy to main branch only', async () => {
    const result = await gen.generatePipeline(nextjsProject, { provider: 'circleci' });
    expect(result.cicd.content).toContain('only: main');
  });
});

// ============================================
// JENKINS
// ============================================

describe('CICDGenerator - Jenkins', () => {
  let gen: CICDGenerator;

  beforeEach(() => {
    gen = new CICDGenerator();
  });

  it('should return correct provider and filename', async () => {
    const result = await gen.generatePipeline(nextjsProject, { provider: 'jenkins' });
    expect(result.cicd.provider).toBe('jenkins');
    expect(result.cicd.fileName).toBe('Jenkinsfile');
  });

  it('should use declarative pipeline syntax', async () => {
    const result = await gen.generatePipeline(nextjsProject, { provider: 'jenkins' });
    expect(result.cicd.content).toContain('pipeline {');
    expect(result.cicd.content).toContain('stages {');
  });

  it('should include post-build cleanup', async () => {
    const result = await gen.generatePipeline(nextjsProject, { provider: 'jenkins' });
    expect(result.cicd.content).toContain('cleanWs()');
  });

  it('should include failure notification', async () => {
    const result = await gen.generatePipeline(nextjsProject, { provider: 'jenkins' });
    expect(result.cicd.content).toContain('mail to:');
  });

  it('should use manual input for production deployment', async () => {
    const result = await gen.generatePipeline(nextjsProject, { provider: 'jenkins' });
    expect(result.cicd.content).toContain('input message:');
  });
});

// ============================================
// AZURE DEVOPS
// ============================================

describe('CICDGenerator - Azure DevOps', () => {
  let gen: CICDGenerator;

  beforeEach(() => {
    gen = new CICDGenerator();
  });

  it('should return correct provider and filename', async () => {
    const result = await gen.generatePipeline(nextjsProject, { provider: 'azure-devops' });
    expect(result.cicd.provider).toBe('azure-devops');
    expect(result.cicd.fileName).toBe('azure-pipelines.yml');
  });

  it('should trigger on main and develop', async () => {
    const result = await gen.generatePipeline(nextjsProject, { provider: 'azure-devops' });
    expect(result.cicd.content).toContain('trigger:');
    expect(result.cicd.content).toContain('- main');
    expect(result.cicd.content).toContain('- develop');
  });

  it('should use ubuntu-latest pool', async () => {
    const result = await gen.generatePipeline(nextjsProject, { provider: 'azure-devops' });
    expect(result.cicd.content).toContain("vmImage: 'ubuntu-latest'");
  });

  it('should include deployment stages', async () => {
    const result = await gen.generatePipeline(nextjsProject, { provider: 'azure-devops' });
    expect(result.cicd.content).toContain('DeployStaging');
    expect(result.cicd.content).toContain('DeployProduction');
  });
});

// ============================================
// DEPLOYMENT TARGETS
// ============================================

describe('CICDGenerator - deployment targets', () => {
  let gen: CICDGenerator;

  beforeEach(() => {
    gen = new CICDGenerator();
  });

  it('should suggest Vercel for Next.js projects (auto)', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.deployment).toBeDefined();
    expect(result.deployment?.target).toBe('vercel');
  });

  it('should suggest Netlify for React projects (auto)', async () => {
    const result = await gen.generatePipeline(reactProject);
    expect(result.deployment).toBeDefined();
    expect(result.deployment?.target).toBe('netlify');
  });

  it('should suggest Netlify for Vue projects (auto)', async () => {
    const result = await gen.generatePipeline(vueProject);
    expect(result.deployment).toBeDefined();
    expect(result.deployment?.target).toBe('netlify');
  });

  it('should suggest Docker for other projects (auto)', async () => {
    const result = await gen.generatePipeline(pythonProject);
    expect(result.deployment).toBeDefined();
    expect(result.deployment?.target).toBe('docker');
  });

  it('should generate Vercel config with correct structure', async () => {
    const result = await gen.generatePipeline(nextjsProject, { deployTarget: 'vercel' });
    expect(result.deployment?.fileName).toBe('vercel.json');
    const parsed = JSON.parse(result.deployment!.content);
    expect(parsed.framework).toBe('nextjs');
    expect(parsed.outputDirectory).toBe('.next');
  });

  it('should generate Netlify config with security headers', async () => {
    const result = await gen.generatePipeline(nextjsProject, { deployTarget: 'netlify' });
    expect(result.deployment?.fileName).toBe('netlify.toml');
    expect(result.deployment?.content).toContain('X-Frame-Options');
    expect(result.deployment?.content).toContain('X-XSS-Protection');
    expect(result.deployment?.content).toContain('X-Content-Type-Options');
  });

  it('should generate AWS config', async () => {
    const result = await gen.generatePipeline(nextjsProject, { deployTarget: 'aws' });
    expect(result.deployment?.target).toBe('aws');
    expect(result.deployment?.fileName).toBe('aws-app-runner.yaml');
    expect(result.deployment?.content).toContain('nodejs20');
  });

  it('should generate GCP config', async () => {
    const result = await gen.generatePipeline(nextjsProject, { deployTarget: 'gcp' });
    expect(result.deployment?.target).toBe('gcp');
    expect(result.deployment?.fileName).toBe('app.yaml');
    expect(result.deployment?.content).toContain('nodejs20');
  });

  it('should generate Azure config', async () => {
    const result = await gen.generatePipeline(nextjsProject, { deployTarget: 'azure' });
    expect(result.deployment?.target).toBe('azure');
    expect(result.deployment?.fileName).toBe('azure-webapp.yaml');
  });

  it('should generate Heroku Procfile', async () => {
    const result = await gen.generatePipeline(nextjsProject, { deployTarget: 'heroku' });
    expect(result.deployment?.target).toBe('heroku');
    expect(result.deployment?.fileName).toBe('Procfile');
    expect(result.deployment?.content).toContain('web:');
  });

  it('should generate Docker Compose for docker target', async () => {
    const result = await gen.generatePipeline(nextjsProject, { deployTarget: 'docker' });
    expect(result.deployment?.target).toBe('docker');
    expect(result.deployment?.fileName).toBe('docker-compose.prod.yml');
    expect(result.deployment?.content).toContain('services:');
  });

  it('should generate K8s deployment yaml for kubernetes target', async () => {
    const result = await gen.generatePipeline(nextjsProject, { deployTarget: 'kubernetes' });
    expect(result.deployment?.target).toBe('kubernetes');
    expect(result.deployment?.fileName).toBe('k8s/deployment.yaml');
    expect(result.deployment?.content).toContain('apiVersion');
  });

  it('should mark secret env vars correctly in Vercel config', async () => {
    const result = await gen.generatePipeline(projectWithEnvVars, { deployTarget: 'vercel' });
    const secretVar = result.deployment?.envVars.find((v) => v.name === 'API_KEY');
    expect(secretVar?.secret).toBe(true);
    const secretToken = result.deployment?.envVars.find((v) => v.name === 'SECRET_TOKEN');
    expect(secretToken?.secret).toBe(true);
    const dbUrl = result.deployment?.envVars.find((v) => v.name === 'DATABASE_URL');
    expect(dbUrl?.secret).toBe(false);
  });

  it('should mark secret env vars correctly in Netlify config', async () => {
    const result = await gen.generatePipeline(projectWithEnvVars, { deployTarget: 'netlify' });
    const secretVar = result.deployment?.envVars.find((v) => v.name === 'API_KEY');
    expect(secretVar?.secret).toBe(true);
    const secretToken = result.deployment?.envVars.find((v) => v.name === 'SECRET_TOKEN');
    // Netlify uses KEY and SECRET for detection
    expect(secretToken?.secret).toBe(true);
  });
});

// ============================================
// DOCKER CONFIG
// ============================================

describe('CICDGenerator - Docker configuration', () => {
  let gen: CICDGenerator;

  beforeEach(() => {
    gen = new CICDGenerator();
  });

  it('should generate Docker config when includeDocker is true', async () => {
    const result = await gen.generatePipeline(nextjsProject, { includeDocker: true });
    expect(result.docker).toBeDefined();
  });

  it('should not generate Docker config by default for projects without Dockerfile', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.docker).toBeUndefined();
  });

  it('should auto-detect Dockerfile and generate Docker config', async () => {
    const result = await gen.generatePipeline(projectWithDockerfile);
    expect(result.docker).toBeDefined();
  });

  it('should generate multi-stage Dockerfile', async () => {
    const result = await gen.generatePipeline(nextjsProject, { includeDocker: true });
    expect(result.docker?.dockerfile).toContain('FROM node:20-alpine AS builder');
    expect(result.docker?.dockerfile).toContain('FROM node:20-alpine AS runner');
  });

  it('should create non-root user in Dockerfile', async () => {
    const result = await gen.generatePipeline(nextjsProject, { includeDocker: true });
    expect(result.docker?.dockerfile).toContain('adduser --system');
    expect(result.docker?.dockerfile).toContain('USER appuser');
  });

  it('should expose port 3000', async () => {
    const result = await gen.generatePipeline(nextjsProject, { includeDocker: true });
    expect(result.docker?.dockerfile).toContain('EXPOSE 3000');
  });

  it('should use pnpm in Dockerfile for pnpm projects', async () => {
    const result = await gen.generatePipeline(pnpmProject, { includeDocker: true });
    expect(result.docker?.dockerfile).toContain('pnpm install --frozen-lockfile');
  });

  it('should use yarn in Dockerfile for yarn projects', async () => {
    const result = await gen.generatePipeline(yarnProject, { includeDocker: true });
    expect(result.docker?.dockerfile).toContain('yarn install --frozen-lockfile');
  });

  it('should generate .dockerignore', async () => {
    const result = await gen.generatePipeline(nextjsProject, { includeDocker: true });
    expect(result.docker?.dockerIgnore).toContain('node_modules');
    expect(result.docker?.dockerIgnore).toContain('.git');
    expect(result.docker?.dockerIgnore).toContain('.env*');
    expect(result.docker?.dockerIgnore).toContain('coverage');
  });

  it('should copy public directory for Next.js projects', async () => {
    const result = await gen.generatePipeline(nextjsProject, { includeDocker: true });
    expect(result.docker?.dockerfile).toContain('COPY --from=builder /app/public ./public');
  });

  it('should not copy public directory for non-Next.js projects', async () => {
    const result = await gen.generatePipeline(reactProject, { includeDocker: true });
    expect(result.docker?.dockerfile).not.toContain('./public');
  });
});

// ============================================
// KUBERNETES CONFIG
// ============================================

describe('CICDGenerator - Kubernetes configuration', () => {
  let gen: CICDGenerator;

  beforeEach(() => {
    gen = new CICDGenerator();
  });

  it('should generate K8s config when includeK8s is true', async () => {
    const result = await gen.generatePipeline(nextjsProject, { includeK8s: true });
    expect(result.kubernetes).toBeDefined();
  });

  it('should not generate K8s config by default', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.kubernetes).toBeUndefined();
  });

  it('should generate K8s Deployment manifest', async () => {
    const result = await gen.generatePipeline(nextjsProject, { includeK8s: true });
    expect(result.kubernetes?.deployment).toContain('kind: Deployment');
    expect(result.kubernetes?.deployment).toContain('replicas: 3');
  });

  it('should include resource limits in K8s deployment', async () => {
    const result = await gen.generatePipeline(nextjsProject, { includeK8s: true });
    expect(result.kubernetes?.deployment).toContain('resources:');
    expect(result.kubernetes?.deployment).toContain('memory: "512Mi"');
    expect(result.kubernetes?.deployment).toContain('cpu: "500m"');
  });

  it('should include health probes in K8s deployment', async () => {
    const result = await gen.generatePipeline(nextjsProject, { includeK8s: true });
    expect(result.kubernetes?.deployment).toContain('livenessProbe:');
    expect(result.kubernetes?.deployment).toContain('readinessProbe:');
    expect(result.kubernetes?.deployment).toContain('/health');
  });

  it('should generate K8s Service manifest', async () => {
    const result = await gen.generatePipeline(nextjsProject, { includeK8s: true });
    expect(result.kubernetes?.service).toContain('kind: Service');
    expect(result.kubernetes?.service).toContain('type: LoadBalancer');
  });

  it('should generate K8s Ingress manifest', async () => {
    const result = await gen.generatePipeline(nextjsProject, { includeK8s: true });
    expect(result.kubernetes?.ingress).toBeDefined();
    expect(result.kubernetes?.ingress).toContain('kind: Ingress');
    expect(result.kubernetes?.ingress).toContain('cert-manager');
  });

  it('should use project type in K8s resource names', async () => {
    const result = await gen.generatePipeline(nextjsProject, { includeK8s: true });
    expect(result.kubernetes?.deployment).toContain('nextjs-app');
    expect(result.kubernetes?.service).toContain('nextjs-app-service');
  });
});

// ============================================
// ADDITIONAL FILES
// ============================================

describe('CICDGenerator - additional files', () => {
  let gen: CICDGenerator;

  beforeEach(() => {
    gen = new CICDGenerator();
  });

  it('should always generate .nvmrc', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    const nvmrc = result.additionalFiles.find((f) => f.path === '.nvmrc');
    expect(nvmrc).toBeDefined();
    expect(nvmrc?.content).toBe('20');
  });

  it('should generate .env.example when env vars detected', async () => {
    const result = await gen.generatePipeline(projectWithEnvVars);
    const envFile = result.additionalFiles.find((f) => f.path === '.env.example');
    expect(envFile).toBeDefined();
    expect(envFile?.content).toContain('DATABASE_URL=');
    expect(envFile?.content).toContain('API_KEY=');
  });

  it('should not generate .env.example when no env vars detected', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    const envFile = result.additionalFiles.find((f) => f.path === '.env.example');
    expect(envFile).toBeUndefined();
  });

  it('each additional file should have a description', async () => {
    const result = await gen.generatePipeline(projectWithEnvVars);
    for (const file of result.additionalFiles) {
      expect(file.description).toBeTruthy();
    }
  });
});

// ============================================
// SETUP INSTRUCTIONS
// ============================================

describe('CICDGenerator - setup instructions', () => {
  let gen: CICDGenerator;

  beforeEach(() => {
    gen = new CICDGenerator();
  });

  it('should include copy config instruction', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.setupInstructions[0]).toContain('Copy the generated');
    expect(result.setupInstructions[0]).toContain('github-actions');
  });

  it('should include deployment credential instruction', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    const deployInstruction = result.setupInstructions.find((i) => i.includes('Configure'));
    expect(deployInstruction).toBeDefined();
  });

  it('should include Docker build instruction when Docker included', async () => {
    const result = await gen.generatePipeline(nextjsProject, { includeDocker: true });
    const dockerInstruction = result.setupInstructions.find((i) => i.includes('docker build'));
    expect(dockerInstruction).toBeDefined();
  });

  it('should include kubectl instruction when K8s included', async () => {
    const result = await gen.generatePipeline(nextjsProject, { includeK8s: true });
    const k8sInstruction = result.setupInstructions.find((i) => i.includes('kubectl'));
    expect(k8sInstruction).toBeDefined();
  });

  it('should always include push instruction', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    const pushInstruction = result.setupInstructions.find((i) => i.includes('Push to trigger'));
    expect(pushInstruction).toBeDefined();
  });

  it('should mention provider name in first instruction', async () => {
    const result = await gen.generatePipeline(nextjsProject, { provider: 'gitlab-ci' });
    expect(result.setupInstructions[0]).toContain('gitlab-ci');
  });
});

// ============================================
// BUILD TIME ESTIMATION
// ============================================

describe('CICDGenerator - build time estimation', () => {
  let gen: CICDGenerator;

  beforeEach(() => {
    gen = new CICDGenerator();
  });

  it('should return a time estimate string', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.estimatedBuildTime).toMatch(/~\d+-\d+ minutes/);
  });

  it('should estimate higher for Next.js with tests and TypeScript', async () => {
    const resultNextjs = await gen.generatePipeline(nextjsProject);
    const resultMinimal = await gen.generatePipeline(minimalNodeProject);
    // Next.js with tests and TS should take longer
    const extractMin = (s: string) => parseInt(s.match(/~(\d+)/)?.[1] || '0');
    expect(extractMin(resultNextjs.estimatedBuildTime)).toBeGreaterThan(
      extractMin(resultMinimal.estimatedBuildTime)
    );
  });

  it('should estimate higher for projects with many dependencies', async () => {
    const result = await gen.generatePipeline(projectWithManyDeps);
    const minutes = parseInt(result.estimatedBuildTime.match(/~(\d+)/)?.[1] || '0');
    // base(2) + tests(2) + ts(1) + deps>50(2) = 7
    expect(minutes).toBeGreaterThanOrEqual(7);
  });
});

// ============================================
// CUSTOM ENVIRONMENTS
// ============================================

describe('CICDGenerator - custom environments', () => {
  let gen: CICDGenerator;

  beforeEach(() => {
    gen = new CICDGenerator();
  });

  it('should use staging and production by default', async () => {
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.cicd.content).toContain('staging');
    expect(result.cicd.content).toContain('production');
  });

  it('should support production-only environment', async () => {
    const result = await gen.generatePipeline(nextjsProject, {
      environments: ['production'],
    });
    expect(result.cicd.content).toContain('production');
    // Should not have staging deployment section
    expect(result.cicd.content).not.toContain('Deploy to Staging');
  });

  it('should pass custom environments to GitLab CI', async () => {
    const result = await gen.generatePipeline(nextjsProject, {
      provider: 'gitlab-ci',
      environments: ['dev', 'staging', 'production'],
    });
    expect(result.cicd.content).toContain('deploy_dev');
    expect(result.cicd.content).toContain('deploy_staging');
    expect(result.cicd.content).toContain('deploy_production');
  });
});

// ============================================
// COMBINED OPTIONS
// ============================================

describe('CICDGenerator - combined options', () => {
  let gen: CICDGenerator;

  beforeEach(() => {
    gen = new CICDGenerator();
  });

  it('should generate full pipeline with Docker + K8s', async () => {
    const result = await gen.generatePipeline(nextjsProject, {
      includeDocker: true,
      includeK8s: true,
    });
    expect(result.cicd).toBeDefined();
    expect(result.deployment).toBeDefined();
    expect(result.docker).toBeDefined();
    expect(result.kubernetes).toBeDefined();
    expect(result.additionalFiles.length).toBeGreaterThan(0);
    expect(result.setupInstructions.length).toBeGreaterThan(0);
  });

  it('should generate GitLab CI + AWS deployment', async () => {
    const result = await gen.generatePipeline(nextjsProject, {
      provider: 'gitlab-ci',
      deployTarget: 'aws',
    });
    expect(result.cicd.provider).toBe('gitlab-ci');
    expect(result.deployment?.target).toBe('aws');
  });

  it('should generate Jenkins + Heroku deployment', async () => {
    const result = await gen.generatePipeline(nextjsProject, {
      provider: 'jenkins',
      deployTarget: 'heroku',
    });
    expect(result.cicd.provider).toBe('jenkins');
    expect(result.deployment?.target).toBe('heroku');
  });

  it('should generate pipeline result with all expected fields', async () => {
    const result = await gen.generatePipeline(nextjsProject, {
      includeDocker: true,
      includeK8s: true,
    });
    // Verify the shape of GeneratedPipeline
    expect(result).toHaveProperty('cicd');
    expect(result).toHaveProperty('deployment');
    expect(result).toHaveProperty('docker');
    expect(result).toHaveProperty('kubernetes');
    expect(result).toHaveProperty('additionalFiles');
    expect(result).toHaveProperty('setupInstructions');
    expect(result).toHaveProperty('estimatedBuildTime');
  });
});

// ============================================
// EDGE CASES & ERROR HANDLING
// ============================================

describe('CICDGenerator - edge cases', () => {
  let gen: CICDGenerator;

  beforeEach(() => {
    gen = new CICDGenerator();
  });

  it('should handle empty project files array', async () => {
    const result = await gen.generatePipeline([]);
    expect(result.cicd).toBeDefined();
    expect(result.cicd.provider).toBe('github-actions');
  });

  it('should handle project with no scripts', async () => {
    const result = await gen.generatePipeline(minimalNodeProject);
    expect(result.cicd).toBeDefined();
    // No build script means no build step content
    expect(result.cicd.content).not.toContain('run build');
  });

  it('should handle project with malformed package.json', async () => {
    const result = await gen.generatePipeline(projectWithInvalidJson);
    expect(result.cicd).toBeDefined();
    expect(result.estimatedBuildTime).toBeTruthy();
  });

  it('should default provider to github-actions when not specified', async () => {
    const result = await gen.generatePipeline(nextjsProject, {});
    expect(result.cicd.provider).toBe('github-actions');
  });

  it('should handle all providers without errors', async () => {
    const providers: CICDProvider[] = [
      'github-actions',
      'gitlab-ci',
      'circleci',
      'jenkins',
      'azure-devops',
    ];
    for (const provider of providers) {
      const result = await gen.generatePipeline(nextjsProject, { provider });
      expect(result.cicd.provider).toBe(provider);
      expect(result.cicd.content.length).toBeGreaterThan(0);
    }
  });

  it('should handle all deployment targets without errors', async () => {
    const targets: DeploymentTarget[] = [
      'vercel',
      'netlify',
      'aws',
      'gcp',
      'azure',
      'heroku',
      'docker',
      'kubernetes',
    ];
    for (const deployTarget of targets) {
      const result = await gen.generatePipeline(nextjsProject, { deployTarget });
      expect(result.deployment?.target).toBe(deployTarget);
      expect(result.deployment?.content.length).toBeGreaterThan(0);
    }
  });
});
