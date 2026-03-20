/**
 * COMPOSIO BAMBOOHR TOOLKIT
 * ===========================
 *
 * Comprehensive BambooHR integration via Composio.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Employees (employee records and management)
 * - TimeOff (time off requests and balances)
 * - Reports (HR reports and analytics)
 * - Hiring (applicant tracking and onboarding)
 * - Directory (company directory and org chart)
 */

import { logger } from '@/lib/logger';

const log = logger('BambooHRToolkit');

// ============================================================================
// BAMBOOHR ACTION CATEGORIES
// ============================================================================

export type BambooHRActionCategory = 'employees' | 'timeoff' | 'reports' | 'hiring' | 'directory';

export interface BambooHRAction {
  name: string; // Composio action name (e.g., BAMBOOHR_GET_EMPLOYEE)
  label: string; // Human-readable label
  category: BambooHRActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when BambooHR connected)
// ============================================================================

const ESSENTIAL_ACTIONS: BambooHRAction[] = [
  // Employees - Core
  {
    name: 'BAMBOOHR_GET_EMPLOYEE',
    label: 'Get Employee',
    category: 'employees',
    priority: 1,
  },
  {
    name: 'BAMBOOHR_LIST_EMPLOYEES',
    label: 'List Employees',
    category: 'employees',
    priority: 1,
  },

  // Directory - Core
  {
    name: 'BAMBOOHR_GET_DIRECTORY',
    label: 'Get Directory',
    category: 'directory',
    priority: 1,
  },

  // TimeOff - Core
  {
    name: 'BAMBOOHR_GET_TIME_OFF_REQUESTS',
    label: 'Get Time Off Requests',
    category: 'timeoff',
    priority: 1,
  },
  {
    name: 'BAMBOOHR_REQUEST_TIME_OFF',
    label: 'Request Time Off',
    category: 'timeoff',
    priority: 1,
    writeOperation: true,
  },

  // Reports - Core
  {
    name: 'BAMBOOHR_GET_REPORT',
    label: 'Get Report',
    category: 'reports',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: BambooHRAction[] = [
  // Employees - Extended
  {
    name: 'BAMBOOHR_CREATE_EMPLOYEE',
    label: 'Create Employee',
    category: 'employees',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'BAMBOOHR_UPDATE_EMPLOYEE',
    label: 'Update Employee',
    category: 'employees',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'BAMBOOHR_GET_EMPLOYEE_FIELDS',
    label: 'Get Employee Fields',
    category: 'employees',
    priority: 2,
  },

  // TimeOff - Extended
  {
    name: 'BAMBOOHR_GET_TIME_OFF_BALANCES',
    label: 'Get Time Off Balances',
    category: 'timeoff',
    priority: 2,
  },
  {
    name: 'BAMBOOHR_GET_TIME_OFF_TYPES',
    label: 'Get Time Off Types',
    category: 'timeoff',
    priority: 2,
  },

  // Reports - Extended
  {
    name: 'BAMBOOHR_LIST_REPORTS',
    label: 'List Reports',
    category: 'reports',
    priority: 2,
  },
  {
    name: 'BAMBOOHR_RUN_CUSTOM_REPORT',
    label: 'Run Custom Report',
    category: 'reports',
    priority: 2,
  },

  // Directory - Extended
  {
    name: 'BAMBOOHR_SEARCH_DIRECTORY',
    label: 'Search Directory',
    category: 'directory',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: BambooHRAction[] = [
  // Hiring - Core
  {
    name: 'BAMBOOHR_LIST_APPLICANTS',
    label: 'List Applicants',
    category: 'hiring',
    priority: 3,
  },
  {
    name: 'BAMBOOHR_GET_APPLICANT',
    label: 'Get Applicant Details',
    category: 'hiring',
    priority: 3,
  },
  {
    name: 'BAMBOOHR_LIST_JOB_OPENINGS',
    label: 'List Job Openings',
    category: 'hiring',
    priority: 3,
  },
  {
    name: 'BAMBOOHR_ADD_APPLICANT',
    label: 'Add Applicant',
    category: 'hiring',
    priority: 3,
    writeOperation: true,
  },

  // Employees - Extended
  {
    name: 'BAMBOOHR_GET_EMPLOYEE_FILES',
    label: 'Get Employee Files',
    category: 'employees',
    priority: 3,
  },
  {
    name: 'BAMBOOHR_GET_EMPLOYEE_TABLE_DATA',
    label: 'Get Employee Table Data',
    category: 'employees',
    priority: 3,
  },

  // TimeOff - Extended
  {
    name: 'BAMBOOHR_APPROVE_TIME_OFF',
    label: 'Approve Time Off',
    category: 'timeoff',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'BAMBOOHR_DENY_TIME_OFF',
    label: 'Deny Time Off',
    category: 'timeoff',
    priority: 3,
    writeOperation: true,
  },

  // Directory - Extended
  {
    name: 'BAMBOOHR_GET_ORG_CHART',
    label: 'Get Org Chart',
    category: 'directory',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations & specialized)
// ============================================================================

const ADVANCED_ACTIONS: BambooHRAction[] = [
  // Employees - Destructive
  {
    name: 'BAMBOOHR_TERMINATE_EMPLOYEE',
    label: 'Terminate Employee',
    category: 'employees',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // TimeOff - Destructive
  {
    name: 'BAMBOOHR_CANCEL_TIME_OFF',
    label: 'Cancel Time Off Request',
    category: 'timeoff',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Hiring - Extended
  {
    name: 'BAMBOOHR_UPDATE_APPLICANT_STATUS',
    label: 'Update Applicant Status',
    category: 'hiring',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'BAMBOOHR_CREATE_JOB_OPENING',
    label: 'Create Job Opening',
    category: 'hiring',
    priority: 4,
    writeOperation: true,
  },

  // Employees - Specialized
  {
    name: 'BAMBOOHR_UPLOAD_EMPLOYEE_FILE',
    label: 'Upload Employee File',
    category: 'employees',
    priority: 4,
    writeOperation: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_BAMBOOHR_ACTIONS: BambooHRAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getBambooHRFeaturedActionNames(): string[] {
  return ALL_BAMBOOHR_ACTIONS.map((a) => a.name);
}

export function getBambooHRActionsByPriority(maxPriority: number = 3): BambooHRAction[] {
  return ALL_BAMBOOHR_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getBambooHRActionNamesByPriority(maxPriority: number = 3): string[] {
  return getBambooHRActionsByPriority(maxPriority).map((a) => a.name);
}

export function getBambooHRActionsByCategory(category: BambooHRActionCategory): BambooHRAction[] {
  return ALL_BAMBOOHR_ACTIONS.filter((a) => a.category === category);
}

export function getBambooHRActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_BAMBOOHR_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownBambooHRAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_BAMBOOHR_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveBambooHRAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_BAMBOOHR_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by BambooHR action priority.
 * Known BambooHR actions sorted by priority (1-4), unknown actions last.
 */
export function sortByBambooHRPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getBambooHRActionPriority(a.name) - getBambooHRActionPriority(b.name);
  });
}

export function getBambooHRActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_BAMBOOHR_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_BAMBOOHR_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate BambooHR-specific system prompt when user has BambooHR connected.
 * Tells Claude exactly what it can do via the Composio BambooHR toolkit.
 */
export function getBambooHRSystemPrompt(): string {
  return `
## BambooHR Integration (Full Capabilities)

You have **full BambooHR access** through the user's connected account. Use the \`composio_BAMBOOHR_*\` tools.

### Employees
- View employee records and details
- List all employees with filters
- Create new employee records
- Update employee information and custom fields
- View employee files and table data
- Terminate employees (with confirmation)
- Upload employee files

### Time Off
- View time off requests and their status
- Submit time off requests on behalf of employees
- Check time off balances by employee
- View available time off types
- Approve or deny time off requests
- Cancel time off requests (with confirmation)

### Reports
- Run pre-built HR reports
- List available reports
- Execute custom reports with selected fields
- Export report data for analysis

### Hiring
- List applicants in the ATS pipeline
- View applicant details and status
- Add new applicants to the system
- Update applicant status through pipeline stages
- List and create job openings

### Directory
- Browse the company directory
- Search for employees by name, department, or location
- View the organizational chart

### Safety Rules
1. **ALWAYS confirm before modifying employee records** - show changes using the action-preview format:
\`\`\`action-preview
{
  "platform": "BambooHR",
  "action": "Update Employee",
  "content": "Employee name and field changes...",
  "toolName": "composio_BAMBOOHR_UPDATE_EMPLOYEE",
  "toolParams": { "employee_id": "...", "fields": {} }
}
\`\`\`
2. **Never terminate without explicit confirmation** - always show employee details and explain the impact
3. **For time off approvals/denials**, show the request details and employee's current balance
4. **For new employee creation**, confirm all required fields before submission
5. **Handle sensitive data carefully** - employee information is confidential
6. **For applicant status changes**, confirm the new status and any automated notifications
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getBambooHRCapabilitySummary(): string {
  const stats = getBambooHRActionStats();
  return `BambooHR (${stats.total} actions: employees, timeoff, reports, hiring, directory)`;
}

export function logBambooHRToolkitStats(): void {
  const stats = getBambooHRActionStats();
  log.info('BambooHR Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
