/**
 * JIRA ACTION EXECUTION API
 * Execute Jira REST API actions after user confirmation
 * POST: Execute a specific Jira action
 *
 * Token format: site_domain|email|api_token
 * Example: yoursite.atlassian.net|user@example.com|ATATT3xFfGF0xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

// Parse token to get site domain, email, and API token
function parseToken(token: string): { siteDomain: string; email: string; apiToken: string } | null {
  const parts = token.split('|');
  if (parts.length !== 3) return null;

  let [siteDomain, email, apiToken] = parts;
  siteDomain = siteDomain.trim();
  email = email.trim();
  apiToken = apiToken.trim();

  // Ensure site domain has correct format
  if (!siteDomain.includes('.atlassian.net')) {
    siteDomain = `${siteDomain}.atlassian.net`;
  }

  return { siteDomain, email, apiToken };
}

// Helper for Jira API requests
async function jiraFetch(
  siteDomain: string,
  email: string,
  apiToken: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
  const url = `https://${siteDomain}/rest/api/3${endpoint}`;

  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options.headers,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get user's Jira connection
    const connection = await getUserConnection(user.id, 'jira');
    if (!connection) {
      return NextResponse.json({ error: 'Jira not connected' }, { status: 400 });
    }

    const parsed = parseToken(connection.token);
    if (!parsed) {
      return NextResponse.json(
        { error: 'Invalid Jira credentials. Expected format: site|email|api_token' },
        { status: 400 }
      );
    }

    const { siteDomain, email, apiToken } = parsed;
    const body: ExecuteRequest = await request.json();
    const { action, params } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    let result: unknown;

    switch (action) {
      case 'get_myself': {
        const response = await jiraFetch(siteDomain, email, apiToken, '/myself');

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.errorMessages?.[0] || 'Failed to get user info' },
            { status: response.status }
          );
        }

        const user = await response.json();
        result = {
          accountId: user.accountId,
          displayName: user.displayName,
          emailAddress: user.emailAddress,
          avatarUrl: user.avatarUrls?.['48x48'],
          active: user.active,
          timeZone: user.timeZone,
        };
        break;
      }

      case 'list_projects': {
        const { maxResults = 50 } = params as { maxResults?: number };

        const response = await jiraFetch(
          siteDomain, email, apiToken,
          `/project/search?maxResults=${maxResults}`
        );

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.errorMessages?.[0] || 'Failed to list projects' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          projects: data.values?.map((p: {
            id: string;
            key: string;
            name: string;
            projectTypeKey: string;
            style: string;
            avatarUrls: Record<string, string>;
          }) => ({
            id: p.id,
            key: p.key,
            name: p.name,
            projectType: p.projectTypeKey,
            style: p.style,
            avatarUrl: p.avatarUrls?.['48x48'],
          })) || [],
          count: data.values?.length || 0,
          total: data.total,
        };
        break;
      }

      case 'get_project': {
        const { projectKey } = params as { projectKey: string };
        if (!projectKey) {
          return NextResponse.json({ error: 'projectKey is required' }, { status: 400 });
        }

        const response = await jiraFetch(siteDomain, email, apiToken, `/project/${projectKey}`);

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.errorMessages?.[0] || 'Failed to get project' },
            { status: response.status }
          );
        }

        const p = await response.json();
        result = {
          id: p.id,
          key: p.key,
          name: p.name,
          description: p.description,
          projectType: p.projectTypeKey,
          lead: p.lead ? { displayName: p.lead.displayName, accountId: p.lead.accountId } : null,
          url: p.self,
        };
        break;
      }

      case 'search_issues':
      case 'list_issues': {
        const { jql, projectKey, status, assignee, maxResults = 20, fields } = params as {
          jql?: string;
          projectKey?: string;
          status?: string;
          assignee?: string;
          maxResults?: number;
          fields?: string[];
        };

        // Build JQL if not provided
        let query = jql || '';
        if (!query) {
          const conditions: string[] = [];
          if (projectKey) conditions.push(`project = "${projectKey}"`);
          if (status) conditions.push(`status = "${status}"`);
          if (assignee) conditions.push(`assignee = "${assignee}"`);
          query = conditions.length > 0 ? conditions.join(' AND ') : 'ORDER BY created DESC';
        }

        const defaultFields = ['summary', 'status', 'assignee', 'priority', 'created', 'updated', 'issuetype'];
        const requestFields = fields || defaultFields;

        const searchParams = new URLSearchParams({
          jql: query,
          maxResults: String(maxResults),
          fields: requestFields.join(','),
        });

        const response = await jiraFetch(
          siteDomain, email, apiToken,
          `/search?${searchParams.toString()}`
        );

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.errorMessages?.[0] || 'Failed to search issues' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          issues: data.issues?.map((issue: {
            id: string;
            key: string;
            self: string;
            fields: {
              summary: string;
              status: { name: string; statusCategory: { key: string } };
              assignee: { displayName: string; accountId: string } | null;
              priority: { name: string } | null;
              issuetype: { name: string };
              created: string;
              updated: string;
            };
          }) => ({
            id: issue.id,
            key: issue.key,
            summary: issue.fields.summary,
            status: issue.fields.status?.name,
            statusCategory: issue.fields.status?.statusCategory?.key,
            assignee: issue.fields.assignee?.displayName || 'Unassigned',
            priority: issue.fields.priority?.name,
            issueType: issue.fields.issuetype?.name,
            created: issue.fields.created,
            updated: issue.fields.updated,
            url: `https://${siteDomain}/browse/${issue.key}`,
          })) || [],
          count: data.issues?.length || 0,
          total: data.total,
        };
        break;
      }

      case 'get_issue': {
        const { issueKey, fields } = params as { issueKey: string; fields?: string[] };
        if (!issueKey) {
          return NextResponse.json({ error: 'issueKey is required' }, { status: 400 });
        }

        const defaultFields = ['summary', 'description', 'status', 'assignee', 'reporter', 'priority', 'created', 'updated', 'issuetype', 'labels', 'comment'];
        const requestFields = fields || defaultFields;

        const response = await jiraFetch(
          siteDomain, email, apiToken,
          `/issue/${issueKey}?fields=${requestFields.join(',')}`
        );

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.errorMessages?.[0] || 'Failed to get issue' },
            { status: response.status }
          );
        }

        const issue = await response.json();
        const f = issue.fields;
        result = {
          id: issue.id,
          key: issue.key,
          summary: f.summary,
          description: f.description?.content?.[0]?.content?.[0]?.text || f.description || null,
          status: f.status?.name,
          statusCategory: f.status?.statusCategory?.key,
          assignee: f.assignee ? { displayName: f.assignee.displayName, accountId: f.assignee.accountId } : null,
          reporter: f.reporter ? { displayName: f.reporter.displayName, accountId: f.reporter.accountId } : null,
          priority: f.priority?.name,
          issueType: f.issuetype?.name,
          labels: f.labels || [],
          created: f.created,
          updated: f.updated,
          comments: f.comment?.comments?.map((c: {
            id: string;
            body: { content?: Array<{ content?: Array<{ text: string }> }> } | string;
            author: { displayName: string };
            created: string;
          }) => ({
            id: c.id,
            body: typeof c.body === 'string' ? c.body : c.body?.content?.[0]?.content?.[0]?.text || '',
            author: c.author?.displayName,
            created: c.created,
          })).slice(0, 10) || [],
          url: `https://${siteDomain}/browse/${issue.key}`,
        };
        break;
      }

      case 'create_issue': {
        const { projectKey, summary, description, issueType = 'Task', priority, assigneeId, labels } = params as {
          projectKey: string;
          summary: string;
          description?: string;
          issueType?: string;
          priority?: string;
          assigneeId?: string;
          labels?: string[];
        };

        if (!projectKey || !summary) {
          return NextResponse.json({ error: 'projectKey and summary are required' }, { status: 400 });
        }

        const issueData: Record<string, unknown> = {
          fields: {
            project: { key: projectKey },
            summary,
            issuetype: { name: issueType },
          },
        };

        if (description) {
          issueData.fields = {
            ...issueData.fields as object,
            description: {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: description }],
                },
              ],
            },
          };
        }

        if (priority) {
          issueData.fields = { ...issueData.fields as object, priority: { name: priority } };
        }

        if (assigneeId) {
          issueData.fields = { ...issueData.fields as object, assignee: { accountId: assigneeId } };
        }

        if (labels?.length) {
          issueData.fields = { ...issueData.fields as object, labels };
        }

        const response = await jiraFetch(siteDomain, email, apiToken, '/issue', {
          method: 'POST',
          body: JSON.stringify(issueData),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.errorMessages?.[0] || error.errors ? JSON.stringify(error.errors) : 'Failed to create issue' },
            { status: response.status }
          );
        }

        const created = await response.json();
        result = {
          id: created.id,
          key: created.key,
          url: `https://${siteDomain}/browse/${created.key}`,
          message: `Issue ${created.key} created successfully!`,
        };
        break;
      }

      case 'update_issue': {
        const { issueKey, summary, description, priority, assigneeId, labels } = params as {
          issueKey: string;
          summary?: string;
          description?: string;
          priority?: string;
          assigneeId?: string;
          labels?: string[];
        };

        if (!issueKey) {
          return NextResponse.json({ error: 'issueKey is required' }, { status: 400 });
        }

        const updateData: Record<string, unknown> = { fields: {} };

        if (summary) {
          updateData.fields = { ...updateData.fields as object, summary };
        }

        if (description) {
          updateData.fields = {
            ...updateData.fields as object,
            description: {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: description }],
                },
              ],
            },
          };
        }

        if (priority) {
          updateData.fields = { ...updateData.fields as object, priority: { name: priority } };
        }

        if (assigneeId !== undefined) {
          updateData.fields = { ...updateData.fields as object, assignee: assigneeId ? { accountId: assigneeId } : null };
        }

        if (labels) {
          updateData.fields = { ...updateData.fields as object, labels };
        }

        const response = await jiraFetch(siteDomain, email, apiToken, `/issue/${issueKey}`, {
          method: 'PUT',
          body: JSON.stringify(updateData),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.errorMessages?.[0] || 'Failed to update issue' },
            { status: response.status }
          );
        }

        result = {
          key: issueKey,
          url: `https://${siteDomain}/browse/${issueKey}`,
          message: 'Issue updated successfully!',
        };
        break;
      }

      case 'transition_issue': {
        const { issueKey, transitionId, transitionName } = params as {
          issueKey: string;
          transitionId?: string;
          transitionName?: string;
        };

        if (!issueKey) {
          return NextResponse.json({ error: 'issueKey is required' }, { status: 400 });
        }

        // First, get available transitions
        const transitionsResponse = await jiraFetch(
          siteDomain, email, apiToken,
          `/issue/${issueKey}/transitions`
        );

        if (!transitionsResponse.ok) {
          const error = await transitionsResponse.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.errorMessages?.[0] || 'Failed to get transitions' },
            { status: transitionsResponse.status }
          );
        }

        const transitionsData = await transitionsResponse.json();
        const targetTransition = transitionsData.transitions?.find((t: { id: string; name: string }) =>
          t.id === transitionId || t.name.toLowerCase() === transitionName?.toLowerCase()
        );

        if (!targetTransition && !transitionId && !transitionName) {
          // If no transition specified, return available transitions
          result = {
            availableTransitions: transitionsData.transitions?.map((t: { id: string; name: string; to: { name: string } }) => ({
              id: t.id,
              name: t.name,
              to: t.to?.name,
            })) || [],
            message: 'Specify transitionId or transitionName to transition the issue.',
          };
          break;
        }

        if (!targetTransition) {
          return NextResponse.json(
            { error: 'Transition not found. Use list_transitions to see available options.' },
            { status: 400 }
          );
        }

        const response = await jiraFetch(siteDomain, email, apiToken, `/issue/${issueKey}/transitions`, {
          method: 'POST',
          body: JSON.stringify({ transition: { id: targetTransition.id } }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.errorMessages?.[0] || 'Failed to transition issue' },
            { status: response.status }
          );
        }

        result = {
          key: issueKey,
          newStatus: targetTransition.to?.name || targetTransition.name,
          message: `Issue transitioned to ${targetTransition.to?.name || targetTransition.name} successfully!`,
        };
        break;
      }

      case 'add_comment': {
        const { issueKey, body: commentBody } = params as { issueKey: string; body: string };

        if (!issueKey || !commentBody) {
          return NextResponse.json({ error: 'issueKey and body are required' }, { status: 400 });
        }

        const response = await jiraFetch(siteDomain, email, apiToken, `/issue/${issueKey}/comment`, {
          method: 'POST',
          body: JSON.stringify({
            body: {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: commentBody }],
                },
              ],
            },
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.errorMessages?.[0] || 'Failed to add comment' },
            { status: response.status }
          );
        }

        const comment = await response.json();
        result = {
          id: comment.id,
          created: comment.created,
          message: 'Comment added successfully!',
        };
        break;
      }

      case 'list_sprints': {
        const { boardId, state } = params as { boardId: string | number; state?: 'active' | 'future' | 'closed' };

        if (!boardId) {
          return NextResponse.json({ error: 'boardId is required' }, { status: 400 });
        }

        let endpoint = `/board/${boardId}/sprint?maxResults=50`;
        if (state) endpoint += `&state=${state}`;

        // Sprints use Agile API
        const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
        const response = await fetch(`https://${siteDomain}/rest/agile/1.0${endpoint}`, {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.errorMessages?.[0] || 'Failed to list sprints' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          sprints: data.values?.map((s: {
            id: number;
            name: string;
            state: string;
            startDate: string;
            endDate: string;
            completeDate: string;
            goal: string;
          }) => ({
            id: s.id,
            name: s.name,
            state: s.state,
            startDate: s.startDate,
            endDate: s.endDate,
            completeDate: s.completeDate,
            goal: s.goal,
          })) || [],
          count: data.values?.length || 0,
        };
        break;
      }

      case 'list_boards': {
        const { projectKey, maxResults = 50 } = params as { projectKey?: string; maxResults?: number };

        let endpoint = `/board?maxResults=${maxResults}`;
        if (projectKey) endpoint += `&projectKeyOrId=${projectKey}`;

        // Boards use Agile API
        const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
        const response = await fetch(`https://${siteDomain}/rest/agile/1.0${endpoint}`, {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.errorMessages?.[0] || 'Failed to list boards' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          boards: data.values?.map((b: {
            id: number;
            name: string;
            type: string;
            location: { projectKey: string; projectName: string };
          }) => ({
            id: b.id,
            name: b.name,
            type: b.type,
            projectKey: b.location?.projectKey,
            projectName: b.location?.projectName,
          })) || [],
          count: data.values?.length || 0,
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[Jira Execute API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
