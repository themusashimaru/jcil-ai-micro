/**
 * DISCORD ACTION EXECUTION API
 * Execute Discord API actions after user confirmation
 * POST: Execute a specific Discord action
 *
 * Token format: Bot token (starts with MTxxxxxx or similar)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const DISCORD_API = 'https://discord.com/api/v10';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

// Helper for Discord API requests
async function discordFetch(
  token: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  // Ensure token has Bot prefix
  const authToken = token.startsWith('Bot ') ? token : `Bot ${token}`;

  return fetch(`${DISCORD_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: authToken,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

// Convert Discord snowflake timestamp
function snowflakeToDate(snowflake: string): string {
  const timestamp = Number(BigInt(snowflake) >> 22n) + 1420070400000;
  return new Date(timestamp).toISOString();
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get user's Discord connection
    const connection = await getUserConnection(user.id, 'discord');
    if (!connection) {
      return NextResponse.json({ error: 'Discord not connected' }, { status: 400 });
    }

    const body: ExecuteRequest = await request.json();
    const { action, params } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const token = connection.token;
    let result: unknown;

    switch (action) {
      case 'get_bot':
      case 'get_current_user': {
        const response = await discordFetch(token, '/users/@me');

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.message || 'Failed to get bot info' },
            { status: response.status }
          );
        }

        const bot = await response.json();
        result = {
          id: bot.id,
          username: bot.username,
          discriminator: bot.discriminator,
          globalName: bot.global_name,
          avatar: bot.avatar ? `https://cdn.discordapp.com/avatars/${bot.id}/${bot.avatar}.png` : null,
          bot: bot.bot,
          verified: bot.verified,
        };
        break;
      }

      case 'list_guilds':
      case 'list_servers': {
        const { limit = 100 } = params as { limit?: number };

        const response = await discordFetch(token, `/users/@me/guilds?limit=${limit}`);

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.message || 'Failed to list guilds' },
            { status: response.status }
          );
        }

        const guilds = await response.json();
        result = {
          guilds: guilds.map((g: {
            id: string;
            name: string;
            icon: string | null;
            owner: boolean;
            permissions: string;
          }) => ({
            id: g.id,
            name: g.name,
            icon: g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png` : null,
            owner: g.owner,
            permissions: g.permissions,
            createdAt: snowflakeToDate(g.id),
          })),
          count: guilds.length,
        };
        break;
      }

      case 'get_guild':
      case 'get_server': {
        const { guildId } = params as { guildId: string };
        if (!guildId) {
          return NextResponse.json({ error: 'guildId is required' }, { status: 400 });
        }

        const response = await discordFetch(token, `/guilds/${guildId}?with_counts=true`);

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.message || 'Failed to get guild' },
            { status: response.status }
          );
        }

        const guild = await response.json();
        result = {
          id: guild.id,
          name: guild.name,
          description: guild.description,
          icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null,
          ownerId: guild.owner_id,
          memberCount: guild.approximate_member_count,
          onlineCount: guild.approximate_presence_count,
          createdAt: snowflakeToDate(guild.id),
          features: guild.features,
          verificationLevel: guild.verification_level,
        };
        break;
      }

      case 'list_channels': {
        const { guildId } = params as { guildId: string };
        if (!guildId) {
          return NextResponse.json({ error: 'guildId is required' }, { status: 400 });
        }

        const response = await discordFetch(token, `/guilds/${guildId}/channels`);

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.message || 'Failed to list channels' },
            { status: response.status }
          );
        }

        const channels = await response.json();
        // Channel types: 0=text, 2=voice, 4=category, 5=announcement, 13=stage, 15=forum
        const channelTypes: Record<number, string> = {
          0: 'text',
          2: 'voice',
          4: 'category',
          5: 'announcement',
          13: 'stage',
          15: 'forum',
        };

        result = {
          channels: channels.map((c: {
            id: string;
            name: string;
            type: number;
            topic: string | null;
            position: number;
            parent_id: string | null;
            nsfw: boolean;
          }) => ({
            id: c.id,
            name: c.name,
            type: channelTypes[c.type] || `type_${c.type}`,
            topic: c.topic,
            position: c.position,
            parentId: c.parent_id,
            nsfw: c.nsfw,
            createdAt: snowflakeToDate(c.id),
          })).sort((a: { position: number }, b: { position: number }) => a.position - b.position),
          count: channels.length,
        };
        break;
      }

      case 'get_channel': {
        const { channelId } = params as { channelId: string };
        if (!channelId) {
          return NextResponse.json({ error: 'channelId is required' }, { status: 400 });
        }

        const response = await discordFetch(token, `/channels/${channelId}`);

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.message || 'Failed to get channel' },
            { status: response.status }
          );
        }

        const channel = await response.json();
        result = {
          id: channel.id,
          name: channel.name,
          type: channel.type,
          topic: channel.topic,
          guildId: channel.guild_id,
          position: channel.position,
          nsfw: channel.nsfw,
          createdAt: snowflakeToDate(channel.id),
        };
        break;
      }

      case 'list_messages':
      case 'get_messages': {
        const { channelId, limit = 50, before, after } = params as {
          channelId: string;
          limit?: number;
          before?: string;
          after?: string;
        };

        if (!channelId) {
          return NextResponse.json({ error: 'channelId is required' }, { status: 400 });
        }

        let endpoint = `/channels/${channelId}/messages?limit=${Math.min(limit, 100)}`;
        if (before) endpoint += `&before=${before}`;
        if (after) endpoint += `&after=${after}`;

        const response = await discordFetch(token, endpoint);

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.message || 'Failed to get messages' },
            { status: response.status }
          );
        }

        const messages = await response.json();
        result = {
          messages: messages.map((m: {
            id: string;
            content: string;
            author: { id: string; username: string; global_name: string | null; bot: boolean };
            timestamp: string;
            edited_timestamp: string | null;
            attachments: Array<{ url: string; filename: string }>;
            embeds: unknown[];
            reactions: Array<{ emoji: { name: string }; count: number }>;
            referenced_message: { id: string; content: string } | null;
          }) => ({
            id: m.id,
            content: m.content,
            author: {
              id: m.author.id,
              username: m.author.username,
              displayName: m.author.global_name || m.author.username,
              bot: m.author.bot || false,
            },
            timestamp: m.timestamp,
            editedTimestamp: m.edited_timestamp,
            attachments: m.attachments?.map(a => ({ url: a.url, filename: a.filename })) || [],
            embedCount: m.embeds?.length || 0,
            reactions: m.reactions?.map(r => ({ emoji: r.emoji.name, count: r.count })) || [],
            replyTo: m.referenced_message?.id || null,
          })),
          count: messages.length,
        };
        break;
      }

      case 'send_message': {
        const { channelId, content, replyTo, tts = false } = params as {
          channelId: string;
          content: string;
          replyTo?: string;
          tts?: boolean;
        };

        if (!channelId || !content) {
          return NextResponse.json({ error: 'channelId and content are required' }, { status: 400 });
        }

        const messageData: Record<string, unknown> = { content, tts };
        if (replyTo) {
          messageData.message_reference = { message_id: replyTo };
        }

        const response = await discordFetch(token, `/channels/${channelId}/messages`, {
          method: 'POST',
          body: JSON.stringify(messageData),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.message || 'Failed to send message' },
            { status: response.status }
          );
        }

        const message = await response.json();
        result = {
          id: message.id,
          channelId: message.channel_id,
          content: message.content,
          timestamp: message.timestamp,
          message: 'Message sent successfully!',
        };
        break;
      }

      case 'edit_message': {
        const { channelId, messageId, content } = params as {
          channelId: string;
          messageId: string;
          content: string;
        };

        if (!channelId || !messageId || !content) {
          return NextResponse.json({ error: 'channelId, messageId, and content are required' }, { status: 400 });
        }

        const response = await discordFetch(token, `/channels/${channelId}/messages/${messageId}`, {
          method: 'PATCH',
          body: JSON.stringify({ content }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.message || 'Failed to edit message' },
            { status: response.status }
          );
        }

        const message = await response.json();
        result = {
          id: message.id,
          content: message.content,
          editedTimestamp: message.edited_timestamp,
          message: 'Message edited successfully!',
        };
        break;
      }

      case 'delete_message': {
        const { channelId, messageId } = params as { channelId: string; messageId: string };

        if (!channelId || !messageId) {
          return NextResponse.json({ error: 'channelId and messageId are required' }, { status: 400 });
        }

        const response = await discordFetch(token, `/channels/${channelId}/messages/${messageId}`, {
          method: 'DELETE',
        });

        if (!response.ok && response.status !== 204) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.message || 'Failed to delete message' },
            { status: response.status }
          );
        }

        result = {
          messageId,
          message: 'Message deleted successfully!',
        };
        break;
      }

      case 'add_reaction': {
        const { channelId, messageId, emoji } = params as {
          channelId: string;
          messageId: string;
          emoji: string;
        };

        if (!channelId || !messageId || !emoji) {
          return NextResponse.json({ error: 'channelId, messageId, and emoji are required' }, { status: 400 });
        }

        // URL encode the emoji
        const encodedEmoji = encodeURIComponent(emoji);

        const response = await discordFetch(
          token,
          `/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/@me`,
          { method: 'PUT' }
        );

        if (!response.ok && response.status !== 204) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.message || 'Failed to add reaction' },
            { status: response.status }
          );
        }

        result = {
          message: `Reaction ${emoji} added successfully!`,
        };
        break;
      }

      case 'list_members': {
        const { guildId, limit = 100 } = params as { guildId: string; limit?: number };

        if (!guildId) {
          return NextResponse.json({ error: 'guildId is required' }, { status: 400 });
        }

        const response = await discordFetch(token, `/guilds/${guildId}/members?limit=${Math.min(limit, 1000)}`);

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.message || 'Failed to list members' },
            { status: response.status }
          );
        }

        const members = await response.json();
        result = {
          members: members.map((m: {
            user: {
              id: string;
              username: string;
              global_name: string | null;
              avatar: string | null;
              bot: boolean;
            };
            nick: string | null;
            roles: string[];
            joined_at: string;
          }) => ({
            id: m.user.id,
            username: m.user.username,
            displayName: m.nick || m.user.global_name || m.user.username,
            avatar: m.user.avatar ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png` : null,
            bot: m.user.bot || false,
            roles: m.roles,
            joinedAt: m.joined_at,
          })),
          count: members.length,
        };
        break;
      }

      case 'list_roles': {
        const { guildId } = params as { guildId: string };

        if (!guildId) {
          return NextResponse.json({ error: 'guildId is required' }, { status: 400 });
        }

        const response = await discordFetch(token, `/guilds/${guildId}/roles`);

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.message || 'Failed to list roles' },
            { status: response.status }
          );
        }

        const roles = await response.json();
        result = {
          roles: roles.map((r: {
            id: string;
            name: string;
            color: number;
            position: number;
            permissions: string;
            managed: boolean;
            mentionable: boolean;
          }) => ({
            id: r.id,
            name: r.name,
            color: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : null,
            position: r.position,
            permissions: r.permissions,
            managed: r.managed,
            mentionable: r.mentionable,
          })).sort((a: { position: number }, b: { position: number }) => b.position - a.position),
          count: roles.length,
        };
        break;
      }

      case 'create_channel': {
        const { guildId, name, type = 0, topic, parentId } = params as {
          guildId: string;
          name: string;
          type?: number;
          topic?: string;
          parentId?: string;
        };

        if (!guildId || !name) {
          return NextResponse.json({ error: 'guildId and name are required' }, { status: 400 });
        }

        const channelData: Record<string, unknown> = {
          name: name.toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
          type,
        };
        if (topic) channelData.topic = topic;
        if (parentId) channelData.parent_id = parentId;

        const response = await discordFetch(token, `/guilds/${guildId}/channels`, {
          method: 'POST',
          body: JSON.stringify(channelData),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.message || 'Failed to create channel' },
            { status: response.status }
          );
        }

        const channel = await response.json();
        result = {
          id: channel.id,
          name: channel.name,
          type: channel.type,
          message: `Channel #${channel.name} created successfully!`,
        };
        break;
      }

      case 'update_channel': {
        const { channelId, name, topic } = params as {
          channelId: string;
          name?: string;
          topic?: string;
        };

        if (!channelId) {
          return NextResponse.json({ error: 'channelId is required' }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {};
        if (name) updateData.name = name.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
        if (topic !== undefined) updateData.topic = topic;

        const response = await discordFetch(token, `/channels/${channelId}`, {
          method: 'PATCH',
          body: JSON.stringify(updateData),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json(
            { error: error.message || 'Failed to update channel' },
            { status: response.status }
          );
        }

        const channel = await response.json();
        result = {
          id: channel.id,
          name: channel.name,
          topic: channel.topic,
          message: 'Channel updated successfully!',
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[Discord Execute API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
