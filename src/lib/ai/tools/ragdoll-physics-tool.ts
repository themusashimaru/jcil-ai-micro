/**
 * RAGDOLL-PHYSICS TOOL
 * Comprehensive ragdoll physics simulation with multi-body dynamics
 * Features: joint constraints (ball, hinge, slider), collision detection,
 * impulse-based physics, angular limits, bone hierarchy, contact response
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// Type Definitions
// ============================================================================

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface Quaternion {
  w: number;
  x: number;
  y: number;
  z: number;
}

interface RigidBody {
  id: string;
  name: string;
  mass: number;
  inverseMass: number;
  position: Vector3;
  velocity: Vector3;
  angularVelocity: Vector3;
  orientation: Quaternion;
  force: Vector3;
  torque: Vector3;
  inertia: Vector3; // diagonal inertia tensor
  inverseInertia: Vector3;
  friction: number;
  restitution: number; // bounciness
  isStatic: boolean;
  shape: CollisionShape;
}

interface CollisionShape {
  type: 'sphere' | 'capsule' | 'box';
  radius?: number;
  halfExtents?: Vector3;
  height?: number; // for capsule
}

type JointType = 'ball' | 'hinge' | 'slider' | 'fixed';

interface Joint {
  id: string;
  type: JointType;
  bodyA: string;
  bodyB: string;
  anchorA: Vector3; // local space anchor on body A
  anchorB: Vector3; // local space anchor on body B
  axisA?: Vector3; // for hinge/slider
  axisB?: Vector3;
  limits?: {
    minAngle?: number;
    maxAngle?: number;
    minDistance?: number;
    maxDistance?: number;
  };
  stiffness: number;
  damping: number;
}

interface Contact {
  bodyA: string;
  bodyB: string;
  point: Vector3;
  normal: Vector3;
  penetration: number;
  restitution: number;
  friction: number;
}

interface BoneDefinition {
  name: string;
  parent?: string;
  mass: number;
  length: number;
  radius: number;
  localPosition: Vector3;
  localRotation?: Quaternion;
}

interface RagdollConfig {
  bones: BoneDefinition[];
  joints: {
    boneA: string;
    boneB: string;
    type: JointType;
    limits?: {
      minAngle?: number;
      maxAngle?: number;
    };
  }[];
}

interface RagdollState {
  bodies: Map<string, RigidBody>;
  joints: Joint[];
  time: number;
  gravity: Vector3;
  contacts: Contact[];
}

interface SimulationResult {
  frames: {
    time: number;
    bodies: { id: string; position: Vector3; orientation: Quaternion; velocity: Vector3 }[];
  }[];
  finalState: RagdollState;
  collisionCount: number;
  jointViolations: number;
}

// ============================================================================
// Constants
// ============================================================================

const GRAVITY = 9.80665;
const BAUMGARTE_FACTOR = 0.2; // Position correction factor
const PENETRATION_SLOP = 0.01; // Allowed penetration
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MAX_CONTACT_POINTS = 4;
const VELOCITY_THRESHOLD = 0.01;

// ============================================================================
// Vector3 Utilities
// ============================================================================

function vec3Zero(): Vector3 {
  return { x: 0, y: 0, z: 0 };
}

function vec3Add(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function vec3Sub(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function vec3Scale(v: Vector3, s: number): Vector3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function vec3Dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function vec3Cross(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function vec3Length(v: Vector3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

function vec3Normalize(v: Vector3): Vector3 {
  const len = vec3Length(v);
  if (len < 1e-10) return { x: 0, y: 0, z: 0 };
  return vec3Scale(v, 1 / len);
}

function vec3Negate(v: Vector3): Vector3 {
  return { x: -v.x, y: -v.y, z: -v.z };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function vec3Distance(a: Vector3, b: Vector3): number {
  return vec3Length(vec3Sub(a, b));
}

// ============================================================================
// Quaternion Utilities
// ============================================================================

function quatIdentity(): Quaternion {
  return { w: 1, x: 0, y: 0, z: 0 };
}

function quatMultiply(a: Quaternion, b: Quaternion): Quaternion {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
  };
}

function quatNormalize(q: Quaternion): Quaternion {
  const len = Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
  if (len < 1e-10) return quatIdentity();
  return { w: q.w / len, x: q.x / len, y: q.y / len, z: q.z / len };
}

function quatConjugate(q: Quaternion): Quaternion {
  return { w: q.w, x: -q.x, y: -q.y, z: -q.z };
}

function quatRotateVector(q: Quaternion, v: Vector3): Vector3 {
  // v' = q * v * q^-1
  const qv: Quaternion = { w: 0, x: v.x, y: v.y, z: v.z };
  const result = quatMultiply(quatMultiply(q, qv), quatConjugate(q));
  return { x: result.x, y: result.y, z: result.z };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function quatFromAxisAngle(axis: Vector3, angle: number): Quaternion {
  const halfAngle = angle * 0.5;
  const s = Math.sin(halfAngle);
  const normalized = vec3Normalize(axis);
  return quatNormalize({
    w: Math.cos(halfAngle),
    x: normalized.x * s,
    y: normalized.y * s,
    z: normalized.z * s
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function quatToMatrix3(q: Quaternion): number[][] {
  const { w, x, y, z } = q;
  return [
    [1 - 2*(y*y + z*z), 2*(x*y - w*z), 2*(x*z + w*y)],
    [2*(x*y + w*z), 1 - 2*(x*x + z*z), 2*(y*z - w*x)],
    [2*(x*z - w*y), 2*(y*z + w*x), 1 - 2*(x*x + y*y)]
  ];
}

// ============================================================================
// Rigid Body Creation
// ============================================================================

function createRigidBody(params: {
  id: string;
  name: string;
  mass: number;
  position: Vector3;
  shape: CollisionShape;
  isStatic?: boolean;
  friction?: number;
  restitution?: number;
}): RigidBody {
  const mass = params.isStatic ? Infinity : params.mass;
  const inverseMass = params.isStatic ? 0 : 1 / mass;

  // Calculate inertia tensor based on shape
  let inertia: Vector3;
  if (params.isStatic) {
    inertia = { x: Infinity, y: Infinity, z: Infinity };
  } else {
    switch (params.shape.type) {
      case 'sphere': {
        const r = params.shape.radius || 0.1;
        const I = 0.4 * mass * r * r;
        inertia = { x: I, y: I, z: I };
        break;
      }
      case 'capsule': {
        const r = params.shape.radius || 0.1;
        const h = params.shape.height || 0.5;
        // Approximation for capsule
        const cylinderI = (1/12) * mass * (3 * r * r + h * h);
        const sphereI = 0.4 * mass * r * r;
        inertia = { x: cylinderI, y: sphereI, z: cylinderI };
        break;
      }
      case 'box': {
        const e = params.shape.halfExtents || { x: 0.1, y: 0.1, z: 0.1 };
        inertia = {
          x: (1/12) * mass * (4 * e.y * e.y + 4 * e.z * e.z),
          y: (1/12) * mass * (4 * e.x * e.x + 4 * e.z * e.z),
          z: (1/12) * mass * (4 * e.x * e.x + 4 * e.y * e.y)
        };
        break;
      }
      default:
        const I = 0.4 * mass * 0.1 * 0.1;
        inertia = { x: I, y: I, z: I };
    }
  }

  const inverseInertia = params.isStatic ?
    { x: 0, y: 0, z: 0 } :
    { x: 1 / inertia.x, y: 1 / inertia.y, z: 1 / inertia.z };

  return {
    id: params.id,
    name: params.name,
    mass,
    inverseMass,
    position: { ...params.position },
    velocity: vec3Zero(),
    angularVelocity: vec3Zero(),
    orientation: quatIdentity(),
    force: vec3Zero(),
    torque: vec3Zero(),
    inertia,
    inverseInertia,
    friction: params.friction ?? 0.5,
    restitution: params.restitution ?? 0.3,
    isStatic: params.isStatic ?? false,
    shape: params.shape
  };
}

// ============================================================================
// Collision Detection
// ============================================================================

function getWorldPoint(body: RigidBody, localPoint: Vector3): Vector3 {
  const rotated = quatRotateVector(body.orientation, localPoint);
  return vec3Add(body.position, rotated);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getLocalPoint(body: RigidBody, worldPoint: Vector3): Vector3 {
  const relative = vec3Sub(worldPoint, body.position);
  return quatRotateVector(quatConjugate(body.orientation), relative);
}

function sphereVsSphere(a: RigidBody, b: RigidBody): Contact | null {
  const radiusA = a.shape.radius || 0.1;
  const radiusB = b.shape.radius || 0.1;

  const diff = vec3Sub(b.position, a.position);
  const dist = vec3Length(diff);
  const minDist = radiusA + radiusB;

  if (dist >= minDist) return null;

  const normal = dist > 1e-10 ? vec3Scale(diff, 1 / dist) : { x: 0, y: 1, z: 0 };
  const penetration = minDist - dist;
  const point = vec3Add(a.position, vec3Scale(normal, radiusA));

  return {
    bodyA: a.id,
    bodyB: b.id,
    point,
    normal,
    penetration,
    restitution: Math.min(a.restitution, b.restitution),
    friction: Math.sqrt(a.friction * b.friction)
  };
}

function capsuleVsCapsule(a: RigidBody, b: RigidBody): Contact | null {
  const radiusA = a.shape.radius || 0.1;
  const radiusB = b.shape.radius || 0.1;
  const heightA = a.shape.height || 0.5;
  const heightB = b.shape.height || 0.5;

  // Get capsule endpoints (along local Y axis)
  const halfHeightA = heightA * 0.5;
  const halfHeightB = heightB * 0.5;

  const axisA = quatRotateVector(a.orientation, { x: 0, y: 1, z: 0 });
  const axisB = quatRotateVector(b.orientation, { x: 0, y: 1, z: 0 });

  const p1A = vec3Add(a.position, vec3Scale(axisA, -halfHeightA));
  const p2A = vec3Add(a.position, vec3Scale(axisA, halfHeightA));
  const p1B = vec3Add(b.position, vec3Scale(axisB, -halfHeightB));
  const p2B = vec3Add(b.position, vec3Scale(axisB, halfHeightB));

  // Find closest points on line segments
  const d1 = vec3Sub(p2A, p1A);
  const d2 = vec3Sub(p2B, p1B);
  const r = vec3Sub(p1A, p1B);

  const a_ = vec3Dot(d1, d1);
  const e = vec3Dot(d2, d2);
  const f = vec3Dot(d2, r);

  let s = 0, t = 0;

  if (a_ > 1e-10 && e > 1e-10) {
    const b_ = vec3Dot(d1, d2);
    const c = vec3Dot(d1, r);
    const denom = a_ * e - b_ * b_;

    if (Math.abs(denom) > 1e-10) {
      s = Math.max(0, Math.min(1, (b_ * f - c * e) / denom));
    }

    t = (b_ * s + f) / e;

    if (t < 0) {
      t = 0;
      s = Math.max(0, Math.min(1, -c / a_));
    } else if (t > 1) {
      t = 1;
      s = Math.max(0, Math.min(1, (b_ - c) / a_));
    }
  }

  const closestA = vec3Add(p1A, vec3Scale(d1, s));
  const closestB = vec3Add(p1B, vec3Scale(d2, t));

  const diff = vec3Sub(closestB, closestA);
  const dist = vec3Length(diff);
  const minDist = radiusA + radiusB;

  if (dist >= minDist) return null;

  const normal = dist > 1e-10 ? vec3Scale(diff, 1 / dist) : { x: 0, y: 1, z: 0 };
  const penetration = minDist - dist;
  const point = vec3Add(closestA, vec3Scale(normal, radiusA));

  return {
    bodyA: a.id,
    bodyB: b.id,
    point,
    normal,
    penetration,
    restitution: Math.min(a.restitution, b.restitution),
    friction: Math.sqrt(a.friction * b.friction)
  };
}

function sphereVsPlane(sphere: RigidBody, planeY: number): Contact | null {
  const radius = sphere.shape.radius || 0.1;
  const dist = sphere.position.y - planeY;

  if (dist >= radius) return null;

  return {
    bodyA: sphere.id,
    bodyB: 'ground',
    point: { x: sphere.position.x, y: planeY, z: sphere.position.z },
    normal: { x: 0, y: 1, z: 0 },
    penetration: radius - dist,
    restitution: sphere.restitution * 0.8, // Ground restitution
    friction: sphere.friction
  };
}

function capsuleVsPlane(capsule: RigidBody, planeY: number): Contact | null {
  const radius = capsule.shape.radius || 0.1;
  const height = capsule.shape.height || 0.5;
  const halfHeight = height * 0.5;

  // Get capsule endpoints
  const axis = quatRotateVector(capsule.orientation, { x: 0, y: 1, z: 0 });
  const p1 = vec3Add(capsule.position, vec3Scale(axis, -halfHeight));
  const p2 = vec3Add(capsule.position, vec3Scale(axis, halfHeight));

  // Check both endpoints
  const dist1 = p1.y - planeY;
  const dist2 = p2.y - planeY;

  const minDist = Math.min(dist1, dist2);
  if (minDist >= radius) return null;

  const contactPoint = dist1 < dist2 ? p1 : p2;

  return {
    bodyA: capsule.id,
    bodyB: 'ground',
    point: { x: contactPoint.x, y: planeY, z: contactPoint.z },
    normal: { x: 0, y: 1, z: 0 },
    penetration: radius - minDist,
    restitution: capsule.restitution * 0.8,
    friction: capsule.friction
  };
}

function detectCollisions(state: RagdollState, groundLevel: number): Contact[] {
  const contacts: Contact[] = [];
  const bodies = Array.from(state.bodies.values());

  // Body vs body collisions
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];

      if (a.isStatic && b.isStatic) continue;

      let contact: Contact | null = null;

      if (a.shape.type === 'sphere' && b.shape.type === 'sphere') {
        contact = sphereVsSphere(a, b);
      } else if (a.shape.type === 'capsule' && b.shape.type === 'capsule') {
        contact = capsuleVsCapsule(a, b);
      } else if (a.shape.type === 'sphere' && b.shape.type === 'capsule') {
        // Treat sphere as capsule with 0 height
        const sphereAsCapsule = { ...a, shape: { ...a.shape, type: 'capsule' as const, height: 0 } };
        contact = capsuleVsCapsule(sphereAsCapsule, b);
      } else if (a.shape.type === 'capsule' && b.shape.type === 'sphere') {
        const sphereAsCapsule = { ...b, shape: { ...b.shape, type: 'capsule' as const, height: 0 } };
        contact = capsuleVsCapsule(a, sphereAsCapsule);
      }

      if (contact) contacts.push(contact);
    }
  }

  // Body vs ground collisions
  for (const body of bodies) {
    if (body.isStatic) continue;

    let contact: Contact | null = null;

    if (body.shape.type === 'sphere') {
      contact = sphereVsPlane(body, groundLevel);
    } else if (body.shape.type === 'capsule') {
      contact = capsuleVsPlane(body, groundLevel);
    }

    if (contact) contacts.push(contact);
  }

  return contacts;
}

// ============================================================================
// Constraint Solving
// ============================================================================

function getVelocityAtPoint(body: RigidBody, worldPoint: Vector3): Vector3 {
  const r = vec3Sub(worldPoint, body.position);
  return vec3Add(body.velocity, vec3Cross(body.angularVelocity, r));
}

function applyImpulse(body: RigidBody, impulse: Vector3, worldPoint: Vector3): void {
  if (body.isStatic) return;

  // Linear impulse
  body.velocity = vec3Add(body.velocity, vec3Scale(impulse, body.inverseMass));

  // Angular impulse
  const r = vec3Sub(worldPoint, body.position);
  const angularImpulse = vec3Cross(r, impulse);

  // Apply inverse inertia in world space (simplified - assuming diagonal inertia)
  body.angularVelocity = vec3Add(body.angularVelocity, {
    x: angularImpulse.x * body.inverseInertia.x,
    y: angularImpulse.y * body.inverseInertia.y,
    z: angularImpulse.z * body.inverseInertia.z
  });
}

function resolveContact(contact: Contact, state: RagdollState, dt: number): void {
  const bodyA = state.bodies.get(contact.bodyA);
  const bodyB = contact.bodyB === 'ground' ? null : state.bodies.get(contact.bodyB);

  if (!bodyA) return;

  const invMassA = bodyA.inverseMass;
  const invMassB = bodyB ? bodyB.inverseMass : 0;

  if (invMassA === 0 && invMassB === 0) return;

  // Calculate relative velocity at contact point
  const velA = getVelocityAtPoint(bodyA, contact.point);
  const velB = bodyB ? getVelocityAtPoint(bodyB, contact.point) : vec3Zero();
  const relativeVel = vec3Sub(velA, velB);

  const normalVel = vec3Dot(relativeVel, contact.normal);

  // Don't resolve if separating
  if (normalVel > 0) return;

  // Calculate impulse magnitude
  const rA = vec3Sub(contact.point, bodyA.position);
  const rB = bodyB ? vec3Sub(contact.point, bodyB.position) : vec3Zero();

  const rAxN = vec3Cross(rA, contact.normal);
  const rBxN = vec3Cross(rB, contact.normal);

  const angularTermA = vec3Dot(rAxN, {
    x: rAxN.x * bodyA.inverseInertia.x,
    y: rAxN.y * bodyA.inverseInertia.y,
    z: rAxN.z * bodyA.inverseInertia.z
  });

  let angularTermB = 0;
  if (bodyB) {
    angularTermB = vec3Dot(rBxN, {
      x: rBxN.x * bodyB.inverseInertia.x,
      y: rBxN.y * bodyB.inverseInertia.y,
      z: rBxN.z * bodyB.inverseInertia.z
    });
  }

  const effectiveMass = invMassA + invMassB + angularTermA + angularTermB;

  if (effectiveMass < 1e-10) return;

  // Baumgarte stabilization for penetration
  const biasFactor = BAUMGARTE_FACTOR / dt;
  const bias = biasFactor * Math.max(0, contact.penetration - PENETRATION_SLOP);

  // Normal impulse
  const e = contact.restitution;
  const j = -(1 + e) * normalVel + bias;
  const jn = j / effectiveMass;

  if (jn <= 0) return;

  const impulse = vec3Scale(contact.normal, jn);
  applyImpulse(bodyA, impulse, contact.point);
  if (bodyB) {
    applyImpulse(bodyB, vec3Negate(impulse), contact.point);
  }

  // Friction impulse
  const tangent = vec3Sub(relativeVel, vec3Scale(contact.normal, normalVel));
  const tangentLen = vec3Length(tangent);

  if (tangentLen > 1e-10) {
    const tangentDir = vec3Scale(tangent, 1 / tangentLen);
    const tangentVel = vec3Dot(relativeVel, tangentDir);

    // Coulomb friction
    const maxFriction = contact.friction * jn;
    const jt = Math.max(-maxFriction, Math.min(maxFriction, -tangentVel / effectiveMass));

    const frictionImpulse = vec3Scale(tangentDir, jt);
    applyImpulse(bodyA, frictionImpulse, contact.point);
    if (bodyB) {
      applyImpulse(bodyB, vec3Negate(frictionImpulse), contact.point);
    }
  }
}

function resolveJoint(joint: Joint, state: RagdollState, dt: number): number {
  const bodyA = state.bodies.get(joint.bodyA);
  const bodyB = state.bodies.get(joint.bodyB);

  if (!bodyA || !bodyB) return 0;

  let violation = 0;

  switch (joint.type) {
    case 'ball': {
      // Ball joint: anchor points must coincide
      const worldAnchorA = getWorldPoint(bodyA, joint.anchorA);
      const worldAnchorB = getWorldPoint(bodyB, joint.anchorB);

      const error = vec3Sub(worldAnchorB, worldAnchorA);
      const errorMag = vec3Length(error);
      violation = errorMag;

      if (errorMag > 1e-6) {
        const normal = vec3Scale(error, 1 / errorMag);

        // Calculate effective mass
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _rA = vec3Sub(worldAnchorA, bodyA.position);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _rB = vec3Sub(worldAnchorB, bodyB.position);

        const invMass = bodyA.inverseMass + bodyB.inverseMass;

        // Impulse to correct position error
        const biasFactor = joint.stiffness * BAUMGARTE_FACTOR / dt;
        const bias = biasFactor * errorMag;

        // Relative velocity at anchor points
        const velA = getVelocityAtPoint(bodyA, worldAnchorA);
        const velB = getVelocityAtPoint(bodyB, worldAnchorB);
        const relVel = vec3Dot(vec3Sub(velB, velA), normal);

        const lambda = (relVel + bias) / (invMass + 1e-10);
        const impulse = vec3Scale(normal, lambda);

        applyImpulse(bodyA, impulse, worldAnchorA);
        applyImpulse(bodyB, vec3Negate(impulse), worldAnchorB);
      }
      break;
    }

    case 'hinge': {
      // First, apply ball joint constraint
      const worldAnchorA = getWorldPoint(bodyA, joint.anchorA);
      const worldAnchorB = getWorldPoint(bodyB, joint.anchorB);

      const error = vec3Sub(worldAnchorB, worldAnchorA);
      const errorMag = vec3Length(error);
      violation = errorMag;

      if (errorMag > 1e-6) {
        const normal = vec3Scale(error, 1 / errorMag);
        const invMass = bodyA.inverseMass + bodyB.inverseMass;
        const biasFactor = joint.stiffness * BAUMGARTE_FACTOR / dt;
        const bias = biasFactor * errorMag;

        const velA = getVelocityAtPoint(bodyA, worldAnchorA);
        const velB = getVelocityAtPoint(bodyB, worldAnchorB);
        const relVel = vec3Dot(vec3Sub(velB, velA), normal);

        const lambda = (relVel + bias) / (invMass + 1e-10);
        const impulse = vec3Scale(normal, lambda);

        applyImpulse(bodyA, impulse, worldAnchorA);
        applyImpulse(bodyB, vec3Negate(impulse), worldAnchorB);
      }

      // Then, constrain rotation around hinge axis
      if (joint.axisA && joint.limits) {
        const worldAxisA = quatRotateVector(bodyA.orientation, joint.axisA);
        const worldAxisB = joint.axisB ?
          quatRotateVector(bodyB.orientation, joint.axisB) :
          worldAxisA;

        // Calculate angle between axes (simplified)
        const dot = vec3Dot(worldAxisA, worldAxisB);
        const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

        // Apply angular limits
        if (joint.limits.minAngle !== undefined && angle < joint.limits.minAngle) {
          violation += joint.limits.minAngle - angle;
        }
        if (joint.limits.maxAngle !== undefined && angle > joint.limits.maxAngle) {
          violation += angle - joint.limits.maxAngle;
        }
      }
      break;
    }

    case 'fixed': {
      // Fixed joint: both anchor and orientation must match
      const worldAnchorA = getWorldPoint(bodyA, joint.anchorA);
      const worldAnchorB = getWorldPoint(bodyB, joint.anchorB);

      const error = vec3Sub(worldAnchorB, worldAnchorA);
      const errorMag = vec3Length(error);
      violation = errorMag;

      if (errorMag > 1e-6) {
        const normal = vec3Scale(error, 1 / errorMag);
        const invMass = bodyA.inverseMass + bodyB.inverseMass;
        const lambda = errorMag * joint.stiffness / (invMass + 1e-10) / dt;
        const impulse = vec3Scale(normal, lambda);

        applyImpulse(bodyA, impulse, worldAnchorA);
        applyImpulse(bodyB, vec3Negate(impulse), worldAnchorB);
      }
      break;
    }

    case 'slider': {
      // Slider joint: constrain motion to axis
      if (!joint.axisA) break;

      const worldAnchorA = getWorldPoint(bodyA, joint.anchorA);
      const worldAnchorB = getWorldPoint(bodyB, joint.anchorB);
      const worldAxis = quatRotateVector(bodyA.orientation, joint.axisA);

      const diff = vec3Sub(worldAnchorB, worldAnchorA);

      // Project error perpendicular to axis
      const alongAxis = vec3Dot(diff, worldAxis);
      const perpError = vec3Sub(diff, vec3Scale(worldAxis, alongAxis));
      const perpErrorMag = vec3Length(perpError);
      violation = perpErrorMag;

      if (perpErrorMag > 1e-6) {
        const normal = vec3Scale(perpError, 1 / perpErrorMag);
        const invMass = bodyA.inverseMass + bodyB.inverseMass;
        const lambda = perpErrorMag * joint.stiffness / (invMass + 1e-10) / dt;
        const impulse = vec3Scale(normal, lambda);

        applyImpulse(bodyA, impulse, worldAnchorA);
        applyImpulse(bodyB, vec3Negate(impulse), worldAnchorB);
      }

      // Check distance limits
      if (joint.limits) {
        if (joint.limits.minDistance !== undefined && alongAxis < joint.limits.minDistance) {
          violation += joint.limits.minDistance - alongAxis;
        }
        if (joint.limits.maxDistance !== undefined && alongAxis > joint.limits.maxDistance) {
          violation += alongAxis - joint.limits.maxDistance;
        }
      }
      break;
    }
  }

  return violation;
}

// ============================================================================
// Integration
// ============================================================================

function integrateBody(body: RigidBody, dt: number, gravity: Vector3): void {
  if (body.isStatic) return;

  // Apply gravity
  const gravityForce = vec3Scale(gravity, body.mass);
  body.force = vec3Add(body.force, gravityForce);

  // Integrate velocity
  const linearAccel = vec3Scale(body.force, body.inverseMass);
  body.velocity = vec3Add(body.velocity, vec3Scale(linearAccel, dt));

  // Angular acceleration (simplified - diagonal inertia)
  const angularAccel = {
    x: body.torque.x * body.inverseInertia.x,
    y: body.torque.y * body.inverseInertia.y,
    z: body.torque.z * body.inverseInertia.z
  };
  body.angularVelocity = vec3Add(body.angularVelocity, vec3Scale(angularAccel, dt));

  // Apply damping
  body.velocity = vec3Scale(body.velocity, 0.999);
  body.angularVelocity = vec3Scale(body.angularVelocity, 0.995);

  // Integrate position
  body.position = vec3Add(body.position, vec3Scale(body.velocity, dt));

  // Integrate orientation
  const angVelQuat: Quaternion = {
    w: 0,
    x: body.angularVelocity.x * 0.5 * dt,
    y: body.angularVelocity.y * 0.5 * dt,
    z: body.angularVelocity.z * 0.5 * dt
  };
  const dq = quatMultiply(angVelQuat, body.orientation);
  body.orientation = quatNormalize({
    w: body.orientation.w + dq.w,
    x: body.orientation.x + dq.x,
    y: body.orientation.y + dq.y,
    z: body.orientation.z + dq.z
  });

  // Clear forces
  body.force = vec3Zero();
  body.torque = vec3Zero();
}

// ============================================================================
// Ragdoll Creation
// ============================================================================

const HUMANOID_CONFIG: RagdollConfig = {
  bones: [
    { name: 'pelvis', mass: 5, length: 0.15, radius: 0.1, localPosition: { x: 0, y: 1, z: 0 } },
    { name: 'spine', parent: 'pelvis', mass: 3, length: 0.2, radius: 0.08, localPosition: { x: 0, y: 0.175, z: 0 } },
    { name: 'chest', parent: 'spine', mass: 5, length: 0.25, radius: 0.12, localPosition: { x: 0, y: 0.225, z: 0 } },
    { name: 'head', parent: 'chest', mass: 4, length: 0.2, radius: 0.1, localPosition: { x: 0, y: 0.225, z: 0 } },
    { name: 'leftUpperArm', parent: 'chest', mass: 2, length: 0.25, radius: 0.04, localPosition: { x: -0.2, y: 0.1, z: 0 } },
    { name: 'leftForearm', parent: 'leftUpperArm', mass: 1.5, length: 0.22, radius: 0.035, localPosition: { x: 0, y: -0.235, z: 0 } },
    { name: 'rightUpperArm', parent: 'chest', mass: 2, length: 0.25, radius: 0.04, localPosition: { x: 0.2, y: 0.1, z: 0 } },
    { name: 'rightForearm', parent: 'rightUpperArm', mass: 1.5, length: 0.22, radius: 0.035, localPosition: { x: 0, y: -0.235, z: 0 } },
    { name: 'leftThigh', parent: 'pelvis', mass: 4, length: 0.4, radius: 0.06, localPosition: { x: -0.1, y: -0.275, z: 0 } },
    { name: 'leftCalf', parent: 'leftThigh', mass: 3, length: 0.38, radius: 0.05, localPosition: { x: 0, y: -0.39, z: 0 } },
    { name: 'rightThigh', parent: 'pelvis', mass: 4, length: 0.4, radius: 0.06, localPosition: { x: 0.1, y: -0.275, z: 0 } },
    { name: 'rightCalf', parent: 'rightThigh', mass: 3, length: 0.38, radius: 0.05, localPosition: { x: 0, y: -0.39, z: 0 } },
  ],
  joints: [
    { boneA: 'pelvis', boneB: 'spine', type: 'ball', limits: { minAngle: -0.3, maxAngle: 0.3 } },
    { boneA: 'spine', boneB: 'chest', type: 'ball', limits: { minAngle: -0.3, maxAngle: 0.3 } },
    { boneA: 'chest', boneB: 'head', type: 'ball', limits: { minAngle: -0.5, maxAngle: 0.5 } },
    { boneA: 'chest', boneB: 'leftUpperArm', type: 'ball', limits: { minAngle: -Math.PI, maxAngle: Math.PI } },
    { boneA: 'leftUpperArm', boneB: 'leftForearm', type: 'hinge', limits: { minAngle: 0, maxAngle: 2.5 } },
    { boneA: 'chest', boneB: 'rightUpperArm', type: 'ball', limits: { minAngle: -Math.PI, maxAngle: Math.PI } },
    { boneA: 'rightUpperArm', boneB: 'rightForearm', type: 'hinge', limits: { minAngle: 0, maxAngle: 2.5 } },
    { boneA: 'pelvis', boneB: 'leftThigh', type: 'ball', limits: { minAngle: -1.5, maxAngle: 1.5 } },
    { boneA: 'leftThigh', boneB: 'leftCalf', type: 'hinge', limits: { minAngle: 0, maxAngle: 2.5 } },
    { boneA: 'pelvis', boneB: 'rightThigh', type: 'ball', limits: { minAngle: -1.5, maxAngle: 1.5 } },
    { boneA: 'rightThigh', boneB: 'rightCalf', type: 'hinge', limits: { minAngle: 0, maxAngle: 2.5 } },
  ]
};

function createRagdoll(config: RagdollConfig, startPosition: Vector3): RagdollState {
  const bodies = new Map<string, RigidBody>();
  const joints: Joint[] = [];

  // Create bodies for each bone
  const bonePositions = new Map<string, Vector3>();

  for (const bone of config.bones) {
    let worldPos: Vector3;

    if (bone.parent) {
      const parentPos = bonePositions.get(bone.parent) || startPosition;
      worldPos = vec3Add(parentPos, bone.localPosition);
    } else {
      worldPos = vec3Add(startPosition, bone.localPosition);
    }

    bonePositions.set(bone.name, worldPos);

    const body = createRigidBody({
      id: bone.name,
      name: bone.name,
      mass: bone.mass,
      position: worldPos,
      shape: {
        type: 'capsule',
        radius: bone.radius,
        height: bone.length
      },
      friction: 0.5,
      restitution: 0.2
    });

    bodies.set(bone.name, body);
  }

  // Create joints
  for (const jointDef of config.joints) {
    const bodyA = bodies.get(jointDef.boneA);
    const bodyB = bodies.get(jointDef.boneB);

    if (!bodyA || !bodyB) continue;

    // Calculate anchor points (at the connection point between bones)
    const boneB = config.bones.find(b => b.name === jointDef.boneB);
    const anchorOffset = boneB?.localPosition || vec3Zero();

    joints.push({
      id: `${jointDef.boneA}_${jointDef.boneB}`,
      type: jointDef.type,
      bodyA: jointDef.boneA,
      bodyB: jointDef.boneB,
      anchorA: vec3Scale(anchorOffset, 0.5), // Halfway to child
      anchorB: vec3Scale(anchorOffset, -0.5), // From child's perspective
      axisA: { x: 0, y: 1, z: 0 },
      limits: jointDef.limits,
      stiffness: 0.8,
      damping: 0.1
    });
  }

  return {
    bodies,
    joints,
    time: 0,
    gravity: { x: 0, y: -GRAVITY, z: 0 },
    contacts: []
  };
}

// ============================================================================
// Simulation
// ============================================================================

function simulateRagdoll(params: {
  config?: RagdollConfig;
  startPosition?: Vector3;
  initialVelocity?: Vector3;
  duration: number;
  timestep: number;
  groundLevel?: number;
  iterations?: number;
}): SimulationResult {
  const config = params.config || HUMANOID_CONFIG;
  const startPos = params.startPosition || { x: 0, y: 2, z: 0 };
  const groundLevel = params.groundLevel ?? 0;
  const dt = params.timestep || 1/120;
  const iterations = params.iterations || 10;
  const steps = Math.floor(params.duration / dt);

  const state = createRagdoll(config, startPos);

  // Apply initial velocity
  if (params.initialVelocity) {
    for (const body of state.bodies.values()) {
      body.velocity = { ...params.initialVelocity };
    }
  }

  const frames: SimulationResult['frames'] = [];
  const recordInterval = Math.max(1, Math.floor(1/60 / dt)); // ~60 FPS

  let totalCollisions = 0;
  let totalViolations = 0;

  for (let step = 0; step < steps; step++) {
    // Integrate bodies
    for (const body of state.bodies.values()) {
      integrateBody(body, dt, state.gravity);
    }

    // Detect collisions
    state.contacts = detectCollisions(state, groundLevel);
    totalCollisions += state.contacts.length;

    // Solve constraints iteratively
    for (let iter = 0; iter < iterations; iter++) {
      // Resolve joints
      for (const joint of state.joints) {
        const violation = resolveJoint(joint, state, dt);
        if (iter === iterations - 1) {
          totalViolations += violation;
        }
      }

      // Resolve contacts
      for (const contact of state.contacts) {
        resolveContact(contact, state, dt);
      }
    }

    state.time += dt;

    // Record frame
    if (step % recordInterval === 0) {
      frames.push({
        time: state.time,
        bodies: Array.from(state.bodies.values()).map(b => ({
          id: b.id,
          position: { ...b.position },
          orientation: { ...b.orientation },
          velocity: { ...b.velocity }
        }))
      });
    }
  }

  return {
    frames,
    finalState: state,
    collisionCount: totalCollisions,
    jointViolations: totalViolations
  };
}

// ============================================================================
// Tool Definition and Execution
// ============================================================================

export const ragdollphysicsTool: UnifiedTool = {
  name: 'ragdoll_physics',
  description: 'Comprehensive ragdoll physics simulation with multi-body dynamics. Features joint constraints (ball, hinge, slider, fixed), collision detection, impulse-based physics, angular limits, bone hierarchy, and contact response.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['simulate', 'create_preset', 'analyze', 'info'],
        description: 'Operation type'
      },
      preset: {
        type: 'string',
        enum: ['humanoid', 'custom'],
        description: 'Ragdoll preset'
      },
      startPosition: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } }
      },
      initialVelocity: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' }, z: { type: 'number' } }
      },
      duration: { type: 'number', description: 'Simulation duration in seconds' },
      timestep: { type: 'number', description: 'Physics timestep (default: 1/120)' },
      groundLevel: { type: 'number', description: 'Y coordinate of ground plane' },
      iterations: { type: 'number', description: 'Constraint solver iterations per step' },
      customBones: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            parent: { type: 'string' },
            mass: { type: 'number' },
            length: { type: 'number' },
            radius: { type: 'number' },
            localPosition: { type: 'object' }
          }
        }
      },
      customJoints: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            boneA: { type: 'string' },
            boneB: { type: 'string' },
            type: { type: 'string', enum: ['ball', 'hinge', 'slider', 'fixed'] },
            limits: { type: 'object' }
          }
        }
      }
    },
    required: ['operation']
  }
};

export async function executeragdollphysics(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation } = args;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;

    switch (operation) {
      case 'simulate': {
        let config: RagdollConfig;
        if (args.preset === 'custom' && args.customBones && args.customJoints) {
          config = {
            bones: args.customBones,
            joints: args.customJoints
          };
        } else {
          config = HUMANOID_CONFIG;
        }

        result = simulateRagdoll({
          config,
          startPosition: args.startPosition,
          initialVelocity: args.initialVelocity,
          duration: args.duration || 3,
          timestep: args.timestep || 1/120,
          groundLevel: args.groundLevel,
          iterations: args.iterations
        });
        break;
      }

      case 'create_preset': {
        result = {
          humanoid: {
            bones: HUMANOID_CONFIG.bones,
            joints: HUMANOID_CONFIG.joints,
            totalMass: HUMANOID_CONFIG.bones.reduce((sum, b) => sum + b.mass, 0),
            boneCount: HUMANOID_CONFIG.bones.length,
            jointCount: HUMANOID_CONFIG.joints.length
          }
        };
        break;
      }

      case 'analyze': {
        const simResult = simulateRagdoll({
          startPosition: args.startPosition || { x: 0, y: 2, z: 0 },
          initialVelocity: args.initialVelocity,
          duration: args.duration || 3,
          timestep: args.timestep || 1/120,
          groundLevel: args.groundLevel ?? 0,
          iterations: args.iterations
        });

        const frames = simResult.frames;
        const pelvisTrajectory = frames.map(f => {
          const pelvis = f.bodies.find(b => b.id === 'pelvis');
          return pelvis ? pelvis.position : null;
        }).filter(p => p !== null);

        result = {
          simulationTime: frames[frames.length - 1]?.time || 0,
          frameCount: frames.length,
          collisionCount: simResult.collisionCount,
          jointViolations: simResult.jointViolations.toFixed(4),
          pelvisStartHeight: pelvisTrajectory[0]?.y || 0,
          pelvisEndHeight: pelvisTrajectory[pelvisTrajectory.length - 1]?.y || 0,
          pelvisLowestPoint: Math.min(...pelvisTrajectory.map(p => p!.y)),
          atRest: simResult.finalState.bodies.get('pelvis')?.velocity ?
            vec3Length(simResult.finalState.bodies.get('pelvis')!.velocity) < VELOCITY_THRESHOLD : false
        };
        break;
      }

      case 'info':
      default: {
        result = {
          description: 'Ragdoll physics simulation with multi-body dynamics',
          features: [
            'Impulse-based constraint solving',
            'Ball, hinge, slider, and fixed joints',
            'Angular joint limits',
            'Sphere and capsule collision shapes',
            'Ground plane collision',
            'Body-to-body collision',
            'Friction and restitution',
            'Baumgarte stabilization',
            'Humanoid preset with 12 bones'
          ],
          jointTypes: {
            ball: 'Free rotation in all axes (e.g., shoulder)',
            hinge: 'Single axis rotation (e.g., elbow, knee)',
            slider: 'Linear motion along axis',
            fixed: 'No relative motion allowed'
          },
          presets: ['humanoid'],
          physicsConstants: {
            gravity: GRAVITY,
            baumgarteFactor: BAUMGARTE_FACTOR,
            penetrationSlop: PENETRATION_SLOP
          },
          operations: ['simulate', 'create_preset', 'analyze', 'info']
        };
      }
    }

    return { toolCallId: id, content: JSON.stringify(result, null, 2) };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Unknown error';
    return { toolCallId: id, content: 'Error: ' + err, isError: true };
  }
}

export function isragdollphysicsAvailable(): boolean { return true; }
