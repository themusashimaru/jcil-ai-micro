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
                oursIntent: 'Add error handling',
                theirsIntent: 'Add logging',
                conflictType: 'additive-both',
                canAutomerge: true,
                suggestedStrategy: 'combine-both',
                riskLevel: 'low',
              }),
            },
          ],
        }),
      },
    })),
  };
});

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { SmartMergeResolver, mergeResolver, resolveConflict, hasConflicts } from './index';
import type {
  MergeConflict,
  ConflictMarker,
  MergeStrategy,
  ConflictAnalysis,
  ConflictType,
} from './index';

describe('SmartMergeResolver', () => {
  let resolver: SmartMergeResolver;

  beforeEach(() => {
    vi.clearAllMocks();
    resolver = new SmartMergeResolver();
  });

  // ----- Type exports -----
  describe('Type exports', () => {
    it('should export MergeStrategy type values', () => {
      const strategies: MergeStrategy[] = [
        'accept-ours',
        'accept-theirs',
        'combine-both',
        'semantic-merge',
        'manual-required',
      ];
      expect(strategies).toHaveLength(5);
    });

    it('should export ConflictType values', () => {
      const types: ConflictType[] = [
        'additive-both',
        'modification-same',
        'rename-conflict',
        'delete-modify',
        'import-conflict',
        'formatting-only',
        'logic-conflict',
      ];
      expect(types).toHaveLength(7);
    });

    it('should allow constructing MergeConflict', () => {
      const conflict: MergeConflict = {
        filePath: 'src/app.ts',
        baseContent: 'base',
        oursContent: 'ours',
        theirsContent: 'theirs',
        conflictMarkers: [],
      };
      expect(conflict.filePath).toBe('src/app.ts');
    });

    it('should allow constructing ConflictMarker', () => {
      const marker: ConflictMarker = {
        startLine: 1,
        endLine: 10,
        baseStart: 0,
        baseEnd: 0,
        oursStart: 2,
        oursEnd: 5,
        theirsStart: 6,
        theirsEnd: 9,
        ours: 'our code',
        theirs: 'their code',
      };
      expect(marker.ours).toBe('our code');
    });

    it('should allow constructing ConflictAnalysis', () => {
      const analysis: ConflictAnalysis = {
        oursIntent: 'add feature',
        theirsIntent: 'fix bug',
        conflictType: 'additive-both',
        canAutomerge: true,
        suggestedStrategy: 'combine-both',
        riskLevel: 'low',
      };
      expect(analysis.canAutomerge).toBe(true);
    });
  });

  // ----- Singleton export -----
  describe('mergeResolver singleton', () => {
    it('should export a SmartMergeResolver instance', () => {
      expect(mergeResolver).toBeInstanceOf(SmartMergeResolver);
    });
  });

  // ----- parseConflictMarkers -----
  describe('parseConflictMarkers', () => {
    it('should parse simple conflict markers', () => {
      const content = [
        'line before',
        '<<<<<<< HEAD',
        'our change line 1',
        'our change line 2',
        '=======',
        'their change line 1',
        '>>>>>>> feature-branch',
        'line after',
      ].join('\n');

      const markers = resolver.parseConflictMarkers(content);
      expect(markers).toHaveLength(1);
      expect(markers[0].ours).toBe('our change line 1\nour change line 2');
      expect(markers[0].theirs).toBe('their change line 1');
      expect(markers[0].startLine).toBe(2); // line index + 1
    });

    it('should parse multiple conflict markers', () => {
      const content = [
        '<<<<<<< HEAD',
        'ours1',
        '=======',
        'theirs1',
        '>>>>>>> branch',
        'middle',
        '<<<<<<< HEAD',
        'ours2',
        '=======',
        'theirs2',
        '>>>>>>> branch',
      ].join('\n');

      const markers = resolver.parseConflictMarkers(content);
      expect(markers).toHaveLength(2);
      expect(markers[0].ours).toBe('ours1');
      expect(markers[1].ours).toBe('ours2');
    });

    it('should return empty array for content without conflicts', () => {
      const markers = resolver.parseConflictMarkers('clean code\nno conflicts\n');
      expect(markers).toEqual([]);
    });
  });

  // ----- hasConflicts -----
  describe('hasConflicts', () => {
    it('should return true when all markers present', () => {
      expect(resolver.hasConflicts('<<<<<<< HEAD\n=======\n>>>>>>> branch')).toBe(true);
    });

    it('should return false when no markers present', () => {
      expect(resolver.hasConflicts('clean code')).toBe(false);
    });

    it('should return false when only partial markers present', () => {
      expect(resolver.hasConflicts('<<<<<<< HEAD\n=======')).toBe(false);
      expect(resolver.hasConflicts('>>>>>>>')).toBe(false);
    });
  });

  // ----- resolveConflict -----
  describe('resolveConflict', () => {
    it('should resolve a conflict with pre-parsed markers', async () => {
      // Mock AI to return "accept-ours" strategy
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      vi.mocked(Anthropic).mockImplementation(
        () =>
          ({
            messages: {
              create: vi.fn().mockResolvedValue({
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      oursIntent: 'Add validation',
                      theirsIntent: 'Add logging',
                      conflictType: 'additive-both',
                      canAutomerge: true,
                      suggestedStrategy: 'accept-ours',
                      riskLevel: 'low',
                    }),
                  },
                ],
              }),
            },
          }) as never
      );

      const r = new SmartMergeResolver();
      const conflict: MergeConflict = {
        filePath: 'src/app.ts',
        baseContent: 'base code',
        oursContent: '<<<<<<< HEAD\nour code\n=======\ntheir code\n>>>>>>>',
        theirsContent: '',
        conflictMarkers: [
          {
            startLine: 1,
            endLine: 5,
            baseStart: 0,
            baseEnd: 0,
            oursStart: 2,
            oursEnd: 2,
            theirsStart: 4,
            theirsEnd: 4,
            ours: 'our code',
            theirs: 'their code',
          },
        ],
      };

      const result = await r.resolveConflict(conflict);
      expect(result.filePath).toBe('src/app.ts');
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].strategy).toBe('accept-ours');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should use "accept-theirs" strategy when suggested', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      vi.mocked(Anthropic).mockImplementation(
        () =>
          ({
            messages: {
              create: vi.fn().mockResolvedValue({
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      oursIntent: 'Old approach',
                      theirsIntent: 'Better approach',
                      conflictType: 'modification-same',
                      canAutomerge: true,
                      suggestedStrategy: 'accept-theirs',
                      riskLevel: 'low',
                    }),
                  },
                ],
              }),
            },
          }) as never
      );

      const r = new SmartMergeResolver();
      const result = await r.resolveConflict({
        filePath: 'src/b.ts',
        baseContent: '',
        oursContent: '<<<<<<< HEAD\nold\n=======\nnew\n>>>>>>>',
        theirsContent: '',
        conflictMarkers: [
          {
            startLine: 1,
            endLine: 5,
            baseStart: 0,
            baseEnd: 0,
            oursStart: 2,
            oursEnd: 2,
            theirsStart: 4,
            theirsEnd: 4,
            ours: 'old',
            theirs: 'new',
          },
        ],
      });

      expect(result.conflicts[0].strategy).toBe('accept-theirs');
      expect(result.conflicts[0].resolved).toBe('new');
    });

    it('should fall back to manual-required when AI merge fails', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      // First call: analyzeConflict returns combine-both
      // Second call: generateResolution fails
      let callCount = 0;
      vi.mocked(Anthropic).mockImplementation(
        () =>
          ({
            messages: {
              create: vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                  // analyzeConflict
                  return Promise.resolve({
                    content: [
                      {
                        type: 'text',
                        text: JSON.stringify({
                          oursIntent: 'A',
                          theirsIntent: 'B',
                          conflictType: 'logic-conflict',
                          canAutomerge: false,
                          suggestedStrategy: 'combine-both',
                          riskLevel: 'high',
                        }),
                      },
                    ],
                  });
                }
                // generateResolution — return non-JSON
                return Promise.resolve({
                  content: [{ type: 'text', text: 'cannot merge this' }],
                });
              }),
            },
          }) as never
      );

      const r = new SmartMergeResolver();
      const result = await r.resolveConflict({
        filePath: 'src/c.ts',
        baseContent: '',
        oursContent: '<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>>',
        theirsContent: '',
        conflictMarkers: [
          {
            startLine: 1,
            endLine: 5,
            baseStart: 0,
            baseEnd: 0,
            oursStart: 2,
            oursEnd: 2,
            theirsStart: 4,
            theirsEnd: 4,
            ours: 'ours',
            theirs: 'theirs',
          },
        ],
      });

      expect(result.conflicts[0].strategy).toBe('manual-required');
      expect(result.conflicts[0].confidence).toBe(0);
    });

    it('should parse conflict markers from content when none provided', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      vi.mocked(Anthropic).mockImplementation(
        () =>
          ({
            messages: {
              create: vi.fn().mockResolvedValue({
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      oursIntent: 'X',
                      theirsIntent: 'Y',
                      conflictType: 'additive-both',
                      canAutomerge: true,
                      suggestedStrategy: 'accept-ours',
                      riskLevel: 'low',
                    }),
                  },
                ],
              }),
            },
          }) as never
      );

      const r = new SmartMergeResolver();
      const result = await r.resolveConflict({
        filePath: 'src/d.ts',
        baseContent: '',
        oursContent: '<<<<<<< HEAD\nour code\n=======\ntheir code\n>>>>>>>',
        theirsContent: '',
        conflictMarkers: [], // empty — will parse
      });

      expect(result.conflicts).toHaveLength(1);
    });

    it('should handle AI analysis error and return default analysis', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      vi.mocked(Anthropic).mockImplementation(
        () =>
          ({
            messages: {
              create: vi.fn().mockRejectedValue(new Error('Network error')),
            },
          }) as never
      );

      const r = new SmartMergeResolver();
      const result = await r.resolveConflict({
        filePath: 'src/e.ts',
        baseContent: '',
        oursContent: 'x',
        theirsContent: '',
        conflictMarkers: [
          {
            startLine: 1,
            endLine: 5,
            baseStart: 0,
            baseEnd: 0,
            oursStart: 2,
            oursEnd: 2,
            theirsStart: 4,
            theirsEnd: 4,
            ours: 'ours',
            theirs: 'theirs',
          },
        ],
      });

      // Should fall back to manual-required
      expect(result.conflicts[0].strategy).toBe('manual-required');
    });
  });

  // ----- resolveMultipleConflicts -----
  describe('resolveMultipleConflicts', () => {
    it('should resolve multiple conflicts', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      vi.mocked(Anthropic).mockImplementation(
        () =>
          ({
            messages: {
              create: vi.fn().mockResolvedValue({
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      oursIntent: 'X',
                      theirsIntent: 'Y',
                      conflictType: 'additive-both',
                      canAutomerge: true,
                      suggestedStrategy: 'accept-ours',
                      riskLevel: 'low',
                    }),
                  },
                ],
              }),
            },
          }) as never
      );

      const r = new SmartMergeResolver();
      const conflicts: MergeConflict[] = [
        {
          filePath: 'a.ts',
          baseContent: '',
          oursContent: 'x',
          theirsContent: '',
          conflictMarkers: [
            {
              startLine: 1,
              endLine: 3,
              baseStart: 0,
              baseEnd: 0,
              oursStart: 1,
              oursEnd: 1,
              theirsStart: 2,
              theirsEnd: 2,
              ours: 'a',
              theirs: 'b',
            },
          ],
        },
        {
          filePath: 'b.ts',
          baseContent: '',
          oursContent: 'y',
          theirsContent: '',
          conflictMarkers: [
            {
              startLine: 1,
              endLine: 3,
              baseStart: 0,
              baseEnd: 0,
              oursStart: 1,
              oursEnd: 1,
              theirsStart: 2,
              theirsEnd: 2,
              ours: 'c',
              theirs: 'd',
            },
          ],
        },
      ];

      const results = await r.resolveMultipleConflicts(conflicts);
      expect(results).toHaveLength(2);
      expect(results[0].filePath).toBe('a.ts');
      expect(results[1].filePath).toBe('b.ts');
    });
  });

  // ----- suggestTests -----
  describe('test suggestions', () => {
    it('should suggest component tests for tsx files', async () => {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      vi.mocked(Anthropic).mockImplementation(
        () =>
          ({
            messages: {
              create: vi.fn().mockResolvedValue({
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      oursIntent: 'X',
                      theirsIntent: 'Y',
                      conflictType: 'additive-both',
                      canAutomerge: true,
                      suggestedStrategy: 'accept-ours',
                      riskLevel: 'low',
                    }),
                  },
                ],
              }),
            },
          }) as never
      );

      const r = new SmartMergeResolver();
      const result = await r.resolveConflict({
        filePath: 'src/components/Button.tsx',
        baseContent: '',
        oursContent: 'x',
        theirsContent: '',
        conflictMarkers: [
          {
            startLine: 1,
            endLine: 3,
            baseStart: 0,
            baseEnd: 0,
            oursStart: 1,
            oursEnd: 1,
            theirsStart: 2,
            theirsEnd: 2,
            ours: 'a',
            theirs: 'b',
          },
        ],
      });

      expect(result.testsToRun.some((t) => t.includes('.test.tsx'))).toBe(true);
    });
  });

  // ----- Top-level convenience functions -----
  describe('resolveConflict convenience function', () => {
    it('should resolve a conflict by file path and content', async () => {
      const result = await resolveConflict(
        'src/x.ts',
        '<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>>',
        'base'
      );
      expect(result.filePath).toBe('src/x.ts');
    });
  });

  describe('hasConflicts convenience function', () => {
    it('should detect conflicts', () => {
      expect(hasConflicts('<<<<<<< HEAD\n=======\n>>>>>>>')).toBe(true);
      expect(hasConflicts('clean')).toBe(false);
    });
  });
});
