/**
 * SPELL SYSTEM TOOL
 * RPG spell system with elements, effects, costs, combos
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface SpellEffect { type: string; value: number; duration?: number; chance?: number; }
interface Spell { name: string; element: string; tier: number; manaCost: number; castTime: number; cooldown: number; effects: SpellEffect[]; description: string; }

const ELEMENTS = ['fire', 'water', 'earth', 'air', 'lightning', 'ice', 'nature', 'shadow', 'light', 'arcane'];
const EFFECT_TYPES = ['damage', 'heal', 'buff', 'debuff', 'dot', 'hot', 'shield', 'stun', 'slow', 'knockback'];
void EFFECT_TYPES; // Reference data for spell effects

const ELEMENT_INTERACTIONS: Record<string, { strong: string[]; weak: string[] }> = {
  fire: { strong: ['ice', 'nature'], weak: ['water', 'earth'] },
  water: { strong: ['fire', 'earth'], weak: ['lightning', 'ice'] },
  earth: { strong: ['lightning', 'fire'], weak: ['water', 'nature'] },
  air: { strong: ['earth', 'nature'], weak: ['fire', 'lightning'] },
  lightning: { strong: ['water', 'air'], weak: ['earth', 'arcane'] },
  ice: { strong: ['water', 'nature'], weak: ['fire', 'light'] },
  nature: { strong: ['water', 'earth'], weak: ['fire', 'ice'] },
  shadow: { strong: ['light', 'arcane'], weak: ['light', 'fire'] },
  light: { strong: ['shadow', 'ice'], weak: ['shadow', 'arcane'] },
  arcane: { strong: ['all'], weak: ['none'] }
};

const SPELL_PREFIXES: Record<string, string[]> = {
  fire: ['Flame', 'Inferno', 'Blaze', 'Scorch', 'Ember'],
  water: ['Aqua', 'Tidal', 'Torrent', 'Flood', 'Wave'],
  earth: ['Stone', 'Terra', 'Quake', 'Boulder', 'Crystal'],
  air: ['Wind', 'Gale', 'Tempest', 'Zephyr', 'Cyclone'],
  lightning: ['Thunder', 'Storm', 'Volt', 'Spark', 'Bolt'],
  ice: ['Frost', 'Glacial', 'Blizzard', 'Cryo', 'Winter'],
  nature: ['Vine', 'Thorn', 'Bloom', 'Wild', 'Verdant'],
  shadow: ['Dark', 'Shadow', 'Void', 'Night', 'Dread'],
  light: ['Holy', 'Radiant', 'Divine', 'Solar', 'Sacred'],
  arcane: ['Mystic', 'Arcane', 'Ether', 'Mana', 'Astral']
};

const SPELL_SUFFIXES = ['Strike', 'Blast', 'Wave', 'Burst', 'Storm', 'Shield', 'Aura', 'Nova', 'Bolt', 'Ray'];

function generateSpellName(element: string, tier: number): string {
  const prefixes = SPELL_PREFIXES[element] || SPELL_PREFIXES.arcane;
  const prefix = prefixes[Math.min(tier - 1, prefixes.length - 1)];
  const suffix = SPELL_SUFFIXES[Math.floor(Math.random() * SPELL_SUFFIXES.length)];
  return `${prefix} ${suffix}`;
}

function generateSpellEffects(element: string, tier: number): SpellEffect[] {
  const effects: SpellEffect[] = [];
  const baseDamage = 10 * tier;
  const effectCount = Math.min(tier, 3);

  // Primary effect
  const primaryType = Math.random() < 0.7 ? 'damage' : 'heal';
  effects.push({
    type: primaryType,
    value: primaryType === 'damage' ? baseDamage + Math.floor(Math.random() * baseDamage) : Math.floor(baseDamage * 0.8)
  });

  // Secondary effects based on element
  for (let i = 1; i < effectCount; i++) {
    if (element === 'fire') {
      effects.push({ type: 'dot', value: Math.floor(baseDamage * 0.2), duration: 3 + tier });
    } else if (element === 'ice') {
      effects.push({ type: 'slow', value: 20 + tier * 5, duration: 2 + tier, chance: 0.5 + tier * 0.1 });
    } else if (element === 'lightning') {
      effects.push({ type: 'stun', value: 0, duration: 1, chance: 0.1 + tier * 0.05 });
    } else if (element === 'nature') {
      effects.push({ type: 'hot', value: Math.floor(baseDamage * 0.3), duration: 4 + tier });
    } else if (element === 'light') {
      effects.push({ type: 'heal', value: Math.floor(baseDamage * 0.5) });
    } else if (element === 'shadow') {
      effects.push({ type: 'debuff', value: 10 + tier * 3, duration: 3 + tier });
    } else if (element === 'earth') {
      effects.push({ type: 'shield', value: Math.floor(baseDamage * 0.7) });
    } else if (element === 'air') {
      effects.push({ type: 'knockback', value: 2 + tier });
    } else {
      effects.push({ type: 'buff', value: 5 + tier * 2, duration: 5 });
    }
  }

  return effects;
}

function generateSpell(element: string = 'fire', tier: number = 1): Spell {
  tier = Math.max(1, Math.min(5, tier));

  return {
    name: generateSpellName(element, tier),
    element,
    tier,
    manaCost: 10 * tier + Math.floor(Math.random() * 10 * tier),
    castTime: Math.max(0.5, 2 - tier * 0.3 + Math.random()),
    cooldown: tier * 2 + Math.floor(Math.random() * tier * 2),
    effects: generateSpellEffects(element, tier),
    description: `A tier ${tier} ${element} spell.`
  };
}

function generateSpellbook(count: number = 10): Spell[] {
  const spells: Spell[] = [];
  for (let i = 0; i < count; i++) {
    const element = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
    const tier = Math.floor(Math.random() * 5) + 1;
    spells.push(generateSpell(element, tier));
  }
  return spells;
}

function calculateSpellCombo(spell1: Spell, spell2: Spell): Record<string, unknown> {
  const interactions = ELEMENT_INTERACTIONS[spell1.element];
  let multiplier = 1.0;
  const comboName = `${spell1.name} + ${spell2.name}`;
  let effect = 'neutral';

  if (interactions.strong.includes(spell2.element) || interactions.strong.includes('all')) {
    multiplier = 1.5;
    effect = 'synergy';
  } else if (interactions.weak.includes(spell2.element)) {
    multiplier = 0.7;
    effect = 'conflict';
  } else if (spell1.element === spell2.element) {
    multiplier = 1.25;
    effect = 'resonance';
  }

  const combinedDamage = (spell1.effects[0].value + spell2.effects[0].value) * multiplier;
  const combinedCost = spell1.manaCost + spell2.manaCost;

  return {
    combo: comboName,
    elements: [spell1.element, spell2.element],
    effect,
    multiplier,
    totalDamage: Math.floor(combinedDamage),
    totalManaCost: combinedCost,
    efficiency: (combinedDamage / combinedCost).toFixed(2)
  };
}

function analyzeSpell(spell: Spell): Record<string, unknown> {
  const totalDamage = spell.effects.filter(e => e.type === 'damage' || e.type === 'dot')
    .reduce((sum, e) => sum + e.value * (e.duration || 1), 0);
  const totalHeal = spell.effects.filter(e => e.type === 'heal' || e.type === 'hot')
    .reduce((sum, e) => sum + e.value * (e.duration || 1), 0);

  return {
    spell: spell.name,
    analysis: {
      damagePerMana: (totalDamage / spell.manaCost).toFixed(2),
      healPerMana: (totalHeal / spell.manaCost).toFixed(2),
      dps: (totalDamage / (spell.castTime + spell.cooldown)).toFixed(2),
      effectCount: spell.effects.length,
      hasCrowdControl: spell.effects.some(e => ['stun', 'slow', 'knockback'].includes(e.type)),
      hasOverTime: spell.effects.some(e => ['dot', 'hot'].includes(e.type))
    },
    strengths: ELEMENT_INTERACTIONS[spell.element]?.strong || [],
    weaknesses: ELEMENT_INTERACTIONS[spell.element]?.weak || []
  };
}

function balanceCheck(spells: Spell[]): Record<string, unknown> {
  const byElement: Record<string, Spell[]> = {};
  const byTier: Record<number, Spell[]> = {};

  for (const spell of spells) {
    byElement[spell.element] = byElement[spell.element] || [];
    byElement[spell.element].push(spell);
    byTier[spell.tier] = byTier[spell.tier] || [];
    byTier[spell.tier].push(spell);
  }

  const elementStats = Object.entries(byElement).map(([element, elSpells]) => {
    const avgDamage = elSpells.reduce((s, sp) => s + (sp.effects[0]?.value || 0), 0) / elSpells.length;
    const avgCost = elSpells.reduce((s, sp) => s + sp.manaCost, 0) / elSpells.length;
    return { element, count: elSpells.length, avgDamage: avgDamage.toFixed(1), avgCost: avgCost.toFixed(1) };
  });

  const tierStats = Object.entries(byTier).map(([tier, tSpells]) => {
    const avgDamage = tSpells.reduce((s, sp) => s + (sp.effects[0]?.value || 0), 0) / tSpells.length;
    return { tier: Number(tier), count: tSpells.length, avgDamage: avgDamage.toFixed(1) };
  });

  return {
    totalSpells: spells.length,
    byElement: elementStats,
    byTier: tierStats,
    elements: Object.keys(byElement),
    missingElements: ELEMENTS.filter(e => !byElement[e])
  };
}

export const spellSystemTool: UnifiedTool = {
  name: 'spell_system',
  description: 'Spell System: generate, spellbook, combo, analyze, elements, balance',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['generate', 'spellbook', 'combo', 'analyze', 'elements', 'balance'] },
      element: { type: 'string' },
      tier: { type: 'number' },
      count: { type: 'number' },
      spell1: { type: 'object' },
      spell2: { type: 'object' },
      spells: { type: 'array' }
    },
    required: ['operation']
  }
};

export async function executeSpellSystem(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'generate':
        result = { spell: generateSpell(args.element || 'fire', args.tier || 1) };
        break;
      case 'spellbook':
        result = { spellbook: generateSpellbook(args.count || 10) };
        break;
      case 'combo':
        const s1 = args.spell1 || generateSpell('fire', 2);
        const s2 = args.spell2 || generateSpell('ice', 2);
        result = calculateSpellCombo(s1, s2);
        break;
      case 'analyze':
        const spell = args.spell || generateSpell(args.element || 'fire', args.tier || 3);
        result = analyzeSpell(spell);
        break;
      case 'elements':
        result = {
          elements: ELEMENTS,
          interactions: ELEMENT_INTERACTIONS
        };
        break;
      case 'balance':
        const spells = args.spells || generateSpellbook(20);
        result = balanceCheck(spells);
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isSpellSystemAvailable(): boolean { return true; }
