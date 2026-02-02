/**
 * LATTICE-BOLTZMANN TOOL
 * Full Lattice Boltzmann Method (LBM) for computational fluid dynamics
 *
 * Implements D2Q9 model for 2D fluid simulation with:
 * - BGK collision operator
 * - Zou-He boundary conditions
 * - Multiple flow configurations (channel, cavity, obstacle)
 * - Velocity and density field analysis
 * - Reynolds number based flow characterization
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// D2Q9 lattice velocities (cx, cy)
const D2Q9_VELOCITIES: [number, number][] = [
  [0, 0],   // 0: rest
  [1, 0],   // 1: east
  [0, 1],   // 2: north
  [-1, 0],  // 3: west
  [0, -1],  // 4: south
  [1, 1],   // 5: northeast
  [-1, 1],  // 6: northwest
  [-1, -1], // 7: southwest
  [1, -1]   // 8: southeast
];

// D2Q9 weights
const D2Q9_WEIGHTS: number[] = [
  4/9,   // 0: rest
  1/9,   // 1: east
  1/9,   // 2: north
  1/9,   // 3: west
  1/9,   // 4: south
  1/36,  // 5: northeast
  1/36,  // 6: northwest
  1/36,  // 7: southwest
  1/36   // 8: southeast
];

// Opposite directions for bounce-back
const D2Q9_OPPOSITE: number[] = [0, 3, 4, 1, 2, 7, 8, 5, 6];

// Lattice speed of sound squared (cs^2 = 1/3)
const CS_SQUARED = 1/3;

interface LatticeGrid {
  nx: number;
  ny: number;
  f: number[][][];      // Distribution functions [x][y][direction]
  ftemp: number[][][];  // Temporary distribution for streaming
  solid: boolean[][];   // Solid node flags
  rho: number[][];      // Density field
  ux: number[][];       // X-velocity field
  uy: number[][];       // Y-velocity field
}

interface FlowConfig {
  type: 'channel' | 'cavity' | 'cylinder' | 'step' | 'custom';
  inletVelocity?: number;
  lidVelocity?: number;
  cylinderRadius?: number;
  cylinderX?: number;
  cylinderY?: number;
  stepHeight?: number;
}

interface SimulationParams {
  nx: number;
  ny: number;
  tau: number;           // Relaxation time
  timesteps: number;
  flowConfig: FlowConfig;
  outputInterval?: number;
}

interface FlowStatistics {
  maxVelocity: number;
  avgVelocity: number;
  maxDensity: number;
  minDensity: number;
  avgDensity: number;
  kineticEnergy: number;
  enstrophy: number;
  reynoldsNumber: number;
  massConservationError: number;
}

// Initialize equilibrium distribution
function computeEquilibrium(rho: number, ux: number, uy: number): number[] {
  const feq: number[] = new Array(9);
  const uSq = ux * ux + uy * uy;

  for (let i = 0; i < 9; i++) {
    const cu = D2Q9_VELOCITIES[i][0] * ux + D2Q9_VELOCITIES[i][1] * uy;
    feq[i] = D2Q9_WEIGHTS[i] * rho * (
      1 + cu / CS_SQUARED +
      (cu * cu) / (2 * CS_SQUARED * CS_SQUARED) -
      uSq / (2 * CS_SQUARED)
    );
  }

  return feq;
}

// Compute macroscopic quantities from distribution
function computeMacroscopic(f: number[]): { rho: number; ux: number; uy: number } {
  let rho = 0;
  let ux = 0;
  let uy = 0;

  for (let i = 0; i < 9; i++) {
    rho += f[i];
    ux += D2Q9_VELOCITIES[i][0] * f[i];
    uy += D2Q9_VELOCITIES[i][1] * f[i];
  }

  if (rho > 0) {
    ux /= rho;
    uy /= rho;
  }

  return { rho, ux, uy };
}

// Create and initialize lattice grid
function createGrid(params: SimulationParams): LatticeGrid {
  const { nx, ny, flowConfig } = params;

  // Initialize arrays
  const f: number[][][] = [];
  const ftemp: number[][][] = [];
  const solid: boolean[][] = [];
  const rho: number[][] = [];
  const ux: number[][] = [];
  const uy: number[][] = [];

  for (let x = 0; x < nx; x++) {
    f[x] = [];
    ftemp[x] = [];
    solid[x] = [];
    rho[x] = [];
    ux[x] = [];
    uy[x] = [];

    for (let y = 0; y < ny; y++) {
      solid[x][y] = false;
      rho[x][y] = 1.0;
      ux[x][y] = 0.0;
      uy[x][y] = 0.0;
      f[x][y] = computeEquilibrium(1.0, 0.0, 0.0);
      ftemp[x][y] = new Array(9).fill(0);
    }
  }

  // Set up geometry based on flow configuration
  setupGeometry(solid, nx, ny, flowConfig);

  // Initialize velocity field for specific configurations
  if (flowConfig.type === 'channel' && flowConfig.inletVelocity) {
    const u0 = flowConfig.inletVelocity;
    for (let x = 0; x < nx; x++) {
      for (let y = 0; y < ny; y++) {
        if (!solid[x][y]) {
          // Parabolic velocity profile
          const yNorm = (y - 0.5) / (ny - 1) - 0.5;
          const uProfile = u0 * (1 - 4 * yNorm * yNorm);
          ux[x][y] = uProfile;
          f[x][y] = computeEquilibrium(1.0, uProfile, 0.0);
        }
      }
    }
  } else if (flowConfig.type === 'cavity' && flowConfig.lidVelocity) {
    const uLid = flowConfig.lidVelocity;
    for (let x = 1; x < nx - 1; x++) {
      ux[x][ny - 2] = uLid;
      f[x][ny - 2] = computeEquilibrium(1.0, uLid, 0.0);
    }
  }

  return { nx, ny, f, ftemp, solid, rho, ux, uy };
}

// Set up solid geometry
function setupGeometry(solid: boolean[][], nx: number, ny: number, config: FlowConfig): void {
  switch (config.type) {
    case 'channel':
      // Top and bottom walls
      for (let x = 0; x < nx; x++) {
        solid[x][0] = true;
        solid[x][ny - 1] = true;
      }
      break;

    case 'cavity':
      // All walls except top (lid)
      for (let x = 0; x < nx; x++) {
        solid[x][0] = true;
      }
      for (let y = 0; y < ny; y++) {
        solid[0][y] = true;
        solid[nx - 1][y] = true;
      }
      break;

    case 'cylinder':
      // Channel with cylinder obstacle
      const cx = config.cylinderX ?? Math.floor(nx / 4);
      const cy = config.cylinderY ?? Math.floor(ny / 2);
      const r = config.cylinderRadius ?? Math.floor(ny / 8);

      for (let x = 0; x < nx; x++) {
        solid[x][0] = true;
        solid[x][ny - 1] = true;
        for (let y = 0; y < ny; y++) {
          const dx = x - cx;
          const dy = y - cy;
          if (dx * dx + dy * dy <= r * r) {
            solid[x][y] = true;
          }
        }
      }
      break;

    case 'step':
      // Backward-facing step
      const stepHeight = config.stepHeight ?? Math.floor(ny / 3);
      for (let x = 0; x < nx; x++) {
        solid[x][0] = true;
        solid[x][ny - 1] = true;
      }
      for (let x = 0; x < Math.floor(nx / 4); x++) {
        for (let y = 1; y <= stepHeight; y++) {
          solid[x][y] = true;
        }
      }
      break;
  }
}

// BGK collision step
function collide(grid: LatticeGrid, tau: number): void {
  const { nx, ny, f, solid, rho, ux, uy } = grid;
  const omega = 1 / tau;

  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) {
      if (!solid[x][y]) {
        // Compute macroscopic quantities
        const macro = computeMacroscopic(f[x][y]);
        rho[x][y] = macro.rho;
        ux[x][y] = macro.ux;
        uy[x][y] = macro.uy;

        // Compute equilibrium and relax
        const feq = computeEquilibrium(macro.rho, macro.ux, macro.uy);
        for (let i = 0; i < 9; i++) {
          f[x][y][i] = f[x][y][i] + omega * (feq[i] - f[x][y][i]);
        }
      }
    }
  }
}

// Streaming step with periodic or bounce-back boundaries
function stream(grid: LatticeGrid): void {
  const { nx, ny, f, ftemp, solid } = grid;

  // Copy to temporary array
  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) {
      for (let i = 0; i < 9; i++) {
        ftemp[x][y][i] = f[x][y][i];
      }
    }
  }

  // Stream
  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) {
      if (!solid[x][y]) {
        for (let i = 0; i < 9; i++) {
          const cx = D2Q9_VELOCITIES[i][0];
          const cy = D2Q9_VELOCITIES[i][1];

          // Source position
          let xSrc = x - cx;
          const ySrc = y - cy;

          // Periodic boundary in x
          if (xSrc < 0) xSrc = nx - 1;
          if (xSrc >= nx) xSrc = 0;

          // Reflect at y boundaries (already handled by solid nodes)
          if (ySrc < 0 || ySrc >= ny) continue;

          if (solid[xSrc][ySrc]) {
            // Bounce-back from solid
            f[x][y][i] = ftemp[x][y][D2Q9_OPPOSITE[i]];
          } else {
            f[x][y][i] = ftemp[xSrc][ySrc][i];
          }
        }
      }
    }
  }
}

// Apply Zou-He velocity boundary condition (inlet)
function applyZouHeInlet(grid: LatticeGrid, velocity: number): void {
  const { ny, f, rho, ux, uy, solid } = grid;
  const x = 0;

  for (let y = 1; y < ny - 1; y++) {
    if (!solid[x][y]) {
      // Parabolic velocity profile
      const yNorm = (y - 0.5) / (ny - 1) - 0.5;
      const uIn = velocity * (1 - 4 * yNorm * yNorm);

      // Zou-He velocity BC
      const rhoIn = (f[x][y][0] + f[x][y][2] + f[x][y][4] +
                    2 * (f[x][y][3] + f[x][y][6] + f[x][y][7])) / (1 - uIn);

      f[x][y][1] = f[x][y][3] + (2/3) * rhoIn * uIn;
      f[x][y][5] = f[x][y][7] + (1/6) * rhoIn * uIn -
                   0.5 * (f[x][y][2] - f[x][y][4]);
      f[x][y][8] = f[x][y][6] + (1/6) * rhoIn * uIn +
                   0.5 * (f[x][y][2] - f[x][y][4]);

      rho[x][y] = rhoIn;
      ux[x][y] = uIn;
      uy[x][y] = 0;
    }
  }
}

// Apply Zou-He pressure boundary condition (outlet)
function applyZouHeOutlet(grid: LatticeGrid): void {
  const { nx, ny, f, rho, ux, uy, solid } = grid;
  const x = nx - 1;

  for (let y = 1; y < ny - 1; y++) {
    if (!solid[x][y]) {
      // Pressure outlet (rho = 1)
      const rhoOut = 1.0;
      const uOut = -1 + (f[x][y][0] + f[x][y][2] + f[x][y][4] +
                        2 * (f[x][y][1] + f[x][y][5] + f[x][y][8])) / rhoOut;

      f[x][y][3] = f[x][y][1] - (2/3) * rhoOut * uOut;
      f[x][y][6] = f[x][y][8] - (1/6) * rhoOut * uOut +
                   0.5 * (f[x][y][2] - f[x][y][4]);
      f[x][y][7] = f[x][y][5] - (1/6) * rhoOut * uOut -
                   0.5 * (f[x][y][2] - f[x][y][4]);

      rho[x][y] = rhoOut;
      ux[x][y] = uOut;
      uy[x][y] = 0;
    }
  }
}

// Apply moving lid boundary condition for cavity flow
function applyMovingLid(grid: LatticeGrid, velocity: number): void {
  const { nx, ny, f, rho, ux, uy, solid } = grid;
  const y = ny - 2;  // One cell below the top wall

  for (let x = 1; x < nx - 1; x++) {
    if (!solid[x][y]) {
      // Zou-He moving wall BC
      const rhoLid = f[x][y][0] + f[x][y][1] + f[x][y][3] +
                     2 * (f[x][y][2] + f[x][y][5] + f[x][y][6]);

      f[x][y][4] = f[x][y][2];
      f[x][y][7] = f[x][y][5] + 0.5 * (f[x][y][1] - f[x][y][3]) -
                   0.5 * rhoLid * velocity;
      f[x][y][8] = f[x][y][6] - 0.5 * (f[x][y][1] - f[x][y][3]) +
                   0.5 * rhoLid * velocity;

      rho[x][y] = rhoLid;
      ux[x][y] = velocity;
      uy[x][y] = 0;
    }
  }
}

// Compute flow statistics
function computeStatistics(grid: LatticeGrid, params: SimulationParams): FlowStatistics {
  const { nx, ny, solid, rho, ux, uy } = grid;

  let maxVel = 0;
  let sumVel = 0;
  let maxRho = 0;
  let minRho = Infinity;
  let sumRho = 0;
  let kineticEnergy = 0;
  let enstrophy = 0;
  let totalMass = 0;
  let count = 0;

  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) {
      if (!solid[x][y]) {
        const vel = Math.sqrt(ux[x][y] * ux[x][y] + uy[x][y] * uy[x][y]);
        maxVel = Math.max(maxVel, vel);
        sumVel += vel;
        maxRho = Math.max(maxRho, rho[x][y]);
        minRho = Math.min(minRho, rho[x][y]);
        sumRho += rho[x][y];
        kineticEnergy += 0.5 * rho[x][y] * vel * vel;
        totalMass += rho[x][y];
        count++;
      }
    }
  }

  // Compute vorticity for enstrophy
  for (let x = 1; x < nx - 1; x++) {
    for (let y = 1; y < ny - 1; y++) {
      if (!solid[x][y] && !solid[x+1][y] && !solid[x-1][y] &&
          !solid[x][y+1] && !solid[x][y-1]) {
        const dvxdy = (ux[x][y+1] - ux[x][y-1]) / 2;
        const dvydx = (uy[x+1][y] - uy[x-1][y]) / 2;
        const omega = dvydx - dvxdy;
        enstrophy += 0.5 * omega * omega;
      }
    }
  }

  // Compute Reynolds number
  const nu = CS_SQUARED * (params.tau - 0.5);  // Kinematic viscosity
  const charLength = ny - 2;  // Characteristic length
  const charVelocity = params.flowConfig.inletVelocity ??
                       params.flowConfig.lidVelocity ?? maxVel;
  const reynoldsNumber = charVelocity * charLength / nu;

  // Mass conservation error
  const expectedMass = count;  // Expected mass with rho = 1
  const massError = Math.abs(totalMass - expectedMass) / expectedMass;

  return {
    maxVelocity: maxVel,
    avgVelocity: sumVel / count,
    maxDensity: maxRho,
    minDensity: minRho,
    avgDensity: sumRho / count,
    kineticEnergy,
    enstrophy,
    reynoldsNumber,
    massConservationError: massError
  };
}

// Run simulation
function runSimulation(params: SimulationParams): {
  finalStats: FlowStatistics;
  history: FlowStatistics[];
  velocityField: { ux: number[][]; uy: number[][] };
  densityField: number[][];
  convergence: boolean;
} {
  const grid = createGrid(params);
  const history: FlowStatistics[] = [];
  const outputInterval = params.outputInterval ?? Math.max(1, Math.floor(params.timesteps / 10));

  const isChannel = params.flowConfig.type === 'channel' ||
                    params.flowConfig.type === 'cylinder' ||
                    params.flowConfig.type === 'step';
  const isCavity = params.flowConfig.type === 'cavity';

  for (let t = 0; t < params.timesteps; t++) {
    // Collision
    collide(grid, params.tau);

    // Apply boundary conditions before streaming
    if (isChannel && params.flowConfig.inletVelocity) {
      applyZouHeInlet(grid, params.flowConfig.inletVelocity);
      applyZouHeOutlet(grid);
    }

    if (isCavity && params.flowConfig.lidVelocity) {
      applyMovingLid(grid, params.flowConfig.lidVelocity);
    }

    // Streaming
    stream(grid);

    // Record statistics
    if (t % outputInterval === 0 || t === params.timesteps - 1) {
      const stats = computeStatistics(grid, params);
      history.push(stats);
    }
  }

  const finalStats = computeStatistics(grid, params);

  // Check convergence (velocity change between last two recordings)
  let convergence = false;
  if (history.length >= 2) {
    const prev = history[history.length - 2];
    const curr = history[history.length - 1];
    const relChange = Math.abs(curr.avgVelocity - prev.avgVelocity) /
                      (Math.abs(prev.avgVelocity) + 1e-10);
    convergence = relChange < 1e-6;
  }

  return {
    finalStats,
    history,
    velocityField: { ux: grid.ux, uy: grid.uy },
    densityField: grid.rho,
    convergence
  };
}

// Single step simulation for interactive use
function simulationStep(
  grid: LatticeGrid,
  params: SimulationParams
): FlowStatistics {
  const isChannel = params.flowConfig.type === 'channel' ||
                    params.flowConfig.type === 'cylinder' ||
                    params.flowConfig.type === 'step';
  const isCavity = params.flowConfig.type === 'cavity';

  collide(grid, params.tau);

  if (isChannel && params.flowConfig.inletVelocity) {
    applyZouHeInlet(grid, params.flowConfig.inletVelocity);
    applyZouHeOutlet(grid);
  }

  if (isCavity && params.flowConfig.lidVelocity) {
    applyMovingLid(grid, params.flowConfig.lidVelocity);
  }

  stream(grid);

  return computeStatistics(grid, params);
}

// Analyze flow field for specific features
function analyzeFlow(grid: LatticeGrid, params: SimulationParams): {
  vortices: Array<{ x: number; y: number; strength: number; rotation: string }>;
  recirculation: { present: boolean; length: number };
  boundaryLayerThickness: number;
  dragCoefficient?: number;
  liftCoefficient?: number;
} {
  const { nx, ny, solid, ux, uy, rho } = grid;

  // Find vortices (local extrema of vorticity)
  const vortices: Array<{ x: number; y: number; strength: number; rotation: string }> = [];

  for (let x = 2; x < nx - 2; x++) {
    for (let y = 2; y < ny - 2; y++) {
      if (!solid[x][y]) {
        // Compute vorticity
        const dvxdy = (ux[x][y+1] - ux[x][y-1]) / 2;
        const dvydx = (uy[x+1][y] - uy[x-1][y]) / 2;
        const omega = dvydx - dvxdy;

        // Check if local extremum
        const omegaNeighbors = [
          (uy[x+1][y-1] - uy[x-1][y-1]) / 2 - (ux[x-1][y] - ux[x-1][y-2]) / 2,
          (uy[x+1][y+1] - uy[x-1][y+1]) / 2 - (ux[x+1][y+2] - ux[x+1][y]) / 2
        ];

        if (Math.abs(omega) > 0.01 &&
            Math.abs(omega) > Math.abs(omegaNeighbors[0]) &&
            Math.abs(omega) > Math.abs(omegaNeighbors[1])) {
          vortices.push({
            x,
            y,
            strength: omega,
            rotation: omega > 0 ? 'counterclockwise' : 'clockwise'
          });
        }
      }
    }
  }

  // Find recirculation zone (region with reversed flow)
  let recircLength = 0;
  if (params.flowConfig.type === 'step') {
    const stepX = Math.floor(nx / 4);
    const stepY = params.flowConfig.stepHeight ?? Math.floor(ny / 3);

    for (let x = stepX; x < nx; x++) {
      if (ux[x][stepY + 1] < 0) {
        recircLength = x - stepX;
      } else if (recircLength > 0) {
        break;
      }
    }
  }

  // Estimate boundary layer thickness (99% of freestream velocity)
  let boundaryLayerThickness = 0;
  if (params.flowConfig.inletVelocity) {
    const uFree = params.flowConfig.inletVelocity;
    const xProbe = Math.floor(nx / 2);

    for (let y = 1; y < ny / 2; y++) {
      if (!solid[xProbe][y] && ux[xProbe][y] > 0.99 * uFree) {
        boundaryLayerThickness = y;
        break;
      }
    }
  }

  // Compute drag and lift coefficients for cylinder
  let dragCoefficient: number | undefined;
  let liftCoefficient: number | undefined;

  if (params.flowConfig.type === 'cylinder' && params.flowConfig.cylinderRadius) {
    const cx = params.flowConfig.cylinderX ?? Math.floor(nx / 4);
    const cy = params.flowConfig.cylinderY ?? Math.floor(ny / 2);
    const r = params.flowConfig.cylinderRadius;
    const uInf = params.flowConfig.inletVelocity ?? 0.1;

    let fx = 0;
    let fy = 0;

    // Momentum exchange method
    for (let x = cx - r - 1; x <= cx + r + 1; x++) {
      for (let y = cy - r - 1; y <= cy + r + 1; y++) {
        if (x >= 0 && x < nx && y >= 0 && y < ny && solid[x][y]) {
          const dx = x - cx;
          const dy = y - cy;
          if (dx * dx + dy * dy <= (r + 1) * (r + 1)) {
            // Sum momentum exchange at boundary
            for (let i = 1; i < 9; i++) {
              const xn = x + D2Q9_VELOCITIES[i][0];
              const yn = y + D2Q9_VELOCITIES[i][1];
              if (xn >= 0 && xn < nx && yn >= 0 && yn < ny && !solid[xn][yn]) {
                fx += D2Q9_VELOCITIES[i][0] * (grid.f[xn][yn][i] + grid.f[xn][yn][D2Q9_OPPOSITE[i]]);
                fy += D2Q9_VELOCITIES[i][1] * (grid.f[xn][yn][i] + grid.f[xn][yn][D2Q9_OPPOSITE[i]]);
              }
            }
          }
        }
      }
    }

    const diameter = 2 * r;
    const dynamicPressure = 0.5 * rho[0][cy] * uInf * uInf;

    if (dynamicPressure > 0) {
      dragCoefficient = fx / (dynamicPressure * diameter);
      liftCoefficient = fy / (dynamicPressure * diameter);
    }
  }

  return {
    vortices: vortices.slice(0, 10),  // Return top 10 vortices
    recirculation: { present: recircLength > 0, length: recircLength },
    boundaryLayerThickness,
    dragCoefficient,
    liftCoefficient
  };
}

// Generate velocity magnitude visualization (ASCII)
function visualizeVelocity(grid: LatticeGrid, width: number = 60, height: number = 20): string {
  const { nx, ny, solid, ux, uy } = grid;

  // Find max velocity for normalization
  let maxVel = 0;
  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) {
      if (!solid[x][y]) {
        const vel = Math.sqrt(ux[x][y] * ux[x][y] + uy[x][y] * uy[x][y]);
        maxVel = Math.max(maxVel, vel);
      }
    }
  }

  const chars = ' ░▒▓█';
  const lines: string[] = [];

  for (let j = height - 1; j >= 0; j--) {
    let line = '';
    for (let i = 0; i < width; i++) {
      const x = Math.floor(i * nx / width);
      const y = Math.floor(j * ny / height);

      if (solid[x][y]) {
        line += '█';
      } else {
        const vel = Math.sqrt(ux[x][y] * ux[x][y] + uy[x][y] * uy[x][y]);
        const norm = maxVel > 0 ? vel / maxVel : 0;
        const charIndex = Math.min(Math.floor(norm * (chars.length - 1)), chars.length - 2);
        line += chars[charIndex];
      }
    }
    lines.push(line);
  }

  return lines.join('\n');
}

export const latticeboltzmannTool: UnifiedTool = {
  name: 'lattice_boltzmann',
  description: 'Lattice Boltzmann Method (LBM) for computational fluid dynamics simulation using D2Q9 model',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['simulate', 'step', 'analyze', 'visualize', 'info'],
        description: 'Operation to perform'
      },
      // Grid parameters
      nx: { type: 'number', description: 'Grid width (number of cells in x)' },
      ny: { type: 'number', description: 'Grid height (number of cells in y)' },

      // Physical parameters
      tau: { type: 'number', description: 'Relaxation time (controls viscosity, must be > 0.5)' },
      timesteps: { type: 'number', description: 'Number of simulation timesteps' },

      // Flow configuration
      flowType: {
        type: 'string',
        enum: ['channel', 'cavity', 'cylinder', 'step'],
        description: 'Type of flow configuration'
      },
      inletVelocity: { type: 'number', description: 'Inlet velocity for channel flows (lattice units, < 0.1 recommended)' },
      lidVelocity: { type: 'number', description: 'Lid velocity for cavity flow (lattice units)' },
      cylinderRadius: { type: 'number', description: 'Cylinder radius for cylinder flow' },
      stepHeight: { type: 'number', description: 'Step height for backward-facing step flow' },

      // Output options
      outputInterval: { type: 'number', description: 'Timesteps between output recordings' },
      includeVisualization: { type: 'boolean', description: 'Include ASCII velocity visualization' }
    },
    required: ['operation']
  }
};

export async function executelatticeboltzmann(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'lattice-boltzmann',
          description: 'Lattice Boltzmann Method for computational fluid dynamics',
          capabilities: [
            'D2Q9 lattice model for 2D incompressible flow',
            'BGK collision operator',
            'Zou-He boundary conditions',
            'Channel flow with parabolic inlet',
            'Lid-driven cavity flow',
            'Flow around cylinder',
            'Backward-facing step flow',
            'Velocity and density field computation',
            'Flow statistics (Reynolds number, energy, enstrophy)',
            'Vortex detection and analysis',
            'Drag and lift coefficient calculation'
          ],
          parameters: {
            tau: 'Relaxation time, controls kinematic viscosity ν = cs²(τ - 0.5)',
            stability: 'For stability: τ > 0.5, velocity < 0.1 (lattice units)',
            reynolds: 'Re = U × L / ν where L is characteristic length'
          },
          flowTypes: {
            channel: 'Pressure-driven or velocity-driven channel flow',
            cavity: 'Lid-driven cavity (benchmark problem)',
            cylinder: 'Flow around circular cylinder (vortex shedding)',
            step: 'Backward-facing step (flow separation)'
          },
          references: [
            'Succi, S. "The Lattice Boltzmann Equation for Fluid Dynamics and Beyond"',
            'Krüger et al. "The Lattice Boltzmann Method: Principles and Practice"'
          ]
        }, null, 2)
      };
    }

    if (operation === 'simulate') {
      // Validate and set defaults
      const nx = args.nx ?? 100;
      const ny = args.ny ?? 40;
      const tau = args.tau ?? 0.6;
      const timesteps = args.timesteps ?? 1000;
      const flowType = args.flowType ?? 'channel';

      if (tau <= 0.5) {
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: 'Relaxation time tau must be > 0.5 for stability',
            provided: tau
          }),
          isError: true
        };
      }

      const flowConfig: FlowConfig = {
        type: flowType,
        inletVelocity: args.inletVelocity ?? (flowType !== 'cavity' ? 0.05 : undefined),
        lidVelocity: args.lidVelocity ?? (flowType === 'cavity' ? 0.1 : undefined),
        cylinderRadius: args.cylinderRadius ?? Math.floor(ny / 8),
        stepHeight: args.stepHeight ?? Math.floor(ny / 3)
      };

      const params: SimulationParams = {
        nx,
        ny,
        tau,
        timesteps,
        flowConfig,
        outputInterval: args.outputInterval
      };

      const result = runSimulation(params);

      // Compute kinematic viscosity
      const nu = CS_SQUARED * (tau - 0.5);

      const response: Record<string, unknown> = {
        simulation: {
          gridSize: `${nx} × ${ny}`,
          timesteps,
          tau,
          kinematicViscosity: nu,
          flowType,
          converged: result.convergence
        },
        finalStatistics: {
          reynoldsNumber: result.finalStats.reynoldsNumber.toFixed(2),
          maxVelocity: result.finalStats.maxVelocity.toFixed(6),
          avgVelocity: result.finalStats.avgVelocity.toFixed(6),
          kineticEnergy: result.finalStats.kineticEnergy.toFixed(6),
          enstrophy: result.finalStats.enstrophy.toFixed(6),
          densityRange: `${result.finalStats.minDensity.toFixed(6)} - ${result.finalStats.maxDensity.toFixed(6)}`,
          massConservationError: (result.finalStats.massConservationError * 100).toFixed(4) + '%'
        },
        history: result.history.map((h, i) => ({
          step: i * (args.outputInterval ?? Math.floor(timesteps / 10)),
          maxVelocity: h.maxVelocity.toFixed(6),
          avgVelocity: h.avgVelocity.toFixed(6),
          reynoldsNumber: h.reynoldsNumber.toFixed(2)
        }))
      };

      if (args.includeVisualization) {
        // Create grid for visualization
        const grid = createGrid(params);
        // Run to get final state
        for (let t = 0; t < timesteps; t++) {
          simulationStep(grid, params);
        }
        response.visualization = visualizeVelocity(grid);
      }

      return { toolCallId: id, content: JSON.stringify(response, null, 2) };
    }

    if (operation === 'analyze') {
      const nx = args.nx ?? 100;
      const ny = args.ny ?? 40;
      const tau = args.tau ?? 0.6;
      const timesteps = args.timesteps ?? 2000;
      const flowType = args.flowType ?? 'cylinder';

      const flowConfig: FlowConfig = {
        type: flowType,
        inletVelocity: args.inletVelocity ?? 0.05,
        lidVelocity: args.lidVelocity,
        cylinderRadius: args.cylinderRadius ?? Math.floor(ny / 8),
        cylinderX: Math.floor(nx / 4),
        cylinderY: Math.floor(ny / 2),
        stepHeight: args.stepHeight ?? Math.floor(ny / 3)
      };

      const params: SimulationParams = { nx, ny, tau, timesteps, flowConfig };

      // Create and run simulation
      const grid = createGrid(params);
      for (let t = 0; t < timesteps; t++) {
        simulationStep(grid, params);
      }

      const analysis = analyzeFlow(grid, params);
      const stats = computeStatistics(grid, params);

      return {
        toolCallId: id,
        content: JSON.stringify({
          flowAnalysis: {
            reynoldsNumber: stats.reynoldsNumber.toFixed(2),
            flowRegime: stats.reynoldsNumber < 1 ? 'Stokes' :
                        stats.reynoldsNumber < 40 ? 'Laminar steady' :
                        stats.reynoldsNumber < 200 ? 'Laminar unsteady' :
                        stats.reynoldsNumber < 300000 ? 'Turbulent' : 'Fully turbulent',
            maxVelocity: stats.maxVelocity.toFixed(6),
            kineticEnergy: stats.kineticEnergy.toFixed(6),
            enstrophy: stats.enstrophy.toFixed(6)
          },
          vortices: analysis.vortices.map(v => ({
            position: `(${v.x}, ${v.y})`,
            strength: v.strength.toFixed(6),
            rotation: v.rotation
          })),
          recirculation: analysis.recirculation,
          boundaryLayerThickness: analysis.boundaryLayerThickness,
          aerodynamics: analysis.dragCoefficient !== undefined ? {
            dragCoefficient: analysis.dragCoefficient.toFixed(4),
            liftCoefficient: analysis.liftCoefficient?.toFixed(4)
          } : undefined,
          visualization: visualizeVelocity(grid)
        }, null, 2)
      };
    }

    if (operation === 'visualize') {
      const nx = args.nx ?? 80;
      const ny = args.ny ?? 30;
      const tau = args.tau ?? 0.6;
      const timesteps = args.timesteps ?? 500;
      const flowType = args.flowType ?? 'cylinder';

      const flowConfig: FlowConfig = {
        type: flowType,
        inletVelocity: args.inletVelocity ?? 0.08,
        lidVelocity: args.lidVelocity ?? 0.1,
        cylinderRadius: args.cylinderRadius ?? Math.floor(ny / 6),
        stepHeight: args.stepHeight
      };

      const params: SimulationParams = { nx, ny, tau, timesteps, flowConfig };
      const grid = createGrid(params);

      // Run simulation
      for (let t = 0; t < timesteps; t++) {
        simulationStep(grid, params);
      }

      const stats = computeStatistics(grid, params);

      return {
        toolCallId: id,
        content: JSON.stringify({
          parameters: {
            gridSize: `${nx} × ${ny}`,
            timesteps,
            tau,
            flowType,
            reynoldsNumber: stats.reynoldsNumber.toFixed(2)
          },
          velocityField: visualizeVelocity(grid, 70, 25),
          legend: '░ low velocity → █ high velocity, █ solid boundary'
        }, null, 2)
      };
    }

    return {
      toolCallId: id,
      content: JSON.stringify({ error: 'Unknown operation', operation }),
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function islatticeboltzmannAvailable(): boolean {
  return true;
}
