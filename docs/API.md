# JCIL.AI API Documentation

> Enterprise-Grade API Reference

---

## Overview

JCIL.AI provides RESTful API endpoints for all platform features. All endpoints require authentication unless otherwise noted.

### Base URL

```
Production: https://jcil.ai/api
Development: http://localhost:3000/api
```

### Authentication

All API requests (except health check) require authentication via Supabase session cookies. CSRF protection is enforced on all state-changing requests.

**Headers Required:**

```
Cookie: sb-access-token=<token>; sb-refresh-token=<token>
X-CSRF-Token: <csrf-token>  (for POST/PUT/DELETE)
```

### Rate Limits

| User Type     | Limit        | Period   |
| ------------- | ------------ | -------- |
| Authenticated | 120 requests | per hour |
| Anonymous     | 30 requests  | per hour |

---

## Memory API

The Memory API provides access to the Persistent Memory Agent, enabling cross-conversation personalization.

### GET /api/memory

Retrieve the authenticated user's memory profile.

**Response:**

```json
{
  "memory": {
    "id": "uuid",
    "summary": "User is a software engineer interested in AI...",
    "key_topics": ["programming", "ai", "theology"],
    "preferences": {
      "name": "John",
      "occupation": "Software Engineer",
      "location": "San Francisco",
      "communication_style": "technical",
      "interests": ["AI", "programming"],
      "family_members": [{ "relation": "wife", "name": "Sarah" }],
      "goals": ["Build an AI startup"]
    },
    "created_at": "2026-01-01T00:00:00Z",
    "updated_at": "2026-01-09T12:00:00Z",
    "last_accessed_at": "2026-01-09T12:00:00Z"
  }
}
```

**No Memory Response:**

```json
{
  "memory": null,
  "message": "No memory profile exists yet. It will be created as you chat."
}
```

**Error Responses:**

- `401 Unauthorized` - Not authenticated
- `429 Too Many Requests` - Rate limit exceeded

---

### PUT /api/memory

Update user preferences directly. Useful for onboarding or settings pages.

**Request Body:**

```json
{
  "name": "John",
  "preferred_name": "Johnny",
  "occupation": "Software Engineer",
  "location": "San Francisco",
  "communication_style": "technical",
  "interests": ["AI", "programming", "music"],
  "goals": ["Build an AI startup", "Learn Spanish"],
  "interaction_preferences": ["Be concise", "Use code examples"]
}
```

**All fields are optional.** Only provided fields will be updated.

**Valid Communication Styles:**

- `formal`
- `casual`
- `technical`
- `simple`

**Response:**

```json
{
  "success": true,
  "message": "Preferences updated successfully"
}
```

**Error Responses:**

- `400 Bad Request` - Invalid request body
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - CSRF token invalid
- `429 Too Many Requests` - Rate limit exceeded

---

### DELETE /api/memory

Permanently delete all stored memory (GDPR right to erasure).

**Response:**

```json
{
  "success": true,
  "message": "All memory has been permanently deleted"
}
```

**No Memory Response:**

```json
{
  "success": true,
  "message": "No memory existed to delete"
}
```

**Error Responses:**

- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - CSRF token invalid
- `429 Too Many Requests` - Rate limit exceeded (5 requests max)

---

### POST /api/memory/forget

Forget specific facts or topics (GDPR targeted deletion).

**Request Body:**

```json
{
  "topics": ["topic1", "topic2"],
  "preference_keys": ["occupation", "location"],
  "clear_summary": false
}
```

At least one of `topics`, `preference_keys`, or `clear_summary` must be provided.

**Valid Preference Keys:**

- `name`
- `preferred_name`
- `occupation`
- `location`
- `communication_style`
- `interests`
- `faith_context`
- `goals`
- `interaction_preferences`
- Any custom preference key

**Response:**

```json
{
  "success": true,
  "removed": ["topics: topic1, topic2", "preference: occupation", "preference: location"],
  "message": "Successfully removed: topics: topic1, topic2, preference: occupation, preference: location"
}
```

