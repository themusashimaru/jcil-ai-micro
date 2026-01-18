# CODE LAB 100% OPERATIONAL PLAN

**Current Score:** 68/100
**Target Score:** 100/100
**Last Audit Date:** 2026-01-18
**Branch:** `claude/audit-coding-lab-hLMWt`

---

## MISSION STATEMENT

Transform Code Lab from 68% to 100% operational. No facades, no mocks, no stubs.
Every feature must actually work as advertised.

---

## MASTER TASK LIST (Chronological Priority)

### PHASE 1: CRITICAL AGENT TOOLS (Days 1-2)

_Impact: Agents cannot autonomously code without these_

#### Task 1.1: Implement WriteTool for Agents

- **File:** `/src/agents/code/tools/WriteTool.ts` (NEW)
- **Status:** ❌ NOT IMPLEMENTED
- **Priority:** P0 - CRITICAL
- **Effort:** 4-6 hours
- **Dependencies:** None

**Implementation Requirements:**

```typescript
// WriteTool must support:
interface WriteToolInput {
  filePath: string; // Absolute or workspace-relative path
  content: string; // File content to write
  createDirs?: boolean; // Create parent directories if needed
}

interface WriteToolOutput {
  success: boolean;
  filePath: string;
  bytesWritten: number;
  error?: string;
}
```

**Steps:**

1. Create `/src/agents/code/tools/WriteTool.ts`
2. Implement `getDefinition()` with proper JSON schema
3. Implement `execute()` that:
   - Validates file path (use `sanitizeFilePath` from security.ts)
   - Calls ContainerManager.writeFile() for E2B workspaces
   - Falls back to GitHub API for repo files (if applicable)
   - Returns success/failure with bytes written
4. Register WriteTool in ToolOrchestrator
5. Add to tool definitions in chat-integration.ts
6. Test with agent requesting file creation

**Verification:**

- [ ] Agent can create new files autonomously
- [ ] Agent can modify existing files
- [ ] Path traversal attacks are blocked
- [ ] Proper error messages returned

---

#### Task 1.2: Fix ReadTool to Read from Workspace Containers

- **File:** `/src/agents/code/tools/ReadTool.ts`
- **Status:** ⚠️ PARTIAL (GitHub only)
- **Priority:** P0 - CRITICAL
- **Effort:** 3-4 hours
- **Dependencies:** ContainerManager

**Current Problem:**
ReadTool at line 104-108 only reads from GitHub:

```typescript
if (!this.githubToken && !this.owner && !this.repo) {
  return { success: false, error: 'GitHub not configured...' };
}
```

**Fix Required:**

1. Add workspace/container context to ReadTool constructor
2. Check if file exists in active container FIRST
3. Fall back to GitHub if not in container
4. Support both paths: `/workspace/...` and GitHub refs

**Implementation:**

```typescript
async execute(input: ReadToolInput): Promise<ReadToolOutput> {
  // 1. Try workspace container first (if workspaceId provided)
  if (this.workspaceId) {
    const containerResult = await this.readFromContainer(input.path);
    if (containerResult.success) return containerResult;
  }

  // 2. Fall back to GitHub
  return this.readFromGitHub(input.path);
}

private async readFromContainer(path: string): Promise<ReadToolOutput> {
  const container = getContainerManager();
  try {
    const content = await container.readFile(this.workspaceId, path);
    return { success: true, content, source: 'workspace' };
  } catch {
    return { success: false, error: 'File not found in workspace' };
  }
}
```

**Verification:**

- [ ] Agent can read files created in current session
- [ ] Agent can read modified files from workspace
- [ ] GitHub fallback still works
- [ ] Line range support works for both sources

---

#### Task 1.3: Implement GlobTool for Agents

- **File:** `/src/agents/code/tools/GlobTool.ts` (NEW)
- **Status:** ❌ NOT IMPLEMENTED
- **Priority:** P1 - HIGH
- **Effort:** 3-4 hours
- **Dependencies:** ContainerManager

**Implementation Requirements:**

```typescript
interface GlobToolInput {
  pattern: string; // Glob pattern like "**/*.ts"
  cwd?: string; // Working directory
  ignore?: string[]; // Patterns to ignore
}

interface GlobToolOutput {
  success: boolean;
  files: string[]; // Matching file paths
  count: number;
  truncated: boolean; // If > 1000 files
}
```

