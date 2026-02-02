/**
 * ACHIEVEMENT SYSTEM TOOL
 * Track player achievements, badges, and milestones
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Achievement { id: string; name: string; description: string; category: string; points: number; rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'; hidden: boolean; progress?: { current: number; required: number }; unlockedAt?: number; }
interface AchievementCategory { id: string; name: string; icon: string; achievements: string[]; }
interface PlayerAchievements { unlocked: Set<string>; progress: Map<string, number>; totalPoints: number; }

const ACHIEVEMENTS: Achievement[] = [
  // Combat Achievements
  { id: 'first_blood', name: 'First Blood', description: 'Defeat your first enemy', category: 'combat', points: 10, rarity: 'common', hidden: false },
  { id: 'warrior', name: 'Warrior', description: 'Defeat 100 enemies', category: 'combat', points: 25, rarity: 'uncommon', hidden: false, progress: { current: 0, required: 100 } },
  { id: 'slayer', name: 'Slayer', description: 'Defeat 1000 enemies', category: 'combat', points: 50, rarity: 'rare', hidden: false, progress: { current: 0, required: 1000 } },
  { id: 'boss_hunter', name: 'Boss Hunter', description: 'Defeat 10 bosses', category: 'combat', points: 75, rarity: 'epic', hidden: false, progress: { current: 0, required: 10 } },
  { id: 'untouchable', name: 'Untouchable', description: 'Defeat a boss without taking damage', category: 'combat', points: 100, rarity: 'legendary', hidden: true },

  // Exploration Achievements
  { id: 'explorer', name: 'Explorer', description: 'Discover 10 locations', category: 'exploration', points: 15, rarity: 'common', hidden: false, progress: { current: 0, required: 10 } },
  { id: 'cartographer', name: 'Cartographer', description: 'Discover all locations', category: 'exploration', points: 100, rarity: 'legendary', hidden: false, progress: { current: 0, required: 50 } },
  { id: 'secret_finder', name: 'Secret Finder', description: 'Find 25 hidden secrets', category: 'exploration', points: 50, rarity: 'rare', hidden: false, progress: { current: 0, required: 25 } },

  // Collection Achievements
  { id: 'hoarder', name: 'Hoarder', description: 'Collect 1000 gold', category: 'collection', points: 20, rarity: 'common', hidden: false, progress: { current: 0, required: 1000 } },
  { id: 'treasure_hunter', name: 'Treasure Hunter', description: 'Open 50 treasure chests', category: 'collection', points: 35, rarity: 'uncommon', hidden: false, progress: { current: 0, required: 50 } },
  { id: 'completionist', name: 'Completionist', description: 'Collect all items', category: 'collection', points: 150, rarity: 'legendary', hidden: true },

  // Story Achievements
  { id: 'chapter_1', name: 'Chapter 1 Complete', description: 'Complete the first chapter', category: 'story', points: 25, rarity: 'common', hidden: false },
  { id: 'chapter_2', name: 'Chapter 2 Complete', description: 'Complete the second chapter', category: 'story', points: 25, rarity: 'common', hidden: false },
  { id: 'true_ending', name: 'True Ending', description: 'Discover the true ending', category: 'story', points: 100, rarity: 'epic', hidden: true },

  // Skill Achievements
  { id: 'level_10', name: 'Apprentice', description: 'Reach level 10', category: 'skill', points: 15, rarity: 'common', hidden: false },
  { id: 'level_25', name: 'Journeyman', description: 'Reach level 25', category: 'skill', points: 30, rarity: 'uncommon', hidden: false },
  { id: 'level_50', name: 'Expert', description: 'Reach level 50', category: 'skill', points: 50, rarity: 'rare', hidden: false },
  { id: 'level_99', name: 'Master', description: 'Reach maximum level', category: 'skill', points: 100, rarity: 'legendary', hidden: false },

  // Social Achievements
  { id: 'first_friend', name: 'First Friend', description: 'Add a friend', category: 'social', points: 10, rarity: 'common', hidden: false },
  { id: 'party_time', name: 'Party Time', description: 'Complete a dungeon with a party', category: 'social', points: 25, rarity: 'uncommon', hidden: false },
];

const CATEGORIES: AchievementCategory[] = [
  { id: 'combat', name: 'Combat', icon: '⚔️', achievements: ACHIEVEMENTS.filter(a => a.category === 'combat').map(a => a.id) },
  { id: 'exploration', name: 'Exploration', icon: '🗺️', achievements: ACHIEVEMENTS.filter(a => a.category === 'exploration').map(a => a.id) },
  { id: 'collection', name: 'Collection', icon: '💎', achievements: ACHIEVEMENTS.filter(a => a.category === 'collection').map(a => a.id) },
  { id: 'story', name: 'Story', icon: '📖', achievements: ACHIEVEMENTS.filter(a => a.category === 'story').map(a => a.id) },
  { id: 'skill', name: 'Skill', icon: '⭐', achievements: ACHIEVEMENTS.filter(a => a.category === 'skill').map(a => a.id) },
  { id: 'social', name: 'Social', icon: '👥', achievements: ACHIEVEMENTS.filter(a => a.category === 'social').map(a => a.id) },
];

function createPlayerAchievements(): PlayerAchievements {
  return { unlocked: new Set(), progress: new Map(), totalPoints: 0 };
}

function unlockAchievement(player: PlayerAchievements, achievementId: string): { success: boolean; achievement?: Achievement; newPoints?: number } {
  if (player.unlocked.has(achievementId)) return { success: false };

  const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
  if (!achievement) return { success: false };

  player.unlocked.add(achievementId);
  player.totalPoints += achievement.points;

  return { success: true, achievement: { ...achievement, unlockedAt: Date.now() }, newPoints: player.totalPoints };
}

function updateProgress(player: PlayerAchievements, achievementId: string, amount: number): { unlocked: boolean; current: number; required: number } {
  const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
  if (!achievement || !achievement.progress) return { unlocked: false, current: 0, required: 0 };

  const current = (player.progress.get(achievementId) || 0) + amount;
  player.progress.set(achievementId, current);

  if (current >= achievement.progress.required && !player.unlocked.has(achievementId)) {
    unlockAchievement(player, achievementId);
    return { unlocked: true, current, required: achievement.progress.required };
  }

  return { unlocked: false, current, required: achievement.progress.required };
}

function achievementToAscii(achievement: Achievement, unlocked: boolean): string {
  const rarityIcons: Record<string, string> = { common: '○', uncommon: '◐', rare: '◑', epic: '◕', legendary: '●' };
  const status = unlocked ? '✓' : (achievement.hidden && !unlocked ? '?' : '○');
  const name = achievement.hidden && !unlocked ? '???' : achievement.name;
  const desc = achievement.hidden && !unlocked ? 'Hidden achievement' : achievement.description;

  return `[${status}] ${rarityIcons[achievement.rarity]} ${name} (${achievement.points}pts)\n    ${desc}`;
}

function getCompletionStats(player: PlayerAchievements): Record<string, unknown> {
  const total = ACHIEVEMENTS.length;
  const unlocked = player.unlocked.size;
  const maxPoints = ACHIEVEMENTS.reduce((sum, a) => sum + a.points, 0);

  const byRarity: Record<string, { unlocked: number; total: number }> = {};
  for (const r of ['common', 'uncommon', 'rare', 'epic', 'legendary']) {
    const rarityAchievements = ACHIEVEMENTS.filter(a => a.rarity === r);
    byRarity[r] = {
      unlocked: rarityAchievements.filter(a => player.unlocked.has(a.id)).length,
      total: rarityAchievements.length
    };
  }

  return {
    total: { unlocked, total, percentage: ((unlocked / total) * 100).toFixed(1) + '%' },
    points: { current: player.totalPoints, max: maxPoints, percentage: ((player.totalPoints / maxPoints) * 100).toFixed(1) + '%' },
    byRarity
  };
}

export const achievementSystemTool: UnifiedTool = {
  name: 'achievement_system',
  description: 'Achievement System: list, unlock, progress, categories, stats, recent',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['list', 'unlock', 'progress', 'categories', 'stats', 'recent', 'by_category', 'ascii', 'info'] },
      achievementId: { type: 'string' },
      category: { type: 'string' },
      amount: { type: 'number' },
      showHidden: { type: 'boolean' }
    },
    required: ['operation']
  }
};

export async function executeAchievementSystem(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    const player = createPlayerAchievements();

    // Pre-unlock some achievements for demo
    unlockAchievement(player, 'first_blood');
    unlockAchievement(player, 'explorer');
    updateProgress(player, 'warrior', 45);
    updateProgress(player, 'hoarder', 750);

    switch (args.operation) {
      case 'list':
        const showAll = args.showHidden || false;
        const list = ACHIEVEMENTS.filter(a => showAll || !a.hidden || player.unlocked.has(a.id));
        result = {
          achievements: list.map(a => ({
            id: a.id,
            name: a.hidden && !player.unlocked.has(a.id) ? '???' : a.name,
            points: a.points,
            rarity: a.rarity,
            unlocked: player.unlocked.has(a.id)
          }))
        };
        break;
      case 'unlock':
        const unlockResult = unlockAchievement(player, args.achievementId || 'chapter_1');
        result = unlockResult;
        break;
      case 'progress':
        const progResult = updateProgress(player, args.achievementId || 'warrior', args.amount || 10);
        result = { achievementId: args.achievementId || 'warrior', ...progResult };
        break;
      case 'categories':
        result = {
          categories: CATEGORIES.map(c => ({
            ...c,
            progress: `${c.achievements.filter(id => player.unlocked.has(id)).length}/${c.achievements.length}`
          }))
        };
        break;
      case 'stats':
        result = getCompletionStats(player);
        break;
      case 'recent':
        const recentUnlocked = Array.from(player.unlocked).slice(-5);
        result = {
          recent: recentUnlocked.map(id => {
            const a = ACHIEVEMENTS.find(ach => ach.id === id)!;
            return { id: a.id, name: a.name, points: a.points };
          })
        };
        break;
      case 'by_category':
        const catAchievements = ACHIEVEMENTS.filter(a => a.category === (args.category || 'combat'));
        result = {
          category: args.category || 'combat',
          achievements: catAchievements.map(a => ({
            id: a.id,
            name: a.name,
            unlocked: player.unlocked.has(a.id),
            progress: a.progress ? `${player.progress.get(a.id) || 0}/${a.progress.required}` : null
          }))
        };
        break;
      case 'ascii':
        const asciiOutput = ACHIEVEMENTS.slice(0, 5).map(a => achievementToAscii(a, player.unlocked.has(a.id))).join('\n\n');
        result = { display: asciiOutput };
        break;
      case 'info':
        result = {
          description: 'Achievement and milestone tracking system',
          totalAchievements: ACHIEVEMENTS.length,
          totalPoints: ACHIEVEMENTS.reduce((s, a) => s + a.points, 0),
          rarities: ['common', 'uncommon', 'rare', 'epic', 'legendary'],
          categories: CATEGORIES.map(c => c.name),
          features: ['Progress tracking', 'Hidden achievements', 'Point system', 'Rarity tiers']
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

export function isAchievementSystemAvailable(): boolean { return true; }
