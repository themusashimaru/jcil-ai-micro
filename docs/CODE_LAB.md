# Code Lab Technical Documentation

> JCIL.AI Code Lab — A Claude Code-Inspired Agentic IDE

**Last Updated:** 2026-01-18
**Version:** 2.1.0

---

## Overview

Code Lab is a fully-functional, web-based agentic IDE with Claude Code-level capabilities. It provides **55+ tools**, sandboxed cloud execution, **5 real MCP servers**, and multi-platform deployment.

### Key Features

- **Claude Opus 4.5** - Powered by the most capable Claude model
- **E2B Sandboxed Execution** - Secure code execution in isolated cloud VMs
- **5 MCP Servers** - Real implementations (not stubs)
- **Multi-Platform Deployment** - Vercel, Netlify, Railway, Cloudflare
- **Persistent Workspaces** - Sessions and files stored in cloud
- **55+ Agentic Tools** - Full Claude Code parity plus extras

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CODE LAB ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         FRONTEND (React)                             │   │
│  │                                                                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │  │  Chat Panel  │  │ File Browser │  │ Code Editor  │               │   │
│  │  │              │  │              │  │              │               │   │
│  │  │ • Messages   │  │ • Tree View  │  │ • Monaco     │               │   │
│  │  │ • Streaming  │  │ • File Ops   │  │ • Syntax     │               │   │
│  │  │ • Tools      │  │ • Search     │  │ • Diff View  │               │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘               │   │
│  └───────────────────────────────────┬─────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         API ROUTES (Next.js)                         │   │
│  │                                                                       │   │
│  │  /api/code-lab/                                                      │   │
│  │  ├── chat          POST - AI chat with tool calling                 │   │
│  │  ├── sessions      GET, POST - Session management                    │   │
│  │  ├── sessions/[id] GET, DELETE - Single session ops                  │   │
│  │  ├── files         GET, POST, PUT, DELETE - File operations         │   │
│  │  ├── git           POST - Git operations                             │   │
│  │  ├── deploy        POST - Multi-platform deployment                  │   │
│  │  └── tasks         GET, POST - Background tasks                      │   │
│  └───────────────────────────────────┬─────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         CORE SERVICES                                │   │
│  │                                                                       │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │   │
│  │  │  Anthropic       │  │  Container       │  │  MCP Server      │  │   │
│  │  │  Client          │  │  Manager         │  │  Manager         │  │   │
│  │  │                  │  │                  │  │                  │  │   │
│  │  │ • Opus 4.5       │  │ • E2B Sandbox    │  │ • Filesystem     │  │   │
│  │  │ • Tool calling   │  │ • File sync      │  │ • GitHub         │  │   │
│  │  │ • Streaming      │  │ • Shell exec     │  │ • Memory         │  │   │
│  │  │ • Skills loop    │  │ • Persistence    │  │ • Puppeteer      │  │   │
│  │  │                  │  │                  │  │ • PostgreSQL     │  │   │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘  │   │
│  └───────────────────────────────────┬─────────────────────────────────┘   │
│                                      │                                       │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         EXTERNAL SERVICES                            │   │
│  │                                                                       │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│  │  │   E2B    │  │ Supabase │  │  GitHub  │  │ Deploy   │            │   │
│  │  │ Sandbox  │  │ Database │  │   API    │  │ Targets  │            │   │
│  │  │          │  │          │  │          │  │          │            │   │
│  │  │ Execute  │  │ Sessions │  │ Octokit  │  │ Vercel   │            │   │
│  │  │ code in  │  │ Messages │  │ PRs/     │  │ Netlify  │            │   │
│  │  │ isolated │  │ Files    │  │ Issues   │  │ Railway  │            │   │
│  │  │ VM       │  │ State    │  │          │  │ Cloudflare│            │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Model Configuration

Code Lab uses **Claude Opus 4.5** for maximum capability:

