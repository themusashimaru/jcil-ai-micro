/**
 * VISUAL-TO-CODE CONVERTER
 *
 * Uses Claude's vision capabilities to analyze images
 * and generate React/Tailwind components.
 */

import Anthropic from '@anthropic-ai/sdk';
import { VisualToCodeOptions, VisualToCodeResult, GeneratedComponent } from './types';
import { logger } from '@/lib/logger';

const log = logger('VisualToCode');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

/**
 * Convert a visual design (image) to code
 */
export async function convertVisualToCode(
  imageData: string, // Base64 encoded image
  options: VisualToCodeOptions = {}
): Promise<VisualToCodeResult> {
  const {
    framework = 'react',
    styling = 'tailwind',
    typescript = true,
    responsive = true,
    accessibility = true,
    componentName = 'GeneratedComponent',
  } = options;

  log.info('Converting image to code');

  // First pass: Analyze the design
  const analysis = await analyzeDesign(imageData);

  // Second pass: Generate component code
  const components = await generateComponents(imageData, {
    framework,
    styling,
    typescript,
    responsive,
    accessibility,
    componentName,
  });

  // Generate preview HTML
  const previewHtml = generatePreviewHtml(components.main, styling);

  return {
    analysis,
    components: components.all,
    mainComponent: components.main.code,
    previewHtml,
  };
}

/**
 * Analyze design structure from image
 */
async function analyzeDesign(imageData: string) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: getMediaType(imageData),
              data: extractBase64(imageData),
            },
          },
          {
            type: 'text',
            text: `Analyze this UI design and provide a structured breakdown.

Return a JSON object with:
{
  "elements": [
    {
      "type": "button|input|text|image|card|list|nav|footer|header|form|container|icon|other",
      "description": "Brief description",
      "position": { "x": 0, "y": 0, "width": 100, "height": 50 },
      "styles": {
        "backgroundColor": "#hex",
        "textColor": "#hex"
      },
      "content": "Text content if any"
    }
  ],
  "layout": {
    "type": "flex|grid|stack",
    "direction": "row|column",
    "alignment": "center|start|end"
  },
  "colors": {
    "primary": "#hex",
    "secondary": "#hex",
    "background": "#hex",
    "text": "#hex",
    "others": ["#hex"]
  },
  "typography": {
    "headingFont": "font name or sans-serif",
    "bodyFont": "font name or sans-serif",
    "sizes": {
      "heading": "2rem",
      "body": "1rem",
      "small": "0.875rem"
    }
  },
  "suggestions": ["List of implementation suggestions"]
}

Be specific about colors and styling. Return only valid JSON.`,
          },
        ],
      },
    ],
  });

  let content = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      content += block.text;
    }
  }

  try {
    const jsonStr = content.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
    return JSON.parse(jsonStr);
  } catch {
    return {
      elements: [],
      layout: { type: 'flex', direction: 'column' },
      colors: { primary: '#6366f1', background: '#ffffff', text: '#1f2937', others: [] },
      typography: { sizes: { heading: '2rem', body: '1rem', small: '0.875rem' } },
      suggestions: ['Unable to fully analyze design'],
    };
  }
}

/**
 * Generate component code from image
 */
