/**
 * LINEAR ACTION EXECUTION API
 * Execute Linear GraphQL API actions after user confirmation
 * POST: Execute a specific Linear action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const LINEAR_API = 'https://api.linear.app/graphql';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

// Helper for Linear GraphQL requests
async function linearQuery(
  apiKey: string,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<{ data?: unknown; errors?: Array<{ message: string }> }> {
  const response = await fetch(LINEAR_API, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get user's Linear connection
    const connection = await getUserConnection(user.id, 'linear');
    if (!connection) {
      return NextResponse.json({ error: 'Linear not connected' }, { status: 400 });
    }

    const body: ExecuteRequest = await request.json();
    const { action, params } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const apiKey = connection.token;
    let result: unknown;

    switch (action) {
      case 'get_viewer': {
        const response = await linearQuery(apiKey, `
          query {
            viewer {
              id
              name
              email
              displayName
              avatarUrl
              admin
              active
              organization {
                id
                name
                urlKey
              }
            }
          }
        `);

        if (response.errors) {
          return NextResponse.json(
            { error: response.errors[0]?.message || 'Failed to get user info' },
            { status: 400 }
          );
        }

        const viewer = (response.data as { viewer: Record<string, unknown> })?.viewer;
        result = {
          id: viewer?.id,
          name: viewer?.name,
          email: viewer?.email,
          displayName: viewer?.displayName,
          avatarUrl: viewer?.avatarUrl,
          admin: viewer?.admin,
          active: viewer?.active,
          organization: viewer?.organization,
        };
        break;
      }

      case 'list_teams': {
        const response = await linearQuery(apiKey, `
          query {
            teams {
              nodes {
                id
                name
                key
                description
                private
                issueCount
                createdAt
              }
            }
          }
        `);

        if (response.errors) {
          return NextResponse.json(
            { error: response.errors[0]?.message || 'Failed to list teams' },
            { status: 400 }
          );
        }

        const teams = (response.data as { teams: { nodes: Array<Record<string, unknown>> } })?.teams?.nodes || [];
        result = {
          teams: teams.map(t => ({
            id: t.id,
            name: t.name,
            key: t.key,
            description: t.description,
            private: t.private,
            issueCount: t.issueCount,
            createdAt: t.createdAt,
          })),
          count: teams.length,
        };
        break;
      }

      case 'list_issues': {
        const { teamId, status, assigneeId, first = 20 } = params as {
          teamId?: string;
          status?: string;
          assigneeId?: string;
          first?: number;
        };

        let filter = '';
        const filters: string[] = [];
        if (teamId) filters.push(`team: { id: { eq: "${teamId}" } }`);
        if (status) filters.push(`state: { name: { eq: "${status}" } }`);
        if (assigneeId) filters.push(`assignee: { id: { eq: "${assigneeId}" } }`);
        if (filters.length > 0) filter = `filter: { ${filters.join(', ')} }`;

        const response = await linearQuery(apiKey, `
          query($first: Int!) {
            issues(first: $first, ${filter}) {
              nodes {
                id
                identifier
                title
                description
                priority
                priorityLabel
                state {
                  id
                  name
                  color
                  type
                }
                assignee {
                  id
                  name
                  email
                }
                team {
                  id
                  name
                  key
                }
                labels {
                  nodes {
                    id
                    name
                    color
                  }
                }
                createdAt
                updatedAt
                dueDate
                estimate
                url
              }
            }
          }
        `, { first });

        if (response.errors) {
          return NextResponse.json(
            { error: response.errors[0]?.message || 'Failed to list issues' },
            { status: 400 }
          );
        }

        const issues = (response.data as { issues: { nodes: Array<Record<string, unknown>> } })?.issues?.nodes || [];
        result = {
          issues: issues.map(i => ({
            id: i.id,
            identifier: i.identifier,
            title: i.title,
            description: i.description ? String(i.description).slice(0, 200) + (String(i.description).length > 200 ? '...' : '') : null,
            priority: i.priority,
            priorityLabel: i.priorityLabel,
            state: i.state,
            assignee: i.assignee,
            team: i.team,
            labels: (i.labels as { nodes: Array<Record<string, unknown>> })?.nodes || [],
            createdAt: i.createdAt,
            updatedAt: i.updatedAt,
            dueDate: i.dueDate,
            estimate: i.estimate,
            url: i.url,
          })),
          count: issues.length,
        };
        break;
      }

      case 'get_issue': {
        const { issueId } = params as { issueId: string };
        if (!issueId) {
          return NextResponse.json({ error: 'issueId is required' }, { status: 400 });
        }

        const response = await linearQuery(apiKey, `
          query($id: String!) {
            issue(id: $id) {
              id
              identifier
              title
              description
              priority
              priorityLabel
              state {
                id
                name
                color
                type
              }
              assignee {
                id
                name
                email
              }
              team {
                id
                name
                key
              }
              project {
                id
                name
              }
              labels {
                nodes {
                  id
                  name
                  color
                }
              }
              comments {
                nodes {
                  id
                  body
                  createdAt
                  user {
                    name
                  }
                }
              }
              createdAt
              updatedAt
              dueDate
              estimate
              url
            }
          }
        `, { id: issueId });

        if (response.errors) {
          return NextResponse.json(
            { error: response.errors[0]?.message || 'Failed to get issue' },
            { status: 400 }
          );
        }

        const issue = (response.data as { issue: Record<string, unknown> })?.issue;
        result = {
          id: issue?.id,
          identifier: issue?.identifier,
          title: issue?.title,
          description: issue?.description,
          priority: issue?.priority,
          priorityLabel: issue?.priorityLabel,
          state: issue?.state,
          assignee: issue?.assignee,
          team: issue?.team,
          project: issue?.project,
          labels: (issue?.labels as { nodes: Array<Record<string, unknown>> })?.nodes || [],
          comments: (issue?.comments as { nodes: Array<Record<string, unknown>> })?.nodes || [],
          createdAt: issue?.createdAt,
          updatedAt: issue?.updatedAt,
          dueDate: issue?.dueDate,
          estimate: issue?.estimate,
          url: issue?.url,
        };
        break;
      }

      case 'create_issue': {
        const { teamId, title, description, priority, assigneeId, stateId, labelIds } = params as {
          teamId: string;
          title: string;
          description?: string;
          priority?: number;
          assigneeId?: string;
          stateId?: string;
          labelIds?: string[];
        };

        if (!teamId || !title) {
          return NextResponse.json({ error: 'teamId and title are required' }, { status: 400 });
        }

        const input: Record<string, unknown> = { teamId, title };
        if (description) input.description = description;
        if (priority !== undefined) input.priority = priority;
        if (assigneeId) input.assigneeId = assigneeId;
        if (stateId) input.stateId = stateId;
        if (labelIds?.length) input.labelIds = labelIds;

        const response = await linearQuery(apiKey, `
          mutation($input: IssueCreateInput!) {
            issueCreate(input: $input) {
              success
              issue {
                id
                identifier
                title
                url
                state {
                  name
                }
                team {
                  key
                }
              }
            }
          }
        `, { input });

        if (response.errors) {
          return NextResponse.json(
            { error: response.errors[0]?.message || 'Failed to create issue' },
            { status: 400 }
          );
        }

        const createResult = (response.data as { issueCreate: { success: boolean; issue: Record<string, unknown> } })?.issueCreate;
        if (!createResult?.success) {
          return NextResponse.json({ error: 'Failed to create issue' }, { status: 400 });
        }

        result = {
          success: true,
          issue: createResult.issue,
          message: `Issue ${createResult.issue?.identifier} created successfully!`,
        };
        break;
      }

      case 'update_issue': {
        const { issueId, title, description, priority, assigneeId, stateId } = params as {
          issueId: string;
          title?: string;
          description?: string;
          priority?: number;
          assigneeId?: string;
          stateId?: string;
        };

        if (!issueId) {
          return NextResponse.json({ error: 'issueId is required' }, { status: 400 });
        }

        const input: Record<string, unknown> = {};
        if (title) input.title = title;
        if (description !== undefined) input.description = description;
        if (priority !== undefined) input.priority = priority;
        if (assigneeId) input.assigneeId = assigneeId;
        if (stateId) input.stateId = stateId;

        const response = await linearQuery(apiKey, `
          mutation($id: String!, $input: IssueUpdateInput!) {
            issueUpdate(id: $id, input: $input) {
              success
              issue {
                id
                identifier
                title
                url
                state {
                  name
                }
              }
            }
          }
        `, { id: issueId, input });

        if (response.errors) {
          return NextResponse.json(
            { error: response.errors[0]?.message || 'Failed to update issue' },
            { status: 400 }
          );
        }

        const updateResult = (response.data as { issueUpdate: { success: boolean; issue: Record<string, unknown> } })?.issueUpdate;
        result = {
          success: updateResult?.success,
          issue: updateResult?.issue,
          message: 'Issue updated successfully!',
        };
        break;
      }

      case 'add_comment': {
        const { issueId, body } = params as { issueId: string; body: string };

        if (!issueId || !body) {
          return NextResponse.json({ error: 'issueId and body are required' }, { status: 400 });
        }

        const response = await linearQuery(apiKey, `
          mutation($input: CommentCreateInput!) {
            commentCreate(input: $input) {
              success
              comment {
                id
                body
                createdAt
              }
            }
          }
        `, { input: { issueId, body } });

        if (response.errors) {
          return NextResponse.json(
            { error: response.errors[0]?.message || 'Failed to add comment' },
            { status: 400 }
          );
        }

        const commentResult = (response.data as { commentCreate: { success: boolean; comment: Record<string, unknown> } })?.commentCreate;
        result = {
          success: commentResult?.success,
          comment: commentResult?.comment,
          message: 'Comment added successfully!',
        };
        break;
      }

      case 'list_projects': {
        const { teamId, first = 20 } = params as { teamId?: string; first?: number };

        let filter = '';
        if (teamId) filter = `filter: { accessibleTeams: { id: { eq: "${teamId}" } } }`;

        const response = await linearQuery(apiKey, `
          query($first: Int!) {
            projects(first: $first, ${filter}) {
              nodes {
                id
                name
                description
                state
                progress
                targetDate
                startDate
                createdAt
                updatedAt
                url
                teams {
                  nodes {
                    id
                    name
                    key
                  }
                }
              }
            }
          }
        `, { first });

        if (response.errors) {
          return NextResponse.json(
            { error: response.errors[0]?.message || 'Failed to list projects' },
            { status: 400 }
          );
        }

        const projects = (response.data as { projects: { nodes: Array<Record<string, unknown>> } })?.projects?.nodes || [];
        result = {
          projects: projects.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            state: p.state,
            progress: p.progress,
            targetDate: p.targetDate,
            startDate: p.startDate,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            url: p.url,
            teams: (p.teams as { nodes: Array<Record<string, unknown>> })?.nodes || [],
          })),
          count: projects.length,
        };
        break;
      }

      case 'list_workflow_states': {
        const { teamId } = params as { teamId: string };

        if (!teamId) {
          return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
        }

        const response = await linearQuery(apiKey, `
          query($teamId: String!) {
            team(id: $teamId) {
              states {
                nodes {
                  id
                  name
                  color
                  type
                  position
                }
              }
            }
          }
        `, { teamId });

        if (response.errors) {
          return NextResponse.json(
            { error: response.errors[0]?.message || 'Failed to list workflow states' },
            { status: 400 }
          );
        }

        const states = (response.data as { team: { states: { nodes: Array<Record<string, unknown>> } } })?.team?.states?.nodes || [];
        result = {
          states: states.map(s => ({
            id: s.id,
            name: s.name,
            color: s.color,
            type: s.type,
            position: s.position,
          })),
          count: states.length,
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[Linear Execute API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
