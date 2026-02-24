import { describe, it, expect } from 'vitest';
import { getLSPTools, isLSPTool, getSupportedExtensions } from './lsp-tools';

// -------------------------------------------------------------------
// getLSPTools
// -------------------------------------------------------------------
describe('getLSPTools', () => {
  it('should return 5 tools', () => {
    const tools = getLSPTools();
    expect(tools).toHaveLength(5);
  });

  it('should include all expected tool names', () => {
    const names = getLSPTools().map((t) => t.name);
    expect(names).toContain('lsp_goto_definition');
    expect(names).toContain('lsp_find_references');
    expect(names).toContain('lsp_hover');
    expect(names).toContain('lsp_document_symbols');
    expect(names).toContain('lsp_completions');
  });

  it('should require file, line, column for goto_definition', () => {
    const tool = getLSPTools().find((t) => t.name === 'lsp_goto_definition')!;
    expect(tool.input_schema.required).toContain('file');
    expect(tool.input_schema.required).toContain('line');
    expect(tool.input_schema.required).toContain('column');
  });

  it('should only require file for document_symbols', () => {
    const tool = getLSPTools().find((t) => t.name === 'lsp_document_symbols')!;
    expect(tool.input_schema.required).toEqual(['file']);
  });

  it('should require content for completions', () => {
    const tool = getLSPTools().find((t) => t.name === 'lsp_completions')!;
    expect(tool.input_schema.required).toContain('content');
  });

  it('should have descriptions for all tools', () => {
    const tools = getLSPTools();
    tools.forEach((t) => {
      expect(t.description).toBeTruthy();
      expect(t.description.length).toBeGreaterThan(10);
    });
  });
});

// -------------------------------------------------------------------
// isLSPTool
// -------------------------------------------------------------------
describe('isLSPTool', () => {
  it('should return true for lsp_ prefixed tools', () => {
    expect(isLSPTool('lsp_goto_definition')).toBe(true);
    expect(isLSPTool('lsp_find_references')).toBe(true);
    expect(isLSPTool('lsp_hover')).toBe(true);
    expect(isLSPTool('lsp_document_symbols')).toBe(true);
    expect(isLSPTool('lsp_completions')).toBe(true);
  });

  it('should return false for non-lsp tools', () => {
    expect(isLSPTool('other_tool')).toBe(false);
    expect(isLSPTool('model_select')).toBe(false);
    expect(isLSPTool('')).toBe(false);
  });
});

// -------------------------------------------------------------------
// getSupportedExtensions
// -------------------------------------------------------------------
describe('getSupportedExtensions', () => {
  it('should include TypeScript extensions', () => {
    const exts = getSupportedExtensions();
    expect(exts).toContain('.ts');
    expect(exts).toContain('.tsx');
  });

  it('should include JavaScript extensions', () => {
    const exts = getSupportedExtensions();
    expect(exts).toContain('.js');
    expect(exts).toContain('.jsx');
  });

  it('should include Python and Go', () => {
    const exts = getSupportedExtensions();
    expect(exts).toContain('.py');
    expect(exts).toContain('.go');
  });

  it('should return 8 extensions', () => {
    expect(getSupportedExtensions()).toHaveLength(8);
  });
});
