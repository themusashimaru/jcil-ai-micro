# CODE LAB CRITICAL BUGS REPORT

**Date:** 2026-01-19
**Auditor:** Claude Code Audit
**Branch:** `claude/audit-coding-lab-hLMWt`
**Status:** FIXES APPLIED

---

## EXECUTIVE SUMMARY

The Code Lab had **6 CRITICAL bugs** and **4 HIGH severity bugs** that break core functionality. **All critical bugs have been fixed.**

### Fixed Issues:

1. ✅ **Database table mismatch** - ContainerManager now queries `code_lab_workspaces`
2. ✅ **Git authentication** - Credential helper configured before clone/push/pull
3. ✅ **Session/Workspace ID confusion** - Now uses `sandbox_id` field consistently
4. ✅ **Command injection vulnerabilities** - All branch names sanitized and escaped

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

---

## RECOMMENDED FOLLOW-UP ACTIONS

1. ✅ ~~Create database migration to standardize on `sandbox_id`~~ - Using existing field
2. ✅ ~~Fix ContainerManager to query `code_lab_workspaces` table~~ - DONE
3. ✅ ~~Add git credential configuration before clone/push/pull~~ - DONE
4. ✅ ~~Sanitize all branch names with `sanitizeBranchName()` + `escapeShellArg()`~~ - DONE
5. **Add integration tests** that actually exercise the full flow (PENDING)

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