**Steps:**

1. Create GlobTool.ts
2. Use `sanitizeGlobPattern` from security.ts
3. Execute glob in container via bash: `find . -name "pattern"`
4. Or use node glob library if available in sandbox
5. Limit results to 1000 files
6. Register in ToolOrchestrator

---

### PHASE 2: DEBUGGING INFRASTRUCTURE (Days 3-7)

_Impact: Debugging feature is 95% fake - must be real or removed_

#### Task 2.1: Implement CDP Client for Node.js Debugging

- **File:** `/src/lib/debugger/cdp-client.ts` (NEW)
- **Status:** ❌ NOT IMPLEMENTED
- **Priority:** P0 - CRITICAL
- **Effort:** 2-3 days
- **Dependencies:** WebSocket

**Current Problem:**
`debug-adapter.ts` line 290:

```typescript
// In a real implementation, we'd use the Chrome DevTools Protocol here
```

**Implementation Requirements:**

```typescript
// CDP Client must implement:
class CDPClient {
  private ws: WebSocket;
  private requestId = 0;
  private pendingRequests: Map<number, { resolve; reject }>;

  async connect(wsUrl: string): Promise<void>;
  async send(method: string, params?: object): Promise<any>;

  // Required CDP methods:
  async enable(): Promise<void>; // Debugger.enable
  async setBreakpoint(url: string, line: number, condition?: string): Promise<string>;
  async removeBreakpoint(breakpointId: string): Promise<void>;
  async resume(): Promise<void>; // Debugger.resume
  async stepOver(): Promise<void>; // Debugger.stepOver
  async stepInto(): Promise<void>; // Debugger.stepInto
  async stepOut(): Promise<void>; // Debugger.stepOut
  async pause(): Promise<void>; // Debugger.pause
  async getStackTrace(): Promise<StackFrame[]>; // Debugger.getStackTrace
  async getScopes(callFrameId: string): Promise<Scope[]>; // Runtime.getProperties
  async getVariables(objectId: string): Promise<Variable[]>;
  async evaluate(expression: string, callFrameId?: string): Promise<any>;

  // Event handlers:
  on(event: 'paused', handler: (params: PausedEvent) => void): void;
  on(event: 'resumed', handler: () => void): void;
  on(event: 'scriptParsed', handler: (params: ScriptEvent) => void): void;
}
```

**Steps:**

1. Create cdp-client.ts with WebSocket connection
2. Implement JSON-RPC request/response matching
3. Implement all required CDP methods
4. Add event subscription system
5. Handle connection errors and reconnection

---

#### Task 2.2: Connect NodeDebugAdapter to CDP Client

- **File:** `/src/lib/debugger/debug-adapter.ts`
- **Status:** ⚠️ STUBBED
- **Priority:** P0 - CRITICAL
- **Effort:** 1 day
- **Dependencies:** Task 2.1

**Lines to Fix:**

| Line    | Current                      | Required                 |
| ------- | ---------------------------- | ------------------------ |
| 290-293 | Comment + emit 'initialized' | Actually connect CDP     |
| 372-383 | 50ms fake timeout            | Call cdp.stepOver()      |
| 384-395 | 50ms fake timeout            | Call cdp.stepInto()      |
| 396-407 | 50ms fake timeout            | Call cdp.stepOut()       |
| 408-421 | Hardcoded 1 frame            | Call cdp.getStackTrace() |
| 422-434 | Hardcoded Local/Global       | Call cdp.getScopes()     |
| 435-443 | Hardcoded `this`             | Call cdp.getVariables()  |

**Verification:**

- [ ] Breakpoints actually pause execution
- [ ] Step commands move through real code
- [ ] Variables show actual runtime values
- [ ] Stack trace shows real call frames
- [ ] Conditional breakpoints evaluate

---

#### Task 2.3: Implement DAP Client for Python Debugging

- **File:** `/src/lib/debugger/dap-client.ts` (NEW)
- **Status:** ❌ NOT IMPLEMENTED
- **Priority:** P1 - HIGH
- **Effort:** 1.5 days
- **Dependencies:** Task 2.1 pattern

**Implementation:**
Similar to CDP but for Debug Adapter Protocol:

- Socket connection to debugpy on port 5678
- DAP message format (Content-Length headers)
- Initialize, launch, setBreakpoints, continue, next, stepIn, stepOut
- stackTrace, scopes, variables requests

---

### PHASE 3: MCP PROTOCOL INTEGRATION (Days 8-10)

_Impact: MCP claims vs reality mismatch_

#### Task 3.1: Connect Existing mcp-client.ts to Workspace

- **File:** `/src/lib/workspace/mcp.ts`
- **Status:** ⚠️ FACADES ONLY
- **Priority:** P1 - HIGH
- **Effort:** 1-2 days
- **Dependencies:** mcp-client.ts already exists

**Current Problem:**

- `/src/lib/mcp/mcp-client.ts` has REAL MCP implementation
- `/src/lib/workspace/mcp.ts` uses FACADES (direct implementations)
- They are not connected

**Fix Required:**

1. Import MCPClient from mcp-client.ts into workspace/mcp.ts
2. Replace `startServer()` stub with actual process spawn:

```typescript
async startServer(serverId: string): Promise<{ success: boolean }> {
  const config = this.servers.get(serverId);
  if (!config) return { success: false, error: 'Unknown server' };

  // Create real MCP client
  const client = new MCPClient(config);
  await client.connect();  // Actually spawns process!

  // Discover tools dynamically
  const tools = await client.listTools();

  // Register discovered tools
  tools.forEach(tool => {
    this.toolRegistry.set(`mcp__${serverId}__${tool.name}`, {
      ...tool,
      client,  // Store client reference for execution
    });
  });

  this.activeClients.set(serverId, client);
  return { success: true };
}
```

3. Replace `executeTool()` to use real MCP:

```typescript
async executeTool(name: string, input: unknown): Promise<MCPToolResult> {
  const tool = this.toolRegistry.get(name);
  if (!tool?.client) {
    return { success: false, error: 'Tool not found or server not running' };
  }

  // Call via real MCP protocol
  return tool.client.callTool(tool.name, input);
}
```

**Verification:**

- [ ] `npx @modelcontextprotocol/server-filesystem` actually spawns
- [ ] Tools are discovered dynamically from server
- [ ] Tool calls go through JSON-RPC protocol
- [ ] Server lifecycle properly managed

---

### PHASE 4: SHELL & EXECUTION (Days 11-12)

_Impact: Stateless execution limits agent capabilities_

#### Task 4.1: Implement Persistent Shell Sessions

- **File:** `/src/lib/workspace/persistent-shell.ts` (NEW)
- **Status:** ❌ NOT IMPLEMENTED
- **Priority:** P1 - HIGH
- **Effort:** 1-1.5 days

**Implementation:**

```typescript
class PersistentShell {
  private workspaceId: string;
  private shellProcess: ChildProcess | null = null;
  private cwd: string = '/workspace';
  private env: Record<string, string> = {};
  private history: string[] = [];

  async spawn(): Promise<void>;
  async execute(command: string): Promise<ExecutionResult>;
  async setCwd(path: string): Promise<void>;
  async setEnv(key: string, value: string): Promise<void>;
  getHistory(): string[];
  async terminate(): Promise<void>;
}
```

**Key Features:**

- Shell state persists between commands
- `cd` changes are remembered
- Environment variables persist
- Command history available
- Automatic timeout/cleanup

---

#### Task 4.2: Fix Command Validation Bypass Vectors

- **File:** `/src/agents/code/tools/BashTool.ts`
- **Status:** ⚠️ BYPASSABLE
- **Priority:** P2 - MODERATE
- **Effort:** 4-6 hours

**Current Vulnerabilities:**

1. Pipe injection: `npm install && rm -rf /`
2. Command substitution: `echo $(cat /etc/passwd)`
3. Backticks: `echo \`whoami\``

**Fix:**

```typescript
private validateCommandSafety(command: string): ValidationResult {
  // 1. Block command chaining
  if (/[;&|]/.test(command) && !this.isQuotedContext(command)) {
    return { safe: false, reason: 'Command chaining not allowed' };
  }

  // 2. Block command substitution
  if (/\$\(|\`/.test(command)) {
    return { safe: false, reason: 'Command substitution not allowed' };
  }

  // 3. Parse and validate each command in chain
  const commands = this.parseCommandChain(command);
  for (const cmd of commands) {
    const baseCmd = this.extractBaseCommand(cmd);
    if (!ALLOWED_COMMANDS.includes(baseCmd)) {
      return { safe: false, reason: `Command not allowed: ${baseCmd}` };
    }
  }

  return { safe: true };
}
```

