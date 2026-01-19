# Code Lab → 100% Parity Roadmap

**Started:** January 2026
**Current Score:** 52/100
**Target:** 100/100
**Status:** IN PROGRESS

---

## Session Continuity Notes

**IMPORTANT FOR NEXT SESSION:**

- This file tracks ALL progress toward 100% parity
- Check the `[x]` boxes to see what's done
- Continue from the first unchecked `[ ]` task
- Read the "Current Progress" section below for context

---

## Current Progress

**Last Updated:** Session 2 - Phase 3 Complete
**Current Phase:** Phase 4 - Real Debugger (Starting)
**Current Task:** Research & Setup DAP
**Blockers:** None
**Estimated Score:** ~80/100

### Completed Work:

1. ✅ Phase 1.3: Connected Pair Programming UI to Backend
   - Created `/api/code-lab/pair-programming` route
   - Updated `usePairProgramming` hook with real API calls
   - Added onCodeEdit, onFileOpen, getCompletion, analyzeCode methods

2. ✅ Phase 1.5: Fixed Shell Simulation
   - Replaced fake responses with honest error messages
   - Clear instructions on configuring sandbox

3. ✅ Phase 2: Implemented Real Edit Tool
   - Created `src/lib/workspace/surgical-edit.ts` with full implementation
   - Created `/api/code-lab/edit` endpoint
   - Updated agent.ts with line-based editing support
   - Added `surgical_edit` tool for multi-edit batching
   - Supports dry-run preview mode

4. ✅ Phase 3: WebSocket Foundation Complete
   - WebSocket server already implemented (`src/lib/realtime/websocket-server.ts`)
   - Client hook already implemented (`src/lib/realtime/useWebSocket.ts`)
   - Created presence database migration (`20260119_add_presence_table.sql`)
   - Created SSE fallback API route (`/api/code-lab/realtime`)
   - Created presence service with Supabase integration (`presence-service.ts`)
   - Integrated collaboration manager with broadcasts

---

## Master Task List

### PHASE 1: BUILD REAL BACKENDS (52 → 60/100)

_Goal: Connect UIs to real functionality (not disable them)_

#### 1.3 Connect Pair Programming UI to Backend ✅ COMPLETE

- [x] Read existing pair-programmer library at src/lib/pair-programmer/
- [x] Read CodeLabPairProgramming.tsx component
- [x] Identify the connection points needed
- [x] Create API route /api/code-lab/pair-programming
- [x] Wire usePairProgramming hook to make real API calls
- [x] Added onCodeEdit, onFileOpen, getCompletion, analyzeCode

#### 1.5 Fix Shell Simulation - Show Honest Errors ✅ COMPLETE

- [x] Find BashTool.ts simulation code
- [x] Replace fake responses with clear error message
- [x] Error says: "Sandbox not configured" with setup instructions
- [x] Returns proper error status

---

### PHASE 2: REAL EDIT TOOL (60 → 70/100) ✅ COMPLETE

_Goal: Implement surgical line-based editing like Claude Code_

#### 2.1 Design Edit Tool Interface ✅ COMPLETE

- [x] Define SurgicalEdit interface with line numbers
- [x] Support single edits and batch edits
- [x] Support dry-run mode for preview
- [x] Design conflict detection strategy

#### 2.2 Implement Edit Tool Backend ✅ COMPLETE

- [x] Created src/lib/workspace/surgical-edit.ts
- [x] Created /api/code-lab/edit endpoint
- [x] Implement line-based file reading
- [x] Implement line-range replacement
- [x] Add validation (file exists, lines valid, etc.)
- [x] Handle edge cases (empty files, EOF, etc.)

#### 2.3 Integrate Edit Tool with Agent ✅ COMPLETE

- [x] Update agent.ts tool definitions
- [x] Added surgical_edit tool for batch operations
- [x] Enhanced edit_file with line-based editing
- [x] Maintains legacy text-based support

#### 2.4 Add Edit Tool UI Feedback

- [ ] Show diff preview before applying (TODO)
- [ ] Highlight changed lines (TODO)
- [ ] Show line numbers in edit confirmation

---

### PHASE 3: WEBSOCKET FOUNDATION (70 → 80/100) ✅ COMPLETE

_Goal: Real-time infrastructure for future features_

#### 3.1 Set Up WebSocket Server ✅ COMPLETE

- [x] Install ws or socket.io package (ws already installed)
- [x] Create WebSocket handler (`src/lib/realtime/websocket-server.ts`)
- [x] Create SSE fallback API route (`/api/code-lab/realtime`)
- [x] Implement connection management with session tracking
- [x] Add authentication/session validation via Supabase
- [x] Handle reconnection gracefully with ping/pong heartbeat

#### 3.2 Implement Presence System ✅ COMPLETE

- [x] Create presence database table (`code_lab_presence`)
- [x] Created migration: `20260119_add_presence_table.sql`
- [x] Track active users per session with cursor/selection info
- [x] Broadcast join/leave events via WebSocket
- [x] Implement heartbeat/ping for stale detection (30s interval)
- [x] Clean up stale sessions (5 minute timeout)
- [x] Created presence service (`src/lib/realtime/presence-service.ts`)

#### 3.3 Create WebSocket Client Hook ✅ COMPLETE

