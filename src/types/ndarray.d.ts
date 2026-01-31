declare module 'ndarray' {
  interface NdArray<T = number> {
    /** The underlying data array */
    data: T[] | Float32Array | Float64Array | Int32Array | Int8Array | Uint8Array | Uint32Array;

    /** The shape of the array */
    shape: number[];

    /** The strides of the array */
    stride: number[];

    /** The offset of the array */
    offset: number;

    /** The number of dimensions */
    dimension: number;

    /** The total number of elements */
    size: number;

    /** Get element at the specified indices */
    get(...indices: number[]): T;

    /** Set element at the specified indices */
    set(...args: [...number[], T]): void;

    /** Get an element using index */
    index(...indices: number[]): number;

    /** Create a view of a subarray */
    lo(...indices: number[]): NdArray<T>;

    /** Create a view of a subarray */
    hi(...indices: number[]): NdArray<T>;

    /** Step through the array */
    step(...steps: number[]): NdArray<T>;

    /** Transpose the array */
    transpose(...axes: number[]): NdArray<T>;

    /** Pick a slice */
    pick(...indices: (number | null)[]): NdArray<T>;
  }

  /**
   * Create an n-dimensional array
   */
  function ndarray<T = number>(
    data: T[] | Float32Array | Float64Array | Int32Array | Int8Array | Uint8Array | Uint32Array,
    shape?: number[],
    stride?: number[],
    offset?: number
  ): NdArray<T>;

  export = ndarray;
}
