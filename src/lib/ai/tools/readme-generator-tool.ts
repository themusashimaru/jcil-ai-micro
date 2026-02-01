/**
 * README GENERATOR TOOL
 * Generate professional README.md files
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function generateReadme(config: {
  name: string;
  description: string;
  features?: string[];
  installation?: string;
  usage?: string;
  techStack?: string[];
  license?: string;
  badges?: string[];
  contributing?: boolean;
}): string {
  const {
    name,
    description,
    features = [],
    installation = 'npm install',
    usage = '',
    techStack = [],
    license = 'MIT',
    badges = [],
    contributing = true
  } = config;

  const badgeTemplates: Record<string, string> = {
    npm: `![npm](https://img.shields.io/npm/v/${name.toLowerCase()})`,
    build: `![Build Status](https://github.com/username/${name.toLowerCase()}/workflows/CI/badge.svg)`,
    coverage: `![Coverage](https://img.shields.io/codecov/c/github/username/${name.toLowerCase()})`,
    license: `![License](https://img.shields.io/badge/license-${license}-blue.svg)`,
    typescript: `![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)`,
    node: `![Node](https://img.shields.io/badge/node-%3E%3D18-green)`
  };

  const selectedBadges = badges.length > 0
    ? badges.map(b => badgeTemplates[b] || b).join(' ')
    : `${badgeTemplates.license} ${badgeTemplates.build}`;

  let readme = `# ${name}

${selectedBadges}

${description}

`;

  // Table of Contents
  readme += `## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
${techStack.length > 0 ? '- [Tech Stack](#tech-stack)\n' : ''}${contributing ? '- [Contributing](#contributing)\n' : ''}- [License](#license)

`;

  // Features
  if (features.length > 0) {
    readme += `## Features

${features.map(f => `- ${f}`).join('\n')}

`;
  }

  // Installation
  readme += `## Installation

\`\`\`bash
${installation}
\`\`\`

`;

  // Usage
  if (usage) {
    readme += `## Usage

\`\`\`typescript
${usage}
\`\`\`

`;
  } else {
    readme += `## Usage

\`\`\`typescript
import { ${name} } from '${name.toLowerCase()}';

// Initialize
const instance = new ${name}();

// Use the library
const result = await instance.doSomething();
\`\`\`

`;
  }

  // Tech Stack
  if (techStack.length > 0) {
    readme += `## Tech Stack

${techStack.map(t => `- **${t}**`).join('\n')}

`;
  }

  // Contributing
  if (contributing) {
    readme += `## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (\`git checkout -b feature/amazing-feature\`)
3. Commit your changes (\`git commit -m 'Add amazing feature'\`)
4. Push to the branch (\`git push origin feature/amazing-feature\`)
5. Open a Pull Request

`;
  }

  // License
  readme += `## License

This project is licensed under the ${license} License - see the [LICENSE](LICENSE) file for details.

---

Made with ❤️ by [Your Name](https://github.com/username)
`;

  return readme;
}

function generateApiDocs(endpoints: Array<{
  method: string;
  path: string;
  description: string;
  params?: Record<string, string>;
  body?: Record<string, string>;
  response?: string;
}>): string {
  let docs = `# API Documentation

## Endpoints

`;

  for (const endpoint of endpoints) {
    docs += `### ${endpoint.method} ${endpoint.path}

${endpoint.description}

`;

    if (endpoint.params && Object.keys(endpoint.params).length > 0) {
      docs += `**Parameters:**

| Name | Type | Description |
|------|------|-------------|
${Object.entries(endpoint.params).map(([name, type]) => `| ${name} | ${type} | - |`).join('\n')}

`;
    }

    if (endpoint.body && Object.keys(endpoint.body).length > 0) {
      docs += `**Request Body:**

\`\`\`json
${JSON.stringify(endpoint.body, null, 2)}
\`\`\`

`;
    }

    if (endpoint.response) {
      docs += `**Response:**

\`\`\`json
${endpoint.response}
\`\`\`

`;
    }

    docs += `---

`;
  }

  return docs;
}

function generateChangelog(versions: Array<{
  version: string;
  date: string;
  changes: { type: string; description: string }[];
}>): string {
  let changelog = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`;

  for (const version of versions) {
    changelog += `## [${version.version}] - ${version.date}

`;

    const grouped: Record<string, string[]> = {};
    for (const change of version.changes) {
      if (!grouped[change.type]) grouped[change.type] = [];
      grouped[change.type].push(change.description);
    }

    const typeOrder = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];
    for (const type of typeOrder) {
      if (grouped[type]) {
        changelog += `### ${type}

${grouped[type].map(c => `- ${c}`).join('\n')}

`;
      }
    }
  }

  return changelog;
}

function generateContributing(config: {
  projectName: string;
  codeStyle?: string;
  testCommand?: string;
  branchStrategy?: string;
}): string {
  const {
    projectName,
    codeStyle = 'ESLint + Prettier',
    testCommand = 'npm test',
    branchStrategy = 'feature branches'
  } = config;

  return `# Contributing to ${projectName}

First off, thank you for considering contributing to ${projectName}! It's people like you that make ${projectName} such a great tool.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, include:

- **Clear title** describing the issue
- **Steps to reproduce** the behavior
- **Expected behavior** vs actual behavior
- **Environment details** (OS, Node version, etc.)
- **Screenshots** if applicable

### Suggesting Features

Feature requests are welcome! Please provide:

- **Clear description** of the feature
- **Use case** explaining why it's needed
- **Possible implementation** if you have ideas

### Pull Requests

1. **Fork** the repo and create your branch from \`main\`
2. **Install** dependencies: \`npm install\`
3. **Make** your changes
4. **Test** your changes: \`${testCommand}\`
5. **Lint** your code: \`npm run lint\`
6. **Commit** with a descriptive message
7. **Push** to your fork
8. **Open** a Pull Request

## Development Setup

\`\`\`bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/${projectName.toLowerCase()}.git

# Install dependencies
npm install

# Run tests
${testCommand}

# Run linting
npm run lint
\`\`\`

## Style Guide

We use ${codeStyle} for code formatting. Please ensure your code passes linting before submitting.

## Branch Strategy

We use ${branchStrategy}:
- \`main\` - production-ready code
- \`feature/*\` - new features
- \`fix/*\` - bug fixes
- \`docs/*\` - documentation updates

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- \`feat:\` new feature
- \`fix:\` bug fix
- \`docs:\` documentation
- \`style:\` formatting
- \`refactor:\` code restructuring
- \`test:\` adding tests
- \`chore:\` maintenance

## Questions?

Feel free to open an issue with your question!

Thank you for contributing! 🎉
`;
}

function generateLicense(type: 'MIT' | 'Apache-2.0' | 'GPL-3.0' | 'BSD-3-Clause', author: string, year?: number): string {
  const currentYear = year || new Date().getFullYear();

  const licenses: Record<string, string> = {
    'MIT': `MIT License

Copyright (c) ${currentYear} ${author}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,

    'Apache-2.0': `Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

Copyright ${currentYear} ${author}

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.`,

    'BSD-3-Clause': `BSD 3-Clause License

Copyright (c) ${currentYear}, ${author}
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its
   contributors may be used to endorse or promote products derived from
   this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED.`
  };

  return licenses[type] || licenses['MIT'];
}

export const readmeGeneratorTool: UnifiedTool = {
  name: 'readme_generator',
  description: 'README Generator: readme, api_docs, changelog, contributing, license',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['readme', 'api_docs', 'changelog', 'contributing', 'license'] },
      config: { type: 'object' },
      endpoints: { type: 'array' },
      versions: { type: 'array' },
      type: { type: 'string' },
      author: { type: 'string' }
    },
    required: ['operation']
  },
};

export async function executeReadmeGenerator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: string;

    switch (args.operation) {
      case 'readme':
        result = generateReadme(args.config || {
          name: 'MyProject',
          description: 'A powerful library for doing amazing things.',
          features: ['Feature 1', 'Feature 2', 'Feature 3'],
          techStack: ['TypeScript', 'Node.js', 'React'],
          badges: ['npm', 'build', 'license', 'typescript']
        });
        break;
      case 'api_docs':
        result = generateApiDocs(args.endpoints || [
          { method: 'GET', path: '/api/users', description: 'Get all users', response: '{ "users": [] }' },
          { method: 'POST', path: '/api/users', description: 'Create user', body: { email: 'string', name: 'string' } }
        ]);
        break;
      case 'changelog':
        result = generateChangelog(args.versions || [
          { version: '1.0.0', date: '2024-01-15', changes: [
            { type: 'Added', description: 'Initial release' },
            { type: 'Added', description: 'Core functionality' }
          ]}
        ]);
        break;
      case 'contributing':
        result = generateContributing(args.config || { projectName: 'MyProject' });
        break;
      case 'license':
        result = generateLicense(args.type || 'MIT', args.author || 'Your Name');
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: result };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isReadmeGeneratorAvailable(): boolean { return true; }
