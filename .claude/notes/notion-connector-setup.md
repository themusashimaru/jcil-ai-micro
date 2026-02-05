# Notion Connector Implementation Notes

**Date:** 2026-02-05
**Commit:** 0a97f3c - feat: add Notion connector with OAuth and full workspace access

## What Was Built

### Files Created
- `/src/lib/connectors/notion.ts` - Full Notion API wrapper with OAuth helpers
- `/app/api/connectors/notion/auth/route.ts` - Initiates OAuth flow
- `/app/api/connectors/notion/callback/route.ts` - Handles OAuth callback, stores encrypted token
- `/app/api/connectors/notion/status/route.ts` - Returns connection status
- `/app/api/connectors/notion/disconnect/route.ts` - Clears Notion tokens
- `/supabase/migrations/20260205_add_notion_connector.sql` - Database migration for Notion columns
- `/src/lib/ai/tools/notion-tool.ts` - AI chat tool for Notion workspace management

### Files Modified
- `/src/lib/connectors/types.ts` - Added 'notion' to ConnectorType, NotionConnector interface
- `/src/lib/connectors/index.ts` - Added notion exports
- `/app/components/ConnectorsSection.tsx` - Added Notion UI card
- `/src/lib/ai/tools/index.ts` - Added notionTool export

## Notion Tool Capabilities
- `search` - Search workspace for pages and databases
- `get_page` - Get page content
- `create_page` - Create new pages
- `add_content` - Add blocks to existing pages
- `get_database` - Get database schema
- `query_database` - Query database with filters
- `add_database_item` - Add items to databases
- `archive_page` - Archive/delete pages

## Setup Instructions (Pending)

### 1. Create Notion Integration
- Go to https://www.notion.so/my-integrations
- Create new integration with read/update/insert capabilities
- Enable "Public integration" under Distribution
- Set Redirect URI: `https://your-app-url.com/api/connectors/notion/callback`

### 2. Vercel Environment Variables
```
NOTION_CLIENT_ID=<oauth-client-id>
NOTION_CLIENT_SECRET=<oauth-client-secret>
```

### 3. Run Database Migration
Execute `/supabase/migrations/20260205_add_notion_connector.sql` in Supabase SQL Editor

### 4. Redeploy on Vercel

## Context: Why Notion Instead of Uber
- Uber connector was completed but has severe API restrictions
- Ride-requesting requires Uber business partner approval
- User wanted "big name, easy setup" connector
- Notion provides full API access without special approval

## Related Commits
- c7ba5a8 - feat: add Spotify connector with OAuth and chat integration
- 73ad2d2 - feat: add Uber connector with OAuth and chat integration (limited to profile/history)
