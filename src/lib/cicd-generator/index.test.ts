import { describe, it, expect } from 'vitest';
import { CICDGenerator, cicdGenerator } from './index';

// -------------------------------------------------------------------
// Helper: minimal project files
// -------------------------------------------------------------------
const nextjsProject = [
  {
    path: 'package.json',
    content: JSON.stringify({
      name: 'my-nextjs-app',
      dependencies: { next: '14.0.0', react: '18.0.0', 'react-dom': '18.0.0' },
      devDependencies: { typescript: '5.0.0', eslint: '8.0.0', vitest: '1.0.0' },
      scripts: { build: 'next build', test: 'vitest run', lint: 'eslint .', dev: 'next dev' },
    }),
  },
  { path: 'tsconfig.json', content: '{}' },
];

const pythonProject = [
  { path: 'requirements.txt', content: 'flask==3.0.0\nrequests==2.31.0\n' },
  { path: 'main.py', content: 'from flask import Flask\napp = Flask(__name__)' },
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

// -------------------------------------------------------------------
// CICDGenerator instance
// -------------------------------------------------------------------
describe('CICDGenerator', () => {
  it('should create instance', () => {
    const gen = new CICDGenerator();
    expect(gen).toBeDefined();
  });

  it('should have exported singleton', () => {
    expect(cicdGenerator).toBeInstanceOf(CICDGenerator);
  });
});

// -------------------------------------------------------------------
// generatePipeline - GitHub Actions (default)
// -------------------------------------------------------------------
describe('CICDGenerator.generatePipeline - GitHub Actions', () => {
  it('should generate pipeline for Next.js project', async () => {
    const gen = new CICDGenerator();
    const result = await gen.generatePipeline(nextjsProject);

    expect(result.cicd).toBeDefined();
    expect(result.cicd.provider).toBe('github-actions');
    expect(result.cicd.fileName).toContain('.yml');
    expect(result.cicd.content).toContain('CI/CD Pipeline');
    expect(result.cicd.content).toContain('npm ci');
    expect(result.cicd.content).toContain('run build');
  });

  it('should include test step when tests detected', async () => {
    const gen = new CICDGenerator();
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.cicd.content).toContain('test');
  });

  it('should include lint step when linting detected', async () => {
    const gen = new CICDGenerator();
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.cicd.content).toContain('Lint');
  });

  it('should include TypeScript check when TS detected', async () => {
    const gen = new CICDGenerator();
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.cicd.content).toContain('Type check');
  });

  it('should include staging and production environments by default', async () => {
    const gen = new CICDGenerator();
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.cicd.content).toContain('staging');
    expect(result.cicd.content).toContain('production');
  });

  it('should generate setup instructions', async () => {
    const gen = new CICDGenerator();
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.setupInstructions.length).toBeGreaterThan(0);
  });

  it('should estimate build time', async () => {
    const gen = new CICDGenerator();
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.estimatedBuildTime).toBeTruthy();
  });
});

// -------------------------------------------------------------------
// generatePipeline - Different providers
// -------------------------------------------------------------------
describe('CICDGenerator.generatePipeline - providers', () => {
  it('should generate GitLab CI config', async () => {
    const gen = new CICDGenerator();
    const result = await gen.generatePipeline(nextjsProject, { provider: 'gitlab-ci' });
    expect(result.cicd.provider).toBe('gitlab-ci');
    expect(result.cicd.fileName).toContain('.gitlab-ci');
    expect(result.cicd.content).toContain('stages:');
  });

  it('should generate CircleCI config', async () => {
    const gen = new CICDGenerator();
    const result = await gen.generatePipeline(nextjsProject, { provider: 'circleci' });
    expect(result.cicd.provider).toBe('circleci');
    expect(result.cicd.content).toContain('version:');
  });

  it('should generate Jenkinsfile', async () => {
    const gen = new CICDGenerator();
    const result = await gen.generatePipeline(nextjsProject, { provider: 'jenkins' });
    expect(result.cicd.provider).toBe('jenkins');
    expect(result.cicd.content).toContain('pipeline');
  });

  it('should generate Azure Pipelines config', async () => {
    const gen = new CICDGenerator();
    const result = await gen.generatePipeline(nextjsProject, { provider: 'azure-devops' });
    expect(result.cicd.provider).toBe('azure-devops');
    expect(result.cicd.content).toContain('trigger:');
  });
});

