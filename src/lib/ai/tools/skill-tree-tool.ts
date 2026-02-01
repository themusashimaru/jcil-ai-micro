/**
 * SKILL TREE TOOL
 * Generate and manage RPG skill trees with dependencies and unlocks
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Skill {
  id: string;
  name: string;
  description: string;
  tier: number;
  cost: number;
  maxRank: number;
  currentRank: number;
  prerequisites: string[];
  effects: Array<{ type: string; value: number; scaling: number }>;
  icon?: string;
}

interface SkillTree {
  id: string;
  name: string;
  description: string;
  skills: Record<string, Skill>;
  totalPoints: number;
  spentPoints: number;
}

const SKILL_CATEGORIES = ['combat', 'magic', 'stealth', 'survival', 'crafting', 'social'];
const EFFECT_TYPES = ['damage', 'defense', 'speed', 'mana', 'health', 'critical', 'evasion', 'accuracy', 'cooldown_reduction', 'resource_gain'];
void EFFECT_TYPES; // Reference data for skill effects

const SKILL_TEMPLATES: Record<string, { names: string[]; effects: string[] }> = {
  combat: {
    names: ['Power Strike', 'Armor Mastery', 'Weapon Focus', 'Critical Hit', 'Parry', 'Charge', 'Cleave', 'Intimidate', 'Rally', 'Last Stand'],
    effects: ['damage', 'defense', 'critical', 'accuracy']
  },
  magic: {
    names: ['Arcane Power', 'Spell Focus', 'Mana Flow', 'Elemental Mastery', 'Quick Cast', 'Spell Shield', 'Channeling', 'Ritual Magic', 'Counterspell', 'Arcane Burst'],
    effects: ['damage', 'mana', 'cooldown_reduction', 'critical']
  },
  stealth: {
    names: ['Shadow Step', 'Backstab', 'Evasion', 'Poison Mastery', 'Lock Picking', 'Silent Move', 'Ambush', 'Escape Artist', 'Pickpocket', 'Assassinate'],
    effects: ['damage', 'evasion', 'critical', 'speed']
  },
  survival: {
    names: ['Toughness', 'Regeneration', 'Endurance', 'Nature Bond', 'Tracking', 'Foraging', 'Weather Sense', 'Animal Companion', 'Trap Setting', 'First Aid'],
    effects: ['health', 'defense', 'resource_gain', 'speed']
  },
  crafting: {
    names: ['Blacksmithing', 'Alchemy', 'Enchanting', 'Tailoring', 'Jewelcrafting', 'Engineering', 'Cooking', 'Inscription', 'Leatherworking', 'Mining'],
    effects: ['resource_gain', 'critical', 'accuracy', 'speed']
  },
  social: {
    names: ['Persuasion', 'Intimidation', 'Deception', 'Leadership', 'Diplomacy', 'Barter', 'Insight', 'Performance', 'Charm', 'Command'],
    effects: ['accuracy', 'resource_gain', 'critical', 'defense']
  }
};

function generateSkillId(): string {
  return 'skill_' + Math.random().toString(36).substr(2, 9);
}

function generateSkill(category: string, tier: number, existingSkills: string[]): Skill {
  const template = SKILL_TEMPLATES[category] || SKILL_TEMPLATES.combat;
  const name = template.names[Math.floor(Math.random() * template.names.length)];
  const effectType = template.effects[Math.floor(Math.random() * template.effects.length)];

  const prerequisites: string[] = [];
  if (tier > 1 && existingSkills.length > 0) {
    const lowerTierSkills = existingSkills.filter(() => Math.random() > 0.5);
    if (lowerTierSkills.length > 0) {
      prerequisites.push(lowerTierSkills[Math.floor(Math.random() * lowerTierSkills.length)]);
    }
  }

  return {
    id: generateSkillId(),
    name: `${name} ${tier > 1 ? tier : ''}`.trim(),
    description: `Enhances ${effectType} capabilities. Tier ${tier} ability in the ${category} tree.`,
    tier,
    cost: tier,
    maxRank: Math.min(tier + 2, 5),
    currentRank: 0,
    prerequisites,
    effects: [{
      type: effectType,
      value: 5 * tier,
      scaling: 2 * tier
    }]
  };
}

function generateSkillTree(category: string, depth: number = 4, breadth: number = 3): SkillTree {
  const tree: SkillTree = {
    id: 'tree_' + Math.random().toString(36).substr(2, 9),
    name: `${category.charAt(0).toUpperCase() + category.slice(1)} Mastery`,
    description: `Master the arts of ${category}`,
    skills: {},
    totalPoints: 0,
    spentPoints: 0
  };

  const skillsByTier: string[][] = [];

  for (let tier = 1; tier <= depth; tier++) {
    skillsByTier[tier] = [];
    const skillsInTier = Math.max(1, breadth - Math.floor(tier / 2));

    for (let i = 0; i < skillsInTier; i++) {
      const existingSkills = tier > 1 ? skillsByTier[tier - 1] : [];
      const skill = generateSkill(category, tier, existingSkills);
      tree.skills[skill.id] = skill;
      skillsByTier[tier].push(skill.id);
      tree.totalPoints += skill.maxRank * skill.cost;
    }
  }

  return tree;
}

function canUnlockSkill(tree: SkillTree, skillId: string): { canUnlock: boolean; reason?: string } {
  const skill = tree.skills[skillId];
  if (!skill) return { canUnlock: false, reason: 'Skill not found' };

  if (skill.currentRank >= skill.maxRank) {
    return { canUnlock: false, reason: 'Already at max rank' };
  }

  for (const prereq of skill.prerequisites) {
    const prereqSkill = tree.skills[prereq];
    if (!prereqSkill || prereqSkill.currentRank === 0) {
      return { canUnlock: false, reason: `Prerequisite ${prereqSkill?.name || prereq} not unlocked` };
    }
  }

  return { canUnlock: true };
}

function unlockSkill(tree: SkillTree, skillId: string): { success: boolean; tree: SkillTree; message: string } {
  const check = canUnlockSkill(tree, skillId);
  if (!check.canUnlock) {
    return { success: false, tree, message: check.reason || 'Cannot unlock' };
  }

  const skill = tree.skills[skillId];
  skill.currentRank++;
  tree.spentPoints += skill.cost;

  return { success: true, tree, message: `Unlocked ${skill.name} (Rank ${skill.currentRank}/${skill.maxRank})` };
}

function calculateTreeStats(tree: SkillTree): Record<string, unknown> {
  const stats: Record<string, number> = {};
  let unlockedSkills = 0;
  let totalRanks = 0;
  let maxRanks = 0;

  for (const skill of Object.values(tree.skills)) {
    if (skill.currentRank > 0) {
      unlockedSkills++;
      totalRanks += skill.currentRank;
      for (const effect of skill.effects) {
        const bonus = effect.value + (effect.scaling * (skill.currentRank - 1));
        stats[effect.type] = (stats[effect.type] || 0) + bonus;
      }
    }
    maxRanks += skill.maxRank;
  }

  return {
    treeName: tree.name,
    totalSkills: Object.keys(tree.skills).length,
    unlockedSkills,
    totalRanks,
    maxRanks,
    completion: ((totalRanks / maxRanks) * 100).toFixed(1) + '%',
    pointsSpent: tree.spentPoints,
    bonuses: stats
  };
}

function visualizeTree(tree: SkillTree): string {
  const tiers: Record<number, Skill[]> = {};

  for (const skill of Object.values(tree.skills)) {
    tiers[skill.tier] = tiers[skill.tier] || [];
    tiers[skill.tier].push(skill);
  }

  let output = `=== ${tree.name} ===\n\n`;

  for (const [tier, skills] of Object.entries(tiers).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    output += `Tier ${tier}:\n`;
    for (const skill of skills) {
      const rankDisplay = `[${skill.currentRank}/${skill.maxRank}]`;
      const status = skill.currentRank > 0 ? '✓' : (canUnlockSkill(tree, skill.id).canUnlock ? '○' : '✗');
      output += `  ${status} ${skill.name} ${rankDisplay} (${skill.cost} pts/rank)\n`;
    }
    output += '\n';
  }

  return output;
}

function exportTree(tree: SkillTree, format: string): string {
  switch (format) {
    case 'json':
      return JSON.stringify(tree, null, 2);
    case 'markdown':
      let md = `# ${tree.name}\n\n${tree.description}\n\n`;
      const tiers: Record<number, Skill[]> = {};
      for (const skill of Object.values(tree.skills)) {
        tiers[skill.tier] = tiers[skill.tier] || [];
        tiers[skill.tier].push(skill);
      }
      for (const [tier, skills] of Object.entries(tiers).sort((a, b) => Number(a[0]) - Number(b[0]))) {
        md += `## Tier ${tier}\n\n`;
        for (const skill of skills) {
          md += `### ${skill.name}\n- **Cost:** ${skill.cost} points per rank\n- **Max Rank:** ${skill.maxRank}\n- **Effects:** ${skill.effects.map(e => `${e.type} +${e.value}`).join(', ')}\n\n`;
        }
      }
      return md;
    default:
      return JSON.stringify(tree);
  }
}

export const skillTreeTool: UnifiedTool = {
  name: 'skill_tree',
  description: 'Skill Tree: generate, unlock, stats, visualize, export, categories',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['generate', 'unlock', 'stats', 'visualize', 'export', 'categories', 'can_unlock'] },
      category: { type: 'string' },
      depth: { type: 'number' },
      breadth: { type: 'number' },
      tree: { type: 'object' },
      skillId: { type: 'string' },
      format: { type: 'string' }
    },
    required: ['operation']
  }
};

export async function executeSkillTree(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'generate':
        const category = args.category || SKILL_CATEGORIES[Math.floor(Math.random() * SKILL_CATEGORIES.length)];
        result = { tree: generateSkillTree(category, args.depth || 4, args.breadth || 3) };
        break;
      case 'unlock':
        if (!args.tree || !args.skillId) throw new Error('Tree and skillId required');
        const unlockResult = unlockSkill(args.tree, args.skillId);
        result = unlockResult;
        break;
      case 'stats':
        const statsTree = args.tree || generateSkillTree('combat', 4, 3);
        result = calculateTreeStats(statsTree);
        break;
      case 'visualize':
        const vizTree = args.tree || generateSkillTree('combat', 4, 3);
        result = { visualization: visualizeTree(vizTree) };
        break;
      case 'export':
        const exportTreeData = args.tree || generateSkillTree('combat', 4, 3);
        result = { format: args.format || 'json', output: exportTree(exportTreeData, args.format || 'json') };
        break;
      case 'categories':
        result = {
          categories: SKILL_CATEGORIES,
          templates: Object.entries(SKILL_TEMPLATES).map(([cat, t]) => ({
            category: cat,
            sampleSkills: t.names.slice(0, 5),
            effectTypes: t.effects
          }))
        };
        break;
      case 'can_unlock':
        if (!args.tree || !args.skillId) throw new Error('Tree and skillId required');
        result = canUnlockSkill(args.tree, args.skillId);
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isSkillTreeAvailable(): boolean { return true; }