- [x] Create useWebSocket hook (`src/lib/realtime/useWebSocket.ts`)
- [x] Handle connection lifecycle with state management
- [x] Implement message sending/receiving
- [x] Add reconnection logic with exponential backoff
- [x] Export for use in components via `@/lib/realtime`
- [x] Create usePresence convenience hook

---

### PHASE 4: REAL DEBUGGER (80 → 90/100)

_Goal: Actual debugging capability_

#### 4.1 Research & Setup DAP

- [ ] Install @vscode/debugadapter
- [ ] Understand Debug Adapter Protocol
- [ ] Choose initial runtime (Node.js first)
- [ ] Design debugger architecture

#### 4.2 Implement Debug Server

- [ ] Create debug adapter server
- [ ] Implement launch/attach configurations
- [ ] Handle Node.js --inspect protocol
- [ ] Manage debug sessions

#### 4.3 Implement Core Debug Features

- [ ] Breakpoint setting/removal
- [ ] Step over/into/out/continue
- [ ] Variable inspection
- [ ] Call stack retrieval
- [ ] Watch expressions

#### 4.4 Connect UI to Real Debugger

- [ ] Wire CodeLabDebugger to debug server
- [ ] Update useDebugger hook with real calls
- [ ] Stream debug events to UI
- [ ] Test full debug workflow

#### 4.5 Add Python Debug Support

- [ ] Integrate debugpy
- [ ] Configure Python debug adapter
- [ ] Test Python debugging
- [ ] Handle virtual environments

---

### PHASE 5: REAL MCP (90 → 95/100)

_Goal: True Model Context Protocol implementation_

#### 5.1 Install Official MCP SDK

- [ ] Add @modelcontextprotocol/sdk
- [ ] Read official MCP documentation
- [ ] Understand transport options (stdio, websocket)

#### 5.2 Implement MCP Server Manager

- [ ] Create server spawning infrastructure
- [ ] Implement stdio transport
- [ ] Handle server lifecycle
- [ ] Add server health monitoring

#### 5.3 Implement MCP Client

- [ ] Create MCP client for tool calls
- [ ] Implement proper protocol messages
- [ ] Handle tool discovery
- [ ] Route tool calls through MCP

#### 5.4 Support Custom MCP Servers

- [ ] Allow user-configured servers
- [ ] Implement server configuration UI
- [ ] Support npx-based server launching
- [ ] Test with community MCP servers

---

### PHASE 6: REAL COLLABORATION (95 → 100/100)

_Goal: True multi-user real-time collaboration_

#### 6.1 Install CRDT Library

- [ ] Add Yjs (or Automerge)
- [ ] Understand CRDT concepts
- [ ] Design document structure

#### 6.2 Implement Document Sync

- [ ] Create Yjs document provider
- [ ] Connect to WebSocket for sync
- [ ] Handle offline/online transitions
- [ ] Implement conflict resolution

#### 6.3 Implement Cursor Presence

- [ ] Track cursor positions per user
- [ ] Broadcast cursor updates
- [ ] Render remote cursors in editor
- [ ] Show user labels on cursors

#### 6.4 Implement Code Sharing

- [ ] Share editor state via CRDT
- [ ] Sync file tree changes
- [ ] Handle concurrent edits
- [ ] Test with multiple users

#### 6.5 Connect Collaboration UI

- [ ] Wire CodeLabCollaboration to real backend
- [ ] Update useCollaboration hook
- [ ] Enable invitation system
- [ ] Test full collaboration flow

---

## Testing Checkpoints

After each phase, verify:

- [ ] `npm run build` passes with no errors
- [ ] `npm run lint` passes
- [ ] App loads without console errors
- [ ] Feature works as documented
- [ ] No regressions in existing features

---

## File Locations Reference

**Key files to modify:**

- `src/components/code-lab/CodeLab.tsx` - Main component
- `src/components/code-lab/CodeLabDebugger.tsx` - Debugger UI
- `src/components/code-lab/CodeLabCollaboration.tsx` - Collaboration UI
- `src/components/code-lab/CodeLabPairProgramming.tsx` - Pair programming UI
- `src/lib/workspace/agent.ts` - Agent tools
- `src/lib/workspace/mcp.ts` - MCP facade
- `src/lib/pair-programmer/index.ts` - Pair programmer backend
- `src/agents/code/tools/BashTool.ts` - Shell execution

**Real-time infrastructure (Phase 3):**

- `src/lib/realtime/index.ts` - Module exports
- `src/lib/realtime/websocket-server.ts` - WebSocket server (standalone)
- `src/lib/realtime/useWebSocket.ts` - Client hook
- `src/lib/realtime/presence-service.ts` - Presence tracking service
- `app/api/code-lab/realtime/route.ts` - SSE fallback API
- `supabase/migrations/20260119_add_presence_table.sql` - Presence table

**Collaboration infrastructure:**

- `src/lib/collaboration/collaboration-manager.ts` - Session/operation management
- `src/lib/collaboration/crdt-document.ts` - CRDT document implementation
- `src/lib/collaboration/useCollaboration.ts` - Client collaboration hook
- `app/api/code-lab/collaboration/route.ts` - Collaboration API

---

## Notes for Future Sessions

1. Always read this file first
2. Check "Current Progress" section
3. Continue from first unchecked task
4. Update this file as you complete tasks
5. Run build after each sub-phase
6. Commit frequently with clear messages

---
