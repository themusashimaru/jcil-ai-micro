# CODE LAB CRITICAL BUGS REPORT

**Date:** 2026-01-21
**Auditor:** Claude Code Audit
**Branch:** `claude/audit-coding-lab-HTLuo`
**Status:** FIXES APPLIED

---

## EXECUTIVE SUMMARY

The Code Lab had **7 CRITICAL bugs** and **4 HIGH severity bugs** that break core functionality. **All critical bugs have been fixed.**

### Fixed Issues:

1. ✅ **Database table mismatch** - ContainerManager now queries `code_lab_workspaces`
2. ✅ **Git authentication** - Credential helper configured before clone/push/pull
3. ✅ **Session/Workspace ID confusion** - Now uses `sandbox_id` field consistently
4. ✅ **Command injection vulnerabilities** - All branch names sanitized and escaped
5. ✅ **Chat route workspace lookup** - Now queries by `session_id` not `user_id`
6. ✅ **WorkspaceAgent ID mismatch** - Chat route now passes `sessionId` correctly
7. ✅ **Path traversal vulnerability** - `normalizePath()` now sanitizes paths
8. ✅ **Workspace upsert** - ContainerManager now uses upsert instead of update
9. ✅ **Error message persistence** - All error handlers now save messages to maintain conversation history
10. ✅ **Multi-provider routing** - Chat route now routes to correct provider based on model ID (2026-01-21)

---

## CRITICAL BUGS (Severity: CRITICAL - System Broken)

### BUG #1: Database Table Name Mismatch ✅ FIXED

**Severity:** 🔴 CRITICAL → ✅ RESOLVED
**Impact:** Containers never found/reused, new containers created every request
**Files:**

- `src/lib/workspace/container.ts:109, 199, 691, 719` - Uses `workspaces` table
- `app/api/code-lab/chat/route.ts:582, 615, 638` - Uses `code_lab_workspaces` table

**Problem:**

```typescript
// container.ts queries the WRONG table
const { data: workspace } = await this.supabase
  .from('workspaces') // ❌ WRONG TABLE
  .select('container_id')
  .eq('id', workspaceId)
  .single();

// chat/route.ts creates in the CORRECT table
const { data: workspaceData } = await supabase.from('code_lab_workspaces'); // ✅ CORRECT TABLE
```

**Fix:**
Change all `container.ts` references from `'workspaces'` to `'code_lab_workspaces'`.

---

### BUG #2: Git Authentication Not Configured for Shell Commands ✅ FIXED

**Severity:** 🔴 CRITICAL → ✅ RESOLVED
**Impact:** Git clone, push, pull fail for ALL repositories (private AND public with push)
**Files:**

- `src/lib/workspace/github-sync.ts:108-109` - Clone without auth
- `src/lib/workspace/github-sync.ts:254-256` - Push without auth
- `src/lib/workspace/github-sync.ts:299-301` - Pull without auth

**Problem:**

```typescript
// The GitHub token is ONLY used for Octokit API calls
this.octokit = new Octokit({ auth: accessToken });

// But git commands run WITHOUT authentication!
const cloneResult = await executeShell(
  `git clone --depth 50 ${this.repo.cloneUrl} /workspace/repo` // ❌ NO AUTH
);

const pushResult = await executeShell(
  `cd /workspace/repo && git push origin ${branch}` // ❌ NO AUTH
);
```

**Fix:**
Configure git credentials before running commands:

```typescript
// Option A: Use token in URL
const authUrl = `https://${token}@github.com/${owner}/${repo}.git`;
await executeShell(`git clone ${authUrl} /workspace/repo`);

// Option B: Configure credential helper
await executeShell(`git config --global credential.helper store`);
await executeShell(`echo "https://${token}:x-oauth-basic@github.com" > ~/.git-credentials`);
```

---

### BUG #3: Container ID vs Sandbox ID Field Mismatch ✅ FIXED

**Severity:** 🔴 CRITICAL → ✅ RESOLVED
**Impact:** Sandboxes never reconnected, resources wasted
**Files:**

- `src/lib/workspace/container.ts:111` - Writes `container_id`
- `app/api/code-lab/chat/route.ts:620` - Writes `sandbox_id`
- `src/lib/workspace/container.ts:204` - Reads `container_id`

**Problem:**

```typescript
// container.ts saves as container_id
await this.supabase.from('workspaces').update({
  container_id: sandbox.sandboxId,  // ❌ Wrong field name
});

