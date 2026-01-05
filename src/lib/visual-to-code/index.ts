/**
 * VISUAL-TO-CODE
 *
 * Convert screenshots and design mockups into React components.
 * Uses Claude's vision capabilities for accurate reproduction.
 *
 * Features:
 * - Design analysis and element detection
 * - Color palette extraction
 * - Layout understanding
 * - React + Tailwind code generation
 * - Accessibility compliance
 * - Responsive design support
 */

export * from './types';
export { convertVisualToCode, quickConvert } from './converter';
