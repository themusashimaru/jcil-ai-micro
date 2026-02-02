/**
 * PROCEDURAL STORY TOOL
 * Generate procedural narratives, plot structures, and character arcs
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Character { name: string; role: string; traits: string[]; motivation: string; arc: string; }
interface PlotPoint { type: string; description: string; characters: string[]; tension: number; }
interface Story { title: string; genre: string; setting: string; characters: Character[]; plotPoints: PlotPoint[]; theme: string; }

const GENRES = ['fantasy', 'sci-fi', 'mystery', 'romance', 'thriller', 'horror', 'adventure', 'drama'];
const ROLES = ['protagonist', 'antagonist', 'mentor', 'sidekick', 'love_interest', 'rival', 'guide', 'trickster'];
const TRAITS = ['brave', 'cunning', 'loyal', 'ambitious', 'kind', 'mysterious', 'reckless', 'wise', 'naive', 'determined', 'cynical', 'hopeful'];
const MOTIVATIONS = ['revenge', 'love', 'power', 'redemption', 'survival', 'justice', 'freedom', 'knowledge', 'wealth', 'family'];
const ARCS = ['hero_journey', 'fall_from_grace', 'redemption', 'coming_of_age', 'tragedy', 'rags_to_riches', 'rebirth', 'overcoming_monster'];
const THEMES = ['good_vs_evil', 'love_conquers_all', 'power_corrupts', 'identity', 'sacrifice', 'freedom_vs_security', 'nature_vs_nurture', 'fate_vs_choice'];

const PLOT_STRUCTURES: Record<string, string[]> = {
  three_act: ['setup', 'confrontation', 'resolution'],
  hero_journey: ['ordinary_world', 'call_to_adventure', 'refusal', 'meeting_mentor', 'crossing_threshold', 'tests_allies_enemies', 'approach', 'ordeal', 'reward', 'road_back', 'resurrection', 'return_with_elixir'],
  five_act: ['exposition', 'rising_action', 'climax', 'falling_action', 'denouement'],
  save_the_cat: ['opening', 'theme_stated', 'setup', 'catalyst', 'debate', 'break_into_two', 'b_story', 'fun_and_games', 'midpoint', 'bad_guys_close_in', 'all_is_lost', 'dark_night_soul', 'break_into_three', 'finale', 'final_image']
};

const SETTINGS: Record<string, string[]> = {
  fantasy: ['enchanted forest', 'ancient kingdom', 'floating islands', 'dragon mountains', 'elven city'],
  'sci-fi': ['space station', 'dystopian city', 'alien planet', 'colony ship', 'virtual reality'],
  mystery: ['foggy London', 'small town', 'grand mansion', 'cruise ship', 'university campus'],
  romance: ['Paris', 'small coastal town', 'bustling city', 'countryside estate', 'tropical island'],
  thriller: ['urban metropolis', 'government facility', 'remote cabin', 'international locations', 'corporate tower'],
  horror: ['haunted house', 'abandoned asylum', 'cursed village', 'dark forest', 'underground bunker'],
  adventure: ['tropical jungle', 'desert ruins', 'arctic expedition', 'underwater city', 'mountain range'],
  drama: ['suburban neighborhood', 'hospital', 'courtroom', 'family home', 'workplace']
};

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function generateCharacter(role?: string): Character {
  const names = ['Alex', 'Jordan', 'Morgan', 'Riley', 'Quinn', 'Avery', 'Sage', 'Phoenix', 'River', 'Blake', 'Cameron', 'Drew', 'Emery', 'Finley'];
  return {
    name: pick(names),
    role: role || pick(ROLES),
    traits: [pick(TRAITS), pick(TRAITS), pick(TRAITS)].filter((v, i, a) => a.indexOf(v) === i),
    motivation: pick(MOTIVATIONS),
    arc: pick(ARCS)
  };
}

function generatePlotPoint(type: string, characters: Character[], index: number, total: number): PlotPoint {
  const tension = index / total;
  const involvedChars = characters.slice(0, Math.min(2 + Math.floor(Math.random() * 2), characters.length));
  const descriptions: Record<string, string[]> = {
    setup: ['The world is established', 'Characters are introduced', 'Normal life is shown'],
    catalyst: ['An inciting incident occurs', 'Everything changes', 'The call to action arrives'],
    confrontation: ['Heroes face challenges', 'Conflicts intensify', 'Stakes are raised'],
    climax: ['The final battle begins', 'Truth is revealed', 'Everything comes together'],
    resolution: ['Loose ends are tied', 'New normal is established', 'Characters find peace']
  };
  return {
    type,
    description: pick(descriptions[type] || ['The story continues...']),
    characters: involvedChars.map(c => c.name),
    tension: Math.min(1, tension + Math.random() * 0.2)
  };
}

function generateStory(genre?: string, structure?: string, characterCount?: number): Story {
  const g = genre || pick(GENRES);
  const struct = structure || 'three_act';
  const plotTypes = PLOT_STRUCTURES[struct] || PLOT_STRUCTURES.three_act;
  const charCount = characterCount || 3 + Math.floor(Math.random() * 3);
  const characters: Character[] = [generateCharacter('protagonist'), generateCharacter('antagonist')];
  for (let i = 2; i < charCount; i++) characters.push(generateCharacter());
  const plotPoints = plotTypes.map((type, i) => generatePlotPoint(type, characters, i, plotTypes.length));
  const titleWords = ['The', 'A', 'Last', 'First', 'Secret', 'Lost', 'Dark', 'Eternal', 'Silent', 'Broken'];
  const titleNouns = ['Journey', 'Secret', 'Legacy', 'Promise', 'Shadow', 'Storm', 'Dream', 'Truth', 'Path', 'Crown'];
  return {
    title: `${pick(titleWords)} ${pick(titleNouns)}`,
    genre: g,
    setting: pick(SETTINGS[g] || SETTINGS.fantasy),
    characters,
    plotPoints,
    theme: pick(THEMES)
  };
}

function generateCharacterRelationships(characters: Character[]): Array<{ char1: string; char2: string; relationship: string }> {
  const relationships = ['allies', 'enemies', 'rivals', 'friends', 'lovers', 'family', 'mentor/student', 'strangers'];
  const result: Array<{ char1: string; char2: string; relationship: string }> = [];
  for (let i = 0; i < characters.length; i++) {
    for (let j = i + 1; j < characters.length; j++) {
      result.push({ char1: characters[i].name, char2: characters[j].name, relationship: pick(relationships) });
    }
  }
  return result;
}

function storyToSummary(story: Story): string {
  let summary = `**${story.title}**\n*${story.genre} | ${story.setting}*\n\nTheme: ${story.theme.replace(/_/g, ' ')}\n\n`;
  summary += `**Characters:**\n`;
  for (const char of story.characters) {
    summary += `- ${char.name} (${char.role}): ${char.traits.join(', ')}. Motivated by ${char.motivation}.\n`;
  }
  summary += `\n**Plot:**\n`;
  for (const point of story.plotPoints) {
    const tensionBar = '█'.repeat(Math.floor(point.tension * 10)) + '░'.repeat(10 - Math.floor(point.tension * 10));
    summary += `- [${tensionBar}] ${point.type.replace(/_/g, ' ')}: ${point.description}\n`;
  }
  return summary;
}

export const proceduralStoryTool: UnifiedTool = {
  name: 'procedural_story',
  description: 'Procedural Story: generate, character, plot, relationships, summary, structures',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['generate', 'character', 'plot', 'relationships', 'summary', 'structures', 'genres', 'themes'] },
      genre: { type: 'string' },
      structure: { type: 'string' },
      characterCount: { type: 'number' },
      role: { type: 'string' }
    },
    required: ['operation']
  }
};

export async function executeProceduralStory(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;
    switch (args.operation) {
      case 'generate':
        const story = generateStory(args.genre, args.structure, args.characterCount);
        result = { story, summary: storyToSummary(story) };
        break;
      case 'character':
        result = { character: generateCharacter(args.role) };
        break;
      case 'plot':
        const plotStory = generateStory(args.genre, args.structure);
        result = { plotPoints: plotStory.plotPoints, structure: args.structure || 'three_act' };
        break;
      case 'relationships':
        const relStory = generateStory(undefined, undefined, args.characterCount || 5);
        result = { characters: relStory.characters.map(c => c.name), relationships: generateCharacterRelationships(relStory.characters) };
        break;
      case 'summary':
        const sumStory = generateStory(args.genre, args.structure, args.characterCount);
        result = { summary: storyToSummary(sumStory) };
        break;
      case 'structures':
        result = { structures: Object.entries(PLOT_STRUCTURES).map(([k, v]) => ({ name: k, stages: v })) };
        break;
      case 'genres':
        result = { genres: GENRES, settings: SETTINGS };
        break;
      case 'themes':
        result = { themes: THEMES, motivations: MOTIVATIONS, arcs: ARCS };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }
    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isProceduralStoryAvailable(): boolean { return true; }