async function generateComponents(
  imageData: string,
  options: VisualToCodeOptions
): Promise<{ main: GeneratedComponent; all: GeneratedComponent[] }> {
  const {
    framework = 'react',
    styling = 'tailwind',
    typescript = true,
    responsive = true,
    accessibility = true,
    componentName = 'GeneratedComponent',
  } = options;

  const fileExt = typescript ? 'tsx' : 'jsx';
  const typesNote = typescript ? 'Include TypeScript types.' : '';

  const stylingInstructions = {
    tailwind: 'Use Tailwind CSS classes for all styling. Use responsive prefixes (sm:, md:, lg:) for responsive design.',
    css: 'Use CSS modules with a separate .module.css file.',
    'styled-components': 'Use styled-components for styling.',
    'css-modules': 'Use CSS modules with a separate .module.css file.',
  };

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6-20260205',
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: getMediaType(imageData),
              data: extractBase64(imageData),
            },
          },
          {
            type: 'text',
            text: `Convert this UI design into a ${framework} component.

## Requirements
- Component name: ${componentName}
- File extension: .${fileExt}
- Styling: ${stylingInstructions[styling]}
${responsive ? '- Make it fully responsive' : ''}
${accessibility ? '- Include proper accessibility attributes (aria-*, role, alt text, etc.)' : ''}
${typesNote}

## Guidelines
1. Create a pixel-perfect reproduction of the design
2. Use semantic HTML elements
3. Extract colors from the design accurately
4. Handle hover/focus states appropriately
5. Include any necessary imports

## Output Format
Return a JSON object with:
{
  "components": [
    {
      "name": "${componentName}",
      "code": "// Full component code here",
      "styles": "CSS if using CSS modules",
      "dependencies": ["react", ...other deps],
      "usage": "<${componentName} />"
    }
  ]
}

Create production-ready, clean code. Return only valid JSON.`,
          },
        ],
      },
    ],
  });

  let content = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      content += block.text;
    }
  }

  try {
    const jsonStr = content.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
    const result = JSON.parse(jsonStr);
    const components = result.components || [];

    return {
      main: components[0] || createFallbackComponent(componentName, typescript),
      all: components,
    };
  } catch {
    const fallback = createFallbackComponent(componentName, typescript);
    return { main: fallback, all: [fallback] };
  }
}

/**
 * Create a fallback component when parsing fails
 */
function createFallbackComponent(name: string, typescript: boolean): GeneratedComponent {
  const code = typescript
    ? `import React from 'react';

interface ${name}Props {
  className?: string;
}

export const ${name}: React.FC<${name}Props> = ({ className }) => {
  return (
    <div className={\`p-6 bg-white rounded-lg shadow \${className || ''}\`}>
      <p className="text-gray-600">Component generated from design.</p>
      <p className="text-sm text-gray-400 mt-2">Please refine based on the original design.</p>
    </div>
  );
};

export default ${name};`
    : `import React from 'react';

export const ${name} = ({ className }) => {
  return (
    <div className={\`p-6 bg-white rounded-lg shadow \${className || ''}\`}>
      <p className="text-gray-600">Component generated from design.</p>
      <p className="text-sm text-gray-400 mt-2">Please refine based on the original design.</p>
    </div>
  );
};

export default ${name};`;

  return {
    name,
    code,
    dependencies: ['react'],
    usage: `<${name} />`,
  };
}

/**
 * Generate preview HTML for the component
 */
function generatePreviewHtml(component: GeneratedComponent, styling: string): string {
  const tailwindCdn = styling === 'tailwind'
    ? '<script src="https://cdn.tailwindcss.com"></script>'
    : '';

  // Extract just the JSX from the component for preview
  const jsxMatch = component.code.match(/return\s*\(\s*([\s\S]*?)\s*\);/);
  const jsx = jsxMatch
    ? jsxMatch[1].replace(/className=/g, 'class=').replace(/\{[^}]+\}/g, '')
    : '<div class="p-6">Preview unavailable</div>';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${tailwindCdn}
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 1rem; }
  </style>
</head>
<body>
  ${jsx}
</body>
</html>`;
}

/**
 * Get media type from base64 data URL
 */
function getMediaType(data: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  if (data.startsWith('data:image/png')) return 'image/png';
  if (data.startsWith('data:image/gif')) return 'image/gif';
  if (data.startsWith('data:image/webp')) return 'image/webp';
  return 'image/jpeg';
}

/**
 * Extract base64 data from data URL
 */
function extractBase64(data: string): string {
  const match = data.match(/base64,(.+)/);
  return match ? match[1] : data;
}

/**
 * Quick conversion - simplified version for faster results
 */
export async function quickConvert(
  imageData: string,
  componentName: string = 'Component'
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: getMediaType(imageData),
              data: extractBase64(imageData),
            },
          },
          {
            type: 'text',
            text: `Convert this UI design to a React component with Tailwind CSS.

Component name: ${componentName}
- Use TypeScript
- Make it responsive
- Include accessibility attributes
- Match colors and styling as closely as possible

Return ONLY the component code, no explanations.`,
          },
        ],
      },
    ],
  });

  let code = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      code += block.text;
    }
  }

  // Clean up the code
  return code
    .replace(/```tsx?\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();
}
