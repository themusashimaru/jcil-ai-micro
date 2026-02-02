/**
 * QUEST SYSTEM TOOL
 * Quest management, objectives, and progression tracking
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface QuestObjective { id: string; description: string; type: 'kill' | 'collect' | 'talk' | 'explore' | 'escort' | 'craft'; target: string; current: number; required: number; optional?: boolean; }
interface QuestReward { type: 'gold' | 'item' | 'experience' | 'reputation' | 'unlock'; value: number | string; }
interface Quest { id: string; name: string; description: string; type: 'main' | 'side' | 'daily' | 'event'; status: 'locked' | 'available' | 'active' | 'completed' | 'failed'; level: number; objectives: QuestObjective[]; rewards: QuestReward[]; prerequisites?: string[]; timeLimit?: number; }

const QUEST_DATABASE: Quest[] = [
  {
    id: 'main_001',
    name: 'The Awakening',
    description: 'Begin your journey as a hero. Speak with the Village Elder to learn about the darkness threatening the land.',
    type: 'main',
    status: 'active',
    level: 1,
    objectives: [
      { id: 'obj1', description: 'Speak with the Village Elder', type: 'talk', target: 'elder', current: 0, required: 1 },
      { id: 'obj2', description: 'Obtain a weapon from the blacksmith', type: 'collect', target: 'weapon_basic', current: 0, required: 1 }
    ],
    rewards: [
      { type: 'experience', value: 100 },
      { type: 'gold', value: 50 }
    ]
  },
  {
    id: 'main_002',
    name: 'Into the Ruins',
    description: 'Investigate the ancient ruins to the north where dark creatures have been emerging.',
    type: 'main',
    status: 'locked',
    level: 5,
    objectives: [
      { id: 'obj1', description: 'Travel to the Ancient Ruins', type: 'explore', target: 'ruins_entrance', current: 0, required: 1 },
      { id: 'obj2', description: 'Defeat Shadow Creatures', type: 'kill', target: 'shadow_creature', current: 0, required: 10 },
      { id: 'obj3', description: 'Find the source of darkness', type: 'explore', target: 'ruins_core', current: 0, required: 1 }
    ],
    rewards: [
      { type: 'experience', value: 500 },
      { type: 'gold', value: 200 },
      { type: 'item', value: 'sword_shadow' }
    ],
    prerequisites: ['main_001']
  },
  {
    id: 'side_001',
    name: 'Pest Control',
    description: 'The village grain storage is infested with giant rats. Clear them out before the harvest is ruined.',
    type: 'side',
    status: 'available',
    level: 2,
    objectives: [
      { id: 'obj1', description: 'Kill Giant Rats', type: 'kill', target: 'giant_rat', current: 3, required: 10 },
      { id: 'obj2', description: 'Report to the Elder', type: 'talk', target: 'elder', current: 0, required: 1, optional: false }
    ],
    rewards: [
      { type: 'gold', value: 50 },
      { type: 'reputation', value: 10 }
    ]
  },
  {
    id: 'side_002',
    name: 'Herbs for the Healer',
    description: 'Collect medicinal herbs from the forest for the village healer.',
    type: 'side',
    status: 'available',
    level: 3,
    objectives: [
      { id: 'obj1', description: 'Collect Moonpetal Flowers', type: 'collect', target: 'moonpetal', current: 0, required: 5 },
      { id: 'obj2', description: 'Collect Silverleaf', type: 'collect', target: 'silverleaf', current: 0, required: 3 }
    ],
    rewards: [
      { type: 'item', value: 'potion_health_large' },
      { type: 'experience', value: 75 }
    ]
  },
  {
    id: 'daily_001',
    name: 'Daily Hunt',
    description: 'Hunt wildlife for the village. Resets daily.',
    type: 'daily',
    status: 'available',
    level: 1,
    objectives: [
      { id: 'obj1', description: 'Hunt Deer', type: 'kill', target: 'deer', current: 0, required: 3 }
    ],
    rewards: [
      { type: 'gold', value: 25 },
      { type: 'reputation', value: 5 }
    ],
    timeLimit: 86400000
  }
];

function getQuestProgress(quest: Quest): number {
  const totalRequired = quest.objectives.reduce((sum, obj) => sum + obj.required, 0);
  const totalCurrent = quest.objectives.reduce((sum, obj) => sum + Math.min(obj.current, obj.required), 0);
  return totalRequired > 0 ? (totalCurrent / totalRequired) * 100 : 0;
}

function updateObjective(quest: Quest, objectiveId: string, amount: number): { updated: boolean; completed: boolean } {
  const objective = quest.objectives.find(o => o.id === objectiveId);
  if (!objective) return { updated: false, completed: false };

  objective.current = Math.min(objective.current + amount, objective.required);

  const allComplete = quest.objectives.filter(o => !o.optional).every(o => o.current >= o.required);
  if (allComplete) quest.status = 'completed';

  return { updated: true, completed: allComplete };
}

function questToAscii(quest: Quest): string {
  const lines: string[] = [];
  const progress = getQuestProgress(quest);
  const progressBar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));

  lines.push(`╔${'═'.repeat(50)}╗`);
  lines.push(`║ ${quest.name.padEnd(48)} ║`);
  lines.push(`║ [${quest.type.toUpperCase()}] Level ${quest.level} - ${quest.status.toUpperCase().padEnd(35)} ║`);
  lines.push(`╠${'═'.repeat(50)}╣`);
  lines.push(`║ ${quest.description.slice(0, 48).padEnd(48)} ║`);
  lines.push(`╠${'═'.repeat(50)}╣`);
  lines.push(`║ Objectives:${' '.repeat(38)} ║`);

  for (const obj of quest.objectives) {
    const status = obj.current >= obj.required ? '✓' : '○';
    const text = `  ${status} ${obj.description} (${obj.current}/${obj.required})`;
    lines.push(`║ ${text.padEnd(48)} ║`);
  }

  lines.push(`╠${'═'.repeat(50)}╣`);
  lines.push(`║ Progress: [${progressBar}] ${progress.toFixed(0)}%`.padEnd(51) + '║');
  lines.push(`╚${'═'.repeat(50)}╝`);

  return lines.join('\n');
}

function getAvailableQuests(quests: Quest[], completedIds: string[]): Quest[] {
  return quests.filter(q => {
    if (q.status !== 'locked') return q.status === 'available';
    if (!q.prerequisites) return true;
    return q.prerequisites.every(p => completedIds.includes(p));
  });
}

export const questSystemTool: UnifiedTool = {
  name: 'quest_system',
  description: 'Quest System: list, details, progress, update, complete, available, ascii',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['list', 'details', 'progress', 'update_objective', 'complete', 'available', 'active', 'ascii', 'info'] },
      questId: { type: 'string' },
      objectiveId: { type: 'string' },
      amount: { type: 'number' },
      questType: { type: 'string' }
    },
    required: ['operation']
  }
};

export async function executeQuestSystem(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'list':
        const filtered = args.questType
          ? QUEST_DATABASE.filter(q => q.type === args.questType)
          : QUEST_DATABASE;
        result = {
          quests: filtered.map(q => ({
            id: q.id,
            name: q.name,
            type: q.type,
            status: q.status,
            level: q.level,
            progress: getQuestProgress(q).toFixed(0) + '%'
          }))
        };
        break;
      case 'details':
        const quest = QUEST_DATABASE.find(q => q.id === args.questId);
        result = quest ? { quest } : { error: 'Quest not found' };
        break;
      case 'progress':
        const progQuest = QUEST_DATABASE.find(q => q.id === args.questId);
        if (progQuest) {
          result = {
            questId: progQuest.id,
            name: progQuest.name,
            progress: getQuestProgress(progQuest),
            objectives: progQuest.objectives.map(o => ({
              description: o.description,
              progress: `${o.current}/${o.required}`,
              complete: o.current >= o.required
            }))
          };
        } else {
          result = { error: 'Quest not found' };
        }
        break;
      case 'update_objective':
        const updateQuest = QUEST_DATABASE.find(q => q.id === args.questId);
        if (updateQuest) {
          const updateResult = updateObjective(updateQuest, args.objectiveId || 'obj1', args.amount || 1);
          result = { ...updateResult, newProgress: getQuestProgress(updateQuest) };
        } else {
          result = { error: 'Quest not found' };
        }
        break;
      case 'complete':
        const compQuest = QUEST_DATABASE.find(q => q.id === args.questId);
        if (compQuest) {
          compQuest.status = 'completed';
          result = { completed: true, rewards: compQuest.rewards };
        } else {
          result = { error: 'Quest not found' };
        }
        break;
      case 'available':
        const available = getAvailableQuests(QUEST_DATABASE, ['main_001']);
        result = { availableQuests: available.map(q => ({ id: q.id, name: q.name, level: q.level })) };
        break;
      case 'active':
        const active = QUEST_DATABASE.filter(q => q.status === 'active');
        result = {
          activeQuests: active.map(q => ({
            id: q.id,
            name: q.name,
            progress: getQuestProgress(q).toFixed(0) + '%'
          }))
        };
        break;
      case 'ascii':
        const asciiQuest = QUEST_DATABASE.find(q => q.id === (args.questId || 'side_001'));
        result = asciiQuest ? { display: questToAscii(asciiQuest) } : { error: 'Quest not found' };
        break;
      case 'info':
        result = {
          description: 'Quest and objective tracking system',
          questTypes: ['main', 'side', 'daily', 'event'],
          objectiveTypes: ['kill', 'collect', 'talk', 'explore', 'escort', 'craft'],
          statuses: ['locked', 'available', 'active', 'completed', 'failed'],
          features: ['Prerequisites', 'Time limits', 'Optional objectives', 'Multiple rewards']
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

export function isQuestSystemAvailable(): boolean { return true; }
