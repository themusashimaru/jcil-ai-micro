/**
 * GITHUB CONTEXT TOOL - BACKWARD COMPATIBILITY SHIM
 *
 * This tool has been consolidated into the unified github-tool.ts.
 * All operations (list_repos, get_structure, get_context, read_file, search_code)
 * are now available as actions in the single 'github' tool.
 *
 * This file re-exports for any code that still imports from here.
 */

export {
  githubTool as githubContextTool,
  executeGitHub as executeGitHubContext,
  isGitHubAvailable as isGitHubContextAvailable,
  getRepoSummaryForPrompt,
} from './github-tool';
