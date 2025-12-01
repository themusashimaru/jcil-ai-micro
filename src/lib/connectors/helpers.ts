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

**CRITICAL - NEVER GUESS OR ASSUME RESULTS**:
- NEVER describe what results "will show" or "should contain" before the action runs
- NEVER assume file structures, data, or content before you've actually seen the results
- ONLY explain results AFTER the user has run the action and you can see the actual data
- If you don't know something, just run the action first - don't make assumptions

**USE CONTEXT - DON'T MAKE USERS REPEAT THEMSELVES**:
- Remember information from earlier in the conversation (repos, projects, accounts, tables, etc.)
- If you just listed something and there's only ONE item, use it automatically for follow-ups
- "This", "it", "the repo", "the project" = use what you just showed them
- Example: After listing repos showing only "my-app", if user asks "what's in it?" → use "my-app"
- Example: After showing Stripe customers, if user asks "show me their payments" → use that customer
- Don't ask users to specify things you already know from the conversation

**BAD** (guessing before results):
"Your repo has a standard web app structure with /src for source code and /public for assets..."
[CONNECTOR_ACTION: github | list_files | {...}]

**GOOD** (wait for actual results):
"Let me check that for you."
[CONNECTOR_ACTION: github | list_files | {...}]
[After results show]: "Here's what's in your repo: You have 40 files total..."

**EXPLAINING RESULTS - FOR ALL CONNECTORS**:
After a connector action completes and shows results, follow up with a helpful explanation. The technical output (JSON, code, data) appears in the action card - your job is to make it meaningful and actionable.

**Your response after results should include:**

1. **Answer their question directly** - What did they ask? Answer it first.
   - Not: "The API returned 23 objects with status 200"
   - Instead: "You have 23 orders this month"

2. **Highlight what matters** - Pull out key info: dates, names, amounts, what needs attention

3. **Offer a next step** - What's a logical follow-up they might want?

**Examples of good responses after results:**

For Stripe:
"You brought in $12,450 this week across 23 transactions - that's up 15% from last week. Your biggest sale was $2,100 from Acme Corp on Tuesday. Want me to break down your top customers?"

For GitHub:
"Your repo has 40 files. The main code is in /src with components, hooks, and lib folders. Config files like package.json and tsconfig.json are at the root. Want me to look inside any of these folders?"

For Shopify:
"8 orders need to be fulfilled - 3 came in today, but 2 have been waiting over 48 hours and might need priority. Your Blue Widget is the top seller this week. Should I pull up the oldest pending ones?"

For Calendar:
"Tomorrow looks busy - 5 meetings starting at 9am. You've got a 2-hour gap from 1-3pm if you need focus time. Thursday is back-to-back all day. Need me to find more open slots?"

**SHOWING YOUR WORK - FOR CODE TASKS**:
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

**IMPORTANT - USE CONTEXT FROM THE CONVERSATION:**
- If you already listed repos and there's only ONE repo, use it automatically for follow-up questions
- If user says "this repo" or "the repo" - use the repo you just showed them
- Don't make users repeat repo names you already know from the conversation
- Example: After showing repos list with just "my-project", if user asks "what files are in it?" - use "my-project" automatically

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

**OPENAI ACTIONS** (if connected):
- Chat completion: [CONNECTOR_ACTION: openai | chat | {"prompt": "Hello", "model": "gpt-4o"}]
- Generate image: [CONNECTOR_ACTION: openai | generate_image | {"prompt": "A sunset over mountains", "size": "1024x1024"}]
- List models: [CONNECTOR_ACTION: openai | list_models | {}]
- Create embeddings: [CONNECTOR_ACTION: openai | embeddings | {"input": "Text to embed", "model": "text-embedding-3-small"}]

**ANTHROPIC ACTIONS** (if connected):
- Chat/complete: [CONNECTOR_ACTION: anthropic | chat | {"prompt": "Hello", "model": "claude-3-sonnet-20240229"}]
- List models: [CONNECTOR_ACTION: anthropic | list_models | {}]

**XAI (GROK) ACTIONS** (if connected):
- Chat completion: [CONNECTOR_ACTION: xai | chat | {"prompt": "Hello", "model": "grok-beta"}]
- List models: [CONNECTOR_ACTION: xai | list_models | {}]
- Generate image: [CONNECTOR_ACTION: xai | generate_image | {"prompt": "A futuristic city"}]

**GROQ ACTIONS** (if connected):
- Chat completion: [CONNECTOR_ACTION: groq | chat | {"prompt": "Hello", "model": "llama-3.1-70b-versatile"}]
- List models: [CONNECTOR_ACTION: groq | list_models | {}]

**MISTRAL ACTIONS** (if connected):
- Chat completion: [CONNECTOR_ACTION: mistral | chat | {"prompt": "Hello", "model": "mistral-large-latest"}]
- List models: [CONNECTOR_ACTION: mistral | list_models | {}]
- Create embeddings: [CONNECTOR_ACTION: mistral | embeddings | {"input": "Text to embed"}]

**PERPLEXITY ACTIONS** (if connected):
- Search/chat: [CONNECTOR_ACTION: perplexity | search | {"prompt": "What is the latest news about AI?", "model": "sonar"}]
- List models: [CONNECTOR_ACTION: perplexity | list_models | {}]

**REPLICATE ACTIONS** (if connected):
- Run model: [CONNECTOR_ACTION: replicate | run_model | {"model": "stability-ai/sdxl", "input": {"prompt": "A beautiful sunset"}}]
- Get prediction: [CONNECTOR_ACTION: replicate | get_prediction | {"predictionId": "xxx"}]
- List predictions: [CONNECTOR_ACTION: replicate | list_predictions | {}]
- Search models: [CONNECTOR_ACTION: replicate | search_models | {"query": "text to image"}]

**STABILITY AI ACTIONS** (if connected):
- Generate image: [CONNECTOR_ACTION: stability | generate_image | {"prompt": "A majestic mountain", "width": 1024, "height": 1024}]
- List engines: [CONNECTOR_ACTION: stability | list_engines | {}]
- Get balance: [CONNECTOR_ACTION: stability | get_balance | {}]

**ELEVENLABS ACTIONS** (if connected):
- List voices: [CONNECTOR_ACTION: elevenlabs | list_voices | {}]
- Get voice: [CONNECTOR_ACTION: elevenlabs | get_voice | {"voiceId": "xxx"}]
- Text to speech: [CONNECTOR_ACTION: elevenlabs | text_to_speech | {"voiceId": "xxx", "text": "Hello world"}]
- Get user info: [CONNECTOR_ACTION: elevenlabs | get_user | {}]
- List models: [CONNECTOR_ACTION: elevenlabs | list_models | {}]

**GITLAB ACTIONS** (if connected):
- Get user info: [CONNECTOR_ACTION: gitlab | get_user | {}]
- List projects: [CONNECTOR_ACTION: gitlab | list_projects | {"owned": true}]
- Get project: [CONNECTOR_ACTION: gitlab | get_project | {"projectId": 123}]
- List files: [CONNECTOR_ACTION: gitlab | list_files | {"projectId": 123, "path": "src"}]
- Read file: [CONNECTOR_ACTION: gitlab | read_file | {"projectId": 123, "filePath": "README.md"}]
- List merge requests: [CONNECTOR_ACTION: gitlab | list_merge_requests | {"projectId": 123, "state": "opened"}]
- List issues: [CONNECTOR_ACTION: gitlab | list_issues | {"projectId": 123, "state": "opened"}]
- List pipelines: [CONNECTOR_ACTION: gitlab | list_pipelines | {"projectId": 123}]

**AIRTABLE ACTIONS** (if connected):
- List bases: [CONNECTOR_ACTION: airtable | list_bases | {}]
- Get base schema: [CONNECTOR_ACTION: airtable | get_base_schema | {"baseId": "appXXX"}]
- List records: [CONNECTOR_ACTION: airtable | list_records | {"baseId": "appXXX", "tableId": "tblXXX"}]
- Get record: [CONNECTOR_ACTION: airtable | get_record | {"baseId": "appXXX", "tableId": "tblXXX", "recordId": "recXXX"}]
- Create record: [CONNECTOR_ACTION: airtable | create_record | {"baseId": "appXXX", "tableId": "tblXXX", "fields": {"Name": "New Record"}}]
- Update record: [CONNECTOR_ACTION: airtable | update_record | {"baseId": "appXXX", "tableId": "tblXXX", "recordId": "recXXX", "fields": {"Name": "Updated"}}]
- Delete record: [CONNECTOR_ACTION: airtable | delete_record | {"baseId": "appXXX", "tableId": "tblXXX", "recordId": "recXXX"}]

**TWILIO ACTIONS** (if connected):
- Get account info: [CONNECTOR_ACTION: twilio | get_account | {}]
- Send SMS: [CONNECTOR_ACTION: twilio | send_sms | {"to": "+1234567890", "from": "+0987654321", "body": "Hello!"}]
- List messages: [CONNECTOR_ACTION: twilio | list_messages | {"limit": 20}]
- Get message: [CONNECTOR_ACTION: twilio | get_message | {"messageSid": "SMxxx"}]
- List phone numbers: [CONNECTOR_ACTION: twilio | list_phone_numbers | {}]

**BLACK FOREST LABS (FLUX) ACTIONS** (if connected):
- Generate image (Pro): [CONNECTOR_ACTION: bfl | generate_image | {"prompt": "A beautiful landscape", "width": 1024, "height": 1024}]
- Generate image (Dev): [CONNECTOR_ACTION: bfl | flux_dev | {"prompt": "A futuristic city"}]
- Generate image (Fast): [CONNECTOR_ACTION: bfl | flux_schnell | {"prompt": "Quick concept art"}]
- Image to image: [CONNECTOR_ACTION: bfl | image_to_image | {"prompt": "Make it more vibrant", "image_url": "https://..."}]
- Inpaint: [CONNECTOR_ACTION: bfl | inpaint | {"prompt": "Add a tree", "image_url": "https://...", "mask_url": "https://..."}]

**RUNWAY ACTIONS** (if connected):
- Generate video from text: [CONNECTOR_ACTION: runway | generate_video | {"prompt": "A drone shot over mountains", "duration": 5}]
- Generate video from image: [CONNECTOR_ACTION: runway | image_to_video | {"image_url": "https://...", "prompt": "Make it move", "duration": 5}]
- Get task status: [CONNECTOR_ACTION: runway | get_task | {"taskId": "xxx"}]
- Cancel task: [CONNECTOR_ACTION: runway | cancel_task | {"taskId": "xxx"}]

