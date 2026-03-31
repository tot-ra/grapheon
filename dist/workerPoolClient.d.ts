import type { RenderSnapshot, SimulationOptions, StepSummary } from "./types.js";
interface LoadResult {
    nodeCount: number;
    edgeCount: number;
}
export declare class ForceGraphWorkerPoolClient {
    private readonly workers;
    private shards;
    constructor(workerCount?: number);
    get workerCount(): number;
    init(options?: Partial<SimulationOptions>): Promise<void>;
    terminate(): void;
    loadGraph(nodeCount: number, edges: Uint32Array, positions?: Float32Array): Promise<LoadResult>;
    step(iterations?: number): Promise<StepSummary>;
    snapshot(maxNodes?: number, maxEdges?: number): Promise<RenderSnapshot>;
    private createShards;
    private partitionEdges;
    private shardIndexForNode;
    private slicePositions;
}
export {};
