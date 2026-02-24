import { describe, it, expect, vi } from 'vitest';
import {
  parseMemorySections,
  formatMemoryForContext,
  ProjectMemoryManager,
  getMemoryManager,
  getMemoryTools,
  DEFAULT_MEMORY_TEMPLATE,
  type ProjectMemory,
} from './memory';

// -------------------------------------------------------------------
// DEFAULT_MEMORY_TEMPLATE
// -------------------------------------------------------------------
describe('DEFAULT_MEMORY_TEMPLATE', () => {
  it('should contain project overview section', () => {
    expect(DEFAULT_MEMORY_TEMPLATE).toContain('## Project Overview');
  });

  it('should contain preferences section', () => {
    expect(DEFAULT_MEMORY_TEMPLATE).toContain('## Preferences');
  });

  it('should contain do not section', () => {
    expect(DEFAULT_MEMORY_TEMPLATE).toContain('## Do Not');
  });
});

// -------------------------------------------------------------------
// parseMemorySections
// -------------------------------------------------------------------
describe('parseMemorySections', () => {
  it('should parse sections from markdown', () => {
    const md = '## Instructions\n\nDo this\n\n## Notes\n\nSome notes';
    const sections = parseMemorySections(md);
    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe('Instructions');
    expect(sections[0].content).toContain('Do this');
    expect(sections[1].title).toBe('Notes');
  });

  it('should detect instructions type', () => {
    const sections = parseMemorySections('## Instructions\n\nDo this');
    expect(sections[0].type).toBe('instructions');
  });

  it('should detect common tasks as instructions type', () => {
    const sections = parseMemorySections('## Common Tasks\n\nRun tests');
    expect(sections[0].type).toBe('instructions');
  });

  it('should detect do not as instructions type', () => {
    const sections = parseMemorySections("## Do Not\n\nDon't push to main");
    expect(sections[0].type).toBe('instructions');
  });

  it('should detect code style as patterns type', () => {
    const sections = parseMemorySections('## Code Style\n\nUse TypeScript');
    expect(sections[0].type).toBe('patterns');
  });

  it('should detect conventions as patterns type', () => {
    const sections = parseMemorySections('## Conventions\n\nUse camelCase');
    expect(sections[0].type).toBe('patterns');
  });

  it('should detect project overview as context type', () => {
    const sections = parseMemorySections('## Project Overview\n\nThis is a web app');
    expect(sections[0].type).toBe('context');
  });

  it('should detect architecture as context type', () => {
    const sections = parseMemorySections('## Architecture Notes\n\nUse microservices');
    expect(sections[0].type).toBe('context');
  });

  it('should detect preferences type', () => {
    const sections = parseMemorySections('## Preferences\n\nUse dark theme');
    expect(sections[0].type).toBe('preferences');
  });

  it('should default to notes for unknown sections', () => {
    const sections = parseMemorySections('## Random Section\n\nSome text');
    expect(sections[0].type).toBe('notes');
  });

  it('should skip content before first section', () => {
    const md = '# Title\n\nSome intro\n\n## Real Section\n\nContent';
    const sections = parseMemorySections(md);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('Real Section');
  });

  it('should handle empty content', () => {
    expect(parseMemorySections('')).toHaveLength(0);
  });

  it('should handle content with no sections', () => {
    expect(parseMemorySections('Just plain text')).toHaveLength(0);
  });

  it('should parse the default template', () => {
    const sections = parseMemorySections(DEFAULT_MEMORY_TEMPLATE);
    expect(sections.length).toBeGreaterThan(0);
  });
});