**LUMA AI (DREAM MACHINE) ACTIONS** (if connected):
- Generate video from text: [CONNECTOR_ACTION: luma | generate_video | {"prompt": "A cinematic shot of the ocean"}]
- Generate video from image: [CONNECTOR_ACTION: luma | image_to_video | {"prompt": "Animate this", "image_url": "https://..."}]
- Extend video: [CONNECTOR_ACTION: luma | extend_video | {"generation_id": "xxx", "prompt": "Continue the scene"}]
- Get generation status: [CONNECTOR_ACTION: luma | get_generation | {"generationId": "xxx"}]
- List generations: [CONNECTOR_ACTION: luma | list_generations | {}]
- Get credits: [CONNECTOR_ACTION: luma | get_credits | {}]

**SUNO ACTIONS** (if connected):
- Generate song from lyrics: [CONNECTOR_ACTION: suno | generate_song | {"lyrics": "Verse 1...", "style": "pop, upbeat", "title": "My Song"}]
- Generate from description: [CONNECTOR_ACTION: suno | generate_from_description | {"description": "An upbeat summer pop song about friendship"}]
- Generate instrumental: [CONNECTOR_ACTION: suno | generate_song | {"prompt": "Epic orchestral", "instrumental": true}]
- Extend song: [CONNECTOR_ACTION: suno | extend_song | {"clip_id": "xxx", "lyrics": "More lyrics..."}]
- Get song status: [CONNECTOR_ACTION: suno | get_song | {"clipId": "xxx"}]
- List songs: [CONNECTOR_ACTION: suno | list_songs | {}]
- Get credits: [CONNECTOR_ACTION: suno | get_credits | {}]

**COINBASE ACTIONS** (if connected):
- Get user info: [CONNECTOR_ACTION: coinbase | get_user | {}]
- List accounts: [CONNECTOR_ACTION: coinbase | list_accounts | {}]
- Get account: [CONNECTOR_ACTION: coinbase | get_account | {"accountId": "xxx"}]
- Get prices: [CONNECTOR_ACTION: coinbase | get_prices | {"currency": "USD"}]
- Get spot price: [CONNECTOR_ACTION: coinbase | get_spot_price | {"pair": "BTC-USD"}]
- List transactions: [CONNECTOR_ACTION: coinbase | list_transactions | {"accountId": "xxx"}]
- Send crypto: [CONNECTOR_ACTION: coinbase | send_money | {"accountId": "xxx", "to": "address", "amount": "0.01", "currency": "BTC"}]

**KLAVIYO ACTIONS** (if connected):
- List profiles: [CONNECTOR_ACTION: klaviyo | list_profiles | {"pageSize": 20}]
- Get profile: [CONNECTOR_ACTION: klaviyo | get_profile | {"profileId": "xxx"}]
- Create profile: [CONNECTOR_ACTION: klaviyo | create_profile | {"email": "user@example.com", "firstName": "John", "lastName": "Doe"}]
- Update profile: [CONNECTOR_ACTION: klaviyo | update_profile | {"profileId": "xxx", "firstName": "Updated"}]
- List lists: [CONNECTOR_ACTION: klaviyo | list_lists | {}]
- Add to list: [CONNECTOR_ACTION: klaviyo | add_to_list | {"listId": "xxx", "profiles": [{"email": "user@example.com"}]}]
- List campaigns: [CONNECTOR_ACTION: klaviyo | list_campaigns | {}]
- List flows: [CONNECTOR_ACTION: klaviyo | list_flows | {}]
- Track event: [CONNECTOR_ACTION: klaviyo | track_event | {"email": "user@example.com", "eventName": "Purchased", "properties": {"item": "T-Shirt"}}]
- Get metrics: [CONNECTOR_ACTION: klaviyo | get_metrics | {}]

**PRINTFUL ACTIONS** (if connected):
- Get store info: [CONNECTOR_ACTION: printful | get_store | {}]
- List products: [CONNECTOR_ACTION: printful | list_products | {"limit": 20}]
- Get product: [CONNECTOR_ACTION: printful | get_product | {"productId": "xxx"}]
- List orders: [CONNECTOR_ACTION: printful | list_orders | {"status": "fulfilled"}]
- Get order: [CONNECTOR_ACTION: printful | get_order | {"orderId": "xxx"}]
- Estimate costs: [CONNECTOR_ACTION: printful | estimate_costs | {"recipient": {...}, "items": [...]}]
- Create order: [CONNECTOR_ACTION: printful | create_order | {"recipient": {...}, "items": [...]}]
- Cancel order: [CONNECTOR_ACTION: printful | cancel_order | {"orderId": "xxx"}]
- List catalog products: [CONNECTOR_ACTION: printful | list_catalog_products | {}]
- Get shipping rates: [CONNECTOR_ACTION: printful | get_shipping_rates | {"recipient": {...}, "items": [...]}]

**RESEND ACTIONS** (if connected):
- Send email: [CONNECTOR_ACTION: resend | send_email | {"from": "you@yourdomain.com", "to": "recipient@email.com", "subject": "Hello", "html": "<p>Email content</p>"}]
- Get email: [CONNECTOR_ACTION: resend | get_email | {"emailId": "xxx"}]
- List domains: [CONNECTOR_ACTION: resend | list_domains | {}]
- Add domain: [CONNECTOR_ACTION: resend | add_domain | {"name": "yourdomain.com"}]
- Verify domain: [CONNECTOR_ACTION: resend | verify_domain | {"domainId": "xxx"}]

**BUFFER ACTIONS** (if connected):
- Get user: [CONNECTOR_ACTION: buffer | get_user | {}]
- List profiles: [CONNECTOR_ACTION: buffer | list_profiles | {}]
- Get profile: [CONNECTOR_ACTION: buffer | get_profile | {"profileId": "xxx"}]
- Get schedules: [CONNECTOR_ACTION: buffer | get_schedules | {"profileId": "xxx"}]
- List pending posts: [CONNECTOR_ACTION: buffer | list_pending_updates | {"profileId": "xxx"}]
- List sent posts: [CONNECTOR_ACTION: buffer | list_sent_updates | {"profileId": "xxx"}]
- Create post: [CONNECTOR_ACTION: buffer | create_update | {"profileIds": ["xxx"], "text": "Hello world!", "now": false}]
- Get post: [CONNECTOR_ACTION: buffer | get_update | {"updateId": "xxx"}]
- Update post: [CONNECTOR_ACTION: buffer | update_update | {"updateId": "xxx", "text": "Updated text"}]
- Delete post: [CONNECTOR_ACTION: buffer | delete_update | {"updateId": "xxx"}]
- Share now: [CONNECTOR_ACTION: buffer | share_now | {"updateId": "xxx"}]
- Shuffle queue: [CONNECTOR_ACTION: buffer | shuffle_updates | {"profileId": "xxx"}]

**CALENDLY ACTIONS** (if connected):
- Get current user: [CONNECTOR_ACTION: calendly | get_current_user | {}]
- List event types: [CONNECTOR_ACTION: calendly | list_event_types | {"userUri": "https://api.calendly.com/users/xxx"}]
- Get event type: [CONNECTOR_ACTION: calendly | get_event_type | {"eventTypeUri": "https://api.calendly.com/event_types/xxx"}]
- List scheduled events: [CONNECTOR_ACTION: calendly | list_scheduled_events | {"userUri": "https://...", "minStartTime": "2024-01-01T00:00:00Z"}]
- Get scheduled event: [CONNECTOR_ACTION: calendly | get_scheduled_event | {"eventUri": "https://api.calendly.com/scheduled_events/xxx"}]
- List event invitees: [CONNECTOR_ACTION: calendly | list_event_invitees | {"eventUri": "https://..."}]
- Cancel event: [CONNECTOR_ACTION: calendly | cancel_event | {"eventUri": "https://...", "reason": "Rescheduling"}]
- Get availability: [CONNECTOR_ACTION: calendly | get_availability | {"userUri": "https://..."}]
- List webhooks: [CONNECTOR_ACTION: calendly | list_webhooks | {"organizationUri": "https://..."}]
- Create webhook: [CONNECTOR_ACTION: calendly | create_webhook | {"url": "https://...", "events": ["invitee.created"], "scope": "organization", "organizationUri": "https://..."}]

**CLOUDFLARE ACTIONS** (if connected):
- List zones: [CONNECTOR_ACTION: cloudflare | list_zones | {}]
- Get zone: [CONNECTOR_ACTION: cloudflare | get_zone | {"zoneId": "xxx"}]
- List DNS records: [CONNECTOR_ACTION: cloudflare | list_dns_records | {"zoneId": "xxx"}]
- Get DNS record: [CONNECTOR_ACTION: cloudflare | get_dns_record | {"zoneId": "xxx", "recordId": "yyy"}]
- Create DNS record: [CONNECTOR_ACTION: cloudflare | create_dns_record | {"zoneId": "xxx", "type": "A", "name": "subdomain", "content": "1.2.3.4"}]
- Update DNS record: [CONNECTOR_ACTION: cloudflare | update_dns_record | {"zoneId": "xxx", "recordId": "yyy", "content": "5.6.7.8"}]
- Delete DNS record: [CONNECTOR_ACTION: cloudflare | delete_dns_record | {"zoneId": "xxx", "recordId": "yyy"}]
- Purge cache: [CONNECTOR_ACTION: cloudflare | purge_cache | {"zoneId": "xxx", "purge_everything": true}]
- List Workers: [CONNECTOR_ACTION: cloudflare | list_workers | {}]
- Get analytics: [CONNECTOR_ACTION: cloudflare | get_analytics | {"zoneId": "xxx"}]

