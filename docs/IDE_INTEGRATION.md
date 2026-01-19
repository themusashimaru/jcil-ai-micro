# Code Lab IDE Integration

This document describes the API and protocols for integrating Code Lab with external IDEs (VS Code, JetBrains, etc.).

## Overview

Code Lab provides a WebSocket-based API for real-time bidirectional communication with IDE extensions. This enables:

- **File Synchronization**: Keep files in sync between IDE and Code Lab workspace
- **Selection Context**: Share current file and selection with Claude
- **Command Execution**: Trigger Code Lab commands from IDE
- **Live Updates**: Real-time notification of changes

## Connection Protocol

### WebSocket Endpoint

```
wss://codelab.example.com/api/ide/ws?token=<auth_token>
```

### Authentication

1. Obtain an API token from Code Lab Settings
2. Include token as query parameter or in `Authorization` header
3. Token scopes: `ide:read`, `ide:write`, `ide:execute`

### Message Format

All messages use JSON with the following structure:

```typescript
interface IDEMessage {
  id: string; // Unique message ID for request/response correlation
  type: string; // Message type (see below)
  payload: object; // Type-specific payload
  timestamp: number; // Unix timestamp in milliseconds
}
```

## Message Types

### Client → Server

#### `file.open`

Notify Code Lab that a file was opened in IDE.

```json
{
  "id": "msg_123",
  "type": "file.open",
  "payload": {
    "path": "/src/components/Button.tsx",
    "content": "...",
    "language": "typescript"
  }
}
```

#### `file.change`

Notify Code Lab of file changes.

```json
{
  "id": "msg_124",
  "type": "file.change",
  "payload": {
    "path": "/src/components/Button.tsx",
    "changes": [
      {
        "range": { "start": { "line": 10, "column": 0 }, "end": { "line": 10, "column": 50 } },
        "text": "const newButton = () => {};"
      }
    ]
  }
}
```

#### `file.save`

Notify Code Lab that a file was saved.

```json
{
  "id": "msg_125",
  "type": "file.save",
  "payload": {
    "path": "/src/components/Button.tsx",
    "content": "..."
  }
}
```

#### `selection.change`

Share current selection context.

```json
{
  "id": "msg_126",
  "type": "selection.change",
  "payload": {
    "path": "/src/components/Button.tsx",
    "selections": [
      {
        "start": { "line": 5, "column": 0 },
        "end": { "line": 15, "column": 0 }
      }
    ],
    "selectedText": "..."
  }
}
```

#### `command.execute`

Execute a Code Lab command.

```json
{
  "id": "msg_127",
  "type": "command.execute",
  "payload": {
    "command": "fix",
    "args": "Fix the TypeScript error in the selected code",
    "context": {
      "file": "/src/components/Button.tsx",
      "selection": "..."
    }
  }
}
```

#### `chat.send`

Send a message to Claude.

```json
{
  "id": "msg_128",
  "type": "chat.send",
  "payload": {
    "message": "How do I fix this React hook warning?",
    "attachments": [
      {
        "type": "code",
        "path": "/src/hooks/useData.ts",
        "content": "...",
        "language": "typescript"
      }
    ]
  }
}
```

### Server → Client

#### `file.update`

Code Lab made changes to a file.

```json
{
  "id": "msg_200",
  "type": "file.update",
  "payload": {
    "path": "/src/components/Button.tsx",
    "content": "...",
    "diff": {
      "hunks": [...]
    }
  }
}
```

#### `file.create`

Code Lab created a new file.

```json
{
  "id": "msg_201",
  "type": "file.create",
  "payload": {
    "path": "/src/components/NewComponent.tsx",
    "content": "..."
  }
}
```

#### `file.delete`

Code Lab deleted a file.

```json
{
  "id": "msg_202",
  "type": "file.delete",
  "payload": {
    "path": "/src/components/OldComponent.tsx"
  }
}
```

#### `chat.response`

Claude's response to a message.

```json
{
  "id": "msg_203",
  "type": "chat.response",
  "payload": {
    "requestId": "msg_128",
    "content": "To fix the React hook warning...",
    "isStreaming": false
  }
}
```

#### `chat.stream`

Streaming response chunk.

```json
{
  "id": "msg_204",
  "type": "chat.stream",
  "payload": {
    "requestId": "msg_128",
    "chunk": "To fix",
    "isComplete": false
  }
}
```

#### `status.update`

Session status update.

```json
{
  "id": "msg_205",
  "type": "status.update",
  "payload": {
    "connected": true,
    "sessionId": "session_abc123",
    "model": "claude-sonnet-4",
    "tokensUsed": 15000
  }
}
```

## VS Code Extension

### Extension Manifest (package.json)

