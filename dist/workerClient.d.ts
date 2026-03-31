import type { RenderSnapshot, SimulationOptions, StepSummary } from "./types.js";
export declare class ForceGraphWorkerClient {
    private readonly worker;
    private requestId;
    private readonly pending;
    constructor(workerUrl?: URL, options?: WorkerOptions);
    terminate(): void;
    init(options?: Partial<SimulationOptions>): Promise<void>;
    loadGraph(nodeCount: number, edges: Uint32Array, positions?: Float32Array): Promise<{
        nodeCount: number;
        edgeCount: number;
    }>;
    step(iterations?: number): Promise<StepSummary>;
    snapshot(maxNodes?: number, maxEdges?: number): Promise<RenderSnapshot>;
    private send;
}