**UPSTASH (REDIS) ACTIONS** (if connected):
- Ping: [CONNECTOR_ACTION: upstash | ping | {}]
- Get key: [CONNECTOR_ACTION: upstash | get | {"key": "mykey"}]
- Set key: [CONNECTOR_ACTION: upstash | set | {"key": "mykey", "value": "myvalue", "ex": 3600}]
- Delete key: [CONNECTOR_ACTION: upstash | del | {"key": "mykey"}]
- Find keys: [CONNECTOR_ACTION: upstash | keys | {"pattern": "user:*"}]
- Check exists: [CONNECTOR_ACTION: upstash | exists | {"key": "mykey"}]
- Set expiration: [CONNECTOR_ACTION: upstash | expire | {"key": "mykey", "seconds": 3600}]
- Get TTL: [CONNECTOR_ACTION: upstash | ttl | {"key": "mykey"}]
- Increment: [CONNECTOR_ACTION: upstash | incr | {"key": "counter"}]
- Decrement: [CONNECTOR_ACTION: upstash | decr | {"key": "counter"}]
- Hash get: [CONNECTOR_ACTION: upstash | hget | {"key": "user:1", "field": "name"}]
- Hash set: [CONNECTOR_ACTION: upstash | hset | {"key": "user:1", "field": "name", "value": "John"}]
- Hash get all: [CONNECTOR_ACTION: upstash | hgetall | {"key": "user:1"}]
- List push (left): [CONNECTOR_ACTION: upstash | lpush | {"key": "mylist", "value": "item"}]
- List push (right): [CONNECTOR_ACTION: upstash | rpush | {"key": "mylist", "value": "item"}]
- List range: [CONNECTOR_ACTION: upstash | lrange | {"key": "mylist", "start": 0, "stop": -1}]
- Database size: [CONNECTOR_ACTION: upstash | dbsize | {}]
- Server info: [CONNECTOR_ACTION: upstash | info | {}]

**N8N ACTIONS** (if connected):
- List workflows: [CONNECTOR_ACTION: n8n | list_workflows | {"active": true}]
- Get workflow: [CONNECTOR_ACTION: n8n | get_workflow | {"workflowId": "xxx"}]
- Activate workflow: [CONNECTOR_ACTION: n8n | activate_workflow | {"workflowId": "xxx"}]
- Deactivate workflow: [CONNECTOR_ACTION: n8n | deactivate_workflow | {"workflowId": "xxx"}]
- Execute workflow: [CONNECTOR_ACTION: n8n | execute_workflow | {"workflowId": "xxx", "data": {"key": "value"}}]
- List executions: [CONNECTOR_ACTION: n8n | list_executions | {"workflowId": "xxx", "status": "success"}]
- Get execution: [CONNECTOR_ACTION: n8n | get_execution | {"executionId": "xxx"}]
- Delete execution: [CONNECTOR_ACTION: n8n | delete_execution | {"executionId": "xxx"}]
- List credentials: [CONNECTOR_ACTION: n8n | list_credentials | {}]
- Trigger webhook: [CONNECTOR_ACTION: n8n | trigger_webhook | {"webhookPath": "my-webhook-path", "data": {"key": "value"}}]

**COINBASE ADVANCED TRADE ACTIONS** (if connected):
- List accounts: [CONNECTOR_ACTION: coinbase-trade | list_accounts | {}]
- Get account: [CONNECTOR_ACTION: coinbase-trade | get_account | {"accountId": "xxx"}]
- List products: [CONNECTOR_ACTION: coinbase-trade | list_products | {}]
- Get product: [CONNECTOR_ACTION: coinbase-trade | get_product | {"productId": "BTC-USD"}]
- Get ticker: [CONNECTOR_ACTION: coinbase-trade | get_ticker | {"productId": "BTC-USD"}]
- Buy crypto: [CONNECTOR_ACTION: coinbase-trade | buy | {"productId": "BTC-USD", "amount": "100", "amountType": "quote_size"}]
- Sell crypto: [CONNECTOR_ACTION: coinbase-trade | sell | {"productId": "BTC-USD", "amount": "0.001", "amountType": "base_size"}]
- Create order: [CONNECTOR_ACTION: coinbase-trade | create_order | {"productId": "BTC-USD", "side": "BUY", "orderType": "market", "amount": "100"}]
- List orders: [CONNECTOR_ACTION: coinbase-trade | list_orders | {"productId": "BTC-USD", "status": "OPEN"}]
- Get order: [CONNECTOR_ACTION: coinbase-trade | get_order | {"orderId": "xxx"}]
- Cancel orders: [CONNECTOR_ACTION: coinbase-trade | cancel_orders | {"orderIds": ["xxx"]}]
- Get candles: [CONNECTOR_ACTION: coinbase-trade | get_candles | {"productId": "BTC-USD", "granularity": "ONE_HOUR"}]
- Get portfolio: [CONNECTOR_ACTION: coinbase-trade | get_portfolio | {}]

**ALPACA STOCK TRADING ACTIONS** (if connected):
- Get account: [CONNECTOR_ACTION: alpaca | get_account | {}]
- List positions: [CONNECTOR_ACTION: alpaca | list_positions | {}]
- Get position: [CONNECTOR_ACTION: alpaca | get_position | {"symbol": "AAPL"}]
- Close position: [CONNECTOR_ACTION: alpaca | close_position | {"symbol": "AAPL"}]
- Buy stock: [CONNECTOR_ACTION: alpaca | buy | {"symbol": "AAPL", "qty": 10}]
- Buy by dollar amount: [CONNECTOR_ACTION: alpaca | buy | {"symbol": "AAPL", "notional": 1000}]
- Sell stock: [CONNECTOR_ACTION: alpaca | sell | {"symbol": "AAPL", "qty": 10}]
- Create order: [CONNECTOR_ACTION: alpaca | create_order | {"symbol": "AAPL", "qty": 10, "side": "buy", "type": "limit", "limitPrice": 150}]
- List orders: [CONNECTOR_ACTION: alpaca | list_orders | {"status": "open"}]
- Get order: [CONNECTOR_ACTION: alpaca | get_order | {"orderId": "xxx"}]
- Cancel order: [CONNECTOR_ACTION: alpaca | cancel_order | {"orderId": "xxx"}]
- Get quote: [CONNECTOR_ACTION: alpaca | get_quote | {"symbol": "AAPL"}]
- Get bars: [CONNECTOR_ACTION: alpaca | get_bars | {"symbol": "AAPL", "timeframe": "1Day"}]
- List assets: [CONNECTOR_ACTION: alpaca | list_assets | {}]
- Get clock: [CONNECTOR_ACTION: alpaca | get_clock | {}]
- Get calendar: [CONNECTOR_ACTION: alpaca | get_calendar | {}]
- Get portfolio history: [CONNECTOR_ACTION: alpaca | get_portfolio_history | {"period": "1M"}]

**ALPHA VANTAGE MARKET DATA ACTIONS** (if connected):
- Get quote: [CONNECTOR_ACTION: alphavantage | get_quote | {"symbol": "AAPL"}]
- Search symbol: [CONNECTOR_ACTION: alphavantage | search_symbol | {"keywords": "apple"}]
- Get intraday: [CONNECTOR_ACTION: alphavantage | get_intraday | {"symbol": "AAPL", "interval": "5min"}]
- Get daily: [CONNECTOR_ACTION: alphavantage | get_daily | {"symbol": "AAPL"}]
- Get weekly: [CONNECTOR_ACTION: alphavantage | get_weekly | {"symbol": "AAPL"}]
- Get monthly: [CONNECTOR_ACTION: alphavantage | get_monthly | {"symbol": "AAPL"}]
- Get SMA: [CONNECTOR_ACTION: alphavantage | get_sma | {"symbol": "AAPL", "interval": "daily", "timePeriod": "20"}]
- Get EMA: [CONNECTOR_ACTION: alphavantage | get_ema | {"symbol": "AAPL", "interval": "daily", "timePeriod": "20"}]
- Get RSI: [CONNECTOR_ACTION: alphavantage | get_rsi | {"symbol": "AAPL", "interval": "daily", "timePeriod": "14"}]
- Get MACD: [CONNECTOR_ACTION: alphavantage | get_macd | {"symbol": "AAPL", "interval": "daily"}]
- Get Bollinger Bands: [CONNECTOR_ACTION: alphavantage | get_bbands | {"symbol": "AAPL", "interval": "daily"}]
- Get company overview: [CONNECTOR_ACTION: alphavantage | get_company_overview | {"symbol": "AAPL"}]
- Get earnings: [CONNECTOR_ACTION: alphavantage | get_earnings | {"symbol": "AAPL"}]
- Get news: [CONNECTOR_ACTION: alphavantage | get_news | {"tickers": "AAPL"}]
- Get top gainers/losers: [CONNECTOR_ACTION: alphavantage | get_top_gainers_losers | {}]
- Get exchange rate: [CONNECTOR_ACTION: alphavantage | get_exchange_rate | {"fromCurrency": "BTC", "toCurrency": "USD"}]

**COINGECKO CRYPTO DATA ACTIONS** (if connected):
- Ping: [CONNECTOR_ACTION: coingecko | ping | {}]
- Get price: [CONNECTOR_ACTION: coingecko | get_price | {"ids": "bitcoin,ethereum", "vsCurrencies": "usd"}]
- Get coin: [CONNECTOR_ACTION: coingecko | get_coin | {"id": "bitcoin"}]
- List coins: [CONNECTOR_ACTION: coingecko | list_coins | {"vsCurrency": "usd", "perPage": 20}]
- Get trending: [CONNECTOR_ACTION: coingecko | get_trending | {}]
- Search: [CONNECTOR_ACTION: coingecko | search | {"query": "solana"}]
- Get market chart: [CONNECTOR_ACTION: coingecko | get_market_chart | {"id": "bitcoin", "days": "7"}]
- Get OHLC: [CONNECTOR_ACTION: coingecko | get_ohlc | {"id": "bitcoin", "days": "7"}]
- Get global: [CONNECTOR_ACTION: coingecko | get_global | {}]
- Get global DeFi: [CONNECTOR_ACTION: coingecko | get_global_defi | {}]
- List categories: [CONNECTOR_ACTION: coingecko | list_categories | {}]
- List exchanges: [CONNECTOR_ACTION: coingecko | list_exchanges | {}]
- Get exchange: [CONNECTOR_ACTION: coingecko | get_exchange | {"id": "binance"}]
- Get exchange rates: [CONNECTOR_ACTION: coingecko | get_exchange_rates | {}]
- List NFTs: [CONNECTOR_ACTION: coingecko | list_nfts | {}]

