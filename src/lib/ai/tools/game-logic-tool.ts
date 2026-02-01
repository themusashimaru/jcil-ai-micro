/**
 * GAME LOGIC TOOL
 * Design game mechanics and systems
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

function designECS(config: {
  entities?: string[];
  components?: string[];
  systems?: string[];
}): Record<string, unknown> {
  const { entities = [], components = [], systems = [] } = config;

  const defaultEntities = entities.length ? entities : ['Player', 'Enemy', 'Projectile', 'Item'];
  const defaultComponents = components.length ? components : ['Position', 'Velocity', 'Health', 'Sprite', 'Collider', 'AI'];
  const defaultSystems = systems.length ? systems : ['MovementSystem', 'RenderSystem', 'CollisionSystem', 'AISystem'];

  return {
    architecture: {
      description: 'Entity-Component-System pattern for game logic',
      benefits: ['Data-oriented design', 'Cache-friendly', 'Flexible composition', 'Easy to extend']
    },
    implementation: `// Core ECS Types
type EntityId = number;

interface Component {
  entityId: EntityId;
}

interface Position extends Component {
  x: number;
  y: number;
}

interface Velocity extends Component {
  dx: number;
  dy: number;
}

interface Health extends Component {
  current: number;
  max: number;
}

// World manages all entities and components
class World {
  private nextEntityId = 0;
  private entities: Set<EntityId> = new Set();
  private components: Map<string, Map<EntityId, Component>> = new Map();
  private systems: System[] = [];

  createEntity(): EntityId {
    const id = this.nextEntityId++;
    this.entities.add(id);
    return id;
  }

  destroyEntity(id: EntityId): void {
    this.entities.delete(id);
    for (const store of this.components.values()) {
      store.delete(id);
    }
  }

  addComponent<T extends Component>(entityId: EntityId, type: string, component: T): void {
    if (!this.components.has(type)) {
      this.components.set(type, new Map());
    }
    this.components.get(type)!.set(entityId, component);
  }

  getComponent<T extends Component>(entityId: EntityId, type: string): T | undefined {
    return this.components.get(type)?.get(entityId) as T | undefined;
  }

  query(...componentTypes: string[]): EntityId[] {
    return Array.from(this.entities).filter(id =>
      componentTypes.every(type => this.components.get(type)?.has(id))
    );
  }

  addSystem(system: System): void {
    this.systems.push(system);
    this.systems.sort((a, b) => a.priority - b.priority);
  }

  update(deltaTime: number): void {
    for (const system of this.systems) {
      system.update(this, deltaTime);
    }
  }
}

// System base
interface System {
  priority: number;
  update(world: World, deltaTime: number): void;
}

// Movement System
class MovementSystem implements System {
  priority = 1;

  update(world: World, deltaTime: number): void {
    const entities = world.query('Position', 'Velocity');

    for (const id of entities) {
      const pos = world.getComponent<Position>(id, 'Position')!;
      const vel = world.getComponent<Velocity>(id, 'Velocity')!;

      pos.x += vel.dx * deltaTime;
      pos.y += vel.dy * deltaTime;
    }
  }
}`,
    entityComposition: defaultEntities.map(entity => ({
      entity,
      components: getEntityComponents(entity, defaultComponents)
    })),
    systems: defaultSystems.map(system => ({
      system,
      requiredComponents: getSystemComponents(system)
    }))
  };
}

function getEntityComponents(entity: string, _available: string[]): string[] {
  const compositions: Record<string, string[]> = {
    'Player': ['Position', 'Velocity', 'Health', 'Sprite', 'Collider', 'Input'],
    'Enemy': ['Position', 'Velocity', 'Health', 'Sprite', 'Collider', 'AI'],
    'Projectile': ['Position', 'Velocity', 'Sprite', 'Collider', 'Damage'],
    'Item': ['Position', 'Sprite', 'Collider', 'Pickup']
  };
  return compositions[entity] || ['Position', 'Sprite'];
}

function getSystemComponents(system: string): string[] {
  const requirements: Record<string, string[]> = {
    'MovementSystem': ['Position', 'Velocity'],
    'RenderSystem': ['Position', 'Sprite'],
    'CollisionSystem': ['Position', 'Collider'],
    'AISystem': ['Position', 'AI', 'Velocity'],
    'HealthSystem': ['Health'],
    'InputSystem': ['Input', 'Velocity']
  };
  return requirements[system] || [];
}

function designStateMachine(config: {
  name?: string;
  states?: string[];
  transitions?: Array<{ from: string; to: string; event: string }>;
}): Record<string, unknown> {
  const { name = 'CharacterState', states = [], transitions = [] } = config;

  const defaultStates = states.length ? states : ['Idle', 'Walking', 'Running', 'Jumping', 'Falling', 'Attacking'];
  const defaultTransitions = transitions.length ? transitions : [
    { from: 'Idle', to: 'Walking', event: 'move' },
    { from: 'Walking', to: 'Running', event: 'sprint' },
    { from: 'Walking', to: 'Idle', event: 'stop' },
    { from: 'Idle', to: 'Jumping', event: 'jump' },
    { from: 'Jumping', to: 'Falling', event: 'apex_reached' },
    { from: 'Falling', to: 'Idle', event: 'land' },
    { from: 'Idle', to: 'Attacking', event: 'attack' },
    { from: 'Attacking', to: 'Idle', event: 'attack_complete' }
  ];

  return {
    stateMachine: {
      name,
      states: defaultStates,
      transitions: defaultTransitions
    },
    implementation: `enum ${name} {
${defaultStates.map(s => `  ${s} = '${s}'`).join(',\n')}
}

interface StateConfig {
  onEnter?: () => void;
  onExit?: () => void;
  onUpdate?: (deltaTime: number) => void;
}

class StateMachine {
  private currentState: ${name};
  private states: Map<${name}, StateConfig> = new Map();
  private transitions: Map<string, ${name}> = new Map();

  constructor(initialState: ${name}) {
    this.currentState = initialState;
  }

  addState(state: ${name}, config: StateConfig): this {
    this.states.set(state, config);
    return this;
  }

  addTransition(from: ${name}, event: string, to: ${name}): this {
    this.transitions.set(\`\${from}:\${event}\`, to);
    return this;
  }

  dispatch(event: string): boolean {
    const key = \`\${this.currentState}:\${event}\`;
    const nextState = this.transitions.get(key);

    if (nextState === undefined) {
      return false;
    }

    // Exit current state
    this.states.get(this.currentState)?.onExit?.();

    // Transition
    this.currentState = nextState;

    // Enter new state
    this.states.get(this.currentState)?.onEnter?.();

    return true;
  }

  update(deltaTime: number): void {
    this.states.get(this.currentState)?.onUpdate?.(deltaTime);
  }

  getState(): ${name} {
    return this.currentState;
  }
}

// Usage
const fsm = new StateMachine(${name}.Idle)
  .addState(${name}.Idle, {
    onEnter: () => playAnimation('idle'),
    onUpdate: (dt) => checkForInput()
  })
  .addState(${name}.Walking, {
    onEnter: () => playAnimation('walk'),
    onUpdate: (dt) => updatePosition(dt)
  })
${defaultTransitions.map(t => `  .addTransition(${name}.${t.from}, '${t.event}', ${name}.${t.to})`).join('\n')};`,
    diagram: generateStateDiagram(defaultStates, defaultTransitions)
  };
}

function generateStateDiagram(states: string[], transitions: Array<{ from: string; to: string; event: string }>): string {
  let diagram = '```mermaid\nstateDiagram-v2\n';
  diagram += `  [*] --> ${states[0]}\n`;

  for (const t of transitions) {
    diagram += `  ${t.from} --> ${t.to}: ${t.event}\n`;
  }

  diagram += '```';
  return diagram;
}

function designInventory(config: {
  maxSlots?: number;
  stackable?: boolean;
  categories?: string[];
}): Record<string, unknown> {
  const { maxSlots = 20, stackable = true, categories = ['Weapon', 'Armor', 'Consumable', 'Quest', 'Material'] } = config;

  return {
    design: {
      maxSlots,
      stackable,
      categories
    },
    implementation: `interface Item {
  id: string;
  name: string;
  category: ${categories.map(c => `'${c}'`).join(' | ')};
  stackable: boolean;
  maxStack: number;
  weight: number;
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
  stats?: Record<string, number>;
}

interface InventorySlot {
  item: Item | null;
  quantity: number;
}

class Inventory {
  private slots: InventorySlot[];
  private maxSlots: number;

  constructor(maxSlots = ${maxSlots}) {
    this.maxSlots = maxSlots;
    this.slots = Array(maxSlots).fill(null).map(() => ({
      item: null,
      quantity: 0
    }));
  }

  addItem(item: Item, quantity = 1): { added: number; overflow: number } {
    let remaining = quantity;
    let added = 0;

    // First, try to stack with existing items
    ${stackable ? `if (item.stackable) {
      for (const slot of this.slots) {
        if (slot.item?.id === item.id && slot.quantity < item.maxStack) {
          const canAdd = Math.min(remaining, item.maxStack - slot.quantity);
          slot.quantity += canAdd;
          remaining -= canAdd;
          added += canAdd;

          if (remaining === 0) break;
        }
      }
    }` : ''}

    // Then, use empty slots
    for (const slot of this.slots) {
      if (slot.item === null && remaining > 0) {
        slot.item = item;
        const canAdd = ${stackable ? 'item.stackable ? Math.min(remaining, item.maxStack) : 1' : '1'};
        slot.quantity = canAdd;
        remaining -= canAdd;
        added += canAdd;

        if (remaining === 0) break;
      }
    }

    return { added, overflow: remaining };
  }

  removeItem(itemId: string, quantity = 1): number {
    let remaining = quantity;
    let removed = 0;

    for (const slot of this.slots) {
      if (slot.item?.id === itemId) {
        const canRemove = Math.min(remaining, slot.quantity);
        slot.quantity -= canRemove;
        remaining -= canRemove;
        removed += canRemove;

        if (slot.quantity === 0) {
          slot.item = null;
        }

        if (remaining === 0) break;
      }
    }

    return removed;
  }

  getItemCount(itemId: string): number {
    return this.slots
      .filter(s => s.item?.id === itemId)
      .reduce((sum, s) => sum + s.quantity, 0);
  }

  getByCategory(category: string): InventorySlot[] {
    return this.slots.filter(s => s.item?.category === category);
  }

  isFull(): boolean {
    return this.slots.every(s => s.item !== null);
  }

  getEmptySlots(): number {
    return this.slots.filter(s => s.item === null).length;
  }

  sort(by: 'name' | 'category' | 'rarity' = 'category'): void {
    const items = this.slots.filter(s => s.item !== null);
    this.slots = this.slots.map(() => ({ item: null, quantity: 0 }));

    items.sort((a, b) => {
      if (by === 'name') return a.item!.name.localeCompare(b.item!.name);
      if (by === 'category') return a.item!.category.localeCompare(b.item!.category);
      return 0;
    });

    items.forEach((slot, i) => {
      this.slots[i] = slot;
    });
  }
}`
  };
}

function designCombat(config: {
  type?: 'turn-based' | 'real-time' | 'action';
  stats?: string[];
  damageFormula?: string;
}): Record<string, unknown> {
  const { type = 'action', stats = ['HP', 'Attack', 'Defense', 'Speed', 'Critical'], damageFormula = '(attack * 2) - defense' } = config;

  return {
    combatType: type,
    stats,
    damageFormula,
    implementation: `interface CombatStats {
${stats.map(s => `  ${s.toLowerCase()}: number;`).join('\n')}
}

interface Combatant {
  id: string;
  stats: CombatStats;
  currentHp: number;
  buffs: Buff[];
  debuffs: Debuff[];
}

interface DamageResult {
  baseDamage: number;
  finalDamage: number;
  isCritical: boolean;
  isBlocked: boolean;
  damageType: 'physical' | 'magical' | 'true';
}

class CombatSystem {
  calculateDamage(attacker: Combatant, defender: Combatant, skill?: Skill): DamageResult {
    const attack = this.getEffectiveStat(attacker, 'attack');
    const defense = this.getEffectiveStat(defender, 'defense');

    // Base damage formula: ${damageFormula}
    let baseDamage = Math.max(0, ${damageFormula.replace(/attack/g, 'attack').replace(/defense/g, 'defense')});

    // Skill multiplier
    if (skill) {
      baseDamage *= skill.damageMultiplier;
    }

    // Critical hit check
    const critChance = this.getEffectiveStat(attacker, 'critical') / 100;
    const isCritical = Math.random() < critChance;
    if (isCritical) {
      baseDamage *= 1.5;
    }

    // Apply defense reduction
    const damageReduction = defense / (defense + 100);
    let finalDamage = Math.round(baseDamage * (1 - damageReduction));

    // Variance (+/- 10%)
    const variance = 0.9 + Math.random() * 0.2;
    finalDamage = Math.round(finalDamage * variance);

    return {
      baseDamage: Math.round(baseDamage),
      finalDamage: Math.max(1, finalDamage),
      isCritical,
      isBlocked: false,
      damageType: skill?.damageType || 'physical'
    };
  }

  getEffectiveStat(combatant: Combatant, stat: string): number {
    const base = combatant.stats[stat as keyof CombatStats] || 0;

    // Apply buffs
    const buffMultiplier = combatant.buffs
      .filter(b => b.stat === stat)
      .reduce((mult, b) => mult * (1 + b.value / 100), 1);

    // Apply debuffs
    const debuffMultiplier = combatant.debuffs
      .filter(d => d.stat === stat)
      .reduce((mult, d) => mult * (1 - d.value / 100), 1);

    return Math.round(base * buffMultiplier * debuffMultiplier);
  }

  applyDamage(target: Combatant, damage: DamageResult): void {
    target.currentHp = Math.max(0, target.currentHp - damage.finalDamage);
  }

  isDefeated(combatant: Combatant): boolean {
    return combatant.currentHp <= 0;
  }
}`,
    balanceGuide: {
      damageScaling: 'Attack should deal ~2-3x damage vs equally leveled enemies',
      ttk: 'Time to kill: 3-5 hits for basic enemies, 10-20 for bosses',
      healingBalance: 'Healing should recover ~25-50% HP per use',
      criticalDamage: 'Critical hits deal 150-200% damage'
    }
  };
}

function designDialogue(config: {
  format?: 'tree' | 'ink' | 'yarn';
}): Record<string, unknown> {
  const { format = 'tree' } = config;

  return {
    format,
    implementation: `interface DialogueNode {
  id: string;
  speaker: string;
  text: string;
  choices?: DialogueChoice[];
  next?: string;
  conditions?: Condition[];
  effects?: Effect[];
}

interface DialogueChoice {
  text: string;
  next: string;
  conditions?: Condition[];
  effects?: Effect[];
}

interface Condition {
  type: 'flag' | 'stat' | 'item' | 'quest';
  key: string;
  operator: '==' | '!=' | '>' | '<' | '>=';
  value: unknown;
}

interface Effect {
  type: 'set_flag' | 'modify_stat' | 'give_item' | 'start_quest';
  key: string;
  value: unknown;
}

class DialogueSystem {
  private nodes: Map<string, DialogueNode> = new Map();
  private currentNode: DialogueNode | null = null;
  private gameState: GameState;

  constructor(gameState: GameState) {
    this.gameState = gameState;
  }

  loadDialogue(nodes: DialogueNode[]): void {
    for (const node of nodes) {
      this.nodes.set(node.id, node);
    }
  }

  startDialogue(startId: string): DialogueNode | null {
    const node = this.nodes.get(startId);
    if (node && this.checkConditions(node.conditions)) {
      this.currentNode = node;
      return node;
    }
    return null;
  }

  getAvailableChoices(): DialogueChoice[] {
    if (!this.currentNode?.choices) return [];

    return this.currentNode.choices.filter(choice =>
      this.checkConditions(choice.conditions)
    );
  }

  selectChoice(choiceIndex: number): DialogueNode | null {
    const choices = this.getAvailableChoices();
    const choice = choices[choiceIndex];

    if (!choice) return null;

    // Apply choice effects
    this.applyEffects(choice.effects);

    // Move to next node
    return this.advance(choice.next);
  }

  advance(nextId?: string): DialogueNode | null {
    const targetId = nextId || this.currentNode?.next;

    if (!targetId) {
      this.currentNode = null;
      return null;
    }

    const node = this.nodes.get(targetId);
    if (node && this.checkConditions(node.conditions)) {
      // Apply node effects
      this.applyEffects(node.effects);
      this.currentNode = node;
      return node;
    }

    return null;
  }

  private checkConditions(conditions?: Condition[]): boolean {
    if (!conditions) return true;
    return conditions.every(c => this.evaluateCondition(c));
  }

  private evaluateCondition(condition: Condition): boolean {
    const value = this.gameState.get(condition.type, condition.key);
    switch (condition.operator) {
      case '==': return value === condition.value;
      case '!=': return value !== condition.value;
      case '>': return value > condition.value;
      case '<': return value < condition.value;
      case '>=': return value >= condition.value;
      default: return false;
    }
  }

  private applyEffects(effects?: Effect[]): void {
    if (!effects) return;
    for (const effect of effects) {
      this.gameState.apply(effect);
    }
  }
}`,
    exampleDialogue: `// Example dialogue data
const dialogue: DialogueNode[] = [
  {
    id: "start",
    speaker: "Merchant",
    text: "Welcome, traveler! Looking to buy or sell?",
    choices: [
      { text: "Show me your wares", next: "shop" },
      { text: "I have items to sell", next: "sell" },
      {
        text: "I'm looking for the stolen artifact",
        next: "quest_info",
        conditions: [{ type: "quest", key: "stolen_artifact", operator: "==", value: "active" }]
      },
      { text: "Goodbye", next: "end" }
    ]
  },
  {
    id: "quest_info",
    speaker: "Merchant",
    text: "Ah, you're investigating that theft? I saw suspicious figures heading north.",
    effects: [{ type: "set_flag", key: "merchant_hint", value: true }],
    next: "start"
  }
];`
  };
}

export const gameLogicTool: UnifiedTool = {
  name: 'game_logic',
  description: 'Game Logic: ecs, state_machine, inventory, combat, dialogue',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['ecs', 'state_machine', 'inventory', 'combat', 'dialogue'] },
      config: { type: 'object' }
    },
    required: ['operation']
  },
};

export async function executeGameLogic(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'ecs':
        result = designECS(args.config || {});
        break;
      case 'state_machine':
        result = designStateMachine(args.config || {});
        break;
      case 'inventory':
        result = designInventory(args.config || {});
        break;
      case 'combat':
        result = designCombat(args.config || {});
        break;
      case 'dialogue':
        result = designDialogue(args.config || {});
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isGameLogicAvailable(): boolean { return true; }
