/**
 * PROMPT SET TYPES
 *
 * Defines the interface for agent prompt sets.
 * Each mode (strategy, research, etc.) provides a complete set of prompts
 * that plugs into the shared agent engine.
 */

/**
 * A complete set of prompts that defines an agent's personality and behavior.
 * The engine is mode-agnostic — it just runs whatever prompts it's given.
 */
export interface PromptSet {
  /** Human-readable mode name */
  name: string;

  /** System prompt for ForensicIntake (Opus 4.5) */
  intake: string;

  /** Opening message displayed to the user when the agent starts */
  intakeOpening: string;

  /** System prompt for MasterArchitect (Opus 4.5) */
  architect: string;

  /** System prompt for QualityControl (Opus 4.5) */
  qualityControl: string;

  /** System prompt for ProjectManagers (Sonnet 4.5) */
  projectManager: string;

  /** System prompt for Scouts (Haiku 4.5) */
  scout: string;

  /** System prompt for final synthesis (Opus 4.5) */
  synthesis: string;
}
