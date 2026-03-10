import { describe, it, expect, vi } from 'vitest';
import {
  TeamWorkspaceManager,
  getTeamWorkspaceManager,
  hasPermission,
  canPerformAction,
  DEFAULT_WORKSPACE_PERMISSIONS,
} from './team-workspaces';

// -------------------------------------------------------------------
// hasPermission
// -------------------------------------------------------------------
describe('hasPermission', () => {
  it('should grant owner all permissions', () => {
    expect(hasPermission('owner', ['owner'])).toBe(true);
    expect(hasPermission('owner', ['admin'])).toBe(true);
    expect(hasPermission('owner', ['member'])).toBe(true);
    expect(hasPermission('owner', ['viewer'])).toBe(true);
  });

  it('should grant admin level 3 and below', () => {
    expect(hasPermission('admin', ['owner'])).toBe(false);
    expect(hasPermission('admin', ['admin'])).toBe(true);
    expect(hasPermission('admin', ['member'])).toBe(true);
  });

  it('should limit member to level 2 and below', () => {
    expect(hasPermission('member', ['owner'])).toBe(false);
    expect(hasPermission('member', ['admin'])).toBe(false);
    expect(hasPermission('member', ['member'])).toBe(true);
    expect(hasPermission('member', ['viewer'])).toBe(true);
  });

  it('should limit viewer to level 1', () => {
    expect(hasPermission('viewer', ['viewer'])).toBe(true);
    expect(hasPermission('viewer', ['member'])).toBe(false);
  });

  it('should use minimum role from array', () => {
    // If requiredRoles is ['member', 'viewer'], min is viewer (1), so viewer can access
    expect(hasPermission('viewer', ['member', 'viewer'])).toBe(true);
  });
});

// -------------------------------------------------------------------
// canPerformAction
// -------------------------------------------------------------------
describe('canPerformAction', () => {
  it('should check read permission', () => {
    expect(canPerformAction('viewer', 'canRead', DEFAULT_WORKSPACE_PERMISSIONS)).toBe(true);
  });

  it('should check write permission', () => {
    expect(canPerformAction('member', 'canWrite', DEFAULT_WORKSPACE_PERMISSIONS)).toBe(true);
    expect(canPerformAction('viewer', 'canWrite', DEFAULT_WORKSPACE_PERMISSIONS)).toBe(false);
  });

  it('should check delete permission', () => {
    expect(canPerformAction('admin', 'canDelete', DEFAULT_WORKSPACE_PERMISSIONS)).toBe(true);
    expect(canPerformAction('member', 'canDelete', DEFAULT_WORKSPACE_PERMISSIONS)).toBe(false);
  });

  it('should check settings permission', () => {
    expect(canPerformAction('owner', 'canManageSettings', DEFAULT_WORKSPACE_PERMISSIONS)).toBe(
      true
    );
    expect(canPerformAction('admin', 'canManageSettings', DEFAULT_WORKSPACE_PERMISSIONS)).toBe(
      false
    );
  });
});

// -------------------------------------------------------------------
// DEFAULT_WORKSPACE_PERMISSIONS
// -------------------------------------------------------------------
describe('DEFAULT_WORKSPACE_PERMISSIONS', () => {
  it('should allow all roles to read', () => {
    expect(DEFAULT_WORKSPACE_PERMISSIONS.canRead).toHaveLength(4);
  });

  it('should allow owner, admin, member to write', () => {
    expect(DEFAULT_WORKSPACE_PERMISSIONS.canWrite).toEqual(['owner', 'admin', 'member']);
  });

  it('should only allow owner to manage settings', () => {
    expect(DEFAULT_WORKSPACE_PERMISSIONS.canManageSettings).toEqual(['owner']);
  });
});

