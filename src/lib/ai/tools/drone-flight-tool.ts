// ============================================================================
// DRONE FLIGHT TOOL - TIER INFINITY
// ============================================================================
// UAV/Drone flight calculations: thrust-to-weight, battery endurance,
// flight envelope, hover power, waypoint planning, and mission analysis.
// Pure TypeScript implementation - no external dependencies.
// ============================================================================

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// CONSTANTS
// ============================================================================

const G = 9.81;
const RHO_SL = 1.225;

const DRONE_CONFIGS: Record<
  string,
  {
    motors: number;
    typical_weight_kg: number;
    typical_prop_diameter_in: number;
    name: string;
  }
> = {
  micro_quad: {
    motors: 4,
    typical_weight_kg: 0.25,
    typical_prop_diameter_in: 3,
    name: 'Micro Quadcopter',
  },
  racing_quad: {
    motors: 4,
    typical_weight_kg: 0.6,
    typical_prop_diameter_in: 5,
    name: 'Racing Quadcopter',
  },
  camera_quad: {
    motors: 4,
    typical_weight_kg: 1.5,
    typical_prop_diameter_in: 9,
    name: 'Camera Quadcopter',
  },
  heavy_lift_quad: {
    motors: 4,
    typical_weight_kg: 5,
    typical_prop_diameter_in: 15,
    name: 'Heavy Lift Quad',
  },
  hexacopter: { motors: 6, typical_weight_kg: 3, typical_prop_diameter_in: 12, name: 'Hexacopter' },
  octocopter: { motors: 8, typical_weight_kg: 8, typical_prop_diameter_in: 15, name: 'Octocopter' },
  fixed_wing: { motors: 1, typical_weight_kg: 2, typical_prop_diameter_in: 10, name: 'Fixed Wing' },
};

const BATTERY_TYPES: Record<
  string,
  {
    energy_density_wh_kg: number;
    c_rating_typical: number;
    voltage_per_cell: number;
    name: string;
  }
> = {
  lipo_standard: {
    energy_density_wh_kg: 150,
    c_rating_typical: 25,
    voltage_per_cell: 3.7,
    name: 'Standard LiPo',
  },
  lipo_high_c: {
    energy_density_wh_kg: 130,
    c_rating_typical: 75,
    voltage_per_cell: 3.7,
    name: 'High-C LiPo',
  },
  lihv: { energy_density_wh_kg: 160, c_rating_typical: 25, voltage_per_cell: 3.85, name: 'LiHV' },
  li_ion: { energy_density_wh_kg: 250, c_rating_typical: 5, voltage_per_cell: 3.6, name: 'Li-Ion' },
};

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

function hoverThrust(weight_kg: number): number {
  return weight_kg * G;
}

function thrustToWeight(total_thrust: number, weight_kg: number): number {
  return total_thrust / (weight_kg * G);
}

function hoverPower(thrust_n: number, prop_area_m2: number, rho: number = RHO_SL): number {
  return thrust_n * Math.sqrt(thrust_n / (2 * rho * prop_area_m2));
}

function propDiskArea(diameter_m: number): number {
  return Math.PI * Math.pow(diameter_m / 2, 2);
}

function inchesToMeters(inches: number): number {
  return inches * 0.0254;
}

function batteryEnergy(capacity_mah: number, voltage: number): number {
  return (capacity_mah / 1000) * voltage;
}

function flightTime(battery_wh: number, power_w: number, efficiency: number = 0.8): number {
  return ((battery_wh * efficiency) / power_w) * 60;
}

function maxCurrent(capacity_mah: number, c_rating: number): number {
  return (capacity_mah / 1000) * c_rating;
}