**Nothing Removed Response:**

```json
{
  "success": true,
  "removed": [],
  "message": "No matching items found to remove"
}
```

**Error Responses:**

- `400 Bad Request` - No items specified to forget
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - CSRF token invalid
- `429 Too Many Requests` - Rate limit exceeded (30 requests max)

---

## Chat API

### POST /api/chat

Send a message and receive a streaming AI response.

**Request Body:**

```json
{
  "messages": [{ "role": "user", "content": "Hello, how are you?" }],
  "systemPrompt": "You are a helpful assistant.",
  "conversationId": "uuid (optional)",
  "tool": "general | search | factcheck | research (optional)"
}
```

**Response:**

- Content-Type: `text/plain; charset=utf-8`
- Transfer-Encoding: `chunked`
- Streaming text response

**Headers:**

- `X-Model-Used`: Model that processed the request
- `X-Provider`: `claude`

---

## Conversations API

### GET /api/conversations

List all conversations for the authenticated user.

**Response:**

```json
{
  "conversations": [
    {
      "id": "uuid",
      "title": "Chat Title",
      "tool_context": "general",
      "message_count": 10,
      "last_message_at": "2026-01-09T12:00:00Z",
      "folder": {
        "id": "uuid",
        "name": "Folder Name",
        "color": "#3B82F6"
      }
    }
  ]
}
```

### POST /api/conversations

Create or update a conversation.

**Request Body:**

```json
{
  "id": "uuid (optional, for update)",
  "title": "Conversation Title",
  "tool_context": "general | code | research",
  "summary": "Optional summary"
}
```

---

## Health API

### GET /api/health

Check system health status. No authentication required.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2026-01-09T12:00:00Z",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "anthropic": "healthy"
  }
}
```

---

## Error Responses

All error responses follow a consistent format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Code           | HTTP Status | Description              |
| -------------- | ----------- | ------------------------ |
| `UNAUTHORIZED` | 401         | Authentication required  |
| `FORBIDDEN`    | 403         | CSRF or permission error |
| `NOT_FOUND`    | 404         | Resource not found       |
| `RATE_LIMITED` | 429         | Too many requests        |
| `SERVER_ERROR` | 500         | Internal server error    |
| `BAD_REQUEST`  | 400         | Invalid request data     |

### Code Lab Error Codes

| Code | HTTP Status | Description |
| ---- | ----------- | ----------- |
| `CONTENT_TOO_LONG` | 400 | Message exceeds 100KB limit |
| `SESSION_NOT_FOUND` | 404 | Code Lab session not found |
| `SESSION_CREATE_FAILED` | 500 | Failed to create new session |
| `FILES_ACCESS_FAILED` | 500 | File read/list operation failed |
| `FILE_CREATE_FAILED` | 500 | File creation failed |
| `FILE_UPDATE_FAILED` | 500 | File update/write failed |
| `FILE_DELETE_FAILED` | 500 | File deletion failed |
| `VISUAL_TO_CODE_FAILED` | 500 | Image to code conversion failed |
| `DEPLOY_FAILED` | 500 | Deployment to platform failed |
| `INDEX_CHECK_FAILED` | 500 | Codebase index check failed |
| `INDEX_CREATE_FAILED` | 500 | Codebase index creation failed |
| `INDEX_DELETE_FAILED` | 500 | Codebase index deletion failed |

---

## CORS

API endpoints support CORS for the following origins:

- `https://jcil.ai`
- `https://*.jcil.ai`
- `http://localhost:3000` (development only)

---

## Changelog

### v1.1.0 (January 20, 2026)

- Added Code Lab error codes for consistent error handling
- Added input validation for message content length (100KB max)
- Improved error responses with detailed error codes and messages

### v1.0.0 (January 2026)

- Added Memory API endpoints
- Added GDPR-compliant memory deletion
- Added targeted fact deletion (forget endpoint)

---

_Last Updated: January 2026_
