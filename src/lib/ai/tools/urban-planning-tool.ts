/**
 * URBAN-PLANNING TOOL
 * Comprehensive urban planning analysis including zoning, density,
 * walkability, transit accessibility, and land use optimization
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface Parcel {
  id: string;
  area: number;           // square meters
  currentZone: ZoneType;
  currentUse: LandUse;
  buildingHeight?: number; // meters
  far?: number;           // Floor Area Ratio
  coverage?: number;      // lot coverage %
  coordinates?: { lat: number; lng: number };
}

type ZoneType = 'R1' | 'R2' | 'R3' | 'R4' | 'C1' | 'C2' | 'C3' | 'M1' | 'M2' | 'MU' | 'OS' | 'I';
type LandUse = 'residential' | 'commercial' | 'industrial' | 'mixed' | 'park' | 'institutional' | 'vacant';

interface ZoneDefinition {
  code: ZoneType;
  name: string;
  description: string;
  allowedUses: LandUse[];
  maxFAR: number;
  maxHeight: number;      // meters
  maxCoverage: number;    // percentage
  minLotSize: number;     // sqm
  setbacks: { front: number; side: number; rear: number };
  parkingReq: number;     // spaces per 1000 sqm
}

interface WalkabilityScore {
  overall: number;        // 0-100
  categories: {
    amenities: number;
    intersection_density: number;
    pedestrian_infrastructure: number;
    land_use_mix: number;
  };
  walkscore_equivalent: string;
}

interface TransitScore {
  overall: number;        // 0-100
  coverage: number;
  frequency: number;
  capacity: number;
  accessibility: string;
}

interface DensityAnalysis {
  population_density: number;  // per sq km
  dwelling_density: number;    // per hectare
  employment_density: number;  // per hectare
  far_average: number;
  classification: string;
}

interface PlanningRecommendation {
  category: string;
  priority: 'high' | 'medium' | 'low';
  recommendation: string;
  impact: string;
  implementation: string;
}

// =============================================================================
// ZONE DEFINITIONS
// =============================================================================

const ZONE_DEFINITIONS: Record<ZoneType, ZoneDefinition> = {
  R1: {
    code: 'R1',
    name: 'Single Family Residential',
    description: 'Low density single-family homes',
    allowedUses: ['residential'],
    maxFAR: 0.4,
    maxHeight: 9,
    maxCoverage: 35,
    minLotSize: 500,
    setbacks: { front: 6, side: 1.5, rear: 6 },
    parkingReq: 2
  },
  R2: {
    code: 'R2',
    name: 'Low Density Residential',
    description: 'Duplexes and small multifamily',
    allowedUses: ['residential'],
    maxFAR: 0.6,
    maxHeight: 12,
    maxCoverage: 40,
    minLotSize: 400,
    setbacks: { front: 5, side: 1.5, rear: 5 },
    parkingReq: 1.5
  },
  R3: {
    code: 'R3',
    name: 'Medium Density Residential',
    description: 'Townhouses and apartments',
    allowedUses: ['residential'],
    maxFAR: 1.5,
    maxHeight: 18,
    maxCoverage: 50,
    minLotSize: 300,
    setbacks: { front: 4, side: 1.2, rear: 4 },
    parkingReq: 1.2
  },
  R4: {
    code: 'R4',
    name: 'High Density Residential',
    description: 'High-rise apartments',
    allowedUses: ['residential'],
    maxFAR: 3.0,
    maxHeight: 45,
    maxCoverage: 60,
    minLotSize: 200,
    setbacks: { front: 3, side: 1, rear: 3 },
    parkingReq: 1.0
  },
  C1: {
    code: 'C1',
    name: 'Neighborhood Commercial',
    description: 'Local shops and services',
    allowedUses: ['commercial', 'mixed'],
    maxFAR: 1.0,
    maxHeight: 12,
    maxCoverage: 70,
    minLotSize: 200,
    setbacks: { front: 0, side: 0, rear: 3 },
    parkingReq: 3
  },
  C2: {
    code: 'C2',
    name: 'General Commercial',
    description: 'Retail and office',
    allowedUses: ['commercial', 'mixed'],
    maxFAR: 2.5,
    maxHeight: 24,
    maxCoverage: 80,
    minLotSize: 300,
    setbacks: { front: 0, side: 0, rear: 3 },
    parkingReq: 4
  },
  C3: {
    code: 'C3',
    name: 'Central Business',
    description: 'Downtown commercial core',
    allowedUses: ['commercial', 'mixed', 'institutional'],
    maxFAR: 6.0,
    maxHeight: 60,
    maxCoverage: 100,
    minLotSize: 200,
    setbacks: { front: 0, side: 0, rear: 0 },
    parkingReq: 2
  },
  M1: {
    code: 'M1',
    name: 'Light Industrial',
    description: 'Light manufacturing and warehousing',
    allowedUses: ['industrial'],
    maxFAR: 1.0,
    maxHeight: 15,
    maxCoverage: 60,
    minLotSize: 1000,
    setbacks: { front: 6, side: 3, rear: 6 },
    parkingReq: 1
  },
  M2: {
    code: 'M2',
    name: 'Heavy Industrial',
    description: 'Heavy manufacturing',
    allowedUses: ['industrial'],
    maxFAR: 0.8,
    maxHeight: 20,
    maxCoverage: 50,
    minLotSize: 2000,
    setbacks: { front: 10, side: 5, rear: 10 },
    parkingReq: 0.5
  },
  MU: {
    code: 'MU',
    name: 'Mixed Use',
    description: 'Combined residential and commercial',
    allowedUses: ['residential', 'commercial', 'mixed'],
    maxFAR: 3.0,
    maxHeight: 30,
    maxCoverage: 70,
    minLotSize: 300,
    setbacks: { front: 0, side: 0, rear: 3 },
    parkingReq: 2
  },
  OS: {
    code: 'OS',
    name: 'Open Space',
    description: 'Parks and recreation',
    allowedUses: ['park'],
    maxFAR: 0.1,
    maxHeight: 6,
    maxCoverage: 10,
    minLotSize: 100,
    setbacks: { front: 0, side: 0, rear: 0 },
    parkingReq: 0.1
  },
  I: {
    code: 'I',
    name: 'Institutional',
    description: 'Schools, hospitals, government',
    allowedUses: ['institutional'],
    maxFAR: 2.0,
    maxHeight: 24,
    maxCoverage: 50,
    minLotSize: 500,
    setbacks: { front: 6, side: 3, rear: 6 },
    parkingReq: 3
  }
};

// =============================================================================
// WALKABILITY CALCULATION
// =============================================================================

interface WalkabilityInputs {
  amenities_count: number;      // within 400m
  intersection_density: number;  // per sq km
  sidewalk_coverage: number;     // percentage
  crosswalk_count: number;
  land_use_mix: number;         // entropy 0-1
  block_length_avg: number;     // meters
  transit_stops: number;
}

function calculateWalkability(inputs: WalkabilityInputs): WalkabilityScore {
  // Amenities score (more = better, diminishing returns)
  const amenitiesScore = Math.min(100, 20 * Math.log2(inputs.amenities_count + 1));

  // Intersection density (100-150 ideal for walkability)
  const intersectionScore = Math.min(100, inputs.intersection_density * 0.8);

  // Pedestrian infrastructure
  const pedestrianScore = (
    inputs.sidewalk_coverage * 0.6 +
    Math.min(100, inputs.crosswalk_count * 5) * 0.4
  );

  // Land use mix (higher entropy = more mixed)
  const landUseMixScore = inputs.land_use_mix * 100;

  // Block length penalty (smaller blocks better)
  const blockPenalty = Math.max(0, (inputs.block_length_avg - 100) / 10);

  // Calculate overall score
  const overall = Math.round(
    (amenitiesScore * 0.35 +
      intersectionScore * 0.20 +
      pedestrianScore * 0.25 +
      landUseMixScore * 0.20) - blockPenalty
  );

  // Equivalent Walk Score description
  let equivalent = 'Walker\'s Paradise';
  if (overall < 90) equivalent = 'Very Walkable';
  if (overall < 70) equivalent = 'Somewhat Walkable';
  if (overall < 50) equivalent = 'Car-Dependent';
  if (overall < 25) equivalent = 'Almost All Errands Require Car';

  return {
    overall: Math.max(0, Math.min(100, overall)),
    categories: {
      amenities: Math.round(amenitiesScore),
      intersection_density: Math.round(intersectionScore),
      pedestrian_infrastructure: Math.round(pedestrianScore),
      land_use_mix: Math.round(landUseMixScore)
    },
    walkscore_equivalent: equivalent
  };
}

// =============================================================================
// TRANSIT SCORE CALCULATION
// =============================================================================

interface TransitInputs {
  bus_stops_400m: number;
  rail_stations_800m: number;
  bus_frequency_min: number;    // average minutes between buses
  rail_frequency_min: number;
  service_hours: number;        // hours per day
  routes_count: number;
}

function calculateTransitScore(inputs: TransitInputs): TransitScore {
  // Coverage based on stops
  const busCoverage = Math.min(50, inputs.bus_stops_400m * 10);
  const railCoverage = Math.min(50, inputs.rail_stations_800m * 25);
  const coverage = busCoverage + railCoverage;

  // Frequency score (lower wait time = better)
  const busFreqScore = inputs.bus_frequency_min > 0 ? Math.max(0, 50 - inputs.bus_frequency_min * 2.5) : 0;
  const railFreqScore = inputs.rail_frequency_min > 0 ? Math.max(0, 50 - inputs.rail_frequency_min) : 0;
  const frequency = busFreqScore + railFreqScore;

  // Capacity based on routes
  const capacity = Math.min(100, inputs.routes_count * 10);

  // Service hours bonus
  const serviceBonus = Math.min(20, (inputs.service_hours - 12) * 2);

  const overall = Math.round(
    coverage * 0.35 +
    frequency * 0.35 +
    capacity * 0.20 +
    serviceBonus
  );

  let accessibility = 'Excellent Transit';
  if (overall < 90) accessibility = 'Excellent Transit';
  if (overall < 70) accessibility = 'Good Transit';
  if (overall < 50) accessibility = 'Some Transit';
  if (overall < 25) accessibility = 'Minimal Transit';

  return {
    overall: Math.max(0, Math.min(100, overall)),
    coverage: Math.round(coverage),
    frequency: Math.round(frequency),
    capacity: Math.round(capacity),
    accessibility
  };
}

// =============================================================================
// DENSITY ANALYSIS
// =============================================================================

interface DensityInputs {
  area_sqkm: number;
  population: number;
  dwelling_units: number;
  jobs: number;
  total_floor_area: number;  // sqm
}

function analyzeDensity(inputs: DensityInputs): DensityAnalysis {
  const areaHectares = inputs.area_sqkm * 100;

  const popDensity = inputs.population / inputs.area_sqkm;
  const dwellingDensity = inputs.dwelling_units / areaHectares;
  const employmentDensity = inputs.jobs / areaHectares;

  // Average FAR
  const totalLandArea = inputs.area_sqkm * 1000000;
  const farAvg = inputs.total_floor_area / totalLandArea;

  // Classification
  let classification = 'Suburban';
  if (popDensity > 10000) classification = 'Urban High Density';
  else if (popDensity > 5000) classification = 'Urban Medium Density';
  else if (popDensity > 2000) classification = 'Urban Low Density';
  else if (popDensity > 500) classification = 'Suburban';
  else classification = 'Rural/Exurban';

  return {
    population_density: Math.round(popDensity),
    dwelling_density: Math.round(dwellingDensity * 10) / 10,
    employment_density: Math.round(employmentDensity * 10) / 10,
    far_average: Math.round(farAvg * 100) / 100,
    classification
  };
}

// =============================================================================
// ZONING COMPLIANCE CHECK
// =============================================================================

interface ComplianceResult {
  compliant: boolean;
  issues: string[];
  recommendations: string[];
}

function checkZoningCompliance(parcel: Parcel, proposed: {
  use: LandUse;
  height: number;
  far: number;
  coverage: number;
}): ComplianceResult {
  const zone = ZONE_DEFINITIONS[parcel.currentZone];
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Use compliance
  if (!zone.allowedUses.includes(proposed.use)) {
    issues.push(`Use '${proposed.use}' not permitted in ${zone.code} zone`);
    recommendations.push(`Consider rezoning to ${zone.allowedUses.includes('mixed') ? 'MU' : 'appropriate zone'}`);
  }

  // Height compliance
  if (proposed.height > zone.maxHeight) {
    issues.push(`Height ${proposed.height}m exceeds max ${zone.maxHeight}m`);
    recommendations.push(`Reduce height or apply for variance`);
  }

  // FAR compliance
  if (proposed.far > zone.maxFAR) {
    issues.push(`FAR ${proposed.far} exceeds max ${zone.maxFAR}`);
    recommendations.push(`Reduce floor area or seek density bonus`);
  }

  // Coverage compliance
  if (proposed.coverage > zone.maxCoverage) {
    issues.push(`Lot coverage ${proposed.coverage}% exceeds max ${zone.maxCoverage}%`);
    recommendations.push(`Reduce building footprint`);
  }

  // Lot size compliance
  if (parcel.area < zone.minLotSize) {
    issues.push(`Lot size ${parcel.area}sqm below minimum ${zone.minLotSize}sqm`);
    recommendations.push(`Consider lot consolidation`);
  }

  return {
    compliant: issues.length === 0,
    issues,
    recommendations
  };
}

// =============================================================================
// PLANNING RECOMMENDATIONS
// =============================================================================

function generateRecommendations(
  walkability: WalkabilityScore,
  transit: TransitScore,
  density: DensityAnalysis
): PlanningRecommendation[] {
  const recommendations: PlanningRecommendation[] = [];

  // Walkability recommendations
  if (walkability.categories.amenities < 50) {
    recommendations.push({
      category: 'Walkability',
      priority: 'high',
      recommendation: 'Increase neighborhood amenities and services',
      impact: 'Improved daily walkability and reduced car dependence',
      implementation: 'Incentivize mixed-use development, allow home occupations'
    });
  }

  if (walkability.categories.pedestrian_infrastructure < 50) {
    recommendations.push({
      category: 'Pedestrian Infrastructure',
      priority: 'high',
      recommendation: 'Improve sidewalk network and crossings',
      impact: 'Safer walking conditions, increased pedestrian activity',
      implementation: 'Complete sidewalk gaps, add pedestrian signals at major intersections'
    });
  }

  if (walkability.categories.land_use_mix < 50) {
    recommendations.push({
      category: 'Land Use',
      priority: 'medium',
      recommendation: 'Promote mixed-use development',
      impact: 'Reduced travel distances, vibrant neighborhoods',
      implementation: 'Rezone key corridors to mixed-use, allow accessory commercial uses'
    });
  }

  // Transit recommendations
  if (transit.overall < 50) {
    recommendations.push({
      category: 'Transit',
      priority: 'high',
      recommendation: 'Improve transit service coverage and frequency',
      impact: 'Reduced car dependence, better accessibility',
      implementation: 'Coordinate with transit agency on route optimization'
    });
  }

  // Density recommendations
  if (density.population_density < 2000 && transit.overall > 30) {
    recommendations.push({
      category: 'Density',
      priority: 'medium',
      recommendation: 'Increase residential density near transit',
      impact: 'Better transit ridership, efficient land use',
      implementation: 'Upzone areas within 800m of transit stations'
    });
  }

  if (density.far_average < 0.5 && density.classification !== 'Rural/Exurban') {
    recommendations.push({
      category: 'Intensity',
      priority: 'low',
      recommendation: 'Consider increasing allowed building intensity',
      impact: 'More efficient land use, housing supply',
      implementation: 'Review FAR limits and consider increases in appropriate areas'
    });
  }

  return recommendations;
}

// =============================================================================
// EXAMPLE DATA
// =============================================================================

const exampleNeighborhoods: Record<string, {
  walkability: WalkabilityInputs;
  transit: TransitInputs;
  density: DensityInputs;
}> = {
  downtown: {
    walkability: {
      amenities_count: 150,
      intersection_density: 140,
      sidewalk_coverage: 95,
      crosswalk_count: 20,
      land_use_mix: 0.85,
      block_length_avg: 80,
      transit_stops: 12
    },
    transit: {
      bus_stops_400m: 8,
      rail_stations_800m: 2,
      bus_frequency_min: 8,
      rail_frequency_min: 5,
      service_hours: 20,
      routes_count: 15
    },
    density: {
      area_sqkm: 1.0,
      population: 12000,
      dwelling_units: 5500,
      jobs: 25000,
      total_floor_area: 2500000
    }
  },
  suburban_residential: {
    walkability: {
      amenities_count: 8,
      intersection_density: 30,
      sidewalk_coverage: 40,
      crosswalk_count: 2,
      land_use_mix: 0.15,
      block_length_avg: 300,
      transit_stops: 1
    },
    transit: {
      bus_stops_400m: 1,
      rail_stations_800m: 0,
      bus_frequency_min: 30,
      rail_frequency_min: 0,
      service_hours: 14,
      routes_count: 1
    },
    density: {
      area_sqkm: 2.0,
      population: 3000,
      dwelling_units: 1000,
      jobs: 200,
      total_floor_area: 180000
    }
  },
  mixed_use_corridor: {
    walkability: {
      amenities_count: 45,
      intersection_density: 80,
      sidewalk_coverage: 75,
      crosswalk_count: 10,
      land_use_mix: 0.65,
      block_length_avg: 120,
      transit_stops: 5
    },
    transit: {
      bus_stops_400m: 4,
      rail_stations_800m: 1,
      bus_frequency_min: 12,
      rail_frequency_min: 10,
      service_hours: 18,
      routes_count: 6
    },
    density: {
      area_sqkm: 0.8,
      population: 4500,
      dwelling_units: 1800,
      jobs: 3500,
      total_floor_area: 720000
    }
  },
  industrial: {
    walkability: {
      amenities_count: 3,
      intersection_density: 25,
      sidewalk_coverage: 20,
      crosswalk_count: 1,
      land_use_mix: 0.1,
      block_length_avg: 400,
      transit_stops: 1
    },
    transit: {
      bus_stops_400m: 1,
      rail_stations_800m: 0,
      bus_frequency_min: 45,
      rail_frequency_min: 0,
      service_hours: 12,
      routes_count: 1
    },
    density: {
      area_sqkm: 3.0,
      population: 200,
      dwelling_units: 0,
      jobs: 4500,
      total_floor_area: 900000
    }
  }
};

// =============================================================================
// TOOL DEFINITION
// =============================================================================

export const urbanplanningTool: UnifiedTool = {
  name: 'urban_planning',
  description: 'Urban planning analysis including zoning compliance, walkability scoring, transit accessibility, density analysis, and land use recommendations.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['zoning', 'walkability', 'transit', 'density', 'compliance', 'recommend', 'analyze', 'examples', 'info'],
        description: 'Operation: zoning info, walkability score, transit score, density analysis, compliance check, recommendations, full analysis, examples, or info'
      },
      zone: {
        type: 'string',
        description: 'Zone code: R1, R2, R3, R4, C1, C2, C3, M1, M2, MU, OS, I'
      },
      neighborhood: {
        type: 'string',
        description: 'Named neighborhood: downtown, suburban_residential, mixed_use_corridor, industrial'
      },
      walkability_inputs: {
        type: 'object',
        description: 'Walkability calculation inputs'
      },
      transit_inputs: {
        type: 'object',
        description: 'Transit score inputs'
      },
      density_inputs: {
        type: 'object',
        description: 'Density analysis inputs'
      },
      parcel: {
        type: 'object',
        description: 'Parcel information for compliance check'
      },
      proposed: {
        type: 'object',
        description: 'Proposed development for compliance check'
      }
    },
    required: ['operation']
  }
};

// =============================================================================
// TOOL EXECUTOR
// =============================================================================

export async function executeurbanplanning(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const {
      operation, zone, neighborhood, walkability_inputs, transit_inputs,
      density_inputs, parcel, proposed
    } = args;

    // Info operation
    if (operation === 'info') {
      const info = {
        tool: 'urban-planning',
        description: 'Comprehensive urban planning analysis',
        zones: Object.entries(ZONE_DEFINITIONS).map(([code, z]) => ({
          code,
          name: z.name,
          description: z.description
        })),
        scoring: {
          walkability: {
            range: '0-100',
            categories: ['amenities', 'intersection_density', 'pedestrian_infrastructure', 'land_use_mix'],
            methodology: 'Based on Walk Score methodology'
          },
          transit: {
            range: '0-100',
            factors: ['coverage', 'frequency', 'capacity', 'service_hours'],
            methodology: 'Based on Transit Score methodology'
          }
        },
        density_classifications: [
          'Rural/Exurban (< 500 per sq km)',
          'Suburban (500-2000)',
          'Urban Low (2000-5000)',
          'Urban Medium (5000-10000)',
          'Urban High (> 10000)'
        ],
        example_neighborhoods: Object.keys(exampleNeighborhoods)
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    // Examples operation
    if (operation === 'examples') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          neighborhoods: Object.keys(exampleNeighborhoods),
          zones: Object.keys(ZONE_DEFINITIONS),
          sample_analysis: 'Use operation: analyze with neighborhood: downtown'
        }, null, 2)
      };
    }

    // Zoning operation
    if (operation === 'zoning') {
      if (zone && ZONE_DEFINITIONS[zone as ZoneType]) {
        const z = ZONE_DEFINITIONS[zone as ZoneType];
        return {
          toolCallId: id,
          content: JSON.stringify({
            zone: z,
            development_potential: {
              example_lot_1000sqm: {
                max_floor_area: 1000 * z.maxFAR,
                max_building_footprint: 1000 * z.maxCoverage / 100,
                max_floors_estimate: Math.floor(z.maxHeight / 3.5),
                parking_required: (1000 * z.maxFAR / 1000) * z.parkingReq
              }
            }
          }, null, 2)
        };
      }

      return {
        toolCallId: id,
        content: JSON.stringify({
          zones: Object.entries(ZONE_DEFINITIONS).map(([code, z]) => ({
            code,
            name: z.name,
            maxFAR: z.maxFAR,
            maxHeight: z.maxHeight,
            uses: z.allowedUses
          }))
        }, null, 2)
      };
    }

    // Get neighborhood data
    const neighborhoodData = neighborhood && exampleNeighborhoods[neighborhood]
      ? exampleNeighborhoods[neighborhood]
      : null;

    // Walkability operation
    if (operation === 'walkability') {
      const inputs = walkability_inputs || neighborhoodData?.walkability;
      if (!inputs) {
        return {
          toolCallId: id,
          content: 'Error: walkability_inputs or neighborhood required',
          isError: true
        };
      }

      const score = calculateWalkability(inputs);
      return { toolCallId: id, content: JSON.stringify({ walkability: score, inputs }, null, 2) };
    }

    // Transit operation
    if (operation === 'transit') {
      const inputs = transit_inputs || neighborhoodData?.transit;
      if (!inputs) {
        return {
          toolCallId: id,
          content: 'Error: transit_inputs or neighborhood required',
          isError: true
        };
      }

      const score = calculateTransitScore(inputs);
      return { toolCallId: id, content: JSON.stringify({ transit: score, inputs }, null, 2) };
    }

    // Density operation
    if (operation === 'density') {
      const inputs = density_inputs || neighborhoodData?.density;
      if (!inputs) {
        return {
          toolCallId: id,
          content: 'Error: density_inputs or neighborhood required',
          isError: true
        };
      }

      const analysis = analyzeDensity(inputs);
      return { toolCallId: id, content: JSON.stringify({ density: analysis, inputs }, null, 2) };
    }

    // Compliance operation
    if (operation === 'compliance') {
      if (!parcel || !proposed) {
        return {
          toolCallId: id,
          content: 'Error: parcel and proposed required for compliance check',
          isError: true
        };
      }

      const compliance = checkZoningCompliance(parcel, proposed);
      const zoneInfo = ZONE_DEFINITIONS[parcel.currentZone as ZoneType];

      return {
        toolCallId: id,
        content: JSON.stringify({
          parcel,
          proposed,
          zone_requirements: zoneInfo,
          compliance
        }, null, 2)
      };
    }

    // Recommend operation
    if (operation === 'recommend') {
      const data = neighborhoodData || {
        walkability: walkability_inputs,
        transit: transit_inputs,
        density: density_inputs
      };

      if (!data.walkability || !data.transit || !data.density) {
        return {
          toolCallId: id,
          content: 'Error: All inputs (walkability, transit, density) required for recommendations',
          isError: true
        };
      }

      const walkScore = calculateWalkability(data.walkability);
      const transitScore = calculateTransitScore(data.transit);
      const densityAnalysis = analyzeDensity(data.density);
      const recommendations = generateRecommendations(walkScore, transitScore, densityAnalysis);

      return {
        toolCallId: id,
        content: JSON.stringify({
          current_scores: {
            walkability: walkScore.overall,
            transit: transitScore.overall,
            density_classification: densityAnalysis.classification
          },
          recommendations
        }, null, 2)
      };
    }

    // Analyze operation (default)
    if (!neighborhoodData && (!walkability_inputs || !transit_inputs || !density_inputs)) {
      return {
        toolCallId: id,
        content: 'Error: Provide neighborhood name or all inputs (walkability, transit, density)',
        isError: true
      };
    }

    const data = neighborhoodData || {
      walkability: walkability_inputs,
      transit: transit_inputs,
      density: density_inputs
    };

    const walkScore = calculateWalkability(data.walkability);
    const transitScore = calculateTransitScore(data.transit);
    const densityAnalysis = analyzeDensity(data.density);
    const recommendations = generateRecommendations(walkScore, transitScore, densityAnalysis);

    return {
      toolCallId: id,
      content: JSON.stringify({
        neighborhood: neighborhood || 'custom',
        analysis: {
          walkability: walkScore,
          transit: transitScore,
          density: densityAnalysis
        },
        overall_assessment: {
          walkability_rating: walkScore.walkscore_equivalent,
          transit_rating: transitScore.accessibility,
          density_type: densityAnalysis.classification,
          combined_score: Math.round((walkScore.overall + transitScore.overall) / 2)
        },
        recommendations: recommendations.filter(r => r.priority === 'high').slice(0, 3)
      }, null, 2)
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isurbanplanningAvailable(): boolean {
  return true;
}