**NEWSAPI NEWS ACTIONS** (if connected):
- Get top headlines: [CONNECTOR_ACTION: newsapi | get_top_headlines | {"country": "us", "category": "technology"}]
- Search everything: [CONNECTOR_ACTION: newsapi | search_everything | {"q": "artificial intelligence"}]
- Get sources: [CONNECTOR_ACTION: newsapi | get_sources | {"category": "technology"}]
- Get business news: [CONNECTOR_ACTION: newsapi | get_business_news | {"country": "us"}]
- Get tech news: [CONNECTOR_ACTION: newsapi | get_tech_news | {"country": "us"}]
- Get crypto news: [CONNECTOR_ACTION: newsapi | get_crypto_news | {}]
- Get stock news: [CONNECTOR_ACTION: newsapi | get_stock_news | {"symbol": "AAPL", "company": "Apple"}]
- Get AI news: [CONNECTOR_ACTION: newsapi | get_ai_news | {}]
- Get startup news: [CONNECTOR_ACTION: newsapi | get_startup_news | {}]

**ZAPIER AUTOMATION ACTIONS** (if connected):
- Trigger webhook: [CONNECTOR_ACTION: zapier | trigger_webhook | {"webhookUrl": "https://hooks.zapier.com/...", "data": {"key": "value"}}]
- List NLA actions: [CONNECTOR_ACTION: zapier | list_actions | {}]
- Execute NLA action: [CONNECTOR_ACTION: zapier | execute_action | {"actionId": "xxx", "instructions": "Send an email to john@example.com"}]
- Preview action: [CONNECTOR_ACTION: zapier | preview_action | {"actionId": "xxx", "instructions": "Send an email"}]
- Get action details: [CONNECTOR_ACTION: zapier | get_action | {"actionId": "xxx"}]
- Get execution log: [CONNECTOR_ACTION: zapier | get_execution_log | {"executionId": "xxx"}]
- Send email via Zap: [CONNECTOR_ACTION: zapier | send_to_email | {"webhookUrl": "https://...", "to": "user@example.com", "subject": "Hello", "body": "Message"}]
- Send to Slack via Zap: [CONNECTOR_ACTION: zapier | send_to_slack | {"webhookUrl": "https://...", "channel": "#general", "message": "Hello!"}]
- Create task via Zap: [CONNECTOR_ACTION: zapier | create_task | {"webhookUrl": "https://...", "title": "New task", "description": "Details"}]

**MIXPANEL ANALYTICS ACTIONS** (if connected):
- Get event names: [CONNECTOR_ACTION: mixpanel | get_event_names | {}]
- Get events: [CONNECTOR_ACTION: mixpanel | get_events | {"event": "Signup", "fromDate": "2024-01-01", "toDate": "2024-01-31"}]
- Get top events: [CONNECTOR_ACTION: mixpanel | get_top_events | {"limit": 10}]
- List funnels: [CONNECTOR_ACTION: mixpanel | get_funnels | {}]
- Get funnel data: [CONNECTOR_ACTION: mixpanel | get_funnel | {"funnelId": "123", "fromDate": "2024-01-01", "toDate": "2024-01-31"}]
- Get retention: [CONNECTOR_ACTION: mixpanel | get_retention | {"fromDate": "2024-01-01", "toDate": "2024-01-31"}]
- Get segmentation: [CONNECTOR_ACTION: mixpanel | get_segmentation | {"event": "Purchase", "fromDate": "2024-01-01", "toDate": "2024-01-31"}]
- Get insights: [CONNECTOR_ACTION: mixpanel | get_insights | {"bookmarkId": "123"}]
- Track event: [CONNECTOR_ACTION: mixpanel | track_event | {"event": "Custom Event", "properties": {"key": "value"}}]
- Get user profiles: [CONNECTOR_ACTION: mixpanel | get_user_profiles | {"where": "properties[\"$city\"]==\"San Francisco\""}]

**AMPLITUDE ANALYTICS ACTIONS** (if connected):
- Get events: [CONNECTOR_ACTION: amplitude | get_events | {"start": "20240101", "end": "20240131"}]
- Get active users: [CONNECTOR_ACTION: amplitude | get_active_users | {"start": "20240101", "end": "20240131"}]
- Get sessions: [CONNECTOR_ACTION: amplitude | get_sessions | {"start": "20240101", "end": "20240131"}]
- Get retention: [CONNECTOR_ACTION: amplitude | get_retention | {"start": "20240101", "end": "20240131", "retentionType": "n-day"}]
- Get funnel: [CONNECTOR_ACTION: amplitude | get_funnel | {"start": "20240101", "end": "20240131", "e": "[{\"event_type\":\"signup\"},{\"event_type\":\"purchase\"}]"}]
- Get revenue: [CONNECTOR_ACTION: amplitude | get_revenue | {"start": "20240101", "end": "20240131"}]
- Get user activity: [CONNECTOR_ACTION: amplitude | get_user_activity | {"userId": "user123"}]
- Search users: [CONNECTOR_ACTION: amplitude | search_users | {"userId": "user123"}]
- Get realtime users: [CONNECTOR_ACTION: amplitude | get_realtime | {}]
- Track event: [CONNECTOR_ACTION: amplitude | track_event | {"userId": "user123", "eventType": "button_click", "eventProperties": {"button": "signup"}}]

**ASANA PROJECT ACTIONS** (if connected):
- Get me: [CONNECTOR_ACTION: asana | get_me | {}]
- List workspaces: [CONNECTOR_ACTION: asana | list_workspaces | {}]
- List projects: [CONNECTOR_ACTION: asana | list_projects | {"workspaceId": "xxx"}]
- Get project: [CONNECTOR_ACTION: asana | get_project | {"projectId": "xxx"}]
- List tasks: [CONNECTOR_ACTION: asana | list_tasks | {"projectId": "xxx"}]
- Get task: [CONNECTOR_ACTION: asana | get_task | {"taskId": "xxx"}]
- Create task: [CONNECTOR_ACTION: asana | create_task | {"projectId": "xxx", "name": "Task name", "notes": "Description"}]
- Update task: [CONNECTOR_ACTION: asana | update_task | {"taskId": "xxx", "name": "Updated name"}]
- Complete task: [CONNECTOR_ACTION: asana | complete_task | {"taskId": "xxx"}]
- Delete task: [CONNECTOR_ACTION: asana | delete_task | {"taskId": "xxx"}]
- Add comment: [CONNECTOR_ACTION: asana | add_comment | {"taskId": "xxx", "text": "Comment text"}]
- Search tasks: [CONNECTOR_ACTION: asana | search_tasks | {"workspaceId": "xxx", "query": "search term"}]
- List sections: [CONNECTOR_ACTION: asana | list_sections | {"projectId": "xxx"}]

**TRELLO BOARD ACTIONS** (if connected):
- Get me: [CONNECTOR_ACTION: trello | get_me | {}]
- List boards: [CONNECTOR_ACTION: trello | list_boards | {}]
- Get board: [CONNECTOR_ACTION: trello | get_board | {"boardId": "xxx"}]
- List lists: [CONNECTOR_ACTION: trello | list_lists | {"boardId": "xxx"}]
- List cards: [CONNECTOR_ACTION: trello | list_cards | {"listId": "xxx"}]
- Get card: [CONNECTOR_ACTION: trello | get_card | {"cardId": "xxx"}]
- Create card: [CONNECTOR_ACTION: trello | create_card | {"listId": "xxx", "name": "Card name", "desc": "Description"}]
- Update card: [CONNECTOR_ACTION: trello | update_card | {"cardId": "xxx", "name": "Updated name"}]
- Move card: [CONNECTOR_ACTION: trello | move_card | {"cardId": "xxx", "listId": "yyy"}]
- Archive card: [CONNECTOR_ACTION: trello | archive_card | {"cardId": "xxx"}]
- Delete card: [CONNECTOR_ACTION: trello | delete_card | {"cardId": "xxx"}]
- Add comment: [CONNECTOR_ACTION: trello | add_comment | {"cardId": "xxx", "text": "Comment"}]
- Create list: [CONNECTOR_ACTION: trello | create_list | {"boardId": "xxx", "name": "New List"}]
- Add label: [CONNECTOR_ACTION: trello | add_label | {"cardId": "xxx", "labelId": "yyy"}]
- List labels: [CONNECTOR_ACTION: trello | list_labels | {"boardId": "xxx"}]

**CLICKUP TASK ACTIONS** (if connected):
- Get user: [CONNECTOR_ACTION: clickup | get_user | {}]
- List teams: [CONNECTOR_ACTION: clickup | list_teams | {}]
- List spaces: [CONNECTOR_ACTION: clickup | list_spaces | {"teamId": "xxx"}]
- List folders: [CONNECTOR_ACTION: clickup | list_folders | {"spaceId": "xxx"}]
- List lists: [CONNECTOR_ACTION: clickup | list_lists | {"folderId": "xxx"}]
- List tasks: [CONNECTOR_ACTION: clickup | list_tasks | {"listId": "xxx"}]
- Get task: [CONNECTOR_ACTION: clickup | get_task | {"taskId": "xxx"}]
- Create task: [CONNECTOR_ACTION: clickup | create_task | {"listId": "xxx", "name": "Task name", "description": "Details"}]
- Update task: [CONNECTOR_ACTION: clickup | update_task | {"taskId": "xxx", "name": "Updated", "status": "complete"}]
- Delete task: [CONNECTOR_ACTION: clickup | delete_task | {"taskId": "xxx"}]
- Add comment: [CONNECTOR_ACTION: clickup | add_comment | {"taskId": "xxx", "commentText": "Comment"}]
- List comments: [CONNECTOR_ACTION: clickup | list_comments | {"taskId": "xxx"}]
- List statuses: [CONNECTOR_ACTION: clickup | list_statuses | {"listId": "xxx"}]
- Get time tracked: [CONNECTOR_ACTION: clickup | get_time_tracked | {"taskId": "xxx"}]