// chat/route.ts saves as sandbox_id
.insert({
  sandbox_id: sandboxId,  // ✅ Correct field name
});

// container.ts looks for container_id (not found!)
if (workspace?.container_id) {  // ❌ Will be undefined
  sandbox = await Sandbox.connect(workspace.container_id);
}
```

**Fix:**
Standardize on `sandbox_id` everywhere OR create a migration to add `container_id` column.

---

### BUG #4: Command Injection in Branch Operations ✅ FIXED

**Severity:** 🔴 CRITICAL → ✅ RESOLVED
**Impact:** Remote code execution via malicious branch names
**Files:**

- `src/lib/workspace/github-sync.ts:362` - `createBranch`
- `src/lib/workspace/github-sync.ts:381` - `switchBranch`
- `src/lib/workspace/github-sync.ts:299-301` - `pullChanges`

**Problem:**

```typescript
// Branch name NOT sanitized before shell execution
async createBranch(branchName: string, executeShell): Promise<boolean> {
  const result = await executeShell(
    `cd /workspace/repo && git checkout -b ${branchName}`  // ❌ INJECTION RISK
  );
}

// Attack: branchName = "main; rm -rf /"
```

**Fix:**

```typescript
import { sanitizeBranchName, escapeShellArg } from '@/lib/security/shell-escape';

async createBranch(branchName: string, executeShell): Promise<boolean> {
  const safeBranch = sanitizeBranchName(branchName);
  const result = await executeShell(
    `cd /workspace/repo && git checkout -b ${escapeShellArg(safeBranch)}`  // ✅ SAFE
  );
}
```

---

### BUG #5: Session ID Used as Workspace ID ✅ FIXED

**Severity:** 🔴 CRITICAL → ✅ RESOLVED
**Impact:** ContainerManager cannot find workspaces, operations fail
**Files:**

- `app/api/code-lab/git/route.ts:153` - Passes `sessionId` as workspaceId
- `app/api/code-lab/files/route.ts:83-87` - Passes `sessionId` as workspaceId
- `src/lib/workspace/container.ts:192-225` - Expects actual workspace ID

**Problem:**

```typescript
// Git API passes SESSION ID
const container = new ContainerManager();
const result = await container.executeCommand(sessionId, cmd); // ❌ sessionId != workspaceId

// Container looks up by workspace ID in 'workspaces' table
const { data: workspace } = await this.supabase
  .from('workspaces')
  .select('container_id')
  .eq('id', workspaceId); // ❌ workspaceId is actually sessionId!
```

**Fix:**
Either:

1. Look up workspace ID from session: `SELECT workspace_id FROM code_lab_sessions WHERE id = sessionId`
2. Or use session ID as the primary key in `code_lab_workspaces`

---

### BUG #6: Chat API Creates Workspace Without Container ✅ FIXED

**Severity:** 🔴 CRITICAL → ✅ RESOLVED
**Impact:** First message in session fails, no container available
**Files:**

- `app/api/code-lab/chat/route.ts:582-638`

**Problem:**
The chat route creates a workspace record but relies on ContainerManager to create the actual E2B sandbox. However, ContainerManager looks in the wrong table (see Bug #1), so no sandbox is ever created.

---

## HIGH SEVERITY BUGS

### BUG #7: Inconsistent Path Handling

**Severity:** 🟠 HIGH
**Impact:** File operations may fail or operate on wrong files
**Files:**

- `src/lib/workspace/chat-integration.ts:762-763`

**Problem:**

```typescript
// normalizePath prepends /workspace
private normalizePath(path: string): string {
  if (path.startsWith('/')) return path;
  return `/workspace/${path}`;
}

// But cloneRepository uses /workspace/repo
await syncBridge.cloneToWorkspace(executeShell);  // Clones to /workspace/repo

