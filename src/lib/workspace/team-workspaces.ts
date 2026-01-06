/**
 * TEAM WORKSPACES
 *
 * Multi-user collaboration with shared workspaces.
 *
 * Features:
 * - Shared workspace access
 * - Role-based permissions
 * - Real-time presence
 * - Activity feed
 * - Comments and annotations
 * - Change notifications
 */

export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: TeamRole;
  joinedAt: Date;
  lastActiveAt: Date;
  isOnline: boolean;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  members: TeamMember[];
  workspaces: TeamWorkspace[];
  createdAt: Date;
  createdBy: string;
  settings: TeamSettings;
}

export interface TeamWorkspace {
  id: string;
  name: string;
  description?: string;
  teamId: string;
  repoUrl?: string;
  createdAt: Date;
  createdBy: string;
  lastActivityAt: Date;
  activeSessions: number;
  permissions: WorkspacePermissions;
}

export interface TeamSettings {
  allowMemberInvites: boolean;
  requireApproval: boolean;
  defaultRole: TeamRole;
  notificationEmail?: string;
  webhookUrl?: string;
}

export interface WorkspacePermissions {
  canRead: TeamRole[];
  canWrite: TeamRole[];
  canDelete: TeamRole[];
  canInvite: TeamRole[];
  canManageSettings: TeamRole[];
}

export interface WorkspaceActivity {
  id: string;
  workspaceId: string;
  userId: string;
  userName: string;
  type: 'session_start' | 'session_end' | 'file_change' | 'commit' | 'comment' | 'deploy';
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface WorkspaceComment {
  id: string;
  workspaceId: string;
  sessionId?: string;
  filePath?: string;
  lineNumber?: number;
  userId: string;
  userName: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  resolved: boolean;
  replies: WorkspaceComment[];
}

export interface PresenceInfo {
  userId: string;
  userName: string;
  avatar?: string;
  sessionId: string;
  currentFile?: string;
  cursorPosition?: { line: number; column: number };
  lastActiveAt: Date;
}

// Permission helpers
const ROLE_HIERARCHY: Record<TeamRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};

export function hasPermission(userRole: TeamRole, requiredRoles: TeamRole[]): boolean {
  const userLevel = ROLE_HIERARCHY[userRole];
  const minRequired = Math.min(...requiredRoles.map(r => ROLE_HIERARCHY[r]));
  return userLevel >= minRequired;
}

export function canPerformAction(
  userRole: TeamRole,
  action: keyof WorkspacePermissions,
  permissions: WorkspacePermissions
): boolean {
  return hasPermission(userRole, permissions[action]);
}

// Default permissions
export const DEFAULT_WORKSPACE_PERMISSIONS: WorkspacePermissions = {
  canRead: ['owner', 'admin', 'member', 'viewer'],
  canWrite: ['owner', 'admin', 'member'],
  canDelete: ['owner', 'admin'],
  canInvite: ['owner', 'admin'],
  canManageSettings: ['owner'],
};

/**
 * Team Workspace Manager
 */
export class TeamWorkspaceManager {
  private teams: Map<string, Team> = new Map();
  private workspaces: Map<string, TeamWorkspace> = new Map();
  private activities: Map<string, WorkspaceActivity[]> = new Map();
  private comments: Map<string, WorkspaceComment[]> = new Map();
  private presence: Map<string, Map<string, PresenceInfo>> = new Map();
  private eventHandlers: Map<string, ((event: unknown) => void)[]> = new Map();

  /**
   * Create a new team
   */
  async createTeam(params: {
    name: string;
    description?: string;
    creatorId: string;
    creatorEmail: string;
    creatorName: string;
  }): Promise<Team> {
    const id = this.generateId('team');

    const team: Team = {
      id,
      name: params.name,
      description: params.description,
      members: [
        {
          id: params.creatorId,
          email: params.creatorEmail,
          name: params.creatorName,
          role: 'owner',
          joinedAt: new Date(),
          lastActiveAt: new Date(),
          isOnline: true,
        },
      ],
      workspaces: [],
      createdAt: new Date(),
      createdBy: params.creatorId,
      settings: {
        allowMemberInvites: true,
        requireApproval: false,
        defaultRole: 'member',
      },
    };

    this.teams.set(id, team);
    this.emit('team:created', team);

    return team;
  }