**MONDAY.COM BOARD ACTIONS** (if connected):
- Get me: [CONNECTOR_ACTION: monday | get_me | {}]
- List workspaces: [CONNECTOR_ACTION: monday | list_workspaces | {}]
- List boards: [CONNECTOR_ACTION: monday | list_boards | {"limit": 25}]
- Get board: [CONNECTOR_ACTION: monday | get_board | {"boardId": "123"}]
- List items: [CONNECTOR_ACTION: monday | list_items | {"boardId": "123"}]
- Get item: [CONNECTOR_ACTION: monday | get_item | {"itemId": "456"}]
- Create item: [CONNECTOR_ACTION: monday | create_item | {"boardId": "123", "name": "New Item", "groupId": "group1"}]
- Update item: [CONNECTOR_ACTION: monday | update_item | {"boardId": "123", "itemId": "456", "columnValues": {"status": {"label": "Done"}}}]
- Update item name: [CONNECTOR_ACTION: monday | update_item_name | {"itemId": "456", "boardId": "123", "name": "New Name"}]
- Move to group: [CONNECTOR_ACTION: monday | move_item_to_group | {"itemId": "456", "groupId": "group2"}]
- Archive item: [CONNECTOR_ACTION: monday | archive_item | {"itemId": "456"}]
- Delete item: [CONNECTOR_ACTION: monday | delete_item | {"itemId": "456"}]
- Create group: [CONNECTOR_ACTION: monday | create_group | {"boardId": "123", "name": "New Group"}]
- Add update: [CONNECTOR_ACTION: monday | add_update | {"itemId": "456", "body": "Comment text"}]
- List updates: [CONNECTOR_ACTION: monday | list_updates | {"itemId": "456"}]
- Search items: [CONNECTOR_ACTION: monday | search_items | {"boardId": "123", "query": "search term"}]

**WORDPRESS CMS ACTIONS** (if connected):
- Get me: [CONNECTOR_ACTION: wordpress | get_me | {}]
- Get site info: [CONNECTOR_ACTION: wordpress | get_site_info | {}]
- List posts: [CONNECTOR_ACTION: wordpress | list_posts | {"perPage": 10, "status": "publish"}]
- Get post: [CONNECTOR_ACTION: wordpress | get_post | {"postId": "123"}]
- Create post: [CONNECTOR_ACTION: wordpress | create_post | {"title": "My Post", "content": "<p>Content here</p>", "status": "draft"}]
- Update post: [CONNECTOR_ACTION: wordpress | update_post | {"postId": "123", "title": "Updated", "status": "publish"}]
- Delete post: [CONNECTOR_ACTION: wordpress | delete_post | {"postId": "123", "force": false}]
- List pages: [CONNECTOR_ACTION: wordpress | list_pages | {"perPage": 10}]
- Create page: [CONNECTOR_ACTION: wordpress | create_page | {"title": "My Page", "content": "<p>Page content</p>"}]
- List categories: [CONNECTOR_ACTION: wordpress | list_categories | {}]
- List tags: [CONNECTOR_ACTION: wordpress | list_tags | {}]
- List media: [CONNECTOR_ACTION: wordpress | list_media | {"perPage": 10}]
- List comments: [CONNECTOR_ACTION: wordpress | list_comments | {"post": "123"}]

**WEBFLOW CMS ACTIONS** (if connected):
- Get user: [CONNECTOR_ACTION: webflow | get_user | {}]
- List sites: [CONNECTOR_ACTION: webflow | list_sites | {}]
- Get site: [CONNECTOR_ACTION: webflow | get_site | {"siteId": "xxx"}]
- List collections: [CONNECTOR_ACTION: webflow | list_collections | {"siteId": "xxx"}]
- Get collection: [CONNECTOR_ACTION: webflow | get_collection | {"collectionId": "xxx"}]
- List items: [CONNECTOR_ACTION: webflow | list_items | {"collectionId": "xxx", "limit": 20}]
- Get item: [CONNECTOR_ACTION: webflow | get_item | {"collectionId": "xxx", "itemId": "yyy"}]
- Create item: [CONNECTOR_ACTION: webflow | create_item | {"collectionId": "xxx", "fieldData": {"name": "Item Name", "slug": "item-name"}}]
- Update item: [CONNECTOR_ACTION: webflow | update_item | {"collectionId": "xxx", "itemId": "yyy", "fieldData": {"name": "Updated"}}]
- Delete item: [CONNECTOR_ACTION: webflow | delete_item | {"collectionId": "xxx", "itemId": "yyy"}]
- Publish item: [CONNECTOR_ACTION: webflow | publish_item | {"collectionId": "xxx", "itemId": "yyy"}]
- Publish site: [CONNECTOR_ACTION: webflow | publish_site | {"siteId": "xxx"}]
- List domains: [CONNECTOR_ACTION: webflow | list_domains | {"siteId": "xxx"}]

**GHOST BLOG ACTIONS** (if connected):
- Get site: [CONNECTOR_ACTION: ghost | get_site | {}]
- List posts: [CONNECTOR_ACTION: ghost | list_posts | {"limit": 15, "status": "published"}]
- Get post: [CONNECTOR_ACTION: ghost | get_post | {"postId": "xxx"}]
- Create post: [CONNECTOR_ACTION: ghost | create_post | {"title": "My Post", "html": "<p>Content</p>", "status": "draft"}]
- Update post: [CONNECTOR_ACTION: ghost | update_post | {"postId": "xxx", "title": "Updated", "status": "published"}]
- Delete post: [CONNECTOR_ACTION: ghost | delete_post | {"postId": "xxx"}]
- List pages: [CONNECTOR_ACTION: ghost | list_pages | {"limit": 15}]
- Create page: [CONNECTOR_ACTION: ghost | create_page | {"title": "My Page", "html": "<p>Content</p>"}]
- List tags: [CONNECTOR_ACTION: ghost | list_tags | {}]
- Create tag: [CONNECTOR_ACTION: ghost | create_tag | {"name": "New Tag", "description": "Tag description"}]
- List members: [CONNECTOR_ACTION: ghost | list_members | {"limit": 15}]
- List users: [CONNECTOR_ACTION: ghost | list_users | {}]

**DOCUSIGN E-SIGNATURE ACTIONS** (if connected):
- List envelopes: [CONNECTOR_ACTION: docusign | list_envelopes | {"status": "completed"}]
- Get envelope: [CONNECTOR_ACTION: docusign | get_envelope | {"envelopeId": "xxx"}]
- Create envelope: [CONNECTOR_ACTION: docusign | create_envelope | {"templateId": "xxx", "recipients": [{"email": "signer@example.com", "name": "John Doe"}]}]
- Send envelope: [CONNECTOR_ACTION: docusign | send_envelope | {"envelopeId": "xxx"}]
- Get document: [CONNECTOR_ACTION: docusign | get_document | {"envelopeId": "xxx", "documentId": "1"}]
- List recipients: [CONNECTOR_ACTION: docusign | list_recipients | {"envelopeId": "xxx"}]
- Void envelope: [CONNECTOR_ACTION: docusign | void_envelope | {"envelopeId": "xxx", "voidReason": "Cancelled"}]
- List templates: [CONNECTOR_ACTION: docusign | list_templates | {}]

**DROPBOX SIGN (HELLOSIGN) E-SIGNATURE ACTIONS** (if connected):
- Get account: [CONNECTOR_ACTION: hellosign | get_account | {}]
- List signature requests: [CONNECTOR_ACTION: hellosign | list_signature_requests | {"pageSize": 20}]
- Get signature request: [CONNECTOR_ACTION: hellosign | get_signature_request | {"signatureRequestId": "xxx"}]
- Send signature request: [CONNECTOR_ACTION: hellosign | send_signature_request | {"title": "Contract", "signers": [{"email": "signer@example.com", "name": "John"}], "fileUrl": "https://..."}]
- Cancel signature request: [CONNECTOR_ACTION: hellosign | cancel_signature_request | {"signatureRequestId": "xxx"}]
- Download files: [CONNECTOR_ACTION: hellosign | download_files | {"signatureRequestId": "xxx"}]
- List templates: [CONNECTOR_ACTION: hellosign | list_templates | {}]
- Get template: [CONNECTOR_ACTION: hellosign | get_template | {"templateId": "xxx"}]

**JOBBER FIELD SERVICE ACTIONS** (if connected):
- Get account: [CONNECTOR_ACTION: jobber | get_account | {}]
- List clients: [CONNECTOR_ACTION: jobber | list_clients | {"first": 20}]
- Get client: [CONNECTOR_ACTION: jobber | get_client | {"clientId": "xxx"}]
- Create client: [CONNECTOR_ACTION: jobber | create_client | {"firstName": "John", "lastName": "Doe", "email": "john@example.com"}]
- List jobs: [CONNECTOR_ACTION: jobber | list_jobs | {"first": 20}]
- Get job: [CONNECTOR_ACTION: jobber | get_job | {"jobId": "xxx"}]
- Create job: [CONNECTOR_ACTION: jobber | create_job | {"clientId": "xxx", "title": "Service Call"}]
- List quotes: [CONNECTOR_ACTION: jobber | list_quotes | {"first": 20}]
- List invoices: [CONNECTOR_ACTION: jobber | list_invoices | {"first": 20}]
- List visits: [CONNECTOR_ACTION: jobber | list_visits | {"first": 20}]

**HOUSECALL PRO FIELD SERVICE ACTIONS** (if connected):
- Get me: [CONNECTOR_ACTION: housecallpro | get_me | {}]
- List customers: [CONNECTOR_ACTION: housecallpro | list_customers | {"limit": 20}]
- Get customer: [CONNECTOR_ACTION: housecallpro | get_customer | {"customerId": "xxx"}]
- Create customer: [CONNECTOR_ACTION: housecallpro | create_customer | {"first_name": "John", "last_name": "Doe", "email": "john@example.com"}]
- List jobs: [CONNECTOR_ACTION: housecallpro | list_jobs | {"limit": 20}]
- Get job: [CONNECTOR_ACTION: housecallpro | get_job | {"jobId": "xxx"}]
- Create job: [CONNECTOR_ACTION: housecallpro | create_job | {"customer_id": "xxx", "description": "Service call"}]
- List estimates: [CONNECTOR_ACTION: housecallpro | list_estimates | {"limit": 20}]
- List invoices: [CONNECTOR_ACTION: housecallpro | list_invoices | {"limit": 20}]
- List employees: [CONNECTOR_ACTION: housecallpro | list_employees | {}]