---

### PHASE 5: API CONSISTENCY (Days 13-14)

_Impact: Backend mismatch causes data inconsistencies_

#### Task 5.1: Align Edit API with Files API Backend

- **File:** `/app/api/code-lab/edit/route.ts`
- **Status:** ⚠️ MISMATCHED
- **Priority:** P2 - MODERATE
- **Effort:** 4-6 hours

**Current Problem:**

- Edit API uses Supabase storage (line 30 has TODO comment)
- Files API uses ContainerManager (E2B)
- Edits don't reflect in container files!

**Fix:**
Change Edit API to use ContainerManager:

```typescript
// Before (wrong):
const { data: fileData } = await supabase.storage...

// After (correct):
const container = getContainerManager();
const fileContent = await container.readFile(workspaceId, filePath);
// ... apply edits ...
await container.writeFile(workspaceId, filePath, newContent);
```

---

#### Task 5.2: Fix Diff Generation Bug

- **File:** `/src/lib/workspace/surgical-edit.ts`
- **Status:** ⚠️ BUG
- **Priority:** P2 - MODERATE
- **Effort:** 1-2 hours

**Bug at line 242:**

```typescript
// Current (wrong):
const diffs = generateDiffs(originalLines, newLines, edits);

// Fix (correct):
const diffs = generateDiffs(originalLines, newLines, sortedEdits);
```

The `sortedEdits` are applied bottom-to-top, but diffs are generated with unsorted edits, causing incorrect line numbers.

---

#### Task 5.3: Implement Backup Retrieval/Restore

- **File:** `/src/lib/workspace/surgical-edit.ts`
- **Status:** ⚠️ INCOMPLETE
- **Priority:** P3 - LOW
- **Effort:** 3-4 hours

**Current State:**

- `backupId` is generated (line 248-250)
- No storage location
- No retrieval mechanism

**Implementation:**

```typescript
// Store backup
const backupId = uuidv4();
await supabase.from('file_backups').insert({
  id: backupId,
  workspace_id: workspaceId,
  file_path: filePath,
  content: originalContent,
  created_at: new Date().toISOString(),
});

// Retrieve backup
async function restoreBackup(backupId: string): Promise<void> {
  const { data } = await supabase.from('file_backups').select('*').eq('id', backupId).single();

  await container.writeFile(data.workspace_id, data.file_path, data.content);
}
```

---

### PHASE 6: SECURITY & RELIABILITY (Days 15-16)

#### Task 6.1: Add API Rate Limiting

- **Files:** All `/app/api/code-lab/*/route.ts`
- **Status:** ⚠️ MISSING
- **Priority:** P2 - MODERATE
- **Effort:** 4-6 hours

**Implementation:**

```typescript
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.authorized) return auth.response;

  // Add rate limiting
  const rateLimitResult = await rateLimit({
    userId: auth.user.id,
    endpoint: 'code-lab/shell',
    limit: 60, // requests
    window: 60000, // per minute
  });

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retryAfter: rateLimitResult.retryAfter },
      { status: 429 }
    );
  }

  // ... rest of handler
}
```

---

#### Task 6.2: Improve Glob Pattern Implementation

- **File:** `/src/agents/code/tools/SearchTool.ts`
- **Status:** ⚠️ NAIVE
- **Priority:** P3 - LOW
- **Effort:** 2-3 hours

**Current Problem (lines 340-346):**

```typescript
private globToRegex(glob: string): RegExp {
  // Doesn't support: **, !, [abc], {a,b}
}
```

**Fix:**

```bash
pnpm add minimatch
```

```typescript
import { minimatch } from 'minimatch';

private matchGlob(filename: string, pattern: string): boolean {
  return minimatch(filename, pattern, { dot: true });
}
```

---

### PHASE 7: POLISH & VERIFICATION (Days 17-18)

#### Task 7.1: Add Comprehensive Tests

- **Files:** `*.test.ts` for each module
- **Status:** ⚠️ MINIMAL
- **Priority:** P2 - MODERATE
- **Effort:** 2-3 days