  /**
   * Invite a member to a team
   */
  async inviteMember(params: {
    teamId: string;
    inviterId: string;
    email: string;
    name: string;
    role?: TeamRole;
  }): Promise<TeamMember> {
    const team = this.teams.get(params.teamId);
    if (!team) throw new Error('Team not found');

    const inviter = team.members.find(m => m.id === params.inviterId);
    if (!inviter) throw new Error('Inviter not a team member');

    if (!hasPermission(inviter.role, ['owner', 'admin'])) {
      if (!team.settings.allowMemberInvites || !hasPermission(inviter.role, ['member'])) {
        throw new Error('Not authorized to invite members');
      }
    }

    const memberId = this.generateId('member');
    const member: TeamMember = {
      id: memberId,
      email: params.email,
      name: params.name,
      role: params.role || team.settings.defaultRole,
      joinedAt: new Date(),
      lastActiveAt: new Date(),
      isOnline: false,
    };

    team.members.push(member);
    this.emit('member:invited', { team, member });

    return member;
  }

  /**
   * Create a shared workspace
   */
  async createWorkspace(params: {
    teamId: string;
    name: string;
    description?: string;
    creatorId: string;
    repoUrl?: string;
  }): Promise<TeamWorkspace> {
    const team = this.teams.get(params.teamId);
    if (!team) throw new Error('Team not found');

    const creator = team.members.find(m => m.id === params.creatorId);
    if (!creator || !hasPermission(creator.role, ['owner', 'admin', 'member'])) {
      throw new Error('Not authorized to create workspaces');
    }

    const id = this.generateId('workspace');
    const workspace: TeamWorkspace = {
      id,
      name: params.name,
      description: params.description,
      teamId: params.teamId,
      repoUrl: params.repoUrl,
      createdAt: new Date(),
      createdBy: params.creatorId,
      lastActivityAt: new Date(),
      activeSessions: 0,
      permissions: { ...DEFAULT_WORKSPACE_PERMISSIONS },
    };

    team.workspaces.push(workspace);
    this.workspaces.set(id, workspace);
    this.activities.set(id, []);
    this.comments.set(id, []);
    this.presence.set(id, new Map());

    this.emit('workspace:created', workspace);

    return workspace;
  }

  /**
   * Join a workspace session
   */
  async joinSession(params: {
    workspaceId: string;
    userId: string;
    userName: string;
    avatar?: string;
    sessionId: string;
  }): Promise<PresenceInfo[]> {
    const workspace = this.workspaces.get(params.workspaceId);
    if (!workspace) throw new Error('Workspace not found');

    const presenceInfo: PresenceInfo = {
      userId: params.userId,
      userName: params.userName,
      avatar: params.avatar,
      sessionId: params.sessionId,
      lastActiveAt: new Date(),
    };

    const workspacePresence = this.presence.get(params.workspaceId) || new Map();
    workspacePresence.set(params.userId, presenceInfo);
    this.presence.set(params.workspaceId, workspacePresence);

    workspace.activeSessions++;

    this.logActivity({
      workspaceId: params.workspaceId,
      userId: params.userId,
      userName: params.userName,
      type: 'session_start',
      description: `${params.userName} joined the workspace`,
    });

    this.emit('presence:joined', { workspaceId: params.workspaceId, presence: presenceInfo });

    return Array.from(workspacePresence.values());
  }

  /**
   * Leave a workspace session
   */
  async leaveSession(workspaceId: string, userId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) return;

    const workspacePresence = this.presence.get(workspaceId);
    const userPresence = workspacePresence?.get(userId);

