/**
 * SKILL LOADER TESTS
 *
 * Tests for src/lib/skills/skill-loader.ts
 * Covers frontmatter parsing, SkillLoader class, buildSkillPrompt,
 * getSkillTools, executeSkillTool, isSkillTool, and singleton management.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (hoisted)
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@anthropic-ai/sdk', () => {
  return { default: vi.fn() };
});

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import {
  SkillLoader,
  buildSkillPrompt,
  getSkillTools,
  executeSkillTool,
  isSkillTool,
  getSkillLoader,
  clearSkillLoader,
} from './skill-loader';
import type { Skill, SkillMetadata } from './skill-loader';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    metadata: {
      name: 'test-skill',
      description: 'A test skill',
      allowedTools: ['tool1', 'tool2'],
      model: 'sonnet',
      tags: ['test'],
      ...overrides.metadata,
    } as SkillMetadata,
    content: 'You are a test assistant. Handle: {{input}}',
    filePath: '/workspace/.claude/skills/test-skill.md',
    lastModified: new Date('2026-01-01'),
    ...overrides,
  };
}

const VALID_SKILL_FILE = `---
name: "review"
description: "Code review skill"
model: opus
maxTokens: 4096
temperature: 0.7
author: "test-user"
version: "1.0"
allowedTools: [read_file, write_file]
tags: [code, review]
---

Review the following code: {{input}}`;

const MINIMAL_SKILL_FILE = `---
name: "minimal"
description: "Minimal skill"
---

Do the thing.`;

const NO_FRONTMATTER_FILE = `Just a plain skill prompt without frontmatter.`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('skills/skill-loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSkillLoader();
  });

  // ===== SkillLoader constructor and basic methods =====

  describe('SkillLoader', () => {
    it('creates a loader with provided file system functions', () => {
      const loader = new SkillLoader(vi.fn(), vi.fn(), vi.fn());
      expect(loader).toBeInstanceOf(SkillLoader);
    });

    it('getRegistry returns initial empty registry', () => {
      const loader = new SkillLoader(vi.fn(), vi.fn(), vi.fn());
      const reg = loader.getRegistry();
      expect(reg.skills.size).toBe(0);
      expect(reg.watchEnabled).toBe(false);
    });

    it('getAllSkills returns empty array initially', () => {
      const loader = new SkillLoader(vi.fn(), vi.fn(), vi.fn());
      expect(loader.getAllSkills()).toEqual([]);
    });

    it('getSkillNames returns empty array initially', () => {
      const loader = new SkillLoader(vi.fn(), vi.fn(), vi.fn());
      expect(loader.getSkillNames()).toEqual([]);
    });

    it('hasSkill returns false for unknown skill', () => {
      const loader = new SkillLoader(vi.fn(), vi.fn(), vi.fn());
      expect(loader.hasSkill('nonexistent')).toBe(false);
    });

    it('getSkill returns undefined for unknown skill', () => {
      const loader = new SkillLoader(vi.fn(), vi.fn(), vi.fn());
      expect(loader.getSkill('nope')).toBeUndefined();
    });
  });

  // ===== loadSkill =====

  describe('loadSkill', () => {
    it('parses a full frontmatter skill file', async () => {
      const readFile = vi.fn().mockResolvedValue(VALID_SKILL_FILE);
      const fileExists = vi.fn().mockResolvedValue(true);
      const listDir = vi.fn().mockResolvedValue([]);
      const getStat = vi.fn().mockResolvedValue({ mtimeMs: 1700000000000 });

      const loader = new SkillLoader(readFile, fileExists, listDir, getStat);
      const skill = await loader.loadSkill('/workspace/.claude/skills/review.md');

      expect(skill).not.toBeNull();
      expect(skill!.metadata.name).toBe('review');
      expect(skill!.metadata.description).toBe('Code review skill');
      expect(skill!.metadata.model).toBe('opus');
      expect(skill!.metadata.maxTokens).toBe(4096);
      expect(skill!.metadata.temperature).toBe(0.7);
      expect(skill!.metadata.author).toBe('test-user');
      expect(skill!.metadata.version).toBe('1.0');
      expect(skill!.metadata.allowedTools).toEqual(['read_file', 'write_file']);
      expect(skill!.metadata.tags).toEqual(['code', 'review']);
    });

    it('uses filename as name when name is missing from frontmatter', async () => {
      const readFile = vi.fn().mockResolvedValue('---\ndescription: "No name"\n---\nContent');
      const loader = new SkillLoader(readFile, vi.fn(), vi.fn());
      const skill = await loader.loadSkill('/workspace/.claude/skills/my-skill.md');

      expect(skill!.metadata.name).toBe('my-skill');
    });

    it('generates default description when missing', async () => {
      const readFile = vi.fn().mockResolvedValue('---\nname: "test"\n---\nContent');
      const loader = new SkillLoader(readFile, vi.fn(), vi.fn());
      const skill = await loader.loadSkill('/path/test.md');

      expect(skill!.metadata.description).toBe('Custom skill: test');
    });

    it('handles files with no frontmatter', async () => {
      const readFile = vi.fn().mockResolvedValue(NO_FRONTMATTER_FILE);
      const loader = new SkillLoader(readFile, vi.fn(), vi.fn());
      const skill = await loader.loadSkill('/path/plain.md');

      expect(skill).not.toBeNull();
      expect(skill!.content).toBe(NO_FRONTMATTER_FILE);
    });

    it('returns null when readFile throws', async () => {
      const readFile = vi.fn().mockRejectedValue(new Error('ENOENT'));
      const loader = new SkillLoader(readFile, vi.fn(), vi.fn());
      const skill = await loader.loadSkill('/nonexistent.md');

      expect(skill).toBeNull();
    });

    it('uses lastModified from file stat', async () => {
      const readFile = vi.fn().mockResolvedValue(MINIMAL_SKILL_FILE);
      const getStat = vi.fn().mockResolvedValue({ mtimeMs: 1700000000000 });
      const loader = new SkillLoader(readFile, vi.fn(), vi.fn(), getStat);
      const skill = await loader.loadSkill('/path/skill.md');

      expect(skill!.lastModified.getTime()).toBe(1700000000000);
    });

    it('uses current date when stat returns null', async () => {
      const readFile = vi.fn().mockResolvedValue(MINIMAL_SKILL_FILE);
      const getStat = vi.fn().mockResolvedValue(null);
      const loader = new SkillLoader(readFile, vi.fn(), vi.fn(), getStat);
      const before = Date.now();
      const skill = await loader.loadSkill('/path/skill.md');
      const after = Date.now();

      expect(skill!.lastModified.getTime()).toBeGreaterThanOrEqual(before);
      expect(skill!.lastModified.getTime()).toBeLessThanOrEqual(after);
    });

    it('trims body content', async () => {
      const readFile = vi.fn().mockResolvedValue('---\nname: "test"\n---\n\n  Hello world  \n\n');
      const loader = new SkillLoader(readFile, vi.fn(), vi.fn());
      const skill = await loader.loadSkill('/path/test.md');

      expect(skill!.content).toBe('Hello world');
    });

    it('only accepts valid model values', async () => {
      const readFile = vi.fn().mockResolvedValue('---\nname: "test"\nmodel: gpt4\n---\nContent');
      const loader = new SkillLoader(readFile, vi.fn(), vi.fn());
      const skill = await loader.loadSkill('/path/test.md');

      expect(skill!.metadata.model).toBeUndefined();
    });
  });

  // ===== loadSkills =====

  describe('loadSkills', () => {
    it('loads all .md files from the skills directory', async () => {
      const readFile = vi.fn().mockResolvedValue(MINIMAL_SKILL_FILE);
      const fileExists = vi.fn().mockResolvedValue(true);
      const listDir = vi.fn().mockResolvedValue(['skill-a.md', 'skill-b.md', 'readme.txt']);

      const loader = new SkillLoader(readFile, fileExists, listDir);
      const registry = await loader.loadSkills('/workspace');

      // Should only load .md files (2 of 3)
      expect(registry.skills.size).toBe(1); // Both resolve to same "minimal" name
      expect(listDir).toHaveBeenCalledWith('/workspace/.claude/skills');
    });

    it('returns empty registry when skills dir does not exist', async () => {
      const fileExists = vi.fn().mockResolvedValue(false);
      const loader = new SkillLoader(vi.fn(), fileExists, vi.fn());
      const registry = await loader.loadSkills('/workspace');

      expect(registry.skills.size).toBe(0);
    });

    it('handles errors in individual skill loading gracefully', async () => {
      const readFile = vi
        .fn()
        .mockResolvedValueOnce(MINIMAL_SKILL_FILE)
        .mockRejectedValueOnce(new Error('corrupt'));
      const fileExists = vi.fn().mockResolvedValue(true);
      const listDir = vi.fn().mockResolvedValue(['good.md', 'bad.md']);

      const loader = new SkillLoader(readFile, fileExists, listDir);
      const registry = await loader.loadSkills('/workspace');

      // Should still load the good skill
      expect(registry.skills.size).toBe(1);
    });

    it('handles complete directory listing failure', async () => {
      const fileExists = vi.fn().mockResolvedValue(true);
      const listDir = vi.fn().mockRejectedValue(new Error('Permission denied'));
      const loader = new SkillLoader(vi.fn(), fileExists, listDir);

      const registry = await loader.loadSkills('/workspace');
      expect(registry.skills.size).toBe(0);
    });
  });

  // ===== getSkill / hasSkill / getAllSkills =====

  describe('skill retrieval after loading', () => {
    let loader: SkillLoader;

    beforeEach(async () => {
      const readFile = vi.fn().mockResolvedValue(VALID_SKILL_FILE);
      const fileExists = vi.fn().mockResolvedValue(true);
      const listDir = vi.fn().mockResolvedValue(['review.md']);

      loader = new SkillLoader(readFile, fileExists, listDir);
      await loader.loadSkills('/workspace');
    });

    it('getSkill returns loaded skill by name', () => {
      const skill = loader.getSkill('review');
      expect(skill).toBeDefined();
      expect(skill!.metadata.name).toBe('review');
    });

    it('hasSkill returns true for loaded skill', () => {
      expect(loader.hasSkill('review')).toBe(true);
    });

    it('getAllSkills returns array of all skills', () => {
      const skills = loader.getAllSkills();
      expect(skills).toHaveLength(1);
    });

    it('getSkillNames returns array of skill names', () => {
      expect(loader.getSkillNames()).toEqual(['review']);
    });
  });

  // ===== reloadSkill =====

  describe('reloadSkill', () => {
    it('reloads an existing skill', async () => {
      const readFile = vi.fn().mockResolvedValue(VALID_SKILL_FILE);
      const fileExists = vi.fn().mockResolvedValue(true);
      const listDir = vi.fn().mockResolvedValue(['review.md']);

      const loader = new SkillLoader(readFile, fileExists, listDir);
      await loader.loadSkills('/workspace');

      const reloaded = await loader.reloadSkill('review', '/workspace');
      expect(reloaded).not.toBeNull();
      expect(reloaded!.metadata.name).toBe('review');
    });

    it('returns null for unknown skill name', async () => {
      const loader = new SkillLoader(vi.fn(), vi.fn(), vi.fn());
      const result = await loader.reloadSkill('nonexistent', '/workspace');
      expect(result).toBeNull();
    });
  });

  // ===== reloadAll =====

  describe('reloadAll', () => {
    it('clears and reloads all skills', async () => {
      const readFile = vi.fn().mockResolvedValue(VALID_SKILL_FILE);
      const fileExists = vi.fn().mockResolvedValue(true);
      const listDir = vi.fn().mockResolvedValue(['review.md']);

      const loader = new SkillLoader(readFile, fileExists, listDir);
      await loader.loadSkills('/workspace');
      expect(loader.getAllSkills()).toHaveLength(1);

      // Reload with empty dir
      listDir.mockResolvedValue([]);
      const registry = await loader.reloadAll('/workspace');
      expect(registry.skills.size).toBe(0);
    });
  });

  // ===== buildSkillPrompt =====

  describe('buildSkillPrompt', () => {
    it('replaces {{input}} placeholder with user input', () => {
      const skill = makeSkill({ content: 'Process this: {{input}}' });
      const prompt = buildSkillPrompt(skill, 'my code here');
      expect(prompt).toContain('Process this: my code here');
    });

    it('replaces {{user_input}} placeholder', () => {
      const skill = makeSkill({ content: 'Review: {{user_input}}' });
      const prompt = buildSkillPrompt(skill, 'some input');
      expect(prompt).toContain('Review: some input');
    });

    it('replaces all occurrences of {{input}}', () => {
      const skill = makeSkill({ content: 'First: {{input}} Second: {{input}}' });
      const prompt = buildSkillPrompt(skill, 'X');
      expect(prompt).toBe('First: X Second: X\n\nAllowed tools for this skill: tool1, tool2');
    });

    it('appends allowed tools when present', () => {
      const skill = makeSkill();
      const prompt = buildSkillPrompt(skill);
      expect(prompt).toContain('Allowed tools for this skill: tool1, tool2');
    });

    it('does not append tools section when allowedTools is absent', () => {
      const skill = makeSkill({
        metadata: { name: 'no-tools', description: 'No tools' } as SkillMetadata,
      });
      const prompt = buildSkillPrompt(skill);
      expect(prompt).not.toContain('Allowed tools');
    });

    it('leaves content intact when no userInput provided', () => {
      const skill = makeSkill({ content: 'Static prompt with {{input}}' });
      const prompt = buildSkillPrompt(skill);
      // Without userInput the placeholder stays
      expect(prompt).toContain('{{input}}');
    });
  });

  // ===== getSkillTools =====

  describe('getSkillTools', () => {
    it('returns an array of 4 tool definitions', () => {
      const tools = getSkillTools();
      expect(tools).toHaveLength(4);
    });

    it('includes skill_list tool', () => {
      const tools = getSkillTools();
      expect(tools.find((t) => t.name === 'skill_list')).toBeDefined();
    });

    it('includes skill_run tool', () => {
      const tools = getSkillTools();
      expect(tools.find((t) => t.name === 'skill_run')).toBeDefined();
    });

    it('includes skill_create tool', () => {
      const tools = getSkillTools();
      expect(tools.find((t) => t.name === 'skill_create')).toBeDefined();
    });

    it('includes skill_reload tool', () => {
      const tools = getSkillTools();
      expect(tools.find((t) => t.name === 'skill_reload')).toBeDefined();
    });

    it('skill_run requires name parameter', () => {
      const tools = getSkillTools();
      const runTool = tools.find((t) => t.name === 'skill_run');
      expect(runTool!.input_schema.required).toContain('name');
    });

    it('skill_create requires name, description, content', () => {
      const tools = getSkillTools();
      const createTool = tools.find((t) => t.name === 'skill_create');
      expect(createTool!.input_schema.required).toEqual(['name', 'description', 'content']);
    });
  });

  // ===== isSkillTool =====

  describe('isSkillTool', () => {
    it('returns true for skill_list', () => {
      expect(isSkillTool('skill_list')).toBe(true);
    });

    it('returns true for skill_run', () => {
      expect(isSkillTool('skill_run')).toBe(true);
    });

    it('returns true for skill_create', () => {
      expect(isSkillTool('skill_create')).toBe(true);
    });

    it('returns true for skill_reload', () => {
      expect(isSkillTool('skill_reload')).toBe(true);
    });

    it('returns false for non-skill tools', () => {
      expect(isSkillTool('workspace')).toBe(false);
      expect(isSkillTool('generate_image')).toBe(false);
      expect(isSkillTool('search')).toBe(false);
    });
  });

  // ===== executeSkillTool =====

  describe('executeSkillTool', () => {
    let loader: SkillLoader;
    const mockReadFile = vi.fn();
    const mockWriteFile = vi.fn().mockResolvedValue(undefined);
    const mockFileExists = vi.fn().mockResolvedValue(true);

    beforeEach(async () => {
      const readFile = vi.fn().mockResolvedValue(VALID_SKILL_FILE);
      const fileExists = vi.fn().mockResolvedValue(true);
      const listDir = vi.fn().mockResolvedValue(['review.md']);

      loader = new SkillLoader(readFile, fileExists, listDir);
      await loader.loadSkills('/workspace');
    });

    describe('skill_list', () => {
      it('lists all loaded skills', async () => {
        const result = await executeSkillTool(
          'skill_list',
          {},
          loader,
          mockReadFile,
          mockWriteFile,
          mockFileExists,
          '/workspace'
        );
        expect(result).toContain('Available skills (1)');
        expect(result).toContain('/review');
      });

      it('returns message when no skills loaded', async () => {
        const emptyLoader = new SkillLoader(vi.fn(), vi.fn(), vi.fn());
        const result = await executeSkillTool(
          'skill_list',
          {},
          emptyLoader,
          mockReadFile,
          mockWriteFile,
          mockFileExists
        );
        expect(result).toContain('No custom skills found');
      });
    });

    describe('skill_run', () => {
      it('runs a skill and returns the prompt', async () => {
        const result = await executeSkillTool(
          'skill_run',
          { name: 'review', input: 'my code' },
          loader,
          mockReadFile,
          mockWriteFile,
          mockFileExists,
          '/workspace'
        );
        expect(result).toContain('[Skill: review]');
        expect(result).toContain('my code');
      });

      it('returns error when skill name is missing', async () => {
        const result = await executeSkillTool(
          'skill_run',
          {},
          loader,
          mockReadFile,
          mockWriteFile,
          mockFileExists
        );
        expect(result).toContain('Error: skill name is required');
      });

      it('returns not found message for unknown skill', async () => {
        const result = await executeSkillTool(
          'skill_run',
          { name: 'unknown' },
          loader,
          mockReadFile,
          mockWriteFile,
          mockFileExists
        );
        expect(result).toContain('Skill "unknown" not found');
      });
    });

    describe('skill_create', () => {
      it('creates a skill file and returns success message', async () => {
        const result = await executeSkillTool(
          'skill_create',
          { name: 'deploy', description: 'Deploy skill', content: 'Deploy the app' },
          loader,
          mockReadFile,
          mockWriteFile,
          mockFileExists,
          '/workspace'
        );
        expect(result).toContain('Created skill "deploy"');
        expect(mockWriteFile).toHaveBeenCalled();
      });

      it('includes model in the file when provided', async () => {
        await executeSkillTool(
          'skill_create',
          { name: 'fast', description: 'Fast', content: 'Quick', model: 'haiku' },
          loader,
          mockReadFile,
          mockWriteFile,
          mockFileExists,
          '/workspace'
        );
        const writtenContent = mockWriteFile.mock.calls[0][1] as string;
        expect(writtenContent).toContain('model: haiku');
      });

      it('includes allowedTools in the file when provided', async () => {
        await executeSkillTool(
          'skill_create',
          {
            name: 'tooled',
            description: 'Tooled',
            content: 'Content',
            allowedTools: ['bash', 'read'],
          },
          loader,
          mockReadFile,
          mockWriteFile,
          mockFileExists,
          '/workspace'
        );
        const writtenContent = mockWriteFile.mock.calls[0][1] as string;
        expect(writtenContent).toContain('allowedTools:');
        expect(writtenContent).toContain('"bash"');
      });

      it('returns error when required fields are missing', async () => {
        const result = await executeSkillTool(
          'skill_create',
          { name: 'incomplete' },
          loader,
          mockReadFile,
          mockWriteFile,
          mockFileExists
        );
        expect(result).toContain('Error: name, description, and content are required');
      });
    });

    describe('skill_reload', () => {
      it('reloads all skills and returns count', async () => {
        const result = await executeSkillTool(
          'skill_reload',
          {},
          loader,
          mockReadFile,
          mockWriteFile,
          mockFileExists,
          '/workspace'
        );
        expect(result).toContain('Reloaded');
        expect(result).toContain('skill(s)');
      });
    });

    describe('unknown tool', () => {
      it('returns error message for unknown tool name', async () => {
        const result = await executeSkillTool(
          'skill_unknown',
          {},
          loader,
          mockReadFile,
          mockWriteFile,
          mockFileExists
        );
        expect(result).toContain('Unknown skill tool: skill_unknown');
      });
    });
  });

  // ===== Singleton management =====

  describe('getSkillLoader / clearSkillLoader', () => {
    it('returns a SkillLoader instance', () => {
      const loader = getSkillLoader(vi.fn(), vi.fn(), vi.fn());
      expect(loader).toBeInstanceOf(SkillLoader);
    });

    it('returns the same instance on repeated calls', () => {
      const a = getSkillLoader(vi.fn(), vi.fn(), vi.fn());
      const b = getSkillLoader(vi.fn(), vi.fn(), vi.fn());
      expect(a).toBe(b);
    });

    it('returns a new instance after clearSkillLoader', () => {
      const a = getSkillLoader(vi.fn(), vi.fn(), vi.fn());
      clearSkillLoader();
      const b = getSkillLoader(vi.fn(), vi.fn(), vi.fn());
      expect(a).not.toBe(b);
    });
  });
});
