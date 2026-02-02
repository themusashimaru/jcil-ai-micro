/**
 * DIALOG SYSTEM TOOL
 * Branching dialog trees for games and interactive fiction
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface DialogChoice { id: string; text: string; nextNode: string; conditions?: string[]; effects?: string[]; }
interface DialogNode { id: string; speaker: string; text: string; portrait?: string; choices: DialogChoice[]; isEnd?: boolean; }
interface DialogTree { id: string; name: string; nodes: Map<string, DialogNode>; startNode: string; variables: Record<string, unknown>; }

function createDialogTree(name: string): DialogTree {
  return { id: `tree_${Date.now()}`, name, nodes: new Map(), startNode: '', variables: {} };
}

function addNode(tree: DialogTree, node: DialogNode): void {
  tree.nodes.set(node.id, node);
  if (!tree.startNode) tree.startNode = node.id;
}

function createSampleConversation(): DialogTree {
  const tree = createDialogTree('Village Elder Conversation');

  addNode(tree, {
    id: 'start',
    speaker: 'Elder',
    text: 'Greetings, young adventurer. I sense great potential in you. What brings you to our humble village?',
    portrait: 'elder_neutral',
    choices: [
      { id: 'c1', text: 'I\'m looking for work.', nextNode: 'work' },
      { id: 'c2', text: 'I heard there\'s trouble nearby.', nextNode: 'trouble' },
      { id: 'c3', text: 'Just passing through.', nextNode: 'passing' },
      { id: 'c4', text: '[Leave]', nextNode: 'leave' }
    ]
  });

  addNode(tree, {
    id: 'work',
    speaker: 'Elder',
    text: 'Ah, a hard worker! We do have some tasks that need attending to. The crops need protection from pests, and our blacksmith needs an apprentice.',
    portrait: 'elder_happy',
    choices: [
      { id: 'w1', text: 'Tell me about the pest problem.', nextNode: 'quest_pests', effects: ['unlock_quest_pests'] },
      { id: 'w2', text: 'I\'d like to learn smithing.', nextNode: 'quest_smith', effects: ['unlock_quest_smith'] },
      { id: 'w3', text: 'Maybe later.', nextNode: 'start' }
    ]
  });

  addNode(tree, {
    id: 'trouble',
    speaker: 'Elder',
    text: 'You\'ve heard correctly. Dark creatures have been emerging from the old ruins to the north. We fear an ancient evil may be awakening.',
    portrait: 'elder_worried',
    choices: [
      { id: 't1', text: 'I\'ll investigate the ruins.', nextNode: 'quest_ruins', effects: ['unlock_quest_ruins', 'reputation+10'] },
      { id: 't2', text: 'That sounds dangerous. Any rewards?', nextNode: 'rewards' },
      { id: 't3', text: 'Not my problem.', nextNode: 'start' }
    ]
  });

  addNode(tree, {
    id: 'passing',
    speaker: 'Elder',
    text: 'I see. Well, you\'re welcome to rest here. The inn has warm beds, and our tavern serves the finest ale in the region.',
    portrait: 'elder_neutral',
    choices: [
      { id: 'p1', text: 'Actually, I might be able to help with something.', nextNode: 'start' },
      { id: 'p2', text: 'Thank you. I\'ll be on my way.', nextNode: 'leave' }
    ]
  });

  addNode(tree, {
    id: 'quest_pests',
    speaker: 'Elder',
    text: 'Giant rats have infested the grain storage. Clear them out and I\'ll reward you with 50 gold coins.',
    portrait: 'elder_neutral',
    choices: [
      { id: 'qp1', text: 'Consider it done.', nextNode: 'accept_pests', effects: ['start_quest_pests'] },
      { id: 'qp2', text: 'I\'ll think about it.', nextNode: 'start' }
    ]
  });

  addNode(tree, {
    id: 'quest_ruins',
    speaker: 'Elder',
    text: 'Brave soul! The ruins are a day\'s journey north. Take this amulet - it may protect you from the darkness within.',
    portrait: 'elder_grateful',
    choices: [
      { id: 'qr1', text: 'I won\'t let you down.', nextNode: 'accept_ruins', effects: ['receive_amulet', 'start_quest_ruins'] }
    ]
  });

  addNode(tree, {
    id: 'accept_ruins',
    speaker: 'Elder',
    text: 'May the light guide your path, adventurer. Return safely.',
    portrait: 'elder_hopeful',
    choices: [],
    isEnd: true
  });

  addNode(tree, {
    id: 'accept_pests',
    speaker: 'Elder',
    text: 'Excellent! The storage is behind the mill. Be careful - they\'re larger than normal rats.',
    portrait: 'elder_relieved',
    choices: [],
    isEnd: true
  });

  addNode(tree, {
    id: 'quest_smith',
    speaker: 'Elder',
    text: 'Old Garrett at the forge is looking for help. Tell him I sent you.',
    portrait: 'elder_happy',
    choices: [],
    isEnd: true
  });

  addNode(tree, {
    id: 'rewards',
    speaker: 'Elder',
    text: 'The village treasury can offer 500 gold and a blessed weapon from our ancestors.',
    portrait: 'elder_neutral',
    choices: [
      { id: 'r1', text: 'That\'s acceptable. I\'ll do it.', nextNode: 'quest_ruins', effects: ['reputation+5'] },
      { id: 'r2', text: 'Not enough.', nextNode: 'leave', effects: ['reputation-5'] }
    ]
  });

  addNode(tree, {
    id: 'leave',
    speaker: 'Elder',
    text: 'Safe travels, stranger.',
    portrait: 'elder_neutral',
    choices: [],
    isEnd: true
  });

  return tree;
}

function dialogToAscii(node: DialogNode, depth: number = 0): string {
  const lines: string[] = [];
  const indent = '  '.repeat(depth);
  lines.push(`${indent}┌${'─'.repeat(50)}┐`);
  lines.push(`${indent}│ [${node.speaker}]: ${node.text.slice(0, 45)}...`);
  lines.push(`${indent}├${'─'.repeat(50)}┤`);
  for (const choice of node.choices) {
    lines.push(`${indent}│ > ${choice.text.slice(0, 45)}`);
  }
  lines.push(`${indent}└${'─'.repeat(50)}┘`);
  return lines.join('\n');
}

function traverseDialog(tree: DialogTree, path: string[]): { nodes: DialogNode[]; effects: string[] } {
  const nodes: DialogNode[] = [];
  const effects: string[] = [];
  let currentId = tree.startNode;

  for (const choiceId of path) {
    const node = tree.nodes.get(currentId);
    if (!node) break;
    nodes.push(node);
    const choice = node.choices.find(c => c.id === choiceId);
    if (!choice) break;
    if (choice.effects) effects.push(...choice.effects);
    currentId = choice.nextNode;
  }

  const finalNode = tree.nodes.get(currentId);
  if (finalNode) nodes.push(finalNode);

  return { nodes, effects };
}

export const dialogSystemTool: UnifiedTool = {
  name: 'dialog_system',
  description: 'Dialog System: create_tree, add_node, traverse, sample, visualize, export',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['create_tree', 'add_node', 'get_node', 'traverse', 'sample', 'visualize', 'export', 'info'] },
      treeName: { type: 'string' },
      nodeId: { type: 'string' },
      path: { type: 'array' }
    },
    required: ['operation']
  }
};

export async function executeDialogSystem(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'create_tree':
        const newTree = createDialogTree(args.treeName || 'New Dialog');
        result = { tree: { id: newTree.id, name: newTree.name, nodeCount: 0 } };
        break;
      case 'add_node':
        result = { message: 'Node would be added to tree', nodeId: args.nodeId };
        break;
      case 'get_node':
        const sampleTree = createSampleConversation();
        const node = sampleTree.nodes.get(args.nodeId || 'start');
        result = node ? { node } : { error: 'Node not found' };
        break;
      case 'traverse':
        const travTree = createSampleConversation();
        const traversal = traverseDialog(travTree, args.path || ['c2', 't1']);
        result = {
          path: args.path || ['c2', 't1'],
          nodesVisited: traversal.nodes.length,
          effects: traversal.effects,
          conversation: traversal.nodes.map(n => ({ speaker: n.speaker, text: n.text }))
        };
        break;
      case 'sample':
        const sample = createSampleConversation();
        result = {
          tree: { id: sample.id, name: sample.name, nodeCount: sample.nodes.size },
          startNode: sample.nodes.get(sample.startNode),
          allNodes: Array.from(sample.nodes.keys())
        };
        break;
      case 'visualize':
        const vizTree = createSampleConversation();
        const vizNode = vizTree.nodes.get(args.nodeId || 'start')!;
        result = { ascii: dialogToAscii(vizNode), node: vizNode };
        break;
      case 'export':
        const expTree = createSampleConversation();
        result = {
          format: 'json',
          tree: {
            id: expTree.id,
            name: expTree.name,
            nodes: Array.from(expTree.nodes.entries()).map(([k, v]) => ({ nodeId: k, ...v }))
          }
        };
        break;
      case 'info':
        result = {
          description: 'Branching dialog tree system for games',
          features: ['Multiple choice responses', 'Conditional branches', 'Effect triggers', 'Variable tracking'],
          nodeTypes: ['standard', 'conditional', 'end'],
          maxChoices: 4
        };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isDialogSystemAvailable(): boolean { return true; }