// File operations expect /workspace
await container.readFile(workspaceId, '/workspace/src/index.ts');  // ❌ File is at /workspace/repo/src/index.ts
```

---

### BUG #8: Pull Uses Unsanitized Branch

**Severity:** 🟠 HIGH
**Files:**

- `src/lib/workspace/github-sync.ts:299-301`

**Problem:**

```typescript
const pullResult = await executeShell(
  `cd /workspace/repo && git pull origin ${this.currentBranch}` // ❌ Not escaped
);
```

---

### BUG #9: Missing Error Propagation in Chat Agent

**Severity:** 🟠 HIGH
**Files:**

- `src/lib/workspace/chat-integration.ts:746-759`

**Problem:**
Shell execution errors are silently caught and returned as strings, making debugging difficult:

```typescript
case 'execute_shell': {
  const result = await this.container.executeCommand(...);
  // Error handling just returns the error as output
  let output = '';
  if (result.stdout) output += result.stdout;
  if (result.stderr) output += result.stderr;  // ❌ Errors mixed with output
  return output || '[No output]';
}
```

---

### BUG #10: Race Condition in Sandbox Management

**Severity:** 🟠 HIGH
**Files:**

- `src/lib/workspace/container.ts:192-225`

**Problem:**

```typescript
async getSandbox(workspaceId: string): Promise<Sandbox> {
  let sandbox = this.activeSandboxes.get(workspaceId);

  if (!sandbox) {
    // Database lookup (async)
    const { data: workspace } = await this.supabase...

    if (workspace?.container_id) {
      // Another request could start here while first one is connecting
      sandbox = await Sandbox.connect(workspace.container_id);  // Race!
      this.activeSandboxes.set(workspaceId, sandbox);
    }
  }
}
```

---

## MEDIUM SEVERITY BUGS

### BUG #11: Commit Message Escaping Inconsistent

**Files:** Multiple
**Problem:** Different escaping methods used in different places

```typescript
// container.ts uses escapeShellArg + sanitizeCommitMessage
const escaped = escapeShellArg(sanitized);
await this.run(`git commit -m ${escaped}`);

// git route uses only sanitizeCommitMessage with single quotes
const safeMessage = sanitizeCommitMessage(message);
await executeShell(`git commit -m '${safeMessage}'`);

// chat-integration.ts uses sanitizeCommitMessage with single quotes
await this.container.executeCommand(..., `git commit -m '${safeMessage}'`);
```

---

### BUG #12: No Workspace Cleanup on Session Delete

**Files:**

- Session deletion doesn't terminate associated containers
- E2B sandboxes keep running and billing continues

---

## FIX PRIORITY ORDER

1. **BUG #1** - Database table mismatch (blocks everything)
2. **BUG #3** - Field name mismatch (blocks container reconnection)
3. **BUG #5** - Session vs Workspace ID (blocks all operations)
4. **BUG #2** - Git authentication (blocks all git operations)
5. **BUG #4** - Command injection (security critical)
6. **BUG #6** - Chat container creation (blocks first message)
7. **BUG #7-10** - High severity (functionality issues)

---

## FIXES APPLIED (January 19, 2026)

### 1. ContainerManager Database Fix (`src/lib/workspace/container.ts`)

```typescript
// BEFORE: Wrong table and field names
const { data: workspace } = await this.supabase
  .from('workspaces') // ❌ Wrong table
  .select('container_id'); // ❌ Wrong field

// AFTER: Correct table and field names
const { data: workspace } = await this.supabase
  .from('code_lab_workspaces') // ✅ Correct table
  .select('sandbox_id') // ✅ Correct field
  .eq('session_id', workspaceId); // ✅ Correct lookup key
