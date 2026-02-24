import { describe, it, expect } from 'vitest';
import {
  generatePlanId,
  generateTaskId,
  formatPlanAsMarkdown,
  parsePlanFromMarkdown,
  getPlanModeTools,
  PlanModeManager,
  getPlanModeManager,
  type Plan,
} from './planning';

// -------------------------------------------------------------------
// ID generation
// -------------------------------------------------------------------
describe('generatePlanId', () => {
  it('should return a string starting with plan-', () => {
    expect(generatePlanId()).toMatch(/^plan-/);
  });

  it('should generate unique IDs', () => {
    const id1 = generatePlanId();
    const id2 = generatePlanId();
    expect(id1).not.toBe(id2);
  });
});

describe('generateTaskId', () => {
  it('should return a string starting with task-', () => {
    expect(generateTaskId()).toMatch(/^task-/);
  });

  it('should generate unique IDs', () => {
    const id1 = generateTaskId();
    const id2 = generateTaskId();
    expect(id1).not.toBe(id2);
  });
});

// -------------------------------------------------------------------
// formatPlanAsMarkdown
// -------------------------------------------------------------------
describe('formatPlanAsMarkdown', () => {
  const basePlan: Plan = {
    id: 'plan-1',
    sessionId: 'session-1',
    title: 'Add Authentication',
    summary: 'Implement JWT auth flow',
    tasks: [],
    status: 'draft',
    createdAt: '2026-02-24T00:00:00.000Z',
    updatedAt: '2026-02-24T01:00:00.000Z',
  };

  it('should include plan title as heading', () => {
    const md = formatPlanAsMarkdown(basePlan);
    expect(md).toContain('# Add Authentication');
  });

  it('should include status', () => {
    const md = formatPlanAsMarkdown(basePlan);
    expect(md).toContain('**Status:** draft');
  });

  it('should include summary section', () => {
    const md = formatPlanAsMarkdown(basePlan);
    expect(md).toContain('## Summary');
    expect(md).toContain('Implement JWT auth flow');
  });

  it('should include tasks section', () => {
    const md = formatPlanAsMarkdown(basePlan);
    expect(md).toContain('## Tasks');
  });

  it('should format pending tasks with empty checkbox', () => {
    const plan: Plan = {
      ...basePlan,
      tasks: [{ id: 't1', title: 'Setup DB', description: '', status: 'pending' }],
    };
    const md = formatPlanAsMarkdown(plan);
    expect(md).toContain('[ ] **Setup DB**');
  });

  it('should format completed tasks with checked checkbox', () => {
    const plan: Plan = {
      ...basePlan,
      tasks: [{ id: 't1', title: 'Setup DB', description: '', status: 'completed' }],
    };
    const md = formatPlanAsMarkdown(plan);
    expect(md).toContain('[x] **Setup DB**');
  });

  it('should format in_progress tasks with ~ checkbox', () => {
    const plan: Plan = {
      ...basePlan,
      tasks: [{ id: 't1', title: 'Working', description: '', status: 'in_progress' }],
    };
    const md = formatPlanAsMarkdown(plan);
    expect(md).toContain('[~] **Working**');
  });

  it('should format blocked tasks with ! checkbox', () => {
    const plan: Plan = {
      ...basePlan,
      tasks: [{ id: 't1', title: 'Blocked', description: '', status: 'blocked' }],
    };
    const md = formatPlanAsMarkdown(plan);
    expect(md).toContain('[!] **Blocked**');
  });

  it('should include complexity', () => {
    const plan: Plan = {
      ...basePlan,
      tasks: [
        {
          id: 't1',
          title: 'Auth',
          description: '',
          status: 'pending',
          estimatedComplexity: 'high',
        },
      ],
    };
    const md = formatPlanAsMarkdown(plan);
    expect(md).toContain('(high)');
  });

  it('should include task description', () => {
    const plan: Plan = {
      ...basePlan,
      tasks: [{ id: 't1', title: 'Auth', description: 'Add JWT tokens', status: 'pending' }],
    };
    const md = formatPlanAsMarkdown(plan);
    expect(md).toContain('Add JWT tokens');
  });

  it('should include dependencies', () => {
    const plan: Plan = {
      ...basePlan,
      tasks: [
        { id: 't1', title: 'Auth', description: '', status: 'pending', dependencies: ['t2', 't3'] },
      ],
    };
    const md = formatPlanAsMarkdown(plan);
    expect(md).toContain('t2, t3');
  });

  it('should format subtasks with indent', () => {
    const plan: Plan = {
      ...basePlan,
      tasks: [
        {
          id: 't1',
          title: 'Parent',
          description: '',
          status: 'pending',
          subtasks: [{ id: 't2', title: 'Child', description: '', status: 'pending' }],
        },
      ],
    };
    const md = formatPlanAsMarkdown(plan);
    expect(md).toContain('  - [ ] **Child**');
  });

  it('should include notes section when present', () => {
    const plan: Plan = { ...basePlan, notes: 'Consider caching tokens' };
    const md = formatPlanAsMarkdown(plan);
    expect(md).toContain('## Notes');
    expect(md).toContain('Consider caching tokens');
  });

  it('should include footer', () => {
    const md = formatPlanAsMarkdown(basePlan);
    expect(md).toContain('Planning Mode');
  });
});

