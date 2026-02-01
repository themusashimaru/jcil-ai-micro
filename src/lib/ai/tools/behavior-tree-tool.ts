/**
 * BEHAVIOR TREE TOOL
 * AI behavior trees: sequences, selectors, decorators, leaves
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

type NodeStatus = 'success' | 'failure' | 'running';

interface BTNode {
  type: string;
  name: string;
  children?: BTNode[];
  condition?: string;
  action?: string;
  params?: Record<string, unknown>;
}

interface ExecutionContext {
  blackboard: Record<string, unknown>;
  log: string[];
}

// Node execution simulation
function executeNode(node: BTNode, ctx: ExecutionContext, depth: number = 0): NodeStatus {
  const indent = '  '.repeat(depth);
  ctx.log.push(`${indent}Executing: ${node.name} (${node.type})`);

  switch (node.type) {
    case 'sequence':
      // Run children in order, fail if any fails
      for (const child of node.children || []) {
        const status = executeNode(child, ctx, depth + 1);
        if (status !== 'success') {
          ctx.log.push(`${indent}Sequence failed at: ${child.name}`);
          return status;
        }
      }
      ctx.log.push(`${indent}Sequence completed successfully`);
      return 'success';

    case 'selector':
      // Run children until one succeeds
      for (const child of node.children || []) {
        const status = executeNode(child, ctx, depth + 1);
        if (status === 'success') {
          ctx.log.push(`${indent}Selector succeeded with: ${child.name}`);
          return 'success';
        }
      }
      ctx.log.push(`${indent}Selector: all children failed`);
      return 'failure';

    case 'parallel':
      // Run all children, policy determines success/failure
      const results = (node.children || []).map(child => executeNode(child, ctx, depth + 1));
      const successCount = results.filter(r => r === 'success').length;
      const policy = node.params?.policy || 'all';
      if (policy === 'all') return results.every(r => r === 'success') ? 'success' : 'failure';
      if (policy === 'any') return results.some(r => r === 'success') ? 'success' : 'failure';
      return successCount >= (typeof node.params?.threshold === 'number' ? node.params.threshold : 1) ? 'success' : 'failure';

    case 'inverter':
      const childStatus = executeNode(node.children?.[0] || { type: 'action', name: 'noop' }, ctx, depth + 1);
      return childStatus === 'success' ? 'failure' : childStatus === 'failure' ? 'success' : 'running';

    case 'succeeder':
      executeNode(node.children?.[0] || { type: 'action', name: 'noop' }, ctx, depth + 1);
      return 'success';

    case 'repeater':
      const times = typeof node.params?.times === 'number' ? node.params.times : 3;
      for (let i = 0; i < times; i++) {
        const status = executeNode(node.children?.[0] || { type: 'action', name: 'noop' }, ctx, depth + 1);
        if (status === 'failure') return 'failure';
      }
      return 'success';

    case 'condition':
      // Simulate condition check
      const condValue = ctx.blackboard[node.condition || ''] ?? Math.random() > 0.5;
      ctx.log.push(`${indent}Condition ${node.condition}: ${condValue}`);
      return condValue ? 'success' : 'failure';

    case 'action':
      // Simulate action execution
      ctx.log.push(`${indent}Action: ${node.action || node.name}`);
      const successRate = typeof node.params?.successRate === 'number' ? node.params.successRate : 0.8;
      return Math.random() < successRate ? 'success' : 'failure';

    case 'wait':
      ctx.log.push(`${indent}Waiting: ${node.params?.duration || 1}s`);
      return 'success';

    default:
      return 'failure';
  }
}

// Generate behavior tree code
function generateCode(tree: BTNode, language: string = 'typescript'): string {
  if (language === 'typescript') {
    function nodeToCode(node: BTNode, depth: number = 0): string {
      const indent = '  '.repeat(depth);
      switch (node.type) {
        case 'sequence':
          return `${indent}new Sequence("${node.name}", [\n${(node.children || []).map(c => nodeToCode(c, depth + 1)).join(',\n')}\n${indent}])`;
        case 'selector':
          return `${indent}new Selector("${node.name}", [\n${(node.children || []).map(c => nodeToCode(c, depth + 1)).join(',\n')}\n${indent}])`;
        case 'condition':
          return `${indent}new Condition("${node.name}", () => ${node.condition || 'true'})`;
        case 'action':
          return `${indent}new Action("${node.name}", async () => { /* ${node.action || 'execute'} */ return SUCCESS; })`;
        case 'inverter':
          return `${indent}new Inverter("${node.name}",\n${nodeToCode(node.children?.[0] || { type: 'action', name: 'noop' }, depth + 1)}\n${indent})`;
        default:
          return `${indent}new Node("${node.name}")`;
      }
    }
    return `// Behavior Tree Implementation
const tree = ${nodeToCode(tree)};