// -------------------------------------------------------------------
// formatMemoryForContext
// -------------------------------------------------------------------
describe('formatMemoryForContext', () => {
  const baseMemory: ProjectMemory = {
    projectPath: '/workspace',
    memoryPath: '/workspace/CODELAB.md',
    content: 'Some content',
    lastUpdated: new Date().toISOString(),
    sections: [],
  };

  it('should return empty string for empty content', () => {
    const memory = { ...baseMemory, content: '' };
    expect(formatMemoryForContext(memory)).toBe('');
  });

  it('should return empty string for whitespace-only content', () => {
    const memory = { ...baseMemory, content: '   ' };
    expect(formatMemoryForContext(memory)).toBe('');
  });

  it('should include header', () => {
    const result = formatMemoryForContext(baseMemory);
    expect(result).toContain('PROJECT MEMORY');
  });

  it('should include instructions section', () => {
    const memory: ProjectMemory = {
      ...baseMemory,
      sections: [{ title: 'Do Not', content: "Don't push to main", type: 'instructions' }],
    };
    const result = formatMemoryForContext(memory);
    expect(result).toContain('Instructions');
    expect(result).toContain("Don't push to main");
  });

  it('should include patterns section', () => {
    const memory: ProjectMemory = {
      ...baseMemory,
      sections: [{ title: 'Code Style', content: 'Use TypeScript', type: 'patterns' }],
    };
    const result = formatMemoryForContext(memory);
    expect(result).toContain('Code Patterns');
    expect(result).toContain('Use TypeScript');
  });

  it('should include preferences section', () => {
    const memory: ProjectMemory = {
      ...baseMemory,
      sections: [{ title: 'Preferences', content: 'Small commits', type: 'preferences' }],
    };
    const result = formatMemoryForContext(memory);
    expect(result).toContain('Preferences');
    expect(result).toContain('Small commits');
  });

  it('should include context section', () => {
    const memory: ProjectMemory = {
      ...baseMemory,
      sections: [{ title: 'Architecture', content: 'Microservices', type: 'context' }],
    };
    const result = formatMemoryForContext(memory);
    expect(result).toContain('Context');
    expect(result).toContain('Microservices');
  });

  it('should order sections: instructions, patterns, preferences, context', () => {
    const memory: ProjectMemory = {
      ...baseMemory,
      sections: [
        { title: 'Architecture', content: 'Micro', type: 'context' },
        { title: 'Style', content: 'TS', type: 'patterns' },
        { title: 'Prefs', content: 'Small', type: 'preferences' },
        { title: 'Rules', content: 'No push', type: 'instructions' },
      ],
    };
    const result = formatMemoryForContext(memory);
    const instructionsPos = result.indexOf('Instructions');
    const patternsPos = result.indexOf('Code Patterns');
    const prefsPos = result.indexOf('Preferences');
    const contextPos = result.indexOf('Context');
    expect(instructionsPos).toBeLessThan(patternsPos);
    expect(patternsPos).toBeLessThan(prefsPos);
    expect(prefsPos).toBeLessThan(contextPos);
  });
});

// -------------------------------------------------------------------
// ProjectMemoryManager
// -------------------------------------------------------------------
describe('ProjectMemoryManager', () => {
  it('should start with no memory', () => {
    const mgr = new ProjectMemoryManager();
    expect(mgr.getMemory()).toBeNull();
    expect(mgr.getContextString()).toBe('');
  });

  it('should load memory from file', async () => {
    const mgr = new ProjectMemoryManager();
    const readFile = vi.fn().mockResolvedValue('## Instructions\n\nDo this');
    const memory = await mgr.load(readFile);
    expect(memory).not.toBeNull();
    expect(memory?.sections).toHaveLength(1);
    expect(readFile).toHaveBeenCalledWith('/workspace/CODELAB.md');
  });

  it('should return null if file not found', async () => {
    const mgr = new ProjectMemoryManager();
    const readFile = vi.fn().mockRejectedValue(new Error('Not found'));
    const memory = await mgr.load(readFile);
    expect(memory).toBeNull();
  });

  it('should create default memory file', async () => {
    const mgr = new ProjectMemoryManager();
    const writeFile = vi.fn().mockResolvedValue(undefined);
    const memory = await mgr.create(writeFile);
    expect(memory.content).toContain('Project Memory');
    expect(writeFile).toHaveBeenCalledWith('/workspace/CODELAB.md', expect.any(String));
  });

  it('should update memory content', async () => {
    const mgr = new ProjectMemoryManager();
    const writeFile = vi.fn().mockResolvedValue(undefined);
    const newContent = '## New Instructions\n\nUpdated rules';
    const memory = await mgr.update(newContent, writeFile);
    expect(memory.content).toBe(newContent);
    expect(memory.sections).toHaveLength(1);
  });

  it('should return context string after loading', async () => {
    const mgr = new ProjectMemoryManager();
    const readFile = vi.fn().mockResolvedValue('## Preferences\n\nUse dark theme');
    await mgr.load(readFile);
    const ctx = mgr.getContextString();
    expect(ctx).toContain('PROJECT MEMORY');
    expect(ctx).toContain('dark theme');
  });
});

// -------------------------------------------------------------------
// getMemoryManager (singleton)
// -------------------------------------------------------------------
describe('getMemoryManager', () => {
  it('should return same instance', () => {
    expect(getMemoryManager()).toBe(getMemoryManager());
  });
});

// -------------------------------------------------------------------
// getMemoryTools
// -------------------------------------------------------------------
describe('getMemoryTools', () => {
  it('should return 4 tools', () => {
    const tools = getMemoryTools();
    expect(tools).toHaveLength(4);
    expect(tools.map((t) => t.name)).toEqual([
      'memory_read',
      'memory_create',
      'memory_update',
      'memory_add_section',
    ]);
  });
});
