/**
 * DIALOGUE TREE TOOL
 * Create dialogue trees for games, chatbots, interactive fiction
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface DialogueNode {
  id: string;
  speaker: string;
  text: string;
  emotion?: string;
  choices?: DialogueChoice[];
  next?: string;
  conditions?: string[];
  effects?: string[];
}

interface DialogueChoice {
  text: string;
  next: string;
  requirements?: string[];
  consequences?: string[];
}

interface DialogueTree {
  id: string;
  title: string;
  participants: string[];
  nodes: Record<string, DialogueNode>;
  startNode: string;
  variables: Record<string, unknown>;
}

const EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'fearful', 'disgusted', 'curious', 'excited', 'worried'];
const NPC_NAMES = ['Elder Marcus', 'Captain Sarah', 'Merchant Tomas', 'Scholar Elena', 'Guard Viktor', 'Priestess Lyra', 'Blacksmith Bjorn', 'Thief Shadow'];

function generateNodeId(): string {
  return 'node_' + Math.random().toString(36).substr(2, 9);
}

function generateDialogueNode(speaker: string, depth: number = 0, maxDepth: number = 3): DialogueNode {
  const nodeId = generateNodeId();
  const emotion = EMOTIONS[Math.floor(Math.random() * EMOTIONS.length)];

  const greetings = ['Greetings, traveler.', 'What brings you here?', 'Ah, I\'ve been expecting you.', 'Welcome, friend.', 'You look like you could use some help.'];
  const responses = ['I see. Tell me more.', 'Interesting...', 'That\'s quite a tale.', 'I understand.', 'Go on...'];
  const farewells = ['Safe travels, friend.', 'Until we meet again.', 'May fortune favor you.', 'Farewell.', 'Good luck on your journey.'];

  const isStart = depth === 0;
  const isEnd = depth >= maxDepth;

  const textPool = isStart ? greetings : isEnd ? farewells : responses;
  const text = textPool[Math.floor(Math.random() * textPool.length)];

  const node: DialogueNode = {
    id: nodeId,
    speaker,
    text,
    emotion
  };

  if (!isEnd) {
    const choiceCount = Math.floor(Math.random() * 3) + 1;
    node.choices = [];

    const choiceTexts = [
      'Tell me more about yourself.',
      'What do you know about the area?',
      'Do you have any quests for me?',
      'I\'m looking for information.',
      'Can you help me with something?',
      'I should go now.',
      'What\'s happening in town?',
      'Any news of interest?'
    ];

    for (let i = 0; i < choiceCount; i++) {
      node.choices.push({
        text: choiceTexts[Math.floor(Math.random() * choiceTexts.length)],
        next: generateNodeId(),
        requirements: Math.random() > 0.7 ? ['hasItem:gold', 'reputation:friendly'] : undefined,
        consequences: Math.random() > 0.7 ? ['reputation:+5', 'unlock:quest_01'] : undefined
      });
    }
  }

  return node;
}

function generateDialogueTree(title: string, npcName: string, depth: number = 3): DialogueTree {
  const tree: DialogueTree = {
    id: 'dialogue_' + Math.random().toString(36).substr(2, 9),
    title,
    participants: ['Player', npcName],
    nodes: {},
    startNode: '',
    variables: { reputation: 0, questProgress: 0 }
  };

  function buildTree(speaker: string, currentDepth: number, parentChoices?: DialogueChoice[]): void {
    if (currentDepth > depth) return;

    const nodesToCreate = parentChoices || [{ text: '', next: '' }];

    for (const choice of nodesToCreate) {
      const node = generateDialogueNode(speaker, currentDepth, depth);

      if (currentDepth === 0) {
        tree.startNode = node.id;
      } else {
        choice.next = node.id;
      }

      tree.nodes[node.id] = node;

      if (node.choices) {
        const nextSpeaker = speaker === 'Player' ? npcName : 'Player';
        buildTree(nextSpeaker, currentDepth + 1, node.choices);
      }
    }
  }

  buildTree(npcName, 0);
  return tree;
}

function validateDialogueTree(tree: DialogueTree): Record<string, unknown> {
  const issues: string[] = [];
  const orphanNodes: string[] = [];
  const deadEnds: string[] = [];
  const referencedNodes = new Set<string>([tree.startNode]);

  // Find all referenced nodes
  for (const node of Object.values(tree.nodes)) {
    if (node.choices) {
      for (const choice of node.choices) {
        referencedNodes.add(choice.next);
      }
    }
    if (node.next) {
      referencedNodes.add(node.next);
    }
  }

  // Check for issues
  for (const [nodeId, node] of Object.entries(tree.nodes)) {
    if (!referencedNodes.has(nodeId) && nodeId !== tree.startNode) {
      orphanNodes.push(nodeId);
    }
    if (!node.choices && !node.next) {
      deadEnds.push(nodeId);
    }
    if (node.choices) {
      for (const choice of node.choices) {
        if (!tree.nodes[choice.next]) {
          issues.push(`Node ${nodeId} has choice pointing to non-existent node ${choice.next}`);
        }
      }
    }
  }

  return {
    valid: issues.length === 0,
    nodeCount: Object.keys(tree.nodes).length,
    orphanNodes,
    deadEnds,
    issues,
    participants: tree.participants
  };
}

function exportToFormat(tree: DialogueTree, format: string): string {
  switch (format) {
    case 'json':
      return JSON.stringify(tree, null, 2);
    case 'yarn':
      let yarn = '';
      for (const node of Object.values(tree.nodes)) {
        yarn += `title: ${node.id}\n`;
        yarn += `---\n`;
        yarn += `${node.speaker}: ${node.text}\n`;
        if (node.choices) {
          for (const choice of node.choices) {
            yarn += `-> ${choice.text}\n`;
            yarn += `    <<jump ${choice.next}>>\n`;
          }
        }
        yarn += `===\n\n`;
      }
      return yarn;
    case 'ink':
      let ink = `// ${tree.title}\n\n`;
      ink += `-> ${tree.startNode}\n\n`;
      for (const node of Object.values(tree.nodes)) {
        ink += `=== ${node.id} ===\n`;
        ink += `${node.speaker}: "${node.text}"\n`;
        if (node.choices) {
          for (const choice of node.choices) {
            ink += `* [${choice.text}] -> ${choice.next}\n`;
          }
        } else {
          ink += `-> END\n`;
        }
        ink += '\n';
      }
      return ink;
    default:
      return JSON.stringify(tree, null, 2);
  }
}

function analyzeDialogue(tree: DialogueTree): Record<string, unknown> {
  const speakerLines: Record<string, number> = {};
  let totalWords = 0;
  let maxDepth = 0;

  function traverse(nodeId: string, depth: number): void {
    const node = tree.nodes[nodeId];
    if (!node) return;

    maxDepth = Math.max(maxDepth, depth);
    speakerLines[node.speaker] = (speakerLines[node.speaker] || 0) + 1;
    totalWords += node.text.split(' ').length;

    if (node.choices) {
      for (const choice of node.choices) {
        traverse(choice.next, depth + 1);
      }
    }
  }

  traverse(tree.startNode, 0);

  const avgChoices = Object.values(tree.nodes)
    .filter(n => n.choices)
    .reduce((sum, n) => sum + (n.choices?.length || 0), 0) / Object.keys(tree.nodes).length;

  return {
    title: tree.title,
    nodeCount: Object.keys(tree.nodes).length,
    maxDepth,
    totalWords,
    avgWordsPerNode: (totalWords / Object.keys(tree.nodes).length).toFixed(1),
    avgChoicesPerNode: avgChoices.toFixed(1),
    speakerDistribution: speakerLines,
    hasConditionals: Object.values(tree.nodes).some(n => n.choices?.some(c => c.requirements)),
    hasConsequences: Object.values(tree.nodes).some(n => n.choices?.some(c => c.consequences))
  };
}

export const dialogueTreeTool: UnifiedTool = {
  name: 'dialogue_tree',
  description: 'Dialogue Tree: generate, validate, export, analyze, templates',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['generate', 'validate', 'export', 'analyze', 'templates'] },
      title: { type: 'string' },
      npcName: { type: 'string' },
      depth: { type: 'number' },
      format: { type: 'string' },
      tree: { type: 'object' }
    },
    required: ['operation']
  }
};

export async function executeDialogueTree(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'generate':
        const title = args.title || 'Village Encounter';
        const npcName = args.npcName || NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)];
        const tree = generateDialogueTree(title, npcName, args.depth || 3);
        result = { tree, analysis: analyzeDialogue(tree) };
        break;
      case 'validate':
        const validateTree = args.tree || generateDialogueTree('Test', 'NPC', 2);
        result = validateDialogueTree(validateTree);
        break;
      case 'export':
        const exportTree = args.tree || generateDialogueTree('Export Test', 'NPC', 2);
        const format = args.format || 'json';
        result = { format, output: exportToFormat(exportTree, format) };
        break;
      case 'analyze':
        const analyzeTree = args.tree || generateDialogueTree('Analysis', 'NPC', 3);
        result = analyzeDialogue(analyzeTree);
        break;
      case 'templates':
        result = {
          templates: [
            { name: 'Quest Giver', description: 'NPC that gives and tracks quests' },
            { name: 'Merchant', description: 'Trading and haggling dialogue' },
            { name: 'Information', description: 'Lore and world-building exposition' },
            { name: 'Companion', description: 'Party member interactions' },
            { name: 'Antagonist', description: 'Villain confrontation dialogue' }
          ],
          exportFormats: ['json', 'yarn', 'ink'],
          availableNPCs: NPC_NAMES,
          emotions: EMOTIONS
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

export function isDialogueTreeAvailable(): boolean { return true; }