// -------------------------------------------------------------------
// generatePipeline - Different project types
// -------------------------------------------------------------------
describe('CICDGenerator.generatePipeline - project detection', () => {
  it('should detect Python project', async () => {
    const gen = new CICDGenerator();
    const result = await gen.generatePipeline(pythonProject);
    expect(result.cicd.content).toContain('pip');
  });

  it('should detect Go project', async () => {
    const gen = new CICDGenerator();
    const result = await gen.generatePipeline(goProject);
    expect(result.cicd.content).toContain('go');
  });

  it('should detect Rust project', async () => {
    const gen = new CICDGenerator();
    const result = await gen.generatePipeline(rustProject);
    expect(result.cicd.content).toContain('cargo');
  });

  it('should detect Java project', async () => {
    const gen = new CICDGenerator();
    const result = await gen.generatePipeline(javaProject);
    expect(result.cicd.content).toContain('maven');
  });
});

// -------------------------------------------------------------------
// generatePipeline - Docker
// -------------------------------------------------------------------
describe('CICDGenerator.generatePipeline - Docker', () => {
  it('should generate Docker config when requested', async () => {
    const gen = new CICDGenerator();
    const result = await gen.generatePipeline(nextjsProject, { includeDocker: true });
    expect(result.docker).toBeDefined();
    expect(result.docker?.dockerfile).toContain('FROM');
    expect(result.docker?.dockerIgnore).toContain('node_modules');
  });

  it('should not include Docker by default for non-Docker projects', async () => {
    const gen = new CICDGenerator();
    const result = await gen.generatePipeline(nextjsProject);
    // Docker is only included if hasDocker=true or includeDocker=true
    expect(result.docker).toBeUndefined();
  });

  it('should detect Docker when Dockerfile present', async () => {
    const projectWithDocker = [
      ...nextjsProject,
      { path: 'Dockerfile', content: 'FROM node:20-alpine' },
    ];
    const gen = new CICDGenerator();
    const result = await gen.generatePipeline(projectWithDocker);
    expect(result.docker).toBeDefined();
  });
});

// -------------------------------------------------------------------
// generatePipeline - Kubernetes
// -------------------------------------------------------------------
describe('CICDGenerator.generatePipeline - Kubernetes', () => {
  it('should generate K8s config when requested', async () => {
    const gen = new CICDGenerator();
    const result = await gen.generatePipeline(nextjsProject, { includeK8s: true });
    expect(result.kubernetes).toBeDefined();
    expect(result.kubernetes?.deployment).toContain('apiVersion');
    expect(result.kubernetes?.service).toContain('apiVersion');
  });

  it('should not include K8s by default', async () => {
    const gen = new CICDGenerator();
    const result = await gen.generatePipeline(nextjsProject);
    expect(result.kubernetes).toBeUndefined();
  });
});

// -------------------------------------------------------------------
// generatePipeline - Custom environments
// -------------------------------------------------------------------
describe('CICDGenerator.generatePipeline - environments', () => {
  it('should support custom environments', async () => {
    const gen = new CICDGenerator();
    const result = await gen.generatePipeline(nextjsProject, {
      environments: ['dev', 'staging', 'production'],
    });
    expect(result.cicd.content).toContain('staging');
    expect(result.cicd.content).toContain('production');
  });

  it('should support production only', async () => {
    const gen = new CICDGenerator();
    const result = await gen.generatePipeline(nextjsProject, {
      environments: ['production'],
    });
    expect(result.cicd.content).toContain('production');
  });
});

// -------------------------------------------------------------------
// Package manager detection
// -------------------------------------------------------------------
describe('CICDGenerator - package manager', () => {
  it('should detect pnpm from lockfile', async () => {
    const project = [...nextjsProject, { path: 'pnpm-lock.yaml', content: 'lockfileVersion: 9' }];
    const gen = new CICDGenerator();
    const result = await gen.generatePipeline(project);
    expect(result.cicd.content).toContain('pnpm');
  });

  it('should detect yarn from lockfile', async () => {
    const project = [...nextjsProject, { path: 'yarn.lock', content: '# yarn lockfile v1' }];
    const gen = new CICDGenerator();
    const result = await gen.generatePipeline(project);
    expect(result.cicd.content).toContain('yarn');
  });
});

// -------------------------------------------------------------------
// Env var detection
// -------------------------------------------------------------------
describe('CICDGenerator - env vars', () => {
  it('should detect env vars from .env.example', async () => {
    const project = [
      ...nextjsProject,
      {
        path: '.env.example',
        content: 'DATABASE_URL=\nAPI_KEY=\nSECRET_TOKEN=',
      },
    ];
    const gen = new CICDGenerator();
    const result = await gen.generatePipeline(project);
    expect(result.cicd.content).toContain('DATABASE_URL');
  });
});
