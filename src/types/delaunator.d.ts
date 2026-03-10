declare module 'delaunator' {
  export default class Delaunator {
    constructor(coords: ArrayLike<number>);

    /** Triangle indices (3 per triangle) */
    triangles: Uint32Array;

    /** Half-edge indices */
    halfedges: Int32Array;

    /** Hull indices */
    hull: Uint32Array;

    /** Input coordinates */
    coords: ArrayLike<number>;

    /** Update triangulation with new coordinates */
    update(): void;

    /** Create from array of point objects */
    static from(
      points: ArrayLike<{ x: number; y: number } | [number, number]>,
      getX?: (p: { x: number; y: number } | [number, number]) => number,
      getY?: (p: { x: number; y: number } | [number, number]) => number
    ): Delaunator;
  }
}
