interface BodyAccessor {
    getX(index: number): number;
    getY(index: number): number;
    getZ(index: number): number;
    getMass(index: number): number;
}
export declare class BarnesHutTree {
    private readonly bodies;
    private readonly minDistance;
    private readonly maxDepth;
    private root;
    constructor(bodies: BodyAccessor, minDistance: number, maxDepth?: number);
    build(indices: number[]): void;
    computeRepulsion(index: number, repulsionStrength: number, theta: number): [number, number, number];
    private insert;
    private subdivide;
    private childFor;
    private accumulate;
}
export {};
