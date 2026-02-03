/**
 * DISK-SCHEDULER TOOL
 * Disk scheduling algorithms: FCFS, SSTF, SCAN, C-SCAN, LOOK, C-LOOK
 * Simulates disk head movement and calculates seek time
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const diskschedulerTool: UnifiedTool = {
  name: 'disk_scheduler',
  description: 'Disk scheduling algorithms - FCFS, SSTF, SCAN, C-SCAN, LOOK, C-LOOK',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['fcfs', 'sstf', 'scan', 'cscan', 'look', 'clook', 'compare', 'visualize', 'demo', 'info', 'examples'],
        description: 'Scheduling algorithm or operation'
      },
      requests: {
        type: 'array',
        items: { type: 'integer' },
        description: 'Queue of cylinder/track requests'
      },
      head_position: { type: 'integer', description: 'Initial head position (cylinder number)' },
      disk_size: { type: 'integer', description: 'Total number of cylinders (default: 200)' },
      direction: {
        type: 'string',
        enum: ['up', 'down', 'left', 'right'],
        description: 'Initial direction for SCAN/LOOK (up/right = increasing, down/left = decreasing)'
      },
      seek_time_per_cylinder: { type: 'number', description: 'Seek time per cylinder in ms (default: 1)' }
    },
    required: ['operation']
  }
};

interface ScheduleResult {
  algorithm: string;
  sequence: number[];
  movements: Array<{
    from: number;
    to: number;
    distance: number;
    cumulative: number;
  }>;
  total_seek_distance: number;
  total_seek_time: number;
  average_seek_distance: number;
  throughput: number;
}

// FCFS - First Come First Served
function fcfs(requests: number[], head: number): ScheduleResult {
  const sequence = [head, ...requests];
  const movements: ScheduleResult['movements'] = [];
  let totalDistance = 0;

  for (let i = 1; i < sequence.length; i++) {
    const distance = Math.abs(sequence[i] - sequence[i - 1]);
    totalDistance += distance;
    movements.push({
      from: sequence[i - 1],
      to: sequence[i],
      distance,
      cumulative: totalDistance
    });
  }

  return {
    algorithm: 'FCFS (First Come First Served)',
    sequence,
    movements,
    total_seek_distance: totalDistance,
    total_seek_time: totalDistance,
    average_seek_distance: totalDistance / requests.length,
    throughput: requests.length / totalDistance
  };
}

// SSTF - Shortest Seek Time First
function sstf(requests: number[], head: number): ScheduleResult {
  const remaining = [...requests];
  const sequence = [head];
  const movements: ScheduleResult['movements'] = [];
  let totalDistance = 0;
  let current = head;

  while (remaining.length > 0) {
    // Find closest request
    let minDistance = Infinity;
    let minIndex = 0;

    for (let i = 0; i < remaining.length; i++) {
      const distance = Math.abs(remaining[i] - current);
      if (distance < minDistance) {
        minDistance = distance;
        minIndex = i;
      }
    }

    const next = remaining[minIndex];
    remaining.splice(minIndex, 1);
    totalDistance += minDistance;

    movements.push({
      from: current,
      to: next,
      distance: minDistance,
      cumulative: totalDistance
    });

    sequence.push(next);
    current = next;
  }

  return {
    algorithm: 'SSTF (Shortest Seek Time First)',
    sequence,
    movements,
    total_seek_distance: totalDistance,
    total_seek_time: totalDistance,
    average_seek_distance: totalDistance / requests.length,
    throughput: requests.length / totalDistance
  };
}

// SCAN (Elevator algorithm)
function scan(requests: number[], head: number, diskSize: number, direction: string): ScheduleResult {
  const goingUp = direction === 'up' || direction === 'right';
  const sorted = [...requests].sort((a, b) => a - b);

  const lower = sorted.filter(r => r < head);
  const higher = sorted.filter(r => r >= head);

  let sequence: number[];
  if (goingUp) {
    // Go up to end, then down
    sequence = [head, ...higher, diskSize - 1, ...lower.reverse()];
  } else {
    // Go down to 0, then up
    sequence = [head, ...lower.reverse(), 0, ...higher];
  }

  // Remove duplicates if head is at 0 or diskSize-1
  sequence = sequence.filter((v, i, a) => i === 0 || v !== a[i - 1]);

  const movements: ScheduleResult['movements'] = [];
  let totalDistance = 0;

  for (let i = 1; i < sequence.length; i++) {
    const distance = Math.abs(sequence[i] - sequence[i - 1]);
    totalDistance += distance;
    movements.push({
      from: sequence[i - 1],
      to: sequence[i],
      distance,
      cumulative: totalDistance
    });
  }

  return {
    algorithm: `SCAN (Elevator) - direction: ${goingUp ? 'up' : 'down'}`,
    sequence,
    movements,
    total_seek_distance: totalDistance,
    total_seek_time: totalDistance,
    average_seek_distance: totalDistance / requests.length,
    throughput: requests.length / totalDistance
  };
}

// C-SCAN (Circular SCAN)
function cscan(requests: number[], head: number, diskSize: number, direction: string): ScheduleResult {
  const goingUp = direction === 'up' || direction === 'right';
  const sorted = [...requests].sort((a, b) => a - b);

  const lower = sorted.filter(r => r < head);
  const higher = sorted.filter(r => r >= head);

  let sequence: number[];
  if (goingUp) {
    // Go up to end, jump to 0, continue up
    sequence = [head, ...higher, diskSize - 1, 0, ...lower];
  } else {
    // Go down to 0, jump to end, continue down
    sequence = [head, ...lower.reverse(), 0, diskSize - 1, ...higher.reverse()];
  }

  // Remove duplicates
  sequence = sequence.filter((v, i, a) => i === 0 || v !== a[i - 1]);

  const movements: ScheduleResult['movements'] = [];
  let totalDistance = 0;

  for (let i = 1; i < sequence.length; i++) {
    const distance = Math.abs(sequence[i] - sequence[i - 1]);
    totalDistance += distance;
    movements.push({
      from: sequence[i - 1],
      to: sequence[i],
      distance,
      cumulative: totalDistance
    });
  }

  return {
    algorithm: `C-SCAN (Circular SCAN) - direction: ${goingUp ? 'up' : 'down'}`,
    sequence,
    movements,
    total_seek_distance: totalDistance,
    total_seek_time: totalDistance,
    average_seek_distance: totalDistance / requests.length,
    throughput: requests.length / totalDistance
  };
}

// LOOK
function look(requests: number[], head: number, direction: string): ScheduleResult {
  const goingUp = direction === 'up' || direction === 'right';
  const sorted = [...requests].sort((a, b) => a - b);

  const lower = sorted.filter(r => r < head);
  const higher = sorted.filter(r => r >= head);

  let sequence: number[];
  if (goingUp) {
    // Go up to highest request, then down to lowest
    sequence = [head, ...higher, ...lower.reverse()];
  } else {
    // Go down to lowest, then up to highest
    sequence = [head, ...lower.reverse(), ...higher];
  }

  const movements: ScheduleResult['movements'] = [];
  let totalDistance = 0;

  for (let i = 1; i < sequence.length; i++) {
    const distance = Math.abs(sequence[i] - sequence[i - 1]);
    totalDistance += distance;
    movements.push({
      from: sequence[i - 1],
      to: sequence[i],
      distance,
      cumulative: totalDistance
    });
  }

  return {
    algorithm: `LOOK - direction: ${goingUp ? 'up' : 'down'}`,
    sequence,
    movements,
    total_seek_distance: totalDistance,
    total_seek_time: totalDistance,
    average_seek_distance: totalDistance / requests.length,
    throughput: requests.length / totalDistance
  };
}

// C-LOOK (Circular LOOK)
function clook(requests: number[], head: number, direction: string): ScheduleResult {
  const goingUp = direction === 'up' || direction === 'right';
  const sorted = [...requests].sort((a, b) => a - b);

  const lower = sorted.filter(r => r < head);
  const higher = sorted.filter(r => r >= head);

  let sequence: number[];
  if (goingUp) {
    // Go up to highest, jump to lowest, continue up
    sequence = [head, ...higher, ...lower];
  } else {
    // Go down to lowest, jump to highest, continue down
    sequence = [head, ...lower.reverse(), ...higher.reverse()];
  }

  const movements: ScheduleResult['movements'] = [];
  let totalDistance = 0;

  for (let i = 1; i < sequence.length; i++) {
    const distance = Math.abs(sequence[i] - sequence[i - 1]);
    totalDistance += distance;
    movements.push({
      from: sequence[i - 1],
      to: sequence[i],
      distance,
      cumulative: totalDistance
    });
  }

  return {
    algorithm: `C-LOOK (Circular LOOK) - direction: ${goingUp ? 'up' : 'down'}`,
    sequence,
    movements,
    total_seek_distance: totalDistance,
    total_seek_time: totalDistance,
    average_seek_distance: totalDistance / requests.length,
    throughput: requests.length / totalDistance
  };
}

// Visualize head movement
function visualizeMovement(result: ScheduleResult, diskSize: number): string[] {
  const width = 60;
  const lines: string[] = [];

  lines.push(`Algorithm: ${result.algorithm}`);
  lines.push(`Disk size: 0 - ${diskSize - 1}`);
  lines.push('─'.repeat(width + 10));

  for (let i = 0; i < result.sequence.length; i++) {
    const pos = result.sequence[i];
    const normalizedPos = Math.round((pos / (diskSize - 1)) * (width - 1));
    const line = ' '.repeat(normalizedPos) + '●' + ' '.repeat(width - normalizedPos - 1);

    const label = i === 0 ? `[START] ${pos}` : `${pos} (+${result.movements[i - 1].distance})`;
    lines.push(`|${line}| ${label}`);

    if (i < result.sequence.length - 1) {
      const nextPos = result.sequence[i + 1];
      const nextNorm = Math.round((nextPos / (diskSize - 1)) * (width - 1));
      const arrowLine = ' '.repeat(width);

      // Draw arrow direction
      if (nextNorm > normalizedPos) {
        const arrowChars = arrowLine.split('');
        arrowChars[normalizedPos] = '└';
        for (let j = normalizedPos + 1; j < nextNorm; j++) {
          arrowChars[j] = '─';
        }
        arrowChars[nextNorm] = '→';
        lines.push(`|${arrowChars.join('')}|`);
      } else if (nextNorm < normalizedPos) {
        const arrowChars = arrowLine.split('');
        arrowChars[nextNorm] = '←';
        for (let j = nextNorm + 1; j < normalizedPos; j++) {
          arrowChars[j] = '─';
        }
        arrowChars[normalizedPos] = '┘';
        lines.push(`|${arrowChars.join('')}|`);
      }
    }
  }

  lines.push('─'.repeat(width + 10));
  lines.push(`Total seek distance: ${result.total_seek_distance} cylinders`);

  return lines;
}

// Compare all algorithms
function compareAlgorithms(
  requests: number[],
  head: number,
  diskSize: number,
  direction: string
): object {
  const algorithms = [
    { name: 'FCFS', fn: () => fcfs(requests, head) },
    { name: 'SSTF', fn: () => sstf(requests, head) },
    { name: 'SCAN', fn: () => scan(requests, head, diskSize, direction) },
    { name: 'C-SCAN', fn: () => cscan(requests, head, diskSize, direction) },
    { name: 'LOOK', fn: () => look(requests, head, direction) },
    { name: 'C-LOOK', fn: () => clook(requests, head, direction) }
  ];

  const results = algorithms.map(algo => {
    const result = algo.fn();
    return {
      algorithm: algo.name,
      total_seek_distance: result.total_seek_distance,
      average_seek_distance: parseFloat(result.average_seek_distance.toFixed(2)),
      throughput: parseFloat(result.throughput.toFixed(4))
    };
  });

  // Sort by total seek distance
  results.sort((a, b) => a.total_seek_distance - b.total_seek_distance);

  const best = results[0];
  const worst = results[results.length - 1];
  const improvement = ((worst.total_seek_distance - best.total_seek_distance) / worst.total_seek_distance * 100).toFixed(1);

  return {
    comparison: results,
    best_algorithm: best.algorithm,
    worst_algorithm: worst.algorithm,
    improvement: `${improvement}% reduction from worst to best`,
    ranking: results.map((r, i) => `${i + 1}. ${r.algorithm}: ${r.total_seek_distance} cylinders`)
  };
}

export async function executediskscheduler(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    // Default values
    const diskSize = args.disk_size || 200;
    const direction = args.direction || 'up';
    const seekTimePerCylinder = args.seek_time_per_cylinder || 1;

    switch (operation) {
      case 'fcfs': {
        if (!args.requests || !Array.isArray(args.requests)) {
          throw new Error('Request queue required');
        }
        const head = args.head_position ?? 50;
        const result = fcfs(args.requests, head);
        result.total_seek_time *= seekTimePerCylinder;

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'fcfs',
            description: 'First Come First Served - serve requests in arrival order',
            head_position: head,
            request_queue: args.requests,
            ...result,
            seek_time_unit: 'ms',
            characteristics: {
              fairness: 'High - FIFO order maintained',
              starvation: 'No starvation possible',
              overhead: 'None - no sorting needed',
              performance: 'Poor - no optimization'
            }
          }, null, 2)
        };
      }

      case 'sstf': {
        if (!args.requests || !Array.isArray(args.requests)) {
          throw new Error('Request queue required');
        }
        const head = args.head_position ?? 50;
        const result = sstf(args.requests, head);
        result.total_seek_time *= seekTimePerCylinder;

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'sstf',
            description: 'Shortest Seek Time First - serve closest request next',
            head_position: head,
            request_queue: args.requests,
            ...result,
            seek_time_unit: 'ms',
            characteristics: {
              fairness: 'Low - can cause starvation',
              starvation: 'Possible for distant requests',
              overhead: 'O(n) to find closest each time',
              performance: 'Good average seek time'
            },
            note: 'Similar to SJF scheduling - greedy approach'
          }, null, 2)
        };
      }

      case 'scan': {
        if (!args.requests || !Array.isArray(args.requests)) {
          throw new Error('Request queue required');
        }
        const head = args.head_position ?? 50;
        const result = scan(args.requests, head, diskSize, direction);
        result.total_seek_time *= seekTimePerCylinder;

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'scan',
            description: 'SCAN (Elevator) - move in one direction to end, then reverse',
            head_position: head,
            disk_size: diskSize,
            initial_direction: direction,
            request_queue: args.requests,
            ...result,
            seek_time_unit: 'ms',
            characteristics: {
              fairness: 'Medium - bounded wait time',
              starvation: 'No starvation',
              overhead: 'O(n log n) for sorting',
              performance: 'Better than FCFS, more uniform'
            },
            note: 'Called elevator algorithm - like an elevator servicing floors'
          }, null, 2)
        };
      }

      case 'cscan': {
        if (!args.requests || !Array.isArray(args.requests)) {
          throw new Error('Request queue required');
        }
        const head = args.head_position ?? 50;
        const result = cscan(args.requests, head, diskSize, direction);
        result.total_seek_time *= seekTimePerCylinder;

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'cscan',
            description: 'C-SCAN - move in one direction, jump to start, continue same direction',
            head_position: head,
            disk_size: diskSize,
            initial_direction: direction,
            request_queue: args.requests,
            ...result,
            seek_time_unit: 'ms',
            characteristics: {
              fairness: 'High - more uniform wait times',
              starvation: 'No starvation',
              overhead: 'O(n log n) for sorting',
              performance: 'More uniform than SCAN'
            },
            note: 'Circular SCAN - treats cylinders as circular list'
          }, null, 2)
        };
      }

      case 'look': {
        if (!args.requests || !Array.isArray(args.requests)) {
          throw new Error('Request queue required');
        }
        const head = args.head_position ?? 50;
        const result = look(args.requests, head, direction);
        result.total_seek_time *= seekTimePerCylinder;

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'look',
            description: 'LOOK - like SCAN but only goes to last request in each direction',
            head_position: head,
            disk_size: diskSize,
            initial_direction: direction,
            request_queue: args.requests,
            ...result,
            seek_time_unit: 'ms',
            characteristics: {
              fairness: 'Medium - bounded wait time',
              starvation: 'No starvation',
              overhead: 'O(n log n) for sorting',
              performance: 'Better than SCAN - no unnecessary travel'
            },
            note: 'Improved SCAN - "looks" for requests before moving'
          }, null, 2)
        };
      }

      case 'clook': {
        if (!args.requests || !Array.isArray(args.requests)) {
          throw new Error('Request queue required');
        }
        const head = args.head_position ?? 50;
        const result = clook(args.requests, head, direction);
        result.total_seek_time *= seekTimePerCylinder;

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'clook',
            description: 'C-LOOK - like C-SCAN but only goes to last request',
            head_position: head,
            disk_size: diskSize,
            initial_direction: direction,
            request_queue: args.requests,
            ...result,
            seek_time_unit: 'ms',
            characteristics: {
              fairness: 'High - uniform wait times',
              starvation: 'No starvation',
              overhead: 'O(n log n) for sorting',
              performance: 'Generally best overall performance'
            },
            note: 'Often the best choice in practice'
          }, null, 2)
        };
      }

      case 'compare': {
        if (!args.requests || !Array.isArray(args.requests)) {
          throw new Error('Request queue required');
        }
        const head = args.head_position ?? 50;
        const comparison = compareAlgorithms(args.requests, head, diskSize, direction);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'compare',
            head_position: head,
            disk_size: diskSize,
            direction: direction,
            request_queue: args.requests,
            num_requests: args.requests.length,
            ...comparison,
            recommendations: {
              high_throughput: 'SSTF or C-LOOK',
              fairness_critical: 'C-SCAN or C-LOOK',
              simple_implementation: 'FCFS',
              general_purpose: 'LOOK or C-LOOK'
            }
          }, null, 2)
        };
      }

      case 'visualize': {
        if (!args.requests || !Array.isArray(args.requests)) {
          throw new Error('Request queue required');
        }
        const head = args.head_position ?? 50;
        const algorithm = args.algorithm || 'look';

        let result: ScheduleResult;
        switch (algorithm) {
          case 'fcfs': result = fcfs(args.requests, head); break;
          case 'sstf': result = sstf(args.requests, head); break;
          case 'scan': result = scan(args.requests, head, diskSize, direction); break;
          case 'cscan': result = cscan(args.requests, head, diskSize, direction); break;
          case 'look': result = look(args.requests, head, direction); break;
          case 'clook': result = clook(args.requests, head, direction); break;
          default: result = look(args.requests, head, direction);
        }

        const visualization = visualizeMovement(result, diskSize);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'visualize',
            algorithm: result.algorithm,
            head_position: head,
            request_queue: args.requests,
            visualization: visualization,
            service_sequence: result.sequence,
            total_seek_distance: result.total_seek_distance
          }, null, 2)
        };
      }

      case 'demo': {
        const demoRequests = [98, 183, 37, 122, 14, 124, 65, 67];
        const demoHead = 53;

        const comparison = compareAlgorithms(demoRequests, demoHead, diskSize, direction);
        const lookResult = look(demoRequests, demoHead, 'up');

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'demo',
            description: 'Classic disk scheduling example',
            scenario: {
              disk_size: 200,
              head_position: demoHead,
              request_queue: demoRequests,
              direction: 'up'
            },
            ...comparison,
            detailed_look_example: {
              algorithm: 'LOOK',
              sequence: lookResult.sequence,
              movements: lookResult.movements,
              total_seek: lookResult.total_seek_distance,
              explanation: [
                `Start at cylinder ${demoHead}`,
                `Move up servicing: ${demoRequests.filter(r => r >= demoHead).sort((a,b) => a-b).join(', ')}`,
                `Then reverse and service: ${demoRequests.filter(r => r < demoHead).sort((a,b) => b-a).join(', ')}`
              ]
            }
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'disk_scheduler',
            description: 'Disk scheduling algorithms for optimizing seek time',
            algorithms: {
              fcfs: {
                name: 'First Come First Served',
                pros: ['Simple', 'Fair', 'No starvation'],
                cons: ['High average seek time', 'No optimization']
              },
              sstf: {
                name: 'Shortest Seek Time First',
                pros: ['Good average seek time', 'High throughput'],
                cons: ['Can cause starvation', 'Not fair']
              },
              scan: {
                name: 'SCAN (Elevator)',
                pros: ['No starvation', 'Bounded wait time'],
                cons: ['Goes to disk ends unnecessarily']
              },
              cscan: {
                name: 'Circular SCAN',
                pros: ['More uniform wait time', 'No starvation'],
                cons: ['Jumps from end to beginning']
              },
              look: {
                name: 'LOOK',
                pros: ['Better than SCAN', 'No unnecessary travel'],
                cons: ['Slightly less uniform than C-LOOK']
              },
              clook: {
                name: 'Circular LOOK',
                pros: ['Best overall performance', 'Uniform wait times'],
                cons: ['Slightly complex implementation']
              }
            },
            metrics: {
              seek_distance: 'Total cylinders traversed',
              seek_time: 'Time = distance × seek_time_per_cylinder',
              throughput: 'Requests / total_seek_time',
              average_seek: 'Total seek / number of requests'
            },
            operations: {
              'fcfs|sstf|scan|cscan|look|clook': 'Run specific algorithm',
              compare: 'Compare all algorithms',
              visualize: 'ASCII visualization of head movement',
              demo: 'Classic textbook example'
            }
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                description: 'FCFS scheduling',
                call: {
                  operation: 'fcfs',
                  requests: [98, 183, 37, 122, 14, 124, 65, 67],
                  head_position: 53
                }
              },
              {
                description: 'SSTF scheduling',
                call: {
                  operation: 'sstf',
                  requests: [98, 183, 37, 122, 14, 124, 65, 67],
                  head_position: 53
                }
              },
              {
                description: 'SCAN with direction',
                call: {
                  operation: 'scan',
                  requests: [98, 183, 37, 122, 14, 124, 65, 67],
                  head_position: 53,
                  disk_size: 200,
                  direction: 'up'
                }
              },
              {
                description: 'Compare all algorithms',
                call: {
                  operation: 'compare',
                  requests: [98, 183, 37, 122, 14, 124, 65, 67],
                  head_position: 53,
                  disk_size: 200
                }
              },
              {
                description: 'Visualize LOOK algorithm',
                call: {
                  operation: 'visualize',
                  requests: [98, 183, 37, 122, 14, 124, 65, 67],
                  head_position: 53,
                  algorithm: 'look'
                }
              }
            ]
          }, null, 2)
        };
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isdiskschedulerAvailable(): boolean {
  return true;
}