```

### 2. Git Authentication Fix (`src/lib/workspace/github-sync.ts`)

Added `configureGitCredentials()` method that:

- Sets up git credential helper before clone/push/pull operations
- Stores GitHub token securely in `~/.git-credentials` with 600 permissions
- Configures git user email and name for commits

```typescript
private async configureGitCredentials(executeShell): Promise<void> {
  await executeShell(`git config --global credential.helper store`);
  await executeShell(
    `echo "https://${escapeShellArg(this.accessToken)}:x-oauth-basic@github.com" > ~/.git-credentials`
  );
  await executeShell(`chmod 600 ~/.git-credentials`);
}
```

### 3. Command Injection Prevention (`src/lib/workspace/github-sync.ts`)

All git operations now sanitize and escape inputs:

```typescript
// createBranch - sanitized
const safeBranch = sanitizeBranchName(branchName);
await executeShell(`git checkout -b ${escapeShellArg(safeBranch)}`);

// switchBranch - sanitized
const safeBranch = sanitizeBranchName(branchName);
await executeShell(`git checkout ${escapeShellArg(safeBranch)}`);

// pullChanges - sanitized
const safeBranch = sanitizeBranchName(this.currentBranch);
await executeShell(`git pull origin ${escapeShellArg(safeBranch)}`);
```

### 4. Chat Route Workspace ID Fix (`app/api/code-lab/chat/route.ts`) ✅ FIXED

**Problem:** Chat route queried workspace by `user_id` instead of `session_id`, causing sessions to share workspaces unintentionally. Also passed `workspace.id` instead of `sessionId` to WorkspaceAgent.

```typescript
// BEFORE: Wrong lookup and wrong ID passed
const { data: workspaceData } = await supabase
  .from('code_lab_workspaces')
  .eq('user_id', user.id)  // ❌ Gets any user's workspace
  ...

const workspaceStream = await executeWorkspaceAgent(content, {
  workspaceId,  // ❌ This was workspace.id, not sessionId
  ...
});

// AFTER: Session-specific lookup and correct ID
const { data: workspaceData } = await supabase
  .from('code_lab_workspaces')
  .eq('session_id', sessionId)  // ✅ Gets THIS session's workspace
  .eq('user_id', user.id)
  ...

const workspaceStream = await executeWorkspaceAgent(content, {
  workspaceId: sessionId,  // ✅ Pass sessionId since ContainerManager queries by session_id
  ...
});
```

### 5. Path Traversal Prevention (`src/lib/workspace/chat-integration.ts`) ✅ FIXED

**Problem:** `normalizePath()` didn't sanitize paths, allowing traversal attacks like `/../etc/passwd`.

```typescript
// BEFORE: No sanitization
private normalizePath(path: string): string {
  if (path.startsWith('/')) return path;  // ❌ Allows /../etc/passwd
  return `/workspace/${path}`;
}

// AFTER: Sanitized paths
private normalizePath(path: string): string {
  const sanitized = sanitizeFilePath(path);  // ✅ Remove traversals
  if (sanitized.startsWith('/workspace/')) return sanitized;
  if (sanitized.startsWith('/')) {
    return `/workspace/${sanitized.slice(1)}`;  // Confine to workspace
  }
  return `/workspace/${sanitized}`;
}
```

### 6. Workspace Upsert Fix (`src/lib/workspace/container.ts`) ✅ FIXED

**Problem:** `createContainer()` did an UPDATE which silently failed if no workspace row existed (e.g., when user accesses files/git before sending first chat message).

```typescript
// BEFORE: Silent failure if row doesn't exist
await this.supabase
  .from('code_lab_workspaces')
  .update({ sandbox_id: sandbox.sandboxId })  // ❌ Fails silently
  .eq('session_id', workspaceId);

// AFTER: Upsert creates row if missing
await this.supabase
  .from('code_lab_workspaces')
  .upsert(
    {
      session_id: workspaceId,
      sandbox_id: sandbox.sandboxId,
      status: 'active',
      ...
    },
    { onConflict: 'session_id' }  // ✅ Creates or updates
  );
```

### 7. Error Message Persistence (`app/api/code-lab/chat/route.ts`) ✅ FIXED

**Problem:** Error handlers didn't save assistant messages, causing conversation history to become misaligned (user message without matching assistant response).

```typescript
// BEFORE: Error streamed but not saved
} catch (error) {
  controller.enqueue(encoder.encode('Error...'));
  controller.close();  // ❌ Message not saved!
}

