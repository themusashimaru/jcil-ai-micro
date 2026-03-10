import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  PlanManager,
  DEFAULT_PLAN_SETTINGS,
  getPlanTools,
  executePlanTool,
  isPlanTool,
  getPlanManager,
  clearPlanManager,
} from './plan-mode';

describe('PlanManager', () => {
  let manager: PlanManager;

  beforeEach(() => {
    manager = new PlanManager();
    clearPlanManager();
  });

  describe('createPlan', () => {
    it('should create a plan with steps', () => {
      const plan = manager.createPlan('Build a feature', [
        { title: 'Step 1', description: 'First step' },
        { title: 'Step 2', description: 'Second step' },
      ]);

      expect(plan.id).toBeTruthy();
      expect(plan.steps).toHaveLength(2);
      expect(plan.status).toBe('draft');
    });

    it('should assign step IDs and numbers', () => {
      const plan = manager.createPlan('Test', [
        { title: 'Step 1', description: 'First' },
        { title: 'Step 2', description: 'Second' },
      ]);

      expect(plan.steps[0].number).toBe(1);
      expect(plan.steps[1].number).toBe(2);
      expect(plan.steps[0].id).toContain('step_1');
      expect(plan.steps[1].id).toContain('step_2');
    });

    it('should set initial step status to pending', () => {
      const plan = manager.createPlan('Test', [{ title: 'Step 1', description: 'First' }]);

      expect(plan.steps[0].status).toBe('pending');
    });

    it('should calculate complexity based on step count', () => {
      const lowPlan = manager.createPlan('Low', [
        { title: 'Step 1', description: 'First' },
        { title: 'Step 2', description: 'Second' },
      ]);
      expect(lowPlan.estimatedComplexity).toBe('low');

      clearPlanManager();
      const mediumManager = new PlanManager();
      const mediumPlan = mediumManager.createPlan(
        'Medium',
        Array(5)
          .fill(null)
          .map((_, i) => ({ title: `Step ${i}`, description: `Step ${i}` }))
      );
      expect(mediumPlan.estimatedComplexity).toBe('medium');

      const highManager = new PlanManager();
      const highPlan = highManager.createPlan(
        'High',
        Array(10)
          .fill(null)
          .map((_, i) => ({ title: `Step ${i}`, description: `Step ${i}` }))
      );
      expect(highPlan.estimatedComplexity).toBe('high');
    });
  });

  describe('approvePlan', () => {
    it('should approve a draft plan', () => {
      manager.createPlan('Test', [{ title: 'Step 1', description: 'First' }]);

      const result = manager.approvePlan();

      expect(result).toBe(true);
      expect(manager.getCurrentPlan()?.status).toBe('approved');
    });

    it('should return false if no plan exists', () => {
      const result = manager.approvePlan();
      expect(result).toBe(false);
    });

    it('should return false if plan is not in draft status', () => {
      manager.createPlan('Test', [{ title: 'Step 1', description: 'First' }]);
      manager.approvePlan();
      manager.startPlan();

      const result = manager.approvePlan();
      expect(result).toBe(false);
    });
  });

  describe('startPlan', () => {
    it('should start an approved plan', () => {
      manager.createPlan('Test', [{ title: 'Step 1', description: 'First' }]);
      manager.approvePlan();

      const result = manager.startPlan();

      expect(result).toBe(true);
      expect(manager.getCurrentPlan()?.status).toBe('in_progress');
      expect(manager.getCurrentPlan()?.steps[0].status).toBe('in_progress');
    });

    it('should return false if plan is not approved', () => {
      manager.createPlan('Test', [{ title: 'Step 1', description: 'First' }]);

      const result = manager.startPlan();
      expect(result).toBe(false);
    });
  });

  describe('completeCurrentStep', () => {
    it('should complete the current step', () => {
      manager.createPlan('Test', [
        { title: 'Step 1', description: 'First' },
        { title: 'Step 2', description: 'Second' },
      ]);
      manager.approvePlan();
      manager.startPlan();

      const completed = manager.completeCurrentStep('Done!');

      expect(completed?.status).toBe('completed');
      expect(completed?.output).toBe('Done!');
      expect(manager.getCurrentStep()?.number).toBe(2);
    });

    it('should complete the plan when all steps are done', () => {
      manager.createPlan('Test', [{ title: 'Step 1', description: 'First' }]);
      manager.approvePlan();
      manager.startPlan();

      manager.completeCurrentStep();

      expect(manager.getCurrentPlan()?.status).toBe('completed');
    });
  });

  describe('skipCurrentStep', () => {
    it('should skip the current step', () => {
      manager.createPlan('Test', [
        { title: 'Step 1', description: 'First' },
        { title: 'Step 2', description: 'Second' },
      ]);
      manager.approvePlan();
      manager.startPlan();

      const skipped = manager.skipCurrentStep('Not needed');

      expect(skipped?.status).toBe('skipped');
      expect(skipped?.reason).toBe('Not needed');
    });
  });

  describe('failCurrentStep', () => {
    it('should mark current step as failed', () => {
      manager.createPlan('Test', [{ title: 'Step 1', description: 'First' }]);
      manager.approvePlan();
      manager.startPlan();

      const failed = manager.failCurrentStep('Error occurred');

      expect(failed?.status).toBe('failed');
      expect(failed?.reason).toBe('Error occurred');
    });
  });

  describe('cancelPlan', () => {
    it('should cancel the current plan', () => {
      manager.createPlan('Test', [{ title: 'Step 1', description: 'First' }]);

      const result = manager.cancelPlan();

      expect(result).toBe(true);
      expect(manager.getCurrentPlan()?.status).toBe('cancelled');
    });
  });

  describe('getProgress', () => {
    it('should calculate progress percentage', () => {
      manager.createPlan('Test', [
        { title: 'Step 1', description: 'First' },
        { title: 'Step 2', description: 'Second' },
        { title: 'Step 3', description: 'Third' },
      ]);
      manager.approvePlan();
      manager.startPlan();
      manager.completeCurrentStep();

      const progress = manager.getProgress();

      expect(progress).toBe(33); // 1/3 = 33%
    });

    it('should return 0 when no plan exists', () => {
      expect(manager.getProgress()).toBe(0);
    });
  });

  describe('needsApproval', () => {
    it('should return true for draft plans', () => {
      manager.createPlan('Test', [{ title: 'Step 1', description: 'First' }]);

      expect(manager.needsApproval()).toBe(true);
    });

    it('should return false with autoAccept enabled', () => {
      manager = new PlanManager({ autoAccept: true });
      manager.createPlan('Test', [{ title: 'Step 1', description: 'First' }]);

      expect(manager.needsApproval()).toBe(false);
    });
  });

  describe('callbacks', () => {
    it('should call onPlanUpdate when plan changes', () => {
      const onPlanUpdate = vi.fn();
      manager = new PlanManager({}, { onPlanUpdate });

      manager.createPlan('Test', [{ title: 'Step 1', description: 'First' }]);

      expect(onPlanUpdate).toHaveBeenCalled();
    });

    it('should call onStepComplete when step is completed', () => {
      const onStepComplete = vi.fn();
      manager = new PlanManager({}, { onStepComplete });

      manager.createPlan('Test', [{ title: 'Step 1', description: 'First' }]);
      manager.approvePlan();
      manager.startPlan();
      manager.completeCurrentStep();

      expect(onStepComplete).toHaveBeenCalled();
    });
  });
});

