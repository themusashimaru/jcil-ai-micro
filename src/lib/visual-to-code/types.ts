/**
 * VISUAL-TO-CODE TYPES
 *
 * Type definitions for converting visual designs to code.
 */

export interface VisualAnalysis {
  elements: UIElement[];
  layout: LayoutInfo;
  colors: ColorPalette;
  typography: TypographyInfo;
  suggestions: string[];
}

export interface UIElement {
  type: 'button' | 'input' | 'text' | 'image' | 'card' | 'list' | 'nav' | 'footer' | 'header' | 'form' | 'container' | 'icon' | 'other';
  description: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  styles?: {
    backgroundColor?: string;
    textColor?: string;
    borderRadius?: string;
    padding?: string;
    fontSize?: string;
  };
  content?: string;
  children?: UIElement[];
}

export interface LayoutInfo {
  type: 'flex' | 'grid' | 'stack' | 'mixed';
  direction?: 'row' | 'column';
  alignment?: string;
  spacing?: string;
  responsive?: boolean;
}

export interface ColorPalette {
  primary: string;
  secondary?: string;
  accent?: string;
  background: string;
  text: string;
  others: string[];
}

export interface TypographyInfo {
  headingFont?: string;
  bodyFont?: string;
  sizes: {
    heading: string;
    body: string;
    small: string;
  };
}

export interface GeneratedComponent {
  name: string;
  code: string;
  styles?: string;
  dependencies?: string[];
  usage?: string;
}

export interface VisualToCodeOptions {
  framework?: 'react' | 'vue' | 'svelte' | 'html';
  styling?: 'tailwind' | 'css' | 'styled-components' | 'css-modules';
  typescript?: boolean;
  responsive?: boolean;
  accessibility?: boolean;
  componentName?: string;
}

export interface VisualToCodeResult {
  analysis: VisualAnalysis;
  components: GeneratedComponent[];
  mainComponent: string;
  previewHtml: string;
}