```typescript
// src/lib/anthropic/client.ts
const CODE_LAB_MODEL = 'claude-opus-4-5-20251101';

// Model selection by use case
| Use Case        | Model             | Reasoning                    |
|-----------------|-------------------|------------------------------|
| Code Lab Chat   | Opus 4.5          | Best reasoning, tool use     |
| Bug Oracle      | Sonnet 4.5        | Good balance for analysis    |
| App Generator   | Sonnet 4.5        | Structured output            |
| Regular Chat    | Haiku 4.5         | Fast, cost-effective         |
```

---

## MCP Server Integration

**Model Context Protocol (MCP)** extends Code Lab's capabilities beyond the sandbox. All servers are **real implementations** - no stubs or mocks.

### Server Overview

| Server         | Tools | Implementation | Status |
| -------------- | ----- | -------------- | ------ |
| **Filesystem** | 7     | E2B Container  | Real   |
| **GitHub**     | 4     | Octokit SDK    | Real   |
| **Memory**     | 4     | In-memory + DB | Real   |
| **Puppeteer**  | 5     | E2B Headless   | Real   |
| **PostgreSQL** | 1     | Supabase RPC   | Real   |

### Puppeteer Server — Browser Automation

Automate any web browser task directly through Claude. Scrape data, test UIs, generate screenshots.

**Available Tools:**

| Tool         | Description                         |
| ------------ | ----------------------------------- |
| `navigate`   | Navigate to any URL                 |
| `screenshot` | Capture page or element screenshots |
| `click`      | Click elements by selector          |
| `type`       | Type text into inputs               |
| `evaluate`   | Execute JavaScript in page context  |

**Example Usage:**

```typescript
// User: "Take a screenshot of the Anthropic homepage"

// Claude executes:
[mcp_enable_server] puppeteer
[mcp__puppeteer__navigate] https://anthropic.com
[mcp__puppeteer__screenshot] /workspace/screenshots/anthropic.png

// Result: Screenshot saved to workspace
```

**Implementation:**

```typescript
// src/lib/workspace/mcp.ts

private async executePuppeteerTool(
  toolName: string,
  input: Record<string, unknown>,
  workspaceId: string
): Promise<MCPToolResult> {
  const container = new ContainerManager();

  switch (toolName) {
    case 'navigate': {
      const url = input.url as string;
      // Execute puppeteer script in E2B container
      const script = `
        const puppeteer = require('puppeteer');
        (async () => {
          const browser = await puppeteer.launch({ headless: 'new' });
          const page = await browser.newPage();
          await page.goto('${url}');
          const title = await page.title();
          await browser.close();
          console.log(JSON.stringify({ title, url }));
        })();
      `;
      return await container.executeScript(workspaceId, script);
    }
    // ... other tools
  }
}
```

**Use Cases:**

- Visual regression testing
- Automated form filling
- Scraping JavaScript-rendered content
- Generating PDFs from web pages
- E2E testing without test frameworks

---

### GitHub Server — Repository Integration

Full GitHub access through Claude. Create issues, open PRs, explore repositories.

**Available Tools:**

| Tool           | Description                                     |
| -------------- | ----------------------------------------------- |
| `get_repo`     | Repository metadata (stars, forks, description) |
| `list_issues`  | List issues with state filter                   |
| `create_issue` | Create new issue                                |
| `create_pr`    | Open pull request                               |

**Example Usage:**

```typescript
// User: "List the open issues on my project"

// Claude executes:
[mcp__github__list_issues] owner: "myuser", repo: "my-project", state: "open"

// Result:
#42 - Bug: Login fails on Safari
#38 - Feature: Add dark mode
#35 - Docs: Update API reference
```

**Implementation:**