```json
{
  "name": "codelab-vscode",
  "displayName": "Code Lab",
  "description": "Claude AI coding assistant for VS Code",
  "version": "1.0.0",
  "publisher": "codelab",
  "engines": {
    "vscode": "^1.80.0"
  },
  "categories": ["AI", "Programming Languages", "Other"],
  "activationEvents": ["onStartupFinished"],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "codelab.connect",
        "title": "Code Lab: Connect"
      },
      {
        "command": "codelab.askClaude",
        "title": "Code Lab: Ask Claude"
      },
      {
        "command": "codelab.fixCode",
        "title": "Code Lab: Fix Code"
      },
      {
        "command": "codelab.explainCode",
        "title": "Code Lab: Explain Code"
      },
      {
        "command": "codelab.generateTests",
        "title": "Code Lab: Generate Tests"
      }
    ],
    "keybindings": [
      {
        "command": "codelab.askClaude",
        "key": "ctrl+shift+c",
        "mac": "cmd+shift+c"
      },
      {
        "command": "codelab.fixCode",
        "key": "ctrl+shift+f",
        "mac": "cmd+shift+f",
        "when": "editorHasSelection"
      }
    ],
    "configuration": {
      "title": "Code Lab",
      "properties": {
        "codelab.serverUrl": {
          "type": "string",
          "default": "https://codelab.example.com",
          "description": "Code Lab server URL"
        },
        "codelab.apiToken": {
          "type": "string",
          "default": "",
          "description": "API token for authentication"
        },
        "codelab.autoSync": {
          "type": "boolean",
          "default": true,
          "description": "Automatically sync file changes"
        }
      }
    },
    "viewsContainers": {
      "activitybar": [
        {
          "id": "codelab",
          "title": "Code Lab",
          "icon": "resources/codelab.svg"
        }
      ]
    },
    "views": {
      "codelab": [
        {
          "id": "codelab.chat",
          "name": "Chat"
        },
        {
          "id": "codelab.files",
          "name": "Workspace Files"
        }
      ]
    }
  },
  "scripts": {
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "package": "vsce package"
  },
  "dependencies": {
    "ws": "^8.14.0"
  }
}
```

### Extension Entry Point (extension.ts)

```typescript
import * as vscode from 'vscode';
import { CodeLabClient } from './client';

let client: CodeLabClient | undefined;

export function activate(context: vscode.ExtensionContext) {
  // Initialize client
  const config = vscode.workspace.getConfiguration('codelab');
  client = new CodeLabClient({
    serverUrl: config.get('serverUrl') as string,
    token: config.get('apiToken') as string,
  });

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codelab.connect', async () => {
      await client?.connect();
      vscode.window.showInformationMessage('Connected to Code Lab');
    }),

    vscode.commands.registerCommand('codelab.askClaude', async () => {
      const editor = vscode.window.activeTextEditor;
      const selection = editor?.selection;
      const selectedText = editor?.document.getText(selection);

      const question = await vscode.window.showInputBox({
        prompt: 'Ask Claude about your code',
        placeHolder: 'How do I...',
      });

      if (question) {
        await client?.sendChat(question, {
          file: editor?.document.fileName,
          selection: selectedText,
        });
      }
    }),

    vscode.commands.registerCommand('codelab.fixCode', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);

      await client?.executeCommand('fix', {
        file: editor.document.fileName,
        selection: selectedText,
      });
    })
  );

  // Watch for file changes
  if (config.get('autoSync')) {
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        client?.sendFileChange(doc.fileName, doc.getText());
      }),

      vscode.window.onDidChangeTextEditorSelection((e) => {
        const selection = e.textEditor.document.getText(e.selections[0]);
        client?.sendSelectionChange(e.textEditor.document.fileName, selection);
      })
    );
  }
}

export function deactivate() {
  client?.disconnect();
}
```

## REST API Endpoints

For non-WebSocket operations, these REST endpoints are available:

### GET /api/ide/status

Get current connection status and session info.

### POST /api/ide/command

Execute a command synchronously.

### GET /api/ide/files

List workspace files.

### GET /api/ide/files/:path

Get file content.

### PUT /api/ide/files/:path

Update file content.

### DELETE /api/ide/files/:path

Delete a file.

## Security Considerations

1. **Token Rotation**: API tokens should be rotated regularly
2. **Scope Limitation**: Use minimal required scopes
3. **TLS Required**: All connections must use HTTPS/WSS
4. **Rate Limiting**: API calls are rate-limited per token
5. **Audit Logging**: All IDE actions are logged for audit

## Error Handling

### Error Response Format

```json
{
  "id": "msg_error",
  "type": "error",
  "payload": {
    "code": "AUTH_FAILED",
    "message": "Invalid or expired token",
    "details": {}
  }
}
```

### Error Codes

- `AUTH_FAILED`: Authentication failed
- `PERMISSION_DENIED`: Insufficient permissions
- `FILE_NOT_FOUND`: Requested file doesn't exist
- `INVALID_MESSAGE`: Message format invalid
- `RATE_LIMITED`: Too many requests
- `SESSION_EXPIRED`: Session has expired
- `SERVER_ERROR`: Internal server error

## Rate Limits

- WebSocket messages: 100/second
- REST API calls: 60/minute
- File sync events: 10/second

---

_This documentation provides the foundation for IDE integration. Actual implementation may vary based on specific IDE requirements._
