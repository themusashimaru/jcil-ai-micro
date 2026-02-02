/**
 * QUEST GENERATOR TOOL
 * Generate RPG quests with objectives, rewards, chains, and narratives
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface QuestObjective { type: string; target: string; count?: number; location?: string; completed: boolean; }
interface QuestReward { type: string; item?: string; amount?: number; }
interface Quest {
  id: string;
  title: string;
  description: string;
  type: string;
  difficulty: string;
  level: number;
  objectives: QuestObjective[];
  rewards: QuestReward[];
  giver: string;
  location: string;
  prerequisites?: string[];
  timeLimit?: string;
  isRepeatable: boolean;
}

const QUEST_TYPES = ['main', 'side', 'daily', 'bounty', 'escort', 'fetch', 'kill', 'explore', 'puzzle', 'gathering'];
const DIFFICULTIES = ['trivial', 'easy', 'normal', 'hard', 'heroic', 'legendary'];
const LOCATIONS = ['Dark Forest', 'Crystal Caverns', 'Burning Sands', 'Frozen Peaks', 'Sunken Temple', 'Ancient Ruins', 'Haunted Manor', 'Dragon\'s Lair', 'Forgotten Crypt', 'Merchant Quarter'];
const NPC_NAMES = ['Elder Thornwood', 'Captain Ironforge', 'Lady Shadowmere', 'Sage Brightwind', 'Guard Commander Rex', 'Mysterious Stranger', 'Farmer Willem', 'Priestess Luna'];
const ENEMIES = ['Goblin', 'Wolf', 'Bandit', 'Skeleton', 'Spider', 'Orc', 'Troll', 'Dragon', 'Demon', 'Undead Knight'];
const ITEMS = ['Ancient Artifact', 'Magic Crystal', 'Lost Tome', 'Sacred Relic', 'Enchanted Gem', 'Dragon Scale', 'Phoenix Feather', 'Moonstone', 'Herb Bundle', 'Rare Ore'];

function generateQuestId(): string {
  return 'quest_' + Math.random().toString(36).substr(2, 9);
}

function generateObjectives(questType: string, level: number): QuestObjective[] {
  const objectives: QuestObjective[] = [];
  const count = Math.floor(Math.random() * 2) + 1;

  for (let i = 0; i < count; i++) {
    const enemy = ENEMIES[Math.floor(Math.random() * ENEMIES.length)];
    const item = ITEMS[Math.floor(Math.random() * ITEMS.length)];
    const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];

    switch (questType) {
      case 'kill':
      case 'bounty':
        objectives.push({
          type: 'kill',
          target: enemy,
          count: Math.floor(level * (Math.random() * 3 + 1)),
          location,
          completed: false
        });
        break;
      case 'fetch':
      case 'gathering':
        objectives.push({
          type: 'collect',
          target: item,
          count: Math.floor(Math.random() * 10) + 1,
          location,
          completed: false
        });
        break;
      case 'escort':
        objectives.push({
          type: 'escort',
          target: NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)],
          location,
          completed: false
        });
        break;
      case 'explore':
        objectives.push({
          type: 'explore',
          target: location,
          completed: false
        });
        break;
      default:
        objectives.push({
          type: Math.random() > 0.5 ? 'kill' : 'collect',
          target: Math.random() > 0.5 ? enemy : item,
          count: Math.floor(Math.random() * 5) + 1,
          location,
          completed: false
        });
    }
  }

  return objectives;
}

function generateRewards(level: number, difficulty: string): QuestReward[] {
  const rewards: QuestReward[] = [];
  const difficultyMultiplier = DIFFICULTIES.indexOf(difficulty) + 1;

  // Gold reward
  rewards.push({
    type: 'gold',
    amount: Math.floor(level * 10 * difficultyMultiplier * (Math.random() + 0.5))
  });

  // Experience reward
  rewards.push({
    type: 'experience',
    amount: Math.floor(level * 50 * difficultyMultiplier * (Math.random() + 0.5))
  });

  // Random item reward
  if (Math.random() > 0.5) {
    rewards.push({
      type: 'item',
      item: ITEMS[Math.floor(Math.random() * ITEMS.length)],
      amount: 1
    });
  }

  // Reputation reward
  if (Math.random() > 0.7) {
    rewards.push({
      type: 'reputation',
      item: ['Town Guard', 'Merchant Guild', 'Mage Circle', 'Hunter\'s Lodge'][Math.floor(Math.random() * 4)],
      amount: Math.floor(difficultyMultiplier * 10)
    });
  }

  return rewards;
}

function generateQuestTitle(type: string, objectives: QuestObjective[]): string {
  const templates: Record<string, string[]> = {
    kill: ['Hunt the {target}', 'Eliminate the {target} Threat', '{target} Menace', 'Slay the {target}'],
    bounty: ['Bounty: {target}', 'Wanted: {target}', 'The {target} Must Die'],
    fetch: ['Retrieve the {target}', 'The Lost {target}', 'Finding the {target}'],
    escort: ['Protect {target}', 'Safe Passage for {target}', 'Escort Mission: {target}'],
    explore: ['Explore {target}', 'Secrets of {target}', 'Discovery: {target}'],
    gathering: ['Gather {target}', 'Collection: {target}', 'Supply Run: {target}'],
    main: ['The {target} Saga', 'Destiny\'s Call', 'The Final Confrontation'],
    side: ['A Small Favor', 'Helping Hands', 'Local Troubles'],
    daily: ['Daily Task', 'Routine Patrol', 'Regular Duties'],
    puzzle: ['The Mystery of {target}', 'Riddle of {target}', 'Solve the {target} Puzzle']
  };

  const template = templates[type] || templates.side;
  const title = template[Math.floor(Math.random() * template.length)];
  const target = objectives[0]?.target || 'Unknown';

  return title.replace('{target}', target);
}

function generateDescription(quest: Quest): string {
  const intros = [
    `${quest.giver} needs your help with an urgent matter.`,
    `A dangerous situation has arisen in ${quest.location}.`,
    `Word has reached us of trouble brewing.`,
    `An opportunity for adventure awaits the brave.`
  ];

  const objectives = quest.objectives.map(o => {
    if (o.type === 'kill') return `Defeat ${o.count} ${o.target}(s)`;
    if (o.type === 'collect') return `Gather ${o.count} ${o.target}(s)`;
    if (o.type === 'escort') return `Safely escort ${o.target}`;
    if (o.type === 'explore') return `Explore ${o.target}`;
    return `Complete the objective`;
  }).join('. ');

  return `${intros[Math.floor(Math.random() * intros.length)]} ${objectives}. Return when complete.`;
}

function generateQuest(options: { type?: string; level?: number; difficulty?: string } = {}): Quest {
  const type = options.type || QUEST_TYPES[Math.floor(Math.random() * QUEST_TYPES.length)];
  const level = options.level || Math.floor(Math.random() * 50) + 1;
  const difficulty = options.difficulty || DIFFICULTIES[Math.floor(Math.random() * DIFFICULTIES.length)];
  const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
  const giver = NPC_NAMES[Math.floor(Math.random() * NPC_NAMES.length)];
  const objectives = generateObjectives(type, level);

  const quest: Quest = {
    id: generateQuestId(),
    title: '',
    description: '',
    type,
    difficulty,
    level,
    objectives,
    rewards: generateRewards(level, difficulty),
    giver,
    location,
    isRepeatable: type === 'daily' || type === 'bounty'
  };

  quest.title = generateQuestTitle(type, objectives);
  quest.description = generateDescription(quest);

  if (type === 'bounty') {
    quest.timeLimit = `${Math.floor(Math.random() * 24) + 1} hours`;
  }

  return quest;
}

function generateQuestChain(length: number = 3, theme: string = 'adventure'): Quest[] {
  const chain: Quest[] = [];
  let currentLevel = Math.floor(Math.random() * 10) + 1;

  for (let i = 0; i < length; i++) {
    const isLast = i === length - 1;
    const quest = generateQuest({
      type: isLast ? 'main' : ['side', 'fetch', 'kill'][Math.floor(Math.random() * 3)],
      level: currentLevel,
      difficulty: DIFFICULTIES[Math.min(i + 1, DIFFICULTIES.length - 1)]
    });

    if (i > 0) {
      quest.prerequisites = [chain[i - 1].id];
    }

    quest.title = `${theme} Part ${i + 1}: ${quest.title}`;
    chain.push(quest);
    currentLevel += Math.floor(Math.random() * 3) + 1;
  }

  return chain;
}

function analyzeQuest(quest: Quest): Record<string, unknown> {
  const totalRewardValue = quest.rewards.reduce((sum, r) => {
    if (r.type === 'gold') return sum + (r.amount || 0);
    if (r.type === 'experience') return sum + (r.amount || 0) * 0.1;
    return sum + 50;
  }, 0);

  const objectiveComplexity = quest.objectives.reduce((sum, o) => {
    if (o.type === 'kill') return sum + (o.count || 1) * 2;
    if (o.type === 'collect') return sum + (o.count || 1);
    if (o.type === 'escort') return sum + 5;
    return sum + 1;
  }, 0);

  return {
    id: quest.id,
    title: quest.title,
    analysis: {
      estimatedDuration: `${Math.ceil(objectiveComplexity / 5)} minutes`,
      rewardValue: totalRewardValue.toFixed(0),
      complexity: objectiveComplexity,
      objectiveCount: quest.objectives.length,
      hasTimeLimit: !!quest.timeLimit,
      difficultyRating: DIFFICULTIES.indexOf(quest.difficulty) + 1
    },
    balance: {
      rewardPerComplexity: (totalRewardValue / objectiveComplexity).toFixed(2),
      levelAppropriate: quest.level <= 60,
      recommendation: totalRewardValue / objectiveComplexity > 10 ? 'Well balanced' : 'Consider increasing rewards'
    }
  };
}

export const questGeneratorTool: UnifiedTool = {
  name: 'quest_generator',
  description: 'Quest Generator: generate, chain, analyze, types, templates',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['generate', 'chain', 'analyze', 'types', 'templates', 'batch'] },
      type: { type: 'string' },
      level: { type: 'number' },
      difficulty: { type: 'string' },
      chainLength: { type: 'number' },
      theme: { type: 'string' },
      count: { type: 'number' },
      quest: { type: 'object' }
    },
    required: ['operation']
  }
};

export async function executeQuestGenerator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'generate':
        result = { quest: generateQuest({ type: args.type, level: args.level, difficulty: args.difficulty }) };
        break;
      case 'chain':
        result = { questChain: generateQuestChain(args.chainLength || 3, args.theme || 'Epic Adventure') };
        break;
      case 'analyze':
        const quest = args.quest || generateQuest();
        result = analyzeQuest(quest);
        break;
      case 'types':
        result = {
          questTypes: QUEST_TYPES,
          difficulties: DIFFICULTIES,
          locations: LOCATIONS,
          npcs: NPC_NAMES
        };
        break;
      case 'templates':
        result = {
          templates: QUEST_TYPES.map(t => ({
            type: t,
            description: `${t.charAt(0).toUpperCase() + t.slice(1)} quest template`,
            example: generateQuest({ type: t })
          }))
        };
        break;
      case 'batch':
        const quests = [];
        for (let i = 0; i < (args.count || 5); i++) {
          quests.push(generateQuest({ type: args.type, level: args.level }));
        }
        result = { quests };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isQuestGeneratorAvailable(): boolean { return true; }