```typescript
// src/lib/workspace/mcp.ts

private async executeGitHubTool(
  toolName: string,
  input: Record<string, unknown>,
  token: string
): Promise<MCPToolResult> {
  const { Octokit } = await import('@octokit/rest');
  const octokit = new Octokit({ auth: token });

  switch (toolName) {
    case 'list_issues': {
      const { data } = await octokit.issues.listForRepo({
        owner: input.owner as string,
        repo: input.repo as string,
        state: (input.state as 'open' | 'closed' | 'all') || 'open',
      });
      return { success: true, result: data };
    }
    // ... other tools
  }
}
```

**Requirements:**

- `GITHUB_TOKEN` environment variable with repo access

---

### PostgreSQL Server — Database Queries

Query your database directly through natural language. Explore schemas, analyze data, debug queries.

**Available Tools:**

| Tool    | Description                        |
| ------- | ---------------------------------- |
| `query` | Execute SELECT queries (read-only) |

**Example Usage:**

```typescript
// User: "Show me users who signed up in the last week"

// Claude executes:
[mcp__postgres__query]
  SELECT email, created_at
  FROM users
  WHERE created_at > NOW() - INTERVAL '7 days'
  ORDER BY created_at DESC

// Result: Formatted table with matching users
```

**Security Restrictions:**

```typescript
// Only SELECT queries allowed
if (!sql.trim().toLowerCase().startsWith('select')) {
  return { success: false, error: 'Only SELECT queries allowed for security' };
}

// Row-Level Security enforced through Supabase
// Connection via RPC for additional safety layer
```

---

### Memory Server — Persistent Key-Value Store

Store information across sessions. Remember project context, user preferences, learned patterns.

**Available Tools:**

| Tool        | Description            |
| ----------- | ---------------------- |
| `store`     | Save key-value pair    |
| `retrieve`  | Get value by key       |
| `list_keys` | List all stored keys   |
| `search`    | Search keys by pattern |

**Example Usage:**

```typescript
// User: "Remember that this project uses ESLint with Airbnb config"

// Claude executes:
[mcp__memory__store]
  key: "project_linting"
  value: { "linter": "eslint", "config": "airbnb" }

// Next session:
[mcp__memory__retrieve] key: "project_linting"
// Claude automatically applies the stored preferences
```

**Storage:**

- In-memory Map for fast access
- Optional database persistence for cross-session memory

---

### Filesystem Server — Sandboxed File Operations

Full filesystem access within the secure E2B sandbox.

**Available Tools:**

| Tool             | Description                    |
| ---------------- | ------------------------------ |
| `read_file`      | Read file contents             |
| `write_file`     | Create or overwrite files      |
| `list_directory` | Explore folder structure       |
| `search_files`   | Glob pattern matching          |
| `get_info`       | File metadata (size, modified) |
| `move_file`      | Rename or relocate             |
| `copy_file`      | Duplicate files                |

**Implementation:**

```typescript
// All operations route through E2B container
private async executeFilesystemTool(
  toolName: string,
  input: Record<string, unknown>,
  workspaceId: string
): Promise<MCPToolResult> {
  const container = new ContainerManager();

  switch (toolName) {
    case 'read_file': {
      const content = await container.readFile(workspaceId, input.path as string);
      return { success: true, result: content };
    }
    // ... other operations
  }
}
```

---

## Complete Tool Reference

Code Lab provides **55+ tools** organized by category:

### File Operations (7 tools)

```
read_file          Read file contents
write_file         Create or overwrite files
edit_file          Find-and-replace edits
list_files         Directory exploration
search_files       Glob pattern search
search_code        Grep through codebase
multi_edit         Atomic batch edits
```

### Shell & Execution (4 tools)

```
execute_shell      Run any shell command
run_build          Auto-detect and run build
run_tests          Auto-detect and run tests
install_packages   Package manager detection
```

### Git & GitHub (9 tools)

```
git_status         Repository state
git_diff           View changes
git_commit         Stage and commit
git_log            Commit history
git_branch         Branch management
git_checkout       Switch branches
git_push           Push to remote
git_pull           Pull from remote
create_pr          Open pull requests
```

### Planning & Tasks (4 tools)

