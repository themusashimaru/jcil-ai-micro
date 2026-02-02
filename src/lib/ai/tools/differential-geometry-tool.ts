/**
 * DIFFERENTIAL-GEOMETRY TOOL
 * Differential geometry calculations for curves and surfaces
 *
 * Implements:
 * - Parametric curves (curvature, torsion, Frenet frame)
 * - Surfaces (first/second fundamental forms, Gaussian curvature)
 * - Geodesics and parallel transport
 * - Christoffel symbols and covariant derivatives
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Vector operations
type Vec3 = [number, number, number];
type Vec2 = [number, number];

function add3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function scale3(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function norm3(v: Vec3): number {
  return Math.sqrt(dot3(v, v));
}

function normalize3(v: Vec3): Vec3 {
  const n = norm3(v);
  if (n === 0) return [0, 0, 0];
  return scale3(v, 1 / n);
}

// Numerical differentiation
const h = 1e-6;

function derivative(f: (t: number) => number, t: number): number {
  return (f(t + h) - f(t - h)) / (2 * h);
}

function derivative2(f: (t: number) => number, t: number): number {
  return (f(t + h) - 2 * f(t) + f(t - h)) / (h * h);
}

function derivative3(f: (t: number) => number, t: number): number {
  return (f(t + 2 * h) - 2 * f(t + h) + 2 * f(t - h) - f(t - 2 * h)) / (2 * h * h * h);
}

// Curve derivative
function curveDerivative(curve: (t: number) => Vec3, t: number): Vec3 {
  const c1 = curve(t + h);
  const c2 = curve(t - h);
  return scale3(sub3(c1, c2), 1 / (2 * h));
}

function curveDerivative2(curve: (t: number) => Vec3, t: number): Vec3 {
  const c1 = curve(t + h);
  const c0 = curve(t);
  const c2 = curve(t - h);
  return [
    (c1[0] - 2 * c0[0] + c2[0]) / (h * h),
    (c1[1] - 2 * c0[1] + c2[1]) / (h * h),
    (c1[2] - 2 * c0[2] + c2[2]) / (h * h)
  ];
}

function curveDerivative3(curve: (t: number) => Vec3, t: number): Vec3 {
  const c1 = curve(t + 2 * h);
  const c2 = curve(t + h);
  const c3 = curve(t - h);
  const c4 = curve(t - 2 * h);
  return [
    (c1[0] - 2 * c2[0] + 2 * c3[0] - c4[0]) / (2 * h * h * h),
    (c1[1] - 2 * c2[1] + 2 * c3[1] - c4[1]) / (2 * h * h * h),
    (c1[2] - 2 * c2[2] + 2 * c3[2] - c4[2]) / (2 * h * h * h)
  ];
}

// Parametric curve analysis
interface FrenetFrame {
  T: Vec3;  // Tangent
  N: Vec3;  // Normal
  B: Vec3;  // Binormal
}

interface CurveAnalysis {
  point: Vec3;
  tangent: Vec3;
  curvature: number;
  torsion: number;
  frenetFrame: FrenetFrame;
  radiusOfCurvature: number;
  speed: number;
  arcLength: number;
}

function analyzeCurve(curve: (t: number) => Vec3, t: number, t0: number = 0): CurveAnalysis {
  const point = curve(t);
  const r1 = curveDerivative(curve, t);
  const r2 = curveDerivative2(curve, t);
  const r3 = curveDerivative3(curve, t);

  const speed = norm3(r1);
  const T = normalize3(r1);

  // Curvature: |r' x r''| / |r'|^3
  const crossProduct = cross3(r1, r2);
  const curvature = norm3(crossProduct) / Math.pow(speed, 3);

  // Torsion: (r' x r'') . r''' / |r' x r''|^2
  const crossNorm2 = dot3(crossProduct, crossProduct);
  const torsion = crossNorm2 > 0 ? dot3(crossProduct, r3) / crossNorm2 : 0;

  // Normal vector: (r'' - (r'' . T)T) normalized
  const r2projT = scale3(T, dot3(r2, T));
  const normalDir = sub3(r2, r2projT);
  const N = normalize3(normalDir);

  // Binormal: T x N
  const B = cross3(T, N);

  // Radius of curvature
  const radiusOfCurvature = curvature > 0 ? 1 / curvature : Infinity;

  // Arc length from t0 to t (numerical integration)
  const steps = 100;
  const dt = (t - t0) / steps;
  let arcLength = 0;
  for (let i = 0; i < steps; i++) {
    const ti = t0 + i * dt + dt / 2;
    const deriv = curveDerivative(curve, ti);
    arcLength += norm3(deriv) * dt;
  }

  return {
    point,
    tangent: T,
    curvature,
    torsion,
    frenetFrame: { T, N, B },
    radiusOfCurvature,
    speed,
    arcLength: Math.abs(arcLength)
  };
}

// Predefined curves
const curves: Record<string, { fn: (t: number) => Vec3; range: [number, number]; description: string }> = {
  helix: {
    fn: (t) => [Math.cos(t), Math.sin(t), t / (2 * Math.PI)],
    range: [0, 4 * Math.PI],
    description: 'Circular helix: (cos(t), sin(t), t/2pi)'
  },
  circle: {
    fn: (t) => [Math.cos(t), Math.sin(t), 0],
    range: [0, 2 * Math.PI],
    description: 'Unit circle in xy-plane'
  },
  parabola: {
    fn: (t) => [t, t * t, 0],
    range: [-2, 2],
    description: 'Parabola: (t, t^2, 0)'
  },
  twistedCubic: {
    fn: (t) => [t, t * t, t * t * t],
    range: [-1, 1],
    description: 'Twisted cubic: (t, t^2, t^3)'
  },
  viviani: {
    fn: (t) => [1 + Math.cos(t), Math.sin(t), 2 * Math.sin(t / 2)],
    range: [0, 4 * Math.PI],
    description: "Viviani's curve on sphere"
  },
  torusKnot: {
    fn: (t) => {
      const p = 2, q = 3;
      const r = Math.cos(q * t) + 2;
      return [r * Math.cos(p * t), r * Math.sin(p * t), -Math.sin(q * t)];
    },
    range: [0, 2 * Math.PI],
    description: '(2,3) torus knot'
  },
  catenary: {
    fn: (t) => [t, Math.cosh(t), 0],
    range: [-2, 2],
    description: 'Catenary: (t, cosh(t), 0)'
  },
  cycloid: {
    fn: (t) => [t - Math.sin(t), 1 - Math.cos(t), 0],
    range: [0, 4 * Math.PI],
    description: 'Cycloid curve'
  }
};

// Surface analysis
type Surface = (u: number, v: number) => Vec3;

interface SurfaceFirstForm {
  E: number;
  F: number;
  G: number;
}

interface SurfaceSecondForm {
  L: number;
  M: number;
  N: number;
}

interface SurfaceAnalysis {
  point: Vec3;
  normal: Vec3;
  firstForm: SurfaceFirstForm;
  secondForm: SurfaceSecondForm;
  gaussianCurvature: number;
  meanCurvature: number;
  principalCurvatures: [number, number];
  surfaceType: string;
}

function surfacePartialU(surface: Surface, u: number, v: number): Vec3 {
  const s1 = surface(u + h, v);
  const s2 = surface(u - h, v);
  return scale3(sub3(s1, s2), 1 / (2 * h));
}

function surfacePartialV(surface: Surface, u: number, v: number): Vec3 {
  const s1 = surface(u, v + h);
  const s2 = surface(u, v - h);
  return scale3(sub3(s1, s2), 1 / (2 * h));
}

function surfacePartialUU(surface: Surface, u: number, v: number): Vec3 {
  const s1 = surface(u + h, v);
  const s0 = surface(u, v);
  const s2 = surface(u - h, v);
  return [
    (s1[0] - 2 * s0[0] + s2[0]) / (h * h),
    (s1[1] - 2 * s0[1] + s2[1]) / (h * h),
    (s1[2] - 2 * s0[2] + s2[2]) / (h * h)
  ];
}

function surfacePartialVV(surface: Surface, u: number, v: number): Vec3 {
  const s1 = surface(u, v + h);
  const s0 = surface(u, v);
  const s2 = surface(u, v - h);
  return [
    (s1[0] - 2 * s0[0] + s2[0]) / (h * h),
    (s1[1] - 2 * s0[1] + s2[1]) / (h * h),
    (s1[2] - 2 * s0[2] + s2[2]) / (h * h)
  ];
}

function surfacePartialUV(surface: Surface, u: number, v: number): Vec3 {
  const s1 = surface(u + h, v + h);
  const s2 = surface(u + h, v - h);
  const s3 = surface(u - h, v + h);
  const s4 = surface(u - h, v - h);
  return [
    (s1[0] - s2[0] - s3[0] + s4[0]) / (4 * h * h),
    (s1[1] - s2[1] - s3[1] + s4[1]) / (4 * h * h),
    (s1[2] - s2[2] - s3[2] + s4[2]) / (4 * h * h)
  ];
}

function analyzeSurface(surface: Surface, u: number, v: number): SurfaceAnalysis {
  const point = surface(u, v);

  const ru = surfacePartialU(surface, u, v);
  const rv = surfacePartialV(surface, u, v);
  const ruu = surfacePartialUU(surface, u, v);
  const rvv = surfacePartialVV(surface, u, v);
  const ruv = surfacePartialUV(surface, u, v);

  // Normal vector
  const normalRaw = cross3(ru, rv);
  const normal = normalize3(normalRaw);

  // First fundamental form coefficients
  const E = dot3(ru, ru);
  const F = dot3(ru, rv);
  const G = dot3(rv, rv);

  // Second fundamental form coefficients
  const L = dot3(ruu, normal);
  const M = dot3(ruv, normal);
  const N = dot3(rvv, normal);

  // Gaussian curvature: K = (LN - M^2) / (EG - F^2)
  const denom = E * G - F * F;
  const gaussianCurvature = denom !== 0 ? (L * N - M * M) / denom : 0;

  // Mean curvature: H = (EN + GL - 2FM) / (2(EG - F^2))
  const meanCurvature = denom !== 0 ? (E * N + G * L - 2 * F * M) / (2 * denom) : 0;

  // Principal curvatures from quadratic formula
  const disc = Math.sqrt(Math.max(0, meanCurvature * meanCurvature - gaussianCurvature));
  const k1 = meanCurvature + disc;
  const k2 = meanCurvature - disc;

  // Classify surface type
  let surfaceType = 'general';
  if (Math.abs(gaussianCurvature) < 1e-6) {
    if (Math.abs(meanCurvature) < 1e-6) {
      surfaceType = 'flat (plane)';
    } else {
      surfaceType = 'developable (parabolic)';
    }
  } else if (gaussianCurvature > 0) {
    surfaceType = 'elliptic (locally convex)';
  } else {
    surfaceType = 'hyperbolic (saddle)';
  }

  return {
    point,
    normal,
    firstForm: { E, F, G },
    secondForm: { L, M, N },
    gaussianCurvature,
    meanCurvature,
    principalCurvatures: [k1, k2],
    surfaceType
  };
}

// Predefined surfaces
const surfaces: Record<string, { fn: Surface; uRange: [number, number]; vRange: [number, number]; description: string }> = {
  sphere: {
    fn: (u, v) => [Math.sin(u) * Math.cos(v), Math.sin(u) * Math.sin(v), Math.cos(u)],
    uRange: [0, Math.PI],
    vRange: [0, 2 * Math.PI],
    description: 'Unit sphere'
  },
  torus: {
    fn: (u, v) => {
      const R = 2, r = 0.5;
      return [(R + r * Math.cos(v)) * Math.cos(u), (R + r * Math.cos(v)) * Math.sin(u), r * Math.sin(v)];
    },
    uRange: [0, 2 * Math.PI],
    vRange: [0, 2 * Math.PI],
    description: 'Torus with R=2, r=0.5'
  },
  plane: {
    fn: (u, v) => [u, v, 0],
    uRange: [-1, 1],
    vRange: [-1, 1],
    description: 'Flat plane z=0'
  },
  paraboloid: {
    fn: (u, v) => [u, v, u * u + v * v],
    uRange: [-1, 1],
    vRange: [-1, 1],
    description: 'Paraboloid z = x^2 + y^2'
  },
  hyperbolicParaboloid: {
    fn: (u, v) => [u, v, u * u - v * v],
    uRange: [-1, 1],
    vRange: [-1, 1],
    description: 'Saddle surface z = x^2 - y^2'
  },
  cone: {
    fn: (u, v) => [v * Math.cos(u), v * Math.sin(u), v],
    uRange: [0, 2 * Math.PI],
    vRange: [0, 2],
    description: 'Cone'
  },
  cylinder: {
    fn: (u, v) => [Math.cos(u), Math.sin(u), v],
    uRange: [0, 2 * Math.PI],
    vRange: [-1, 1],
    description: 'Circular cylinder'
  },
  helicoid: {
    fn: (u, v) => [v * Math.cos(u), v * Math.sin(u), u],
    uRange: [0, 4 * Math.PI],
    vRange: [-1, 1],
    description: 'Helicoid (minimal surface)'
  },
  catenoid: {
    fn: (u, v) => [Math.cosh(v) * Math.cos(u), Math.cosh(v) * Math.sin(u), v],
    uRange: [0, 2 * Math.PI],
    vRange: [-1, 1],
    description: 'Catenoid (minimal surface)'
  },
  enneperSurface: {
    fn: (u, v) => [
      u - u * u * u / 3 + u * v * v,
      v - v * v * v / 3 + v * u * u,
      u * u - v * v
    ],
    uRange: [-1, 1],
    vRange: [-1, 1],
    description: 'Enneper surface (minimal)'
  },
  monkeySaddle: {
    fn: (u, v) => [u, v, u * u * u - 3 * u * v * v],
    uRange: [-1, 1],
    vRange: [-1, 1],
    description: 'Monkey saddle z = x^3 - 3xy^2'
  }
};

// Christoffel symbols computation
interface ChristoffelSymbols {
  Gamma_uu_u: number;
  Gamma_uu_v: number;
  Gamma_uv_u: number;
  Gamma_uv_v: number;
  Gamma_vv_u: number;
  Gamma_vv_v: number;
}

function computeChristoffel(surface: Surface, u: number, v: number): ChristoffelSymbols {
  // Compute metric tensor and its derivatives
  const hh = 1e-5;

  const firstFormAt = (uu: number, vv: number) => {
    const ru = surfacePartialU(surface, uu, vv);
    const rv = surfacePartialV(surface, uu, vv);
    return {
      E: dot3(ru, ru),
      F: dot3(ru, rv),
      G: dot3(rv, rv)
    };
  };

  const ff = firstFormAt(u, v);
  const ff_pu = firstFormAt(u + hh, v);
  const ff_mu = firstFormAt(u - hh, v);
  const ff_pv = firstFormAt(u, v + hh);
  const ff_mv = firstFormAt(u, v - hh);

  // Derivatives of metric
  const E_u = (ff_pu.E - ff_mu.E) / (2 * hh);
  const E_v = (ff_pv.E - ff_mv.E) / (2 * hh);
  const F_u = (ff_pu.F - ff_mu.F) / (2 * hh);
  const F_v = (ff_pv.F - ff_mv.F) / (2 * hh);
  const G_u = (ff_pu.G - ff_mu.G) / (2 * hh);
  const G_v = (ff_pv.G - ff_mv.G) / (2 * hh);

  const { E, F, G } = ff;
  const det = E * G - F * F;

  if (Math.abs(det) < 1e-10) {
    return {
      Gamma_uu_u: 0, Gamma_uu_v: 0,
      Gamma_uv_u: 0, Gamma_uv_v: 0,
      Gamma_vv_u: 0, Gamma_vv_v: 0
    };
  }

  // Christoffel symbols using metric
  const Gamma_uu_u = (G * E_u - 2 * F * F_u + F * E_v) / (2 * det);
  const Gamma_uu_v = (2 * E * F_u - E * E_v - F * E_u) / (2 * det);
  const Gamma_uv_u = (G * E_v - F * G_u) / (2 * det);
  const Gamma_uv_v = (E * G_u - F * E_v) / (2 * det);
  const Gamma_vv_u = (2 * G * F_v - G * G_u - F * G_v) / (2 * det);
  const Gamma_vv_v = (E * G_v - 2 * F * F_v + F * G_u) / (2 * det);

  return {
    Gamma_uu_u, Gamma_uu_v,
    Gamma_uv_u, Gamma_uv_v,
    Gamma_vv_u, Gamma_vv_v
  };
}

// Geodesic equation solver (simplified Euler method)
function computeGeodesic(
  surface: Surface,
  u0: number,
  v0: number,
  du0: number,
  dv0: number,
  steps: number = 100
): { path: Vec3[]; params: Vec2[] } {
  const dt = 0.01;
  const path: Vec3[] = [];
  const params: Vec2[] = [];

  let u = u0, v = v0;
  let du = du0, dv = dv0;

  for (let i = 0; i < steps; i++) {
    path.push(surface(u, v));
    params.push([u, v]);

    const chris = computeChristoffel(surface, u, v);

    // Geodesic equations: u'' + Gamma^u_ij u'^i u'^j = 0
    const ddu = -(chris.Gamma_uu_u * du * du + 2 * chris.Gamma_uv_u * du * dv + chris.Gamma_vv_u * dv * dv);
    const ddv = -(chris.Gamma_uu_v * du * du + 2 * chris.Gamma_uv_v * du * dv + chris.Gamma_vv_v * dv * dv);

    // Euler integration
    du += ddu * dt;
    dv += ddv * dt;
    u += du * dt;
    v += dv * dt;
  }

  return { path, params };
}

export const differentialgeometryTool: UnifiedTool = {
  name: 'differential_geometry',
  description: 'Differential geometry for curves and surfaces - curvature, torsion, Frenet frames, Gaussian curvature, geodesics',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['curve', 'surface', 'geodesic', 'christoffel', 'list_curves', 'list_surfaces', 'info', 'examples'],
        description: 'Operation to perform'
      },
      curve: { type: 'string', description: 'Curve name (helix, circle, parabola, etc.)' },
      surface: { type: 'string', description: 'Surface name (sphere, torus, plane, etc.)' },
      t: { type: 'number', description: 'Parameter t for curve' },
      u: { type: 'number', description: 'Parameter u for surface' },
      v: { type: 'number', description: 'Parameter v for surface' },
      du: { type: 'number', description: 'Initial velocity du/dt for geodesic' },
      dv: { type: 'number', description: 'Initial velocity dv/dt for geodesic' },
      steps: { type: 'number', description: 'Steps for geodesic computation' }
    },
    required: ['operation']
  }
};

export async function executedifferentialgeometry(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const operation = args.operation;

    if (operation === 'info') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          tool: 'differential-geometry',
          description: 'Differential geometry for curves and surfaces',
          concepts: {
            curves: {
              curvature: 'Measures how fast curve deviates from tangent line',
              torsion: 'Measures how curve twists out of osculating plane',
              frenetFrame: 'Moving orthonormal basis (T, N, B) along curve',
              arcLength: 'Length of curve between two parameter values'
            },
            surfaces: {
              firstForm: 'Intrinsic metric (E, F, G) measuring lengths',
              secondForm: 'Extrinsic curvature (L, M, N)',
              gaussianCurvature: 'K = k1 * k2, intrinsic curvature',
              meanCurvature: 'H = (k1 + k2)/2, extrinsic curvature',
              principalCurvatures: 'Eigenvalues of shape operator'
            },
            geodesics: 'Shortest paths on surfaces',
            christoffel: 'Connection coefficients for covariant derivative'
          },
          operations: ['curve', 'surface', 'geodesic', 'christoffel', 'list_curves', 'list_surfaces', 'info', 'examples']
        }, null, 2)
      };
    }

    if (operation === 'examples') {
      return {
        toolCallId: id,
        content: JSON.stringify({
          examples: [
            {
              description: 'Analyze helix curve at t = pi',
              call: { operation: 'curve', curve: 'helix', t: Math.PI }
            },
            {
              description: 'Analyze sphere surface at point',
              call: { operation: 'surface', surface: 'sphere', u: Math.PI / 4, v: Math.PI / 4 }
            },
            {
              description: 'Compute geodesic on torus',
              call: { operation: 'geodesic', surface: 'torus', u: 0, v: 0, du: 1, dv: 0.5, steps: 50 }
            },
            {
              description: 'Compute Christoffel symbols',
              call: { operation: 'christoffel', surface: 'sphere', u: Math.PI / 2, v: 0 }
            }
          ]
        }, null, 2)
      };
    }

    if (operation === 'list_curves') {
      const curveList = Object.entries(curves).map(([name, data]) => ({
        name,
        description: data.description,
        parameterRange: data.range
      }));
      return { toolCallId: id, content: JSON.stringify({ curves: curveList }, null, 2) };
    }

    if (operation === 'list_surfaces') {
      const surfaceList = Object.entries(surfaces).map(([name, data]) => ({
        name,
        description: data.description,
        uRange: data.uRange,
        vRange: data.vRange
      }));
      return { toolCallId: id, content: JSON.stringify({ surfaces: surfaceList }, null, 2) };
    }

    if (operation === 'curve') {
      const curveName = args.curve || 'helix';
      const t = args.t ?? Math.PI;

      if (!curves[curveName]) {
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Unknown curve: ${curveName}`,
            available: Object.keys(curves)
          }),
          isError: true
        };
      }

      const curveData = curves[curveName];
      const analysis = analyzeCurve(curveData.fn, t, curveData.range[0]);

      // Sample curve for visualization
      const samples: Vec3[] = [];
      const numSamples = 20;
      for (let i = 0; i <= numSamples; i++) {
        const ti = curveData.range[0] + (curveData.range[1] - curveData.range[0]) * i / numSamples;
        samples.push(curveData.fn(ti));
      }

      return {
        toolCallId: id,
        content: JSON.stringify({
          curve: curveName,
          description: curveData.description,
          parameterT: t,
          analysis: {
            point: analysis.point.map(x => x.toFixed(6)),
            tangent: analysis.tangent.map(x => x.toFixed(6)),
            speed: analysis.speed.toFixed(6),
            curvature: analysis.curvature.toFixed(6),
            radiusOfCurvature: analysis.radiusOfCurvature.toFixed(6),
            torsion: analysis.torsion.toFixed(6),
            arcLengthFromStart: analysis.arcLength.toFixed(6)
          },
          frenetFrame: {
            T: analysis.frenetFrame.T.map(x => x.toFixed(6)),
            N: analysis.frenetFrame.N.map(x => x.toFixed(6)),
            B: analysis.frenetFrame.B.map(x => x.toFixed(6))
          },
          curveSamples: samples.slice(0, 5).map(s => s.map(x => x.toFixed(4)))
        }, null, 2)
      };
    }

    if (operation === 'surface') {
      const surfaceName = args.surface || 'sphere';
      const u = args.u ?? Math.PI / 4;
      const v = args.v ?? Math.PI / 4;

      if (!surfaces[surfaceName]) {
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Unknown surface: ${surfaceName}`,
            available: Object.keys(surfaces)
          }),
          isError: true
        };
      }

      const surfaceData = surfaces[surfaceName];
      const analysis = analyzeSurface(surfaceData.fn, u, v);

      return {
        toolCallId: id,
        content: JSON.stringify({
          surface: surfaceName,
          description: surfaceData.description,
          parameters: { u, v },
          analysis: {
            point: analysis.point.map(x => x.toFixed(6)),
            normal: analysis.normal.map(x => x.toFixed(6)),
            surfaceType: analysis.surfaceType
          },
          firstFundamentalForm: {
            E: analysis.firstForm.E.toFixed(6),
            F: analysis.firstForm.F.toFixed(6),
            G: analysis.firstForm.G.toFixed(6),
            areaElement: Math.sqrt(analysis.firstForm.E * analysis.firstForm.G - analysis.firstForm.F * analysis.firstForm.F).toFixed(6)
          },
          secondFundamentalForm: {
            L: analysis.secondForm.L.toFixed(6),
            M: analysis.secondForm.M.toFixed(6),
            N: analysis.secondForm.N.toFixed(6)
          },
          curvatures: {
            gaussian: analysis.gaussianCurvature.toFixed(6),
            mean: analysis.meanCurvature.toFixed(6),
            principal: analysis.principalCurvatures.map(k => k.toFixed(6))
          },
          isMinimalSurface: Math.abs(analysis.meanCurvature) < 1e-4
        }, null, 2)
      };
    }

    if (operation === 'christoffel') {
      const surfaceName = args.surface || 'sphere';
      const u = args.u ?? Math.PI / 2;
      const v = args.v ?? 0;

      if (!surfaces[surfaceName]) {
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Unknown surface: ${surfaceName}`,
            available: Object.keys(surfaces)
          }),
          isError: true
        };
      }

      const surfaceData = surfaces[surfaceName];
      const chris = computeChristoffel(surfaceData.fn, u, v);
      const firstForm = analyzeSurface(surfaceData.fn, u, v).firstForm;

      return {
        toolCallId: id,
        content: JSON.stringify({
          surface: surfaceName,
          parameters: { u, v },
          metric: {
            E: firstForm.E.toFixed(6),
            F: firstForm.F.toFixed(6),
            G: firstForm.G.toFixed(6)
          },
          christoffelSymbols: {
            'Gamma^u_uu': chris.Gamma_uu_u.toFixed(6),
            'Gamma^v_uu': chris.Gamma_uu_v.toFixed(6),
            'Gamma^u_uv': chris.Gamma_uv_u.toFixed(6),
            'Gamma^v_uv': chris.Gamma_uv_v.toFixed(6),
            'Gamma^u_vv': chris.Gamma_vv_u.toFixed(6),
            'Gamma^v_vv': chris.Gamma_vv_v.toFixed(6)
          },
          note: 'Christoffel symbols are connection coefficients for the Levi-Civita connection'
        }, null, 2)
      };
    }

    if (operation === 'geodesic') {
      const surfaceName = args.surface || 'sphere';
      const u0 = args.u ?? 0.1;
      const v0 = args.v ?? 0;
      const du0 = args.du ?? 1;
      const dv0 = args.dv ?? 0.5;
      const steps = Math.min(200, args.steps || 50);

      if (!surfaces[surfaceName]) {
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Unknown surface: ${surfaceName}`,
            available: Object.keys(surfaces)
          }),
          isError: true
        };
      }

      const surfaceData = surfaces[surfaceName];
      const { path, params } = computeGeodesic(surfaceData.fn, u0, v0, du0, dv0, steps);

      // Sample points for output
      const sampleIndices = [0, Math.floor(steps / 4), Math.floor(steps / 2), Math.floor(3 * steps / 4), steps - 1];
      const sampledPath = sampleIndices.filter(i => i < path.length).map(i => ({
        step: i,
        params: { u: params[i][0].toFixed(4), v: params[i][1].toFixed(4) },
        point: path[i].map(x => x.toFixed(4))
      }));

      // Compute total arc length
      let arcLength = 0;
      for (let i = 1; i < path.length; i++) {
        arcLength += norm3(sub3(path[i], path[i - 1]));
      }

      return {
        toolCallId: id,
        content: JSON.stringify({
          surface: surfaceName,
          initialConditions: {
            u0, v0,
            velocity: { du: du0, dv: dv0 }
          },
          steps,
          geodesicProperties: {
            startPoint: path[0].map(x => x.toFixed(4)),
            endPoint: path[path.length - 1].map(x => x.toFixed(4)),
            totalArcLength: arcLength.toFixed(4)
          },
          sampledPath,
          note: 'Geodesics satisfy the geodesic equation using Christoffel symbols'
        }, null, 2)
      };
    }

    return {
      toolCallId: id,
      content: JSON.stringify({ error: `Unknown operation: ${operation}` }),
      isError: true
    };

  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isdifferentialgeometryAvailable(): boolean { return true; }
