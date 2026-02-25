import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                patterns: [
                  {
                    name: 'Arrow functions',
                    description: 'Uses arrow functions',
                    examples: ['() => {}'],
                    contexts: ['everywhere'],
                  },
                ],
                solutions: [{ problem: 'API calls', solution: 'Use axios with interceptors' }],
                conventions: [
                  { type: 'naming', rule: 'camelCase for variables', examples: ['myVar'] },
                ],
              }),
            },
          ],
        }),
      },
    })),
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              user_id: 'user_1',
              patterns: '[]',
              common_solutions: '[]',
              conventions: '[]',
              expertise: '[]',
              updated_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { CodeTelepathy, getCodeTelepathy } from './index';
import type {
  DeveloperProfile,
  CodingPattern,
  Solution,
  Convention,
  ExpertiseArea,
  CrossProjectInsight,
} from './index';

describe('CodeTelepathy', () => {
  let telepathy: CodeTelepathy;

  beforeEach(() => {
    vi.clearAllMocks();
    telepathy = new CodeTelepathy();
  });

  // ----- Type exports -----
  describe('Type exports', () => {
    it('should export DeveloperProfile shape', () => {
      const profile: DeveloperProfile = {
        userId: 'u1',
        patterns: [],
        preferences: new Map(),
        commonSolutions: [],
        conventions: [],
        expertise: [],
        lastUpdated: new Date(),
      };
      expect(profile.userId).toBe('u1');
    });

    it('should export CodingPattern shape', () => {
      const pattern: CodingPattern = {
        id: 'p1',
        name: 'Arrow functions',
        description: 'Uses arrow functions everywhere',
        frequency: 10,
        examples: ['() => {}'],
        contexts: ['components'],
        confidence: 0.9,
      };
      expect(pattern.frequency).toBe(10);
    });

    it('should export Solution shape', () => {
      const solution: Solution = {
        id: 's1',
        problem: 'Auth',
        solution: 'Use NextAuth',
        repos: ['repo1'],
        lastUsed: new Date(),
        timesUsed: 5,
      };
      expect(solution.timesUsed).toBe(5);
    });

    it('should export Convention shape', () => {
      const conv: Convention = {
        id: 'c1',
        type: 'naming',
        rule: 'camelCase',
        examples: ['myVar'],
        consistency: 0.9,
      };
      expect(conv.type).toBe('naming');
    });

    it('should export ExpertiseArea shape', () => {
      const area: ExpertiseArea = {
        domain: 'react',
        level: 'expert',
        evidence: ['50+ files'],
        lastActivity: new Date(),
      };
      expect(area.level).toBe('expert');
    });

    it('should export CrossProjectInsight shape', () => {
      const insight: CrossProjectInsight = {
        type: 'pattern',
        title: 'Test',
        description: 'Desc',
        relevantRepos: ['repo1'],
        confidence: 0.8,
      };
      expect(insight.type).toBe('pattern');
    });
  });

  // ----- Singleton -----
  describe('getCodeTelepathy', () => {
    it('should return a CodeTelepathy instance', () => {
      const instance = getCodeTelepathy();
      expect(instance).toBeInstanceOf(CodeTelepathy);
    });

    it('should return the same instance on subsequent calls', () => {
      const a = getCodeTelepathy();
      const b = getCodeTelepathy();
      expect(a).toBe(b);
    });
  });

  // ----- buildDeveloperProfile -----
  describe('buildDeveloperProfile', () => {
    it('should build a profile from repos', async () => {
      const repos = [
        {
          owner: 'testuser',
          name: 'repo1',
          files: [
            { path: 'src/app.ts', content: 'export const x = 1;' },
            { path: 'src/utils.ts', content: 'export function helper() {}' },
          ],
        },
      ];

      const profile = await telepathy.buildDeveloperProfile('user_1', repos);
      expect(profile.userId).toBe('user_1');
      expect(profile.lastUpdated).toBeInstanceOf(Date);
      expect(Array.isArray(profile.patterns)).toBe(true);
      expect(Array.isArray(profile.commonSolutions)).toBe(true);
      expect(Array.isArray(profile.conventions)).toBe(true);
      expect(Array.isArray(profile.expertise)).toBe(true);
    });

    it('should handle empty repos', async () => {
      const profile = await telepathy.buildDeveloperProfile('user_1', []);
      expect(profile.patterns).toEqual([]);
      expect(profile.expertise).toEqual([]);
    });

    it('should handle AI parse errors gracefully', async () => {
      vi.resetModules();
      vi.mock('@anthropic-ai/sdk', () => ({
        default: vi.fn().mockImplementation(() => ({
          messages: {
            create: vi.fn().mockResolvedValue({
              content: [{ type: 'text', text: 'not json' }],
            }),
          },
        })),
      }));
      vi.mock('@supabase/supabase-js', () => ({
        createClient: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }));
      vi.mock('@/lib/logger', () => ({
        logger: () => ({
          info: vi.fn(),
          error: vi.fn(),
          warn: vi.fn(),
          debug: vi.fn(),
        }),
      }));

      const { CodeTelepathy: CT } = await import('./index');
      const t = new CT();
      const profile = await t.buildDeveloperProfile('user_1', [
        { owner: 'o', name: 'r', files: [{ path: 'src/a.ts', content: 'code' }] },
      ]);
      expect(profile.patterns).toEqual([]);
    });

    it('should skip non-analyzable files', async () => {
      const repos = [
        {
          owner: 'o',
          name: 'r',
          files: [
            { path: 'node_modules/lib/index.js', content: 'module code' },
            { path: '.next/static/chunk.js', content: 'chunk' },
            { path: 'dist/app.js', content: 'compiled' },
            { path: 'image.png', content: 'binary' },
          ],
        },
      ];

      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const createMock = vi.fn().mockResolvedValue({
        content: [
          { type: 'text', text: JSON.stringify({ patterns: [], solutions: [], conventions: [] }) },
        ],
      });
      vi.mocked(Anthropic).mockImplementationOnce(
        () =>
          ({
            messages: { create: createMock },
          }) as never
      );

      const t = new CodeTelepathy();
      await t.buildDeveloperProfile('user_1', repos);
      // createMock should NOT be called since all files are skippable
      expect(createMock).not.toHaveBeenCalled();
    });

    it('should determine expertise from file extensions and content', async () => {
      const repos = [
        {
          owner: 'o',
          name: 'r',
          files: Array.from({ length: 55 }, (_, i) => ({
            path: `src/comp${i}.tsx`,
            content: 'import React from "react";\nexport default function() { return <div />; }',
          })),
        },
      ];

      const profile = await telepathy.buildDeveloperProfile('user_1', repos);
      const reactExpertise = profile.expertise.find((e) => e.domain === 'react');
      expect(reactExpertise).toBeDefined();
      if (reactExpertise) {
        expect(reactExpertise.level).toBe('expert');
      }
    });
  });

  // ----- getInsights -----
  describe('getInsights', () => {
    it('should return insights for a cached profile', async () => {
      // First build profile to cache it
      await telepathy.buildDeveloperProfile('user_1', [
        { owner: 'o', name: 'r', files: [{ path: 'src/a.ts', content: 'code' }] },
      ]);

      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      vi.mocked(Anthropic).mockImplementationOnce(
        () =>
          ({
            messages: {
              create: vi.fn().mockResolvedValue({
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify([
                      {
                        type: 'suggestion',
                        title: 'Use error boundary',
                        description: 'Add error handling',
                        relevantRepos: ['repo1'],
                        confidence: 0.8,
                      },
                    ]),
                  },
                ],
              }),
            },
          }) as never
      );

      const t = new CodeTelepathy();
      // Build to cache
      await t.buildDeveloperProfile('user_1', [
        { owner: 'o', name: 'r', files: [{ path: 'src/a.ts', content: 'code' }] },
      ]);
      const insights = await t.getInsights('user_1', 'const x = 1;', 'src/x.ts');
      expect(Array.isArray(insights)).toBe(true);
    });

    it('should load profile from DB if not cached', async () => {
      const t = new CodeTelepathy();
      const insights = await t.getInsights('user_1', 'code', 'file.ts');
      expect(Array.isArray(insights)).toBe(true);
    });

    it('should return empty array when no profile exists', async () => {
      const { createClient } = await import('@supabase/supabase-js');
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      } as never);

      const t = new CodeTelepathy();
      const insights = await t.getInsights('unknown_user', 'code', 'file.ts');
      expect(insights).toEqual([]);
    });
  });

  // ----- generatePersonalizedCode -----
  describe('generatePersonalizedCode', () => {
    it('should generate code using profile context', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      vi.mocked(Anthropic).mockImplementation(
        () =>
          ({
            messages: {
              create: vi.fn().mockResolvedValue({
                content: [
                  { type: 'text', text: 'function fetchUser() { return fetch("/api/user"); }' },
                ],
              }),
            },
          }) as never
      );

      const t = new CodeTelepathy();
      // Build profile first
      await t.buildDeveloperProfile('user_1', [
        { owner: 'o', name: 'r', files: [{ path: 'src/a.ts', content: 'code' }] },
      ]);

      const code = await t.generatePersonalizedCode('user_1', 'Create a user fetch function');
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
    });

    it('should work without a profile', async () => {
      const { createClient } = await import('@supabase/supabase-js');
      vi.mocked(createClient).mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null }),
            }),
          }),
        }),
      } as never);

      const t = new CodeTelepathy();
      const code = await t.generatePersonalizedCode('no_profile', 'Write code');
      expect(typeof code).toBe('string');
    });
  });
});