// Execute
const context = { blackboard: {} };
const status = tree.tick(context);`;
  }
  return '// Language not supported';
}

// Pre-built behavior tree templates
const TEMPLATES: Record<string, BTNode> = {
  guard: {
    type: 'selector',
    name: 'GuardBehavior',
    children: [
      {
        type: 'sequence',
        name: 'AttackIntruder',
        children: [
          { type: 'condition', name: 'SeeEnemy', condition: 'hasVisibleEnemy' },
          { type: 'condition', name: 'InRange', condition: 'enemyInAttackRange' },
          { type: 'action', name: 'Attack', action: 'attackEnemy' }
        ]
      },
      {
        type: 'sequence',
        name: 'ChaseIntruder',
        children: [
          { type: 'condition', name: 'SeeEnemy', condition: 'hasVisibleEnemy' },
          { type: 'action', name: 'Chase', action: 'moveToEnemy' }
        ]
      },
      {
        type: 'sequence',
        name: 'Patrol',
        children: [
          { type: 'action', name: 'GetNextWaypoint', action: 'getNextPatrolPoint' },
          { type: 'action', name: 'MoveTo', action: 'moveToWaypoint' },
          { type: 'wait', name: 'Wait', params: { duration: 2 } }
        ]
      }
    ]
  },
  zombie: {
    type: 'selector',
    name: 'ZombieBehavior',
    children: [
      {
        type: 'sequence',
        name: 'EatBrain',
        children: [
          { type: 'condition', name: 'NearHuman', condition: 'humanInRange' },
          { type: 'action', name: 'Bite', action: 'biteHuman' }
        ]
      },
      {
        type: 'sequence',
        name: 'HuntHuman',
        children: [
          { type: 'condition', name: 'SeeHuman', condition: 'hasVisibleHuman' },
          { type: 'action', name: 'Shamble', action: 'moveToHuman' }
        ]
      },
      { type: 'action', name: 'Wander', action: 'randomWalk' }
    ]
  },
  npc: {
    type: 'selector',
    name: 'NPCBehavior',
    children: [
      {
        type: 'sequence',
        name: 'Conversation',
        children: [
          { type: 'condition', name: 'PlayerNearby', condition: 'playerInTalkRange' },
          { type: 'condition', name: 'PlayerTalking', condition: 'playerInitiatedDialog' },
          { type: 'action', name: 'Face', action: 'facePlayer' },
          { type: 'action', name: 'Talk', action: 'startDialog' }
        ]
      },
      {
        type: 'sequence',
        name: 'Work',
        children: [
          { type: 'condition', name: 'DayTime', condition: 'isDaytime' },
          { type: 'action', name: 'GoToWork', action: 'moveToWorkplace' },
          { type: 'action', name: 'DoJob', action: 'performWork' }
        ]
      },
      {
        type: 'sequence',
        name: 'Sleep',
        children: [
          { type: 'condition', name: 'NightTime', condition: 'isNighttime' },
          { type: 'action', name: 'GoHome', action: 'moveToHome' },
          { type: 'action', name: 'Sleep', action: 'sleep' }
        ]
      }
    ]
  }
};

export const behaviorTreeTool: UnifiedTool = {
  name: 'behavior_tree',
  description: 'Behavior Tree: create, execute, templates, code, validate',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['create', 'execute', 'templates', 'code', 'validate', 'visualize'] },
      tree: { type: 'object' },
      template: { type: 'string' },
      blackboard: { type: 'object' },
      language: { type: 'string' }
    },
    required: ['operation']
  }
};

export async function executeBehaviorTree(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const tree: BTNode = args.tree || (args.template ? TEMPLATES[args.template] : TEMPLATES.guard);
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'create':
        result = { tree, nodeTypes: ['sequence', 'selector', 'parallel', 'inverter', 'succeeder', 'repeater', 'condition', 'action', 'wait'] };
        break;
      case 'execute':
        const ctx: ExecutionContext = { blackboard: args.blackboard || {}, log: [] };
        const status = executeNode(tree, ctx);
        result = { status, log: ctx.log, blackboard: ctx.blackboard };
        break;
      case 'templates':
        result = { templates: Object.keys(TEMPLATES), descriptions: {
          guard: 'Guard NPC that patrols, chases, and attacks',
          zombie: 'Zombie that hunts humans or wanders',
          npc: 'Town NPC with work/sleep schedule and dialog'
        }};
        break;
      case 'code':
        result = { code: generateCode(tree, args.language || 'typescript') };
        break;
      case 'validate':
        const validate = (node: BTNode): string[] => {
          const errors: string[] = [];
          if (!node.type) errors.push(`Node ${node.name || 'unknown'} missing type`);
          if (['sequence', 'selector', 'parallel'].includes(node.type) && (!node.children || node.children.length === 0)) {
            errors.push(`${node.type} node "${node.name}" has no children`);
          }
          (node.children || []).forEach(child => errors.push(...validate(child)));
          return errors;
        };
        const errors = validate(tree);
        result = { valid: errors.length === 0, errors };
        break;
      case 'visualize':
        const visualize = (node: BTNode, depth: number = 0): string => {
          const indent = '│ '.repeat(depth);
          const prefix = depth === 0 ? '' : '├─';
          let symbol = '';
          switch (node.type) {
            case 'sequence': symbol = '→'; break;
            case 'selector': symbol = '?'; break;
            case 'parallel': symbol = '⇉'; break;
            case 'condition': symbol = '◇'; break;
            case 'action': symbol = '■'; break;
            case 'inverter': symbol = '!'; break;
            default: symbol = '○';
          }
          const lines = [`${indent}${prefix}${symbol} ${node.name}`];
          (node.children || []).forEach(child => lines.push(visualize(child, depth + 1)));
          return lines.join('\n');
        };
        result = { visualization: visualize(tree) };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isBehaviorTreeAvailable(): boolean { return true; }