// -------------------------------------------------------------------
// parsePlanFromMarkdown
// -------------------------------------------------------------------
describe('parsePlanFromMarkdown', () => {
  it('should parse title', () => {
    const md = '# My Plan\n\n## Summary\nDo stuff\n\n## Tasks';
    const plan = parsePlanFromMarkdown(md, 'p1', 's1');
    expect(plan.title).toBe('My Plan');
  });

  it('should parse status', () => {
    const md = '# Plan\n**Status:** approved\n\n## Summary\nx\n\n## Tasks';
    const plan = parsePlanFromMarkdown(md, 'p1', 's1');
    expect(plan.status).toBe('approved');
  });

  it('should parse summary', () => {
    const md = '# Plan\n\n## Summary\n\nThis is the summary.\n\n## Tasks';
    const plan = parsePlanFromMarkdown(md, 'p1', 's1');
    expect(plan.summary).toContain('This is the summary');
  });

  it('should parse pending tasks', () => {
    const md = '# Plan\n\n## Tasks\n\n- [ ] **Setup DB**';
    const plan = parsePlanFromMarkdown(md, 'p1', 's1');
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].title).toBe('Setup DB');
    expect(plan.tasks[0].status).toBe('pending');
  });

  it('should parse completed tasks', () => {
    const md = '# Plan\n\n## Tasks\n\n- [x] **Done task**';
    const plan = parsePlanFromMarkdown(md, 'p1', 's1');
    expect(plan.tasks[0].status).toBe('completed');
  });

  it('should parse in-progress tasks', () => {
    const md = '# Plan\n\n## Tasks\n\n- [~] **Working**';
    const plan = parsePlanFromMarkdown(md, 'p1', 's1');
    expect(plan.tasks[0].status).toBe('in_progress');
  });

  it('should parse blocked tasks', () => {
    const md = '# Plan\n\n## Tasks\n\n- [!] **Blocked**';
    const plan = parsePlanFromMarkdown(md, 'p1', 's1');
    expect(plan.tasks[0].status).toBe('blocked');
  });

  it('should parse task complexity', () => {
    const md = '# Plan\n\n## Tasks\n\n- [ ] **Auth** (high)';
    const plan = parsePlanFromMarkdown(md, 'p1', 's1');
    expect(plan.tasks[0].estimatedComplexity).toBe('high');
  });

  it('should parse indented subtasks', () => {
    const md = '# Plan\n\n## Tasks\n\n- [ ] **Parent**\n  - [ ] **Child**';
    const plan = parsePlanFromMarkdown(md, 'p1', 's1');
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0].subtasks).toHaveLength(1);
    expect(plan.tasks[0].subtasks![0].title).toBe('Child');
  });

  it('should preserve planId and sessionId', () => {
    const md = '# Plan\n\n## Tasks';
    const plan = parsePlanFromMarkdown(md, 'my-plan', 'my-session');
    expect(plan.id).toBe('my-plan');
    expect(plan.sessionId).toBe('my-session');
  });

  it('should default to Untitled Plan for missing title', () => {
    const plan = parsePlanFromMarkdown('## Tasks', 'p1', 's1');
    expect(plan.title).toBe('Untitled Plan');
  });
});

