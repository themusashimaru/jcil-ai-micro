/**
 * ROUTING-ALGORITHM TOOL
 * Network routing algorithms including OSPF, BGP, RIP, EIGRP, and IS-IS
 * with Dijkstra's algorithm, distance vector, and path vector implementations
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface RouterNode {
  id: string;
  name: string;
  area?: string;        // OSPF area
  asn?: number;         // BGP Autonomous System Number
  interfaces: NetworkInterface[];
}

interface NetworkInterface {
  name: string;
  ipAddress: string;
  subnet: string;
  cost?: number;        // OSPF cost
  bandwidth?: number;   // Bandwidth in Kbps
  delay?: number;       // Delay in microseconds
  reliability?: number; // 0-255
  load?: number;        // 0-255
  mtu?: number;
}

interface Link {
  from: string;
  to: string;
  cost: number;
  bandwidth?: number;
  delay?: number;
  adminDistance?: number;
}

interface NetworkTopology {
  routers: RouterNode[];
  links: Link[];
}

interface RoutingTableEntry {
  destination: string;
  nextHop: string;
  metric: number;
  interface?: string;
  protocol: string;
  adminDistance: number;
  age?: number;
  path?: string[];
}

interface RoutingTable {
  routerId: string;
  entries: RoutingTableEntry[];
}

interface RoutingResult {
  protocol: string;
  routingTables: RoutingTable[];
  convergenceSteps?: ConvergenceStep[];
  statistics: {
    totalRouters: number;
    totalLinks: number;
    totalRoutes: number;
    convergenceIterations: number;
  };
}

interface ConvergenceStep {
  iteration: number;
  updates: string[];
  tableSnapshots?: Record<string, RoutingTableEntry[]>;
}

interface PathResult {
  source: string;
  destination: string;
  path: string[];
  totalCost: number;
  hops: number;
  details: {
    segments: { from: string; to: string; cost: number }[];
  };
}

// =============================================================================
// ADMINISTRATIVE DISTANCES (Cisco defaults)
// =============================================================================

const ADMIN_DISTANCES: Record<string, number> = {
  connected: 0,
  static: 1,
  EIGRP_summary: 5,
  eBGP: 20,
  EIGRP_internal: 90,
  IGRP: 100,
  OSPF: 110,
  'IS-IS': 115,
  RIP: 120,
  EIGRP_external: 170,
  iBGP: 200,
  unknown: 255
};

// =============================================================================
// DIJKSTRA'S ALGORITHM (Used by OSPF and IS-IS)
// =============================================================================

function dijkstra(
  topology: NetworkTopology,
  sourceId: string
): Map<string, { distance: number; previous: string | null; path: string[] }> {
  const distances = new Map<string, number>();
  const previous = new Map<string, string | null>();
  const visited = new Set<string>();
  const unvisited = new Set<string>();

  // Initialize
  for (const router of topology.routers) {
    distances.set(router.id, router.id === sourceId ? 0 : Infinity);
    previous.set(router.id, null);
    unvisited.add(router.id);
  }

  while (unvisited.size > 0) {
    // Find minimum distance unvisited node
    let minDist = Infinity;
    let current: string | null = null;

    for (const nodeId of unvisited) {
      const dist = distances.get(nodeId) ?? Infinity;
      if (dist < minDist) {
        minDist = dist;
        current = nodeId;
      }
    }

    if (current === null || minDist === Infinity) break;

    unvisited.delete(current);
    visited.add(current);

    // Check all neighbors
    for (const link of topology.links) {
      let neighbor: string | null = null;
      const cost = link.cost;

      if (link.from === current && !visited.has(link.to)) {
        neighbor = link.to;
      } else if (link.to === current && !visited.has(link.from)) {
        neighbor = link.from;
      }

      if (neighbor) {
        const alt = (distances.get(current) ?? Infinity) + cost;
        if (alt < (distances.get(neighbor) ?? Infinity)) {
          distances.set(neighbor, alt);
          previous.set(neighbor, current);
        }
      }
    }
  }

  // Build result with paths
  const result = new Map<string, { distance: number; previous: string | null; path: string[] }>();

  for (const router of topology.routers) {
    const path: string[] = [];
    let current: string | null = router.id;

    while (current !== null) {
      path.unshift(current);
      current = previous.get(current) ?? null;
    }

    result.set(router.id, {
      distance: distances.get(router.id) ?? Infinity,
      previous: previous.get(router.id) ?? null,
      path: path[0] === sourceId ? path : []
    });
  }

  return result;
}

// =============================================================================
// OSPF ROUTING
// =============================================================================

function runOSPF(topology: NetworkTopology): RoutingResult {
  const routingTables: RoutingTable[] = [];
  const convergenceSteps: ConvergenceStep[] = [];

  convergenceSteps.push({
    iteration: 1,
    updates: ['OSPF: Building Link State Database (LSDB)']
  });

  // Each router runs Dijkstra's algorithm independently
  for (const router of topology.routers) {
    const spfResult = dijkstra(topology, router.id);
    const entries: RoutingTableEntry[] = [];

    for (const [destId, result] of spfResult) {
      if (destId !== router.id && result.distance !== Infinity) {
        const nextHop = result.path.length > 1 ? result.path[1] : destId;

        entries.push({
          destination: destId,
          nextHop,
          metric: result.distance,
          protocol: 'OSPF',
          adminDistance: ADMIN_DISTANCES.OSPF,
          path: result.path
        });
      }
    }

    routingTables.push({
      routerId: router.id,
      entries: entries.sort((a, b) => a.destination.localeCompare(b.destination))
    });
  }

  convergenceSteps.push({
    iteration: 2,
    updates: ['OSPF: SPF calculations complete for all routers']
  });

  const totalRoutes = routingTables.reduce((sum, rt) => sum + rt.entries.length, 0);

  return {
    protocol: 'OSPF',
    routingTables,
    convergenceSteps,
    statistics: {
      totalRouters: topology.routers.length,
      totalLinks: topology.links.length,
      totalRoutes,
      convergenceIterations: 2
    }
  };
}

// =============================================================================
// RIP ROUTING (Distance Vector)
// =============================================================================

function runRIP(topology: NetworkTopology, maxHops: number = 15): RoutingResult {
  const routingTables: Map<string, Map<string, RoutingTableEntry>> = new Map();
  const convergenceSteps: ConvergenceStep[] = [];

  // Initialize routing tables
  for (const router of topology.routers) {
    const table = new Map<string, RoutingTableEntry>();
    // Direct route to self
    table.set(router.id, {
      destination: router.id,
      nextHop: router.id,
      metric: 0,
      protocol: 'RIP',
      adminDistance: ADMIN_DISTANCES.RIP
    });
    routingTables.set(router.id, table);
  }

  // Build adjacency list
  const adjacency = new Map<string, { neighbor: string; cost: number }[]>();
  for (const router of topology.routers) {
    adjacency.set(router.id, []);
  }

  for (const link of topology.links) {
    const _cost = Math.min(link.cost, 1); // RIP uses hop count, so normalize to 1
    adjacency.get(link.from)?.push({ neighbor: link.to, cost: 1 });
    adjacency.get(link.to)?.push({ neighbor: link.from, cost: 1 });
  }

  // Bellman-Ford iterations
  let iteration = 0;
  let changed = true;

  while (changed && iteration < topology.routers.length) {
    changed = false;
    iteration++;
    const updates: string[] = [];

    // Each router sends its table to neighbors
    for (const router of topology.routers) {
      const myTable = routingTables.get(router.id)!;
      const neighbors = adjacency.get(router.id) ?? [];

      for (const { neighbor } of neighbors) {
        const neighborTable = routingTables.get(neighbor)!;

        // Check each route in neighbor's table
        for (const [dest, route] of neighborTable) {
          if (dest === router.id) continue; // Don't route to ourselves through others

          const newMetric = route.metric + 1;

          if (newMetric <= maxHops) {
            const existing = myTable.get(dest);

            if (!existing || newMetric < existing.metric) {
              myTable.set(dest, {
                destination: dest,
                nextHop: neighbor,
                metric: newMetric,
                protocol: 'RIP',
                adminDistance: ADMIN_DISTANCES.RIP
              });
              changed = true;
              updates.push(`${router.id}: Learned route to ${dest} via ${neighbor} (metric: ${newMetric})`);
            }
          }
        }
      }
    }

    if (updates.length > 0) {
      convergenceSteps.push({
        iteration,
        updates
      });
    }
  }

  // Convert to final format
  const finalTables: RoutingTable[] = [];
  for (const router of topology.routers) {
    const table = routingTables.get(router.id)!;
    const entries: RoutingTableEntry[] = [];

    for (const [dest, entry] of table) {
      if (dest !== router.id) {
        entries.push(entry);
      }
    }

    finalTables.push({
      routerId: router.id,
      entries: entries.sort((a, b) => a.destination.localeCompare(b.destination))
    });
  }

  const totalRoutes = finalTables.reduce((sum, rt) => sum + rt.entries.length, 0);

  return {
    protocol: 'RIP',
    routingTables: finalTables,
    convergenceSteps,
    statistics: {
      totalRouters: topology.routers.length,
      totalLinks: topology.links.length,
      totalRoutes,
      convergenceIterations: iteration
    }
  };
}

// =============================================================================
// EIGRP ROUTING (Hybrid)
// =============================================================================

function runEIGRP(topology: NetworkTopology): RoutingResult {
  const routingTables: Map<string, Map<string, RoutingTableEntry & { feasibleDistance: number; reportedDistance: number }>> = new Map();
  const convergenceSteps: ConvergenceStep[] = [];

  // EIGRP composite metric: [K1*BW + K2*BW/(256-Load) + K3*Delay] * [K5/(Reliability+K4)]
  // Default K values: K1=1, K2=0, K3=1, K4=0, K5=0
  // Simplified: Metric = (BW + Delay)

  // Initialize
  for (const router of topology.routers) {
    const table = new Map<string, RoutingTableEntry & { feasibleDistance: number; reportedDistance: number }>();
    table.set(router.id, {
      destination: router.id,
      nextHop: router.id,
      metric: 0,
      protocol: 'EIGRP',
      adminDistance: ADMIN_DISTANCES.EIGRP_internal,
      feasibleDistance: 0,
      reportedDistance: 0
    });
    routingTables.set(router.id, table);
  }

  // Build adjacency with EIGRP metrics
  const adjacency = new Map<string, { neighbor: string; metric: number }[]>();
  for (const router of topology.routers) {
    adjacency.set(router.id, []);
  }

  for (const link of topology.links) {
    // EIGRP metric based on bandwidth and delay
    const bandwidth = link.bandwidth ?? 1000000; // Default 1 Gbps
    const delay = link.delay ?? 10; // Default 10 microseconds
    const metric = Math.floor((10000000 / bandwidth) + (delay / 10)) * 256;

    adjacency.get(link.from)?.push({ neighbor: link.to, metric });
    adjacency.get(link.to)?.push({ neighbor: link.from, metric });
  }

  // DUAL algorithm iterations
  let iteration = 0;
  let changed = true;

  while (changed && iteration < topology.routers.length * 2) {
    changed = false;
    iteration++;
    const updates: string[] = [];

    for (const router of topology.routers) {
      const myTable = routingTables.get(router.id)!;
      const neighbors = adjacency.get(router.id) ?? [];

      for (const { neighbor, metric: linkMetric } of neighbors) {
        const neighborTable = routingTables.get(neighbor)!;

        for (const [dest, route] of neighborTable) {
          if (dest === router.id) continue;

          const feasibleDistance = route.feasibleDistance + linkMetric;
          const reportedDistance = route.feasibleDistance;

          const existing = myTable.get(dest);

          // Feasibility condition: RD < FD of current route
          if (!existing || feasibleDistance < existing.feasibleDistance) {
            myTable.set(dest, {
              destination: dest,
              nextHop: neighbor,
              metric: feasibleDistance,
              protocol: 'EIGRP',
              adminDistance: ADMIN_DISTANCES.EIGRP_internal,
              feasibleDistance,
              reportedDistance
            });
            changed = true;
            updates.push(`${router.id}: Route to ${dest} via ${neighbor} (FD: ${feasibleDistance}, RD: ${reportedDistance})`);
          }
        }
      }
    }

    if (updates.length > 0) {
      convergenceSteps.push({
        iteration,
        updates: updates.slice(0, 10) // Limit output
      });
    }
  }

  // Convert to final format
  const finalTables: RoutingTable[] = [];
  for (const router of topology.routers) {
    const table = routingTables.get(router.id)!;
    const entries: RoutingTableEntry[] = [];

    for (const [dest, entry] of table) {
      if (dest !== router.id) {
        entries.push({
          destination: entry.destination,
          nextHop: entry.nextHop,
          metric: entry.metric,
          protocol: entry.protocol,
          adminDistance: entry.adminDistance
        });
      }
    }

    finalTables.push({
      routerId: router.id,
      entries: entries.sort((a, b) => a.destination.localeCompare(b.destination))
    });
  }

  const totalRoutes = finalTables.reduce((sum, rt) => sum + rt.entries.length, 0);

  return {
    protocol: 'EIGRP',
    routingTables: finalTables,
    convergenceSteps,
    statistics: {
      totalRouters: topology.routers.length,
      totalLinks: topology.links.length,
      totalRoutes,
      convergenceIterations: iteration
    }
  };
}

// =============================================================================
// BGP ROUTING (Path Vector)
// =============================================================================

function runBGP(topology: NetworkTopology): RoutingResult {
  const routingTables: Map<string, Map<string, RoutingTableEntry & { asPath: number[] }>> = new Map();
  const convergenceSteps: ConvergenceStep[] = [];

  // Assign ASNs if not present
  const routerASN = new Map<string, number>();
  topology.routers.forEach((router, index) => {
    routerASN.set(router.id, router.asn ?? (65000 + index));
  });

  // Initialize
  for (const router of topology.routers) {
    const table = new Map<string, RoutingTableEntry & { asPath: number[] }>();
    const asn = routerASN.get(router.id)!;
    table.set(router.id, {
      destination: router.id,
      nextHop: router.id,
      metric: 0,
      protocol: 'BGP',
      adminDistance: ADMIN_DISTANCES.iBGP,
      asPath: [asn]
    });
    routingTables.set(router.id, table);
  }

  // Build adjacency
  const adjacency = new Map<string, string[]>();
  for (const router of topology.routers) {
    adjacency.set(router.id, []);
  }

  for (const link of topology.links) {
    adjacency.get(link.from)?.push(link.to);
    adjacency.get(link.to)?.push(link.from);
  }

  // BGP path vector iterations
  let iteration = 0;
  let changed = true;

  while (changed && iteration < topology.routers.length * 3) {
    changed = false;
    iteration++;
    const updates: string[] = [];

    for (const router of topology.routers) {
      const myTable = routingTables.get(router.id)!;
      const myASN = routerASN.get(router.id)!;
      const neighbors = adjacency.get(router.id) ?? [];

      for (const neighbor of neighbors) {
        const neighborTable = routingTables.get(neighbor)!;
        const neighborASN = routerASN.get(neighbor)!;

        for (const [dest, route] of neighborTable) {
          if (dest === router.id) continue;

          // Check for AS path loop
          if (route.asPath.includes(myASN)) continue;

          const newASPath = [myASN, ...route.asPath];
          const existing = myTable.get(dest);

          // BGP selection: shortest AS path wins
          if (!existing || newASPath.length < existing.asPath.length) {
            const isExternal = myASN !== neighborASN;
            myTable.set(dest, {
              destination: dest,
              nextHop: neighbor,
              metric: newASPath.length,
              protocol: 'BGP',
              adminDistance: isExternal ? ADMIN_DISTANCES.eBGP : ADMIN_DISTANCES.iBGP,
              asPath: newASPath
            });
            changed = true;
            updates.push(`${router.id}: Route to ${dest} via ${neighbor} (AS-Path: ${newASPath.join(' ')})`);
          }
        }
      }
    }

    if (updates.length > 0) {
      convergenceSteps.push({
        iteration,
        updates: updates.slice(0, 10)
      });
    }
  }

  // Convert to final format
  const finalTables: RoutingTable[] = [];
  for (const router of topology.routers) {
    const table = routingTables.get(router.id)!;
    const entries: RoutingTableEntry[] = [];

    for (const [dest, entry] of table) {
      if (dest !== router.id) {
        entries.push({
          destination: entry.destination,
          nextHop: entry.nextHop,
          metric: entry.metric,
          protocol: entry.protocol,
          adminDistance: entry.adminDistance,
          path: entry.asPath.map(String)
        });
      }
    }

    finalTables.push({
      routerId: router.id,
      entries: entries.sort((a, b) => a.destination.localeCompare(b.destination))
    });
  }

  const totalRoutes = finalTables.reduce((sum, rt) => sum + rt.entries.length, 0);

  return {
    protocol: 'BGP',
    routingTables: finalTables,
    convergenceSteps,
    statistics: {
      totalRouters: topology.routers.length,
      totalLinks: topology.links.length,
      totalRoutes,
      convergenceIterations: iteration
    }
  };
}

// =============================================================================
// IS-IS ROUTING (Similar to OSPF, Link State)
// =============================================================================

function runISIS(topology: NetworkTopology): RoutingResult {
  const routingTables: RoutingTable[] = [];
  const convergenceSteps: ConvergenceStep[] = [];

  convergenceSteps.push({
    iteration: 1,
    updates: ['IS-IS: Flooding LSPs (Link State PDUs)']
  });

  // IS-IS uses Dijkstra like OSPF, but with different metric calculation
  for (const router of topology.routers) {
    const spfResult = dijkstra(topology, router.id);
    const entries: RoutingTableEntry[] = [];

    for (const [destId, result] of spfResult) {
      if (destId !== router.id && result.distance !== Infinity) {
        const nextHop = result.path.length > 1 ? result.path[1] : destId;

        entries.push({
          destination: destId,
          nextHop,
          metric: result.distance * 10, // IS-IS default metric multiplier
          protocol: 'IS-IS',
          adminDistance: ADMIN_DISTANCES['IS-IS'],
          path: result.path
        });
      }
    }

    routingTables.push({
      routerId: router.id,
      entries: entries.sort((a, b) => a.destination.localeCompare(b.destination))
    });
  }

  convergenceSteps.push({
    iteration: 2,
    updates: ['IS-IS: SPF calculations complete']
  });

  const totalRoutes = routingTables.reduce((sum, rt) => sum + rt.entries.length, 0);

  return {
    protocol: 'IS-IS',
    routingTables,
    convergenceSteps,
    statistics: {
      totalRouters: topology.routers.length,
      totalLinks: topology.links.length,
      totalRoutes,
      convergenceIterations: 2
    }
  };
}

// =============================================================================
// PATH CALCULATION
// =============================================================================

function calculatePath(
  topology: NetworkTopology,
  source: string,
  destination: string
): PathResult | null {
  const spfResult = dijkstra(topology, source);
  const destInfo = spfResult.get(destination);

  if (!destInfo || destInfo.distance === Infinity) {
    return null;
  }

  const segments: { from: string; to: string; cost: number }[] = [];
  for (let i = 0; i < destInfo.path.length - 1; i++) {
    const from = destInfo.path[i];
    const to = destInfo.path[i + 1];

    // Find link cost
    const link = topology.links.find(
      l => (l.from === from && l.to === to) || (l.from === to && l.to === from)
    );
    segments.push({
      from,
      to,
      cost: link?.cost ?? 1
    });
  }

  return {
    source,
    destination,
    path: destInfo.path,
    totalCost: destInfo.distance,
    hops: destInfo.path.length - 1,
    details: { segments }
  };
}

// =============================================================================
// EXAMPLE TOPOLOGIES
// =============================================================================

const exampleTopologies: Record<string, NetworkTopology> = {
  simple: {
    routers: [
      { id: 'R1', name: 'Router1', interfaces: [] },
      { id: 'R2', name: 'Router2', interfaces: [] },
      { id: 'R3', name: 'Router3', interfaces: [] },
      { id: 'R4', name: 'Router4', interfaces: [] }
    ],
    links: [
      { from: 'R1', to: 'R2', cost: 10 },
      { from: 'R2', to: 'R3', cost: 10 },
      { from: 'R3', to: 'R4', cost: 10 },
      { from: 'R1', to: 'R4', cost: 5 }
    ]
  },
  mesh: {
    routers: [
      { id: 'A', name: 'RouterA', interfaces: [] },
      { id: 'B', name: 'RouterB', interfaces: [] },
      { id: 'C', name: 'RouterC', interfaces: [] },
      { id: 'D', name: 'RouterD', interfaces: [] },
      { id: 'E', name: 'RouterE', interfaces: [] }
    ],
    links: [
      { from: 'A', to: 'B', cost: 7 },
      { from: 'A', to: 'C', cost: 9 },
      { from: 'A', to: 'D', cost: 14 },
      { from: 'B', to: 'C', cost: 10 },
      { from: 'B', to: 'E', cost: 15 },
      { from: 'C', to: 'D', cost: 2 },
      { from: 'C', to: 'E', cost: 11 },
      { from: 'D', to: 'E', cost: 6 }
    ]
  },
  enterprise: {
    routers: [
      { id: 'CORE1', name: 'Core-1', interfaces: [] },
      { id: 'CORE2', name: 'Core-2', interfaces: [] },
      { id: 'DIST1', name: 'Distribution-1', interfaces: [] },
      { id: 'DIST2', name: 'Distribution-2', interfaces: [] },
      { id: 'ACC1', name: 'Access-1', interfaces: [] },
      { id: 'ACC2', name: 'Access-2', interfaces: [] },
      { id: 'ACC3', name: 'Access-3', interfaces: [] }
    ],
    links: [
      { from: 'CORE1', to: 'CORE2', cost: 1 },
      { from: 'CORE1', to: 'DIST1', cost: 2 },
      { from: 'CORE1', to: 'DIST2', cost: 2 },
      { from: 'CORE2', to: 'DIST1', cost: 2 },
      { from: 'CORE2', to: 'DIST2', cost: 2 },
      { from: 'DIST1', to: 'ACC1', cost: 5 },
      { from: 'DIST1', to: 'ACC2', cost: 5 },
      { from: 'DIST2', to: 'ACC2', cost: 5 },
      { from: 'DIST2', to: 'ACC3', cost: 5 }
    ]
  },
  isp: {
    routers: [
      { id: 'AS100', name: 'ISP-A', asn: 100, interfaces: [] },
      { id: 'AS200', name: 'ISP-B', asn: 200, interfaces: [] },
      { id: 'AS300', name: 'ISP-C', asn: 300, interfaces: [] },
      { id: 'AS400', name: 'ISP-D', asn: 400, interfaces: [] },
      { id: 'AS500', name: 'ISP-E', asn: 500, interfaces: [] }
    ],
    links: [
      { from: 'AS100', to: 'AS200', cost: 1 },
      { from: 'AS100', to: 'AS300', cost: 1 },
      { from: 'AS200', to: 'AS400', cost: 1 },
      { from: 'AS300', to: 'AS400', cost: 1 },
      { from: 'AS300', to: 'AS500', cost: 1 },
      { from: 'AS400', to: 'AS500', cost: 1 }
    ]
  }
};

// =============================================================================
// TOOL DEFINITION
// =============================================================================

export const routingalgorithmTool: UnifiedTool = {
  name: 'routing_algorithm',
  description: 'Network routing protocol simulation including OSPF (link-state), BGP (path vector), RIP (distance vector), EIGRP (hybrid), and IS-IS. Computes routing tables, shortest paths, and protocol convergence.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['compute', 'path', 'compare', 'converge', 'examples', 'info'],
        description: 'Operation: compute routing tables, find path, compare protocols, show convergence, examples, or info'
      },
      protocol: {
        type: 'string',
        enum: ['OSPF', 'BGP', 'RIP', 'EIGRP', 'IS-IS'],
        description: 'Routing protocol to simulate'
      },
      topology: {
        type: 'object',
        description: 'Network topology with routers and links'
      },
      topology_name: {
        type: 'string',
        description: 'Named topology: simple, mesh, enterprise, isp'
      },
      source: {
        type: 'string',
        description: 'Source router for path calculation'
      },
      destination: {
        type: 'string',
        description: 'Destination router for path calculation'
      },
      show_convergence: {
        type: 'boolean',
        description: 'Show convergence steps'
      }
    },
    required: ['operation']
  }
};

// =============================================================================
// TOOL EXECUTOR
// =============================================================================

export async function executeroutingalgorithm(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, protocol, topology: inputTopology, topology_name, source, destination, show_convergence } = args;

    // Info operation
    if (operation === 'info') {
      const info = {
        tool: 'routing-algorithm',
        description: 'Network routing protocol simulation and analysis',
        protocols: {
          OSPF: {
            type: 'Link State',
            algorithm: "Dijkstra's SPF",
            admin_distance: ADMIN_DISTANCES.OSPF,
            metric: 'Cost (based on bandwidth)',
            convergence: 'Fast',
            scalability: 'Good (with proper area design)',
            features: ['Areas', 'LSA types', 'DR/BDR election']
          },
          BGP: {
            type: 'Path Vector',
            algorithm: 'Best Path Selection',
            admin_distance: `eBGP: ${ADMIN_DISTANCES.eBGP}, iBGP: ${ADMIN_DISTANCES.iBGP}`,
            metric: 'AS-Path length + attributes',
            convergence: 'Slow (stability focused)',
            scalability: 'Excellent (Internet scale)',
            features: ['AS-Path', 'Next-hop', 'Local preference', 'MED']
          },
          RIP: {
            type: 'Distance Vector',
            algorithm: 'Bellman-Ford',
            admin_distance: ADMIN_DISTANCES.RIP,
            metric: 'Hop count (max 15)',
            convergence: 'Slow',
            scalability: 'Poor',
            features: ['Simple', 'Easy to configure']
          },
          EIGRP: {
            type: 'Hybrid (Advanced Distance Vector)',
            algorithm: 'DUAL',
            admin_distance: ADMIN_DISTANCES.EIGRP_internal,
            metric: 'Composite (BW, delay, reliability, load)',
            convergence: 'Very fast',
            scalability: 'Good',
            features: ['Feasible distance', 'Successor', 'Feasible successor']
          },
          'IS-IS': {
            type: 'Link State',
            algorithm: "Dijkstra's SPF",
            admin_distance: ADMIN_DISTANCES['IS-IS'],
            metric: 'Cost',
            convergence: 'Fast',
            scalability: 'Excellent',
            features: ['Level 1/2 hierarchy', 'TLVs']
          }
        },
        administrative_distances: ADMIN_DISTANCES,
        example_topologies: Object.keys(exampleTopologies)
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    // Examples operation
    if (operation === 'examples') {
      const examples = Object.entries(exampleTopologies).map(([name, topo]) => ({
        name,
        routers: topo.routers.length,
        links: topo.links.length,
        router_ids: topo.routers.map(r => r.id)
      }));
      return { toolCallId: id, content: JSON.stringify({ topologies: examples }, null, 2) };
    }

    // Get topology
    let topology: NetworkTopology;

    if (topology_name && exampleTopologies[topology_name]) {
      topology = exampleTopologies[topology_name];
    } else if (inputTopology) {
      topology = inputTopology;
    } else {
      topology = exampleTopologies.simple;
    }

    // Path operation
    if (operation === 'path') {
      if (!source || !destination) {
        return {
          toolCallId: id,
          content: 'Error: source and destination required for path operation',
          isError: true
        };
      }

      const pathResult = calculatePath(topology, source, destination);

      if (!pathResult) {
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: 'No path found',
            source,
            destination
          }, null, 2)
        };
      }

      return { toolCallId: id, content: JSON.stringify(pathResult, null, 2) };
    }

    // Compare operation
    if (operation === 'compare') {
      const results: Record<string, unknown> = {};

      for (const proto of ['OSPF', 'RIP', 'EIGRP', 'BGP', 'IS-IS']) {
        let result: RoutingResult;
        switch (proto) {
          case 'OSPF': result = runOSPF(topology); break;
          case 'RIP': result = runRIP(topology); break;
          case 'EIGRP': result = runEIGRP(topology); break;
          case 'BGP': result = runBGP(topology); break;
          case 'IS-IS': result = runISIS(topology); break;
          default: continue;
        }

        results[proto] = {
          convergence_iterations: result.statistics.convergenceIterations,
          total_routes: result.statistics.totalRoutes,
          admin_distance: ADMIN_DISTANCES[proto] ?? ADMIN_DISTANCES[proto.replace('-', '')]
        };
      }

      return {
        toolCallId: id,
        content: JSON.stringify({
          topology: {
            routers: topology.routers.length,
            links: topology.links.length
          },
          comparison: results
        }, null, 2)
      };
    }

    // Compute operation
    const proto = protocol || 'OSPF';
    let result: RoutingResult;

    switch (proto) {
      case 'OSPF':
        result = runOSPF(topology);
        break;
      case 'RIP':
        result = runRIP(topology);
        break;
      case 'EIGRP':
        result = runEIGRP(topology);
        break;
      case 'BGP':
        result = runBGP(topology);
        break;
      case 'IS-IS':
        result = runISIS(topology);
        break;
      default:
        result = runOSPF(topology);
    }

    const output: Record<string, unknown> = {
      protocol: result.protocol,
      statistics: result.statistics,
      routing_tables: result.routingTables
    };

    if (show_convergence && result.convergenceSteps) {
      output.convergence_steps = result.convergenceSteps;
    }

    return { toolCallId: id, content: JSON.stringify(output, null, 2) };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isroutingalgorithmAvailable(): boolean {
  return true;
}
