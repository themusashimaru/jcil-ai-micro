/**
 * NYQUIST-PLOT TOOL
 * Nyquist stability analysis for control systems
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

export const nyquistplotTool: UnifiedTool = {
  name: 'nyquist_plot',
  description: 'Nyquist plot for stability analysis',
  parameters: {
    type: 'object',
    properties: {
      operation: { type: 'string', enum: ['plot', 'stability', 'encirclements', 'margins', 'info'], description: 'Operation' },
      numerator: { type: 'array', items: { type: 'number' }, description: 'Open-loop numerator [b_n, ..., b_0]' },
      denominator: { type: 'array', items: { type: 'number' }, description: 'Open-loop denominator [a_n, ..., a_0]' },
      gain: { type: 'number', description: 'Loop gain K' },
      frequency_range: { type: 'array', items: { type: 'number' }, description: '[min_freq, max_freq] in rad/s' }
    },
    required: ['operation']
  }
};

interface Complex {
  re: number;
  im: number;
}

function cMul(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

function cDiv(a: Complex, b: Complex): Complex {
  const denom = b.re * b.re + b.im * b.im;
  if (denom < 1e-15) return { re: Infinity, im: 0 };
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom
  };
}

function cAbs(c: Complex): number {
  return Math.sqrt(c.re * c.re + c.im * c.im);
}

function cArg(c: Complex): number {
  return Math.atan2(c.im, c.re);
}

function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

function cSub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}

function polyEval(coeffs: number[], s: Complex): Complex {
  let result: Complex = { re: 0, im: 0 };
  for (let i = 0; i < coeffs.length; i++) {
    result = cAdd(cMul(result, s), { re: coeffs[i], im: 0 });
  }
  return result;
}

// Find roots (poles/zeros)
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

  // Durand-Kerner for higher order
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
        const delta = cDiv(num, denom);
        roots[i] = cSub(roots[i], delta);
        maxDelta = Math.max(maxDelta, cAbs(delta));
      }
    }
    if (maxDelta < 1e-10) break;
  }
  return roots;
}

// Evaluate transfer function at s = jω
function evalTF(num: number[], den: number[], omega: number): Complex {
  const s: Complex = { re: 0, im: omega };
  const numVal = polyEval(num, s);
  const denVal = polyEval(den, s);
  return cDiv(numVal, denVal);
}

// Count encirclements of -1 point
function countEncirclements(nyquistPoints: Complex[]): number {
  const criticalPoint: Complex = { re: -1, im: 0 };
  let totalAngle = 0;

  for (let i = 0; i < nyquistPoints.length - 1; i++) {
    const p1 = cSub(nyquistPoints[i], criticalPoint);
    const p2 = cSub(nyquistPoints[i + 1], criticalPoint);

    let angleDiff = cArg(p2) - cArg(p1);
    // Unwrap
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    totalAngle += angleDiff;
  }

  return Math.round(totalAngle / (2 * Math.PI));
}

export async function executenyquistplot(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation || 'info';

    if (operation === 'info') {
      const info = {
        tool: 'nyquist-plot',
        description: 'Nyquist plot maps open-loop frequency response G(jω) onto complex plane',
        concept: {
          xAxis: 'Real part of G(jω)',
          yAxis: 'Imaginary part of G(jω)',
          parameter: 'Frequency ω varies from -∞ to +∞'
        },
        nyquistCriterion: {
          statement: 'Z = N + P',
          Z: 'Number of closed-loop poles in RHP (unstable)',
          N: 'Number of clockwise encirclements of -1 point',
          P: 'Number of open-loop poles in RHP',
          stability: 'System stable iff Z = 0, i.e., N = -P'
        },
        criticalPoint: {
          location: '-1 + 0j',
          significance: 'Determines closed-loop stability',
          distanceTo: 'Related to gain margin',
          angleFrom: 'Related to phase margin'
        },
        specialCases: {
          stableOpenLoop: 'P = 0, need N = 0 (no encirclements) for stability',
          unstableOpenLoop: 'P > 0, need N = -P (counter-clockwise encirclements)'
        },
        advantages: [
          'Works for systems with RHP poles',
          'Shows gain and phase margins graphically',
          'Handles time delays naturally',
          'Provides robustness information'
        ],
        operations: ['plot', 'stability', 'encirclements', 'margins']
      };
      return { toolCallId: id, content: JSON.stringify(info, null, 2) };
    }

    if (operation === 'plot') {
      const num = args.numerator || [1];
      const den = args.denominator || [1, 2, 1];
      const gain = args.gain || 1;
      const freqRange = args.frequency_range || [0.001, 1000];

      const scaledNum = num.map((c: number) => c * gain);

      // Generate Nyquist points for positive frequencies
      const numPoints = 500;
      const positiveFreqPoints: { omega: number; G: Complex }[] = [];

      for (let i = 0; i <= numPoints; i++) {
        // Use logarithmic spacing
        const t = i / numPoints;
        const omega = freqRange[0] * Math.pow(freqRange[1] / freqRange[0], t);
        const G = evalTF(scaledNum, den, omega);
        if (isFinite(G.re) && isFinite(G.im)) {
          positiveFreqPoints.push({ omega, G });
        }
      }

      // Mirror for negative frequencies (conjugate)
      const negativeFreqPoints = positiveFreqPoints.map(p => ({
        omega: -p.omega,
        G: { re: p.G.re, im: -p.G.im }
      })).reverse();

      const allPoints = [...positiveFreqPoints, ...negativeFreqPoints];
      const nyquistContour = allPoints.map(p => p.G);

      // Find key points
      const dcPoint = evalTF(scaledNum, den, 0.001);
      const highFreqPoint = evalTF(scaledNum, den, 1000);

      // Find crossings of real axis
      const realAxisCrossings: { omega: number; re: number }[] = [];
      for (let i = 1; i < positiveFreqPoints.length; i++) {
        const prev = positiveFreqPoints[i - 1];
        const curr = positiveFreqPoints[i];
        if (prev.G.im * curr.G.im < 0) {
          const t = -prev.G.im / (curr.G.im - prev.G.im);
          const crossRe = prev.G.re + t * (curr.G.re - prev.G.re);
          const crossOmega = prev.omega + t * (curr.omega - prev.omega);
          realAxisCrossings.push({ omega: crossOmega, re: crossRe });
        }
      }

      const result = {
        operation: 'plot',
        gain,
        frequencyRange: freqRange,
        keyPoints: {
          dc: { re: dcPoint.re.toFixed(4), im: dcPoint.im.toFixed(4) },
          highFrequency: { re: highFreqPoint.re.toFixed(4), im: highFreqPoint.im.toFixed(4) }
        },
        realAxisCrossings: realAxisCrossings.map(c => ({
          frequency: c.omega.toFixed(3) + ' rad/s',
          realValue: c.re.toFixed(4),
          passesLeft: c.re < -1 ? 'Yes (left of -1)' : 'No'
        })),
        samplePoints: positiveFreqPoints.filter((_, i) => i % 50 === 0).map(p => ({
          omega: p.omega.toFixed(3),
          real: p.G.re.toFixed(4),
          imag: p.G.im.toFixed(4),
          magnitude: cAbs(p.G).toFixed(4),
          phase: (cArg(p.G) * 180 / Math.PI).toFixed(1) + '°'
        })),
        plot: createNyquistPlot(nyquistContour)
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'stability') {
      const num = args.numerator || [1];
      const den = args.denominator || [1, 3, 2];
      const gain = args.gain || 1;

      const scaledNum = num.map((c: number) => c * gain);

      // Find open-loop poles
      const poles = findRoots(den);
      const rhpPoles = poles.filter(p => p.re > 0).length;

      // Generate Nyquist contour
      const nyquistPoints: Complex[] = [];
      for (let i = 0; i <= 1000; i++) {
        const omega = 0.001 * Math.pow(10000, i / 1000);
        const G = evalTF(scaledNum, den, omega);
        if (isFinite(G.re) && isFinite(G.im)) {
          nyquistPoints.push(G);
        }
      }

      // Add conjugate (negative frequencies)
      const conjugate = nyquistPoints.map(p => ({ re: p.re, im: -p.im })).reverse();
      const fullContour = [...nyquistPoints, ...conjugate];

      const encirclements = countEncirclements(fullContour);
      const rhpClosedLoopPoles = encirclements + rhpPoles;
      const isStable = rhpClosedLoopPoles === 0;

      const result = {
        operation: 'stability',
        gain,
        nyquistCriterion: {
          P: rhpPoles,
          N: encirclements,
          Z: rhpClosedLoopPoles,
          formula: 'Z = N + P'
        },
        interpretation: {
          P: `${rhpPoles} open-loop pole(s) in RHP`,
          N: `${encirclements} clockwise encirclement(s) of -1`,
          Z: `${rhpClosedLoopPoles} closed-loop pole(s) in RHP`
        },
        closedLoopStability: isStable ? 'STABLE' : 'UNSTABLE',
        explanation: isStable ?
          'No encirclements of -1 and no RHP open-loop poles → Stable' :
          rhpClosedLoopPoles > 0 ?
            `${rhpClosedLoopPoles} closed-loop pole(s) in RHP → Unstable` :
            'Encirclements indicate instability',
        openLoopPoles: poles.map(p => ({
          value: `${p.re.toFixed(4)} ${p.im >= 0 ? '+' : '-'} ${Math.abs(p.im).toFixed(4)}j`,
          location: p.re > 0 ? 'RHP (unstable)' : p.re < 0 ? 'LHP (stable)' : 'Imaginary axis'
        }))
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'encirclements') {
      const num = args.numerator || [1];
      const den = args.denominator || [1, 3, 2, 0];
      const gain = args.gain || 1;

      const scaledNum = num.map((c: number) => c * gain);

      // Detailed encirclement analysis
      const nyquistPoints: Complex[] = [];
      const angleChanges: { omega: number; angle: number; cumulative: number }[] = [];
      let cumulativeAngle = 0;

      for (let i = 0; i <= 2000; i++) {
        const omega = 0.001 * Math.pow(10000, i / 2000);
        const G = evalTF(scaledNum, den, omega);
        if (isFinite(G.re) && isFinite(G.im)) {
          nyquistPoints.push(G);

          if (nyquistPoints.length > 1) {
            const prev = cSub(nyquistPoints[nyquistPoints.length - 2], { re: -1, im: 0 });
            const curr = cSub(G, { re: -1, im: 0 });
            let angleDiff = cArg(curr) - cArg(prev);
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            cumulativeAngle += angleDiff;

            if (i % 200 === 0) {
              angleChanges.push({
                omega,
                angle: angleDiff * 180 / Math.PI,
                cumulative: cumulativeAngle * 180 / Math.PI
              });
            }
          }
        }
      }

      const totalEncirclements = Math.round(cumulativeAngle / (2 * Math.PI));

      const result = {
        operation: 'encirclements',
        gain,
        analysis: {
          totalAngleChange: (cumulativeAngle * 180 / Math.PI).toFixed(1) + '°',
          encirclementsPositiveFreq: (cumulativeAngle / (2 * Math.PI)).toFixed(3),
          fullContourEncirclements: totalEncirclements
        },
        angleProgression: angleChanges.map(a => ({
          frequency: a.omega.toFixed(2) + ' rad/s',
          incrementalAngle: a.angle.toFixed(2) + '°',
          cumulativeAngle: a.cumulative.toFixed(1) + '°'
        })),
        interpretation: {
          positive: 'Positive N means clockwise encirclements',
          negative: 'Negative N means counter-clockwise encirclements',
          zero: 'Zero means no net encirclements'
        },
        note: 'Full Nyquist contour includes negative frequencies (conjugate mirror)'
      };

      return { toolCallId: id, content: JSON.stringify(result, null, 2) };
    }

    if (operation === 'margins') {
      const num = args.numerator || [1];
      const den = args.denominator || [1, 3, 2];
      const gain = args.gain || 1;

      const scaledNum = num.map((c: number) => c * gain);

      // Find closest approach to -1
      let minDistance = Infinity;
      let closestPoint: { omega: number; G: Complex } | null = null;

      // Find phase crossover (Im = 0, Re < 0)
      let phaseCrossover: { omega: number; re: number } | null = null;

      // Find gain crossover (|G| = 1)
      let gainCrossover: { omega: number; phase: number } | null = null;

      for (let i = 0; i <= 2000; i++) {
        const omega = 0.001 * Math.pow(10000, i / 2000);
        const G = evalTF(scaledNum, den, omega);

        if (!isFinite(G.re) || !isFinite(G.im)) continue;

        // Distance to -1
        const dist = Math.sqrt((G.re + 1) ** 2 + G.im ** 2);
        if (dist < minDistance) {
          minDistance = dist;
          closestPoint = { omega, G };
        }

        // Phase crossover (imaginary part crosses zero)
        if (i > 0) {
          const prevOmega = 0.001 * Math.pow(10000, (i - 1) / 2000);
          const prevG = evalTF(scaledNum, den, prevOmega);
          if (prevG.im * G.im < 0 && G.re < 0) {
            const t = -prevG.im / (G.im - prevG.im);
            const crossRe = prevG.re + t * (G.re - prevG.re);
            phaseCrossover = { omega: prevOmega + t * (omega - prevOmega), re: crossRe };
          }
        }

        // Gain crossover (magnitude = 1)
        const mag = cAbs(G);
        if (i > 0) {
          const prevOmega = 0.001 * Math.pow(10000, (i - 1) / 2000);
          const prevMag = cAbs(evalTF(scaledNum, den, prevOmega));
          if ((prevMag - 1) * (mag - 1) < 0) {
            const phase = cArg(G) * 180 / Math.PI;
            gainCrossover = { omega, phase };
          }
        }
      }

      // Calculate margins
      const gainMargin = phaseCrossover ? -20 * Math.log10(Math.abs(phaseCrossover.re)) : Infinity;
      const phaseMargin = gainCrossover ? 180 + gainCrossover.phase : null;

      const result = {
        operation: 'margins',
        gain,
        gainMargin: {
          value: isFinite(gainMargin) ? gainMargin.toFixed(2) + ' dB' : 'Infinite',
          frequency: phaseCrossover ? phaseCrossover.omega.toFixed(3) + ' rad/s' : 'N/A',
          interpretation: isFinite(gainMargin) ?
            `Gain can increase by ${gainMargin.toFixed(1)} dB before instability` :
            'No phase crossover - gain can be increased indefinitely'
        },
        phaseMargin: {
          value: phaseMargin !== null ? phaseMargin.toFixed(1) + '°' : 'N/A',
          frequency: gainCrossover ? gainCrossover.omega.toFixed(3) + ' rad/s' : 'N/A',
          interpretation: phaseMargin !== null ?
            `Phase can lag by ${phaseMargin.toFixed(1)}° more before instability` :
            'No gain crossover in frequency range'
        },
        robustnessMetrics: {
          distanceToNegOne: minDistance.toFixed(4),
          closestApproach: closestPoint ? {
            frequency: closestPoint.omega.toFixed(3) + ' rad/s',
            point: `${closestPoint.G.re.toFixed(4)} + ${closestPoint.G.im.toFixed(4)}j`
          } : null
        },
        stabilityAssessment: {
          gainMarginAdequate: gainMargin > 6 || !isFinite(gainMargin),
          phaseMarginAdequate: phaseMargin === null || phaseMargin > 45,
          overallRobust: (gainMargin > 6 || !isFinite(gainMargin)) &&
                         (phaseMargin === null || phaseMargin > 45)
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

function createNyquistPlot(points: Complex[]): string {
  const width = 50;
  const height = 30;
  const grid: string[][] = Array(height).fill(null).map(() => Array(width).fill(' '));

  // Find scale
  const reVals = points.filter(p => isFinite(p.re)).map(p => p.re);
  const imVals = points.filter(p => isFinite(p.im)).map(p => p.im);

  if (reVals.length === 0) return 'No valid points to plot';

  const minRe = Math.min(-2, ...reVals);
  const maxRe = Math.max(1, ...reVals);
  const minIm = Math.min(-2, ...imVals);
  const maxIm = Math.max(2, ...imVals);

  const scaleX = (width - 1) / (maxRe - minRe);
  const scaleY = (height - 1) / (maxIm - minIm);

  // Draw axes
  const originX = Math.round(-minRe * scaleX);
  const originY = Math.round(maxIm * scaleY);

  if (originY >= 0 && originY < height) {
    for (let x = 0; x < width; x++) grid[originY][x] = '─';
  }
  if (originX >= 0 && originX < width) {
    for (let y = 0; y < height; y++) grid[y][originX] = '│';
  }
  if (originX >= 0 && originX < width && originY >= 0 && originY < height) {
    grid[originY][originX] = '┼';
  }

  // Mark -1 point
  const neg1X = Math.round((-1 - minRe) * scaleX);
  const neg1Y = Math.round((maxIm - 0) * scaleY);
  if (neg1X >= 0 && neg1X < width && neg1Y >= 0 && neg1Y < height) {
    grid[neg1Y][neg1X] = '⊗';
  }

  // Plot Nyquist contour
  for (const p of points) {
    if (!isFinite(p.re) || !isFinite(p.im)) continue;
    const x = Math.round((p.re - minRe) * scaleX);
    const y = Math.round((maxIm - p.im) * scaleY);
    if (x >= 0 && x < width && y >= 0 && y < height && grid[y][x] === ' ') {
      grid[y][x] = '·';
    }
  }

  const lines = [
    'Nyquist Plot (⊗ = critical point -1+0j)',
    `Im ↑  Re: [${minRe.toFixed(1)}, ${maxRe.toFixed(1)}], Im: [${minIm.toFixed(1)}, ${maxIm.toFixed(1)}]`,
    ...grid.map(row => row.join('')),
    '  → Re'
  ];

  return lines.join('\n');
}

export function isnyquistplotAvailable(): boolean { return true; }
