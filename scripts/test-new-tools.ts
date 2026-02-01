/**
 * FOCUSED TEST FOR NEW TIER INFINITY/BEYOND TOOLS
 *
 * Tests the 18 newly added tools to verify they execute correctly.
 *
 * Run with: npx tsx scripts/test-new-tools.ts
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { UnifiedToolCall, UnifiedToolResult } from '../src/lib/ai/tools';

interface TestCase {
  name: string;
  args: Record<string, unknown>;
}

const NEW_TOOLS: TestCase[] = [
  // TIER INFINITY - 12 tools (using correct operation names from source)
  { name: 'rocket_propulsion', args: { operation: 'tsiolkovsky', isp: 300, m0: 10000, mf: 3000 } },
  {
    name: 'fluid_dynamics',
    args: {
      operation: 'reynolds',
      velocity: 1,
      density: 1.225,
      viscosity: 1.81e-5,
      characteristic_length: 0.1,
    },
  },
  {
    name: 'aerodynamics',
    args: { operation: 'lift_drag', cl: 1.5, cd: 0.05, velocity: 50, area: 20, density: 1.225 },
  },
  {
    name: 'drone_flight',
    args: { operation: 'hover', mass: 2, num_rotors: 4, rotor_diameter: 0.25, efficiency: 0.7 },
  },
  {
    name: 'pathfinder',
    args: {
      operation: 'dijkstra',
      nodes: ['A', 'B', 'C'],
      edges: [
        { from: 'A', to: 'B', weight: 1 },
        { from: 'B', to: 'C', weight: 2 },
      ],
      start: 'A',
      end: 'C',
    },
  },
  { name: 'circuit_sim', args: { operation: 'rc', r: 1000, c: 1e-6 } },
  {
    name: 'ballistics',
    args: { operation: 'trajectory', v0: 100, angle: 45, mass: 0.01, diameter: 0.01 },
  },
  {
    name: 'genetic_algorithm',
    args: {
      operation: 'optimize',
      fitness_function: 'sphere',
      dimensions: 2,
      population_size: 20,
      generations: 10,
    },
  },
  {
    name: 'chaos_dynamics',
    args: {
      operation: 'lorenz',
      sigma: 10,
      rho: 28,
      beta: 2.667,
      initial: [1, 1, 1],
      t_max: 1,
      dt: 0.01,
    },
  },
  {
    name: 'robotics_kinematics',
    args: { operation: 'forward', joint_angles: [0.5, 0.5], link_lengths: [1, 1] },
  },
  { name: 'optics_sim', args: { operation: 'refraction', n1: 1, n2: 1.5, angle: 30 } },
  {
    name: 'epidemiology',
    args: {
      operation: 'sir',
      population: 1000,
      infected: 1,
      recovered: 0,
      beta: 0.3,
      gamma: 0.1,
      days: 30,
    },
  },

  // TIER BEYOND - 6 tools (using correct operation names from source)
  {
    name: 'finite_element',
    args: { operation: 'axial', force: 1000, area: 0.001, length: 1, E: 200e9 },
  },
  { name: 'antenna_rf', args: { operation: 'path_loss', frequency: 2.4e9, distance: 100 } },
  { name: 'materials_science', args: { operation: 'material', name: 'steel' } },
  { name: 'seismology', args: { operation: 'magnitude_energy', magnitude: 5 } },
  {
    name: 'bioinformatics_pro',
    args: { operation: 'identity', seq1: 'ATGCGATCG', seq2: 'ATGCAATCG' },
  },
  { name: 'acoustics', args: { operation: 'wavelength', frequency: 440, temperature: 20 } },
];

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║    TIER INFINITY/BEYOND TOOL VERIFICATION (18 Tools)       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const toolsModule = await import('../src/lib/ai/tools');
  await toolsModule.getAvailableChatTools();

  let passed = 0;
  let failed = 0;
  const failures: { name: string; error: string }[] = [];

  for (const test of NEW_TOOLS) {
    const toolEntry = toolsModule.CHAT_TOOLS.find((t: any) => t.tool.name === test.name);

    if (!toolEntry) {
      console.log(`❌ ${test.name}: NOT FOUND`);
      failed++;
      failures.push({ name: test.name, error: 'Tool not found in registry' });
      continue;
    }

    try {
      const call: UnifiedToolCall = {
        id: `test-${test.name}-${Date.now()}`,
        name: test.name,
        arguments: test.args,
      };

      const result: UnifiedToolResult = await toolEntry.executor(call);

      if (result.isError) {
        const errMsg =
          typeof result.content === 'string'
            ? result.content.slice(0, 100)
            : JSON.stringify(result.content).slice(0, 100);
        console.log(`❌ ${test.name}: ${errMsg}`);
        failed++;
        failures.push({ name: test.name, error: errMsg });
      } else {
        console.log(`✅ ${test.name}: PASSED`);
        passed++;
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.log(`❌ ${test.name}: EXCEPTION - ${errMsg.slice(0, 100)}`);
      failed++;
      failures.push({ name: test.name, error: errMsg });
    }
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`  RESULTS: ${passed}/${NEW_TOOLS.length} PASSED`);
  console.log('════════════════════════════════════════════════════════════');

  if (failures.length > 0) {
    console.log('\nFailed Tools:');
    for (const f of failures) {
      console.log(`  • ${f.name}: ${f.error}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
