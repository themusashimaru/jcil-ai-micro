/**
 * PLANET GENERATOR TOOL
 * Generate procedural planets with terrain, atmosphere, and features
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

interface PlanetConfig {
  type: string;
  size: number;
  atmosphere: boolean;
  water: boolean;
  temperature: number;
  gravity: number;
}

const PLANET_TYPES: Record<string, Partial<PlanetConfig>> = {
  terrestrial: { atmosphere: true, water: true, temperature: 15, gravity: 1.0 },
  desert: { atmosphere: true, water: false, temperature: 45, gravity: 0.9 },
  ocean: { atmosphere: true, water: true, temperature: 20, gravity: 1.1 },
  ice: { atmosphere: true, water: true, temperature: -50, gravity: 0.8 },
  volcanic: { atmosphere: true, water: false, temperature: 200, gravity: 1.2 },
  gas_giant: { atmosphere: true, water: false, temperature: -100, gravity: 2.5 },
  barren: { atmosphere: false, water: false, temperature: -20, gravity: 0.4 },
  toxic: { atmosphere: true, water: false, temperature: 80, gravity: 1.0 }
};

function generatePlanetName(): string {
  const prefixes = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Theta', 'Kepler', 'Gliese', 'HD', 'TRAPPIST'];
  const suffixes = ['Prime', 'Major', 'Minor', 'b', 'c', 'd', 'e', 'f', 'I', 'II', 'III', 'IV', 'V'];
  const numbers = Math.floor(Math.random() * 9999) + 1;
  return `${prefixes[Math.floor(Math.random() * prefixes.length)]}-${numbers}${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
}

function generateAtmosphere(type: string): Record<string, unknown> {
  const compositions: Record<string, Record<string, number>> = {
    terrestrial: { nitrogen: 78, oxygen: 21, argon: 0.9, co2: 0.04 },
    desert: { co2: 95, nitrogen: 3, argon: 1.6, oxygen: 0.1 },
    ocean: { nitrogen: 70, oxygen: 28, water_vapor: 1.5, argon: 0.5 },
    ice: { nitrogen: 85, methane: 10, argon: 5 },
    volcanic: { co2: 60, sulfur_dioxide: 30, nitrogen: 8, water_vapor: 2 },
    gas_giant: { hydrogen: 90, helium: 9, methane: 0.5, ammonia: 0.5 },
    toxic: { sulfuric_acid: 40, co2: 50, nitrogen: 8, sulfur_dioxide: 2 }
  };

  const comp = compositions[type] || compositions.terrestrial;
  return {
    composition: comp,
    pressure: type === 'gas_giant' ? 'crushing' : type === 'barren' ? 'none' : 'normal',
    breathable: type === 'terrestrial' || type === 'ocean'
  };
}

function generateTerrain(type: string, _size: number): Record<string, unknown> {
  const features: Record<string, string[]> = {
    terrestrial: ['continents', 'oceans', 'mountains', 'plains', 'forests', 'deserts'],
    desert: ['sand dunes', 'rocky plateaus', 'canyons', 'dried riverbeds', 'oasis'],
    ocean: ['global ocean', 'island chains', 'underwater mountains', 'deep trenches'],
    ice: ['ice sheets', 'glaciers', 'frozen lakes', 'ice canyons', 'tundra'],
    volcanic: ['lava flows', 'calderas', 'ash plains', 'magma lakes', 'volcanic mountains'],
    gas_giant: ['storm bands', 'cyclones', 'cloud layers', 'pressure zones'],
    barren: ['craters', 'dust plains', 'rocky outcrops', 'rilles', 'impact basins'],
    toxic: ['acid lakes', 'sulfur flats', 'corrosive plains', 'toxic swamps']
  };

  const typeFeatures = features[type] || features.barren;
  const selectedFeatures = typeFeatures.slice(0, Math.floor(Math.random() * 3) + 3);

  return {
    features: selectedFeatures,
    highestPoint: Math.floor(Math.random() * 20000 + 5000) + 'm',
    lowestPoint: Math.floor(Math.random() * -10000) + 'm',
    landmassCount: type === 'ocean' ? Math.floor(Math.random() * 50) + 10 : Math.floor(Math.random() * 7) + 1
  };
}

function generateMoons(planetSize: number): Array<Record<string, unknown>> {
  const moonCount = Math.floor(Math.random() * (planetSize > 50000 ? 20 : 5));
  const moons: Array<Record<string, unknown>> = [];

  for (let i = 0; i < moonCount; i++) {
    moons.push({
      name: `Moon-${String.fromCharCode(65 + i)}`,
      diameter: Math.floor(Math.random() * 3000 + 500) + ' km',
      orbitalPeriod: (Math.random() * 30 + 1).toFixed(1) + ' days',
      type: ['rocky', 'icy', 'volcanic'][Math.floor(Math.random() * 3)]
    });
  }

  return moons;
}

function generateResources(type: string): Array<Record<string, unknown>> {
  const resourcePools: Record<string, string[]> = {
    terrestrial: ['iron', 'copper', 'gold', 'silver', 'uranium', 'titanium', 'water', 'rare_earths'],
    desert: ['silicon', 'iron', 'copper', 'precious_metals', 'solar_energy'],
    ocean: ['water', 'deuterium', 'rare_fish', 'coral', 'underwater_minerals'],
    ice: ['water_ice', 'frozen_gases', 'deuterium', 'helium-3'],
    volcanic: ['sulfur', 'obsidian', 'iron', 'geothermal_energy', 'rare_metals'],
    gas_giant: ['hydrogen', 'helium', 'helium-3', 'deuterium', 'metallic_hydrogen'],
    barren: ['iron', 'nickel', 'regolith', 'helium-3', 'rare_earths'],
    toxic: ['sulfur', 'acids', 'exotic_compounds', 'heavy_metals']
  };

  const pool = resourcePools[type] || resourcePools.barren;
  const selected = pool.slice(0, Math.floor(Math.random() * 4) + 2);

  return selected.map(r => ({
    name: r,
    abundance: ['scarce', 'moderate', 'abundant'][Math.floor(Math.random() * 3)],
    accessible: Math.random() > 0.3
  }));
}

function generatePlanet(type: string = 'terrestrial'): Record<string, unknown> {
  const config = PLANET_TYPES[type] || PLANET_TYPES.terrestrial;
  const size = type === 'gas_giant'
    ? Math.floor(Math.random() * 100000 + 50000)
    : Math.floor(Math.random() * 15000 + 3000);

  return {
    name: generatePlanetName(),
    type,
    diameter: size + ' km',
    mass: (size / 12742 * (config.gravity || 1)).toFixed(2) + ' Earth masses',
    gravity: (config.gravity || 1) + ' g',
    temperature: {
      average: config.temperature + '°C',
      range: `${(config.temperature || 0) - 40}°C to ${(config.temperature || 0) + 40}°C`
    },
    dayLength: (Math.random() * 48 + 6).toFixed(1) + ' hours',
    yearLength: (Math.random() * 500 + 100).toFixed(0) + ' Earth days',
    atmosphere: config.atmosphere ? generateAtmosphere(type) : null,
    terrain: generateTerrain(type, size),
    moons: generateMoons(size),
    resources: generateResources(type),
    habitability: {
      score: type === 'terrestrial' ? Math.floor(Math.random() * 30 + 70) :
             type === 'ocean' ? Math.floor(Math.random() * 20 + 50) :
             Math.floor(Math.random() * 30),
      requirements: type === 'terrestrial' ? 'minimal' :
                   type === 'ocean' || type === 'ice' ? 'moderate' : 'extensive'
    }
  };
}

function generateSolarSystem(starType: string = 'G'): Record<string, unknown> {
  const starTypes: Record<string, { temperature: number; color: string; planets: number }> = {
    'O': { temperature: 30000, color: 'blue', planets: 2 },
    'B': { temperature: 20000, color: 'blue-white', planets: 3 },
    'A': { temperature: 10000, color: 'white', planets: 4 },
    'F': { temperature: 7000, color: 'yellow-white', planets: 5 },
    'G': { temperature: 5500, color: 'yellow', planets: 8 },
    'K': { temperature: 4000, color: 'orange', planets: 6 },
    'M': { temperature: 3000, color: 'red', planets: 4 }
  };

  const star = starTypes[starType] || starTypes['G'];
  const planetTypes = ['barren', 'terrestrial', 'desert', 'ocean', 'ice', 'gas_giant', 'volcanic', 'toxic'];
  const planets = [];

  for (let i = 0; i < star.planets; i++) {
    const type = i < 2 ? ['barren', 'terrestrial', 'desert'][Math.floor(Math.random() * 3)] :
                i < 5 ? planetTypes[Math.floor(Math.random() * planetTypes.length)] :
                'gas_giant';
    planets.push({
      orbit: i + 1,
      ...generatePlanet(type)
    });
  }

  return {
    star: {
      type: starType,
      class: `${starType}-type main sequence`,
      temperature: star.temperature + ' K',
      color: star.color,
      age: (Math.random() * 10 + 1).toFixed(1) + ' billion years'
    },
    planets,
    asteroidBelts: Math.floor(Math.random() * 3),
    cometCount: Math.floor(Math.random() * 1000)
  };
}

export const planetGeneratorTool: UnifiedTool = {
  name: 'planet_generator',
  description: 'Planet Generator: planet, system, types, compare, random',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['planet', 'system', 'types', 'compare', 'random'] },
      type: { type: 'string' },
      starType: { type: 'string' },
      count: { type: 'number' }
    },
    required: ['operation']
  }
};

export async function executePlanetGenerator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    let result: Record<string, unknown>;

    switch (args.operation) {
      case 'planet':
        result = generatePlanet(args.type || 'terrestrial');
        break;
      case 'system':
        result = generateSolarSystem(args.starType || 'G');
        break;
      case 'types':
        result = {
          planetTypes: Object.entries(PLANET_TYPES).map(([name, config]) => ({
            name,
            ...config
          }))
        };
        break;
      case 'compare':
        const count = args.count || 3;
        const planets = [];
        for (let i = 0; i < count; i++) {
          const type = Object.keys(PLANET_TYPES)[Math.floor(Math.random() * Object.keys(PLANET_TYPES).length)];
          planets.push(generatePlanet(type));
        }
        result = { planets };
        break;
      case 'random':
        const randomType = Object.keys(PLANET_TYPES)[Math.floor(Math.random() * Object.keys(PLANET_TYPES).length)];
        result = generatePlanet(randomType);
        break;
      default:
        throw new Error(`Unknown operation: ${args.operation}`);
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    return { toolCallId: id, content: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, isError: true };
  }
}

export function isPlanetGeneratorAvailable(): boolean { return true; }
