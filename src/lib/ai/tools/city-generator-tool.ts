/**
 * CITY GENERATOR TOOL
 * Generate procedural cities with districts, buildings, streets, and POIs
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface District { name: string; type: string; x: number; y: number; width: number; height: number; }
interface Building { name: string; type: string; floors: number; x: number; y: number; }
interface Street { name: string; type: string; start: { x: number; y: number }; end: { x: number; y: number }; }

const DISTRICT_TYPES = ['residential', 'commercial', 'industrial', 'downtown', 'suburban', 'historic', 'entertainment', 'park'];
const BUILDING_TYPES: Record<string, string[]> = {
  residential: ['apartment', 'house', 'condo', 'townhouse', 'duplex'],
  commercial: ['office', 'store', 'mall', 'restaurant', 'hotel'],
  industrial: ['factory', 'warehouse', 'plant', 'depot', 'refinery'],
  downtown: ['skyscraper', 'high-rise', 'office tower', 'corporate HQ'],
  entertainment: ['theater', 'arena', 'casino', 'nightclub', 'museum'],
  park: ['playground', 'pavilion', 'fountain', 'garden', 'gazebo']
};

const STREET_PREFIXES = ['Main', 'Oak', 'Maple', 'Cedar', 'Park', 'Lake', 'River', 'Hill', 'Valley', 'Forest', 'Sunset', 'First', 'Second', 'Third', 'Fourth', 'Fifth'];
const STREET_SUFFIXES = ['Street', 'Avenue', 'Boulevard', 'Drive', 'Lane', 'Road', 'Way', 'Place', 'Court', 'Circle'];

function generateStreetName(): string {
  return `${STREET_PREFIXES[Math.floor(Math.random() * STREET_PREFIXES.length)]} ${STREET_SUFFIXES[Math.floor(Math.random() * STREET_SUFFIXES.length)]}`;
}

function generateDistrictName(type: string): string {
  const prefixes = ['Old', 'New', 'Upper', 'Lower', 'East', 'West', 'North', 'South', 'Central', 'Little'];
  const suffixes = ['Town', 'Village', 'Square', 'Heights', 'Park', 'District', 'Quarter', 'Side'];
  return `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${type.charAt(0).toUpperCase() + type.slice(1)} ${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
}

function generateDistricts(width: number, height: number, count: number): District[] {
  const districts: District[] = [];
  const cellWidth = Math.floor(width / Math.ceil(Math.sqrt(count)));
  const cellHeight = Math.floor(height / Math.ceil(Math.sqrt(count)));

  for (let i = 0; i < count; i++) {
    const gridX = i % Math.ceil(Math.sqrt(count));
    const gridY = Math.floor(i / Math.ceil(Math.sqrt(count)));
    const type = DISTRICT_TYPES[Math.floor(Math.random() * DISTRICT_TYPES.length)];

    districts.push({
      name: generateDistrictName(type),
      type,
      x: gridX * cellWidth + Math.floor(Math.random() * (cellWidth / 4)),
      y: gridY * cellHeight + Math.floor(Math.random() * (cellHeight / 4)),
      width: Math.floor(cellWidth * (0.6 + Math.random() * 0.3)),
      height: Math.floor(cellHeight * (0.6 + Math.random() * 0.3))
    });
  }

  return districts;
}

function generateBuildings(district: District, density: number = 0.3): Building[] {
  const buildings: Building[] = [];
  const buildingTypes = BUILDING_TYPES[district.type] || BUILDING_TYPES.commercial;
  const count = Math.floor(district.width * district.height * density);

  for (let i = 0; i < count; i++) {
    const type = buildingTypes[Math.floor(Math.random() * buildingTypes.length)];
    const maxFloors = district.type === 'downtown' ? 50 : district.type === 'industrial' ? 5 : 15;

    buildings.push({
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} #${i + 1}`,
      type,
      floors: Math.floor(Math.random() * maxFloors) + 1,
      x: district.x + Math.floor(Math.random() * district.width),
      y: district.y + Math.floor(Math.random() * district.height)
    });
  }

  return buildings;
}

function generateStreetGrid(width: number, height: number): Street[] {
  const streets: Street[] = [];
  const horizontalSpacing = Math.floor(height / 8);
  const verticalSpacing = Math.floor(width / 8);

  // Horizontal streets
  for (let y = horizontalSpacing; y < height; y += horizontalSpacing) {
    streets.push({
      name: generateStreetName(),
      type: y === Math.floor(height / 2) ? 'main' : 'secondary',
      start: { x: 0, y },
      end: { x: width, y }
    });
  }

  // Vertical streets
  for (let x = verticalSpacing; x < width; x += verticalSpacing) {
    streets.push({
      name: generateStreetName(),
      type: x === Math.floor(width / 2) ? 'main' : 'secondary',
      start: { x, y: 0 },
      end: { x, y: height }
    });
  }

  return streets;
}

function generatePOIs(districts: District[]): Array<Record<string, unknown>> {
  const pois: Array<Record<string, unknown>> = [];
  const poiTypes = [
    { type: 'landmark', names: ['City Hall', 'Central Station', 'Clock Tower', 'Monument', 'Cathedral'] },
    { type: 'service', names: ['Hospital', 'Police Station', 'Fire Station', 'Library', 'Post Office'] },
    { type: 'transport', names: ['Bus Terminal', 'Metro Station', 'Airport', 'Ferry Terminal', 'Train Station'] },
    { type: 'recreation', names: ['Stadium', 'Park', 'Zoo', 'Aquarium', 'Botanical Garden'] }
  ];

  for (const district of districts) {
    const poiCategory = poiTypes[Math.floor(Math.random() * poiTypes.length)];
    if (Math.random() < 0.5) {
      pois.push({
        name: poiCategory.names[Math.floor(Math.random() * poiCategory.names.length)],
        type: poiCategory.type,
        district: district.name,
        location: { x: district.x + district.width / 2, y: district.y + district.height / 2 }
      });
    }
  }

  return pois;
}

function generateCityStats(districts: District[], buildings: Building[], streets: Street[]): Record<string, unknown> {
  const population = buildings.reduce((sum, b) => {
    const popPerFloor = b.type === 'apartment' ? 20 : b.type === 'house' ? 4 : b.type === 'condo' ? 15 : 0;
    return sum + popPerFloor * b.floors;
  }, 0);

  const districtBreakdown: Record<string, number> = {};
  for (const d of districts) {
    districtBreakdown[d.type] = (districtBreakdown[d.type] || 0) + 1;
  }

  return {
    totalDistricts: districts.length,
    totalBuildings: buildings.length,
    totalStreets: streets.length,
    estimatedPopulation: population,
    districtTypes: districtBreakdown,
    avgBuildingHeight: (buildings.reduce((s, b) => s + b.floors, 0) / buildings.length).toFixed(1) + ' floors',
    tallestBuilding: Math.max(...buildings.map(b => b.floors)) + ' floors'
  };
}

function cityToAscii(width: number, height: number, districts: District[], streets: Street[]): string {
  const map: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));

  // Draw districts
  for (const d of districts) {
    const char = d.type === 'park' ? '.' : d.type === 'industrial' ? 'I' : d.type === 'residential' ? 'R' : '#';
    for (let y = d.y; y < d.y + d.height && y < height; y++) {
      for (let x = d.x; x < d.x + d.width && x < width; x++) {
        if (x >= 0 && y >= 0) map[y][x] = char;
      }
    }
  }

  // Draw streets
  for (const s of streets) {
    const char = s.type === 'main' ? '=' : '-';
    if (s.start.y === s.end.y) {
      for (let x = s.start.x; x <= s.end.x && x < width; x++) {
        if (s.start.y >= 0 && s.start.y < height && x >= 0) map[s.start.y][x] = char;
      }
    } else {
      for (let y = s.start.y; y <= s.end.y && y < height; y++) {
        if (s.start.x >= 0 && s.start.x < width && y >= 0) map[y][s.start.x] = '|';
      }
    }
  }

  return map.map(row => row.join('')).join('\n');
}

function generateCity(width: number = 80, height: number = 40, districtCount: number = 9): Record<string, unknown> {
  const districts = generateDistricts(width, height, districtCount);
  const allBuildings: Building[] = [];
  for (const d of districts) {
    allBuildings.push(...generateBuildings(d));
  }
  const streets = generateStreetGrid(width, height);
  const pois = generatePOIs(districts);

  return {
    dimensions: { width, height },
    districts,
    buildings: allBuildings.length,
    streets: streets.map(s => s.name),
    pointsOfInterest: pois,
    statistics: generateCityStats(districts, allBuildings, streets),
    map: cityToAscii(width, height, districts, streets)
  };
}

export const cityGeneratorTool: UnifiedTool = {
  name: 'city_generator',
  description: 'City Generator: generate, district, streets, buildings, pois, stats',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['generate', 'district', 'streets', 'buildings', 'pois', 'stats'] },
      width: { type: 'number' },
      height: { type: 'number' },
      districtCount: { type: 'number' },
      districtType: { type: 'string' }
    },
    required: ['operation']
  }
};

export async function executeCityGenerator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    const w = args.width || 80;
    const h = args.height || 40;

    switch (args.operation) {
      case 'generate':
        result = generateCity(w, h, args.districtCount || 9);
        break;
      case 'district':
        const districts = generateDistricts(w, h, args.districtCount || 9);
        result = { districts };
        break;
      case 'streets':
        result = { streets: generateStreetGrid(w, h) };
        break;
      case 'buildings':
        const d: District = {
          name: 'Test District',
          type: args.districtType || 'commercial',
          x: 0, y: 0, width: w, height: h
        };
        result = { buildings: generateBuildings(d) };
        break;
      case 'pois':
        const poisDistricts = generateDistricts(w, h, args.districtCount || 9);
        result = { pois: generatePOIs(poisDistricts) };
        break;
      case 'stats':
        const city = generateCity(w, h, args.districtCount || 9);
        result = { statistics: city.statistics };
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isCityGeneratorAvailable(): boolean { return true; }