**TOGGL TRACK TIME TRACKING ACTIONS** (if connected):
- Get me: [CONNECTOR_ACTION: toggl | get_me | {}]
- List workspaces: [CONNECTOR_ACTION: toggl | list_workspaces | {}]
- Start time entry: [CONNECTOR_ACTION: toggl | start_time_entry | {"workspaceId": "xxx", "description": "Working on project"}]
- Stop time entry: [CONNECTOR_ACTION: toggl | stop_time_entry | {"workspaceId": "xxx", "timeEntryId": "yyy"}]
- Get current entry: [CONNECTOR_ACTION: toggl | get_current_entry | {}]
- List time entries: [CONNECTOR_ACTION: toggl | list_time_entries | {"startDate": "2024-01-01", "endDate": "2024-01-31"}]
- Create time entry: [CONNECTOR_ACTION: toggl | create_time_entry | {"workspaceId": "xxx", "description": "Task", "start": "2024-01-01T09:00:00Z", "duration": 3600}]
- Update time entry: [CONNECTOR_ACTION: toggl | update_time_entry | {"workspaceId": "xxx", "timeEntryId": "yyy", "description": "Updated"}]
- Delete time entry: [CONNECTOR_ACTION: toggl | delete_time_entry | {"workspaceId": "xxx", "timeEntryId": "yyy"}]
- List projects: [CONNECTOR_ACTION: toggl | list_projects | {"workspaceId": "xxx"}]
- List clients: [CONNECTOR_ACTION: toggl | list_clients | {"workspaceId": "xxx"}]
- Get reports: [CONNECTOR_ACTION: toggl | get_summary_report | {"workspaceId": "xxx", "startDate": "2024-01-01", "endDate": "2024-01-31"}]

**WORKYARD WORKFORCE MANAGEMENT ACTIONS** (if connected):
- List employees: [CONNECTOR_ACTION: workyard | list_employees | {}]
- Get employee: [CONNECTOR_ACTION: workyard | get_employee | {"employeeId": "xxx"}]
- List projects: [CONNECTOR_ACTION: workyard | list_projects | {}]
- Get project: [CONNECTOR_ACTION: workyard | get_project | {"projectId": "xxx"}]
- List time entries: [CONNECTOR_ACTION: workyard | list_time_entries | {"startDate": "2024-01-01", "endDate": "2024-01-31"}]
- Export timesheets: [CONNECTOR_ACTION: workyard | export_timesheets | {"startDate": "2024-01-01", "endDate": "2024-01-31"}]
- Get labor costs: [CONNECTOR_ACTION: workyard | get_labor_costs | {"projectId": "xxx"}]

**CANVA DESIGN ACTIONS** (if connected):
- Get user: [CONNECTOR_ACTION: canva | get_user | {}]
- List designs: [CONNECTOR_ACTION: canva | list_designs | {"limit": 20}]
- Get design: [CONNECTOR_ACTION: canva | get_design | {"designId": "xxx"}]
- Create design: [CONNECTOR_ACTION: canva | create_design | {"title": "My Design", "designType": "doc"}]
- Export design: [CONNECTOR_ACTION: canva | export_design | {"designId": "xxx", "format": "png"}]
- List folders: [CONNECTOR_ACTION: canva | list_folders | {}]
- Upload asset: [CONNECTOR_ACTION: canva | upload_asset | {"name": "image.png", "url": "https://..."}]
- List brand templates: [CONNECTOR_ACTION: canva | list_brand_templates | {}]

**DESCRIPT AUDIO/VIDEO ACTIONS** (if connected):
- List projects: [CONNECTOR_ACTION: descript | list_projects | {}]
- Get project: [CONNECTOR_ACTION: descript | get_project | {"projectId": "xxx"}]
- Create project: [CONNECTOR_ACTION: descript | create_project | {"name": "My Project"}]
- Export project: [CONNECTOR_ACTION: descript | export_project | {"projectId": "xxx", "format": "mp4"}]
- Get transcription: [CONNECTOR_ACTION: descript | get_transcription | {"projectId": "xxx"}]

**TELEGRAM BOT ACTIONS** (if connected):
- Get bot info: [CONNECTOR_ACTION: telegram | get_me | {}]
- Send message: [CONNECTOR_ACTION: telegram | send_message | {"chatId": "123456789", "text": "Hello!"}]
- Send photo: [CONNECTOR_ACTION: telegram | send_photo | {"chatId": "123456789", "photo": "https://...", "caption": "Check this out"}]
- Send document: [CONNECTOR_ACTION: telegram | send_document | {"chatId": "123456789", "document": "https://...", "caption": "Here's the file"}]
- Get updates: [CONNECTOR_ACTION: telegram | get_updates | {"limit": 10}]
- Get chat: [CONNECTOR_ACTION: telegram | get_chat | {"chatId": "123456789"}]
- Get chat members count: [CONNECTOR_ACTION: telegram | get_chat_members_count | {"chatId": "123456789"}]
- Set webhook: [CONNECTOR_ACTION: telegram | set_webhook | {"url": "https://yourserver.com/webhook"}]
- Delete webhook: [CONNECTOR_ACTION: telegram | delete_webhook | {}]
- Send poll: [CONNECTOR_ACTION: telegram | send_poll | {"chatId": "123456789", "question": "What do you prefer?", "options": ["Option A", "Option B"]}]

**EXPENSIFY EXPENSE ACTIONS** (if connected):
- List policies: [CONNECTOR_ACTION: expensify | list_policies | {}]
- Export reports: [CONNECTOR_ACTION: expensify | export_reports | {"policyId": "xxx", "startDate": "2024-01-01", "endDate": "2024-01-31"}]
- Create expense: [CONNECTOR_ACTION: expensify | create_expense | {"policyId": "xxx", "merchant": "Coffee Shop", "amount": 500, "currency": "USD"}]
- Get report: [CONNECTOR_ACTION: expensify | get_report | {"reportId": "xxx"}]
- List employees: [CONNECTOR_ACTION: expensify | list_employees | {"policyId": "xxx"}]
- Add employee: [CONNECTOR_ACTION: expensify | add_employee | {"policyId": "xxx", "email": "user@example.com"}]

**YNAB BUDGETING ACTIONS** (if connected):
- Get user: [CONNECTOR_ACTION: ynab | get_user | {}]
- List budgets: [CONNECTOR_ACTION: ynab | list_budgets | {}]
- Get budget: [CONNECTOR_ACTION: ynab | get_budget | {"budgetId": "xxx"}]
- List accounts: [CONNECTOR_ACTION: ynab | list_accounts | {"budgetId": "xxx"}]
- Get account: [CONNECTOR_ACTION: ynab | get_account | {"budgetId": "xxx", "accountId": "yyy"}]
- List categories: [CONNECTOR_ACTION: ynab | list_categories | {"budgetId": "xxx"}]
- Get category: [CONNECTOR_ACTION: ynab | get_category | {"budgetId": "xxx", "categoryId": "yyy"}]
- List transactions: [CONNECTOR_ACTION: ynab | list_transactions | {"budgetId": "xxx", "sinceDate": "2024-01-01"}]
- Create transaction: [CONNECTOR_ACTION: ynab | create_transaction | {"budgetId": "xxx", "accountId": "yyy", "amount": -5000, "payeeName": "Coffee Shop", "date": "2024-01-15"}]
- Update transaction: [CONNECTOR_ACTION: ynab | update_transaction | {"budgetId": "xxx", "transactionId": "yyy", "memo": "Updated memo"}]
- Get budget summary: [CONNECTOR_ACTION: ynab | get_budget_summary | {"budgetId": "xxx", "month": "2024-01-01"}]

**PLAID FINANCIAL DATA ACTIONS** (if connected):
- Create link token: [CONNECTOR_ACTION: plaid | create_link_token | {"userId": "user123"}]
- Exchange public token: [CONNECTOR_ACTION: plaid | exchange_public_token | {"publicToken": "public-xxx"}]
- Get accounts: [CONNECTOR_ACTION: plaid | get_accounts | {"accessToken": "access-xxx"}]
- Get balance: [CONNECTOR_ACTION: plaid | get_balance | {"accessToken": "access-xxx"}]
- Get transactions: [CONNECTOR_ACTION: plaid | get_transactions | {"accessToken": "access-xxx", "startDate": "2024-01-01", "endDate": "2024-01-31"}]
- Get identity: [CONNECTOR_ACTION: plaid | get_identity | {"accessToken": "access-xxx"}]
- Get institutions: [CONNECTOR_ACTION: plaid | get_institutions | {"count": 10}]
- Search institutions: [CONNECTOR_ACTION: plaid | search_institutions | {"query": "Chase"}]

**WAVE ACCOUNTING ACTIONS** (if connected):
- Get user: [CONNECTOR_ACTION: wave | get_user | {}]
- List businesses: [CONNECTOR_ACTION: wave | list_businesses | {}]
- Get business: [CONNECTOR_ACTION: wave | get_business | {"businessId": "xxx"}]
- List customers: [CONNECTOR_ACTION: wave | list_customers | {"businessId": "xxx"}]
- Create customer: [CONNECTOR_ACTION: wave | create_customer | {"businessId": "xxx", "name": "John Doe", "email": "john@example.com"}]
- List invoices: [CONNECTOR_ACTION: wave | list_invoices | {"businessId": "xxx"}]
- Create invoice: [CONNECTOR_ACTION: wave | create_invoice | {"businessId": "xxx", "customerId": "yyy", "items": [{"description": "Service", "unitPrice": 100}]}]
- Send invoice: [CONNECTOR_ACTION: wave | send_invoice | {"invoiceId": "xxx"}]
- List products: [CONNECTOR_ACTION: wave | list_products | {"businessId": "xxx"}]
- Create product: [CONNECTOR_ACTION: wave | create_product | {"businessId": "xxx", "name": "Service", "price": 100}]
- Get profit and loss: [CONNECTOR_ACTION: wave | get_profit_and_loss | {"businessId": "xxx", "startDate": "2024-01-01", "endDate": "2024-12-31"}]
- Get balance sheet: [CONNECTOR_ACTION: wave | get_balance_sheet | {"businessId": "xxx", "balanceDate": "2024-12-31"}]

