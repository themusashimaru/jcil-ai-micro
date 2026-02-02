/**
 * SPRITE ANIMATION TOOL
 * Sprite sheet and animation frame management
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface Frame { x: number; y: number; width: number; height: number; duration: number; }
interface Animation { name: string; frames: Frame[]; loop: boolean; speed: number; }
interface SpriteSheet { name: string; width: number; height: number; tileWidth: number; tileHeight: number; animations: Map<string, Animation>; }

function createSpriteSheet(name: string, width: number, height: number, tileW: number, tileH: number): SpriteSheet {
  return { name, width, height, tileWidth: tileW, tileHeight: tileH, animations: new Map() };
}

function addAnimation(sheet: SpriteSheet, name: string, frameIndices: number[], frameDuration: number, loop: boolean = true): Animation {
  const cols = Math.floor(sheet.width / sheet.tileWidth);
  const frames: Frame[] = frameIndices.map(idx => ({
    x: (idx % cols) * sheet.tileWidth,
    y: Math.floor(idx / cols) * sheet.tileHeight,
    width: sheet.tileWidth,
    height: sheet.tileHeight,
    duration: frameDuration
  }));
  const anim: Animation = { name, frames, loop, speed: 1 };
  sheet.animations.set(name, anim);
  return anim;
}

function getFrameAtTime(animation: Animation, timeMs: number): { frame: Frame; index: number } {
  const totalDuration = animation.frames.reduce((sum, f) => sum + f.duration, 0);
  const t = animation.loop ? timeMs % totalDuration : Math.min(timeMs, totalDuration);
  let accumulated = 0;
  for (let i = 0; i < animation.frames.length; i++) {
    accumulated += animation.frames[i].duration;
    if (t < accumulated) return { frame: animation.frames[i], index: i };
  }
  return { frame: animation.frames[animation.frames.length - 1], index: animation.frames.length - 1 };
}

function animationToAscii(animation: Animation, currentFrame: number): string {
  const lines: string[] = [];
  lines.push(`Animation: ${animation.name} (${animation.frames.length} frames, loop: ${animation.loop})`);
  lines.push('Timeline:');
  let timeline = '';
  for (let i = 0; i < animation.frames.length; i++) {
    const marker = i === currentFrame ? '[*]' : `[${i}]`;
    timeline += marker + '-'.repeat(Math.floor(animation.frames[i].duration / 50));
  }
  lines.push(timeline);
  lines.push(`Current: Frame ${currentFrame} at (${animation.frames[currentFrame]?.x}, ${animation.frames[currentFrame]?.y})`);
  return lines.join('\n');
}

function generateWalkCycle(): SpriteSheet {
  const sheet = createSpriteSheet('character', 256, 256, 32, 32);
  addAnimation(sheet, 'idle', [0, 1, 2, 1], 200, true);
  addAnimation(sheet, 'walk_down', [0, 1, 2, 3], 150, true);
  addAnimation(sheet, 'walk_up', [4, 5, 6, 7], 150, true);
  addAnimation(sheet, 'walk_left', [8, 9, 10, 11], 150, true);
  addAnimation(sheet, 'walk_right', [12, 13, 14, 15], 150, true);
  addAnimation(sheet, 'attack', [16, 17, 18, 19, 20], 100, false);
  addAnimation(sheet, 'hurt', [21, 22], 200, false);
  addAnimation(sheet, 'death', [23, 24, 25, 26], 200, false);
  return sheet;
}

export const spriteAnimationTool: UnifiedTool = {
  name: 'sprite_animation',
  description: 'Sprite Animation: create_sheet, add_animation, get_frame, walk_cycle, timeline',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['create_sheet', 'add_animation', 'get_frame', 'walk_cycle', 'timeline', 'info'] },
      sheetWidth: { type: 'number' },
      sheetHeight: { type: 'number' },
      tileWidth: { type: 'number' },
      tileHeight: { type: 'number' },
      animationName: { type: 'string' },
      frameIndices: { type: 'array' },
      frameDuration: { type: 'number' },
      loop: { type: 'boolean' },
      time: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executeSpriteAnimation(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'create_sheet':
        const sheet = createSpriteSheet('custom', args.sheetWidth || 256, args.sheetHeight || 256, args.tileWidth || 32, args.tileHeight || 32);
        const cols = Math.floor(sheet.width / sheet.tileWidth);
        const rows = Math.floor(sheet.height / sheet.tileHeight);
        result = { sheet: { name: sheet.name, dimensions: { width: sheet.width, height: sheet.height }, tiles: { width: sheet.tileWidth, height: sheet.tileHeight }, totalTiles: cols * rows, grid: `${cols}x${rows}` } };
        break;
      case 'add_animation':
        const animSheet = createSpriteSheet('custom', 256, 256, 32, 32);
        const anim = addAnimation(animSheet, args.animationName || 'custom', args.frameIndices || [0, 1, 2, 3], args.frameDuration || 100, args.loop !== false);
        result = { animation: { name: anim.name, frameCount: anim.frames.length, loop: anim.loop, totalDuration: anim.frames.reduce((s, f) => s + f.duration, 0) + 'ms', frames: anim.frames } };
        break;
      case 'get_frame':
        const walkSheet = generateWalkCycle();
        const walkAnim = walkSheet.animations.get(args.animationName || 'walk_down')!;
        const frameInfo = getFrameAtTime(walkAnim, args.time || 0);
        result = { animation: args.animationName || 'walk_down', time: args.time || 0, currentFrame: frameInfo.index, frameData: frameInfo.frame };
        break;
      case 'walk_cycle':
        const charSheet = generateWalkCycle();
        result = {
          spriteSheet: { name: charSheet.name, dimensions: `${charSheet.width}x${charSheet.height}`, tileSize: `${charSheet.tileWidth}x${charSheet.tileHeight}` },
          animations: Array.from(charSheet.animations.entries()).map(([name, anim]) => ({
            name, frameCount: anim.frames.length, loop: anim.loop, duration: anim.frames.reduce((s, f) => s + f.duration, 0)
          }))
        };
        break;
      case 'timeline':
        const tlSheet = generateWalkCycle();
        const tlAnim = tlSheet.animations.get(args.animationName || 'attack')!;
        const currentFrame = Math.floor((args.time || 0) / 100) % tlAnim.frames.length;
        result = { ascii: animationToAscii(tlAnim, currentFrame), animation: tlAnim };
        break;
      case 'info':
        result = {
          description: 'Sprite sheet and animation management',
          standardAnimations: ['idle', 'walk', 'run', 'jump', 'attack', 'hurt', 'death'],
          commonTileSizes: ['16x16', '32x32', '48x48', '64x64'],
          features: ['frame-based timing', 'looping', 'non-looping', 'variable frame duration']
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

export function isSpriteAnimationAvailable(): boolean { return true; }