function maxClimbRate(excess_thrust_n: number, weight_kg: number): number {
  return (excess_thrust_n / (weight_kg * G)) * 10;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const droneFlightTool: UnifiedTool = {
  name: 'drone_flight',
  description: `Drone/UAV flight planning and performance calculations.

Operations:
- hover: Calculate hover thrust and power requirements
- endurance: Battery life and flight time estimation
- performance: Overall flight envelope analysis
- waypoints: Mission planning with waypoint distances
- climb: Climb rate and ceiling calculations
- configs: List drone configurations
- batteries: List battery types`,

  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['hover', 'endurance', 'performance', 'waypoints', 'climb', 'configs', 'batteries'],
        description: 'Calculation to perform',
      },
      weight_kg: { type: 'number', description: 'Total takeoff weight (kg)' },
      num_motors: { type: 'number', description: 'Number of motors' },
      prop_diameter_in: { type: 'number', description: 'Propeller diameter (inches)' },
      motor_thrust_g: { type: 'number', description: 'Thrust per motor at full throttle (grams)' },
      battery_capacity_mah: { type: 'number', description: 'Battery capacity (mAh)' },
      battery_voltage: { type: 'number', description: 'Battery voltage (V)' },
      battery_cells: { type: 'number', description: 'Number of battery cells' },
      battery_type: { type: 'string', description: 'Battery type key' },
      c_rating: { type: 'number', description: 'Battery C rating' },
      velocity_m_s: { type: 'number', description: 'Forward velocity (m/s)' },
      cd: { type: 'number', description: 'Drag coefficient' },
      frontal_area_m2: { type: 'number', description: 'Frontal area for drag (m²)' },
      waypoints: {
        type: 'array',
        items: { type: 'object' },
        description: 'Array of waypoints [{lat: number, lon: number, alt?: number, name?: string}]',
      },
      drone_config: { type: 'string', description: 'Drone configuration key' },
    },
    required: ['operation'],
  },
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executeDroneFlight(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    let config = null;
    if (args.drone_config && DRONE_CONFIGS[args.drone_config]) {
      config = DRONE_CONFIGS[args.drone_config];
    }

    let batteryInfo = null;
    if (args.battery_type && BATTERY_TYPES[args.battery_type]) {
      batteryInfo = BATTERY_TYPES[args.battery_type];
    }

    let result: Record<string, unknown>;

    switch (operation) {
      case 'hover': {
        const weight = args.weight_kg || (config ? config.typical_weight_kg : 1);
        const numMotors = args.num_motors || (config ? config.motors : 4);
        const propDiamIn = args.prop_diameter_in || (config ? config.typical_prop_diameter_in : 10);

        const propDiamM = inchesToMeters(propDiamIn);
        const singlePropArea = propDiskArea(propDiamM);
        const totalPropArea = singlePropArea * numMotors;

        const requiredThrust = hoverThrust(weight);
        const thrustPerMotor = requiredThrust / numMotors;
        const hoverPwr = hoverPower(requiredThrust, totalPropArea);
        const electricalPower = hoverPwr / 0.8;

        result = {
          operation: 'hover',
          inputs: { weight_kg: weight, num_motors: numMotors, prop_diameter_in: propDiamIn },
          results: {
            required_thrust_n: requiredThrust,
            required_thrust_g: (requiredThrust / G) * 1000,
            thrust_per_motor_g: (thrustPerMotor / G) * 1000,
            hover_power_mechanical_w: hoverPwr,
            hover_power_electrical_w: electricalPower,
            disk_loading_n_m2: requiredThrust / totalPropArea,
            prop_area_total_m2: totalPropArea,
          },
        };
        break;
      }

      case 'endurance': {
        const weight = args.weight_kg || 1;
        const numMotors = args.num_motors || 4;
        const propDiamIn = args.prop_diameter_in || 10;
        const batteryMah = args.battery_capacity_mah || 5000;

        let voltage = args.battery_voltage;
        if (!voltage && args.battery_cells) {
          const cellV = batteryInfo ? batteryInfo.voltage_per_cell : 3.7;
          voltage = args.battery_cells * cellV;
        }
        voltage = voltage || 14.8;

        const propDiamM = inchesToMeters(propDiamIn);
        const totalPropArea = propDiskArea(propDiamM) * numMotors;
        const requiredThrust = hoverThrust(weight);
        const hoverPwr = hoverPower(requiredThrust, totalPropArea);
        const electricalPower = hoverPwr / 0.8;

        const energy = batteryEnergy(batteryMah, voltage);
        const hoverTime = flightTime(energy, electricalPower, 0.8);

        const cRating = args.c_rating || (batteryInfo ? batteryInfo.c_rating_typical : 25);
        const maxI = maxCurrent(batteryMah, cRating);
        const maxPower = maxI * voltage;

        result = {
          operation: 'endurance',
          inputs: { weight_kg: weight, battery_capacity_mah: batteryMah, battery_voltage: voltage },
          results: {
            battery_energy_wh: energy,
            hover_power_w: electricalPower,
            hover_time_min: hoverTime,
            hover_time_practical_min: hoverTime * 0.8,
            max_current_a: maxI,
            max_power_w: maxPower,
            current_at_hover_a: electricalPower / voltage,
          },
        };
        break;
      }

      case 'performance': {
        const weight = args.weight_kg || 1;
        const numMotors = args.num_motors || 4;
        const propDiamIn = args.prop_diameter_in || 10;
        const motorThrustG = args.motor_thrust_g || 500;

        const totalThrustN = (motorThrustG * numMotors * G) / 1000;
        const twr = thrustToWeight(totalThrustN, weight);

        const propDiamM = inchesToMeters(propDiamIn);
        const totalPropArea = propDiskArea(propDiamM) * numMotors;
        const requiredThrust = hoverThrust(weight);
        const hoverPwr = hoverPower(requiredThrust, totalPropArea);

        const excessThrust = totalThrustN - requiredThrust;
        const maxClimb = maxClimbRate(excessThrust, weight);

        const cd = args.cd || 1.0;
        const frontalArea = args.frontal_area_m2 || 0.01;
        const maxSpeed = Math.pow((2 * excessThrust) / (RHO_SL * cd * frontalArea), 0.5);

        result = {
          operation: 'performance',
          inputs: { weight_kg: weight, num_motors: numMotors, motor_thrust_g: motorThrustG },
          results: {
            total_thrust_n: totalThrustN,
            total_thrust_g: (totalThrustN / G) * 1000,
            thrust_to_weight_ratio: twr,
            can_hover: twr > 1.0,
            hover_throttle_percent: (1 / twr) * 100,
            excess_thrust_n: excessThrust,
            max_climb_rate_m_s: maxClimb > 0 ? maxClimb : 0,
            estimated_max_speed_m_s: maxSpeed,
            estimated_max_speed_km_h: maxSpeed * 3.6,
            hover_power_w: hoverPwr / 0.8,
            flight_rating:
              twr > 2 ? 'acrobatic' : twr > 1.5 ? 'sporty' : twr > 1.2 ? 'stable' : 'underpowered',
          },
        };
        break;
      }

      case 'waypoints': {
        const waypoints = args.waypoints;
        if (!waypoints || waypoints.length < 2) {
          throw new Error('waypoints requires at least 2 waypoints');
        }

        const velocity = args.velocity_m_s || 10;
        const legs = [];
        let totalDistance = 0;

        for (let i = 0; i < waypoints.length - 1; i++) {
          const wp1 = waypoints[i];
          const wp2 = waypoints[i + 1];

          const dist = haversineDistance(wp1.lat, wp1.lon, wp2.lat, wp2.lon);
          const bear = bearing(wp1.lat, wp1.lon, wp2.lat, wp2.lon);
          const altChange = (wp2.alt || 0) - (wp1.alt || 0);
          const slantDist = Math.sqrt(dist * dist + altChange * altChange);
          const flightTimeMin = slantDist / velocity / 60;

          legs.push({
            from: wp1.name || `WP${i + 1}`,
            to: wp2.name || `WP${i + 2}`,
            ground_distance_m: dist,
            slant_distance_m: slantDist,
            bearing_deg: bear,
            altitude_change_m: altChange,
            flight_time_min: flightTimeMin,
          });

          totalDistance += slantDist;
        }

        const totalTime = totalDistance / velocity / 60;

        result = {
          operation: 'waypoints',
          inputs: { num_waypoints: waypoints.length, velocity_m_s: velocity },
          results: {
            total_distance_m: totalDistance,
            total_distance_km: totalDistance / 1000,
            total_flight_time_min: totalTime,
            legs,
          },
        };
        break;
      }

      case 'climb': {
        const weight = args.weight_kg || 1;
        const numMotors = args.num_motors || 4;
        const motorThrustG = args.motor_thrust_g || 500;

        const totalThrustN = (motorThrustG * numMotors * G) / 1000;
        const requiredThrust = hoverThrust(weight);
        const excessThrust = totalThrustN - requiredThrust;

        const climbRate = excessThrust > 0 ? (excessThrust / (weight * G)) * 10 : 0;

        const twrSl = totalThrustN / (weight * G);
        const densityRatioAtCeiling = 1.1 / twrSl;
        const serviceCeiling =
          densityRatioAtCeiling > 0 && densityRatioAtCeiling < 1
            ? -8500 * Math.log(densityRatioAtCeiling)
            : 0;

        result = {
          operation: 'climb',
          inputs: { weight_kg: weight, num_motors: numMotors, motor_thrust_g: motorThrustG },
          results: {
            thrust_to_weight_sea_level: twrSl,
            excess_thrust_n: excessThrust,
            max_climb_rate_m_s: climbRate,
            max_climb_rate_ft_min: climbRate * 196.85,
            service_ceiling_m: Math.max(0, serviceCeiling),
            service_ceiling_ft: Math.max(0, serviceCeiling * 3.281),
          },
        };
        break;
      }

      case 'configs': {
        result = {
          operation: 'configs',
          available: Object.entries(DRONE_CONFIGS).map(([key, val]) => ({
            key,
            name: val.name,
            motors: val.motors,
            typical_weight_kg: val.typical_weight_kg,
            typical_prop_diameter_in: val.typical_prop_diameter_in,
          })),
        };
        break;
      }

      case 'batteries': {
        result = {
          operation: 'batteries',
          available: Object.entries(BATTERY_TYPES).map(([key, val]) => ({
            key,
            name: val.name,
            energy_density_wh_kg: val.energy_density_wh_kg,
            typical_c_rating: val.c_rating_typical,
            voltage_per_cell: val.voltage_per_cell,
          })),
        };
        break;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    return {
      toolCallId: id,
      content: JSON.stringify(result, null, 2),
    };
  } catch (error) {
    return {
      toolCallId: id,
      content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      isError: true,
    };
  }
}

export function isDroneFlightAvailable(): boolean {
  return true;
}