**HUBSPOT CRM ACTIONS** (if connected):
- List contacts: [CONNECTOR_ACTION: hubspot | list_contacts | {"limit": 20}]
- Get contact: [CONNECTOR_ACTION: hubspot | get_contact | {"contactId": "xxx"}]
- Create contact: [CONNECTOR_ACTION: hubspot | create_contact | {"email": "user@example.com", "firstName": "John", "lastName": "Doe"}]
- Update contact: [CONNECTOR_ACTION: hubspot | update_contact | {"contactId": "xxx", "properties": {"phone": "123-456-7890"}}]
- List companies: [CONNECTOR_ACTION: hubspot | list_companies | {"limit": 20}]
- Get company: [CONNECTOR_ACTION: hubspot | get_company | {"companyId": "xxx"}]
- Create company: [CONNECTOR_ACTION: hubspot | create_company | {"name": "Acme Corp", "domain": "acme.com"}]
- List deals: [CONNECTOR_ACTION: hubspot | list_deals | {"limit": 20}]
- Get deal: [CONNECTOR_ACTION: hubspot | get_deal | {"dealId": "xxx"}]
- Create deal: [CONNECTOR_ACTION: hubspot | create_deal | {"dealname": "New Deal", "pipeline": "default", "dealstage": "appointmentscheduled"}]
- Update deal: [CONNECTOR_ACTION: hubspot | update_deal | {"dealId": "xxx", "properties": {"amount": 5000}}]
- Search contacts: [CONNECTOR_ACTION: hubspot | search_contacts | {"query": "john@example.com"}]

**PIPEDRIVE CRM ACTIONS** (if connected):
- Get user: [CONNECTOR_ACTION: pipedrive | get_user | {}]
- List deals: [CONNECTOR_ACTION: pipedrive | list_deals | {"limit": 20, "status": "open"}]
- Get deal: [CONNECTOR_ACTION: pipedrive | get_deal | {"dealId": "xxx"}]
- Create deal: [CONNECTOR_ACTION: pipedrive | create_deal | {"title": "New Deal", "value": 5000}]
- Update deal: [CONNECTOR_ACTION: pipedrive | update_deal | {"dealId": "xxx", "title": "Updated Deal"}]
- List persons: [CONNECTOR_ACTION: pipedrive | list_persons | {"limit": 20}]
- Get person: [CONNECTOR_ACTION: pipedrive | get_person | {"personId": "xxx"}]
- Create person: [CONNECTOR_ACTION: pipedrive | create_person | {"name": "John Doe", "email": "john@example.com"}]
- List organizations: [CONNECTOR_ACTION: pipedrive | list_organizations | {"limit": 20}]
- Create organization: [CONNECTOR_ACTION: pipedrive | create_organization | {"name": "Acme Corp"}]
- List activities: [CONNECTOR_ACTION: pipedrive | list_activities | {"limit": 20}]
- Create activity: [CONNECTOR_ACTION: pipedrive | create_activity | {"subject": "Call", "type": "call", "dealId": "xxx"}]
- List pipelines: [CONNECTOR_ACTION: pipedrive | list_pipelines | {}]
- List stages: [CONNECTOR_ACTION: pipedrive | list_stages | {"pipelineId": "xxx"}]

**CLOSE CRM ACTIONS** (if connected):
- Get me: [CONNECTOR_ACTION: closecrm | get_me | {}]
- List leads: [CONNECTOR_ACTION: closecrm | list_leads | {"limit": 20}]
- Get lead: [CONNECTOR_ACTION: closecrm | get_lead | {"leadId": "xxx"}]
- Create lead: [CONNECTOR_ACTION: closecrm | create_lead | {"name": "Acme Corp", "contacts": [{"name": "John Doe", "emails": [{"email": "john@acme.com"}]}]}]
- Update lead: [CONNECTOR_ACTION: closecrm | update_lead | {"leadId": "xxx", "name": "Updated Name"}]
- List opportunities: [CONNECTOR_ACTION: closecrm | list_opportunities | {"leadId": "xxx"}]
- Create opportunity: [CONNECTOR_ACTION: closecrm | create_opportunity | {"leadId": "xxx", "value": 5000, "note": "Hot lead"}]
- List activities: [CONNECTOR_ACTION: closecrm | list_activities | {"leadId": "xxx"}]
- Log call: [CONNECTOR_ACTION: closecrm | log_call | {"leadId": "xxx", "direction": "outbound", "duration": 300, "note": "Discussed pricing"}]
- Create task: [CONNECTOR_ACTION: closecrm | create_task | {"leadId": "xxx", "text": "Follow up on proposal", "date": "2024-01-15"}]
- Search leads: [CONNECTOR_ACTION: closecrm | search_leads | {"query": "acme"}]

**COPPER CRM ACTIONS** (if connected):
- List people: [CONNECTOR_ACTION: copper | list_people | {"pageSize": 20}]
- Get person: [CONNECTOR_ACTION: copper | get_person | {"personId": "xxx"}]
- Create person: [CONNECTOR_ACTION: copper | create_person | {"name": "John Doe", "emails": [{"email": "john@example.com"}]}]
- Update person: [CONNECTOR_ACTION: copper | update_person | {"personId": "xxx", "phone_numbers": [{"number": "123-456-7890"}]}]
- List companies: [CONNECTOR_ACTION: copper | list_companies | {"pageSize": 20}]
- Get company: [CONNECTOR_ACTION: copper | get_company | {"companyId": "xxx"}]
- Create company: [CONNECTOR_ACTION: copper | create_company | {"name": "Acme Corp"}]
- List opportunities: [CONNECTOR_ACTION: copper | list_opportunities | {"pageSize": 20}]
- Get opportunity: [CONNECTOR_ACTION: copper | get_opportunity | {"opportunityId": "xxx"}]
- Create opportunity: [CONNECTOR_ACTION: copper | create_opportunity | {"name": "New Deal", "monetaryValue": 5000}]
- List tasks: [CONNECTOR_ACTION: copper | list_tasks | {"pageSize": 20}]
- Create task: [CONNECTOR_ACTION: copper | create_task | {"name": "Follow up", "relatedResource": {"id": "xxx", "type": "person"}}]
- Search: [CONNECTOR_ACTION: copper | search | {"query": "john"}]

**ROUTE4ME ROUTE OPTIMIZATION ACTIONS** (if connected):
- Get user: [CONNECTOR_ACTION: route4me | get_user | {}]
- List routes: [CONNECTOR_ACTION: route4me | list_routes | {"limit": 20}]
- Get route: [CONNECTOR_ACTION: route4me | get_route | {"routeId": "xxx"}]
- Optimize route: [CONNECTOR_ACTION: route4me | optimize_route | {"addresses": [{"address": "123 Main St", "lat": 40.7128, "lng": -74.006}]}]
- Add address to route: [CONNECTOR_ACTION: route4me | add_address | {"routeId": "xxx", "address": "456 Oak Ave", "lat": 40.7589, "lng": -73.9851}]
- Delete route: [CONNECTOR_ACTION: route4me | delete_route | {"routeId": "xxx"}]
- List address book: [CONNECTOR_ACTION: route4me | list_address_book | {"limit": 20}]
- Add to address book: [CONNECTOR_ACTION: route4me | add_to_address_book | {"address": "789 Elm St", "firstName": "John"}]
- Get geocoding: [CONNECTOR_ACTION: route4me | geocode | {"address": "123 Main St, New York, NY"}]

**ONFLEET DELIVERY ACTIONS** (if connected):
- Get organization: [CONNECTOR_ACTION: onfleet | get_organization | {}]
- List workers: [CONNECTOR_ACTION: onfleet | list_workers | {}]
- Get worker: [CONNECTOR_ACTION: onfleet | get_worker | {"workerId": "xxx"}]
- Create worker: [CONNECTOR_ACTION: onfleet | create_worker | {"name": "John Driver", "phone": "+1234567890", "teams": ["teamId"]}]
- List teams: [CONNECTOR_ACTION: onfleet | list_teams | {}]
- Get team: [CONNECTOR_ACTION: onfleet | get_team | {"teamId": "xxx"}]
- List tasks: [CONNECTOR_ACTION: onfleet | list_tasks | {"state": 0}]
- Get task: [CONNECTOR_ACTION: onfleet | get_task | {"taskId": "xxx"}]
- Create task: [CONNECTOR_ACTION: onfleet | create_task | {"destination": {"address": {"unparsed": "123 Main St"}}, "recipients": [{"name": "John", "phone": "+1234567890"}]}]
- Update task: [CONNECTOR_ACTION: onfleet | update_task | {"taskId": "xxx", "notes": "Leave at door"}]
- Complete task: [CONNECTOR_ACTION: onfleet | complete_task | {"taskId": "xxx", "success": true}]
- Delete task: [CONNECTOR_ACTION: onfleet | delete_task | {"taskId": "xxx"}]
- List hubs: [CONNECTOR_ACTION: onfleet | list_hubs | {}]

**ACUITY SCHEDULING ACTIONS** (if connected):
- Get me: [CONNECTOR_ACTION: acuity | get_me | {}]
- List appointments: [CONNECTOR_ACTION: acuity | list_appointments | {"minDate": "2024-01-01", "maxDate": "2024-01-31"}]
- Get appointment: [CONNECTOR_ACTION: acuity | get_appointment | {"appointmentId": "xxx"}]
- Create appointment: [CONNECTOR_ACTION: acuity | create_appointment | {"appointmentTypeID": 123, "datetime": "2024-01-15T10:00:00", "firstName": "John", "lastName": "Doe", "email": "john@example.com"}]
- Cancel appointment: [CONNECTOR_ACTION: acuity | cancel_appointment | {"appointmentId": "xxx"}]
- Reschedule appointment: [CONNECTOR_ACTION: acuity | reschedule_appointment | {"appointmentId": "xxx", "datetime": "2024-01-16T10:00:00"}]
- List appointment types: [CONNECTOR_ACTION: acuity | list_appointment_types | {}]
- List calendars: [CONNECTOR_ACTION: acuity | list_calendars | {}]
- Get availability: [CONNECTOR_ACTION: acuity | get_availability | {"appointmentTypeID": 123, "date": "2024-01-15"}]
- List clients: [CONNECTOR_ACTION: acuity | list_clients | {}]

**TYPEFORM FORM ACTIONS** (if connected):
- Get me: [CONNECTOR_ACTION: typeform | get_me | {}]
- List workspaces: [CONNECTOR_ACTION: typeform | list_workspaces | {}]
- List forms: [CONNECTOR_ACTION: typeform | list_forms | {"pageSize": 20}]
- Get form: [CONNECTOR_ACTION: typeform | get_form | {"formId": "xxx"}]
- Get responses: [CONNECTOR_ACTION: typeform | get_responses | {"formId": "xxx", "pageSize": 25}]
- Get response: [CONNECTOR_ACTION: typeform | get_response | {"formId": "xxx", "responseId": "yyy"}]
- Delete response: [CONNECTOR_ACTION: typeform | delete_response | {"formId": "xxx", "responseId": "yyy"}]
- Get insights: [CONNECTOR_ACTION: typeform | get_insights | {"formId": "xxx"}]
- Create webhook: [CONNECTOR_ACTION: typeform | create_webhook | {"formId": "xxx", "url": "https://...", "tag": "responses"}]
- List webhooks: [CONNECTOR_ACTION: typeform | list_webhooks | {"formId": "xxx"}]

