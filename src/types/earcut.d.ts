declare module 'earcut' {
  /**
   * Triangulate a polygon with optional holes.
   * @param vertices - Flat array of vertex coordinates [x0, y0, x1, y1, ...]
   * @param holes - Array of hole indices in the vertices array (optional)
   * @param dim - Number of coordinates per vertex (default: 2)
   * @returns Array of triangle indices
   */
  function earcut(vertices: number[], holes?: number[], dim?: number): number[];

  namespace earcut {
    /**
     * Calculate deviation from a perfect triangulation.
     * Returns 0 for a valid triangulation.
     */
    function deviation(
      vertices: number[],
      holes: number[] | undefined,
      dim: number,
      triangles: number[]
    ): number;

    /**
     * Flatten nested arrays of vertex coordinates.
     */
    function flatten(data: number[][][]): {
      vertices: number[];
      holes: number[];
      dimensions: number;
    };
  }

  export = earcut;
}