// -------------------------------------------------------------------
// PlanModeManager
// -------------------------------------------------------------------
describe('PlanModeManager', () => {
  it('should start not in plan mode', () => {
    const mgr = new PlanModeManager();
    expect(mgr.isInPlanMode()).toBe(false);
  });

  it('should enter plan mode', () => {
    const mgr = new PlanModeManager();
    const result = mgr.enterPlanMode('s1', 'Complex task');
    expect(result.success).toBe(true);
    expect(result.planId).toMatch(/^plan-/);
    expect(mgr.isInPlanMode()).toBe(true);
  });

  it('should reject entering plan mode when already active', () => {
    const mgr = new PlanModeManager();
    mgr.enterPlanMode('s1', 'First');
    const result = mgr.enterPlanMode('s1', 'Second');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Already in plan mode');
  });

  it('should store initial questions', () => {
    const mgr = new PlanModeManager();
    mgr.enterPlanMode('s1', 'Task', ['Q1?', 'Q2?']);
    const state = mgr.getState();
    expect(state.exploration.questions).toEqual(['Q1?', 'Q2?']);
  });

  it('should write plan', () => {
    const mgr = new PlanModeManager();
    mgr.enterPlanMode('s1', 'Complex task');
    const result = mgr.writePlan('Auth Plan', 'Implement auth', [
      { title: 'Setup DB', complexity: 'low' },
      { title: 'Add routes', complexity: 'medium' },
    ]);
    expect(result.success).toBe(true);
    expect(result.planContent).toContain('Auth Plan');
    expect(result.planContent).toContain('Setup DB');
  });

  it('should fail to write plan when not in plan mode', () => {
    const mgr = new PlanModeManager();
    const result = mgr.writePlan('Title', 'Summary', []);
    expect(result.success).toBe(false);
  });

  it('should exit plan mode with approval', () => {
    const mgr = new PlanModeManager();
    mgr.enterPlanMode('s1', 'Task');
    mgr.writePlan('Plan', 'Summary', [{ title: 'T1' }]);
    const result = mgr.exitPlanMode(true);
    expect(result.success).toBe(true);
    expect(result.plan?.status).toBe('awaiting_approval');
    expect(result.message).toContain('AWAITING_USER_APPROVAL');
    expect(mgr.isInPlanMode()).toBe(false);
  });

  it('should stay in plan mode when not ready', () => {
    const mgr = new PlanModeManager();
    mgr.enterPlanMode('s1', 'Task');
    const result = mgr.exitPlanMode(false);
    expect(result.success).toBe(true);
    expect(result.message).toContain('ready_for_approval=true');
  });

  it('should fail exit when not in plan mode', () => {
    const mgr = new PlanModeManager();
    const result = mgr.exitPlanMode(true);
    expect(result.success).toBe(false);
  });

  it('should include questions for user on exit', () => {
    const mgr = new PlanModeManager();
    mgr.enterPlanMode('s1', 'Task');
    mgr.writePlan('Plan', 'Summary', [{ title: 'T1' }]);
    const result = mgr.exitPlanMode(true, ['Which auth provider?']);
    expect(result.message).toContain('Which auth provider?');
  });

  it('should track explored files', () => {
    const mgr = new PlanModeManager();
    mgr.enterPlanMode('s1', 'Task');
    mgr.addExploredFile('/src/auth.ts');
    mgr.addExploredFile('/src/auth.ts'); // duplicate - should not add
    expect(mgr.getState().exploration.filesExplored).toEqual(['/src/auth.ts']);
  });

  it('should track found patterns', () => {
    const mgr = new PlanModeManager();
    mgr.enterPlanMode('s1', 'Task');
    mgr.addFoundPattern('Factory pattern');
    expect(mgr.getState().exploration.patternsFound).toEqual(['Factory pattern']);
  });

  it('should not track when not in plan mode', () => {
    const mgr = new PlanModeManager();
    mgr.addExploredFile('/src/file.ts');
    mgr.addFoundPattern('pattern');
    expect(mgr.getState().exploration.filesExplored).toHaveLength(0);
  });

  it('should get current plan', () => {
    const mgr = new PlanModeManager();
    expect(mgr.getCurrentPlan()).toBeNull();
    mgr.enterPlanMode('s1', 'Task');
    expect(mgr.getCurrentPlan()).not.toBeNull();
  });
});

// -------------------------------------------------------------------
// getPlanModeManager (singleton)
// -------------------------------------------------------------------
describe('getPlanModeManager', () => {
  it('should return same instance', () => {
    const m1 = getPlanModeManager();
    const m2 = getPlanModeManager();
    expect(m1).toBe(m2);
  });
});

// -------------------------------------------------------------------
// getPlanModeTools
// -------------------------------------------------------------------
describe('getPlanModeTools', () => {
  it('should return 3 tools', () => {
    const tools = getPlanModeTools();
    expect(tools).toHaveLength(3);
    expect(tools.map((t) => t.name)).toEqual(['enter_plan_mode', 'write_plan', 'exit_plan_mode']);
  });
});
