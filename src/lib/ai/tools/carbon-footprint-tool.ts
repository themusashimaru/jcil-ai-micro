/**
 * CARBON-FOOTPRINT TOOL
 * Comprehensive carbon footprint calculation and analysis
 *
 * Provides:
 * - Emissions calculation (GHG Protocol methodology)
 * - Carbon offset analysis and recommendations
 * - Lifecycle assessment (LCA) for products
 * - Reduction strategy planning
 * - Scope 1, 2, 3 emissions categorization
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// EMISSION FACTORS DATABASE (kg CO2e per unit)
// ============================================================================

interface EmissionFactor {
  factor: number;
  unit: string;
  category: string;
  scope: 1 | 2 | 3;
  source: string;
  uncertainty: number;
}

const EMISSION_FACTORS: Record<string, EmissionFactor> = {
  // SCOPE 1: Direct emissions from owned/controlled sources
  'natural_gas_stationary': { factor: 2.02, unit: 'kg CO2e/m³', category: 'stationary_combustion', scope: 1, source: 'EPA GHG Emission Factors', uncertainty: 0.05 },
  'gasoline': { factor: 2.31, unit: 'kg CO2e/L', category: 'mobile_combustion', scope: 1, source: 'EPA GHG Emission Factors', uncertainty: 0.03 },
  'diesel': { factor: 2.68, unit: 'kg CO2e/L', category: 'mobile_combustion', scope: 1, source: 'EPA GHG Emission Factors', uncertainty: 0.03 },
  'propane': { factor: 1.51, unit: 'kg CO2e/L', category: 'stationary_combustion', scope: 1, source: 'EPA GHG Emission Factors', uncertainty: 0.04 },
  'heating_oil': { factor: 2.52, unit: 'kg CO2e/L', category: 'stationary_combustion', scope: 1, source: 'EPA GHG Emission Factors', uncertainty: 0.04 },
  'coal': { factor: 2.42, unit: 'kg CO2e/kg', category: 'stationary_combustion', scope: 1, source: 'IPCC', uncertainty: 0.08 },
  'jet_fuel': { factor: 2.52, unit: 'kg CO2e/L', category: 'mobile_combustion', scope: 1, source: 'ICAO', uncertainty: 0.04 },
  'marine_fuel': { factor: 3.11, unit: 'kg CO2e/L', category: 'mobile_combustion', scope: 1, source: 'IMO', uncertainty: 0.05 },

  // Refrigerants (high GWP)
  'r134a': { factor: 1430, unit: 'kg CO2e/kg', category: 'fugitive', scope: 1, source: 'IPCC AR5', uncertainty: 0.15 },
  'r410a': { factor: 2088, unit: 'kg CO2e/kg', category: 'fugitive', scope: 1, source: 'IPCC AR5', uncertainty: 0.15 },
  'r22': { factor: 1810, unit: 'kg CO2e/kg', category: 'fugitive', scope: 1, source: 'IPCC AR5', uncertainty: 0.15 },

  // SCOPE 2: Indirect emissions from purchased energy
  'electricity_us_avg': { factor: 0.417, unit: 'kg CO2e/kWh', category: 'purchased_electricity', scope: 2, source: 'EPA eGRID 2023', uncertainty: 0.10 },
  'electricity_eu_avg': { factor: 0.296, unit: 'kg CO2e/kWh', category: 'purchased_electricity', scope: 2, source: 'EEA', uncertainty: 0.12 },
  'electricity_china': { factor: 0.581, unit: 'kg CO2e/kWh', category: 'purchased_electricity', scope: 2, source: 'IEA', uncertainty: 0.15 },
  'electricity_uk': { factor: 0.233, unit: 'kg CO2e/kWh', category: 'purchased_electricity', scope: 2, source: 'DEFRA', uncertainty: 0.08 },
  'electricity_germany': { factor: 0.366, unit: 'kg CO2e/kWh', category: 'purchased_electricity', scope: 2, source: 'UBA', uncertainty: 0.10 },
  'electricity_france': { factor: 0.052, unit: 'kg CO2e/kWh', category: 'purchased_electricity', scope: 2, source: 'RTE', uncertainty: 0.08 },
  'electricity_india': { factor: 0.716, unit: 'kg CO2e/kWh', category: 'purchased_electricity', scope: 2, source: 'CEA', uncertainty: 0.15 },
  'district_heating': { factor: 0.20, unit: 'kg CO2e/kWh', category: 'purchased_heat', scope: 2, source: 'Average estimate', uncertainty: 0.25 },
  'district_cooling': { factor: 0.15, unit: 'kg CO2e/kWh', category: 'purchased_cooling', scope: 2, source: 'Average estimate', uncertainty: 0.25 },

  // SCOPE 3: Other indirect emissions
  // Transportation
  'flight_domestic': { factor: 0.255, unit: 'kg CO2e/passenger-km', category: 'business_travel', scope: 3, source: 'DEFRA', uncertainty: 0.15 },
  'flight_short_haul': { factor: 0.156, unit: 'kg CO2e/passenger-km', category: 'business_travel', scope: 3, source: 'DEFRA', uncertainty: 0.15 },
  'flight_long_haul': { factor: 0.195, unit: 'kg CO2e/passenger-km', category: 'business_travel', scope: 3, source: 'DEFRA', uncertainty: 0.15 },
  'train': { factor: 0.041, unit: 'kg CO2e/passenger-km', category: 'business_travel', scope: 3, source: 'DEFRA', uncertainty: 0.20 },
  'bus': { factor: 0.089, unit: 'kg CO2e/passenger-km', category: 'business_travel', scope: 3, source: 'DEFRA', uncertainty: 0.20 },
  'car_avg': { factor: 0.171, unit: 'kg CO2e/km', category: 'commuting', scope: 3, source: 'EPA', uncertainty: 0.15 },
  'ev_car': { factor: 0.053, unit: 'kg CO2e/km', category: 'commuting', scope: 3, source: 'Calculated', uncertainty: 0.20 },
  'freight_truck': { factor: 0.065, unit: 'kg CO2e/tonne-km', category: 'upstream_transport', scope: 3, source: 'DEFRA', uncertainty: 0.20 },
  'freight_rail': { factor: 0.028, unit: 'kg CO2e/tonne-km', category: 'upstream_transport', scope: 3, source: 'DEFRA', uncertainty: 0.25 },
  'freight_ship': { factor: 0.016, unit: 'kg CO2e/tonne-km', category: 'upstream_transport', scope: 3, source: 'IMO', uncertainty: 0.25 },
  'freight_air': { factor: 1.13, unit: 'kg CO2e/tonne-km', category: 'upstream_transport', scope: 3, source: 'ICAO', uncertainty: 0.20 },

  // Materials
  'steel_primary': { factor: 1.85, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'WorldSteel', uncertainty: 0.15 },
  'steel_recycled': { factor: 0.42, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'WorldSteel', uncertainty: 0.20 },
  'aluminum_primary': { factor: 8.14, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'IAI', uncertainty: 0.15 },
  'aluminum_recycled': { factor: 0.70, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'IAI', uncertainty: 0.20 },
  'cement': { factor: 0.91, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'GCCA', uncertainty: 0.10 },
  'concrete': { factor: 0.12, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'GCCA', uncertainty: 0.15 },
  'plastic_pet': { factor: 2.73, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'PlasticsEurope', uncertainty: 0.15 },
  'plastic_hdpe': { factor: 1.93, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'PlasticsEurope', uncertainty: 0.15 },
  'plastic_pvc': { factor: 2.41, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'PlasticsEurope', uncertainty: 0.15 },
  'glass': { factor: 0.86, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'GPI', uncertainty: 0.15 },
  'paper': { factor: 0.94, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'CEPI', uncertainty: 0.20 },
  'cardboard': { factor: 0.79, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'CEPI', uncertainty: 0.20 },
  'cotton': { factor: 8.0, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'BCI', uncertainty: 0.25 },
  'polyester': { factor: 5.5, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'CFTI', uncertainty: 0.25 },
  'wood': { factor: 0.31, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'IPCC', uncertainty: 0.30 },

  // Food
  'beef': { factor: 27.0, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'Poore & Nemecek', uncertainty: 0.30 },
  'lamb': { factor: 24.0, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'Poore & Nemecek', uncertainty: 0.30 },
  'pork': { factor: 7.6, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'Poore & Nemecek', uncertainty: 0.25 },
  'chicken': { factor: 6.9, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'Poore & Nemecek', uncertainty: 0.25 },
  'fish_farmed': { factor: 5.1, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'Poore & Nemecek', uncertainty: 0.30 },
  'eggs': { factor: 4.8, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'Poore & Nemecek', uncertainty: 0.25 },
  'dairy_milk': { factor: 3.2, unit: 'kg CO2e/L', category: 'purchased_goods', scope: 3, source: 'Poore & Nemecek', uncertainty: 0.25 },
  'cheese': { factor: 13.5, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'Poore & Nemecek', uncertainty: 0.25 },
  'rice': { factor: 4.0, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'Poore & Nemecek', uncertainty: 0.30 },
  'wheat': { factor: 1.4, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'Poore & Nemecek', uncertainty: 0.25 },
  'vegetables': { factor: 2.0, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'Poore & Nemecek', uncertainty: 0.35 },
  'fruits': { factor: 1.1, unit: 'kg CO2e/kg', category: 'purchased_goods', scope: 3, source: 'Poore & Nemecek', uncertainty: 0.35 },

  // Waste
  'waste_landfill': { factor: 0.58, unit: 'kg CO2e/kg', category: 'waste', scope: 3, source: 'EPA', uncertainty: 0.30 },
  'waste_incineration': { factor: 0.99, unit: 'kg CO2e/kg', category: 'waste', scope: 3, source: 'EPA', uncertainty: 0.25 },
  'waste_recycling': { factor: 0.02, unit: 'kg CO2e/kg', category: 'waste', scope: 3, source: 'EPA', uncertainty: 0.40 },
  'waste_composting': { factor: 0.03, unit: 'kg CO2e/kg', category: 'waste', scope: 3, source: 'EPA', uncertainty: 0.35 },
  'wastewater': { factor: 0.29, unit: 'kg CO2e/m³', category: 'waste', scope: 3, source: 'IPCC', uncertainty: 0.35 },

  // Water
  'water_supply': { factor: 0.34, unit: 'kg CO2e/m³', category: 'purchased_goods', scope: 3, source: 'Water UK', uncertainty: 0.25 },
};

// ============================================================================
// CARBON OFFSET TYPES
// ============================================================================

interface OffsetProject {
  type: string;
  name: string;
  costPerTonne: number;
  permanence: 'high' | 'medium' | 'low';
  additionality: 'high' | 'medium' | 'low';
  cobenefits: string[];
  certifications: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

const OFFSET_PROJECTS: OffsetProject[] = [
  {
    type: 'direct_air_capture',
    name: 'Direct Air Capture with Storage',
    costPerTonne: 600,
    permanence: 'high',
    additionality: 'high',
    cobenefits: ['Scalable', 'Verifiable'],
    certifications: ['Puro.earth', 'ISCC'],
    riskLevel: 'low'
  },
  {
    type: 'enhanced_weathering',
    name: 'Enhanced Rock Weathering',
    costPerTonne: 150,
    permanence: 'high',
    additionality: 'high',
    cobenefits: ['Soil improvement', 'Ocean alkalinity'],
    certifications: ['Puro.earth'],
    riskLevel: 'medium'
  },
  {
    type: 'biochar',
    name: 'Biochar Carbon Sequestration',
    costPerTonne: 120,
    permanence: 'high',
    additionality: 'high',
    cobenefits: ['Soil health', 'Waste reduction'],
    certifications: ['Puro.earth', 'Verra'],
    riskLevel: 'low'
  },
  {
    type: 'reforestation',
    name: 'Reforestation/Afforestation',
    costPerTonne: 15,
    permanence: 'medium',
    additionality: 'medium',
    cobenefits: ['Biodiversity', 'Water quality', 'Local jobs'],
    certifications: ['Verra VCS', 'Gold Standard', 'ACR'],
    riskLevel: 'medium'
  },
  {
    type: 'avoided_deforestation',
    name: 'REDD+ Avoided Deforestation',
    costPerTonne: 12,
    permanence: 'medium',
    additionality: 'medium',
    cobenefits: ['Biodiversity', 'Indigenous rights', 'Water cycle'],
    certifications: ['Verra VCS', 'Gold Standard'],
    riskLevel: 'high'
  },
  {
    type: 'renewable_energy',
    name: 'Renewable Energy Projects',
    costPerTonne: 8,
    permanence: 'low',
    additionality: 'low',
    cobenefits: ['Clean energy access', 'Local employment'],
    certifications: ['Gold Standard', 'Verra VCS'],
    riskLevel: 'low'
  },
  {
    type: 'methane_capture',
    name: 'Landfill Methane Capture',
    costPerTonne: 10,
    permanence: 'medium',
    additionality: 'medium',
    cobenefits: ['Energy generation', 'Odor reduction'],
    certifications: ['ACR', 'Verra VCS'],
    riskLevel: 'low'
  },
  {
    type: 'blue_carbon',
    name: 'Coastal/Marine Carbon (Mangroves)',
    costPerTonne: 25,
    permanence: 'medium',
    additionality: 'high',
    cobenefits: ['Coastal protection', 'Fisheries', 'Biodiversity'],
    certifications: ['Verra VCS', 'Gold Standard'],
    riskLevel: 'medium'
  },
  {
    type: 'soil_carbon',
    name: 'Regenerative Agriculture',
    costPerTonne: 30,
    permanence: 'low',
    additionality: 'medium',
    cobenefits: ['Soil health', 'Farmer income', 'Food security'],
    certifications: ['Verra VCS', 'Gold Standard', 'Nori'],
    riskLevel: 'medium'
  },
  {
    type: 'ocean_fertilization',
    name: 'Ocean-Based Carbon Removal',
    costPerTonne: 50,
    permanence: 'medium',
    additionality: 'high',
    cobenefits: ['Marine ecosystem'],
    certifications: ['Emerging'],
    riskLevel: 'high'
  }
];

// ============================================================================
// LIFECYCLE ASSESSMENT DATA
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface LifecycleStage {
  name: string;
  percentageRange: [number, number];
  activities: string[];
}

interface ProductLifecycle {
  product: string;
  totalCO2ePerUnit: number;
  unit: string;
  stages: Record<string, number>;
  hotspots: string[];
  reductionOpportunities: string[];
}

const PRODUCT_LIFECYCLES: Record<string, ProductLifecycle> = {
  'smartphone': {
    product: 'Smartphone',
    totalCO2ePerUnit: 70,
    unit: 'kg CO2e/device',
    stages: {
      'raw_materials': 15,
      'manufacturing': 40,
      'transportation': 3,
      'use_phase': 10,
      'end_of_life': 2
    },
    hotspots: ['Display manufacturing', 'Battery production', 'Semiconductor fabrication'],
    reductionOpportunities: ['Longer device lifespan', 'Recycled materials', 'Renewable energy in manufacturing']
  },
  'laptop': {
    product: 'Laptop Computer',
    totalCO2ePerUnit: 400,
    unit: 'kg CO2e/device',
    stages: {
      'raw_materials': 80,
      'manufacturing': 180,
      'transportation': 10,
      'use_phase': 120,
      'end_of_life': 10
    },
    hotspots: ['Aluminum casing', 'Battery', 'Display', 'Motherboard'],
    reductionOpportunities: ['Energy-efficient use', 'Extended lifespan', 'Repair/refurbishment']
  },
  'car_ice': {
    product: 'Internal Combustion Engine Car',
    totalCO2ePerUnit: 60000,
    unit: 'kg CO2e/vehicle lifetime',
    stages: {
      'raw_materials': 8000,
      'manufacturing': 7000,
      'transportation': 500,
      'use_phase': 44000,
      'end_of_life': 500
    },
    hotspots: ['Fuel combustion', 'Steel production', 'Manufacturing energy'],
    reductionOpportunities: ['Fuel efficiency', 'Lightweight materials', 'Eco-driving']
  },
  'car_ev': {
    product: 'Electric Vehicle',
    totalCO2ePerUnit: 35000,
    unit: 'kg CO2e/vehicle lifetime',
    stages: {
      'raw_materials': 10000,
      'manufacturing': 12000,
      'transportation': 500,
      'use_phase': 12000,
      'end_of_life': 500
    },
    hotspots: ['Battery production', 'Electricity generation', 'Material extraction'],
    reductionOpportunities: ['Renewable electricity', 'Battery recycling', 'Extended battery life']
  },
  'tshirt_cotton': {
    product: 'Cotton T-Shirt',
    totalCO2ePerUnit: 8.5,
    unit: 'kg CO2e/garment',
    stages: {
      'raw_materials': 2.5,
      'manufacturing': 3.0,
      'transportation': 0.5,
      'use_phase': 2.0,
      'end_of_life': 0.5
    },
    hotspots: ['Cotton cultivation', 'Dyeing process', 'Washing/drying'],
    reductionOpportunities: ['Organic cotton', 'Cold washing', 'Air drying', 'Longer use']
  },
  'building_residential': {
    product: 'Residential Building (per m²)',
    totalCO2ePerUnit: 500,
    unit: 'kg CO2e/m²',
    stages: {
      'raw_materials': 200,
      'manufacturing': 50,
      'construction': 25,
      'use_phase': 200,
      'end_of_life': 25
    },
    hotspots: ['Concrete/cement', 'Steel reinforcement', 'Heating/cooling'],
    reductionOpportunities: ['Low-carbon concrete', 'Insulation', 'Heat pumps', 'Solar panels']
  },
  'plastic_bottle': {
    product: 'PET Plastic Bottle (500ml)',
    totalCO2ePerUnit: 0.082,
    unit: 'kg CO2e/bottle',
    stages: {
      'raw_materials': 0.04,
      'manufacturing': 0.02,
      'transportation': 0.015,
      'use_phase': 0.002,
      'end_of_life': 0.005
    },
    hotspots: ['PET resin production', 'Blow molding'],
    reductionOpportunities: ['Recycled PET', 'Reusable bottles', 'Lightweighting']
  }
};

// ============================================================================
// REDUCTION STRATEGIES
// ============================================================================

interface ReductionStrategy {
  sector: string;
  action: string;
  potentialReduction: string;
  implementationCost: 'low' | 'medium' | 'high';
  timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  cobenefits: string[];
}

const REDUCTION_STRATEGIES: ReductionStrategy[] = [
  // Energy
  { sector: 'energy', action: 'Switch to 100% renewable electricity', potentialReduction: '20-40%', implementationCost: 'medium', timeframe: 'short_term', cobenefits: ['Energy security', 'Cost stability'] },
  { sector: 'energy', action: 'Install LED lighting', potentialReduction: '2-5%', implementationCost: 'low', timeframe: 'immediate', cobenefits: ['Lower energy bills', 'Less maintenance'] },
  { sector: 'energy', action: 'Improve building insulation', potentialReduction: '10-20%', implementationCost: 'medium', timeframe: 'medium_term', cobenefits: ['Comfort', 'Lower bills'] },
  { sector: 'energy', action: 'Install heat pumps', potentialReduction: '15-25%', implementationCost: 'high', timeframe: 'medium_term', cobenefits: ['Efficiency', 'Cooling capability'] },
  { sector: 'energy', action: 'On-site solar PV', potentialReduction: '10-30%', implementationCost: 'high', timeframe: 'medium_term', cobenefits: ['Energy independence', 'Revenue'] },

  // Transportation
  { sector: 'transport', action: 'Electric vehicle fleet', potentialReduction: '15-25%', implementationCost: 'high', timeframe: 'medium_term', cobenefits: ['Lower fuel costs', 'Air quality'] },
  { sector: 'transport', action: 'Remote work policy', potentialReduction: '5-15%', implementationCost: 'low', timeframe: 'immediate', cobenefits: ['Employee satisfaction', 'Office cost reduction'] },
  { sector: 'transport', action: 'Optimize logistics routes', potentialReduction: '3-8%', implementationCost: 'low', timeframe: 'short_term', cobenefits: ['Cost savings', 'Time efficiency'] },
  { sector: 'transport', action: 'Shift to rail freight', potentialReduction: '5-15%', implementationCost: 'medium', timeframe: 'medium_term', cobenefits: ['Reliability', 'Scalability'] },
  { sector: 'transport', action: 'Video conferencing vs travel', potentialReduction: '2-10%', implementationCost: 'low', timeframe: 'immediate', cobenefits: ['Time savings', 'Cost savings'] },

  // Supply chain
  { sector: 'supply_chain', action: 'Supplier engagement program', potentialReduction: '10-30%', implementationCost: 'medium', timeframe: 'medium_term', cobenefits: ['Risk reduction', 'Innovation'] },
  { sector: 'supply_chain', action: 'Local sourcing', potentialReduction: '3-10%', implementationCost: 'medium', timeframe: 'short_term', cobenefits: ['Resilience', 'Community support'] },
  { sector: 'supply_chain', action: 'Circular economy practices', potentialReduction: '5-20%', implementationCost: 'medium', timeframe: 'medium_term', cobenefits: ['Resource efficiency', 'Waste reduction'] },
  { sector: 'supply_chain', action: 'Sustainable packaging', potentialReduction: '1-5%', implementationCost: 'low', timeframe: 'short_term', cobenefits: ['Brand image', 'Waste reduction'] },

  // Operations
  { sector: 'operations', action: 'Energy management system', potentialReduction: '5-15%', implementationCost: 'medium', timeframe: 'short_term', cobenefits: ['Visibility', 'Cost control'] },
  { sector: 'operations', action: 'Process optimization', potentialReduction: '5-20%', implementationCost: 'medium', timeframe: 'medium_term', cobenefits: ['Efficiency', 'Quality'] },
  { sector: 'operations', action: 'Waste reduction program', potentialReduction: '1-5%', implementationCost: 'low', timeframe: 'short_term', cobenefits: ['Cost savings', 'Compliance'] },
  { sector: 'operations', action: 'Water efficiency', potentialReduction: '0.5-2%', implementationCost: 'low', timeframe: 'short_term', cobenefits: ['Cost savings', 'Water security'] },

  // Products
  { sector: 'products', action: 'Eco-design principles', potentialReduction: '10-30%', implementationCost: 'medium', timeframe: 'medium_term', cobenefits: ['Differentiation', 'Resource efficiency'] },
  { sector: 'products', action: 'Extended product lifetime', potentialReduction: '5-20%', implementationCost: 'low', timeframe: 'short_term', cobenefits: ['Customer loyalty', 'Less waste'] },
  { sector: 'products', action: 'Product-as-a-service model', potentialReduction: '10-40%', implementationCost: 'high', timeframe: 'long_term', cobenefits: ['Recurring revenue', 'Customer relationship'] }
];

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const carbonfootprintTool: UnifiedTool = {
  name: 'carbon_footprint',
  description: 'Comprehensive carbon footprint calculation and analysis tool using GHG Protocol methodology. Supports emissions calculation (Scope 1/2/3), carbon offset analysis, lifecycle assessment (LCA), and reduction strategy planning.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['calculate', 'offset', 'lifecycle', 'reduction', 'compare', 'info', 'examples'],
        description: 'Operation: calculate emissions, analyze offsets, run lifecycle assessment, plan reductions, compare scenarios, or get info'
      },
      // For calculate operation
      emissions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            source: { type: 'string', description: 'Emission source (e.g., electricity_us_avg, gasoline, flight_long_haul)' },
            amount: { type: 'number', description: 'Quantity consumed' },
            unit: { type: 'string', description: 'Unit of measurement (optional, uses default)' }
          }
        },
        description: 'List of emission sources and quantities for calculate operation'
      },
      // For offset operation
      tonnes_to_offset: { type: 'number', description: 'Tonnes of CO2e to offset' },
      budget: { type: 'number', description: 'Budget in USD for offsets' },
      priority: {
        type: 'string',
        enum: ['cost', 'permanence', 'cobenefits', 'balanced'],
        description: 'Offset selection priority'
      },
      // For lifecycle operation
      product: { type: 'string', description: 'Product type for lifecycle assessment (e.g., smartphone, car_ev)' },
      quantity: { type: 'number', description: 'Number of units to assess' },
      // For reduction operation
      current_footprint: { type: 'number', description: 'Current annual footprint in tonnes CO2e' },
      target_reduction: { type: 'number', description: 'Target reduction percentage' },
      sectors: {
        type: 'array',
        items: { type: 'string' },
        description: 'Sectors to focus on (energy, transport, supply_chain, operations, products)'
      },
      // For compare operation
      scenarios: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            emissions: { type: 'array' }
          }
        },
        description: 'Scenarios to compare'
      }
    },
    required: ['operation']
  }
};

// ============================================================================
// EXECUTION FUNCTIONS
// ============================================================================

interface EmissionInput {
  source: string;
  amount: number;
  unit?: string;
}

interface EmissionResult {
  source: string;
  amount: number;
  unit: string;
  factor: number;
  emissions_kgCO2e: number;
  scope: number;
  category: string;
  uncertainty_kgCO2e: number;
}

function calculateEmissions(emissions: EmissionInput[]): {
  results: EmissionResult[];
  total_kgCO2e: number;
  total_tonnesCO2e: number;
  by_scope: Record<number, number>;
  by_category: Record<string, number>;
  uncertainty_range: { low: number; high: number };
} {
  const results: EmissionResult[] = [];
  let totalKg = 0;
  let totalUncertaintySq = 0;
  const byScope: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  const byCategory: Record<string, number> = {};

  for (const emission of emissions) {
    const factorData = EMISSION_FACTORS[emission.source];
    if (!factorData) {
      results.push({
        source: emission.source,
        amount: emission.amount,
        unit: 'unknown',
        factor: 0,
        emissions_kgCO2e: 0,
        scope: 3,
        category: 'unknown',
        uncertainty_kgCO2e: 0
      });
      continue;
    }

    const emissionsKg = emission.amount * factorData.factor;
    const uncertaintyKg = emissionsKg * factorData.uncertainty;

    results.push({
      source: emission.source,
      amount: emission.amount,
      unit: factorData.unit,
      factor: factorData.factor,
      emissions_kgCO2e: emissionsKg,
      scope: factorData.scope,
      category: factorData.category,
      uncertainty_kgCO2e: uncertaintyKg
    });

    totalKg += emissionsKg;
    totalUncertaintySq += uncertaintyKg * uncertaintyKg;
    byScope[factorData.scope] += emissionsKg;
    byCategory[factorData.category] = (byCategory[factorData.category] || 0) + emissionsKg;
  }

  const combinedUncertainty = Math.sqrt(totalUncertaintySq);

  return {
    results,
    total_kgCO2e: totalKg,
    total_tonnesCO2e: totalKg / 1000,
    by_scope: byScope,
    by_category: byCategory,
    uncertainty_range: {
      low: (totalKg - combinedUncertainty) / 1000,
      high: (totalKg + combinedUncertainty) / 1000
    }
  };
}

function analyzeOffsets(tonnesToOffset: number, budget?: number, priority: string = 'balanced'): {
  tonnes_to_offset: number;
  budget_usd?: number;
  recommendations: Array<{
    project: OffsetProject;
    tonnes_allocated: number;
    cost_usd: number;
    score: number;
  }>;
  total_cost: number;
  portfolio_analysis: {
    average_permanence: string;
    average_additionality: string;
    risk_profile: string;
    all_cobenefits: string[];
  };
} {
  // Score projects based on priority
  const scoredProjects = OFFSET_PROJECTS.map(project => {
    let score = 0;

    switch (priority) {
      case 'cost':
        score = 1000 / project.costPerTonne;
        break;
      case 'permanence':
        score = project.permanence === 'high' ? 100 : project.permanence === 'medium' ? 50 : 10;
        score += project.additionality === 'high' ? 50 : project.additionality === 'medium' ? 25 : 5;
        break;
      case 'cobenefits':
        score = project.cobenefits.length * 20;
        score += project.additionality === 'high' ? 30 : project.additionality === 'medium' ? 15 : 5;
        break;
      case 'balanced':
      default:
        score = 50 / Math.log10(project.costPerTonne + 1);
        score += project.permanence === 'high' ? 30 : project.permanence === 'medium' ? 15 : 5;
        score += project.additionality === 'high' ? 20 : project.additionality === 'medium' ? 10 : 3;
        score += project.cobenefits.length * 5;
        score -= project.riskLevel === 'high' ? 20 : project.riskLevel === 'medium' ? 10 : 0;
    }

    return { project, score };
  }).sort((a, b) => b.score - a.score);

  const recommendations: Array<{
    project: OffsetProject;
    tonnes_allocated: number;
    cost_usd: number;
    score: number;
  }> = [];

  let remainingTonnes = tonnesToOffset;
  let remainingBudget = budget || Infinity;
  let totalCost = 0;

  // Allocate across top projects
  for (const { project, score } of scoredProjects) {
    if (remainingTonnes <= 0) break;

    const maxByBudget = remainingBudget / project.costPerTonne;
    const allocatedTonnes = Math.min(remainingTonnes, maxByBudget, tonnesToOffset * 0.4); // Max 40% per project

    if (allocatedTonnes > 0) {
      const cost = allocatedTonnes * project.costPerTonne;
      recommendations.push({
        project,
        tonnes_allocated: allocatedTonnes,
        cost_usd: cost,
        score
      });
      remainingTonnes -= allocatedTonnes;
      remainingBudget -= cost;
      totalCost += cost;
    }
  }

  // Portfolio analysis
  const allCobenefits = new Set<string>();
  let permScore = 0, addScore = 0, riskScore = 0;

  for (const rec of recommendations) {
    rec.project.cobenefits.forEach(c => allCobenefits.add(c));
    permScore += (rec.project.permanence === 'high' ? 3 : rec.project.permanence === 'medium' ? 2 : 1) * rec.tonnes_allocated;
    addScore += (rec.project.additionality === 'high' ? 3 : rec.project.additionality === 'medium' ? 2 : 1) * rec.tonnes_allocated;
    riskScore += (rec.project.riskLevel === 'high' ? 3 : rec.project.riskLevel === 'medium' ? 2 : 1) * rec.tonnes_allocated;
  }

  const totalAllocated = recommendations.reduce((sum, r) => sum + r.tonnes_allocated, 0);
  const avgPerm = totalAllocated > 0 ? permScore / totalAllocated : 0;
  const avgAdd = totalAllocated > 0 ? addScore / totalAllocated : 0;
  const avgRisk = totalAllocated > 0 ? riskScore / totalAllocated : 0;

  return {
    tonnes_to_offset: tonnesToOffset,
    budget_usd: budget,
    recommendations,
    total_cost: totalCost,
    portfolio_analysis: {
      average_permanence: avgPerm > 2.5 ? 'high' : avgPerm > 1.5 ? 'medium' : 'low',
      average_additionality: avgAdd > 2.5 ? 'high' : avgAdd > 1.5 ? 'medium' : 'low',
      risk_profile: avgRisk > 2.5 ? 'high' : avgRisk > 1.5 ? 'medium' : 'low',
      all_cobenefits: Array.from(allCobenefits)
    }
  };
}

function assessLifecycle(product: string, quantity: number = 1): {
  product: string;
  quantity: number;
  unit_footprint: ProductLifecycle | null;
  total_kgCO2e: number;
  stages_breakdown: Record<string, number> | null;
  hotspots: string[];
  reduction_opportunities: string[];
  comparison_notes: string;
} {
  const lifecycle = PRODUCT_LIFECYCLES[product];

  if (!lifecycle) {
    const availableProducts = Object.keys(PRODUCT_LIFECYCLES);
    return {
      product,
      quantity,
      unit_footprint: null,
      total_kgCO2e: 0,
      stages_breakdown: null,
      hotspots: [],
      reduction_opportunities: [],
      comparison_notes: `Product '${product}' not found. Available: ${availableProducts.join(', ')}`
    };
  }

  const totalKg = lifecycle.totalCO2ePerUnit * quantity;
  const stagesBreakdown: Record<string, number> = {};

  for (const [stage, value] of Object.entries(lifecycle.stages)) {
    stagesBreakdown[stage] = value * quantity;
  }

  // Comparison notes
  let comparison = '';
  if (product === 'car_ev') {
    const iceLifecycle = PRODUCT_LIFECYCLES['car_ice'];
    const savings = iceLifecycle.totalCO2ePerUnit - lifecycle.totalCO2ePerUnit;
    comparison = `EV saves ${(savings / 1000).toFixed(1)} tonnes CO2e vs ICE over vehicle lifetime`;
  } else if (product === 'smartphone') {
    comparison = `Equivalent to ~${Math.round(lifecycle.totalCO2ePerUnit / 0.417)} kWh of US electricity or ${Math.round(lifecycle.totalCO2ePerUnit / 2.31)} L of gasoline`;
  }

  return {
    product,
    quantity,
    unit_footprint: lifecycle,
    total_kgCO2e: totalKg,
    stages_breakdown: stagesBreakdown,
    hotspots: lifecycle.hotspots,
    reduction_opportunities: lifecycle.reductionOpportunities,
    comparison_notes: comparison
  };
}

function planReductions(
  currentFootprint: number,
  targetReduction: number,
  sectors?: string[]
): {
  current_footprint_tonnes: number;
  target_reduction_percent: number;
  target_footprint_tonnes: number;
  reduction_needed_tonnes: number;
  strategies: Array<ReductionStrategy & {
    estimated_reduction_tonnes: { low: number; high: number };
  }>;
  pathway_summary: {
    total_potential_reduction: { low: number; high: number };
    achievable: boolean;
    timeline: string;
    priority_actions: string[];
  };
} {
  const targetFootprint = currentFootprint * (1 - targetReduction / 100);
  const reductionNeeded = currentFootprint - targetFootprint;

  const filteredStrategies = sectors && sectors.length > 0
    ? REDUCTION_STRATEGIES.filter(s => sectors.includes(s.sector))
    : REDUCTION_STRATEGIES;

  const strategies = filteredStrategies.map(strategy => {
    const [lowPct, highPct] = strategy.potentialReduction.split('-').map(s => parseFloat(s) / 100);
    return {
      ...strategy,
      estimated_reduction_tonnes: {
        low: currentFootprint * lowPct,
        high: currentFootprint * highPct
      }
    };
  });

  // Calculate total potential
  let totalLow = 0, totalHigh = 0;
  for (const s of strategies) {
    totalLow += s.estimated_reduction_tonnes.low;
    totalHigh += s.estimated_reduction_tonnes.high;
  }

  // Identify priority actions (immediate/short-term with good reduction)
  const priorityActions = strategies
    .filter(s => s.timeframe === 'immediate' || s.timeframe === 'short_term')
    .sort((a, b) => b.estimated_reduction_tonnes.high - a.estimated_reduction_tonnes.high)
    .slice(0, 5)
    .map(s => s.action);

  return {
    current_footprint_tonnes: currentFootprint,
    target_reduction_percent: targetReduction,
    target_footprint_tonnes: targetFootprint,
    reduction_needed_tonnes: reductionNeeded,
    strategies,
    pathway_summary: {
      total_potential_reduction: { low: totalLow, high: totalHigh },
      achievable: totalHigh >= reductionNeeded,
      timeline: totalLow >= reductionNeeded ? '1-3 years with aggressive action' : '3-5 years with sustained effort',
      priority_actions: priorityActions
    }
  };
}

function compareScenarios(scenarios: Array<{ name: string; emissions: EmissionInput[] }>): {
  scenarios: Array<{
    name: string;
    total_tonnesCO2e: number;
    by_scope: Record<number, number>;
  }>;
  comparison: {
    baseline: string;
    differences: Array<{
      scenario: string;
      vs_baseline_tonnes: number;
      vs_baseline_percent: number;
    }>;
    best_scenario: string;
    worst_scenario: string;
  };
} {
  const results = scenarios.map(scenario => {
    const calc = calculateEmissions(scenario.emissions);
    return {
      name: scenario.name,
      total_tonnesCO2e: calc.total_tonnesCO2e,
      by_scope: {
        1: calc.by_scope[1] / 1000,
        2: calc.by_scope[2] / 1000,
        3: calc.by_scope[3] / 1000
      }
    };
  });

  const baseline = results[0];
  const differences = results.slice(1).map(r => ({
    scenario: r.name,
    vs_baseline_tonnes: r.total_tonnesCO2e - baseline.total_tonnesCO2e,
    vs_baseline_percent: ((r.total_tonnesCO2e - baseline.total_tonnesCO2e) / baseline.total_tonnesCO2e) * 100
  }));

  const sorted = [...results].sort((a, b) => a.total_tonnesCO2e - b.total_tonnesCO2e);

  return {
    scenarios: results,
    comparison: {
      baseline: baseline.name,
      differences,
      best_scenario: sorted[0].name,
      worst_scenario: sorted[sorted.length - 1].name
    }
  };
}

function getInfo(): object {
  return {
    tool: 'carbon_footprint',
    description: 'Comprehensive carbon footprint calculation and analysis using GHG Protocol methodology',
    capabilities: [
      'Calculate emissions from various sources (Scope 1, 2, 3)',
      'Analyze and recommend carbon offset portfolios',
      'Lifecycle assessment (LCA) for common products',
      'Plan reduction strategies with cost/benefit analysis',
      'Compare emission scenarios'
    ],
    methodology: {
      framework: 'GHG Protocol Corporate Standard',
      scopes: {
        scope_1: 'Direct emissions from owned/controlled sources',
        scope_2: 'Indirect emissions from purchased energy',
        scope_3: 'All other indirect emissions in value chain'
      },
      gwp_source: 'IPCC AR5 100-year GWP values'
    },
    emission_sources_available: Object.keys(EMISSION_FACTORS).length,
    emission_categories: [...new Set(Object.values(EMISSION_FACTORS).map(f => f.category))],
    offset_project_types: OFFSET_PROJECTS.map(p => p.type),
    product_lifecycles_available: Object.keys(PRODUCT_LIFECYCLES),
    reduction_sectors: [...new Set(REDUCTION_STRATEGIES.map(s => s.sector))],
    data_sources: [
      'EPA GHG Emission Factors Hub',
      'DEFRA UK Conversion Factors',
      'IPCC Guidelines',
      'Poore & Nemecek (Science, 2018)',
      'WorldSteel, IAI, PlasticsEurope LCA data'
    ]
  };
}

function getExamples(): object {
  return {
    calculate_office_emissions: {
      operation: 'calculate',
      emissions: [
        { source: 'electricity_us_avg', amount: 50000 },
        { source: 'natural_gas_stationary', amount: 2000 },
        { source: 'gasoline', amount: 5000 },
        { source: 'flight_short_haul', amount: 10000 },
        { source: 'waste_landfill', amount: 500 }
      ]
    },
    offset_portfolio: {
      operation: 'offset',
      tonnes_to_offset: 100,
      budget: 5000,
      priority: 'balanced'
    },
    lifecycle_smartphone: {
      operation: 'lifecycle',
      product: 'smartphone',
      quantity: 1000
    },
    reduction_plan: {
      operation: 'reduction',
      current_footprint: 500,
      target_reduction: 30,
      sectors: ['energy', 'transport']
    },
    scenario_comparison: {
      operation: 'compare',
      scenarios: [
        {
          name: 'Current state',
          emissions: [
            { source: 'electricity_us_avg', amount: 100000 },
            { source: 'gasoline', amount: 10000 }
          ]
        },
        {
          name: 'Renewable + EV',
          emissions: [
            { source: 'electricity_france', amount: 100000 },
            { source: 'ev_car', amount: 50000 }
          ]
        }
      ]
    }
  };
}

// ============================================================================
// MAIN EXECUTOR
// ============================================================================

export async function executecarbonfootprint(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    let result: object;

    switch (operation) {
      case 'calculate':
        if (!args.emissions || !Array.isArray(args.emissions)) {
          throw new Error('emissions array required for calculate operation');
        }
        result = {
          operation: 'calculate',
          ...calculateEmissions(args.emissions)
        };
        break;

      case 'offset':
        if (!args.tonnes_to_offset) {
          throw new Error('tonnes_to_offset required for offset operation');
        }
        result = {
          operation: 'offset',
          ...analyzeOffsets(args.tonnes_to_offset, args.budget, args.priority)
        };
        break;

      case 'lifecycle':
        if (!args.product) {
          throw new Error('product required for lifecycle operation');
        }
        result = {
          operation: 'lifecycle',
          ...assessLifecycle(args.product, args.quantity || 1)
        };
        break;

      case 'reduction':
        if (!args.current_footprint || !args.target_reduction) {
          throw new Error('current_footprint and target_reduction required');
        }
        result = {
          operation: 'reduction',
          ...planReductions(args.current_footprint, args.target_reduction, args.sectors)
        };
        break;

      case 'compare':
        if (!args.scenarios || !Array.isArray(args.scenarios)) {
          throw new Error('scenarios array required for compare operation');
        }
        result = {
          operation: 'compare',
          ...compareScenarios(args.scenarios)
        };
        break;

      case 'examples':
        result = {
          operation: 'examples',
          examples: getExamples()
        };
        break;

      case 'info':
      default:
        result = {
          operation: 'info',
          ...getInfo()
        };
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: `Error: ${err}`, isError: true };
  }
}

export function iscarbonfootprintAvailable(): boolean {
  return true;
}
