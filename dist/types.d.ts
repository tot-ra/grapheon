export type NodeId = string | number;
export interface NodeAppearance {
    color?: string;
    radius?: number;
    shape?: "circle" | "square" | "diamond" | "triangle";
}
export interface EdgeAppearance {
    color?: string;
    width?: number;
}
export interface GraphNodeInput {
    x?: number;
    y?: number;
    z?: number;
    mass?: number;
    appearance?: NodeAppearance;
}
export interface GraphEdgeInput {
    weight?: number;
    appearance?: EdgeAppearance;
}
export interface SimulationOptions {
    springLength: number;
    springStrength: number;
    repulsionStrength: number;
    gravity: number;
    gravityMode: "center" | "directional" | "both";
    gravityCenterX: number;
    gravityCenterY: number;
    gravityCenterZ: number;
    gravityDirectionX: number;
    gravityDirectionY: number;
    gravityDirectionZ: number;
    damping: number;
    theta: number;
    timeStep: number;
    minDistance: number;
    maxSpeed: number;
    initialSpread: number;
    activeSetEnabled: boolean;
    sleepVelocityThreshold: number;
    coldNodeUpdateInterval: number;
    inactiveVelocityDamping: number;
    adaptiveThetaEnabled: boolean;
    adaptiveThetaMin: number;
    adaptiveThetaMax: number;
    adaptiveTargetFrameMs: number;
}
export interface DrawOptions {
    width: number;
    height: number;
    offsetX?: number;
    offsetY?: number;
    scale?: number;
    renderDimension?: "2d" | "3d";
    projection?: "orthographic" | "perspective";
    cameraDistance?: number;
    rotationX?: number;
    rotationY?: number;
    rotationZ?: number;
    nodeShape?: "circle" | "square" | "diamond" | "triangle";
    nodeRadius?: number;
    nodeColor?: string;
    edgeColor?: string;
    edgeWidth?: number;
    backgroundColor?: string;
    maxDrawNodes?: number;
    maxDrawEdges?: number;
    drawEdges?: boolean;
}
export interface AdaptiveDrawOptions {
    maxDrawNodes: number;
    maxDrawEdges: number;
    qualityScale: number;
}
export interface StepSummary {
    iterationCount: number;
    totalSpeed: number;
    averageSpeed: number;
    activeNodeCount: number;
    theta: number;
}
export interface RenderSnapshot {
    nodeCount: number;
    edgeCount: number;
    positions: Float32Array;
    edgeSource: Uint32Array;
    edgeTarget: Uint32Array;
    nodeRadii: Float32Array;
    nodeColors: Uint8Array;
    edgeWidths: Float32Array;
    edgeColors: Uint8Array;
}
export interface WasmForceKernel {
    isReady(): boolean;
    applyEdgeAttraction(x: Float64Array<ArrayBufferLike>, y: Float64Array<ArrayBufferLike>, mass: Float64Array<ArrayBufferLike>, ax: Float64Array<ArrayBufferLike>, ay: Float64Array<ArrayBufferLike>, edgeSource: Uint32Array<ArrayBufferLike>, edgeTarget: Uint32Array<ArrayBufferLike>, edgeWeight: Float32Array<ArrayBufferLike>, edgeCount: number, springLength: number, springStrength: number, minDistance: number, activeMask: Uint8Array<ArrayBufferLike>): void;
}
