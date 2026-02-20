/**
 * COMPOSIO GOOGLE MAPS TOOLKIT
 * =============================
 *
 * Comprehensive Google Maps integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Places (search, details, nearby, autocomplete, find)
 * - Directions (routes, snap to roads, speed limits)
 * - Geocoding (geocode, reverse geocode, elevation, timezone)
 * - Distance (distance matrix)
 */

import { logger } from '@/lib/logger';

const log = logger('GoogleMapsToolkit');

// ============================================================================
// GOOGLE MAPS ACTION CATEGORIES
// ============================================================================

export type GoogleMapsActionCategory = 'places' | 'directions' | 'geocoding' | 'distance';

export interface GoogleMapsAction {
  name: string; // Composio action name (e.g., GOOGLEMAPS_SEARCH_PLACES)
  label: string; // Human-readable label
  category: GoogleMapsActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when Google Maps connected)
// ============================================================================

const ESSENTIAL_ACTIONS: GoogleMapsAction[] = [
  // Places
  {
    name: 'GOOGLEMAPS_SEARCH_PLACES',
    label: 'Search Places',
    category: 'places',
    priority: 1,
  },
  {
    name: 'GOOGLEMAPS_GET_PLACE_DETAILS',
    label: 'Get Place Details',
    category: 'places',
    priority: 1,
  },

  // Directions
  {
    name: 'GOOGLEMAPS_GET_DIRECTIONS',
    label: 'Get Directions',
    category: 'directions',
    priority: 1,
  },

  // Geocoding
  {
    name: 'GOOGLEMAPS_GEOCODE_ADDRESS',
    label: 'Geocode Address',
    category: 'geocoding',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: GoogleMapsAction[] = [
  // Geocoding - Extended
  {
    name: 'GOOGLEMAPS_REVERSE_GEOCODE',
    label: 'Reverse Geocode',
    category: 'geocoding',
    priority: 2,
  },

  // Distance
  {
    name: 'GOOGLEMAPS_GET_DISTANCE_MATRIX',
    label: 'Get Distance Matrix',
    category: 'distance',
    priority: 2,
  },

  // Places - Extended
  {
    name: 'GOOGLEMAPS_NEARBY_SEARCH',
    label: 'Nearby Search',
    category: 'places',
    priority: 2,
  },
  {
    name: 'GOOGLEMAPS_TEXT_SEARCH',
    label: 'Text Search',
    category: 'places',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: GoogleMapsAction[] = [
  // Places - Extended
  {
    name: 'GOOGLEMAPS_AUTOCOMPLETE_PLACE',
    label: 'Autocomplete Place',
    category: 'places',
    priority: 3,
  },

  // Geocoding - Extended
  {
    name: 'GOOGLEMAPS_GET_ELEVATION',
    label: 'Get Elevation',
    category: 'geocoding',
    priority: 3,
  },

  // Places - Extended
  {
    name: 'GOOGLEMAPS_FIND_PLACE',
    label: 'Find Place',
    category: 'places',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Specialized operations)
// ============================================================================

const ADVANCED_ACTIONS: GoogleMapsAction[] = [
  {
    name: 'GOOGLEMAPS_GET_TIMEZONE',
    label: 'Get Timezone',
    category: 'geocoding',
    priority: 4,
  },
  {
    name: 'GOOGLEMAPS_SNAP_TO_ROADS',
    label: 'Snap to Roads',
    category: 'directions',
    priority: 4,
  },
  {
    name: 'GOOGLEMAPS_GET_SPEED_LIMITS',
    label: 'Get Speed Limits',
    category: 'directions',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_GOOGLE_MAPS_ACTIONS: GoogleMapsAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getGoogleMapsFeaturedActionNames(): string[] {
  return ALL_GOOGLE_MAPS_ACTIONS.map((a) => a.name);
}

export function getGoogleMapsActionsByPriority(maxPriority: number = 3): GoogleMapsAction[] {
  return ALL_GOOGLE_MAPS_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getGoogleMapsActionNamesByPriority(maxPriority: number = 3): string[] {
  return getGoogleMapsActionsByPriority(maxPriority).map((a) => a.name);
}

export function getGoogleMapsActionsByCategory(
  category: GoogleMapsActionCategory
): GoogleMapsAction[] {
  return ALL_GOOGLE_MAPS_ACTIONS.filter((a) => a.category === category);
}

export function getGoogleMapsActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_GOOGLE_MAPS_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownGoogleMapsAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GOOGLE_MAPS_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveGoogleMapsAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_GOOGLE_MAPS_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by Google Maps action priority.
 * Known Google Maps actions sorted by priority (1-4), unknown actions last.
 */
export function sortByGoogleMapsPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getGoogleMapsActionPriority(a.name) - getGoogleMapsActionPriority(b.name);
  });
}

export function getGoogleMapsActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_GOOGLE_MAPS_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_GOOGLE_MAPS_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate Google Maps-specific system prompt when user has Google Maps connected.
 * Tells Claude exactly what it can do via the Composio Google Maps toolkit.
 */
export function getGoogleMapsSystemPrompt(): string {
  return `
## Google Maps Integration (Full Capabilities)

You have **full Google Maps access** through the user's connected account. Use the \`composio_GOOGLEMAPS_*\` tools.

### Place Search
- Search for places by query string (restaurants, hotels, landmarks, etc.)
- Get detailed information about a specific place (hours, ratings, reviews, photos, contact info)
- Search for places near a specific location with radius filters
- Perform text-based place searches with rich filtering
- Autocomplete place names and addresses as the user types
- Find a place from text input or phone number

### Directions
- Get step-by-step directions between two or more locations
- Support for driving, walking, bicycling, and transit modes
- Get alternative routes and estimated travel times
- Snap GPS coordinates to the nearest road segments
- Retrieve speed limit data for road segments

### Geocoding
- Convert addresses into geographic coordinates (latitude/longitude)
- Reverse geocode coordinates back into human-readable addresses
- Get elevation data for locations or along a path
- Determine the timezone for a specific location and timestamp

### Distance Calculation
- Calculate travel distance and time between multiple origins and destinations
- Support for different travel modes (driving, walking, bicycling, transit)
- Get distance matrix for route planning and optimization

### Safety Rules
1. **All operations are read-only** - Google Maps tools only retrieve information, they do not modify any data
2. **Verify location context** - when searching for places, confirm the geographic area with the user if ambiguous
3. **Show clear results** - always present addresses, coordinates, and distances in a clear, readable format:
\`\`\`action-preview
{
  "platform": "Google Maps",
  "action": "Search Places",
  "query": "...",
  "location": "...",
  "toolName": "composio_GOOGLEMAPS_SEARCH_PLACES",
  "toolParams": { "query": "..." }
}
\`\`\`
4. **Include relevant details** - when showing place results, include ratings, hours, and contact info when available
5. **Clarify travel mode** - when providing directions or distances, confirm the travel mode (driving, walking, transit, bicycling)
6. **Handle multiple results** - when a search returns multiple places, present them as a numbered list for the user to choose from
7. **Coordinate precision** - use appropriate decimal precision for coordinates (typically 6 decimal places)
8. **For batch distance calculations**, summarize the matrix clearly showing all origin-destination pairs
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getGoogleMapsCapabilitySummary(): string {
  const stats = getGoogleMapsActionStats();
  return `Google Maps (${stats.total} actions: places, directions, geocoding, distance)`;
}

export function logGoogleMapsToolkitStats(): void {
  const stats = getGoogleMapsActionStats();
  log.info('Google Maps Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
