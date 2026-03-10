/**
 * Visual-to-Code Converter Tests
 *
 * Tests for converting visual designs (images) to React/Tailwind components.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so the mock function is available before vi.mock factory runs
const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
    },
  })),
}));

import { convertVisualToCode, quickConvert } from './converter';

// Helper to create a mock Anthropic response
function mockAnthropicResponse(text: string) {
  return {
    content: [{ type: 'text', text }],
  };
}

describe('Visual-to-Code Converter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  });

  // ===========================================================================
  // convertVisualToCode
  // ===========================================================================
  describe('convertVisualToCode', () => {
    it('should convert an image to code with default options', async () => {
      // First call: analyzeDesign
      const analysisJson = JSON.stringify({
        elements: [
          {
            type: 'button',
            description: 'Submit button',
            position: { x: 0, y: 0, width: 100, height: 40 },
          },
        ],
        layout: { type: 'flex', direction: 'column' },
        colors: { primary: '#6366f1', background: '#ffffff', text: '#1f2937', others: [] },
        typography: { sizes: { heading: '2rem', body: '1rem', small: '0.875rem' } },
        suggestions: ['Use semantic HTML'],
      });

      // Second call: generateComponents
      const componentsJson = JSON.stringify({
        components: [
          {
            name: 'GeneratedComponent',
            code: `import React from 'react';
export const GeneratedComponent: React.FC = () => {
  return (
    <div className="p-4 bg-white">
      <button className="px-4 py-2 bg-indigo-500 text-white rounded">Submit</button>
    </div>
  );
};
export default GeneratedComponent;`,
            dependencies: ['react'],
            usage: '<GeneratedComponent />',
          },
        ],
      });

      mockCreate
        .mockResolvedValueOnce(mockAnthropicResponse(analysisJson))
        .mockResolvedValueOnce(mockAnthropicResponse(componentsJson));

      const result = await convertVisualToCode('data:image/png;base64,abc123');

      expect(result.analysis).toBeDefined();
      expect(result.analysis.elements).toHaveLength(1);
      expect(result.analysis.layout.type).toBe('flex');
      expect(result.components).toHaveLength(1);
      expect(result.components[0].name).toBe('GeneratedComponent');
      expect(result.mainComponent).toContain('GeneratedComponent');
      expect(result.previewHtml).toContain('<!DOCTYPE html>');
      expect(result.previewHtml).toContain('tailwindcss.com');
    });

    it('should use custom options', async () => {
      const analysisJson = JSON.stringify({
        elements: [],
        layout: { type: 'grid', direction: 'row' },
        colors: { primary: '#000', background: '#fff', text: '#333', others: [] },
        typography: { sizes: { heading: '2rem', body: '1rem', small: '0.875rem' } },
        suggestions: [],
      });

      const componentsJson = JSON.stringify({
        components: [
          {
            name: 'MyButton',
            code: `import React from 'react';
export const MyButton = ({ className }) => {
  return (
    <button className="btn">Click</button>
  );
};`,
            dependencies: ['react'],
            usage: '<MyButton />',
          },
        ],
      });

      mockCreate
        .mockResolvedValueOnce(mockAnthropicResponse(analysisJson))
        .mockResolvedValueOnce(mockAnthropicResponse(componentsJson));

      const result = await convertVisualToCode('data:image/jpeg;base64,def456', {
        framework: 'react',
        styling: 'css',
        typescript: false,
        responsive: false,
        accessibility: false,
        componentName: 'MyButton',
      });

      expect(result.components[0].name).toBe('MyButton');
      // CSS styling should NOT include tailwind CDN in preview
      expect(result.previewHtml).not.toContain('tailwindcss.com');
    });

    it('should handle invalid JSON in analysis response gracefully', async () => {
      // Simulating Claude returning text that is not valid JSON
      mockCreate
        .mockResolvedValueOnce(mockAnthropicResponse('This is not valid JSON at all'))
        .mockResolvedValueOnce(
          mockAnthropicResponse(
            JSON.stringify({
              components: [
                {
                  name: 'GeneratedComponent',
                  code: 'export const GeneratedComponent = () => <div>Hello</div>;',
                  dependencies: ['react'],
                  usage: '<GeneratedComponent />',
                },
              ],
            })
          )
        );

      const result = await convertVisualToCode('data:image/png;base64,abc');

      // Should use fallback analysis
      expect(result.analysis.elements).toEqual([]);
      expect(result.analysis.layout.type).toBe('flex');
      expect(result.analysis.suggestions).toContain('Unable to fully analyze design');
    });

    it('should handle invalid JSON in components response with fallback component', async () => {
      mockCreate
        .mockResolvedValueOnce(
          mockAnthropicResponse(
            JSON.stringify({
              elements: [],
              layout: { type: 'flex', direction: 'column' },
              colors: { primary: '#000', background: '#fff', text: '#333', others: [] },
              typography: { sizes: { heading: '2rem', body: '1rem', small: '0.875rem' } },
              suggestions: [],
            })
          )
        )
        .mockResolvedValueOnce(mockAnthropicResponse('Not valid JSON'));

      const result = await convertVisualToCode('data:image/png;base64,abc');

      // Should use fallback component
      expect(result.components).toHaveLength(1);
      expect(result.components[0].name).toBe('GeneratedComponent');
      expect(result.mainComponent).toContain('GeneratedComponent');
      expect(result.mainComponent).toContain('Component generated from design');
    });

    it('should create TypeScript fallback component by default', async () => {
      mockCreate
        .mockResolvedValueOnce(mockAnthropicResponse('{}'))
        .mockResolvedValueOnce(mockAnthropicResponse('invalid'));

      const result = await convertVisualToCode('data:image/png;base64,abc');

      // TypeScript fallback should include interface
      expect(result.mainComponent).toContain('interface');
      expect(result.mainComponent).toContain('React.FC');
    });

    it('should create JavaScript fallback component when typescript is false', async () => {
      mockCreate
        .mockResolvedValueOnce(mockAnthropicResponse('{}'))
        .mockResolvedValueOnce(mockAnthropicResponse('invalid'));

      const result = await convertVisualToCode('data:image/png;base64,abc', {
        typescript: false,
      });

      // JavaScript fallback should NOT include interface
      expect(result.mainComponent).not.toContain('interface');
      expect(result.mainComponent).not.toContain('React.FC');
    });

    it('should handle JSON wrapped in code blocks', async () => {
      const wrappedAnalysis =
        '```json\n' +
        JSON.stringify({
          elements: [
            {
              type: 'text',
              description: 'Title',
              position: { x: 0, y: 0, width: 200, height: 30 },
            },
          ],
          layout: { type: 'flex', direction: 'column' },
          colors: { primary: '#333', background: '#fff', text: '#000', others: [] },
          typography: { sizes: { heading: '2rem', body: '1rem', small: '0.875rem' } },
          suggestions: [],
        }) +
        '\n```';

      const wrappedComponents =
        '```json\n' +
        JSON.stringify({
          components: [
            {
              name: 'GeneratedComponent',
              code: 'const GeneratedComponent = () => <h1>Title</h1>;',
              dependencies: ['react'],
              usage: '<GeneratedComponent />',
            },
          ],
        }) +
        '\n```';

      mockCreate
        .mockResolvedValueOnce(mockAnthropicResponse(wrappedAnalysis))
        .mockResolvedValueOnce(mockAnthropicResponse(wrappedComponents));

      const result = await convertVisualToCode('data:image/png;base64,abc');

      expect(result.analysis.elements).toHaveLength(1);
      expect(result.components).toHaveLength(1);
    });

    it('should handle empty components array in response', async () => {
      mockCreate
        .mockResolvedValueOnce(
          mockAnthropicResponse(
            JSON.stringify({
              elements: [],
              layout: { type: 'flex', direction: 'column' },
              colors: { primary: '#000', background: '#fff', text: '#333', others: [] },
              typography: { sizes: { heading: '2rem', body: '1rem', small: '0.875rem' } },
              suggestions: [],
            })
          )
        )
        .mockResolvedValueOnce(mockAnthropicResponse(JSON.stringify({ components: [] })));

      const result = await convertVisualToCode('data:image/png;base64,abc');

      // Empty components array should trigger fallback
      expect(result.components).toHaveLength(0);
      // mainComponent should be from fallback since components[0] is undefined
      expect(result.mainComponent).toContain('GeneratedComponent');
    });

    it('should detect media type from data URL', async () => {
      const analysisJson = JSON.stringify({
        elements: [],
        layout: { type: 'flex', direction: 'column' },
        colors: { primary: '#000', background: '#fff', text: '#333', others: [] },
        typography: { sizes: { heading: '2rem', body: '1rem', small: '0.875rem' } },
        suggestions: [],
      });
      const componentsJson = JSON.stringify({
        components: [
          {
            name: 'GeneratedComponent',
            code: 'const C = () => <div />;',
            dependencies: ['react'],
            usage: '<GeneratedComponent />',
          },
        ],
      });

      mockCreate
        .mockResolvedValueOnce(mockAnthropicResponse(analysisJson))
        .mockResolvedValueOnce(mockAnthropicResponse(componentsJson));

      await convertVisualToCode('data:image/webp;base64,webpdata');

      // Verify the media_type was set correctly in the API call
      const firstCall = mockCreate.mock.calls[0][0];
      const imageBlock = firstCall.messages[0].content[0];
      expect(imageBlock.source.media_type).toBe('image/webp');
    });

    it('should default to image/jpeg for unknown media types', async () => {
      const analysisJson = JSON.stringify({
        elements: [],
        layout: { type: 'flex', direction: 'column' },
        colors: { primary: '#000', background: '#fff', text: '#333', others: [] },
        typography: { sizes: { heading: '2rem', body: '1rem', small: '0.875rem' } },
        suggestions: [],
      });
      const componentsJson = JSON.stringify({
        components: [
          {
            name: 'GeneratedComponent',
            code: 'const C = () => <div />;',
            dependencies: ['react'],
            usage: '<GeneratedComponent />',
          },
        ],
      });

      mockCreate
        .mockResolvedValueOnce(mockAnthropicResponse(analysisJson))
        .mockResolvedValueOnce(mockAnthropicResponse(componentsJson));

      // Pass raw base64 without data URL prefix
      await convertVisualToCode('rawbase64data');

      const firstCall = mockCreate.mock.calls[0][0];
      const imageBlock = firstCall.messages[0].content[0];
      expect(imageBlock.source.media_type).toBe('image/jpeg');
    });

    it('should detect image/gif media type', async () => {
      const analysisJson = JSON.stringify({
        elements: [],
        layout: { type: 'flex' },
        colors: { primary: '#000', background: '#fff', text: '#333', others: [] },
        typography: { sizes: { heading: '2rem', body: '1rem', small: '0.875rem' } },
        suggestions: [],
      });
      const componentsJson = JSON.stringify({
        components: [
          {
            name: 'GeneratedComponent',
            code: 'const C = () => <div />;',
            dependencies: ['react'],
            usage: '<GeneratedComponent />',
          },
        ],
      });

      mockCreate
        .mockResolvedValueOnce(mockAnthropicResponse(analysisJson))
        .mockResolvedValueOnce(mockAnthropicResponse(componentsJson));

      await convertVisualToCode('data:image/gif;base64,gifdata');

      const firstCall = mockCreate.mock.calls[0][0];
      const imageBlock = firstCall.messages[0].content[0];
      expect(imageBlock.source.media_type).toBe('image/gif');
    });
  });

  // ===========================================================================
  // quickConvert
  // ===========================================================================
  describe('quickConvert', () => {
    it('should return component code from quick conversion', async () => {
      const componentCode = `import React from 'react';

export const Component: React.FC = () => {
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">Hello</h1>
    </div>
  );
};`;

      mockCreate.mockResolvedValueOnce(mockAnthropicResponse(componentCode));

      const result = await quickConvert('data:image/png;base64,abc');

      expect(result).toContain("import React from 'react'");
      expect(result).toContain('Component');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('should use custom component name', async () => {
      mockCreate.mockResolvedValueOnce(mockAnthropicResponse('const MyWidget = () => <div />;'));

      await quickConvert('data:image/png;base64,abc', 'MyWidget');

      // Verify the component name was passed in the prompt
      const callArgs = mockCreate.mock.calls[0][0];
      const textContent = callArgs.messages[0].content[1].text;
      expect(textContent).toContain('MyWidget');
    });

    it('should strip code block markers from response', async () => {
      const wrappedCode = '```tsx\nimport React from "react";\nconst C = () => <div />;\n```';

      mockCreate.mockResolvedValueOnce(mockAnthropicResponse(wrappedCode));

      const result = await quickConvert('data:image/png;base64,abc');

      expect(result).not.toContain('```');
      expect(result).toContain('import React from "react"');
    });

    it('should handle multi-block responses', async () => {
      const response = {
        content: [
          { type: 'text', text: 'First part ' },
          { type: 'text', text: 'second part' },
        ],
      };

      mockCreate.mockResolvedValueOnce(response);

      const result = await quickConvert('data:image/png;base64,abc');

      expect(result).toBe('First part second part');
    });

    it('should use default component name when not specified', async () => {
      mockCreate.mockResolvedValueOnce(mockAnthropicResponse('const Component = () => <div />;'));

      await quickConvert('data:image/png;base64,abc');

      const callArgs = mockCreate.mock.calls[0][0];
      const textContent = callArgs.messages[0].content[1].text;
      expect(textContent).toContain('Component');
    });

    it('should use claude-sonnet model for quick conversion', async () => {
      mockCreate.mockResolvedValueOnce(mockAnthropicResponse('const C = () => <div />;'));

      await quickConvert('data:image/png;base64,abc');

      expect(mockCreate.mock.calls[0][0].model).toBe('claude-sonnet-4-6');
    });
  });

  // ===========================================================================
  // Preview HTML generation
  // ===========================================================================
  describe('preview HTML generation', () => {
    it('should include tailwind CDN for tailwind styling', async () => {
      const analysisJson = JSON.stringify({
        elements: [],
        layout: { type: 'flex', direction: 'column' },
        colors: { primary: '#000', background: '#fff', text: '#333', others: [] },
        typography: { sizes: { heading: '2rem', body: '1rem', small: '0.875rem' } },
        suggestions: [],
      });
      const componentsJson = JSON.stringify({
        components: [
          {
            name: 'GeneratedComponent',
            code: `export const GeneratedComponent = () => {
  return (
    <div className="p-4">Hello</div>
  );
};`,
            dependencies: ['react'],
            usage: '<GeneratedComponent />',
          },
        ],
      });

      mockCreate
        .mockResolvedValueOnce(mockAnthropicResponse(analysisJson))
        .mockResolvedValueOnce(mockAnthropicResponse(componentsJson));

      const result = await convertVisualToCode('data:image/png;base64,abc', {
        styling: 'tailwind',
      });

      expect(result.previewHtml).toContain('tailwindcss.com');
      expect(result.previewHtml).toContain('<!DOCTYPE html>');
      expect(result.previewHtml).toContain('<meta charset="UTF-8">');
    });

    it('should not include tailwind CDN for CSS styling', async () => {
      const analysisJson = JSON.stringify({
        elements: [],
        layout: { type: 'flex', direction: 'column' },
        colors: { primary: '#000', background: '#fff', text: '#333', others: [] },
        typography: { sizes: { heading: '2rem', body: '1rem', small: '0.875rem' } },
        suggestions: [],
      });
      const componentsJson = JSON.stringify({
        components: [
          {
            name: 'GeneratedComponent',
            code: `export const GeneratedComponent = () => {
  return (
    <div style={{ padding: '1rem' }}>Hello</div>
  );
};`,
            dependencies: ['react'],
            usage: '<GeneratedComponent />',
          },
        ],
      });

      mockCreate
        .mockResolvedValueOnce(mockAnthropicResponse(analysisJson))
        .mockResolvedValueOnce(mockAnthropicResponse(componentsJson));

      const result = await convertVisualToCode('data:image/png;base64,abc', { styling: 'css' });

      expect(result.previewHtml).not.toContain('tailwindcss.com');
    });
  });
});
