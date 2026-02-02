/**
 * MOTION-PLANNING TOOL
 * Motion planning algorithms including RRT, RRT*, PRM, A*, and potential fields
 * For robot path planning in configuration space
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Point2D {
  x: number;
  y: number;
}

interface Pose2D extends Point2D {
  theta?: number;  // Optional orientation
}

interface Obstacle {
  type: 'circle' | 'rectangle' | 'polygon';
  center?: Point2D;
  radius?: number;
  width?: number;
  height?: number;
  angle?: number;
  vertices?: Point2D[];
}

interface ConfigSpace {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  obstacles: Obstacle[];
}

interface TreeNode {
  id: number;
  position: Point2D;
  parent: number | null;
  cost: number;
  children: number[];
}

interface RoadmapNode {
  id: number;
  position: Point2D;
  neighbors: number[];
}

interface PlanningResult {
  path: Point2D[];
  pathLength: number;
  nodesExplored: number;
  planningTime: number;
  success: boolean;
}

interface GridCell {
  x: number;
  y: number;
  g: number;  // Cost from start
  h: number;  // Heuristic to goal
  f: number;  // Total cost
  parent: GridCell | null;
  walkable: boolean;
}

// ============================================================================
// COLLISION DETECTION
// ============================================================================

class CollisionChecker {
  private obstacles: Obstacle[];
  private resolution: number;

  constructor(obstacles: Obstacle[], resolution: number = 0.1) {
    this.obstacles = obstacles;
    this.resolution = resolution;
  }

  isColliding(point: Point2D): boolean {
    for (const obstacle of this.obstacles) {
      if (this.pointInObstacle(point, obstacle)) {
        return true;
      }
    }
    return false;
  }

  isPathClear(start: Point2D, end: Point2D): boolean {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(distance / this.resolution);

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = {
        x: start.x + t * dx,
        y: start.y + t * dy
      };
      if (this.isColliding(point)) {
        return false;
      }
    }
    return true;
  }

  private pointInObstacle(point: Point2D, obstacle: Obstacle): boolean {
    switch (obstacle.type) {
      case 'circle':
        return this.pointInCircle(point, obstacle);
      case 'rectangle':
        return this.pointInRectangle(point, obstacle);
      case 'polygon':
        return this.pointInPolygon(point, obstacle);
      default:
        return false;
    }
  }

  private pointInCircle(point: Point2D, obstacle: Obstacle): boolean {
    if (!obstacle.center || !obstacle.radius) return false;
    const dx = point.x - obstacle.center.x;
    const dy = point.y - obstacle.center.y;
    return dx * dx + dy * dy <= obstacle.radius * obstacle.radius;
  }

  private pointInRectangle(point: Point2D, obstacle: Obstacle): boolean {
    if (!obstacle.center || !obstacle.width || !obstacle.height) return false;

    const angle = obstacle.angle || 0;
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);

    // Transform point to rectangle's local coordinates
    const dx = point.x - obstacle.center.x;
    const dy = point.y - obstacle.center.y;
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    const halfWidth = obstacle.width / 2;
    const halfHeight = obstacle.height / 2;

    return Math.abs(localX) <= halfWidth && Math.abs(localY) <= halfHeight;
  }

  private pointInPolygon(point: Point2D, obstacle: Obstacle): boolean {
    if (!obstacle.vertices || obstacle.vertices.length < 3) return false;

    const vertices = obstacle.vertices;
    let inside = false;
    let j = vertices.length - 1;

    for (let i = 0; i < vertices.length; i++) {
      if (
        (vertices[i].y > point.y) !== (vertices[j].y > point.y) &&
        point.x < (vertices[j].x - vertices[i].x) * (point.y - vertices[i].y) /
                  (vertices[j].y - vertices[i].y) + vertices[i].x
      ) {
        inside = !inside;
      }
      j = i;
    }

    return inside;
  }
}

// ============================================================================
// RRT (Rapidly-exploring Random Tree)
// ============================================================================

class RRT {
  private configSpace: ConfigSpace;
  private collisionChecker: CollisionChecker;
  private stepSize: number;
  private maxIterations: number;
  private goalBias: number;
  private nodes: TreeNode[];

  constructor(
    configSpace: ConfigSpace,
    stepSize: number = 0.5,
    maxIterations: number = 5000,
    goalBias: number = 0.1
  ) {
    this.configSpace = configSpace;
    this.collisionChecker = new CollisionChecker(configSpace.obstacles);
    this.stepSize = stepSize;
    this.maxIterations = maxIterations;
    this.goalBias = goalBias;
    this.nodes = [];
  }

  plan(start: Point2D, goal: Point2D, goalThreshold: number = 0.5): PlanningResult {
    const startTime = Date.now();

    // Initialize tree with start node
    this.nodes = [{
      id: 0,
      position: { ...start },
      parent: null,
      cost: 0,
      children: []
    }];

    for (let iter = 0; iter < this.maxIterations; iter++) {
      // Sample random point (with goal bias)
      const randomPoint = Math.random() < this.goalBias
        ? { ...goal }
        : this.sampleRandom();

      // Find nearest node in tree
      const nearestIdx = this.findNearest(randomPoint);
      const nearest = this.nodes[nearestIdx];

      // Extend towards random point
      const newPoint = this.extend(nearest.position, randomPoint);

      // Check collision
      if (!this.collisionChecker.isColliding(newPoint) &&
          this.collisionChecker.isPathClear(nearest.position, newPoint)) {
        // Add new node
        const newNode: TreeNode = {
          id: this.nodes.length,
          position: newPoint,
          parent: nearestIdx,
          cost: nearest.cost + this.distance(nearest.position, newPoint),
          children: []
        };
        this.nodes.push(newNode);
        nearest.children.push(newNode.id);

        // Check if goal reached
        if (this.distance(newPoint, goal) < goalThreshold) {
          // Add goal node
          const goalNode: TreeNode = {
            id: this.nodes.length,
            position: { ...goal },
            parent: newNode.id,
            cost: newNode.cost + this.distance(newPoint, goal),
            children: []
          };
          this.nodes.push(goalNode);
          newNode.children.push(goalNode.id);

          const path = this.extractPath(goalNode.id);
          return {
            path,
            pathLength: goalNode.cost,
            nodesExplored: this.nodes.length,
            planningTime: Date.now() - startTime,
            success: true
          };
        }
      }
    }

    // No path found, return closest path
    const closestIdx = this.findNearest(goal);
    const path = this.extractPath(closestIdx);

    return {
      path,
      pathLength: this.nodes[closestIdx].cost,
      nodesExplored: this.nodes.length,
      planningTime: Date.now() - startTime,
      success: false
    };
  }

  private sampleRandom(): Point2D {
    return {
      x: this.configSpace.xMin + Math.random() * (this.configSpace.xMax - this.configSpace.xMin),
      y: this.configSpace.yMin + Math.random() * (this.configSpace.yMax - this.configSpace.yMin)
    };
  }

  private findNearest(point: Point2D): number {
    let minDist = Infinity;
    let nearestIdx = 0;

    for (let i = 0; i < this.nodes.length; i++) {
      const dist = this.distance(this.nodes[i].position, point);
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = i;
      }
    }

    return nearestIdx;
  }

  private extend(from: Point2D, to: Point2D): Point2D {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= this.stepSize) {
      return { ...to };
    }

    const ratio = this.stepSize / dist;
    return {
      x: from.x + dx * ratio,
      y: from.y + dy * ratio
    };
  }

  protected distance(a: Point2D, b: Point2D): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  protected extractPath(nodeIdx: number): Point2D[] {
    const path: Point2D[] = [];
    let currentIdx: number | null = nodeIdx;

    while (currentIdx !== null) {
      path.unshift({ ...this.nodes[currentIdx].position });
      currentIdx = this.nodes[currentIdx].parent;
    }

    return path;
  }

  getTree(): TreeNode[] {
    return this.nodes;
  }
}

// ============================================================================
// RRT* (Optimal RRT)
// ============================================================================

class RRTStar extends RRT {
  private rewireRadius: number;
  private nodes: TreeNode[];
  private configSpace: ConfigSpace;
  private collisionChecker: CollisionChecker;
  private stepSize: number;
  private maxIterations: number;
  private goalBias: number;

  constructor(
    configSpace: ConfigSpace,
    stepSize: number = 0.5,
    maxIterations: number = 5000,
    goalBias: number = 0.1,
    rewireRadius: number = 1.5
  ) {
    super(configSpace, stepSize, maxIterations, goalBias);
    this.rewireRadius = rewireRadius;
    this.nodes = [];
    this.configSpace = configSpace;
    this.collisionChecker = new CollisionChecker(configSpace.obstacles);
    this.stepSize = stepSize;
    this.maxIterations = maxIterations;
    this.goalBias = goalBias;
  }

  plan(start: Point2D, goal: Point2D, goalThreshold: number = 0.5): PlanningResult {
    const startTime = Date.now();

    // Initialize tree
    this.nodes = [{
      id: 0,
      position: { ...start },
      parent: null,
      cost: 0,
      children: []
    }];

    let goalNodeIdx: number | null = null;

    for (let iter = 0; iter < this.maxIterations; iter++) {
      // Sample random point
      const randomPoint = Math.random() < this.goalBias
        ? { ...goal }
        : this.sampleRandom();

      // Find nearest node
      const nearestIdx = this.findNearest(randomPoint);
      const nearest = this.nodes[nearestIdx];

      // Extend towards random point
      const newPoint = this.extend(nearest.position, randomPoint);

      if (!this.collisionChecker.isColliding(newPoint) &&
          this.collisionChecker.isPathClear(nearest.position, newPoint)) {

        // Find nearby nodes for potential rewiring
        const nearbyIndices = this.findNearby(newPoint);

        // Find best parent among nearby nodes
        let bestParentIdx = nearestIdx;
        let bestCost = nearest.cost + this.distance(nearest.position, newPoint);

        for (const idx of nearbyIndices) {
          const node = this.nodes[idx];
          const newCost = node.cost + this.distance(node.position, newPoint);
          if (newCost < bestCost && this.collisionChecker.isPathClear(node.position, newPoint)) {
            bestParentIdx = idx;
            bestCost = newCost;
          }
        }

        // Create new node
        const newNode: TreeNode = {
          id: this.nodes.length,
          position: newPoint,
          parent: bestParentIdx,
          cost: bestCost,
          children: []
        };
        this.nodes.push(newNode);
        this.nodes[bestParentIdx].children.push(newNode.id);

        // Rewire nearby nodes
        for (const idx of nearbyIndices) {
          if (idx === bestParentIdx) continue;

          const node = this.nodes[idx];
          const newCost = newNode.cost + this.distance(newPoint, node.position);

          if (newCost < node.cost && this.collisionChecker.isPathClear(newPoint, node.position)) {
            // Remove from old parent
            if (node.parent !== null) {
              const oldParent = this.nodes[node.parent];
              oldParent.children = oldParent.children.filter(c => c !== idx);
            }

            // Set new parent
            node.parent = newNode.id;
            node.cost = newCost;
            newNode.children.push(idx);

            // Propagate cost update
            this.propagateCostUpdate(idx);
          }
        }

        // Check if goal reached
        if (this.distance(newPoint, goal) < goalThreshold) {
          if (goalNodeIdx === null || newNode.cost + this.distance(newPoint, goal) < this.nodes[goalNodeIdx].cost) {
            if (goalNodeIdx === null) {
              const goalNode: TreeNode = {
                id: this.nodes.length,
                position: { ...goal },
                parent: newNode.id,
                cost: newNode.cost + this.distance(newPoint, goal),
                children: []
              };
              this.nodes.push(goalNode);
              newNode.children.push(goalNode.id);
              goalNodeIdx = goalNode.id;
            } else {
              // Update goal node parent
              const goalNode = this.nodes[goalNodeIdx];
              if (goalNode.parent !== null) {
                const oldParent = this.nodes[goalNode.parent];
                oldParent.children = oldParent.children.filter(c => c !== goalNodeIdx);
              }
              goalNode.parent = newNode.id;
              goalNode.cost = newNode.cost + this.distance(newPoint, goal);
              newNode.children.push(goalNodeIdx);
            }
          }
        }
      }
    }

    if (goalNodeIdx !== null) {
      const path = this.extractPath(goalNodeIdx);
      return {
        path,
        pathLength: this.nodes[goalNodeIdx].cost,
        nodesExplored: this.nodes.length,
        planningTime: Date.now() - startTime,
        success: true
      };
    }

    // No path found
    const closestIdx = this.findNearest(goal);
    const path = this.extractPath(closestIdx);

    return {
      path,
      pathLength: this.nodes[closestIdx].cost,
      nodesExplored: this.nodes.length,
      planningTime: Date.now() - startTime,
      success: false
    };
  }

  private sampleRandom(): Point2D {
    return {
      x: this.configSpace.xMin + Math.random() * (this.configSpace.xMax - this.configSpace.xMin),
      y: this.configSpace.yMin + Math.random() * (this.configSpace.yMax - this.configSpace.yMin)
    };
  }

  private findNearest(point: Point2D): number {
    let minDist = Infinity;
    let nearestIdx = 0;

    for (let i = 0; i < this.nodes.length; i++) {
      const dist = this.distance(this.nodes[i].position, point);
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = i;
      }
    }

    return nearestIdx;
  }

  private extend(from: Point2D, to: Point2D): Point2D {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= this.stepSize) {
      return { ...to };
    }

    const ratio = this.stepSize / dist;
    return {
      x: from.x + dx * ratio,
      y: from.y + dy * ratio
    };
  }

  private findNearby(point: Point2D): number[] {
    const nearby: number[] = [];
    const radius = Math.min(
      this.rewireRadius,
      this.rewireRadius * Math.sqrt(Math.log(this.nodes.length + 1) / (this.nodes.length + 1))
    );

    for (let i = 0; i < this.nodes.length; i++) {
      if (this.distance(this.nodes[i].position, point) <= radius) {
        nearby.push(i);
      }
    }

    return nearby;
  }

  private propagateCostUpdate(nodeIdx: number): void {
    const node = this.nodes[nodeIdx];
    for (const childIdx of node.children) {
      const child = this.nodes[childIdx];
      child.cost = node.cost + this.distance(node.position, child.position);
      this.propagateCostUpdate(childIdx);
    }
  }

  protected extractPath(nodeIdx: number): Point2D[] {
    const path: Point2D[] = [];
    let currentIdx: number | null = nodeIdx;

    while (currentIdx !== null) {
      path.unshift({ ...this.nodes[currentIdx].position });
      currentIdx = this.nodes[currentIdx].parent;
    }

    return path;
  }
}

// ============================================================================
// PRM (Probabilistic Roadmap)
// ============================================================================

class PRM {
  private configSpace: ConfigSpace;
  private collisionChecker: CollisionChecker;
  private numSamples: number;
  private connectionRadius: number;
  private nodes: RoadmapNode[];

  constructor(
    configSpace: ConfigSpace,
    numSamples: number = 500,
    connectionRadius: number = 2.0
  ) {
    this.configSpace = configSpace;
    this.collisionChecker = new CollisionChecker(configSpace.obstacles);
    this.numSamples = numSamples;
    this.connectionRadius = connectionRadius;
    this.nodes = [];
  }

  buildRoadmap(): void {
    this.nodes = [];

    // Sample random configurations
    while (this.nodes.length < this.numSamples) {
      const point = this.sampleRandom();
      if (!this.collisionChecker.isColliding(point)) {
        this.nodes.push({
          id: this.nodes.length,
          position: point,
          neighbors: []
        });
      }
    }

    // Connect nearby nodes
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const dist = this.distance(this.nodes[i].position, this.nodes[j].position);
        if (dist <= this.connectionRadius &&
            this.collisionChecker.isPathClear(this.nodes[i].position, this.nodes[j].position)) {
          this.nodes[i].neighbors.push(j);
          this.nodes[j].neighbors.push(i);
        }
      }
    }
  }

  query(start: Point2D, goal: Point2D): PlanningResult {
    const startTime = Date.now();

    // Check if start and goal are collision-free
    if (this.collisionChecker.isColliding(start) || this.collisionChecker.isColliding(goal)) {
      return {
        path: [],
        pathLength: 0,
        nodesExplored: 0,
        planningTime: Date.now() - startTime,
        success: false
      };
    }

    // Add start and goal to roadmap temporarily
    const startIdx = this.nodes.length;
    const goalIdx = this.nodes.length + 1;

    const startNode: RoadmapNode = {
      id: startIdx,
      position: { ...start },
      neighbors: []
    };
    const goalNode: RoadmapNode = {
      id: goalIdx,
      position: { ...goal },
      neighbors: []
    };

    // Connect start and goal to roadmap
    for (let i = 0; i < this.nodes.length; i++) {
      const distStart = this.distance(start, this.nodes[i].position);
      if (distStart <= this.connectionRadius &&
          this.collisionChecker.isPathClear(start, this.nodes[i].position)) {
        startNode.neighbors.push(i);
      }

      const distGoal = this.distance(goal, this.nodes[i].position);
      if (distGoal <= this.connectionRadius &&
          this.collisionChecker.isPathClear(goal, this.nodes[i].position)) {
        goalNode.neighbors.push(i);
      }
    }

    // Check direct connection
    if (this.collisionChecker.isPathClear(start, goal)) {
      return {
        path: [start, goal],
        pathLength: this.distance(start, goal),
        nodesExplored: 2,
        planningTime: Date.now() - startTime,
        success: true
      };
    }

    // Add temporary nodes
    this.nodes.push(startNode);
    this.nodes.push(goalNode);

    // A* search on roadmap
    const result = this.aStarSearch(startIdx, goalIdx);

    // Remove temporary nodes
    this.nodes.pop();
    this.nodes.pop();

    return {
      ...result,
      planningTime: Date.now() - startTime
    };
  }

  private aStarSearch(startIdx: number, goalIdx: number): PlanningResult {
    const openSet = new Set<number>([startIdx]);
    const closedSet = new Set<number>();
    const gScore = new Map<number, number>();
    const fScore = new Map<number, number>();
    const cameFrom = new Map<number, number>();

    gScore.set(startIdx, 0);
    fScore.set(startIdx, this.distance(this.nodes[startIdx].position, this.nodes[goalIdx].position));

    while (openSet.size > 0) {
      // Find node with lowest fScore
      let current = -1;
      let minF = Infinity;
      for (const nodeIdx of openSet) {
        const f = fScore.get(nodeIdx) || Infinity;
        if (f < minF) {
          minF = f;
          current = nodeIdx;
        }
      }

      if (current === goalIdx) {
        // Reconstruct path
        const path = this.reconstructPath(cameFrom, current);
        return {
          path,
          pathLength: gScore.get(goalIdx) || 0,
          nodesExplored: closedSet.size,
          planningTime: 0,
          success: true
        };
      }

      openSet.delete(current);
      closedSet.add(current);

      for (const neighborIdx of this.nodes[current].neighbors) {
        if (closedSet.has(neighborIdx)) continue;

        const tentativeG = (gScore.get(current) || 0) +
          this.distance(this.nodes[current].position, this.nodes[neighborIdx].position);

        if (!openSet.has(neighborIdx)) {
          openSet.add(neighborIdx);
        } else if (tentativeG >= (gScore.get(neighborIdx) || Infinity)) {
          continue;
        }

        cameFrom.set(neighborIdx, current);
        gScore.set(neighborIdx, tentativeG);
        fScore.set(neighborIdx, tentativeG +
          this.distance(this.nodes[neighborIdx].position, this.nodes[goalIdx].position));
      }
    }

    return {
      path: [],
      pathLength: 0,
      nodesExplored: closedSet.size,
      planningTime: 0,
      success: false
    };
  }

  private reconstructPath(cameFrom: Map<number, number>, current: number): Point2D[] {
    const path: Point2D[] = [{ ...this.nodes[current].position }];
    while (cameFrom.has(current)) {
      current = cameFrom.get(current)!;
      path.unshift({ ...this.nodes[current].position });
    }
    return path;
  }

  private sampleRandom(): Point2D {
    return {
      x: this.configSpace.xMin + Math.random() * (this.configSpace.xMax - this.configSpace.xMin),
      y: this.configSpace.yMin + Math.random() * (this.configSpace.yMax - this.configSpace.yMin)
    };
  }

  private distance(a: Point2D, b: Point2D): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  getRoadmap(): RoadmapNode[] {
    return this.nodes;
  }
}

// ============================================================================
// A* GRID-BASED PLANNING
// ============================================================================

class AStarPlanner {
  private grid: GridCell[][];
  private width: number;
  private height: number;
  private resolution: number;
  private configSpace: ConfigSpace;
  private collisionChecker: CollisionChecker;

  constructor(configSpace: ConfigSpace, resolution: number = 0.5) {
    this.configSpace = configSpace;
    this.resolution = resolution;
    this.collisionChecker = new CollisionChecker(configSpace.obstacles, resolution / 2);

    this.width = Math.ceil((configSpace.xMax - configSpace.xMin) / resolution);
    this.height = Math.ceil((configSpace.yMax - configSpace.yMin) / resolution);
    this.grid = [];

    this.buildGrid();
  }

  private buildGrid(): void {
    this.grid = [];

    for (let y = 0; y < this.height; y++) {
      this.grid[y] = [];
      for (let x = 0; x < this.width; x++) {
        const worldPoint = this.gridToWorld(x, y);
        this.grid[y][x] = {
          x,
          y,
          g: Infinity,
          h: 0,
          f: Infinity,
          parent: null,
          walkable: !this.collisionChecker.isColliding(worldPoint)
        };
      }
    }
  }

  plan(start: Point2D, goal: Point2D, allowDiagonal: boolean = true): PlanningResult {
    const startTime = Date.now();

    // Reset grid
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.grid[y][x].g = Infinity;
        this.grid[y][x].h = 0;
        this.grid[y][x].f = Infinity;
        this.grid[y][x].parent = null;
      }
    }

    const startCell = this.worldToGrid(start);
    const goalCell = this.worldToGrid(goal);

    if (!this.isValidCell(startCell.x, startCell.y) ||
        !this.isValidCell(goalCell.x, goalCell.y)) {
      return {
        path: [],
        pathLength: 0,
        nodesExplored: 0,
        planningTime: Date.now() - startTime,
        success: false
      };
    }

    if (!this.grid[startCell.y][startCell.x].walkable ||
        !this.grid[goalCell.y][goalCell.x].walkable) {
      return {
        path: [],
        pathLength: 0,
        nodesExplored: 0,
        planningTime: Date.now() - startTime,
        success: false
      };
    }

    const openSet: GridCell[] = [];
    const closedSet = new Set<string>();

    const startNode = this.grid[startCell.y][startCell.x];
    startNode.g = 0;
    startNode.h = this.heuristic(startCell, goalCell);
    startNode.f = startNode.g + startNode.h;
    openSet.push(startNode);

    const directions = allowDiagonal
      ? [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]]
      : [[-1,0], [0,-1], [0,1], [1,0]];

    while (openSet.length > 0) {
      // Find cell with lowest f
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift()!;
      const currentKey = `${current.x},${current.y}`;

      if (current.x === goalCell.x && current.y === goalCell.y) {
        // Reconstruct path
        const path = this.reconstructPath(current);
        return {
          path,
          pathLength: current.g * this.resolution,
          nodesExplored: closedSet.size,
          planningTime: Date.now() - startTime,
          success: true
        };
      }

      closedSet.add(currentKey);

      for (const [dy, dx] of directions) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const neighborKey = `${nx},${ny}`;

        if (!this.isValidCell(nx, ny) ||
            !this.grid[ny][nx].walkable ||
            closedSet.has(neighborKey)) {
          continue;
        }

        // Check diagonal movement
        if (dx !== 0 && dy !== 0) {
          if (!this.grid[current.y + dy][current.x].walkable ||
              !this.grid[current.y][current.x + dx].walkable) {
            continue;
          }
        }

        const neighbor = this.grid[ny][nx];
        const moveCost = (dx !== 0 && dy !== 0) ? Math.SQRT2 : 1;
        const tentativeG = current.g + moveCost;

        if (tentativeG < neighbor.g) {
          neighbor.parent = current;
          neighbor.g = tentativeG;
          neighbor.h = this.heuristic({ x: nx, y: ny }, goalCell);
          neighbor.f = neighbor.g + neighbor.h;

          if (!openSet.includes(neighbor)) {
            openSet.push(neighbor);
          }
        }
      }
    }

    return {
      path: [],
      pathLength: 0,
      nodesExplored: closedSet.size,
      planningTime: Date.now() - startTime,
      success: false
    };
  }

  private heuristic(a: { x: number; y: number }, b: { x: number; y: number }): number {
    // Octile distance (allows diagonal movement)
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy);
  }

  private reconstructPath(endCell: GridCell): Point2D[] {
    const path: Point2D[] = [];
    let current: GridCell | null = endCell;

    while (current !== null) {
      path.unshift(this.gridToWorld(current.x, current.y));
      current = current.parent;
    }

    return path;
  }

  private worldToGrid(point: Point2D): { x: number; y: number } {
    return {
      x: Math.floor((point.x - this.configSpace.xMin) / this.resolution),
      y: Math.floor((point.y - this.configSpace.yMin) / this.resolution)
    };
  }

  private gridToWorld(x: number, y: number): Point2D {
    return {
      x: this.configSpace.xMin + (x + 0.5) * this.resolution,
      y: this.configSpace.yMin + (y + 0.5) * this.resolution
    };
  }

  private isValidCell(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }
}

// ============================================================================
// POTENTIAL FIELD PLANNER
// ============================================================================

class PotentialFieldPlanner {
  private configSpace: ConfigSpace;
  private attractiveGain: number;
  private repulsiveGain: number;
  private influenceRadius: number;
  private stepSize: number;
  private maxIterations: number;

  constructor(
    configSpace: ConfigSpace,
    attractiveGain: number = 1.0,
    repulsiveGain: number = 100.0,
    influenceRadius: number = 2.0,
    stepSize: number = 0.1,
    maxIterations: number = 1000
  ) {
    this.configSpace = configSpace;
    this.attractiveGain = attractiveGain;
    this.repulsiveGain = repulsiveGain;
    this.influenceRadius = influenceRadius;
    this.stepSize = stepSize;
    this.maxIterations = maxIterations;
  }

  plan(start: Point2D, goal: Point2D, goalThreshold: number = 0.5): PlanningResult {
    const startTime = Date.now();
    const path: Point2D[] = [{ ...start }];
    let current = { ...start };
    let pathLength = 0;

    for (let iter = 0; iter < this.maxIterations; iter++) {
      // Check if goal reached
      const distToGoal = this.distance(current, goal);
      if (distToGoal < goalThreshold) {
        path.push({ ...goal });
        pathLength += distToGoal;
        return {
          path,
          pathLength,
          nodesExplored: path.length,
          planningTime: Date.now() - startTime,
          success: true
        };
      }

      // Compute total force
      const force = this.computeTotalForce(current, goal);
      const forceMag = Math.sqrt(force.x * force.x + force.y * force.y);

      if (forceMag < 1e-6) {
        // Local minimum detected
        break;
      }

      // Normalize and apply step
      const step = {
        x: (force.x / forceMag) * this.stepSize,
        y: (force.y / forceMag) * this.stepSize
      };

      const next = {
        x: current.x + step.x,
        y: current.y + step.y
      };

      // Check bounds
      if (next.x < this.configSpace.xMin || next.x > this.configSpace.xMax ||
          next.y < this.configSpace.yMin || next.y > this.configSpace.yMax) {
        break;
      }

      pathLength += this.stepSize;
      path.push({ ...next });
      current = next;
    }

    return {
      path,
      pathLength,
      nodesExplored: path.length,
      planningTime: Date.now() - startTime,
      success: false
    };
  }

  computePotentialField(resolution: number = 0.5): {
    field: number[][];
    gradient: { x: number; y: number }[][];
    width: number;
    height: number;
  } {
    const width = Math.ceil((this.configSpace.xMax - this.configSpace.xMin) / resolution);
    const height = Math.ceil((this.configSpace.yMax - this.configSpace.yMin) / resolution);

    const field: number[][] = [];
    const gradient: { x: number; y: number }[][] = [];

    for (let y = 0; y < height; y++) {
      field[y] = [];
      gradient[y] = [];
      for (let x = 0; x < width; x++) {
        const point = {
          x: this.configSpace.xMin + (x + 0.5) * resolution,
          y: this.configSpace.yMin + (y + 0.5) * resolution
        };

        // For visualization, use center as goal
        const goal = {
          x: (this.configSpace.xMin + this.configSpace.xMax) / 2,
          y: (this.configSpace.yMin + this.configSpace.yMax) / 2
        };

        const attractive = this.attractivePotential(point, goal);
        const repulsive = this.repulsivePotential(point);
        field[y][x] = attractive + repulsive;

        const force = this.computeTotalForce(point, goal);
        gradient[y][x] = { x: -force.x, y: -force.y };
      }
    }

    return { field, gradient, width, height };
  }

  private computeTotalForce(point: Point2D, goal: Point2D): Point2D {
    const attractive = this.attractiveForce(point, goal);
    const repulsive = this.repulsiveForce(point);

    return {
      x: attractive.x + repulsive.x,
      y: attractive.y + repulsive.y
    };
  }

  private attractivePotential(point: Point2D, goal: Point2D): number {
    const dist = this.distance(point, goal);
    return 0.5 * this.attractiveGain * dist * dist;
  }

  private attractiveForce(point: Point2D, goal: Point2D): Point2D {
    return {
      x: this.attractiveGain * (goal.x - point.x),
      y: this.attractiveGain * (goal.y - point.y)
    };
  }

  private repulsivePotential(point: Point2D): number {
    let potential = 0;

    for (const obstacle of this.configSpace.obstacles) {
      const dist = this.distanceToObstacle(point, obstacle);
      if (dist < this.influenceRadius && dist > 0) {
        potential += 0.5 * this.repulsiveGain *
          Math.pow(1 / dist - 1 / this.influenceRadius, 2);
      } else if (dist <= 0) {
        potential += 1e6;  // Very high potential inside obstacle
      }
    }

    return potential;
  }

  private repulsiveForce(point: Point2D): Point2D {
    let fx = 0;
    let fy = 0;

    for (const obstacle of this.configSpace.obstacles) {
      const { distance: dist, gradient } = this.distanceAndGradientToObstacle(point, obstacle);

      if (dist < this.influenceRadius && dist > 0) {
        const factor = this.repulsiveGain *
          (1 / dist - 1 / this.influenceRadius) *
          (1 / (dist * dist));

        fx += factor * gradient.x;
        fy += factor * gradient.y;
      }
    }

    return { x: fx, y: fy };
  }

  private distanceToObstacle(point: Point2D, obstacle: Obstacle): number {
    switch (obstacle.type) {
      case 'circle':
        if (!obstacle.center || !obstacle.radius) return Infinity;
        return this.distance(point, obstacle.center) - obstacle.radius;
      case 'rectangle':
        return this.distanceToRectangle(point, obstacle);
      default:
        return Infinity;
    }
  }

  private distanceAndGradientToObstacle(point: Point2D, obstacle: Obstacle): {
    distance: number;
    gradient: Point2D;
  } {
    switch (obstacle.type) {
      case 'circle': {
        if (!obstacle.center || !obstacle.radius) {
          return { distance: Infinity, gradient: { x: 0, y: 0 } };
        }
        const dx = point.x - obstacle.center.x;
        const dy = point.y - obstacle.center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1e-6) {
          return { distance: -obstacle.radius, gradient: { x: 1, y: 0 } };
        }
        return {
          distance: dist - obstacle.radius,
          gradient: { x: dx / dist, y: dy / dist }
        };
      }
      case 'rectangle': {
        return this.distanceAndGradientToRectangle(point, obstacle);
      }
      default:
        return { distance: Infinity, gradient: { x: 0, y: 0 } };
    }
  }

  private distanceToRectangle(point: Point2D, obstacle: Obstacle): number {
    if (!obstacle.center || !obstacle.width || !obstacle.height) return Infinity;

    const angle = obstacle.angle || 0;
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);

    // Transform to local coordinates
    const dx = point.x - obstacle.center.x;
    const dy = point.y - obstacle.center.y;
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    const halfW = obstacle.width / 2;
    const halfH = obstacle.height / 2;

    const closestX = Math.max(-halfW, Math.min(halfW, localX));
    const closestY = Math.max(-halfH, Math.min(halfH, localY));

    const distX = localX - closestX;
    const distY = localY - closestY;

    return Math.sqrt(distX * distX + distY * distY);
  }

  private distanceAndGradientToRectangle(point: Point2D, obstacle: Obstacle): {
    distance: number;
    gradient: Point2D;
  } {
    if (!obstacle.center || !obstacle.width || !obstacle.height) {
      return { distance: Infinity, gradient: { x: 0, y: 0 } };
    }

    const angle = obstacle.angle || 0;
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const cosInv = Math.cos(angle);
    const sinInv = Math.sin(angle);

    // Transform to local coordinates
    const dx = point.x - obstacle.center.x;
    const dy = point.y - obstacle.center.y;
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;

    const halfW = obstacle.width / 2;
    const halfH = obstacle.height / 2;

    const closestX = Math.max(-halfW, Math.min(halfW, localX));
    const closestY = Math.max(-halfH, Math.min(halfH, localY));

    const distX = localX - closestX;
    const distY = localY - closestY;
    const dist = Math.sqrt(distX * distX + distY * distY);

    if (dist < 1e-6) {
      // Point is on or inside rectangle boundary
      return { distance: 0, gradient: { x: 0, y: 0 } };
    }

    // Local gradient
    const localGradX = distX / dist;
    const localGradY = distY / dist;

    // Transform gradient back to world coordinates
    return {
      distance: dist,
      gradient: {
        x: localGradX * cosInv - localGradY * sinInv,
        y: localGradX * sinInv + localGradY * cosInv
      }
    };
  }

  private distance(a: Point2D, b: Point2D): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

// ============================================================================
// PATH SMOOTHING
// ============================================================================

function smoothPath(
  path: Point2D[],
  configSpace: ConfigSpace,
  iterations: number = 100,
  weight: number = 0.5
): Point2D[] {
  if (path.length < 3) return path;

  const collisionChecker = new CollisionChecker(configSpace.obstacles);
  const smoothed = path.map(p => ({ ...p }));

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 1; i < smoothed.length - 1; i++) {
      const prev = smoothed[i - 1];
      const curr = smoothed[i];
      const next = smoothed[i + 1];

      // Compute smoothed position
      const newX = curr.x + weight * (0.5 * (prev.x + next.x) - curr.x);
      const newY = curr.y + weight * (0.5 * (prev.y + next.y) - curr.y);

      // Only update if collision-free
      const newPoint = { x: newX, y: newY };
      if (!collisionChecker.isColliding(newPoint) &&
          collisionChecker.isPathClear(prev, newPoint) &&
          collisionChecker.isPathClear(newPoint, next)) {
        smoothed[i] = newPoint;
      }
    }
  }

  return smoothed;
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const motionplanningTool: UnifiedTool = {
  name: 'motion_planning',
  description: 'Motion planning algorithms for robotics including RRT, RRT*, PRM, A*, and potential fields for path planning in configuration space',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['rrt', 'rrt_star', 'prm', 'astar', 'potential_field', 'smooth_path', 'info', 'examples', 'demo'],
        description: 'Motion planning operation to perform'
      },
      parameters: {
        type: 'object',
        description: 'Operation-specific parameters'
      }
    },
    required: ['operation']
  }
};

// ============================================================================
// TOOL EXECUTOR
// ============================================================================

export async function executemotionplanning(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const { id, arguments: rawArgs } = toolCall;

  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : rawArgs;
    const { operation, parameters = {} } = args;

    switch (operation) {
      case 'rrt': {
        const {
          configSpace = { xMin: 0, xMax: 10, yMin: 0, yMax: 10, obstacles: [] },
          start = { x: 1, y: 1 },
          goal = { x: 9, y: 9 },
          stepSize = 0.5,
          maxIterations = 5000,
          goalBias = 0.1,
          goalThreshold = 0.5
        } = parameters;

        const rrt = new RRT(configSpace, stepSize, maxIterations, goalBias);
        const result = rrt.plan(start, goal, goalThreshold);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'rrt',
            algorithm: 'Rapidly-exploring Random Tree',
            result: {
              path: result.path,
              pathLength: result.pathLength,
              nodesExplored: result.nodesExplored,
              planningTimeMs: result.planningTime,
              success: result.success,
              treeSize: rrt.getTree().length
            },
            description: 'RRT explores configuration space by growing a tree of random samples'
          }, null, 2)
        };
      }

      case 'rrt_star': {
        const {
          configSpace = { xMin: 0, xMax: 10, yMin: 0, yMax: 10, obstacles: [] },
          start = { x: 1, y: 1 },
          goal = { x: 9, y: 9 },
          stepSize = 0.5,
          maxIterations = 5000,
          goalBias = 0.1,
          rewireRadius = 1.5,
          goalThreshold = 0.5
        } = parameters;

        const rrtStar = new RRTStar(configSpace, stepSize, maxIterations, goalBias, rewireRadius);
        const result = rrtStar.plan(start, goal, goalThreshold);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'rrt_star',
            algorithm: 'Optimal RRT (RRT*)',
            result: {
              path: result.path,
              pathLength: result.pathLength,
              nodesExplored: result.nodesExplored,
              planningTimeMs: result.planningTime,
              success: result.success
            },
            description: 'RRT* extends RRT with rewiring to find asymptotically optimal paths'
          }, null, 2)
        };
      }

      case 'prm': {
        const {
          configSpace = { xMin: 0, xMax: 10, yMin: 0, yMax: 10, obstacles: [] },
          start = { x: 1, y: 1 },
          goal = { x: 9, y: 9 },
          numSamples = 500,
          connectionRadius = 2.0
        } = parameters;

        const prm = new PRM(configSpace, numSamples, connectionRadius);
        prm.buildRoadmap();
        const result = prm.query(start, goal);
        const roadmap = prm.getRoadmap();

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'prm',
            algorithm: 'Probabilistic Roadmap',
            result: {
              path: result.path,
              pathLength: result.pathLength,
              nodesExplored: result.nodesExplored,
              planningTimeMs: result.planningTime,
              success: result.success,
              roadmapSize: roadmap.length,
              totalEdges: roadmap.reduce((sum, n) => sum + n.neighbors.length, 0) / 2
            },
            description: 'PRM builds a roadmap of collision-free configurations for multi-query planning'
          }, null, 2)
        };
      }

      case 'astar': {
        const {
          configSpace = { xMin: 0, xMax: 10, yMin: 0, yMax: 10, obstacles: [] },
          start = { x: 1, y: 1 },
          goal = { x: 9, y: 9 },
          resolution = 0.5,
          allowDiagonal = true
        } = parameters;

        const astar = new AStarPlanner(configSpace, resolution);
        const result = astar.plan(start, goal, allowDiagonal);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'astar',
            algorithm: 'A* Grid Search',
            result: {
              path: result.path,
              pathLength: result.pathLength,
              nodesExplored: result.nodesExplored,
              planningTimeMs: result.planningTime,
              success: result.success,
              gridResolution: resolution,
              diagonalMovement: allowDiagonal
            },
            description: 'A* finds optimal paths on a discretized grid using heuristic search'
          }, null, 2)
        };
      }

      case 'potential_field': {
        const {
          configSpace = { xMin: 0, xMax: 10, yMin: 0, yMax: 10, obstacles: [] },
          start = { x: 1, y: 1 },
          goal = { x: 9, y: 9 },
          attractiveGain = 1.0,
          repulsiveGain = 100.0,
          influenceRadius = 2.0,
          stepSize = 0.1,
          maxIterations = 1000,
          goalThreshold = 0.5
        } = parameters;

        const planner = new PotentialFieldPlanner(
          configSpace, attractiveGain, repulsiveGain,
          influenceRadius, stepSize, maxIterations
        );
        const result = planner.plan(start, goal, goalThreshold);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'potential_field',
            algorithm: 'Artificial Potential Field',
            result: {
              path: result.path,
              pathLength: result.pathLength,
              nodesExplored: result.nodesExplored,
              planningTimeMs: result.planningTime,
              success: result.success
            },
            parameters: {
              attractiveGain,
              repulsiveGain,
              influenceRadius
            },
            description: 'Potential fields use attractive goal forces and repulsive obstacle forces for reactive planning'
          }, null, 2)
        };
      }

      case 'smooth_path': {
        const {
          path = [],
          configSpace = { xMin: 0, xMax: 10, yMin: 0, yMax: 10, obstacles: [] },
          iterations = 100,
          weight = 0.5
        } = parameters;

        if (path.length < 3) {
          return {
            toolCallId: id,
            content: JSON.stringify({
              operation: 'smooth_path',
              error: 'Path must have at least 3 points for smoothing',
              originalPath: path
            }, null, 2),
            isError: true
          };
        }

        const originalLength = computePathLength(path);
        const smoothed = smoothPath(path, configSpace, iterations, weight);
        const smoothedLength = computePathLength(smoothed);

        return {
          toolCallId: id,
          content: JSON.stringify({
            operation: 'smooth_path',
            algorithm: 'Gradient-based Path Smoothing',
            result: {
              originalPath: path,
              smoothedPath: smoothed,
              originalLength,
              smoothedLength,
              improvement: ((originalLength - smoothedLength) / originalLength * 100).toFixed(2) + '%'
            },
            description: 'Path smoothing iteratively moves waypoints towards a smoother trajectory'
          }, null, 2)
        };
      }

      case 'info': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            tool: 'motion_planning',
            description: 'Motion planning algorithms for robotics path planning',
            algorithms: {
              rrt: {
                name: 'Rapidly-exploring Random Tree',
                description: 'Incrementally builds tree by random sampling',
                properties: ['probabilistically complete', 'fast exploration'],
                complexity: 'O(n log n) for nearest neighbor with KD-tree',
                bestFor: 'High-dimensional spaces, single query'
              },
              rrt_star: {
                name: 'Optimal RRT (RRT*)',
                description: 'RRT with rewiring for optimal paths',
                properties: ['asymptotically optimal', 'probabilistically complete'],
                complexity: 'O(n log n) per iteration',
                bestFor: 'When path quality matters'
              },
              prm: {
                name: 'Probabilistic Roadmap',
                description: 'Pre-builds roadmap for multiple queries',
                properties: ['multi-query efficient', 'probabilistically complete'],
                complexity: 'O(n^2) build, O(n log n) query',
                bestFor: 'Static environments, multiple queries'
              },
              astar: {
                name: 'A* Grid Search',
                description: 'Optimal grid-based search with heuristics',
                properties: ['complete', 'optimal (on grid)'],
                complexity: 'O(b^d) worst case',
                bestFor: 'Low-dimensional, discretizable spaces'
              },
              potential_field: {
                name: 'Artificial Potential Field',
                description: 'Reactive planning using force fields',
                properties: ['real-time', 'simple'],
                limitations: ['local minima', 'oscillation near obstacles'],
                bestFor: 'Real-time reactive control'
              }
            },
            operations: ['rrt', 'rrt_star', 'prm', 'astar', 'potential_field', 'smooth_path', 'info', 'examples', 'demo']
          }, null, 2)
        };
      }

      case 'examples': {
        return {
          toolCallId: id,
          content: JSON.stringify({
            examples: [
              {
                name: 'RRT with circular obstacles',
                operation: 'rrt',
                parameters: {
                  configSpace: {
                    xMin: 0, xMax: 10, yMin: 0, yMax: 10,
                    obstacles: [
                      { type: 'circle', center: { x: 5, y: 5 }, radius: 1.5 },
                      { type: 'circle', center: { x: 3, y: 7 }, radius: 1.0 }
                    ]
                  },
                  start: { x: 1, y: 1 },
                  goal: { x: 9, y: 9 },
                  maxIterations: 3000
                }
              },
              {
                name: 'A* with rectangular obstacles',
                operation: 'astar',
                parameters: {
                  configSpace: {
                    xMin: 0, xMax: 10, yMin: 0, yMax: 10,
                    obstacles: [
                      { type: 'rectangle', center: { x: 5, y: 5 }, width: 3, height: 1 },
                      { type: 'rectangle', center: { x: 3, y: 3 }, width: 1, height: 4 }
                    ]
                  },
                  start: { x: 1, y: 1 },
                  goal: { x: 9, y: 9 },
                  resolution: 0.25
                }
              },
              {
                name: 'PRM for multiple queries',
                operation: 'prm',
                parameters: {
                  configSpace: {
                    xMin: 0, xMax: 20, yMin: 0, yMax: 20,
                    obstacles: [
                      { type: 'circle', center: { x: 10, y: 10 }, radius: 3 }
                    ]
                  },
                  start: { x: 2, y: 2 },
                  goal: { x: 18, y: 18 },
                  numSamples: 300
                }
              }
            ]
          }, null, 2)
        };
      }

      case 'demo': {
        // Demo: Compare different planners on same problem
        const configSpace: ConfigSpace = {
          xMin: 0, xMax: 10, yMin: 0, yMax: 10,
          obstacles: [
            { type: 'circle', center: { x: 5, y: 5 }, radius: 2 },
            { type: 'circle', center: { x: 3, y: 7 }, radius: 1 },
            { type: 'circle', center: { x: 7, y: 3 }, radius: 1 }
          ]
        };
        const start = { x: 1, y: 1 };
        const goal = { x: 9, y: 9 };

        // RRT
        const rrt = new RRT(configSpace, 0.5, 2000, 0.1);
        const rrtResult = rrt.plan(start, goal);

        // RRT*
        const rrtStar = new RRTStar(configSpace, 0.5, 2000, 0.1, 1.5);
        const rrtStarResult = rrtStar.plan(start, goal);

        // A*
        const astar = new AStarPlanner(configSpace, 0.3);
        const astarResult = astar.plan(start, goal);

        // Potential Field
        const potField = new PotentialFieldPlanner(configSpace, 1.0, 50.0, 2.0, 0.1, 500);
        const potFieldResult = potField.plan(start, goal);

        return {
          toolCallId: id,
          content: JSON.stringify({
            demo: 'Motion Planning Algorithm Comparison',
            description: 'Comparing RRT, RRT*, A*, and Potential Fields on the same problem',
            configSpace: {
              bounds: { xMin: 0, xMax: 10, yMin: 0, yMax: 10 },
              obstacles: configSpace.obstacles.length
            },
            start,
            goal,
            results: {
              rrt: {
                success: rrtResult.success,
                pathLength: rrtResult.pathLength.toFixed(2),
                nodesExplored: rrtResult.nodesExplored,
                timeMs: rrtResult.planningTime
              },
              rrt_star: {
                success: rrtStarResult.success,
                pathLength: rrtStarResult.pathLength.toFixed(2),
                nodesExplored: rrtStarResult.nodesExplored,
                timeMs: rrtStarResult.planningTime
              },
              astar: {
                success: astarResult.success,
                pathLength: astarResult.pathLength.toFixed(2),
                nodesExplored: astarResult.nodesExplored,
                timeMs: astarResult.planningTime
              },
              potential_field: {
                success: potFieldResult.success,
                pathLength: potFieldResult.pathLength.toFixed(2),
                nodesExplored: potFieldResult.nodesExplored,
                timeMs: potFieldResult.planningTime
              }
            }
          }, null, 2)
        };
      }

      default:
        return {
          toolCallId: id,
          content: JSON.stringify({
            error: `Unknown operation: ${operation}`,
            availableOperations: ['rrt', 'rrt_star', 'prm', 'astar', 'potential_field', 'smooth_path', 'info', 'examples', 'demo']
          }, null, 2),
          isError: true
        };
    }
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error';
    return {
      toolCallId: id,
      content: JSON.stringify({ error: errorMessage }, null, 2),
      isError: true
    };
  }
}

// Helper function for path length
function computePathLength(path: Point2D[]): number {
  let length = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

export function ismotionplanningAvailable(): boolean {
  return true;
}