describe('Plan Tools', () => {
  describe('getPlanTools', () => {
    it('should return array of plan tools', () => {
      const tools = getPlanTools();

      expect(tools).toBeInstanceOf(Array);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should include required tools', () => {
      const tools = getPlanTools();
      const toolNames = tools.map((t) => t.name);

      expect(toolNames).toContain('plan_create');
      expect(toolNames).toContain('plan_status');
      expect(toolNames).toContain('plan_approve');
      expect(toolNames).toContain('plan_complete_step');
      expect(toolNames).toContain('plan_skip_step');
      expect(toolNames).toContain('plan_cancel');
    });
  });

  describe('executePlanTool', () => {
    let manager: PlanManager;

    beforeEach(() => {
      manager = new PlanManager();
    });

    it('should execute plan_create', () => {
      const result = executePlanTool(
        'plan_create',
        {
          request: 'Build feature',
          steps: [{ title: 'Step 1', description: 'First step' }],
        },
        manager
      );

      expect(result).toContain('Plan created');
    });

    it('should execute plan_status', () => {
      manager.createPlan('Test', [{ title: 'Step 1', description: 'First' }]);

      const result = executePlanTool('plan_status', {}, manager);

      expect(result).toContain('Plan:');
      expect(result).toContain('Status:');
    });

    it('should execute plan_approve', () => {
      manager.createPlan('Test', [{ title: 'Step 1', description: 'First' }]);

      const result = executePlanTool('plan_approve', {}, manager);

      expect(result).toContain('approved');
    });

    it('should handle unknown tools', () => {
      const result = executePlanTool('plan_unknown', {}, manager);

      expect(result).toContain('Unknown');
    });
  });

  describe('isPlanTool', () => {
    it('should return true for plan tools', () => {
      expect(isPlanTool('plan_create')).toBe(true);
      expect(isPlanTool('plan_status')).toBe(true);
    });

    it('should return false for non-plan tools', () => {
      expect(isPlanTool('execute_shell')).toBe(false);
      expect(isPlanTool('read_file')).toBe(false);
    });
  });
});

describe('getPlanManager singleton', () => {
  beforeEach(() => {
    clearPlanManager();
  });

  it('should return same instance', () => {
    const manager1 = getPlanManager();
    const manager2 = getPlanManager();

    expect(manager1).toBe(manager2);
  });

  it('should create new instance after clear', () => {
    const manager1 = getPlanManager();
    clearPlanManager();
    const manager2 = getPlanManager();

    expect(manager1).not.toBe(manager2);
  });
});

describe('DEFAULT_PLAN_SETTINGS', () => {
  it('should have expected defaults', () => {
    expect(DEFAULT_PLAN_SETTINGS.enabled).toBe(false);
    expect(DEFAULT_PLAN_SETTINGS.autoAccept).toBe(false);
    expect(DEFAULT_PLAN_SETTINGS.showDetails).toBe(true);
    expect(DEFAULT_PLAN_SETTINGS.requireApprovalForHigh).toBe(true);
  });
});