// AFTER: Error saved to maintain conversation history
} catch (error) {
  const errorContent = 'Error...';
  fullContent += errorContent;
  await supabase.from('code_lab_messages').insert({
    session_id: sessionId,
    role: 'assistant',
    content: fullContent || errorContent,
    type: 'error',  // ✅ Saved for history
  });
  controller.enqueue(encoder.encode(errorContent));
  controller.close();
}
```

---

## RECOMMENDED FOLLOW-UP ACTIONS

1. ✅ ~~Create database migration to standardize on `sandbox_id`~~ - Using existing field
2. ✅ ~~Fix ContainerManager to query `code_lab_workspaces` table~~ - DONE
3. ✅ ~~Add git credential configuration before clone/push/pull~~ - DONE
4. ✅ ~~Sanitize all branch names with `sanitizeBranchName()` + `escapeShellArg()`~~ - DONE
5. ✅ ~~Fix chat route workspace lookup by session_id~~ - DONE
6. ✅ ~~Fix chat route to pass sessionId to WorkspaceAgent~~ - DONE
7. ✅ ~~Add path traversal prevention in normalizePath~~ - DONE
8. ✅ ~~Use upsert for workspace creation~~ - DONE
9. ✅ ~~Save error messages to maintain conversation history~~ - DONE
10. ✅ ~~Fix multi-provider routing in chat route~~ - DONE (2026-01-21)
11. **Add integration tests** that actually exercise the full flow (PENDING)

---

## BUG #11: Multi-Provider Model Routing ✅ FIXED (2026-01-21)

**Severity:** 🔴 CRITICAL → ✅ RESOLVED
**Impact:** All non-Claude models (GPT-5.2, Grok 4, DeepSeek, Gemini) returned 404 errors
**Files:**

- `app/api/code-lab/chat/route.ts` - All requests sent to Anthropic API regardless of model
- `src/lib/ai/providers/registry.ts` - Missing model-to-provider lookup functions

### Symptoms

Users selecting non-Claude models saw immediate errors:

```json
{
  "type": "error",
  "error": {
    "type": "not_found_error",
    "message": "model: gpt-5.2"
  },
  "request_id": "req_011CXLt37YKqzfsBrXepcyEW"
}
```

**Key Diagnostic:** The `request_id` format (`req_011CXLt...`) is Anthropic's format, proving requests were being sent to Anthropic's API even for non-Anthropic models.

### Root Cause

The chat route (`app/api/code-lab/chat/route.ts`) was hardcoded to use only the Anthropic client:

```typescript
// BEFORE: All models sent to Anthropic API
const response = await anthropic.messages.create({
  model: selectedModel, // e.g., "gpt-5.2" - doesn't exist in Anthropic!
  ...
});
```

The route did not:

1. Check which provider the selected model belonged to
2. Use the appropriate adapter (OpenAI, xAI, DeepSeek, or Google)
3. Route requests to the correct API endpoint

### Solution Applied

**1. Added model-to-provider lookup functions to registry (`src/lib/ai/providers/registry.ts:437-458`):**

```typescript
/**
 * Get provider ID for a given model ID
 */
export function getProviderForModel(modelId: string): ProviderId | undefined {
  for (const provider of Object.values(PROVIDERS)) {
    if (provider.models.some((m) => m.id === modelId)) {
      return provider.id;
    }
  }
  return undefined;
}

/**
 * Get provider and model configuration for a given model ID
 */
export function getProviderAndModel(
  modelId: string
): { provider: ProviderConfig; model: ModelConfig } | undefined {
  for (const provider of Object.values(PROVIDERS)) {
    const model = provider.models.find((m) => m.id === modelId);
    if (model) {
      return { provider, model };
    }
  }
  return undefined;
}
```

**2. Updated chat route to route by provider (`app/api/code-lab/chat/route.ts:1326-1603`):**

```typescript
// Determine which provider to use based on the selected model
const providerId = getProviderForModel(selectedModel);
const providerInfo = getProviderAndModel(selectedModel);