    if (userPresence) {
      workspacePresence?.delete(userId);
      workspace.activeSessions = Math.max(0, workspace.activeSessions - 1);

      this.logActivity({
        workspaceId,
        userId,
        userName: userPresence.userName,
        type: 'session_end',
        description: `${userPresence.userName} left the workspace`,
      });

      this.emit('presence:left', { workspaceId, userId });
    }
  }

  /**
   * Update presence info
   */
  updatePresence(workspaceId: string, userId: string, updates: Partial<PresenceInfo>): void {
    const workspacePresence = this.presence.get(workspaceId);
    const current = workspacePresence?.get(userId);

    if (current) {
      const updated = { ...current, ...updates, lastActiveAt: new Date() };
      workspacePresence?.set(userId, updated);
      this.emit('presence:updated', { workspaceId, presence: updated });
    }
  }

  /**
   * Add a comment
   */
  async addComment(params: {
    workspaceId: string;
    userId: string;
    userName: string;
    content: string;
    sessionId?: string;
    filePath?: string;
    lineNumber?: number;
    parentId?: string;
  }): Promise<WorkspaceComment> {
    const comment: WorkspaceComment = {
      id: this.generateId('comment'),
      workspaceId: params.workspaceId,
      sessionId: params.sessionId,
      filePath: params.filePath,
      lineNumber: params.lineNumber,
      userId: params.userId,
      userName: params.userName,
      content: params.content,
      createdAt: new Date(),
      updatedAt: new Date(),
      resolved: false,
      replies: [],
    };

    const workspaceComments = this.comments.get(params.workspaceId) || [];

    if (params.parentId) {
      const parent = workspaceComments.find(c => c.id === params.parentId);
      if (parent) {
        parent.replies.push(comment);
      }
    } else {
      workspaceComments.push(comment);
    }

    this.comments.set(params.workspaceId, workspaceComments);
    this.emit('comment:added', comment);

    return comment;
  }

  /**
   * Get workspace activity feed
   */
  getActivityFeed(workspaceId: string, limit: number = 50): WorkspaceActivity[] {
    const activities = this.activities.get(workspaceId) || [];
    return activities.slice(-limit);
  }

  /**
   * Get workspace comments
   */
  getComments(workspaceId: string, filePath?: string): WorkspaceComment[] {
    const comments = this.comments.get(workspaceId) || [];
    if (filePath) {
      return comments.filter(c => c.filePath === filePath);
    }
    return comments;
  }

  /**
   * Get current presence in workspace
   */
  getPresence(workspaceId: string): PresenceInfo[] {
    const workspacePresence = this.presence.get(workspaceId);
    return workspacePresence ? Array.from(workspacePresence.values()) : [];
  }

  // Event handling
  on(event: string, handler: (data: unknown) => void): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  off(event: string, handler: (data: unknown) => void): void {
    const handlers = this.eventHandlers.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  private emit(event: string, data: unknown): void {
    const handlers = this.eventHandlers.get(event) || [];
    for (const handler of handlers) {
      handler(data);
    }
  }

  // Helper: Log activity
  private logActivity(params: Omit<WorkspaceActivity, 'id' | 'createdAt'>): void {
    const activity: WorkspaceActivity = {
      ...params,
      id: this.generateId('activity'),
      createdAt: new Date(),
    };

    const activities = this.activities.get(params.workspaceId) || [];
    activities.push(activity);

    // Keep last 1000 activities
    if (activities.length > 1000) {
      activities.shift();
    }

    this.activities.set(params.workspaceId, activities);

    // Update workspace last activity
    const workspace = this.workspaces.get(params.workspaceId);
    if (workspace) {
      workspace.lastActivityAt = new Date();
    }

    this.emit('activity:logged', activity);
  }

  // Helper: Generate unique ID
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Singleton instance
let teamManagerInstance: TeamWorkspaceManager | null = null;

export function getTeamWorkspaceManager(): TeamWorkspaceManager {
  if (!teamManagerInstance) {
    teamManagerInstance = new TeamWorkspaceManager();
  }
  return teamManagerInstance;
}