```
enter_plan_mode    Start structured planning
write_plan         Create execution plan
exit_plan_mode     Finalize and execute
todo_write         Track task progress
```

### Background Tasks (4 tools)

```
bg_run             Start long-running process
bg_output          Stream task output
bg_kill            Terminate process
bg_list            View all tasks
```

### Project Memory (4 tools)

```
memory_read        Load project context
memory_create      Initialize memory file
memory_update      Modify stored context
memory_add_section Add new context section
```

### Hooks System (4 tools)

```
hooks_list         View configured hooks
hooks_enable       Activate a hook
hooks_disable      Deactivate a hook
hooks_create       Create custom hook
```

### MCP Management (3 tools)

```
mcp_list_servers   View all MCP servers
mcp_enable_server  Activate a server
mcp_disable_server Deactivate a server
```

### Deployment (5 tools)

```
deploy_vercel      Deploy to Vercel
deploy_netlify     Deploy to Netlify
deploy_railway     Deploy to Railway
deploy_cloudflare  Deploy to Cloudflare Pages
check_deploy_status Poll deployment progress
```

### Advanced (5 tools)

```
web_fetch          Fetch and parse URLs
spawn_task         Parallel sub-agents
notebook_edit      Jupyter notebook editing
ask_user           Request clarification
```

---

## E2B Container Integration

### Container Manager

```typescript
// src/lib/workspace/container.ts

class ContainerManager {
  // Create new sandbox
  async createSandbox(sessionId: string): Promise<Sandbox>;

  // Execute shell command
  async executeCommand(
    sessionId: string,
    command: string,
    options?: { cwd?: string; timeout?: number }
  ): Promise<ExecutionResult>;

  // File operations
  async readFile(sessionId: string, path: string): Promise<string>;
  async writeFile(sessionId: string, path: string, content: string): Promise<void>;
  async listDirectory(sessionId: string, path: string): Promise<FileInfo[]>;
  async getFileTree(sessionId: string, path: string, depth: number): Promise<FileInfo[]>;

  // Build operations
  async runBuild(sessionId: string): Promise<ExecutionResult>;
  async runTests(sessionId: string): Promise<ExecutionResult>;
  async installDependencies(sessionId: string): Promise<ExecutionResult>;

  // Cleanup
  async destroySandbox(sessionId: string): Promise<void>;
}
```

### Sandbox Lifecycle

```
Session Start
     │
     ▼
┌──────────────┐
│ Create E2B   │ ◄── New sandbox per session
│ Sandbox      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Initialize   │ ◄── Clone repo, install deps
│ Workspace    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Execute      │ ◄── Commands, file ops, MCP tools
│ Operations   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Session End  │ ◄── Persist state, cleanup
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Destroy      │ ◄── Remove sandbox
│ Sandbox      │
└──────────────┘
```

---

## Deployment System

### Multi-Platform Support

```typescript
// app/api/code-lab/deploy/route.ts

type DeploymentPlatform = 'vercel' | 'netlify' | 'railway' | 'cloudflare';

// Platform-specific deployment
async function deployToVercel(config: DeployConfig): Promise<DeployResult>;
async function deployToNetlify(config: DeployConfig): Promise<DeployResult>;
async function deployToRailway(config: DeployConfig): Promise<DeployResult>;
async function deployToCloudflare(config: DeployConfig): Promise<DeployResult>;
```

### Status Polling

Each platform has full status polling implementation:

```typescript
// Vercel - v6 API
const status = await fetch(`https://api.vercel.com/v6/deployments/${deploymentId}`, {
  headers: { Authorization: `Bearer ${token}` },
});

// Netlify - REST API
const status = await fetch(`https://api.netlify.com/api/v1/deploys/${deployId}`, {
  headers: { Authorization: `Bearer ${token}` },
});

// Railway - GraphQL
const status = await fetch('https://backboard.railway.app/graphql/v2', {
  method: 'POST',
  body: JSON.stringify({ query: DEPLOYMENT_STATUS_QUERY }),
});

