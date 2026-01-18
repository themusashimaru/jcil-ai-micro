# Code Lab Technical Documentation

> JCIL.AI Code Lab — A Claude Code-Inspired Agentic IDE

**Last Updated:** 2026-01-18
**Version:** 2.0.0

---

## Overview

Code Lab is a fully-functional, web-based agentic IDE with Claude Code-level capabilities. It provides 30+ tools, sandboxed cloud execution, real MCP server integration, and multi-platform deployment.

### Key Features

- **Claude Opus 4.5** - Powered by the most capable Claude model
- **E2B Sandboxed Execution** - Secure code execution in isolated cloud VMs
- **5 MCP Servers** - Real implementations (not stubs)
- **Multi-Platform Deployment** - Vercel, Netlify, Railway, Cloudflare
- **Persistent Workspaces** - Sessions and files stored in cloud
- **30+ Agentic Tools** - Full Claude Code parity

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
│  │                                                                       │   │
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
│  │                                                                       │   │
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

### Server Overview

| Server     | Location                   | Tools | Status  |
| ---------- | -------------------------- | ----- | ------- |
| Filesystem | `src/lib/workspace/mcp.ts` | 7     | ✅ Real |
| GitHub     | `src/lib/workspace/mcp.ts` | 4     | ✅ Real |
| Memory     | `src/lib/workspace/mcp.ts` | 4     | ✅ Real |
| Puppeteer  | `src/lib/workspace/mcp.ts` | 5     | ✅ Real |
| PostgreSQL | `src/lib/workspace/mcp.ts` | 1     | ✅ Real |

### Filesystem Server

Tools for file operations via E2B container:

```typescript
// Available tools
read     - Read file contents
write    - Write/create files
list     - List directory contents
search   - Search files by pattern
get_info - Get file metadata
move     - Move/rename files
copy     - Copy files

// Implementation
async function executeFilesystemTool(
  toolName: string,
  input: Record<string, unknown>,
  sessionId: string
): Promise<MCPToolResult>
```

### GitHub Server

GitHub operations via Octokit:

```typescript
// Available tools
repo_info     - Get repository information
list_issues   - List repository issues
create_issue  - Create new issue
create_pr     - Create pull request

// Requires
GITHUB_TOKEN environment variable
```

### Memory Server

Persistent key-value storage:

```typescript
// Available tools
store    - Store value with key
retrieve - Get value by key
list     - List all keys
search   - Search keys by pattern

// Storage
In-memory Map with optional database persistence
```

### Puppeteer Server

Browser automation via E2B:

```typescript
// Available tools
navigate   - Navigate to URL
screenshot - Capture screenshot
click      - Click element
type       - Type text
evaluate   - Run JavaScript

// Execution
Scripts run in E2B container with headless Puppeteer
```

### PostgreSQL Server

Database queries (restricted):

```typescript
// Available tools
query - Execute SELECT query

// Security
- Only SELECT queries allowed
- RLS policies enforced
- Via Supabase RPC
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
  async executeCommand(sessionId: string, command: string): Promise<ExecutionResult>;

  // File operations
  async readFile(sessionId: string, path: string): Promise<string>;
  async writeFile(sessionId: string, path: string, content: string): Promise<void>;
  async listDirectory(sessionId: string, path: string): Promise<FileInfo[]>;

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
│ Execute      │ ◄── Commands, file ops
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
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments/${deploymentId}`,
  { headers: { Authorization: `Bearer ${token}` } }
);
```

---

## Session Management

### Session Structure

```typescript
interface CodeLabSession {
  id: string;
  user_id: string;
  title: string;
  repo_url?: string;
  branch?: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  status: 'active' | 'archived';
}
```

### API Endpoints

| Endpoint                               | Method | Purpose              |
| -------------------------------------- | ------ | -------------------- |
| `/api/code-lab/sessions`               | GET    | List user sessions   |
| `/api/code-lab/sessions`               | POST   | Create new session   |
| `/api/code-lab/sessions/[id]`          | GET    | Get single session   |
| `/api/code-lab/sessions/[id]`          | DELETE | Delete session       |
| `/api/code-lab/sessions/[id]/messages` | GET    | Get session messages |

---

## Chat System

### Message Flow

```
User Input
     │
     ▼
┌──────────────────┐
│ Validation       │ ◄── Zod schema validation
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Session Check    │ ◄── Verify ownership
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Claude Opus 4.5  │ ◄── Tool-enabled completion
│ with Tools       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Tool Execution   │ ◄── Execute requested tools
│ Loop             │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Stream Response  │ ◄── SSE to client
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Persist Message  │ ◄── Save to database
└──────────────────┘
```

### Tool Calling

The chat system supports Claude's native tool calling:

```typescript
// Tool definition example
const tools = [
  {
    name: 'execute_shell',
    description: 'Execute a shell command in the sandbox',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to execute' },
      },
      required: ['command'],
    },
  },
  // ... more tools
];

// Tool execution in agentic loop
while (response.stop_reason === 'tool_use') {
  const toolResults = await executeTools(response.content);
  response = await anthropic.messages.create({
    messages: [...messages, { role: 'user', content: toolResults }],
  });
}
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
if (path.includes('..') || !path.startsWith('/workspace')) {
  return { success: false, error: 'Invalid path' };
}

// GitHub - Token required
if (!process.env.GITHUB_TOKEN) {
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

| Component         | Tests | Coverage                                   |
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

### Optional (for deployment)

```bash
VERCEL_TOKEN=                # Vercel deployments
NETLIFY_TOKEN=               # Netlify deployments
RAILWAY_TOKEN=               # Railway deployments
CLOUDFLARE_API_TOKEN=        # Cloudflare deployments
```

### Optional (for MCP)

```bash
GITHUB_TOKEN=                # GitHub MCP server
```

---

## File Reference

```
src/lib/workspace/
├── container.ts        # E2B sandbox management
├── mcp.ts              # MCP server implementation
├── security.ts         # Execution security
├── container.test.ts   # Container tests
└── mcp.test.ts         # MCP tests

src/lib/code-lab/
├── sessions.ts         # Session management
├── deploy.ts           # Deployment logic
├── sessions.test.ts    # Session tests
└── deploy.test.ts      # Deployment tests

src/components/code-lab/
├── CodeLab.tsx         # Main component
├── ChatPanel.tsx       # Chat interface
├── FileBrowser.tsx     # File tree
├── CodeEditor.tsx      # Monaco editor
└── CodeLab.test.tsx    # Component tests

app/api/code-lab/
├── chat/route.ts       # Chat endpoint
├── sessions/route.ts   # Sessions CRUD
├── files/route.ts      # File operations
├── git/route.ts        # Git operations
├── deploy/route.ts     # Deployment
└── tasks/route.ts      # Background tasks
```

---

_Last Updated: January 2026_
