/**
 * ROOT-LOCUS TOOL
 * Root locus analysis for control systems
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const rootlocusTool: UnifiedTool = {
  name: 'root_locus',
  description: 'Root locus analysis for control systems',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['plot', 'analyze', 'design', 'gain_selection', 'info'], description: 'Operation' },
      numerator: { type: 'array', items: { type: 'number' }, description: 'Open-loop numerator [b_n, ..., b_0]' },
      denominator: { type: 'array', items: { type: 'number' }, description: 'Open-loop denominator [a_n, ..., a_0]' },
      desired_poles: { type: 'array', items: { type: 'number' }, description: 'Desired closed-loop pole locations [real1, imag1, real2, imag2, ...]' },
      gain_range: { type: 'array', items: { type: 'number' }, description: '[K_min, K_max] gain range to analyze' }
    },
    required: ['operation']
  }
};

interface Complex {
  re: number;
  im: number;
}

function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

function cSub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}

function cMul(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

function cAbs(c: Complex): number {
  return Math.sqrt(c.re * c.re + c.im * c.im);
}

function cArg(c: Complex): number {
  return Math.atan2(c.im, c.re);
}

function polyEval(coeffs: number[], s: Complex): Complex {
  let result: Complex = { re: 0, im: 0 };
  for (let i = 0; i < coeffs.length; i++) {
    result = cAdd(cMul(result, s), { re: coeffs[i], im: 0 });
  }
  return result;
}

// Find roots using Durand-Kerner
function findRoots(coeffs: number[]): Complex[] {
  const n = coeffs.length - 1;
  if (n <= 0) return [];
  if (n === 1) return [{ re: -coeffs[1] / coeffs[0], im: 0 }];

  if (n === 2) {
    const a = coeffs[0], b = coeffs[1], c = coeffs[2];
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      return [{ re: (-b + sq) / (2 * a), im: 0 }, { re: (-b - sq) / (2 * a), im: 0 }];
    } else {
      const sq = Math.sqrt(-disc);
      return [{ re: -b / (2 * a), im: sq / (2 * a) }, { re: -b / (2 * a), im: -sq / (2 * a) }];
    }
  }

  const roots: Complex[] = [];
  const norm = coeffs.map(c => c / coeffs[0]);

  for (let i = 0; i < n; i++) {
    const angle = 2 * Math.PI * i / n + 0.1;
    roots.push({ re: 0.5 * Math.cos(angle), im: 0.5 * Math.sin(angle) });
  }

  for (let iter = 0; iter < 100; iter++) {
    let maxDelta = 0;
    for (let i = 0; i < n; i++) {
      const num = polyEval(norm, roots[i]);
      let denom: Complex = { re: 1, im: 0 };
      for (let j = 0; j < n; j++) {
        if (i !== j) denom = cMul(denom, cSub(roots[i], roots[j]));
      }
      if (cAbs(denom) > 1e-12) {
        const delta = { re: num.re / cAbs(denom), im: num.im / cAbs(denom) };
        roots[i] = cSub(roots[i], delta);
        maxDelta = Math.max(maxDelta, cAbs(delta));
      }
    }
    if (maxDelta < 1e-10) break;
  }

  return roots;
}

// Find closed-loop poles for given gain K
function closedLoopPoles(num: number[], den: number[], K: number): Complex[] {
  // Closed-loop characteristic: D(s) + K*N(s) = 0
  const charPoly: number[] = [];
  const maxOrder = Math.max(num.length, den.length);

  for (let i = 0; i < maxOrder; i++) {
    const denCoeff = i < den.length ? den[den.length - 1 - i] : 0;
    const numCoeff = i < num.length ? num[num.length - 1 - i] : 0;
    charPoly.unshift(denCoeff + K * numCoeff);
  }

  return findRoots(charPoly);
}

function formatComplex(c: Complex): string {
  if (Math.abs(c.im) < 1e-6) return c.re.toFixed(4);
  if (Math.abs(c.re) < 1e-6) return `${c.im.toFixed(4)}j`;
  const sign = c.im >= 0 ? '+' : '-';
  return `${c.re.toFixed(4)}${sign}${Math.abs(c.im).toFixed(4)}j`;
}

export async function executerootlocus(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      const info = {
        tool: 'root-locus',
        description: 'Root locus shows how closed-loop poles move as gain K varies from 0 to ∞',
        equation: {
          openLoop: 'G(s) = K × N(s)/D(s)',
          closedLoop: 'T(s) = KN(s) / (D(s) + KN(s))',
          characteristicEq: '1 + KG(s) = 0, or D(s) + KN(s) = 0'
        },
        rules: {
          startPoints: 'Locus starts at open-loop poles (K=0)',
          endPoints: 'Locus ends at open-loop zeros (K=∞) or asymptotes',
          realAxis: 'Locus exists on real axis to left of odd number of poles+zeros',
          asymptotes: {
            number: 'n - m (poles minus zeros)',
            angles: '(2k+1)×180°/(n-m) for k=0,1,...',
            centroid: '(Σpoles - Σzeros)/(n-m)'
          },
          breakaway: 'Points where locus leaves/enters real axis: dK/ds = 0'
        },
        stabilityRegion: 'Closed-loop stable when all poles in left half-plane (Re < 0)',
        applications: [
          'Controller gain selection',
          'Stability analysis',
          'Transient response design',
          'Compensator design'
        ],
        operations: ['plot', 'analyze', 'design', 'gain_selection']
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    if (operation === 'plot') {
      const num = args.numerator || [1];
      const den = args.denominator || [1, 3, 2];
      const gainRange = args.gain_range || [0, 100];

      const poles = findRoots(den);
      const zeros = num.length > 1 ? findRoots(num) : [];

      // Generate root locus points
      const numGains = 200;
      const locusPoints: { K: number; poles: Complex[] }[] = [];

      for (let i = 0; i <= numGains; i++) {
        const K = gainRange[0] + (gainRange[1] - gainRange[0]) * (i / numGains) ** 2;
        const clPoles = closedLoopPoles(num, den, K);
        locusPoints.push({ K, poles: clPoles });
      }

      // Find critical gain (where poles cross imaginary axis)
      let criticalGain: number | null = null;
      for (let i = 1; i < locusPoints.length; i++) {
        const prevPoles = locusPoints[i - 1].poles;
        const currPoles = locusPoints[i].poles;
        for (let j = 0; j < currPoles.length; j++) {
          if (prevPoles[j] && currPoles[j]) {
            if (prevPoles[j].re < 0 && currPoles[j].re >= 0) {
              criticalGain = locusPoints[i].K;
              break;
            }
          }
        }
        if (criticalGain) break;
      }

      const result = {
        operation: 'plot',
        openLoopPoles: poles.map(p => formatComplex(p)),
        openLoopZeros: zeros.map(z => formatComplex(z)),
        numPoles: poles.length,
        numZeros: zeros.length,
        asymptotes: {
          number: poles.length - zeros.length,
          angles: Array.from({ length: poles.length - zeros.length }, (_, k) =>
            ((2 * k + 1) * 180 / (poles.length - zeros.length)).toFixed(1) + '°'
          ),
          centroid: ((poles.reduce((s, p) => s + p.re, 0) - zeros.reduce((s, z) => s + z.re, 0)) /
            (poles.length - zeros.length)).toFixed(4)
        },
        criticalGain: criticalGain ? criticalGain.toFixed(4) : 'System always stable in range',
        gainRange: { min: gainRange[0], max: gainRange[1] },
        samplePoints: locusPoints.filter((_, i) => i % 20 === 0).map(p => ({
          K: p.K.toFixed(3),
          poles: p.poles.map(pole => formatComplex(pole))
        })),
        plot: createRootLocusPlot(poles, zeros, locusPoints)
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'analyze') {
      const num = args.numerator || [1];
      const den = args.denominator || [1, 5, 6];

      const poles = findRoots(den);
      const zeros = num.length > 1 ? findRoots(num) : [];

      const n = poles.length;
      const m = zeros.length;

      // Asymptote analysis
      const numAsymptotes = n - m;
      const centroid = numAsymptotes > 0 ?
        (poles.reduce((s, p) => s + p.re, 0) - zeros.reduce((s, z) => s + z.re, 0)) / numAsymptotes : 0;

      // Real axis segments
      const realAxisPoints = [...poles.filter(p => Math.abs(p.im) < 1e-6).map(p => p.re),
                              ...zeros.filter(z => Math.abs(z.im) < 1e-6).map(z => z.re)].sort((a, b) => b - a);

      const realAxisSegments: { start: number; end: number }[] = [];
      for (let i = 0; i < realAxisPoints.length; i += 2) {
        if (i + 1 < realAxisPoints.length) {
          realAxisSegments.push({ start: realAxisPoints[i + 1], end: realAxisPoints[i] });
        } else {
          realAxisSegments.push({ start: -Infinity, end: realAxisPoints[i] });
        }
      }

      // Find breakaway/break-in points (approximate)
      const breakawayPoints: number[] = [];
      for (const seg of realAxisSegments) {
        if (isFinite(seg.start)) {
          // Check for local extremum of K
          const mid = (seg.start + seg.end) / 2;
          breakawayPoints.push(mid);
        }
      }

      // Angle of departure from complex poles
      const departureAngles: { pole: string; angle: string }[] = [];
      for (const p of poles) {
        if (Math.abs(p.im) > 1e-6 && p.im > 0) {
          // Sum of angles from other poles minus sum of angles from zeros + 180
          let angleSum = 180;
          for (const other of poles) {
            if (other !== p) {
              angleSum -= Math.atan2(p.im - other.im, p.re - other.re) * 180 / Math.PI;
            }
          }
          for (const z of zeros) {
            angleSum += Math.atan2(p.im - z.im, p.re - z.re) * 180 / Math.PI;
          }
          departureAngles.push({ pole: formatComplex(p), angle: (angleSum % 360).toFixed(1) + '°' });
        }
      }

      const result = {
        operation: 'analyze',
        systemInfo: {
          numPoles: n,
          numZeros: m,
          relativeOrder: n - m,
          type: den[den.length - 1] === 0 ? 'Type 1 (has integrator)' : 'Type 0'
        },
        openLoopPoles: poles.map(p => ({
          value: formatComplex(p),
          location: p.re < 0 ? 'LHP (stable)' : p.re > 0 ? 'RHP (unstable)' : 'On axis'
        })),
        openLoopZeros: zeros.map(z => ({ value: formatComplex(z) })),
        asymptotes: numAsymptotes > 0 ? {
          count: numAsymptotes,
          centroid: centroid.toFixed(4),
          angles: Array.from({ length: numAsymptotes }, (_, k) =>
            ((2 * k + 1) * 180 / numAsymptotes).toFixed(1) + '°')
        } : 'No asymptotes (zeros = poles)',
        realAxisLocus: realAxisSegments.map(s => ({
          from: isFinite(s.start) ? s.start.toFixed(3) : '-∞',
          to: s.end.toFixed(3)
        })),
        breakawayPoints: breakawayPoints.map(b => b.toFixed(4)),
        departureAngles: departureAngles.length > 0 ? departureAngles : 'No complex poles'
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'design') {
      const num = args.numerator || [1];
      const den = args.denominator || [1, 3, 2];
      const desiredPoles = args.desired_poles || [-2, 0];

      // Convert desired poles array to Complex
      const desiredComplex: Complex[] = [];
      for (let i = 0; i < desiredPoles.length; i += 2) {
        desiredComplex.push({ re: desiredPoles[i], im: desiredPoles[i + 1] || 0 });
      }

      // For each desired pole, calculate required gain
      const gains: { pole: Complex; K: number; onLocus: boolean }[] = [];

      for (const dp of desiredComplex) {
        // K = -D(s)/N(s) at s = desired pole
        const numVal = polyEval(num, dp);
        const denVal = polyEval(den, dp);

        if (cAbs(numVal) > 1e-10) {
          const K = -cAbs(denVal) / cAbs(numVal);
          // Check if angle condition is satisfied
          const angleNum = cArg(numVal);
          const angleDen = cArg(denVal);
          const totalAngle = (angleDen - angleNum) * 180 / Math.PI;
          const onLocus = Math.abs(((totalAngle + 180) % 360) - 180) < 5;

          gains.push({ pole: dp, K: K, onLocus });
        }
      }

      const result = {
        operation: 'design',
        desiredPoles: desiredComplex.map(p => formatComplex(p)),
        gainCalculations: gains.map(g => ({
          pole: formatComplex(g.pole),
          calculatedGain: g.K.toFixed(4),
          onRootLocus: g.onLocus,
          note: g.onLocus ? 'Valid design point' : 'Not on root locus - use compensation'
        })),
        recommendation: gains.some(g => g.onLocus) ?
          `Use K = ${gains.find(g => g.onLocus)?.K.toFixed(4)} for desired pole placement` :
          'Desired poles not achievable with gain alone - add compensator',
        compensatorHints: {
          leadCompensator: 'Add zero to pull locus left, pole further left',
          lagCompensator: 'Add pole-zero pair near origin for steady-state improvement',
          pdController: 'Equivalent to adding a zero'
        }
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'gain_selection') {
      const num = args.numerator || [1];
      const den = args.denominator || [1, 3, 2];
      const gainRange = args.gain_range || [0, 50];

      // Evaluate stability, damping, and speed for various gains
      const numGains = 20;
      const gainAnalysis: object[] = [];

      for (let i = 0; i <= numGains; i++) {
        const K = gainRange[0] + (gainRange[1] - gainRange[0]) * i / numGains;
        const clPoles = closedLoopPoles(num, den, K);

        const isStable = clPoles.every(p => p.re < 0);
        const dominantPole = clPoles.reduce((a, b) => a.re > b.re ? a : b);

        // Estimate damping ratio from dominant poles
        let dampingRatio = 1;
        let naturalFreq = Math.abs(dominantPole.re);

        if (Math.abs(dominantPole.im) > 1e-6) {
          const sigma = Math.abs(dominantPole.re);
          const omega = Math.abs(dominantPole.im);
          naturalFreq = Math.sqrt(sigma * sigma + omega * omega);
          dampingRatio = sigma / naturalFreq;
        }

        // Estimate settling time and overshoot
        const settlingTime = isStable ? 4 / Math.abs(dominantPole.re) : Infinity;
        const overshoot = dampingRatio < 1 ?
          Math.exp(-Math.PI * dampingRatio / Math.sqrt(1 - dampingRatio * dampingRatio)) * 100 : 0;

        gainAnalysis.push({
          K: K.toFixed(2),
          stable: isStable,
          dominantPole: formatComplex(dominantPole),
          dampingRatio: dampingRatio.toFixed(3),
          naturalFrequency: naturalFreq.toFixed(3) + ' rad/s',
          settlingTime: isStable ? settlingTime.toFixed(2) + 's' : 'Unstable',
          overshoot: isStable ? overshoot.toFixed(1) + '%' : 'N/A'
        });
      }

      // Find optimal gain for different criteria
      const stableGains = gainAnalysis.filter((g: any) => g.stable);
      const optimalDamping = stableGains.find((g: any) =>
        parseFloat(g.dampingRatio) >= 0.6 && parseFloat(g.dampingRatio) <= 0.8);
      const fastestStable = stableGains.reduce((a: any, b: any) =>
        parseFloat(a.settlingTime) < parseFloat(b.settlingTime) ? a : b, stableGains[0]);

      const result = {
        operation: 'gain_selection',
        gainRange: { min: gainRange[0], max: gainRange[1] },
        analysis: gainAnalysis,
        recommendations: {
          criticallyDamped: optimalDamping ? `K ≈ ${optimalDamping.K} for ζ ≈ 0.7` : 'No suitable gain in range',
          fastestResponse: fastestStable ? `K ≈ ${fastestStable.K}` : 'No stable gains',
          guidelines: {
            overdamped: 'ζ > 1: No overshoot, slow response',
            criticallyDamped: 'ζ ≈ 0.7: ~5% overshoot, good balance',
            underdamped: 'ζ < 0.5: Fast but oscillatory'
          }
        }
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    return { toolCallId: id, content: JSON.stringify({ error: 'Unknown operation', operation }, null, 2), isError: true };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

function createRootLocusPlot(poles: Complex[], zeros: Complex[],
  locusPoints: { K: number; poles: Complex[] }[]): string {

  const width = 50;
  const height = 25;
  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));

  // Find scale
  const allRe = [...poles.map(p => p.re), ...zeros.map(z => z.re),
                 ...locusPoints.flatMap(lp => lp.poles.map(p => p.re))];
  const allIm = [...poles.map(p => p.im), ...zeros.map(z => z.im),
                 ...locusPoints.flatMap(lp => lp.poles.map(p => p.im))];

  const maxRe = Math.max(2, ...allRe.map(Math.abs));
  const maxIm = Math.max(2, ...allIm.map(Math.abs));

  const centerY = Math.floor(height / 2);
  const centerX = Math.floor(width / 2);

  // Draw axes
  for (let x = 0; x < width; x++) grid[centerY][x] = '─';
  for (let y = 0; y < height; y++) grid[y][centerX] = '│';
  grid[centerY][centerX] = '┼';

  // Draw imaginary axis label
  grid[0][centerX] = 'j';
  grid[height - 1][centerX] = 'j';

  // Plot locus points
  for (const lp of locusPoints) {
    for (const p of lp.poles) {
      const x = Math.round(centerX + (p.re / maxRe) * (width / 2 - 2));
      const y = Math.round(centerY - (p.im / maxIm) * (height / 2 - 1));
      if (x >= 0 && x < width && y >= 0 && y < height && grid[y][x] === ' ') {
        grid[y][x] = '·';
      }
    }
  }

  // Plot open-loop poles
  for (const p of poles) {
    const x = Math.round(centerX + (p.re / maxRe) * (width / 2 - 2));
    const y = Math.round(centerY - (p.im / maxIm) * (height / 2 - 1));
    if (x >= 0 && x < width && y >= 0 && y < height) {
      grid[y][x] = '×';
    }
  }

  // Plot zeros
  for (const z of zeros) {
    const x = Math.round(centerX + (z.re / maxRe) * (width / 2 - 2));
    const y = Math.round(centerY - (z.im / maxIm) * (height / 2 - 1));
    if (x >= 0 && x < width && y >= 0 && y < height) {
      grid[y][x] = '○';
    }
  }

  const lines = [
    `Root Locus Plot (× = pole, ○ = zero, · = locus)`,
    `Im ↑  Scale: Re ±${maxRe.toFixed(1)}, Im ±${maxIm.toFixed(1)}`,
    ...grid.map(row => row.join('')),
    `  → Re   (Stable region: Re < 0)`
  ];

  return lines.join('\n');
}

export function isrootlocusAvailable(): boolean { return true; }