// Cloudflare - v4 API
const status = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${project}/deployments/${id}`,
  { headers: { Authorization: `Bearer ${token}` } }
);
```

---

## Security

### Sandboxed Execution

All code execution happens in E2B isolated VMs:

- No access to host system
- Resource limits enforced
- Network isolation available
- Automatic cleanup

### MCP Security

```typescript
// PostgreSQL - SELECT only
if (!sql.trim().toLowerCase().startsWith('select')) {
  return { success: false, error: 'Only SELECT queries allowed' };
}

// Filesystem - Path validation
const safePath = sanitizeFilePath(path);
if (safePath.includes('..') || !safePath.startsWith('/workspace')) {
  return { success: false, error: 'Invalid path' };
}

// GitHub - Token required
if (!token) {
  return { success: false, error: 'GitHub token not configured' };
}
```

### Session Ownership

```typescript
// Verify session belongs to user
const session = await getSession(sessionId);
if (session.user_id !== user.id) {
  throw new AuthorizationError('Not authorized');
}
```

---

## Testing

### Test Coverage

| Component         | Tests | File                                       |
| ----------------- | ----- | ------------------------------------------ |
| MCP Integration   | 21    | `src/lib/workspace/mcp.test.ts`            |
| Container Manager | 27    | `src/lib/workspace/container.test.ts`      |
| Sessions          | 13    | `src/lib/code-lab/sessions.test.ts`        |
| Deployment        | 18    | `src/lib/code-lab/deploy.test.ts`          |
| UI Components     | 41    | `src/components/code-lab/CodeLab.test.tsx` |

### Testing Philosophy

- **No mocks for core functionality** - Real Supabase SDK, real E2B API
- **Environment stubbing** - Env vars stubbed per-test
- **Integration focus** - Tests verify actual behavior

---

## Environment Variables

### Required

```bash
ANTHROPIC_API_KEY=           # Claude API access
NEXT_PUBLIC_SUPABASE_URL=    # Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Supabase public key
SUPABASE_SERVICE_ROLE_KEY=   # Supabase admin key
E2B_API_KEY=                 # E2B sandbox execution
```

### Optional (Deployment)

```bash
VERCEL_TOKEN=                # Vercel deployments
NETLIFY_TOKEN=               # Netlify deployments
RAILWAY_TOKEN=               # Railway deployments
CLOUDFLARE_API_TOKEN=        # Cloudflare deployments
```

### Optional (MCP)

```bash
GITHUB_TOKEN=                # GitHub MCP server
DATABASE_URL=                # PostgreSQL MCP (if not using Supabase)
```

---

## File Reference

```
src/lib/workspace/
├── container.ts           # E2B sandbox management
├── mcp.ts                 # MCP server implementation
├── chat-integration.ts    # WorkspaceAgent with 55+ tools
├── security.ts            # Execution security
├── planning.ts            # Planning mode tools
├── hooks.ts               # Hooks system
├── memory.ts              # Project memory
├── background-tasks.ts    # Background task manager
├── container.test.ts      # Container tests
└── mcp.test.ts            # MCP tests

src/lib/code-lab/
├── sessions.ts            # Session management
├── deploy.ts              # Deployment logic
├── sessions.test.ts       # Session tests
└── deploy.test.ts         # Deployment tests

src/components/code-lab/
├── CodeLab.tsx            # Main component
├── ChatPanel.tsx          # Chat interface
├── FileBrowser.tsx        # File tree
├── CodeEditor.tsx         # Monaco editor
└── CodeLab.test.tsx       # Component tests

app/api/code-lab/
├── chat/route.ts          # Chat endpoint
├── sessions/route.ts      # Sessions CRUD
├── files/route.ts         # File operations
├── git/route.ts           # Git operations
├── deploy/route.ts        # Deployment
└── tasks/route.ts         # Background tasks
```

---

_Last Updated: January 2026_
_Version: 2.1.0_