**Required Test Coverage:**

- [ ] WriteTool unit tests
- [ ] ReadTool container integration tests
- [ ] GlobTool tests
- [ ] CDP client tests (mock WebSocket)
- [ ] MCP integration tests
- [ ] Persistent shell tests
- [ ] Edit API integration tests
- [ ] Diff generation tests
- [ ] Rate limiting tests

---

#### Task 7.2: Update Pair Programming Messaging

- **Files:** UI components
- **Status:** ⚠️ OVERPROMISES
- **Priority:** P3 - LOW
- **Effort:** 2-3 hours

**Changes:**

- Rename "Real-time Pair Programming" → "Smart Code Suggestions"
- Update descriptions to match actual 500ms debounce behavior
- Or: Implement true real-time streaming (significant effort)

---

## VERIFICATION CHECKLIST

After completing all tasks, run this checklist:

### Agent Tools

- [ ] Agent can READ files from workspace container
- [ ] Agent can WRITE files to workspace container
- [ ] Agent can GLOB files with proper patterns
- [ ] Agent can execute BASH with persistent shell state

### Debugging

- [ ] Breakpoints ACTUALLY pause Node.js execution
- [ ] Step Over moves to next line
- [ ] Step Into enters function calls
- [ ] Step Out exits current function
- [ ] Variables show REAL runtime values
- [ ] Stack trace shows REAL call frames
- [ ] Python debugging works similarly

### MCP

- [ ] MCP servers ACTUALLY spawn as processes
- [ ] Tools are DYNAMICALLY discovered
- [ ] Tool calls use JSON-RPC protocol
- [ ] Server lifecycle properly managed

### File Operations

- [ ] Edit API uses same backend as Files API
- [ ] Edits persist in workspace container
- [ ] Diff generation has correct line numbers
- [ ] Backups can be retrieved and restored

### Security

- [ ] Command injection attacks blocked
- [ ] Rate limiting enforced on all endpoints
- [ ] Path traversal attacks blocked

---

## SESSION HANDOFF NOTES

### If Context Runs Out

**Current Progress:** Check the `CODE_LAB_100_PERCENT_PLAN.md` file

**Git Branch:** `claude/audit-coding-lab-hLMWt`

**Last Commit:** `d4043a7` - WebSocket server implementation

**Key Files Modified This Session:**

- `/src/lib/realtime/websocket-server.ts` - Full WS implementation
- `/package.json` - Added ws, uuid, @types/ws, @types/uuid
- `/src/lib/workspace/surgical-edit.ts` - Fixed unused parameter

**Next Task to Start:** Task 1.1 - Implement WriteTool

**Critical Context:**

1. E2B is the sandbox provider (E2B_API_KEY required)
2. Auth uses Supabase with `requireUser` from `@/lib/auth/user-guard`
3. ContainerManager at `/src/lib/workspace/container.ts` handles E2B
4. mcp-client.ts EXISTS and is REAL but NOT CONNECTED to workspace

### Command to Resume

```bash
git checkout claude/audit-coding-lab-hLMWt
cat CODE_LAB_100_PERCENT_PLAN.md
```

---

## EFFORT SUMMARY

| Phase          | Tasks  | Effort      | Priority    |
| -------------- | ------ | ----------- | ----------- |
| 1. Agent Tools | 3      | 2 days      | P0 CRITICAL |
| 2. Debugging   | 3      | 5 days      | P0 CRITICAL |
| 3. MCP         | 1      | 2 days      | P1 HIGH     |
| 4. Shell       | 2      | 2 days      | P1 HIGH     |
| 5. API         | 3      | 2 days      | P2 MODERATE |
| 6. Security    | 2      | 2 days      | P2 MODERATE |
| 7. Polish      | 2      | 3 days      | P3 LOW      |
| **TOTAL**      | **16** | **18 days** |             |

---

## DEFINITION OF DONE

Code Lab is 100% operational when:

1. **Every feature works as advertised** - No stubs, no facades
2. **All tests pass** - Comprehensive coverage
3. **Security audit passes** - No injection vulnerabilities
4. **Third-party audit scores 95+/100** - Independent verification
5. **Documentation accurate** - Features match descriptions

---

_Document created: 2026-01-18_
_Author: Claude (Chief Software Engineer)_
_Version: 1.0_