log.info('Chat request', {
  model: selectedModel,
  provider: providerId || 'unknown',
  modelName: providerInfo?.model.name || 'unknown'
});

// NON-CLAUDE PROVIDERS (OpenAI, xAI, DeepSeek, Google)
if (providerId && providerId !== 'claude') {
  const adapter = getAdapter(providerId);
  const chatStream = adapter.chat(unifiedMessages, {
    model: selectedModel,
    maxTokens: providerInfo?.model.maxOutputTokens || 8192,
    temperature: 0.7,
    systemPrompt,
  });
  // ... stream handling ...
}

// CLAUDE PROVIDER (Anthropic) - Default
// Uses native Anthropic SDK for extended thinking support
const response = await anthropic.messages.create(...);
```

### How to Diagnose This Issue in Future

1. **Check error request_id format:**
   - Anthropic: `req_011CXLt...`
   - OpenAI: `chatcmpl-...`
   - If you see Anthropic format for non-Claude model, routing is broken

2. **Check logs for provider detection:**

   ```
   [CodeLabChat] Chat request {"model":"gpt-5.2","provider":"openai","modelName":"GPT-5.2"}
   [CodeLabChat] Using non-Claude provider {"providerId":"openai","model":"gpt-5.2"}
   ```

3. **Verify adapter factory is creating correct clients:**
   - `src/lib/ai/providers/adapters/factory.ts` should cache and return correct adapters
   - `src/lib/ai/providers/adapters/openai-compatible.ts` for OpenAI/xAI/DeepSeek
   - `src/lib/ai/providers/adapters/google.ts` for Gemini models

### Related Files for Multi-Provider Support

| File                                                 | Purpose                                  |
| ---------------------------------------------------- | ---------------------------------------- |
| `src/lib/ai/providers/registry.ts`                   | Model configurations for all 5 providers |
| `src/lib/ai/providers/types.ts`                      | Unified message/chunk types              |
| `src/lib/ai/providers/adapters/factory.ts`           | Creates provider-specific adapters       |
| `src/lib/ai/providers/adapters/openai-compatible.ts` | OpenAI, xAI, DeepSeek adapter            |
| `src/lib/ai/providers/adapters/google.ts`            | Google Gemini adapter                    |
| `app/api/code-lab/chat/route.ts`                     | Main chat endpoint with routing logic    |
| `src/components/code-lab/CodeLabComposer.tsx`        | UI model selector                        |
| `src/components/code-lab/CodeLabMessage.tsx`         | Model display names                      |

### Test Commands

```bash
# Test Claude model (should use Anthropic API)
curl -X POST /api/code-lab/chat -d '{"modelId":"claude-opus-4-5-20251101","content":"Hello"}'

# Test OpenAI model (should use OpenAI-compatible adapter)
curl -X POST /api/code-lab/chat -d '{"modelId":"gpt-5.2","content":"Hello"}'

# Test xAI model (should use OpenAI-compatible adapter with xAI base URL)
curl -X POST /api/code-lab/chat -d '{"modelId":"grok-4","content":"Hello"}'

# Test Google model (should use Google adapter)
curl -X POST /api/code-lab/chat -d '{"modelId":"gemini-3-pro-preview","content":"Hello"}'
```

### Commit Reference

```
commit 2e788a6
fix(code-lab): route chat requests to correct provider based on model ID
```

---

## TEST COMMANDS TO VERIFY FIXES

```bash
# Test 1: Create session and verify container is created
curl -X POST /api/code-lab/sessions -d '{"name":"Test"}'
# Check code_lab_workspaces table has sandbox_id set

# Test 2: Clone private repo
curl -X POST /api/code-lab/git -d '{"sessionId":"...", "operation":"clone", "repo":{"owner":"...", "name":"..."}}'
# Should succeed for private repos

# Test 3: Push changes
curl -X POST /api/code-lab/git -d '{"sessionId":"...", "operation":"push", "message":"test"}'
# Should succeed without "authentication required" error

# Test 4: File operations
curl -X GET /api/code-lab/files?sessionId=...&path=/workspace/package.json
# Should return file contents
```