// -------------------------------------------------------------------
// TeamWorkspaceManager
// -------------------------------------------------------------------
describe('TeamWorkspaceManager', () => {
  async function createTeamWithWorkspace() {
    const mgr = new TeamWorkspaceManager();
    const team = await mgr.createTeam({
      name: 'Test Team',
      description: 'A test team',
      creatorId: 'u1',
      creatorEmail: 'user@test.com',
      creatorName: 'Test User',
    });
    const workspace = await mgr.createWorkspace({
      teamId: team.id,
      name: 'Test Workspace',
      creatorId: 'u1',
    });
    return { mgr, team, workspace };
  }

  describe('createTeam', () => {
    it('should create a team with creator as owner', async () => {
      const mgr = new TeamWorkspaceManager();
      const team = await mgr.createTeam({
        name: 'My Team',
        creatorId: 'u1',
        creatorEmail: 'u1@test.com',
        creatorName: 'User One',
      });
      expect(team.name).toBe('My Team');
      expect(team.members).toHaveLength(1);
      expect(team.members[0].role).toBe('owner');
      expect(team.members[0].id).toBe('u1');
    });

    it('should emit team:created event', async () => {
      const mgr = new TeamWorkspaceManager();
      const handler = vi.fn();
      mgr.on('team:created', handler);
      await mgr.createTeam({
        name: 'Team',
        creatorId: 'u1',
        creatorEmail: 'u@t.com',
        creatorName: 'U',
      });
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('inviteMember', () => {
    it('should invite a member', async () => {
      const { mgr, team } = await createTeamWithWorkspace();
      const member = await mgr.inviteMember({
        teamId: team.id,
        inviterId: 'u1',
        email: 'new@test.com',
        name: 'New User',
      });
      expect(member.role).toBe('member');
      expect(member.email).toBe('new@test.com');
    });

    it('should use custom role', async () => {
      const { mgr, team } = await createTeamWithWorkspace();
      const member = await mgr.inviteMember({
        teamId: team.id,
        inviterId: 'u1',
        email: 'admin@test.com',
        name: 'Admin User',
        role: 'admin',
      });
      expect(member.role).toBe('admin');
    });

    it('should throw for unknown team', async () => {
      const mgr = new TeamWorkspaceManager();
      await expect(
        mgr.inviteMember({
          teamId: 'nonexistent',
          inviterId: 'u1',
          email: 'x@t.com',
          name: 'X',
        })
      ).rejects.toThrow('Team not found');
    });

    it('should throw for non-member inviter', async () => {
      const { mgr, team } = await createTeamWithWorkspace();
      await expect(
        mgr.inviteMember({
          teamId: team.id,
          inviterId: 'unknown-user',
          email: 'x@t.com',
          name: 'X',
        })
      ).rejects.toThrow('Inviter not a team member');
    });
  });

  describe('createWorkspace', () => {
    it('should create a workspace under a team', async () => {
      const { workspace } = await createTeamWithWorkspace();
      expect(workspace.name).toBe('Test Workspace');
      expect(workspace.activeSessions).toBe(0);
    });

    it('should throw for unknown team', async () => {
      const mgr = new TeamWorkspaceManager();
      await expect(
        mgr.createWorkspace({
          teamId: 'nonexistent',
          name: 'WS',
          creatorId: 'u1',
        })
      ).rejects.toThrow('Team not found');
    });

    it('should throw for unauthorized user', async () => {
      const mgr = new TeamWorkspaceManager();
      const team = await mgr.createTeam({
        name: 'Team',
        creatorId: 'u1',
        creatorEmail: 'u@t.com',
        creatorName: 'U',
      });
      // Add a viewer
      await mgr.inviteMember({
        teamId: team.id,
        inviterId: 'u1',
        email: 'v@t.com',
        name: 'Viewer',
        role: 'viewer',
      });
      const viewer = team.members.find((m) => m.role === 'viewer')!;
      await expect(
        mgr.createWorkspace({
          teamId: team.id,
          name: 'WS',
          creatorId: viewer.id,
        })
      ).rejects.toThrow('Not authorized');
    });
  });

  describe('joinSession / leaveSession', () => {
    it('should join and track presence', async () => {
      const { mgr, workspace } = await createTeamWithWorkspace();
      const presence = await mgr.joinSession({
        workspaceId: workspace.id,
        userId: 'u1',
        userName: 'User',
        sessionId: 's1',
      });
      expect(presence).toHaveLength(1);
      expect(presence[0].userId).toBe('u1');
    });

    it('should increment active sessions', async () => {
      const { mgr, workspace } = await createTeamWithWorkspace();
      await mgr.joinSession({
        workspaceId: workspace.id,
        userId: 'u1',
        userName: 'User',
        sessionId: 's1',
      });
      expect(mgr.getPresence(workspace.id)).toHaveLength(1);
    });

    it('should leave and decrement sessions', async () => {
      const { mgr, workspace } = await createTeamWithWorkspace();
      await mgr.joinSession({
        workspaceId: workspace.id,
        userId: 'u1',
        userName: 'User',
        sessionId: 's1',
      });
      await mgr.leaveSession(workspace.id, 'u1');
      expect(mgr.getPresence(workspace.id)).toHaveLength(0);
    });

    it('should log activity on join', async () => {
      const { mgr, workspace } = await createTeamWithWorkspace();
      await mgr.joinSession({
        workspaceId: workspace.id,
        userId: 'u1',
        userName: 'User',
        sessionId: 's1',
      });
      const feed = mgr.getActivityFeed(workspace.id);
      expect(feed.some((a) => a.type === 'session_start')).toBe(true);
    });

    it('should throw for unknown workspace', async () => {
      const mgr = new TeamWorkspaceManager();
      await expect(
        mgr.joinSession({
          workspaceId: 'nonexistent',
          userId: 'u1',
          userName: 'User',
          sessionId: 's1',
        })
      ).rejects.toThrow('Workspace not found');
    });
  });

  describe('updatePresence', () => {
    it('should update user presence', async () => {
      const { mgr, workspace } = await createTeamWithWorkspace();
      await mgr.joinSession({
        workspaceId: workspace.id,
        userId: 'u1',
        userName: 'User',
        sessionId: 's1',
      });
      mgr.updatePresence(workspace.id, 'u1', { currentFile: 'index.ts' });
      const presence = mgr.getPresence(workspace.id);
      expect(presence[0].currentFile).toBe('index.ts');
    });
  });

  describe('addComment', () => {
    it('should add a comment', async () => {
      const { mgr, workspace } = await createTeamWithWorkspace();
      const comment = await mgr.addComment({
        workspaceId: workspace.id,
        userId: 'u1',
        userName: 'User',
        content: 'This looks good',
      });
      expect(comment.content).toBe('This looks good');
      expect(comment.resolved).toBe(false);
    });

    it('should add a reply to an existing comment', async () => {
      const { mgr, workspace } = await createTeamWithWorkspace();
      const parent = await mgr.addComment({
        workspaceId: workspace.id,
        userId: 'u1',
        userName: 'User',
        content: 'Question',
      });
      await mgr.addComment({
        workspaceId: workspace.id,
        userId: 'u2',
        userName: 'User2',
        content: 'Answer',
        parentId: parent.id,
      });
      const comments = mgr.getComments(workspace.id);
      expect(comments[0].replies).toHaveLength(1);
      expect(comments[0].replies[0].content).toBe('Answer');
    });
  });

  describe('getComments', () => {
    it('should filter by file path', async () => {
      const { mgr, workspace } = await createTeamWithWorkspace();
      await mgr.addComment({
        workspaceId: workspace.id,
        userId: 'u1',
        userName: 'User',
        content: 'Comment on file A',
        filePath: 'a.ts',
      });
      await mgr.addComment({
        workspaceId: workspace.id,
        userId: 'u1',
        userName: 'User',
        content: 'Comment on file B',
        filePath: 'b.ts',
      });
      expect(mgr.getComments(workspace.id, 'a.ts')).toHaveLength(1);
    });

    it('should return all comments when no filter', async () => {
      const { mgr, workspace } = await createTeamWithWorkspace();
      await mgr.addComment({
        workspaceId: workspace.id,
        userId: 'u1',
        userName: 'User',
        content: 'C1',
      });
      await mgr.addComment({
        workspaceId: workspace.id,
        userId: 'u1',
        userName: 'User',
        content: 'C2',
      });
      expect(mgr.getComments(workspace.id)).toHaveLength(2);
    });
  });

  describe('getActivityFeed', () => {
    it('should return empty for new workspace', async () => {
      const { mgr, workspace } = await createTeamWithWorkspace();
      expect(mgr.getActivityFeed(workspace.id)).toHaveLength(0);
    });

    it('should respect limit', async () => {
      const { mgr, workspace } = await createTeamWithWorkspace();
      for (let i = 0; i < 5; i++) {
        await mgr.joinSession({
          workspaceId: workspace.id,
          userId: `u${i}`,
          userName: `User ${i}`,
          sessionId: `s${i}`,
        });
      }
      expect(mgr.getActivityFeed(workspace.id, 3)).toHaveLength(3);
    });
  });

  describe('event system', () => {
    it('should register and fire events', async () => {
      const mgr = new TeamWorkspaceManager();
      const handler = vi.fn();
      mgr.on('test:event', handler);
      // Events are fired internally, test via workspace creation
      const team = await mgr.createTeam({
        name: 'T',
        creatorId: 'u',
        creatorEmail: 'u@t.com',
        creatorName: 'U',
      });
      const wsHandler = vi.fn();
      mgr.on('workspace:created', wsHandler);
      await mgr.createWorkspace({
        teamId: team.id,
        name: 'WS',
        creatorId: 'u',
      });
      expect(wsHandler).toHaveBeenCalledTimes(1);
    });

    it('should unregister handlers', async () => {
      const mgr = new TeamWorkspaceManager();
      const handler = vi.fn();
      mgr.on('team:created', handler);
      mgr.off('team:created', handler);
      await mgr.createTeam({
        name: 'T',
        creatorId: 'u',
        creatorEmail: 'u@t.com',
        creatorName: 'U',
      });
      expect(handler).not.toHaveBeenCalled();
    });
  });
});

// -------------------------------------------------------------------
// getTeamWorkspaceManager (singleton)
// -------------------------------------------------------------------
describe('getTeamWorkspaceManager', () => {
  it('should return same instance', () => {
    expect(getTeamWorkspaceManager()).toBe(getTeamWorkspaceManager());
  });
});
