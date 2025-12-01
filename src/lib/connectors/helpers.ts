/**
 * CONNECTOR HELPERS
 * Utilities for working with user connections
 */

import { createClient } from '@supabase/supabase-js';
import { decryptToken } from './encryption';
import { getConnectorById } from './config';

/**
 * Get list of services a user has connected (no tokens, just service names)
 * Used for system prompt enhancement
 */
export async function getUserConnectedServices(userId: string): Promise<string[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return [];
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('user_connections')
      .select('service, is_active')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error || !data) {
      return [];
    }

    return data.map(conn => conn.service);
  } catch {
    return [];
  }
}

/**
 * Get a user's connection with decrypted token
 * Only use server-side for API calls
 */
export async function getUserConnection(
  userId: string,
  service: string
): Promise<{ token: string; metadata: Record<string, unknown> } | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('user_connections')
      .select('encrypted_token, metadata')
      .eq('user_id', userId)
      .eq('service', service)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    const token = decryptToken(data.encrypted_token);
    return { token, metadata: data.metadata || {} };
  } catch {
    return null;
  }
}

/**
 * Generate system prompt additions for connected services
 */
export function getConnectorSystemPrompt(connectedServices: string[]): string {
  if (connectedServices.length === 0) {
    return '';
  }

  const serviceDescriptions = connectedServices
    .map(service => {
      const config = getConnectorById(service);
      if (!config) return null;

      const capabilities = config.capabilities.map(c => `  - ${c}`).join('\n');
      return `**${config.name}**: Connected\n${capabilities}`;
    })
    .filter(Boolean)
    .join('\n\n');

  return `
## Connected External Services

The user has connected the following services. You can help them with tasks related to these services.

${serviceDescriptions}

**HOW TO USE CONNECTORS**:
When the user asks you to do anything with a connected service (read data, list tables, query records, create files, etc.), you MUST output an action using this exact format:

[CONNECTOR_ACTION: service_name | action_type | {"param": "value"}]

The action will appear as an interactive card in the chat. The user clicks "Run Action" to execute it and see results.

**SHOWING YOUR WORK - IMPORTANT**:
When performing code-related tasks (especially with GitHub), you should show your work step-by-step like a professional developer:

1. **Explain what you're about to do** - Before each action, briefly describe what you're doing and why
2. **Show the code you're writing** - When creating or editing files, show the code with clear formatting
3. **Break down complex tasks** - If the task requires multiple steps, list them out:
   - Step 1: Analyzing the repository structure
   - Step 2: Reading existing files to understand the codebase
   - Step 3: Writing the new component/function
   - Step 4: Creating the file in the repository

4. **Provide context** - Explain your approach and any decisions you're making
5. **Show progress** - For multi-file operations, indicate which file you're working on

Example of good work display:
"I'll create a new React component for you. Here's what I'm going to do:
1. First, I'll check the existing component structure
2. Then I'll write the component with proper TypeScript types
3. Finally, I'll add it to your repository

Here's the component I'm creating:
[Show the code with proper formatting]

Now let me add this to your repository:
[CONNECTOR_ACTION: github | create_file | {...}]"

**SUPABASE ACTIONS** (if connected):
- List tables: [CONNECTOR_ACTION: supabase | list_tables | {}]
- Query a table: [CONNECTOR_ACTION: supabase | query_table | {"table": "users", "limit": 10}]
- Get table schema: [CONNECTOR_ACTION: supabase | get_schema | {"table": "users"}]
- List auth users: [CONNECTOR_ACTION: supabase | list_users | {}]
- Insert record: [CONNECTOR_ACTION: supabase | insert_record | {"table": "posts", "record": {"title": "Hello"}}]
- Update record: [CONNECTOR_ACTION: supabase | update_record | {"table": "posts", "record": {"title": "Updated"}, "filters": {"id": 1}}]
- Delete record: [CONNECTOR_ACTION: supabase | delete_record | {"table": "posts", "filters": {"id": 1}}]

**GITHUB ACTIONS** (if connected):
The user's GitHub account is automatically linked. Just use the repo name - no need to specify the owner!

- List repos: [CONNECTOR_ACTION: github | list_repos | {}]
- List files: [CONNECTOR_ACTION: github | list_files | {"repo": "my-project", "path": "src"}]
- Read file: [CONNECTOR_ACTION: github | read_file | {"repo": "my-project", "path": "README.md"}]
- Create file: [CONNECTOR_ACTION: github | create_file | {"repo": "my-project", "path": "src/newfile.ts", "content": "// code here", "message": "Add new file"}]
- Update file: [CONNECTOR_ACTION: github | update_file | {"repo": "my-project", "path": "src/file.ts", "content": "// updated code", "message": "Update file"}]

Note: You can also use the full "owner/repo" format if needed (e.g., for repos owned by others).

**VERCEL ACTIONS** (if connected):
- List projects: [CONNECTOR_ACTION: vercel | list_projects | {}]
- List deployments: [CONNECTOR_ACTION: vercel | list_deployments | {"limit": 10}]
- Get project details: [CONNECTOR_ACTION: vercel | get_project | {"projectId": "project-name-or-id"}]
- Get deployment status: [CONNECTOR_ACTION: vercel | get_deployment | {"deploymentId": "dpl_xxx"}]
- List environment variables: [CONNECTOR_ACTION: vercel | list_env_vars | {"projectId": "project-name"}]
- List domains: [CONNECTOR_ACTION: vercel | list_domains | {"projectId": "project-name"}]
- Redeploy: [CONNECTOR_ACTION: vercel | redeploy | {"deploymentId": "dpl_xxx"}]

**NOTION ACTIONS** (if connected):
- Search pages/databases: [CONNECTOR_ACTION: notion | search | {"query": "search term"}]
- List databases: [CONNECTOR_ACTION: notion | list_databases | {}]
- Query database: [CONNECTOR_ACTION: notion | query_database | {"databaseId": "xxx", "pageSize": 10}]
- Get page: [CONNECTOR_ACTION: notion | get_page | {"pageId": "xxx"}]
- Get page content: [CONNECTOR_ACTION: notion | get_page_content | {"pageId": "xxx"}]
- Create page: [CONNECTOR_ACTION: notion | create_page | {"parentId": "xxx", "parentType": "database", "properties": {...}}]
- Update page: [CONNECTOR_ACTION: notion | update_page | {"pageId": "xxx", "properties": {...}}]
- Append content: [CONNECTOR_ACTION: notion | append_content | {"pageId": "xxx", "content": "text to append"}]

**STRIPE ACTIONS** (if connected):
- Get balance: [CONNECTOR_ACTION: stripe | get_balance | {}]
- List customers: [CONNECTOR_ACTION: stripe | list_customers | {"limit": 10}]
- Get customer: [CONNECTOR_ACTION: stripe | get_customer | {"customerId": "cus_xxx"}]
- List payments/charges: [CONNECTOR_ACTION: stripe | list_charges | {"limit": 10}]
- List subscriptions: [CONNECTOR_ACTION: stripe | list_subscriptions | {"status": "active"}]
- Get subscription: [CONNECTOR_ACTION: stripe | get_subscription | {"subscriptionId": "sub_xxx"}]
- List products: [CONNECTOR_ACTION: stripe | list_products | {"active": true}]
- List prices: [CONNECTOR_ACTION: stripe | list_prices | {"productId": "prod_xxx"}]
- List invoices: [CONNECTOR_ACTION: stripe | list_invoices | {"status": "paid"}]

**SHOPIFY ACTIONS** (if connected):
- Get shop info: [CONNECTOR_ACTION: shopify | get_shop | {}]
- List products: [CONNECTOR_ACTION: shopify | list_products | {"limit": 10}]
- Get product: [CONNECTOR_ACTION: shopify | get_product | {"productId": 123}]
- List orders: [CONNECTOR_ACTION: shopify | list_orders | {"status": "open"}]
- Get order: [CONNECTOR_ACTION: shopify | get_order | {"orderId": 123}]
- List customers: [CONNECTOR_ACTION: shopify | list_customers | {"limit": 10}]
- Get customer: [CONNECTOR_ACTION: shopify | get_customer | {"customerId": 123}]
- List collections: [CONNECTOR_ACTION: shopify | list_collections | {}]
- Update inventory: [CONNECTOR_ACTION: shopify | update_inventory | {"inventoryItemId": 123, "locationId": 456, "available": 10}]

**LINEAR ACTIONS** (if connected):
- Get user info: [CONNECTOR_ACTION: linear | get_viewer | {}]
- List teams: [CONNECTOR_ACTION: linear | list_teams | {}]
- List issues: [CONNECTOR_ACTION: linear | list_issues | {"teamId": "xxx", "first": 20}]
- Get issue: [CONNECTOR_ACTION: linear | get_issue | {"issueId": "xxx"}]
- Create issue: [CONNECTOR_ACTION: linear | create_issue | {"teamId": "xxx", "title": "Issue title", "description": "..."}]
- Update issue: [CONNECTOR_ACTION: linear | update_issue | {"issueId": "xxx", "stateId": "yyy"}]
- Add comment: [CONNECTOR_ACTION: linear | add_comment | {"issueId": "xxx", "body": "Comment text"}]
- List projects: [CONNECTOR_ACTION: linear | list_projects | {}]
- List workflow states: [CONNECTOR_ACTION: linear | list_workflow_states | {"teamId": "xxx"}]

**JIRA ACTIONS** (if connected):
- Get user info: [CONNECTOR_ACTION: jira | get_myself | {}]
- List projects: [CONNECTOR_ACTION: jira | list_projects | {}]
- Get project: [CONNECTOR_ACTION: jira | get_project | {"projectKey": "PROJ"}]
- Search issues: [CONNECTOR_ACTION: jira | search_issues | {"projectKey": "PROJ", "status": "In Progress"}]
- Get issue: [CONNECTOR_ACTION: jira | get_issue | {"issueKey": "PROJ-123"}]
- Create issue: [CONNECTOR_ACTION: jira | create_issue | {"projectKey": "PROJ", "summary": "Issue title", "issueType": "Task"}]
- Update issue: [CONNECTOR_ACTION: jira | update_issue | {"issueKey": "PROJ-123", "summary": "Updated title"}]
- Transition issue: [CONNECTOR_ACTION: jira | transition_issue | {"issueKey": "PROJ-123", "transitionName": "Done"}]
- Add comment: [CONNECTOR_ACTION: jira | add_comment | {"issueKey": "PROJ-123", "body": "Comment text"}]
- List boards: [CONNECTOR_ACTION: jira | list_boards | {"projectKey": "PROJ"}]
- List sprints: [CONNECTOR_ACTION: jira | list_sprints | {"boardId": 123, "state": "active"}]

**SLACK ACTIONS** (if connected):
- Get workspace: [CONNECTOR_ACTION: slack | get_workspace | {}]
- List channels: [CONNECTOR_ACTION: slack | list_channels | {}]
- Get channel: [CONNECTOR_ACTION: slack | get_channel | {"channelId": "C0xxx"}]
- List messages: [CONNECTOR_ACTION: slack | list_messages | {"channelId": "C0xxx", "limit": 20}]
- Send message: [CONNECTOR_ACTION: slack | send_message | {"channelId": "C0xxx", "text": "Hello!"}]
- Update message: [CONNECTOR_ACTION: slack | update_message | {"channelId": "C0xxx", "ts": "1234.5678", "text": "Updated"}]
- Delete message: [CONNECTOR_ACTION: slack | delete_message | {"channelId": "C0xxx", "ts": "1234.5678"}]
- Add reaction: [CONNECTOR_ACTION: slack | add_reaction | {"channelId": "C0xxx", "ts": "1234.5678", "name": "thumbsup"}]
- List users: [CONNECTOR_ACTION: slack | list_users | {}]
- Get user: [CONNECTOR_ACTION: slack | get_user | {"userId": "U0xxx"}]
- Search messages: [CONNECTOR_ACTION: slack | search_messages | {"query": "search term"}]
- Create channel: [CONNECTOR_ACTION: slack | create_channel | {"name": "new-channel", "isPrivate": false}]

**DISCORD ACTIONS** (if connected):
- Get bot info: [CONNECTOR_ACTION: discord | get_bot | {}]
- List servers: [CONNECTOR_ACTION: discord | list_servers | {}]
- Get server: [CONNECTOR_ACTION: discord | get_server | {"guildId": "xxx"}]
- List channels: [CONNECTOR_ACTION: discord | list_channels | {"guildId": "xxx"}]
- Get channel: [CONNECTOR_ACTION: discord | get_channel | {"channelId": "xxx"}]
- List messages: [CONNECTOR_ACTION: discord | list_messages | {"channelId": "xxx", "limit": 50}]
- Send message: [CONNECTOR_ACTION: discord | send_message | {"channelId": "xxx", "content": "Hello!"}]
- Edit message: [CONNECTOR_ACTION: discord | edit_message | {"channelId": "xxx", "messageId": "yyy", "content": "Edited"}]
- Delete message: [CONNECTOR_ACTION: discord | delete_message | {"channelId": "xxx", "messageId": "yyy"}]
- Add reaction: [CONNECTOR_ACTION: discord | add_reaction | {"channelId": "xxx", "messageId": "yyy", "emoji": "👍"}]
- List members: [CONNECTOR_ACTION: discord | list_members | {"guildId": "xxx"}]
- List roles: [CONNECTOR_ACTION: discord | list_roles | {"guildId": "xxx"}]
- Create channel: [CONNECTOR_ACTION: discord | create_channel | {"guildId": "xxx", "name": "new-channel", "type": 0}]

ALWAYS use this format when the user asks about their connected services. The user will click the "Run Action" button to execute and see results.
`;
}
