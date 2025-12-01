/**
 * SLACK ACTION EXECUTION API
 * Execute Slack Web API actions after user confirmation
 * POST: Execute a specific Slack action
 *
 * Token format: Bot token (xoxb-xxx) or User token (xoxp-xxx)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const SLACK_API = 'https://slack.com/api';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

// Helper for Slack API requests
async function slackFetch(
  token: string,
  method: string,
  body?: Record<string, unknown>
): Promise<{ ok: boolean; error?: string; [key: string]: unknown }> {
  const url = `${SLACK_API}/${method}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return response.json();
}

// Format Unix timestamp to ISO string
function formatTimestamp(ts: string | number): string {
  const timestamp = typeof ts === 'string' ? parseFloat(ts) : ts;
  return new Date(timestamp * 1000).toISOString();
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get user's Slack connection
    const connection = await getUserConnection(user.id, 'slack');
    if (!connection) {
      return NextResponse.json({ error: 'Slack not connected' }, { status: 400 });
    }

    const body: ExecuteRequest = await request.json();
    const { action, params } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const token = connection.token;
    let result: unknown;

    switch (action) {
      case 'auth_test':
      case 'get_workspace': {
        const response = await slackFetch(token, 'auth.test');

        if (!response.ok) {
          return NextResponse.json(
            { error: response.error || 'Failed to authenticate' },
            { status: 400 }
          );
        }

        result = {
          userId: response.user_id,
          user: response.user,
          teamId: response.team_id,
          team: response.team,
          url: response.url,
          botId: response.bot_id,
        };
        break;
      }

      case 'list_channels': {
        const { types = 'public_channel,private_channel', limit = 100, excludeArchived = true } = params as {
          types?: string;
          limit?: number;
          excludeArchived?: boolean;
        };

        const response = await slackFetch(token, 'conversations.list', {
          types,
          limit,
          exclude_archived: excludeArchived,
        });

        if (!response.ok) {
          return NextResponse.json(
            { error: response.error || 'Failed to list channels' },
            { status: 400 }
          );
        }

        const channels = response.channels as Array<{
          id: string;
          name: string;
          is_private: boolean;
          is_archived: boolean;
          is_member: boolean;
          num_members: number;
          topic: { value: string };
          purpose: { value: string };
          created: number;
        }>;

        result = {
          channels: channels?.map(c => ({
            id: c.id,
            name: c.name,
            isPrivate: c.is_private,
            isArchived: c.is_archived,
            isMember: c.is_member,
            numMembers: c.num_members,
            topic: c.topic?.value || null,
            purpose: c.purpose?.value || null,
            created: formatTimestamp(c.created),
          })) || [],
          count: channels?.length || 0,
        };
        break;
      }

      case 'get_channel': {
        const { channelId } = params as { channelId: string };
        if (!channelId) {
          return NextResponse.json({ error: 'channelId is required' }, { status: 400 });
        }

        const response = await slackFetch(token, 'conversations.info', { channel: channelId });

        if (!response.ok) {
          return NextResponse.json(
            { error: response.error || 'Failed to get channel' },
            { status: 400 }
          );
        }

        const channel = response.channel as {
          id: string;
          name: string;
          is_private: boolean;
          is_archived: boolean;
          is_member: boolean;
          num_members: number;
          topic: { value: string; creator: string };
          purpose: { value: string; creator: string };
          created: number;
          creator: string;
        };

        result = {
          id: channel.id,
          name: channel.name,
          isPrivate: channel.is_private,
          isArchived: channel.is_archived,
          isMember: channel.is_member,
          numMembers: channel.num_members,
          topic: channel.topic?.value || null,
          purpose: channel.purpose?.value || null,
          created: formatTimestamp(channel.created),
          creator: channel.creator,
        };
        break;
      }

      case 'list_messages':
      case 'get_history': {
        const { channelId, limit = 20, oldest, latest } = params as {
          channelId: string;
          limit?: number;
          oldest?: string;
          latest?: string;
        };

        if (!channelId) {
          return NextResponse.json({ error: 'channelId is required' }, { status: 400 });
        }

        const requestParams: Record<string, unknown> = { channel: channelId, limit };
        if (oldest) requestParams.oldest = oldest;
        if (latest) requestParams.latest = latest;

        const response = await slackFetch(token, 'conversations.history', requestParams);

        if (!response.ok) {
          return NextResponse.json(
            { error: response.error || 'Failed to get messages' },
            { status: 400 }
          );
        }

        const messages = response.messages as Array<{
          type: string;
          user: string;
          text: string;
          ts: string;
          thread_ts?: string;
          reply_count?: number;
        }>;

        result = {
          messages: messages?.map(m => ({
            type: m.type,
            user: m.user,
            text: m.text,
            timestamp: formatTimestamp(m.ts),
            ts: m.ts,
            threadTs: m.thread_ts,
            replyCount: m.reply_count || 0,
          })) || [],
          count: messages?.length || 0,
          hasMore: response.has_more,
        };
        break;
      }

      case 'send_message':
      case 'post_message': {
        const { channelId, text, threadTs, unfurlLinks = true } = params as {
          channelId: string;
          text: string;
          threadTs?: string;
          unfurlLinks?: boolean;
        };

        if (!channelId || !text) {
          return NextResponse.json({ error: 'channelId and text are required' }, { status: 400 });
        }

        const requestParams: Record<string, unknown> = {
          channel: channelId,
          text,
          unfurl_links: unfurlLinks,
        };
        if (threadTs) requestParams.thread_ts = threadTs;

        const response = await slackFetch(token, 'chat.postMessage', requestParams);

        if (!response.ok) {
          return NextResponse.json(
            { error: response.error || 'Failed to send message' },
            { status: 400 }
          );
        }

        result = {
          channelId: response.channel,
          ts: response.ts,
          message: response.message,
          success: true,
          messageText: 'Message sent successfully!',
        };
        break;
      }

      case 'update_message': {
        const { channelId, ts, text } = params as {
          channelId: string;
          ts: string;
          text: string;
        };

        if (!channelId || !ts || !text) {
          return NextResponse.json({ error: 'channelId, ts, and text are required' }, { status: 400 });
        }

        const response = await slackFetch(token, 'chat.update', {
          channel: channelId,
          ts,
          text,
        });

        if (!response.ok) {
          return NextResponse.json(
            { error: response.error || 'Failed to update message' },
            { status: 400 }
          );
        }

        result = {
          channelId: response.channel,
          ts: response.ts,
          text: response.text,
          message: 'Message updated successfully!',
        };
        break;
      }

      case 'delete_message': {
        const { channelId, ts } = params as { channelId: string; ts: string };

        if (!channelId || !ts) {
          return NextResponse.json({ error: 'channelId and ts are required' }, { status: 400 });
        }

        const response = await slackFetch(token, 'chat.delete', {
          channel: channelId,
          ts,
        });

        if (!response.ok) {
          return NextResponse.json(
            { error: response.error || 'Failed to delete message' },
            { status: 400 }
          );
        }

        result = {
          channelId: response.channel,
          ts: response.ts,
          message: 'Message deleted successfully!',
        };
        break;
      }

      case 'add_reaction': {
        const { channelId, ts, name } = params as { channelId: string; ts: string; name: string };

        if (!channelId || !ts || !name) {
          return NextResponse.json({ error: 'channelId, ts, and name (emoji) are required' }, { status: 400 });
        }

        const response = await slackFetch(token, 'reactions.add', {
          channel: channelId,
          timestamp: ts,
          name: name.replace(/:/g, ''), // Remove colons if provided
        });

        if (!response.ok) {
          return NextResponse.json(
            { error: response.error || 'Failed to add reaction' },
            { status: 400 }
          );
        }

        result = {
          message: `Reaction :${name.replace(/:/g, '')}: added successfully!`,
        };
        break;
      }

      case 'list_users': {
        const { limit = 100 } = params as { limit?: number };

        const response = await slackFetch(token, 'users.list', { limit });

        if (!response.ok) {
          return NextResponse.json(
            { error: response.error || 'Failed to list users' },
            { status: 400 }
          );
        }

        const members = response.members as Array<{
          id: string;
          name: string;
          real_name: string;
          profile: { display_name: string; email: string; image_72: string; status_text: string };
          is_admin: boolean;
          is_owner: boolean;
          is_bot: boolean;
          deleted: boolean;
        }>;

        result = {
          users: members?.filter(u => !u.deleted && !u.is_bot).map(u => ({
            id: u.id,
            name: u.name,
            realName: u.real_name,
            displayName: u.profile?.display_name || u.real_name,
            email: u.profile?.email,
            avatar: u.profile?.image_72,
            status: u.profile?.status_text || null,
            isAdmin: u.is_admin,
            isOwner: u.is_owner,
          })) || [],
          count: members?.filter(u => !u.deleted && !u.is_bot).length || 0,
        };
        break;
      }

      case 'get_user': {
        const { userId } = params as { userId: string };
        if (!userId) {
          return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const response = await slackFetch(token, 'users.info', { user: userId });

        if (!response.ok) {
          return NextResponse.json(
            { error: response.error || 'Failed to get user' },
            { status: 400 }
          );
        }

        const user = response.user as {
          id: string;
          name: string;
          real_name: string;
          profile: {
            display_name: string;
            email: string;
            image_72: string;
            status_text: string;
            status_emoji: string;
            title: string;
          };
          is_admin: boolean;
          is_owner: boolean;
          is_bot: boolean;
          tz: string;
        };

        result = {
          id: user.id,
          name: user.name,
          realName: user.real_name,
          displayName: user.profile?.display_name || user.real_name,
          email: user.profile?.email,
          avatar: user.profile?.image_72,
          title: user.profile?.title,
          status: user.profile?.status_text || null,
          statusEmoji: user.profile?.status_emoji || null,
          isAdmin: user.is_admin,
          isOwner: user.is_owner,
          timezone: user.tz,
        };
        break;
      }

      case 'search_messages': {
        const { query, count = 20 } = params as { query: string; count?: number };
        if (!query) {
          return NextResponse.json({ error: 'query is required' }, { status: 400 });
        }

        const response = await slackFetch(token, 'search.messages', { query, count });

        if (!response.ok) {
          return NextResponse.json(
            { error: response.error || 'Failed to search messages' },
            { status: 400 }
          );
        }

        const messages = (response.messages as { matches: Array<{
          type: string;
          channel: { id: string; name: string };
          user: string;
          username: string;
          text: string;
          ts: string;
          permalink: string;
        }> })?.matches || [];

        result = {
          messages: messages.map(m => ({
            type: m.type,
            channelId: m.channel?.id,
            channelName: m.channel?.name,
            user: m.user,
            username: m.username,
            text: m.text,
            timestamp: formatTimestamp(m.ts),
            ts: m.ts,
            permalink: m.permalink,
          })),
          count: messages.length,
          total: (response.messages as { total: number })?.total || 0,
        };
        break;
      }

      case 'set_topic': {
        const { channelId, topic } = params as { channelId: string; topic: string };
        if (!channelId || topic === undefined) {
          return NextResponse.json({ error: 'channelId and topic are required' }, { status: 400 });
        }

        const response = await slackFetch(token, 'conversations.setTopic', {
          channel: channelId,
          topic,
        });

        if (!response.ok) {
          return NextResponse.json(
            { error: response.error || 'Failed to set topic' },
            { status: 400 }
          );
        }

        result = {
          channelId: (response.channel as { id: string })?.id,
          topic: (response.channel as { topic: { value: string } })?.topic?.value,
          message: 'Channel topic updated successfully!',
        };
        break;
      }

      case 'create_channel': {
        const { name, isPrivate = false } = params as { name: string; isPrivate?: boolean };
        if (!name) {
          return NextResponse.json({ error: 'name is required' }, { status: 400 });
        }

        const response = await slackFetch(token, 'conversations.create', {
          name: name.toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
          is_private: isPrivate,
        });

        if (!response.ok) {
          return NextResponse.json(
            { error: response.error || 'Failed to create channel' },
            { status: 400 }
          );
        }

        const channel = response.channel as { id: string; name: string };
        result = {
          id: channel.id,
          name: channel.name,
          message: `Channel #${channel.name} created successfully!`,
        };
        break;
      }

      case 'invite_to_channel': {
        const { channelId, userIds } = params as { channelId: string; userIds: string[] | string };
        if (!channelId || !userIds) {
          return NextResponse.json({ error: 'channelId and userIds are required' }, { status: 400 });
        }

        const users = Array.isArray(userIds) ? userIds.join(',') : userIds;

        const response = await slackFetch(token, 'conversations.invite', {
          channel: channelId,
          users,
        });

        if (!response.ok) {
          return NextResponse.json(
            { error: response.error || 'Failed to invite users' },
            { status: 400 }
          );
        }

        result = {
          channelId: (response.channel as { id: string })?.id,
          message: 'Users invited successfully!',
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[Slack Execute API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
