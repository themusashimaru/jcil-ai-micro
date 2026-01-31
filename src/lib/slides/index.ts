export {
  overlayTextOnSlide,
  overlayTextOnSlideBuffer,
  areFontsLoaded,
  getFontInfo,
} from './text-overlay';
export {
  // Constants
  MAX_SLIDES_PER_REQUEST,
  SLIDE_WIDTH,
  SLIDE_HEIGHT,
  // Functions
  generateSingleSlide,
  generateSlides,
  getSlideDesignSystemPrompt,
  parseSlidePrompts,
  formatSlideOutput,
  generateSlideCompletionMetadata,
  // Progress helpers
  ProgressMessages,
  // Types
  type SlideInput,
  type SlideResult,
  type SlideGenerationOptions,
  type ProgressCallback,
} from './generator';