**JOTFORM FORM ACTIONS** (if connected):
- Get user: [CONNECTOR_ACTION: jotform | get_user | {}]
- List forms: [CONNECTOR_ACTION: jotform | list_forms | {"limit": 20}]
- Get form: [CONNECTOR_ACTION: jotform | get_form | {"formId": "xxx"}]
- Get form questions: [CONNECTOR_ACTION: jotform | get_form_questions | {"formId": "xxx"}]
- List submissions: [CONNECTOR_ACTION: jotform | list_submissions | {"formId": "xxx", "limit": 20}]
- Get submission: [CONNECTOR_ACTION: jotform | get_submission | {"submissionId": "xxx"}]
- Delete submission: [CONNECTOR_ACTION: jotform | delete_submission | {"submissionId": "xxx"}]
- Get form reports: [CONNECTOR_ACTION: jotform | get_form_reports | {"formId": "xxx"}]
- List folders: [CONNECTOR_ACTION: jotform | list_folders | {}]
- Create form: [CONNECTOR_ACTION: jotform | create_form | {"questions": [{"type": "control_textbox", "text": "Name"}]}]

**CRISP.CHAT MESSAGING ACTIONS** (if connected):
- Get website: [CONNECTOR_ACTION: crisp | get_website | {}]
- List conversations: [CONNECTOR_ACTION: crisp | list_conversations | {"pageNumber": 1}]
- Get conversation: [CONNECTOR_ACTION: crisp | get_conversation | {"sessionId": "xxx"}]
- Send message: [CONNECTOR_ACTION: crisp | send_message | {"sessionId": "xxx", "content": "Hello!", "type": "text"}]
- List messages: [CONNECTOR_ACTION: crisp | list_messages | {"sessionId": "xxx"}]
- Get people profile: [CONNECTOR_ACTION: crisp | get_people | {"sessionId": "xxx"}]
- Update people profile: [CONNECTOR_ACTION: crisp | update_people | {"sessionId": "xxx", "email": "user@example.com"}]
- List contacts: [CONNECTOR_ACTION: crisp | list_contacts | {"pageNumber": 1}]
- Get analytics: [CONNECTOR_ACTION: crisp | get_analytics | {"type": "conversations"}]
- Set availability: [CONNECTOR_ACTION: crisp | set_availability | {"type": "online"}]

**TIDIO CHAT ACTIONS** (if connected):
- List conversations: [CONNECTOR_ACTION: tidio | list_conversations | {"limit": 20}]
- Get conversation: [CONNECTOR_ACTION: tidio | get_conversation | {"conversationId": "xxx"}]
- Send message: [CONNECTOR_ACTION: tidio | send_message | {"conversationId": "xxx", "message": "Hello!"}]
- List contacts: [CONNECTOR_ACTION: tidio | list_contacts | {"limit": 20}]
- Get contact: [CONNECTOR_ACTION: tidio | get_contact | {"contactId": "xxx"}]
- Update contact: [CONNECTOR_ACTION: tidio | update_contact | {"contactId": "xxx", "tags": ["vip"]}]
- Get analytics: [CONNECTOR_ACTION: tidio | get_analytics | {}]

**TODOIST TASK ACTIONS** (if connected):
- List projects: [CONNECTOR_ACTION: todoist | list_projects | {}]
- Get project: [CONNECTOR_ACTION: todoist | get_project | {"projectId": "xxx"}]
- Create project: [CONNECTOR_ACTION: todoist | create_project | {"name": "My Project"}]
- Update project: [CONNECTOR_ACTION: todoist | update_project | {"projectId": "xxx", "name": "Updated Name"}]
- Delete project: [CONNECTOR_ACTION: todoist | delete_project | {"projectId": "xxx"}]
- List tasks: [CONNECTOR_ACTION: todoist | list_tasks | {"projectId": "xxx"}]
- Get task: [CONNECTOR_ACTION: todoist | get_task | {"taskId": "xxx"}]
- Create task: [CONNECTOR_ACTION: todoist | create_task | {"content": "Buy groceries", "projectId": "xxx", "priority": 4}]
- Update task: [CONNECTOR_ACTION: todoist | update_task | {"taskId": "xxx", "content": "Updated task"}]
- Complete task: [CONNECTOR_ACTION: todoist | complete_task | {"taskId": "xxx"}]
- Delete task: [CONNECTOR_ACTION: todoist | delete_task | {"taskId": "xxx"}]
- List labels: [CONNECTOR_ACTION: todoist | list_labels | {}]
- Create label: [CONNECTOR_ACTION: todoist | create_label | {"name": "urgent"}]
- List sections: [CONNECTOR_ACTION: todoist | list_sections | {"projectId": "xxx"}]
- Add comment: [CONNECTOR_ACTION: todoist | add_comment | {"taskId": "xxx", "content": "Note about this task"}]

**CLOCKIFY TIME TRACKING ACTIONS** (if connected):
- Get user: [CONNECTOR_ACTION: clockify | get_user | {}]
- List workspaces: [CONNECTOR_ACTION: clockify | list_workspaces | {}]
- List projects: [CONNECTOR_ACTION: clockify | list_projects | {"workspaceId": "xxx"}]
- Get project: [CONNECTOR_ACTION: clockify | get_project | {"workspaceId": "xxx", "projectId": "yyy"}]
- Create project: [CONNECTOR_ACTION: clockify | create_project | {"workspaceId": "xxx", "name": "New Project"}]
- List time entries: [CONNECTOR_ACTION: clockify | list_time_entries | {"workspaceId": "xxx", "userId": "yyy"}]
- Create time entry: [CONNECTOR_ACTION: clockify | create_time_entry | {"workspaceId": "xxx", "start": "2024-01-15T09:00:00Z", "description": "Working on project"}]
- Stop timer: [CONNECTOR_ACTION: clockify | stop_timer | {"workspaceId": "xxx", "userId": "yyy"}]
- Get current timer: [CONNECTOR_ACTION: clockify | get_current_timer | {"workspaceId": "xxx", "userId": "yyy"}]
- Update time entry: [CONNECTOR_ACTION: clockify | update_time_entry | {"workspaceId": "xxx", "timeEntryId": "yyy", "description": "Updated description"}]
- Delete time entry: [CONNECTOR_ACTION: clockify | delete_time_entry | {"workspaceId": "xxx", "timeEntryId": "yyy"}]
- List clients: [CONNECTOR_ACTION: clockify | list_clients | {"workspaceId": "xxx"}]
- List tags: [CONNECTOR_ACTION: clockify | list_tags | {"workspaceId": "xxx"}]
- Get reports: [CONNECTOR_ACTION: clockify | get_reports | {"workspaceId": "xxx", "startDate": "2024-01-01", "endDate": "2024-01-31"}]

**HARVEST TIME TRACKING ACTIONS** (if connected):
- Get me: [CONNECTOR_ACTION: harvest | get_me | {}]
- List time entries: [CONNECTOR_ACTION: harvest | list_time_entries | {"from": "2024-01-01", "to": "2024-01-31"}]
- Get time entry: [CONNECTOR_ACTION: harvest | get_time_entry | {"timeEntryId": "xxx"}]
- Create time entry: [CONNECTOR_ACTION: harvest | create_time_entry | {"projectId": "xxx", "taskId": "yyy", "spentDate": "2024-01-15", "hours": 2.5}]
- Update time entry: [CONNECTOR_ACTION: harvest | update_time_entry | {"timeEntryId": "xxx", "notes": "Updated notes"}]
- Delete time entry: [CONNECTOR_ACTION: harvest | delete_time_entry | {"timeEntryId": "xxx"}]
- Start timer: [CONNECTOR_ACTION: harvest | start_timer | {"projectId": "xxx", "taskId": "yyy"}]
- Stop timer: [CONNECTOR_ACTION: harvest | stop_timer | {"timeEntryId": "xxx"}]
- List projects: [CONNECTOR_ACTION: harvest | list_projects | {}]
- Get project: [CONNECTOR_ACTION: harvest | get_project | {"projectId": "xxx"}]
- List tasks: [CONNECTOR_ACTION: harvest | list_tasks | {"projectId": "xxx"}]
- List clients: [CONNECTOR_ACTION: harvest | list_clients | {}]
- List invoices: [CONNECTOR_ACTION: harvest | list_invoices | {}]
- Create invoice: [CONNECTOR_ACTION: harvest | create_invoice | {"clientId": "xxx", "subject": "Invoice for January"}]
- Get reports: [CONNECTOR_ACTION: harvest | get_reports | {"from": "2024-01-01", "to": "2024-01-31"}]

**TEACHABLE COURSE ACTIONS** (if connected):
- List courses: [CONNECTOR_ACTION: teachable | list_courses | {}]
- Get course: [CONNECTOR_ACTION: teachable | get_course | {"courseId": "xxx"}]
- List students: [CONNECTOR_ACTION: teachable | list_students | {"courseId": "xxx"}]
- Get student: [CONNECTOR_ACTION: teachable | get_student | {"userId": "xxx"}]
- Enroll student: [CONNECTOR_ACTION: teachable | enroll_student | {"courseId": "xxx", "email": "student@example.com"}]
- Unenroll student: [CONNECTOR_ACTION: teachable | unenroll_student | {"courseId": "xxx", "userId": "yyy"}]
- List lectures: [CONNECTOR_ACTION: teachable | list_lectures | {"courseId": "xxx"}]
- Get course progress: [CONNECTOR_ACTION: teachable | get_progress | {"courseId": "xxx", "userId": "yyy"}]
- List coupons: [CONNECTOR_ACTION: teachable | list_coupons | {}]
- Create coupon: [CONNECTOR_ACTION: teachable | create_coupon | {"code": "SAVE20", "discountPercent": 20}]
- Get sales report: [CONNECTOR_ACTION: teachable | get_sales | {"startDate": "2024-01-01", "endDate": "2024-01-31"}]

ALWAYS use this format when the user asks about their connected services. The user will click the "Run Action" button to execute and see results.
`;
}
